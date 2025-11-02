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

import { useCallback, useEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import type { Item } from '@glideapps/glide-data-grid';
import { TransactionService } from '../services/TransactionService';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { showConfirm } from '@/lib/alerts';
import Swal from 'sweetalert2';
import type { TransactionData, PriceTier } from '../types/transaction.types';

interface UseTransactionOperationsProps {
  transactions: TransactionData[];
  filteredData: TransactionData[];
  priceTiers: PriceTier[];
  productToShipmentMap: Record<string, string>;
  productToShipmentStatusMap: Record<string, string>;
  bulkUpdate: (data: TransactionData[]) => void;
  update: (data: { id: number; data: Partial<TransactionData> }) => void;
  onCustomerWarning?: (data: {
    customerName: string;
    warnings: string[];
    onProceed: () => void;
    onCancel: () => void;
  }) => void;
}

interface UseTransactionOperationsReturn {
  // Cell editing
  handleCellEdited: (cell: Item, newValue: unknown) => void;

  // Row operations
  handleAdd10Rows: () => Promise<void>;
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
    onCustomerWarning,
  } = props;

  // ============================================================================
  // BATCH MODE TRACKING
  // ============================================================================

  const isBatchModeRef = useRef(false);
  const batchUpdatesRef = useRef<Map<number, Partial<TransactionData>>>(
    new Map()
  );

  // 🚀 PERFORMANCE: Create transaction index map for O(1) lookups
  const transactionIndexMap = useRef<Map<number, number>>(new Map());

  // Update index map when transactions change
  useCallback(() => {
    const map = new Map<number, number>();
    transactions.forEach((transaction, index) => {
      if (transaction.id !== undefined) {
        map.set(transaction.id, index);
      }
    });
    transactionIndexMap.current = map;
  }, [transactions])();

  // Flush batched edits triggered by paste/autofill events.
  useEffect(() => {
    const handleBatchStart = () => {
      logger.debug('🚀 Batch mode STARTED - preparing batched save');
      isBatchModeRef.current = true;
      batchUpdatesRef.current.clear();
    };

    const handleBatchComplete = (event: Event) => {
      const customEvent = event as CustomEvent<{ count?: number }>;
      const batchedUpdates: TransactionData[] = [];

      batchUpdatesRef.current.forEach((data, id) => {
        const baseline = transactions.find(
          (transaction) => transaction.id === id
        );
        if (!baseline) {
          logger.warn(
            `Batch update skipped for missing transaction ID ${String(id)}`
          );
          return;
        }

        batchedUpdates.push({
          ...baseline,
          ...data,
          Quantity: data.Quantity ?? baseline.Quantity ?? 0,
          'Unit Price': data['Unit Price'] ?? baseline['Unit Price'] ?? 0,
          Discount: data.Discount ?? baseline.Discount ?? 0,
          Adjustment: data.Adjustment ?? baseline.Adjustment ?? 0,
          'Line Total': data['Line Total'] ?? baseline['Line Total'] ?? 0,
        });
      });

      if (batchedUpdates.length > 0) {
        logger.debug(
          `📤 Flushing ${batchedUpdates.length} batched updates (cells edited: ${customEvent.detail?.count ?? 0})`
        );
        bulkUpdate(batchedUpdates);
        notifications.show({
          title: 'Success',
          message: `Saved ${batchedUpdates.length} transactions from paste`,
          color: 'green',
        });
      }

      isBatchModeRef.current = false;
      batchUpdatesRef.current.clear();
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
  }, [transactions, bulkUpdate]);

  // ============================================================================
  // CELL EDITING HANDLER
  // ============================================================================

  const handleCellEdited = useCallback(
    async (cell: Item, newValue: unknown) => {
      const [col, row] = cell;

      // Column IDs mapping
      const columnIds = [
        'orderDate',
        'customers',
        'productCode',
        'quantity',
        'unitPrice',
        'discount',
        'adjustment',
        'lineTotal',
        'orderStatus',
        'notes',
        'invoiceDate',
        'packedDate',
        'shipmentCode',
      ];

      const columnId = columnIds[col];
      const transaction = filteredData[row];

      if (!transaction || !transaction.id) {
        return;
      }

      // Check if this is part of a batch operation
      const isBatchEdit =
        typeof newValue === 'object' &&
        newValue !== null &&
        '_isBatchMode' in newValue &&
        (newValue as { _isBatchMode?: boolean })._isBatchMode;

      // Helper: Update transaction (batched or immediate)
      const updateTransactionData = (data: Partial<TransactionData>) => {
        if (!transaction.id) {
          return;
        }

        if (isBatchEdit || isBatchModeRef.current) {
          // BATCH MODE
          logger.debug(
            `📦 Batching update for transaction ${transaction.id}:`,
            data
          );
          const existing = batchUpdatesRef.current.get(transaction.id) || {};
          batchUpdatesRef.current.set(transaction.id, { ...existing, ...data });
        } else {
          // IMMEDIATE MODE
          logger.debug(
            `🔄 Immediate update for transaction ${transaction.id}:`,
            data
          );
          update({ id: transaction.id, data });
        }
      };

      // Helper: Show notification (suppressed during batch)
      const showNotification = (options: {
        title: string;
        message: string;
        color: string;
      }) => {
        if (!isBatchEdit && !isBatchModeRef.current) {
          notifications.show(options);
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
          return transaction;
        }

        const batchedUpdates = batchUpdatesRef.current.get(transaction.id);
        if (batchedUpdates) {
          // Merge transaction with batched updates
          return { ...transaction, ...batchedUpdates };
        }
        return transaction;
      };

      // Extract cell value
      const normalizeCellValue = (value: unknown): string => {
        if (
          value === null ||
          value === undefined ||
          (typeof value === 'string' && value.trim().toLowerCase() === 'null')
        ) {
          return '';
        }
        return String(value);
      };

      const getCellValue = (val: unknown): string => {
        if (!val || typeof val !== 'object') {
          return '';
        }
        if ('data' in val) {
          const data = (val as { data: unknown }).data;
          if (typeof data === 'object' && data !== null && 'value' in data) {
            return normalizeCellValue((data as { value: unknown }).value);
          }
          return normalizeCellValue(data);
        }
        return '';
      };

      const getNumericValue = (val: unknown): number => {
        const strVal = getCellValue(val);
        return Number(strVal) || 0;
      };

      // ========================================================================
      // ORDER DATE HANDLER
      // ========================================================================
      if (columnId === 'orderDate') {
        const newDate = getCellValue(newValue);
        updateTransactionData({ 'Order Date': newDate });

        showNotification({
          title: 'Success',
          message: 'Order Date updated successfully',
          color: 'green',
        });
      }

      // ========================================================================
      // CUSTOMERS HANDLER
      // ========================================================================
      if (columnId === 'customers') {
        const dropdownValue = getCellValue(newValue);

        // Validate customer
        if (dropdownValue && dropdownValue.trim() !== '') {
          TransactionService.validateCustomer(dropdownValue)
            .then((validation) => {
              if (validation.warnings.length > 0 && onCustomerWarning) {
                onCustomerWarning({
                  customerName: dropdownValue,
                  warnings: validation.warnings,
                  onProceed: () => {
                    notifications.show({
                      title: '⚠️ Warning Acknowledged',
                      message: `Proceeding with customer "${dropdownValue}" despite warnings`,
                      color: 'yellow',
                      autoClose: 6000,
                    });
                  },
                  onCancel: () => {
                    updateTransactionData({ Customers: '' });
                    notifications.show({
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
          const now = new Date();
          autoPopulatedOrderDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        updateTransactionData({
          Customers: dropdownValue,
          'Order Date': autoPopulatedOrderDate,
        });

        showNotification({
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
      }

      // ========================================================================
      // PRODUCT CODE HANDLER
      // ⚠️ FINALIZED AUTO-POPULATION LOGIC
      // ========================================================================
      if (columnId === 'productCode') {
        const dropdownValue = getCellValue(newValue);

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
            const currentQuantity = getCurrentTransaction().Quantity || 0;

            const stockResponse = await fetch('/api/inventory/check-stock', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productCode: dropdownValue.trim(),
                requestedQuantity: currentQuantity,
              }),
            });

            if (stockResponse.ok) {
              const stockInfo = (await stockResponse.json()) as {
                status: string;
                message: string;
                availableStock: number;
                canFulfill: boolean;
              };

              // 🔴 SOLD OUT or INSUFFICIENT STOCK - Block order creation
              if (
                stockInfo.status === 'SOLD_OUT' ||
                stockInfo.status === 'INSUFFICIENT_STOCK'
              ) {
                await Swal.fire({
                  icon: 'error',
                  title: '🔴 Cannot Create Order',
                  text: stockInfo.message,
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#fa5252',
                });
                logger.warn(
                  `Stock check failed for ${dropdownValue}:`,
                  stockInfo
                );
                return; // Prevent saving the transaction
              }

              // 🟡 LOW STOCK - Show warning but allow order
              if (stockInfo.status === 'LOW_STOCK') {
                await Swal.fire({
                  icon: 'warning',
                  title: '🟡 Low Stock Warning',
                  text: stockInfo.message,
                  confirmButtonText: 'Continue Anyway',
                  confirmButtonColor: '#fab005',
                  showCancelButton: true,
                  cancelButtonText: 'Cancel Order',
                });
                logger.info(
                  `Low stock warning for ${dropdownValue}:`,
                  stockInfo
                );
                // Continue with order creation
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

        if (shouldAutoPopulateStatus && correspondingShipmentStatus !== '') {
          finalOrderStatus =
            TransactionService.getOrderStatusFromShipmentStatus(
              correspondingShipmentStatus
            );
        }

        // Handle clearing Product Code
        if (!dropdownValue || dropdownValue.trim() === '') {
          if (
            currentOrderStatus.toLowerCase() === 'in transit' ||
            currentOrderStatus.toLowerCase() === 'warehouse'
          ) {
            finalOrderStatus = '';
          } else if (currentOrderStatus && currentOrderStatus.trim() !== '') {
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
              notifications.show({
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

        const updatedTransaction = {
          ...transaction,
          'Product Code': dropdownValue,
          'Shipment Code': correspondingShipmentCode,
          'Order Status': finalOrderStatus,
          'Unit Price': autoPopulatedUnitPrice,
        };

        updateTransactionData(updatedTransaction);

        // Build notification message
        let message = 'Product Code updated successfully';
        const autopopulated: string[] = [];
        if (correspondingShipmentCode) {
          autopopulated.push('Shipment Code');
        }
        if (shouldAutoPopulateStatus && correspondingShipmentStatus) {
          autopopulated.push('Order Status');
        }
        if (unitPriceAutoPopulated) {
          autopopulated.push('Unit Price');
        }

        if (autopopulated.length > 0) {
          message += ` and ${autopopulated.join(' & ')} auto-populated`;
        }
        if (unitPriceCleared) {
          message += ' (Unit Price cleared)';
        }

        showNotification({ title: 'Success', message, color: 'green' });
      }

      // ========================================================================
      // QUANTITY HANDLER
      // ⚠️ FINALIZED AUTO-POPULATION & COMPUTATION LOGIC
      // ========================================================================
      if (columnId === 'quantity') {
        const newQuantity = getNumericValue(newValue);

        // Get current transaction with any pending batch updates
        const currentTransaction = getCurrentTransaction();

        // =====================================================================
        // 🛡️ STOCK CHECK - Validate quantity against available stock
        // Smart logic:
        // - If REDUCING quantity: Allow (frees up stock)
        // - If INCREASING quantity: Check if additional stock available
        // - If NEW transaction: Check full quantity
        // Only check if:
        // 1. Quantity is greater than 0
        // 2. Product code exists
        // 3. Not in batch mode
        // =====================================================================
        const currentProductCode = currentTransaction['Product Code'] || '';
        const oldQuantity = transaction.Quantity || 0; // Original quantity before edit
        const quantityChange = newQuantity - oldQuantity; // Positive = increase, Negative = decrease

        // Only check if INCREASING quantity (quantityChange > 0)
        if (
          quantityChange > 0 &&
          currentProductCode &&
          currentProductCode.trim() !== '' &&
          !isBatchModeRef.current
        ) {
          try {
            const stockResponse = await fetch('/api/inventory/check-stock', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                productCode: currentProductCode.trim(),
                requestedQuantity: quantityChange, // Only check the ADDITIONAL quantity needed
              }),
            });

            if (stockResponse.ok) {
              const stockInfo = (await stockResponse.json()) as {
                status: string;
                message: string;
                availableStock: number;
                canFulfill: boolean;
              };

              // 🔴 SOLD OUT or INSUFFICIENT STOCK - Block order creation
              if (
                stockInfo.status === 'SOLD_OUT' ||
                stockInfo.status === 'INSUFFICIENT_STOCK'
              ) {
                await Swal.fire({
                  icon: 'error',
                  title: '🔴 Cannot Increase Quantity',
                  html: `<p>${stockInfo.message}</p><p><strong>You're trying to add ${quantityChange} more units.</strong></p>`,
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#fa5252',
                });
                logger.warn(
                  `Stock check failed for ${currentProductCode} (adding ${quantityChange} units):`,
                  stockInfo
                );
                return; // Prevent saving the transaction
              }

              // 🟡 LOW STOCK - Show warning but allow order
              if (stockInfo.status === 'LOW_STOCK') {
                await Swal.fire({
                  icon: 'warning',
                  title: '🟡 Low Stock Warning',
                  text: stockInfo.message,
                  confirmButtonText: 'Continue Anyway',
                  confirmButtonColor: '#fab005',
                  showCancelButton: true,
                  cancelButtonText: 'Cancel',
                });
                logger.info(
                  `Low stock warning for ${currentProductCode} (adding ${quantityChange} units):`,
                  stockInfo
                );
                // Continue with order creation
              }
            }
          } catch (error) {
            logger.error('Stock check failed:', error);
            // Continue with order creation on error (fail-safe)
          }
        } else if (quantityChange < 0) {
          // User is REDUCING quantity - this FREES UP stock, always allow
          logger.info(
            `Reducing quantity for ${currentProductCode}: ${oldQuantity} → ${newQuantity} (freeing ${Math.abs(quantityChange)} units)`
          );
        }

        // ⚠️ FINALIZED: Unit Price auto-population
        const currentDiscount = currentTransaction.Discount || 0;
        let autoPopulatedUnitPrice = 0;
        let unitPriceAutoPopulated = false;
        let unitPriceCleared = false;

        if (newQuantity <= 0) {
          unitPriceCleared = true;
        } else if (currentProductCode && newQuantity > 0) {
          autoPopulatedUnitPrice = TransactionService.calculateUnitPrice(
            currentProductCode,
            newQuantity,
            currentDiscount,
            priceTiers
          );
          unitPriceAutoPopulated = autoPopulatedUnitPrice > 0;
        }

        // ⚠️ FINALIZED: Line Total calculation
        const adjustment = currentTransaction.Adjustment || 0;
        const lineTotal = TransactionService.calculateLineTotal(
          newQuantity,
          autoPopulatedUnitPrice,
          adjustment
        );

        const updatedFields = {
          Quantity: newQuantity,
          'Unit Price': autoPopulatedUnitPrice,
          'Line Total': lineTotal,
        };

        updateTransactionData(updatedFields);

        let message = 'Quantity updated successfully';
        if (unitPriceAutoPopulated) {
          message = 'Quantity updated and Unit Price auto-populated';
        } else if (unitPriceCleared) {
          message = 'Quantity updated and Unit Price cleared';
        }

        showNotification({ title: 'Success', message, color: 'green' });
      }

      // ========================================================================
      // UNIT PRICE HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC
      // ========================================================================
      if (columnId === 'unitPrice') {
        const newUnitPrice = getNumericValue(newValue);

        // Get current transaction with any pending batch updates
        const currentTransaction = getCurrentTransaction();

        // ⚠️ FINALIZED: Line Total calculation
        const quantity = currentTransaction.Quantity || 0;
        const adjustment = currentTransaction.Adjustment || 0;
        const lineTotal = TransactionService.calculateLineTotal(
          quantity,
          newUnitPrice,
          adjustment
        );

        const updatedFields = {
          'Unit Price': newUnitPrice,
          'Line Total': lineTotal,
        };

        updateTransactionData(updatedFields);

        showNotification({
          title: 'Success',
          message: 'Unit Price updated successfully',
          color: 'green',
        });
      }

      // ========================================================================
      // DISCOUNT HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC
      // ========================================================================
      if (columnId === 'discount') {
        const newDiscount = getNumericValue(newValue);

        // Get current transaction with any pending batch updates
        const currentTransaction = getCurrentTransaction();

        // ⚠️ FINALIZED: Unit Price recalculation
        const currentProductCode = currentTransaction['Product Code'] || '';
        const currentQuantity = currentTransaction.Quantity || 0;
        let recalculatedUnitPrice = currentTransaction['Unit Price'] || 0;

        if (currentProductCode && currentQuantity > 0) {
          recalculatedUnitPrice = TransactionService.calculateUnitPrice(
            currentProductCode,
            currentQuantity,
            newDiscount,
            priceTiers
          );
        }

        // ⚠️ FINALIZED: Line Total calculation
        const quantity = currentTransaction.Quantity || 0;
        const adjustment = currentTransaction.Adjustment || 0;
        const lineTotal = TransactionService.calculateLineTotal(
          quantity,
          recalculatedUnitPrice,
          adjustment
        );

        const updatedFields = {
          'Unit Price': recalculatedUnitPrice,
          Discount: newDiscount,
          'Line Total': lineTotal,
        };

        updateTransactionData(updatedFields);

        showNotification({
          title: 'Success',
          message: 'Discount updated successfully',
          color: 'green',
        });
      }

      // ========================================================================
      // ADJUSTMENT HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC
      // ========================================================================
      if (columnId === 'adjustment') {
        const newAdjustment = getNumericValue(newValue);

        // Get current transaction with any pending batch updates
        const currentTransaction = getCurrentTransaction();

        // ⚠️ FINALIZED: Line Total calculation
        const quantity = currentTransaction.Quantity || 0;
        const unitPrice = currentTransaction['Unit Price'] || 0;
        const lineTotal = TransactionService.calculateLineTotal(
          quantity,
          unitPrice,
          newAdjustment
        );

        const updatedFields = {
          Adjustment: newAdjustment,
          'Line Total': lineTotal,
        };

        updateTransactionData(updatedFields);

        showNotification({
          title: 'Success',
          message: 'Adjustment updated successfully',
          color: 'green',
        });
      }

      // ========================================================================
      // ORDER STATUS HANDLER
      // ========================================================================
      if (columnId === 'orderStatus') {
        const dropdownValue = getCellValue(newValue);

        updateTransactionData({ 'Order Status': dropdownValue });

        showNotification({
          title: 'Success',
          message: 'Order Status updated successfully',
          color: 'green',
        });
      }

      // ========================================================================
      // NOTES HANDLER
      // ========================================================================
      if (columnId === 'notes') {
        const notesValue = getCellValue(newValue);

        updateTransactionData({ Notes: notesValue });

        showNotification({
          title: 'Success',
          message: 'Notes updated successfully',
          color: 'green',
        });
      }
    },
    [
      filteredData,
      priceTiers,
      productToShipmentMap,
      productToShipmentStatusMap,
      update,
      onCustomerWarning,
    ]
  );

  // ============================================================================
  // ADD EMPTY ROWS
  // ============================================================================

  const handleAdd10Rows = useCallback(async () => {
    const newEmptyRows = TransactionService.generateEmptyRows(10);

    try {
      await api.post<{ count: number }>('/api/transactions', newEmptyRows);

      // Reload transactions
      const data = await api.get<TransactionData[]>('/api/transactions');
      bulkUpdate(data);

      notifications.show({
        title: 'Success',
        message: '10 empty rows added successfully',
        color: 'green',
        autoClose: 3000,
      });
    } catch (error) {
      logger.error('Error adding empty rows:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to add empty rows to database';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [bulkUpdate]);

  // ============================================================================
  // CSV IMPORT
  // ============================================================================

  const handleCSVImport = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const importedTransactions =
          TransactionService.transformCSVToTransactions(text);

        if (importedTransactions.length === 0) {
          notifications.show({
            title: '⚠️ Import Warning',
            message: 'No valid transaction data found in the CSV file',
            color: 'yellow',
            autoClose: 4000,
          });
          return;
        }

        // Send to API
        const result = await api.post<{ count: number }>(
          '/api/transactions',
          importedTransactions
        );

        // Reload transactions
        const reloadedData =
          await api.get<TransactionData[]>('/api/transactions');
        bulkUpdate(reloadedData);

        notifications.show({
          title: '✅ Import Successful',
          message: `${result.count} transactions imported with auto-calculated Unit Price and Line Total`,
          color: 'green',
          autoClose: 5000,
        });
      } catch (error) {
        logger.error('Import error:', error);
        notifications.show({
          title: '❌ Import Failed',
          message: 'Failed to parse CSV file. Please check the file format.',
          color: 'red',
          autoClose: 4000,
        });
      }
    },
    [bulkUpdate]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    handleCellEdited,
    handleAdd10Rows,
    handleCSVImport,
    isBatchModeRef,
    batchUpdatesRef,
  };
}
