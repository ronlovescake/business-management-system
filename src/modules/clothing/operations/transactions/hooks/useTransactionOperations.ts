'use client';
import { handleProductCodeColumnEdit } from './transactionProductCodeColumnHandler';

/**
 * useTransactionOperations Hook
 *
 * Handles all transaction operations including:
 * - Cell editing with business logic
 * - CSV import
 * - Adding empty rows
 * - Invoice generation
 * - Packing list generation
 * - Distribution generation
 */

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import type { NotificationData } from '@mantine/notifications';
import type { CellEditEvent } from '@/components/ui/HandsontableGrid';
import { TransactionService } from '../services/TransactionService';
import { logger } from '@/lib/logger';
import { getSwal } from '@/lib/alerts';
import type { TransactionData, PriceTier } from '../types/transaction.types';
import { queryKeys } from '@/lib/queryKeys';
import { OperationsNotificationsService } from '../../notifications/services/OperationsNotificationsService';
import { isVoidedOrderStatus } from '@/lib/transactions/order-status';
import { confirmCustomerReplacement } from './confirmCustomerReplace';
import {
  createEmptyTransaction,
  formatTodayInManila,
  hasMinimumCreateFields,
} from './transactionDraftUtils';
import {
  createDraftTransactionFromRow,
  type TransactionCreationRequest,
} from './transactionDraftCreation';
import { useTransactionBatchMode } from './useTransactionBatchMode';
import { getCellValue } from './transactionCellValueUtils';
import { importTransactionsFromCsv } from './transactionCsvImport';
import { handleSimpleTransactionColumnEdit } from './transactionSimpleColumnHandlers';
import { handleComputedTransactionColumnEdit } from './transactionComputedColumnHandlers';
import { handleOrderStatusColumnEdit } from './transactionOrderStatusHandler';
import { handleQuantityColumnEdit } from './transactionQuantityColumnHandler';
import {
  describeTransaction,
  buildDraftCreatePayload,
  getCreateDraftTransactionErrorMessage,
  formatCurrencyValue,
  formatNumberValue,
  isPaidOrderStatus,
  truncateText,
} from './transactionOperationUtils';

interface UseTransactionOperationsProps {
  transactions: TransactionData[];
  filteredData: TransactionData[];
  priceTiers: PriceTier[];
  productToShipmentMap: Record<string, string>;
  productToShipmentStatusMap: Record<string, string>;
  bulkUpdate: (data: TransactionData[]) => void;
  update: (data: { id: number; data: Partial<TransactionData> }) => void;
  saveOrderStatus?: (
    id: number,
    status: string
  ) => Promise<Pick<TransactionData, 'Order Status'>>;
  saveBulkUpdate?: (data: TransactionData[]) => Promise<{ count: number }>;
  saveBulkChanges?: (
    patches: Array<{ id: number; data: Partial<TransactionData> }>
  ) => Promise<{ count: number }>;
  getTransaction?: (id: number) => TransactionData | undefined;
  beginDraft?: () => () => void;
  adoptCreatedRow?: (row: TransactionData) => void;
  replacePlaceholder?: (row: TransactionData) => void;
  apiBasePath?: string;
  onCustomerWarning?: (data: {
    customerName: string;
    warnings: string[];
    onProceed: () => void;
    onCancel: () => void;
  }) => void;
  onVoidedStatusSaved?: (customerName: string) => void | Promise<void>;
}

interface UseTransactionOperationsReturn {
  draftError: string | null;
  hasDrafts: boolean;
  creatingDraft: boolean;
  retryDrafts: () => Promise<void>;
  discardDrafts: () => void;
  // Cell editing
  handleCellEdited: (
    edit: CellEditEvent<TransactionData>
  ) => void | boolean | Promise<void | boolean>;

  // Row operations
  handleCSVImport: (file: File) => Promise<void>;

  // Batch operation refs
  isBatchModeRef: React.MutableRefObject<boolean>;
  batchUpdatesRef: React.MutableRefObject<
    Map<number, Partial<TransactionData>>
  >;
}

/**
 * Main hook
 */
