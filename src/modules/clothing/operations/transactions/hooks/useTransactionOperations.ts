'use client';

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

import { useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import type { NotificationData } from '@mantine/notifications';
import type { CellEditEvent } from '@/components/ui/HandsontableGrid';
import { TransactionService } from '../services/TransactionService';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { showConfirm, getSwal } from '@/lib/alerts';
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
import { createDraftTransactionFromRow } from './transactionDraftCreation';
import { useTransactionBatchMode } from './useTransactionBatchMode';
import { getCellValue } from './transactionCellValueUtils';
import { importTransactionsFromCsv } from './transactionCsvImport';
import { handleSimpleTransactionColumnEdit } from './transactionSimpleColumnHandlers';
import { handleComputedTransactionColumnEdit } from './transactionComputedColumnHandlers';
import { handleOrderStatusColumnEdit } from './transactionOrderStatusHandler';
import { handleQuantityColumnEdit } from './transactionQuantityColumnHandler';
import {
  describeTransaction,
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
  apiBasePath?: string;
  onCustomerWarning?: (data: {
    customerName: string;
    warnings: string[];
    onProceed: () => void;
    onCancel: () => void;
  }) => void;
}

interface UseTransactionOperationsReturn {
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
    apiBasePath,
    onCustomerWarning,
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

  const draftRowsRef = useRef<Map<number, TransactionData>>(new Map());
  const creatingDraftRowsRef = useRef<Set<number>>(new Set());

  const ensureDraftRow = useCallback((rowIndex: number): TransactionData => {
    const existing = draftRowsRef.current.get(rowIndex);
    if (existing) {
      return existing;
    }

    const emptyRow = createEmptyTransaction();
    draftRowsRef.current.set(rowIndex, emptyRow);
    return emptyRow;
  }, []);

  const createDraftTransaction = useCallback(
    async (
      rowIndex: number,
      draft: TransactionData,
      placeholderRow?: TransactionData
    ) => {
      return createDraftTransactionFromRow({
        rowIndex,
        draft,
        placeholderRow,
        creatingDraftRowsRef,
        draftRowsRef,
        apiBasePath,
        queryClient,
        transactionsQueryKey,
      });
    },
    [apiBasePath, queryClient, transactionsQueryKey]
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
    logNotification,
  });

  // ============================================================================
  // CELL EDITING HANDLER
  // ============================================================================

  const handleCellEdited = useCallback(
    async (edit: CellEditEvent<TransactionData>) => {
      const Swal = await getSwal();
      const { columnId, row: rowIndex, value: rawValue, isBatch } = edit;

      if (!columnId) {
        logger.warn('⚠️ Skipping transaction edit with unknown column', edit);
        return;
      }

      const transaction = filteredData[rowIndex] ?? ensureDraftRow(rowIndex);
      const isNewTransaction = !transaction.id;

      // Check if this is part of a batch operation
      const isBatchEdit = Boolean(isBatch || isBatchModeRef.current);
      const shouldLog = !isBatchEdit && !isNewTransaction;
      const transactionDescriptor = describeTransaction(transaction);

      const newValue = rawValue;

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
          Object.assign(transaction, merged);
          draftRowsRef.current.set(rowIndex, merged);

          // Attempt creation once required fields are present (order date + either customer or product)
          if (hasMinimumCreateFields(merged)) {
            draftRowsRef.current.set(rowIndex, merged);
            await createDraftTransaction(rowIndex, merged, transaction);
          }

          return;
        }

        const id = transaction.id;
        if (!id) {
          logger.warn('Skipping update for transaction without id', data);
          return;
        }

        if (isBatchEdit || isBatchModeRef.current) {
          logger.debug(`📦 Batching update for transaction ${id}:`, data);
          const existing = batchUpdatesRef.current.get(id) || {};
          batchUpdatesRef.current.set(id, { ...existing, ...data });
        } else {
          logger.debug(`🔄 Immediate update for transaction ${id}:`, data);
          update({ id, data });
        }
      };

      // Helper: Show notification (suppressed during batch)
      const notify = (options: NotificationData) => {
        if (!isBatchEdit && !isBatchModeRef.current) {
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
          return draftRowsRef.current.get(rowIndex) ?? transaction;
        }

        const batchedUpdates = batchUpdatesRef.current.get(transaction.id);
        if (batchedUpdates) {
          return { ...transaction, ...batchedUpdates };
        }
        return transaction;
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
          TransactionService.validateCustomer(dropdownValue)
            .then((validation) => {
              if (validation.warnings.length > 0 && onCustomerWarning) {
                onCustomerWarning({
                  customerName: dropdownValue,
                  warnings: validation.warnings,
                  onProceed: () => {
                    notify({
                      title: '⚠️ Warning Acknowledged',
                      message: `Proceeding with customer "${dropdownValue}" despite warnings`,
                      color: 'yellow',
                      autoClose: 6000,
                    });
                  },
                  onCancel: () => {
                    updateTransactionData({ Customers: '' });
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
        const dropdownValue = getCellValue(newValue);
        const isBundleSku = dropdownValue
          .trim()
          .toLowerCase()
          .startsWith('bundle');

        // =====================================================================
        // 🛡️ STOCK CHECK - Prevent overselling
        // Only check if:
        // 1. Product code is not empty
        // 2. Transaction has no ID (new row) OR is being created
        // 3. Not in batch mode (skip during paste operations)
        // =====================================================================
        if (
          dropdownValue &&
          dropdownValue.trim() !== '' &&
          !isBatchModeRef.current
        ) {
          try {
            const currentQuantity = getCurrentTransaction().Quantity ?? 0;

            // If Quantity is not set yet, don't block SKU selection.
            // Stock will be validated when Quantity is entered/changed.
            if (currentQuantity > 0) {
              const stockResponse = await fetch(
                buildApiPath(apiBasePath, '/inventory/check-stock'),
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    productCode: dropdownValue.trim(),
                    requestedQuantity: currentQuantity,
                  }),
                }
              );

              if (stockResponse.ok) {
                const stockInfo = (await stockResponse.json()) as {
                  status: string;
                  message: string;
                  availableStock: number;
                  canFulfill: boolean;
                };

                // f534 SOLD OUT - Block order creation
                if (stockInfo.status === 'SOLD_OUT') {
                  await Swal.fire({
                    icon: 'error',
                    title: 'f534 Insufficient Quantity!',
                    text: stockInfo.message,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#fa5252',
                    allowOutsideClick: false,
                  });
                  logger.warn(
                    `Stock check failed for ${dropdownValue}:`,
                    stockInfo
                  );
                  return;
                }

                // f534 INSUFFICIENT STOCK - Offer to cap quantity to what's available
                if (stockInfo.status === 'INSUFFICIENT_STOCK') {
                  const available = Number(stockInfo.availableStock || 0);
                  if (available > 0) {
                    const result = await Swal.fire({
                      icon: 'warning',
                      title: 'f534 Insufficient Quantity!',
                      text: `${stockInfo.message}\n\nUse available quantity (${available}) to sell out?`,
                      showCancelButton: true,
                      confirmButtonText: `Use ${available}`,
                      cancelButtonText: 'Cancel',
                      confirmButtonColor: '#fab005',
                      cancelButtonColor: '#adb5bd',
                      allowOutsideClick: false,
                    });

                    if (result.isConfirmed) {
                      await updateTransactionData({ Quantity: available });
                    } else {
                      return;
                    }
                  } else {
                    await Swal.fire({
                      icon: 'error',
                      title: 'f534 Insufficient Quantity!',
                      text: stockInfo.message,
                      confirmButtonText: 'OK',
                      confirmButtonColor: '#fa5252',
                      allowOutsideClick: false,
                    });
                    logger.warn(
                      `Stock check failed for ${dropdownValue}:`,
                      stockInfo
                    );
                    return;
                  }
                }

                // f7e1 LOW STOCK - Show warning but allow order
                if (stockInfo.status === 'LOW_STOCK') {
                  await Swal.fire({
                    icon: 'warning',
                    title: 'f7e1 Low Stock Warning',
                    text: stockInfo.message,
                    confirmButtonText: 'OK',
                    confirmButtonColor: '#fab005',
                    allowOutsideClick: false,
                  });
                  logger.info(
                    `Low stock warning for ${dropdownValue}:`,
                    stockInfo
                  );
                }
              }
            }
          } catch (error) {
            logger.error('Stock check failed:', error);
            // Continue with order creation on error (fail-safe)
          }
        }

        // Auto-populate shipment code
        const correspondingShipmentCode =
          productToShipmentMap[dropdownValue] || '';
        const correspondingShipmentStatus =
          productToShipmentStatusMap[dropdownValue] || '';

        // Auto-populate order status (only if blank or "In Transit")
        const currentOrderStatus = transaction['Order Status'] || '';
        const shouldAutoPopulateStatus =
          currentOrderStatus === '' ||
          currentOrderStatus.toLowerCase() === 'in transit';

        let finalOrderStatus = currentOrderStatus;

        if (
          shouldAutoPopulateStatus &&
          dropdownValue &&
          dropdownValue.trim() !== ''
        ) {
          if (correspondingShipmentStatus !== '') {
            // Has shipment status - map to order status
            finalOrderStatus =
              TransactionService.getOrderStatusFromShipmentStatus(
                correspondingShipmentStatus
              );
          } else {
            // No shipment status yet - bundles are on-hand, others default to "In Transit"
            finalOrderStatus = isBundleSku ? 'Warehouse' : 'In Transit';
          }
        }

        // Handle clearing Product Code
        if (!dropdownValue || dropdownValue.trim() === '') {
          if (
            currentOrderStatus.toLowerCase() === 'in transit' ||
            currentOrderStatus.toLowerCase() === 'warehouse'
          ) {
            finalOrderStatus = '';
          } else if (
            currentOrderStatus &&
            currentOrderStatus.trim() !== '' &&
            currentOrderStatus.toLowerCase() !== 'prepared'
          ) {
            // Show confirmation for important statuses
            const shouldClear = await showConfirm({
              title: '⚠️ CONFIRMATION REQUIRED',
              message:
                `You are about to clear the Product Code for a transaction with Order Status: "${currentOrderStatus}"\n\n` +
                `This is an important status that may indicate:\n` +
                `• Order is in advanced processing stage\n` +
                `• Customer has been notified\n` +
                `• Business processes may be affected\n\n` +
                `Do you want to continue clearing the Product Code?\n\n` +
                `• Click Yes to clear Product Code and preserve Order Status\n` +
                `• Click No to keep both Product Code and Order Status unchanged`,
              type: 'warning',
              confirmButtonText: 'Yes, Clear Product Code',
              cancelButtonText: 'No, Keep Both',
            });

            if (!shouldClear) {
              notify({
                title: '✅ Action Cancelled',
                message: `Product Code clearing cancelled. Order Status "${currentOrderStatus}" preserved.`,
                color: 'blue',
                autoClose: 4000,
              });
              return;
            }
          }
        }

        // ⚠️ FINALIZED: Unit Price auto-population
        const currentQuantity = transaction.Quantity || 0;
        const currentDiscount = transaction.Discount || 0;
        const currentAdjustment = transaction.Adjustment || 0;
        let autoPopulatedUnitPrice = 0;
        let unitPriceAutoPopulated = false;
        let unitPriceCleared = false;

        if (!dropdownValue || dropdownValue.trim() === '') {
          unitPriceCleared = true;
        } else if (dropdownValue && currentQuantity > 0) {
          autoPopulatedUnitPrice = TransactionService.calculateUnitPrice(
            dropdownValue,
            currentQuantity,
            currentDiscount,
            priceTiers
          );
          unitPriceAutoPopulated = autoPopulatedUnitPrice > 0;
        }

        // Always recalculate line total so field order (qty first, product later) stays consistent
        const recalculatedLineTotal = TransactionService.calculateLineTotal(
          currentQuantity,
          autoPopulatedUnitPrice,
          currentAdjustment
        );

        const updatedTransaction = {
          ...transaction,
          'Product Code': dropdownValue,
          'Shipment Code': correspondingShipmentCode,
          'Order Status': finalOrderStatus,
          'Unit Price': autoPopulatedUnitPrice,
          'Line Total': recalculatedLineTotal,
        };

        updateTransactionData(updatedTransaction);

        // Build notification message
        let message = 'Product Code updated successfully';
        const autopopulated: string[] = [];
        if (correspondingShipmentCode) {
          autopopulated.push('Shipment Code');
        }
        if (
          shouldAutoPopulateStatus &&
          finalOrderStatus !== currentOrderStatus
        ) {
          autopopulated.push('Order Status');
        }
        if (unitPriceAutoPopulated) {
          autopopulated.push('Unit Price');
        }
        if (recalculatedLineTotal !== (transaction['Line Total'] ?? 0)) {
          autopopulated.push('Line Total');
        }

        if (autopopulated.length > 0) {
          message += ` and ${autopopulated.join(' & ')} auto-populated`;
        }
        if (unitPriceCleared) {
          message += ' (Unit Price cleared)';
        }

        notify({ title: 'Success', message, color: 'green' });

        if (shouldLog) {
          const previousProduct =
            transaction['Product Code'] &&
            transaction['Product Code'].trim() !== ''
              ? transaction['Product Code'].trim()
              : 'No product';
          const nextProduct =
            dropdownValue && dropdownValue.trim() !== ''
              ? dropdownValue.trim()
              : 'No product';

          const updates: string[] = [];

          if (previousProduct !== nextProduct) {
            updates.push(
              `Product Code from ${previousProduct} to ${nextProduct}`
            );
          }

          if (
            correspondingShipmentCode &&
            correspondingShipmentCode !== transaction['Shipment Code']
          ) {
            updates.push(`Shipment Code → ${correspondingShipmentCode}`);
          }

          if (
            shouldAutoPopulateStatus &&
            finalOrderStatus !== (transaction['Order Status'] ?? '') &&
            finalOrderStatus
          ) {
            updates.push(`Order Status → ${finalOrderStatus}`);
          }

          if (unitPriceAutoPopulated) {
            updates.push(
              `Unit Price → ${formatCurrencyValue(autoPopulatedUnitPrice)}`
            );
          }

          if (unitPriceCleared) {
            updates.push('Unit Price cleared');
          }

          if (recalculatedLineTotal !== (transaction['Line Total'] ?? 0)) {
            updates.push(
              `Line Total → ${formatCurrencyValue(recalculatedLineTotal)}`
            );
          }

          const updateSummary =
            updates.length > 0
              ? updates.join('; ')
              : 'No dependent fields changed';

          logNotification(
            `Product details updated for ${transactionDescriptor}. ${updateSummary}.`,
            {
              column: 'Product Code',
              transactionId: transaction.id,
              previousValue: transaction['Product Code'] ?? '',
              newValue: dropdownValue,
              shipmentCode: correspondingShipmentCode || null,
              orderStatus: finalOrderStatus,
              unitPrice: unitPriceAutoPopulated
                ? autoPopulatedUnitPrice
                : (transaction['Unit Price'] ?? 0),
            }
          );
        }
      }

      const quantityHandled = await handleQuantityColumnEdit({
        columnId,
        rawValue: newValue,
        transaction,
        transactionDescriptor,
        shouldLog,
        apiBasePath,
        isBatchMode: isBatchModeRef.current,
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
        updateTransactionData: (data) => updateTransactionData(data),
        logNotification,
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
      onCustomerWarning,
      logNotification,
      ensureDraftRow,
      createDraftTransaction,
      apiBasePath,
      batchUpdatesRef,
      isBatchModeRef,
    ]
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
    handleCellEdited,
    handleCSVImport,
    isBatchModeRef,
    batchUpdatesRef,
  };
}
