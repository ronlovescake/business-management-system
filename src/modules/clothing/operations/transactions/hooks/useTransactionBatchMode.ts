import { useEffect, useRef } from 'react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import type { TransactionData } from '../types/transaction.types';
import { buildBatchedTransactions } from './transactionOperationUtils';

interface UseTransactionBatchModeParams {
  transactions: TransactionData[];
  bulkUpdate: (data: TransactionData[]) => void;
  saveBulkUpdate?: (data: TransactionData[]) => Promise<{ count: number }>;
  saveBulkChanges?: (
    patches: Array<{ id: number; data: Partial<TransactionData> }>
  ) => Promise<{ count: number }>;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
}

interface UseTransactionBatchModeResult {
  isBatchModeRef: React.MutableRefObject<boolean>;
  batchUpdatesRef: React.MutableRefObject<
    Map<number, Partial<TransactionData>>
  >;
}

export function useTransactionBatchMode({
  transactions,
  bulkUpdate,
  saveBulkUpdate,
  saveBulkChanges,
  logNotification,
}: UseTransactionBatchModeParams): UseTransactionBatchModeResult {
  const isBatchModeRef = useRef(false);
  const activeBatchesRef = useRef(0);
  const cellCountRef = useRef(0);
  const batchUpdatesRef = useRef<Map<number, Partial<TransactionData>>>(
    new Map()
  );

  useEffect(() => {
    const handleBatchStart = () => {
      logger.debug('🚀 Batch mode STARTED - preparing batched save');
      isBatchModeRef.current = true;
      activeBatchesRef.current += 1;
    };

    const handleBatchComplete = async (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number }>;
      cellCountRef.current += customEvent.detail?.count ?? 0;
      activeBatchesRef.current = Math.max(0, activeBatchesRef.current - 1);
      if (activeBatchesRef.current > 0) {
        return;
      }
      const cellsEdited = cellCountRef.current;
      cellCountRef.current = 0;
      const patches = Array.from(batchUpdatesRef.current, ([id, data]) => ({
        id,
        data: { ...data },
      }));
      const batchedUpdates = buildBatchedTransactions(
        transactions,
        batchUpdatesRef.current
      );

      if (batchedUpdates.length !== batchUpdatesRef.current.size) {
        batchUpdatesRef.current.forEach((_data, id) => {
          const baseline = transactions.find(
            (transaction) => transaction.id === id
          );
          if (!baseline) {
            logger.warn(
              `Batch update skipped for missing transaction ID ${String(id)}`
            );
          }
        });
      }

      isBatchModeRef.current = false;
      batchUpdatesRef.current.clear();

      if (batchedUpdates.length > 0) {
        logger.debug(
          `📤 Flushing ${batchedUpdates.length} batched updates (cells edited: ${customEvent.detail?.count ?? 0})`
        );
        try {
          if (saveBulkChanges) {
            await saveBulkChanges(patches);
          } else if (saveBulkUpdate) {
            await saveBulkUpdate(batchedUpdates);
          } else {
            bulkUpdate(batchedUpdates);
          }
          showNotification({
            title: 'Success',
            message: `Saved ${batchedUpdates.length} transactions from paste`,
            color: 'green',
          });

          logNotification(
            `Batched edit applied to ${batchedUpdates.length} transactions (${cellsEdited} cells).`,
            {
              type: 'batch-update',
              transactionIds: batchedUpdates
                .map((update) => update.id)
                .filter((id): id is number => Number.isFinite(id)),
              cellsEdited,
            }
          );
        } catch (error) {
          showNotification({
            title: 'Transactions not saved',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to save pasted transactions',
            color: 'red',
          });
        }
      }
    };

    window.addEventListener('handsontable-batch-start', handleBatchStart);
    window.addEventListener('handsontable-batch-complete', handleBatchComplete);

    return () => {
      window.removeEventListener('handsontable-batch-start', handleBatchStart);
      window.removeEventListener(
        'handsontable-batch-complete',
        handleBatchComplete
      );
    };
  }, [
    transactions,
    bulkUpdate,
    saveBulkUpdate,
    saveBulkChanges,
    logNotification,
  ]);

  return {
    isBatchModeRef,
    batchUpdatesRef,
  };
}
