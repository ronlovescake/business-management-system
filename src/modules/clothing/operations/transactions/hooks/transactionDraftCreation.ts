import type { QueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import type { TransactionData } from '../types/transaction.types';
import {
  buildDraftCreatePayload,
  buildOptimisticTransaction,
  getCreateDraftTransactionErrorMessage,
} from './transactionOperationUtils';
import {
  createEmptyTransaction,
  hasMinimumCreateFields,
} from './transactionDraftUtils';

interface CreateDraftTransactionFromRowParams {
  rowIndex: number;
  draft: TransactionData;
  placeholderRow?: TransactionData;
  creatingDraftRowsRef: React.MutableRefObject<Set<number>>;
  draftRowsRef: React.MutableRefObject<Map<number, TransactionData>>;
  apiBasePath?: string;
  queryClient: QueryClient;
  transactionsQueryKey: readonly unknown[];
}

export async function createDraftTransactionFromRow({
  rowIndex,
  draft,
  placeholderRow,
  creatingDraftRowsRef,
  draftRowsRef,
  apiBasePath,
  queryClient,
  transactionsQueryKey,
}: CreateDraftTransactionFromRowParams): Promise<boolean> {
  if (creatingDraftRowsRef.current.has(rowIndex)) {
    return false;
  }

  if (!hasMinimumCreateFields(draft)) {
    return false;
  }

  creatingDraftRowsRef.current.add(rowIndex);
  try {
    const payload = buildDraftCreatePayload(draft);

    await api.post(buildApiPath(apiBasePath, '/transactions'), [payload]);

    const optimisticId = Number(Date.now() * -1);
    const optimisticTransaction = buildOptimisticTransaction(
      payload,
      optimisticId
    );

    queryClient.setQueryData<TransactionData[] | undefined>(
      transactionsQueryKey,
      (existing) =>
        existing
          ? [...existing, optimisticTransaction]
          : [optimisticTransaction]
    );

    Object.assign(draft, createEmptyTransaction());
    if (placeholderRow) {
      Object.assign(placeholderRow, createEmptyTransaction());
    }
    draftRowsRef.current.delete(rowIndex);

    await queryClient.invalidateQueries({
      queryKey: transactionsQueryKey,
    });

    showNotification({
      title: 'Success',
      message: 'New transaction created',
      color: 'green',
    });
    return true;
  } catch (error) {
    logger.error('Failed to create transaction from draft row:', error);
    const friendlyMessage = getCreateDraftTransactionErrorMessage(error);

    showNotification({
      title: '❌ Save Failed',
      message: friendlyMessage,
      color: 'red',
    });
    return false;
  } finally {
    creatingDraftRowsRef.current.delete(rowIndex);
  }
}
