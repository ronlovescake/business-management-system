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

import { useCallback, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import type { Item } from '@glideapps/glide-data-grid';
import { TransactionService } from '../services/TransactionService';
import { logger } from '@/lib/logger';
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

  // ============================================================================
  // HELPER: Save transaction to database
  // ============================================================================

  const saveTransactionToDatabase = useCallback(
    async (transaction: TransactionData) => {
      try {
        const response = await fetch('/api/transactions', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transaction),
        });

        if (!response.ok) {
          throw new Error('Failed to save transaction to database');
        }

        return await response.json();
      } catch (error) {
        logger.error('Error saving transaction:', error);
        throw error;
      }
    },
    []
  );

  // ============================================================================
  // CELL EDITING HANDLER
  // ============================================================================

  const handleCellEdited = useCallback(
    (cell: Item, newValue: unknown) => {
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

      if (!transaction || !transaction.id) return;

      // Check if this is part of a batch operation
      const isBatchEdit =
        typeof newValue === 'object' &&
        newValue !== null &&
        '_isBatchMode' in newValue &&
        (newValue as { _isBatchMode?: boolean })._isBatchMode;

      // Helper: Update transaction (batched or immediate)
      const updateTransactionData = (data: Partial<TransactionData>) => {
        if (!transaction.id) return;

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
        if (!transaction.id) return transaction;

        const batchedUpdates = batchUpdatesRef.current.get(transaction.id);
        if (batchedUpdates) {
          // Merge transaction with batched updates
          return { ...transaction, ...batchedUpdates };
        }
        return transaction;
      };

      // Extract cell value
      const getCellValue = (val: unknown): string => {
        if (!val || typeof val !== 'object') return '';
        if ('data' in val) {
          const data = (val as { data: unknown }).data;
          if (typeof data === 'object' && data !== null && 'value' in data) {
            return String((data as { value: unknown }).value);
          }
          return String(data);
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

        if (!isBatchEdit && !isBatchModeRef.current) {
          const updatedTransaction = { ...transaction, 'Order Date': newDate };
          saveTransactionToDatabase(updatedTransaction).catch(() => {
            showNotification({
              title: 'Error',
              message: 'Failed to save Order Date to database',
              color: 'red',
            });
          });
        }

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
                    if (!isBatchEdit && !isBatchModeRef.current) {
                      saveTransactionToDatabase({
                        ...transaction,
                        Customers: '',
                      }).catch(logger.error);
                    }
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

        if (!isBatchEdit && !isBatchModeRef.current) {
          saveTransactionToDatabase({
            ...transaction,
            Customers: dropdownValue,
            'Order Date': autoPopulatedOrderDate,
          }).catch(() => {
            showNotification({
              title: 'Error',
              message: 'Failed to save Customer to database',
              color: 'red',
            });
          });
        }

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
            const shouldClear = window.confirm(
              `⚠️ CONFIRMATION REQUIRED\n\n` +
                `You are about to clear the Product Code for a transaction with Order Status: "${currentOrderStatus}"\n\n` +
                `This is an important status that may indicate:\n` +
                `• Order is in advanced processing stage\n` +
                `• Customer has been notified\n` +
                `• Business processes may be affected\n\n` +
                `Do you want to continue clearing the Product Code?\n\n` +
                `• Click OK to clear Product Code and preserve Order Status\n` +
                `• Click Cancel to keep both Product Code and Order Status unchanged`
            );

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
        saveTransactionToDatabase(updatedTransaction).catch(() => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Product Code to database',
            color: 'red',
          });
        });

        // Build notification message
        let message = 'Product Code updated successfully';
        const autopopulated = [];
        if (correspondingShipmentCode) autopopulated.push('Shipment Code');
        if (shouldAutoPopulateStatus && correspondingShipmentStatus) {
          autopopulated.push('Order Status');
        }
        if (unitPriceAutoPopulated) autopopulated.push('Unit Price');

        if (autopopulated.length > 0) {
          message += ` and ${autopopulated.join(' & ')} auto-populated`;
        }
        if (unitPriceCleared) message += ' (Unit Price cleared)';

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

        // ⚠️ FINALIZED: Unit Price auto-population
        const currentProductCode = currentTransaction['Product Code'] || '';
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

        // Save full transaction to database
        const fullTransaction = { ...currentTransaction, ...updatedFields };
        saveTransactionToDatabase(fullTransaction).catch(() => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Quantity to database',
            color: 'red',
          });
        });

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

        // Save full transaction to database
        const fullTransaction = { ...currentTransaction, ...updatedFields };
        saveTransactionToDatabase(fullTransaction).catch(() => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Unit Price to database',
            color: 'red',
          });
        });

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

        // Save full transaction to database
        const fullTransaction = { ...currentTransaction, ...updatedFields };
        saveTransactionToDatabase(fullTransaction).catch(() => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Discount to database',
            color: 'red',
          });
        });

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

        // Save full transaction to database
        const fullTransaction = { ...currentTransaction, ...updatedFields };
        saveTransactionToDatabase(fullTransaction).catch(() => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Adjustment to database',
            color: 'red',
          });
        });

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
      saveTransactionToDatabase,
      onCustomerWarning,
    ]
  );

  // ============================================================================
  // ADD EMPTY ROWS
  // ============================================================================

  const handleAdd10Rows = useCallback(async () => {
    const newEmptyRows = TransactionService.generateEmptyRows(10);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEmptyRows),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as {
          details?: string;
          error?: string;
        };
        logger.error('API error response:', errorData);
        throw new Error(
          errorData.details ||
            errorData.error ||
            'Failed to save empty rows to database'
        );
      }

      // Reload transactions
      const reloadResponse = await fetch('/api/transactions');
      if (reloadResponse.ok) {
        const data = (await reloadResponse.json()) as TransactionData[];
        bulkUpdate(data);
      }

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
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(importedTransactions),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const result = (await response.json()) as { count: number };

        // Reload transactions
        const reloadResponse = await fetch('/api/transactions');
        if (reloadResponse.ok) {
          const reloadedData =
            (await reloadResponse.json()) as TransactionData[];
          bulkUpdate(reloadedData);
        }

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