export function useTransactionOperations(
  props: UseTransactionOperationsProps
): UseTransactionOperationsReturn {
  const {
    transactions,
    filteredData,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,
    bulkUpdate,
    update,
    saveOrderStatus,
    saveBulkUpdate,
    saveBulkChanges,
    getTransaction,
    beginDraft,
    adoptCreatedRow,
    replacePlaceholder,
    apiBasePath,
    onCustomerWarning,
    onVoidedStatusSaved,
  } = props;

  const queryClient = useQueryClient();
  const operationsNotificationsQueryKey = useMemo(
    () => [...queryKeys.operationsNotifications.all, apiBasePath ?? 'default'],
    [apiBasePath]
  );
  const transactionsQueryKey = useMemo(
    () => [...queryKeys.transactions.lists(), apiBasePath ?? '/api'],
    [apiBasePath]
  );

  const draftRowsRef = useRef(new Map<TransactionData, TransactionData>());
  const customerRevisionsRef = useRef(
    new Map<number | TransactionData, object>()
  );
  const requestsRef = useRef(
    new Map<TransactionData, TransactionCreationRequest>()
  );
  const draftLeasesRef = useRef(new Map<TransactionData, () => void>());
  const [draftError, setDraftError] = useState<string | null>(null);
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [, publishDrafts] = useState(0);
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    const leases = draftLeasesRef.current;
    return () => {
      activeRef.current = false;
      leases.forEach((finish) => finish());
      leases.clear();
    };
  }, []);

  const ensureDraftRow = useCallback((_rowIndex: number): TransactionData => {
    const emptyRow = createEmptyTransaction();
    return emptyRow;
  }, []);

  const createDraftTransaction = useCallback(
    async (placeholderRow: TransactionData) => {
      const draft = draftRowsRef.current.get(placeholderRow);
      if (!activeRef.current || !draft || !hasMinimumCreateFields(draft)) {
        return;
      }
      const request = requestsRef.current.get(placeholderRow) ?? {
        key: crypto.randomUUID(),
      };
      requestsRef.current.set(placeholderRow, request);
      setCreatingDraft(true);
      try {
        const saved = await createDraftTransactionFromRow(
          draft,
          request,
          apiBasePath
        );
        if (!activeRef.current) {
          return;
        }
        const latest = buildDraftCreatePayload(
          draftRowsRef.current.get(placeholderRow) ?? draft
        );
        const changes: Partial<TransactionData> = {};
        Object.entries(latest).forEach(([field, value]) => {
          if (request.payload?.[field as keyof typeof latest] !== value) {
            Object.assign(changes, { [field]: value });
          }
        });
        adoptCreatedRow?.(saved);
        queryClient.setQueryData<TransactionData[]>(
          transactionsQueryKey,
          (rows) => [
            ...(rows ?? []).filter((row) => row.id !== saved.id),
            saved,
          ]
        );
        if (Object.keys(changes).length && saved.id) {
          if (saveBulkChanges) {
            void saveBulkChanges([{ id: saved.id, data: changes }]).catch(
              logger.error
            );
          } else {
            update({ id: saved.id, data: changes });
          }
        }
        replacePlaceholder?.(placeholderRow);
        const customerRevision =
          customerRevisionsRef.current.get(placeholderRow);
        if (saved.id && customerRevision) {
          customerRevisionsRef.current.set(saved.id, customerRevision);
          customerRevisionsRef.current.delete(placeholderRow);
        }
        Object.assign(placeholderRow, saved, changes);
        draftRowsRef.current.delete(placeholderRow);
        requestsRef.current.delete(placeholderRow);
        draftLeasesRef.current.get(placeholderRow)?.();
        draftLeasesRef.current.delete(placeholderRow);
        setDraftError(null);
        showNotification({
          title: 'Success',
          message: 'New transaction created',
          color: 'green',
        });
      } catch (error) {
        if (activeRef.current) {
          setDraftError(getCreateDraftTransactionErrorMessage(error));
        }
      } finally {
        if (activeRef.current) {
          setCreatingDraft(false);
          publishDrafts((revision) => revision + 1);
        }
      }
    },
    [
      apiBasePath,
      queryClient,
      transactionsQueryKey,
      adoptCreatedRow,
      replacePlaceholder,
      saveBulkChanges,
      update,
    ]
  );

  const logNotification = useCallback(
    (message: string, metadata?: Record<string, unknown>) => {
      OperationsNotificationsService.log(
        {
          category: 'transactions',
          changes: message,
          metadata,
        },
        apiBasePath
      )
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: operationsNotificationsQueryKey,
          });
        })
        .catch((error) => {
          logger.error('Failed to log transaction notification:', error);
        });
    },
    [apiBasePath, operationsNotificationsQueryKey, queryClient]
  );

  const { isBatchModeRef, batchUpdatesRef } = useTransactionBatchMode({
    transactions,
    bulkUpdate,
    saveBulkUpdate,
    saveBulkChanges,
    logNotification,
  });

  // ============================================================================
  // CELL EDITING HANDLER
  // ============================================================================

  const processCellEdited = useCallback(
    async (edit: CellEditEvent<TransactionData>, customerRevision: object) => {
      const Swal = await getSwal();
      const { columnId, row: rowIndex, value: rawValue, isBatch } = edit;

      if (!columnId) {
        logger.warn('⚠️ Skipping transaction edit with unknown column', edit);
        return;
      }

      const selected =
        edit.rowData ?? filteredData[rowIndex] ?? ensureDraftRow(rowIndex);
      const latestTransaction = selected.id
        ? (getTransaction?.(selected.id) ?? selected)
        : (draftRowsRef.current.get(selected) ?? selected);
      const pending = selected.id
        ? batchUpdatesRef.current.get(selected.id)
        : undefined;
      const transaction = pending
        ? { ...latestTransaction, ...pending }
        : latestTransaction;
      const isNewTransaction = !transaction.id;

      // Check if this is part of a batch operation
      const isBatchEdit = Boolean(isBatch);
      const shouldLog = !isBatchEdit && !isNewTransaction;
      const transactionDescriptor = describeTransaction(transaction);

      const newValue = rawValue;

      const supersedePendingBatch = (data: Partial<TransactionData>) => {
        if (!transaction.id) {
          return;
        }
        const pendingBatch = batchUpdatesRef.current.get(transaction.id);
        if (!pendingBatch) {
          return;
        }
        const remaining = { ...pendingBatch };
        Object.keys(data).forEach((key) => {
          delete remaining[key as keyof TransactionData];
        });
        if (Object.keys(remaining).length > 0) {
          batchUpdatesRef.current.set(transaction.id, remaining);
        } else {
          batchUpdatesRef.current.delete(transaction.id);
        }
      };

      // Helper: Update transaction (batched or immediate)
      const updateTransactionData = async (data: Partial<TransactionData>) => {
        if (isNewTransaction) {
          const merged = { ...transaction, ...data };

          // Auto-populate Order Date for new placeholders as soon as we have either customer or product
          if (
            (!merged['Order Date'] || merged['Order Date'].trim() === '') &&
            ((merged.Customers && merged.Customers.trim() !== '') ||
              (merged['Product Code'] && merged['Product Code'].trim() !== ''))
          ) {
            merged['Order Date'] = formatTodayInManila();
          }

          // Mutate the in-memory placeholder so the grid shows auto-populated values immediately
          Object.assign(selected, merged);
          draftRowsRef.current.set(selected, merged);
          if (!draftLeasesRef.current.has(selected)) {
            draftLeasesRef.current.set(selected, beginDraft?.() ?? (() => {}));
          }
          publishDrafts((revision) => revision + 1);

          return;
        }

        const id = transaction.id;
        if (!id) {
          logger.warn('Skipping update for transaction without id', data);
          return;
        }

        if (isBatchEdit && isBatchModeRef.current) {
          logger.debug(`📦 Batching update for transaction ${id}:`, data);
          const existing = batchUpdatesRef.current.get(id) || {};
          batchUpdatesRef.current.set(id, { ...existing, ...data });
        } else if (isBatchEdit && saveBulkChanges) {
          void saveBulkChanges([{ id, data }]).catch(logger.error);
        } else {
          supersedePendingBatch(data);
          logger.debug(`🔄 Immediate update for transaction ${id}:`, data);
          update({ id, data });
        }
      };

      // Helper: Show notification (suppressed during batch)
      const notify = (options: NotificationData) => {
        if (!isBatchEdit) {
          showNotification(options);
        } else {
          logger.debug(
            '🔇 Notification suppressed (batch mode):',
            options.message
          );
        }
      };

      // Helper: Get current transaction with any pending batch updates
      const getCurrentTransaction = (): TransactionData => {
        if (!transaction.id) {
          return draftRowsRef.current.get(selected) ?? transaction;
        }

        const currentTransaction =
          getTransaction?.(transaction.id) ?? transaction;
        const batchedUpdates = batchUpdatesRef.current.get(transaction.id);
        if (batchedUpdates) {
          return { ...currentTransaction, ...batchedUpdates };
        }
        return currentTransaction;
      };

      const simpleColumnHandled = handleSimpleTransactionColumnEdit({
        columnId,
        rawValue: newValue,
        transaction,
        transactionDescriptor,
        shouldLog,
        updateTransactionData,
        notify,
        logNotification,
        truncateText,
      });

      if (simpleColumnHandled) {
        return;
      }

      // ========================================================================
      // CUSTOMERS HANDLER
      // ========================================================================
      if (columnId === 'customers') {
        const dropdownValue = getCellValue(newValue);
        const previousCustomerInput =
          typeof edit.oldValue === 'string' ? edit.oldValue.trim() : '';
        const nextCustomer = dropdownValue.trim();
        const shouldProceed = await confirmCustomerReplacement({
          previousCustomerInput,
          nextCustomer,
          source: edit.source,
        });

        if (!shouldProceed) {
          return false;
        }

        // Validate customer
        if (dropdownValue && dropdownValue.trim() !== '') {
          const isCurrentCustomer = () =>
            customerRevisionsRef.current.get(selected.id ?? selected) ===
            customerRevision;
          TransactionService.validateCustomer(dropdownValue)
            .then((validation) => {
              if (!isCurrentCustomer()) {
                return;
              }
              if (validation.warnings.length > 0 && onCustomerWarning) {
                onCustomerWarning({
                  customerName: dropdownValue,
                  warnings: validation.warnings,
                  onProceed: () => {
                    if (!isCurrentCustomer()) {
                      return;
                    }
                    notify({
                      title: '⚠️ Warning Acknowledged',
                      message: `Proceeding with customer "${dropdownValue}" despite warnings`,
                      color: 'yellow',
                      autoClose: 6000,
                    });
                  },
                  onCancel: () => {
                    if (!isCurrentCustomer()) {
                      return;
                    }
                    if (selected.id) {
                      update({ id: selected.id, data: { Customers: '' } });
                    } else {
                      void updateTransactionData({ Customers: '' });
                    }
                    notify({
                      title: '🚫 Customer Selection Cancelled',
                      message: `Customer "${dropdownValue}" was not selected due to warnings`,
                      color: 'orange',
                      autoClose: 5000,
                    });
                  },
                });
              }
            })
            .catch(logger.error);
        }

        // Auto-populate Order Date if empty
        const currentOrderDate = transaction['Order Date'];
        let autoPopulatedOrderDate = currentOrderDate;

        if (
          dropdownValue &&
          dropdownValue.trim() !== '' &&
          (!currentOrderDate || currentOrderDate.trim() === '')
        ) {
          autoPopulatedOrderDate = formatTodayInManila();
        }

        updateTransactionData({
          Customers: dropdownValue,
          'Order Date': autoPopulatedOrderDate,
        });

        notify({
          title: 'Success',
          message:
            dropdownValue &&
            dropdownValue.trim() !== '' &&
            (!transaction['Order Date'] ||
              transaction['Order Date'].trim() === '')
              ? 'Customer updated and Order Date auto-populated'
              : dropdownValue && dropdownValue.trim() !== ''
                ? 'Customer updated successfully'
                : 'Customer cleared',
          color: 'green',
        });

        if (shouldLog) {
          const previousCustomer =
            transaction.Customers && transaction.Customers.trim() !== ''
              ? transaction.Customers.trim()
              : 'No customer';
          const nextCustomer =
            dropdownValue && dropdownValue.trim() !== ''
              ? dropdownValue.trim()
              : 'No customer';

          if (previousCustomer !== nextCustomer) {
            let message = `Customer updated from ${previousCustomer} to ${nextCustomer} for ${transactionDescriptor}.`;

            if (
              autoPopulatedOrderDate &&
              autoPopulatedOrderDate !== (transaction['Order Date'] ?? '')
            ) {
              message += ` Order Date auto-set to ${autoPopulatedOrderDate}.`;
            }

            logNotification(message, {
              column: 'Customers',
              transactionId: transaction.id,
              previousValue: transaction.Customers ?? '',
              newValue: dropdownValue,
              autoPopulatedOrderDate,
            });
          }
        }
      }

      // ========================================================================
      // PRODUCT CODE HANDLER
      // ⚠️ FINALIZED AUTO-POPULATION LOGIC
      // ========================================================================
      if (columnId === 'productCode') {
        return handleProductCodeColumnEdit({
          rawValue: newValue,
          transaction,
          transactionDescriptor,
          shouldLog,
          apiBasePath,
          isBatchMode: isBatchEdit,
          priceTiers,
          getCurrentTransaction,
          updateTransactionData,
          notify,
          logNotification,
          formatCurrencyValue,
          fireAlert: (options) => Swal.fire(options),
          productToShipmentMap,
          productToShipmentStatusMap,
        });
      }

      const quantityHandled = await handleQuantityColumnEdit({
        columnId,
        rawValue: newValue,
        transaction,
        transactionDescriptor,
        shouldLog,
        apiBasePath,
        isBatchMode: isBatchEdit,
        priceTiers,
        getCurrentTransaction,
        updateTransactionData,
        notify,
        logNotification,
        formatCurrencyValue,
        formatNumberValue,
        fireAlert: (options) => Swal.fire(options),
      });

      if (quantityHandled) {
        return;
      }

      const computedColumnHandled = handleComputedTransactionColumnEdit({
        columnId,
        rawValue: newValue,
        transaction,
        transactionDescriptor,
        shouldLog,
        priceTiers,
        getCurrentTransaction,
        updateTransactionData,
        notify,
        logNotification,
        formatCurrencyValue,
        formatNumberValue,
      });

      if (computedColumnHandled) {
        return;
      }

      const orderStatusHandled = await handleOrderStatusColumnEdit({
        columnId,
        rawValue: newValue,
        transaction,
        transactionDescriptor,
        shouldLog,
        isPaidOrderStatus,
        isVoidedOrderStatus,
        formatCurrencyValue,
        notify,
        updateTransactionData: (data) => {
          if (transaction.id && !isBatchEdit && saveOrderStatus) {
            supersedePendingBatch(data);
            return saveOrderStatus(transaction.id, data['Order Status']);
          }
          return updateTransactionData(data);
        },
        logNotification,
        onVoidedStatusSaved,
        fireAlert: (options) => Swal.fire(options),
      });

      if (orderStatusHandled) {
        return;
      }
    },
    [
      filteredData,
      priceTiers,
      productToShipmentMap,
      productToShipmentStatusMap,
      update,
      saveOrderStatus,
      saveBulkChanges,
      getTransaction,
      onCustomerWarning,
      onVoidedStatusSaved,
      logNotification,
      ensureDraftRow,
      apiBasePath,
      batchUpdatesRef,
      isBatchModeRef,
      beginDraft,
    ]
  );

  const editChain = useRef<Promise<unknown>>(Promise.resolve());
  const handleCellEdited = useCallback(
    (edit: CellEditEvent<TransactionData>) => {
      const customerRevision = {};
      const selected = edit.rowData ?? filteredData[edit.row];
      if (edit.columnId === 'customers' && selected) {
        customerRevisionsRef.current.set(
          selected.id ?? selected,
          customerRevision
        );
      }
      const task = editChain.current.then(async () => {
        if (!activeRef.current) {
          return false;
        }
        const accepted = await processCellEdited(edit, customerRevision);
        if (
          accepted !== false &&
          selected &&
          !selected.id &&
          !requestsRef.current.has(selected)
        ) {
          await createDraftTransaction(selected);
        }
        return accepted;
      });
      editChain.current = task.catch(() => {});
      return task;
    },
    [processCellEdited, filteredData, createDraftTransaction]
  );

  // ============================================================================
  // ADD EMPTY ROWS
  // ============================================================================

  // ============================================================================
  // CSV IMPORT
  // ============================================================================

  const handleCSVImport = useCallback(
    async (file: File) => {
      await importTransactionsFromCsv({
        file,
        apiBasePath,
        bulkUpdate,
        logNotification,
      });
    },
    [apiBasePath, bulkUpdate, logNotification]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    draftError,
    hasDrafts: draftRowsRef.current.size > 0,
    creatingDraft,
    retryDrafts: async () => {
      const task = editChain.current.then(async () => {
        for (const placeholder of Array.from(draftRowsRef.current.keys())) {
          await createDraftTransaction(placeholder);
        }
      });
      editChain.current = task.catch(() => {});
      await task;
    },
    discardDrafts: () => {
      if (creatingDraft) {
        return;
      }
      draftRowsRef.current.forEach((_, placeholder) => {
        replacePlaceholder?.(placeholder);
        Object.assign(placeholder, createEmptyTransaction());
      });
      draftRowsRef.current.clear();
      requestsRef.current.clear();
      draftLeasesRef.current.forEach((finish) => finish());
      draftLeasesRef.current.clear();
      setDraftError(null);
      publishDrafts((revision) => revision + 1);
    },
    handleCellEdited,
    handleCSVImport,
    isBatchModeRef,
    batchUpdatesRef,
  };
}
