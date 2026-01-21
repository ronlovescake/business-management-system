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
import { useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import type { NotificationData } from '@mantine/notifications';
import type { CellEditEvent } from '@/components/ui/HandsontableGrid';
import { TransactionService } from '../services/TransactionService';
import { api, ApiError } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { showConfirm } from '@/lib/alerts';
import Swal from 'sweetalert2';
import type { TransactionData, PriceTier } from '../types/transaction.types';
import { queryKeys } from '@/lib/queryKeys';
import { OperationsNotificationsService } from '../../notifications/services/OperationsNotificationsService';
import { PAID_STATUSES } from '@/lib/accounting/constants';

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
    onCustomerWarning,
  } = props;

  const queryClient = useQueryClient();

  const draftRowsRef = useRef<Map<number, TransactionData>>(new Map());
  const creatingDraftRowsRef = useRef<Set<number>>(new Set());

  const formatToday = useCallback(() => {
    const now = new Date();
    return now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  }, []);

  const createEmptyTransaction = useCallback((): TransactionData => {
    return {
      'Order Date': '',
      Customers: '',
      'Product Code': '',
      Quantity: 0,
      'Unit Price': 0,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 0,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
  }, []);

  const ensureDraftRow = useCallback(
    (rowIndex: number): TransactionData => {
      const existing = draftRowsRef.current.get(rowIndex);
      if (existing) {
        return existing;
      }

      const emptyRow = createEmptyTransaction();
      draftRowsRef.current.set(rowIndex, emptyRow);
      return emptyRow;
    },
    [createEmptyTransaction]
  );

  const normalizeStatus = useCallback((value: string | null | undefined) => {
    return (value ?? '').trim().toLowerCase();
  }, []);

  const isPaidStatus = useCallback(
    (value: string | null | undefined) => {
      const normalized = normalizeStatus(value);
      return PAID_STATUSES.some(
        (status) => normalizeStatus(status) === normalized
      );
    },
    [normalizeStatus]
  );

  const computeRemainingBalance = useCallback((row: TransactionData) => {
    const lineTotal = Number(row['Line Total']);
    if (Number.isFinite(lineTotal)) {
      return lineTotal;
    }

    const quantity = Number(row.Quantity) || 0;
    const unitPrice = Number(row['Unit Price']) || 0;
    const discount = Number(row.Discount) || 0;
    const adjustment = Number(row.Adjustment) || 0;

    return quantity * unitPrice - discount - adjustment;
  }, []);

  const hasMinimumCreateFields = useCallback((draft: TransactionData) => {
    const orderDate = (draft['Order Date'] ?? '').trim();
    const hasOrderDate = orderDate !== '';
    const hasCustomer = (draft.Customers ?? '').trim() !== '';
    const hasProduct = (draft['Product Code'] ?? '').trim() !== '';
    return hasOrderDate && (hasCustomer || hasProduct);
  }, []);

  const createDraftTransaction = useCallback(
    async (
      rowIndex: number,
      draft: TransactionData,
      placeholderRow?: TransactionData
    ) => {
      if (creatingDraftRowsRef.current.has(rowIndex)) {
        return false;
      }

      if (!hasMinimumCreateFields(draft)) {
        return false;
      }

      creatingDraftRowsRef.current.add(rowIndex);
      try {
        const payload = {
          'Order Date': draft['Order Date'] || '',
          Customers: draft.Customers || '',
          'Product Code': draft['Product Code'] || '',
          Quantity: draft.Quantity ?? 0,
          'Unit Price': draft['Unit Price'] ?? 0,
          Discount: draft.Discount ?? 0,
          Adjustment: draft.Adjustment ?? 0,
          'Line Total': draft['Line Total'] ?? 0,
          'Order Status': draft['Order Status'] ?? '',
          Notes: draft.Notes || '',
          'Invoice Date': draft['Invoice Date'] || '',
          'Packed Date': draft['Packed Date'] || '',
          'Shipment Code': draft['Shipment Code'] || '',
        };

        await api.post('/api/transactions', [payload]);

        // Optimistically add the newly created transaction to the cache so the
        // grid shows values immediately (no blank flash) while we wait for the
        // real record with its server ID.
        const optimisticId = Number(Date.now() * -1);
        const optimisticTransaction: TransactionData = {
          id: optimisticId,
          ...payload,
        } as TransactionData;

        queryClient.setQueryData<TransactionData[] | undefined>(
          ['transactions'],
          (existing) =>
            existing
              ? [...existing, optimisticTransaction]
              : [optimisticTransaction]
        );

        // Clear the placeholder row we just used so it does not linger as a duplicate
        // display row until the query refresh completes (both the draft object and the
        // actual placeholder row reference shown in the grid).
        Object.assign(draft, createEmptyTransaction());
        if (placeholderRow) {
          Object.assign(placeholderRow, createEmptyTransaction());
        }
        draftRowsRef.current.delete(rowIndex);

        // Refresh shared cache so the new row arrives with a real ID
        await queryClient.invalidateQueries({ queryKey: ['transactions'] });

        showNotification({
          title: 'Success',
          message: 'New transaction created',
          color: 'green',
        });
        return true;
      } catch (error) {
        logger.error('Failed to create transaction from draft row:', error);

        let friendlyMessage = 'Could not save the new transaction';

        if (error instanceof ApiError && error.status === 409) {
          // Parse the conflict payload to surface missing references (customers/products/shipments)
          const apiPayload =
            typeof error.data === 'object' && error.data
              ? (error.data as Record<string, unknown>)
              : undefined;

          const rawDetails = apiPayload?.details;
          const rawPayloadString = apiPayload
            ? (() => {
                try {
                  return JSON.stringify(apiPayload);
                } catch (stringifyError) {
                  logger.warn(
                    'Failed to stringify API payload',
                    stringifyError
                  );
                  return undefined;
                }
              })()
            : undefined;
          const parsedDetails = (() => {
            if (!rawDetails) {
              return undefined;
            }
            if (typeof rawDetails === 'object') {
              return rawDetails as Record<string, unknown>;
            }
            if (typeof rawDetails === 'string') {
              try {
                return JSON.parse(rawDetails) as Record<string, unknown>;
              } catch (parseError) {
                logger.warn(
                  'Failed to parse conflict details payload',
                  parseError
                );
                return undefined;
              }
            }
            return undefined;
          })();

          const missing =
            parsedDetails && 'missing' in parsedDetails
              ? (parsedDetails.missing as {
                  customers?: string[];
                  products?: string[];
                  shipments?: string[];
                })
              : undefined;

          const missingPieces: string[] = [];
          if (missing?.customers?.length) {
            missingPieces.push(`customers: ${missing.customers.join(', ')}`);
          }
          if (missing?.products?.length) {
            missingPieces.push(`products: ${missing.products.join(', ')}`);
          }
          if (missing?.shipments?.length) {
            missingPieces.push(`shipments: ${missing.shipments.join(', ')}`);
          }

          const serverMessage =
            typeof apiPayload?.error === 'string'
              ? apiPayload.error
              : 'Reference conflict – please verify customer/product/shipment exists.';

          if (missingPieces.length > 0) {
            friendlyMessage = `Missing references – ${missingPieces.join('; ')}`;
          } else if (parsedDetails) {
            friendlyMessage = serverMessage;
          } else if (serverMessage) {
            friendlyMessage = serverMessage;
          } else if (rawPayloadString) {
            friendlyMessage = `Conflict – ${rawPayloadString}`;
          } else {
            friendlyMessage =
              'Reference conflict – please verify customer/product/shipment exists.';
          }
        } else if (error instanceof Error) {
          friendlyMessage = error.message;
        }

        showNotification({
          title: '❌ Save Failed',
          message: friendlyMessage,
          color: 'red',
        });
        return false;
      } finally {
        creatingDraftRowsRef.current.delete(rowIndex);
      }
    },
    [hasMinimumCreateFields, queryClient, createEmptyTransaction]
  );

  const logNotification = useCallback(
    (message: string, metadata?: Record<string, unknown>) => {
      OperationsNotificationsService.log({
        category: 'transactions',
        changes: message,
        metadata,
      })
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.operationsNotifications.all,
          });
        })
        .catch((error) => {
          logger.error('Failed to log transaction notification:', error);
        });
    },
    [queryClient]
  );

  const describeTransaction = useCallback((transaction: TransactionData) => {
    const idLabel = transaction.id ? `#${transaction.id}` : 'unsaved row';
    const customer =
      transaction.Customers && transaction.Customers.trim() !== ''
        ? transaction.Customers.trim()
        : 'No customer';
    const product =
      transaction['Product Code'] && transaction['Product Code'].trim() !== ''
        ? transaction['Product Code'].trim()
        : 'No product';
    return `${idLabel} • Customer: ${customer} • Product: ${product}`;
  }, []);

  const truncate = useCallback((value: string, max = 160) => {
    if (value.length <= max) {
      return value;
    }
    return `${value.slice(0, max - 1)}…`;
  }, []);

  const formatNumberValue = useCallback((value: number) => {
    return TransactionService.formatNumber(value ?? 0);
  }, []);

  const formatCurrencyValue = useCallback((value: number) => {
    return TransactionService.formatCurrency(value ?? 0);
  }, []);

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
        showNotification({
          title: 'Success',
          message: `Saved ${batchedUpdates.length} transactions from paste`,
          color: 'green',
        });

        logNotification(
          `Batched edit applied to ${batchedUpdates.length} transactions (${customEvent.detail?.count ?? 0} cells).`,
          {
            type: 'batch-update',
            transactionIds: batchedUpdates
              .map((update) => update.id)
              .filter((id): id is number => Number.isFinite(id)),
            cellsEdited: customEvent.detail?.count ?? null,
          }
        );
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
  }, [transactions, bulkUpdate, logNotification]);

  // ============================================================================
  // CELL EDITING HANDLER
  // ============================================================================

  const handleCellEdited = useCallback(
    async (edit: CellEditEvent<TransactionData>) => {
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
            merged['Order Date'] = formatToday();
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

      // Extract cell value
      const getCellValue = (_unused?: unknown): string => {
        if (
          rawValue === null ||
          rawValue === undefined ||
          (typeof rawValue === 'string' &&
            rawValue.trim().toLowerCase() === 'null')
        ) {
          return '';
        }
        return String(rawValue);
      };

      const getNumericValue = (_unused?: unknown): number => {
        const strVal = getCellValue();
        const sanitizedNumeric = strVal.replace(/,/g, '').trim();
        if (sanitizedNumeric === '') {
          return 0;
        }
        const parsed = Number(sanitizedNumeric);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      // ========================================================================
      // ORDER DATE HANDLER
      // ========================================================================
      if (columnId === 'orderDate') {
        const newDate = getCellValue(newValue);
        updateTransactionData({ 'Order Date': newDate });

        notify({
          title: 'Success',
          message: 'Order Date updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousOrderDate =
            transaction['Order Date'] && transaction['Order Date'].trim() !== ''
              ? transaction['Order Date'].trim()
              : 'blank';
          const nextOrderDate =
            newDate && newDate.trim() !== '' ? newDate.trim() : 'blank';

          logNotification(
            `Order Date updated from ${previousOrderDate} to ${nextOrderDate} for ${transactionDescriptor}.`,
            {
              column: 'Order Date',
              transactionId: transaction.id,
              previousValue: transaction['Order Date'] ?? '',
              newValue: newDate,
            }
          );
        }
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
          const now = new Date();
          autoPopulatedOrderDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Manila',
          });
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

              // 🔴 SOLD OUT - Block increasing quantity
              if (stockInfo.status === 'SOLD_OUT') {
                await Swal.fire({
                  icon: 'error',
                  title: '🔴 Insufficient Quantity!',
                  text: stockInfo.message,
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#fa5252',
                  allowOutsideClick: false,
                });
                logger.warn(
                  `Stock check failed for ${currentProductCode} (adding ${quantityChange} units):`,
                  stockInfo
                );
                return; // Prevent saving the transaction
              }

              // 🔴 INSUFFICIENT STOCK - Offer to cap to max fulfillable quantity
              if (stockInfo.status === 'INSUFFICIENT_STOCK') {
                const remainingAvailable = Number(
                  stockInfo.availableStock || 0
                );
                if (remainingAvailable > 0) {
                  const maxQuantity = oldQuantity + remainingAvailable;
                  const result = await Swal.fire({
                    icon: 'warning',
                    title: '🔴 Insufficient Quantity!',
                    text: `${stockInfo.message}\n\nUse max available quantity (${maxQuantity}) to sell out?`,
                    showCancelButton: true,
                    confirmButtonText: `Use ${maxQuantity}`,
                    cancelButtonText: 'Cancel',
                    confirmButtonColor: '#fab005',
                    cancelButtonColor: '#adb5bd',
                    allowOutsideClick: false,
                  });

                  if (result.isConfirmed) {
                    // Proceed with maxQuantity; downstream recalculation will run.
                    return updateTransactionData({ Quantity: maxQuantity });
                  }

                  return;
                }

                await Swal.fire({
                  icon: 'error',
                  title: '🔴 Insufficient Quantity!',
                  text: stockInfo.message,
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#fa5252',
                  allowOutsideClick: false,
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
                  confirmButtonText: 'OK',
                  confirmButtonColor: '#fab005',
                  allowOutsideClick: false,
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

        notify({ title: 'Success', message, color: 'green' });

        if (shouldLog) {
          const previousQuantity = transaction.Quantity ?? 0;
          let logMessage = `Quantity updated from ${formatNumberValue(previousQuantity)} to ${formatNumberValue(newQuantity)} for ${transactionDescriptor}.`;

          if (unitPriceAutoPopulated) {
            logMessage += ` Unit Price auto-set to ${formatCurrencyValue(autoPopulatedUnitPrice)}.`;
          } else if (unitPriceCleared) {
            logMessage += ' Unit Price cleared.';
          }

          logMessage += ` Line Total recalculated to ${formatCurrencyValue(lineTotal)}.`;

          logNotification(logMessage, {
            column: 'Quantity',
            transactionId: transaction.id,
            previousValue: previousQuantity,
            newValue: newQuantity,
            unitPrice: autoPopulatedUnitPrice,
            lineTotal,
            adjustment,
          });
        }
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

        notify({
          title: 'Success',
          message: 'Unit Price updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousUnitPrice = transaction['Unit Price'] ?? 0;

          logNotification(
            `Unit Price updated from ${formatCurrencyValue(previousUnitPrice)} to ${formatCurrencyValue(newUnitPrice)} for ${transactionDescriptor}. Line Total recalculated to ${formatCurrencyValue(lineTotal)}.`,
            {
              column: 'Unit Price',
              transactionId: transaction.id,
              previousValue: previousUnitPrice,
              newValue: newUnitPrice,
              quantity,
              lineTotal,
            }
          );
        }
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

        notify({
          title: 'Success',
          message: 'Discount updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousDiscount = transaction.Discount ?? 0;
          const previousUnitPrice = transaction['Unit Price'] ?? 0;
          const previousLineTotal = transaction['Line Total'] ?? 0;

          let logMessage = `Discount updated from ${formatNumberValue(previousDiscount)} to ${formatNumberValue(newDiscount)} for ${transactionDescriptor}.`;
          logMessage += ` Unit Price recalculated from ${formatCurrencyValue(previousUnitPrice)} to ${formatCurrencyValue(recalculatedUnitPrice)}.`;
          logMessage += ` Line Total updated from ${formatCurrencyValue(previousLineTotal)} to ${formatCurrencyValue(lineTotal)}.`;

          logNotification(logMessage, {
            column: 'Discount',
            transactionId: transaction.id,
            previousValue: previousDiscount,
            newValue: newDiscount,
            unitPrice: recalculatedUnitPrice,
            lineTotal,
            quantity: currentQuantity,
          });
        }
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

        notify({
          title: 'Success',
          message: 'Adjustment updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousAdjustment = transaction.Adjustment ?? 0;
          const previousLineTotal = transaction['Line Total'] ?? 0;

          logNotification(
            `Adjustment updated from ${formatCurrencyValue(previousAdjustment)} to ${formatCurrencyValue(newAdjustment)} for ${transactionDescriptor}. Line Total updated from ${formatCurrencyValue(previousLineTotal)} to ${formatCurrencyValue(lineTotal)}.`,
            {
              column: 'Adjustment',
              transactionId: transaction.id,
              previousValue: previousAdjustment,
              newValue: newAdjustment,
              lineTotal,
              quantity,
              unitPrice,
            }
          );
        }
      }

      // ========================================================================
      // LINE TOTAL HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC
      // ========================================================================
      if (columnId === 'lineTotal') {
        const newLineTotal = getNumericValue(newValue);

        const currentTransaction = getCurrentTransaction();
        const quantity = currentTransaction.Quantity || 0;
        const unitPrice = currentTransaction['Unit Price'] || 0;
        const recalculatedAdjustment = quantity * unitPrice - newLineTotal;

        const updatedFields = {
          'Line Total': newLineTotal,
          Adjustment: recalculatedAdjustment,
        };

        updateTransactionData(updatedFields);

        notify({
          title: 'Success',
          message: 'Line Total updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousLineTotal = transaction['Line Total'] ?? 0;

          logNotification(
            `Line Total updated from ${formatCurrencyValue(previousLineTotal)} to ${formatCurrencyValue(newLineTotal)} for ${transactionDescriptor}. Adjustment recalculated to ${formatCurrencyValue(recalculatedAdjustment)}.`,
            {
              column: 'Line Total',
              transactionId: transaction.id,
              previousValue: previousLineTotal,
              newValue: newLineTotal,
              adjustment: recalculatedAdjustment,
              quantity,
              unitPrice,
            }
          );
        }
      }

      // ========================================================================
      // ORDER STATUS HANDLER
      // ========================================================================
      if (columnId === 'orderStatus') {
        const dropdownValue = getCellValue(newValue);

        const remaining = computeRemainingBalance(transaction);
        if (isPaidStatus(dropdownValue) && remaining > 0.01) {
          await Swal.fire({
            title: 'Payment not complete',
            html: `Remaining balance: <strong>₱${remaining.toLocaleString()}</strong>.<br />Record full payment first, or use <strong>Pending Payment</strong> for shipped-but-unpaid orders.`,
            icon: 'warning',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'OK',
          });
          return false;
        }

        updateTransactionData({ 'Order Status': dropdownValue });

        notify({
          title: 'Success',
          message: 'Order Status updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousStatus = transaction['Order Status'] ?? 'Unspecified';
          const nextStatus = dropdownValue || 'Unspecified';

          logNotification(
            `Order Status changed from ${previousStatus} to ${nextStatus} for ${transactionDescriptor}.`,
            {
              column: 'Order Status',
              transactionId: transaction.id,
              previousValue: transaction['Order Status'] ?? '',
              newValue: dropdownValue,
            }
          );
        }
      }

      // ========================================================================
      // NOTES HANDLER
      // ========================================================================
      if (columnId === 'notes') {
        const notesValue = getCellValue(newValue);

        updateTransactionData({ Notes: notesValue });

        notify({
          title: 'Success',
          message: 'Notes updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          const previousNotes = transaction.Notes ?? '';
          const nextNotes = notesValue ?? '';

          logNotification(
            `Notes updated for ${transactionDescriptor}. Previous: "${truncate(previousNotes)}" • New: "${truncate(nextNotes)}"`,
            {
              column: 'Notes',
              transactionId: transaction.id,
              previousValue: previousNotes,
              newValue: nextNotes,
            }
          );
        }
      }

      // ========================================================================
      // INVOICE DATE HANDLER
      // ========================================================================
      if (columnId === 'invoiceDate') {
        const invoiceDateValue = getCellValue(newValue).trim();

        updateTransactionData({ 'Invoice Date': invoiceDateValue });

        notify({
          title: 'Success',
          message: 'Invoice Date updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          logNotification(
            `Invoice Date updated for ${transactionDescriptor}.`,
            {
              column: 'Invoice Date',
              transactionId: transaction.id,
              previousValue: transaction['Invoice Date'] ?? '',
              newValue: invoiceDateValue,
            }
          );
        }
      }

      // ========================================================================
      // PACKED DATE HANDLER
      // ========================================================================
      if (columnId === 'packedDate') {
        const packedDateValue = getCellValue(newValue).trim();

        updateTransactionData({ 'Packed Date': packedDateValue });

        notify({
          title: 'Success',
          message: 'Packed Date updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          logNotification(`Packed Date updated for ${transactionDescriptor}.`, {
            column: 'Packed Date',
            transactionId: transaction.id,
            previousValue: transaction['Packed Date'] ?? '',
            newValue: packedDateValue,
          });
        }
      }

      // ========================================================================
      // SHIPMENT CODE HANDLER
      // ========================================================================
      if (columnId === 'shipmentCode') {
        const shipmentCodeValue = getCellValue(newValue).trim();

        updateTransactionData({ 'Shipment Code': shipmentCodeValue });

        notify({
          title: 'Success',
          message: 'Shipment Code updated successfully',
          color: 'green',
        });

        if (shouldLog) {
          logNotification(
            `Shipment Code updated for ${transactionDescriptor}.`,
            {
              column: 'Shipment Code',
              transactionId: transaction.id,
              previousValue: transaction['Shipment Code'] ?? '',
              newValue: shipmentCodeValue,
            }
          );
        }
      }
    },
    [
      filteredData,
      priceTiers,
      productToShipmentMap,
      productToShipmentStatusMap,
      update,
      onCustomerWarning,
      describeTransaction,
      logNotification,
      formatCurrencyValue,
      formatNumberValue,
      truncate,
      ensureDraftRow,
      createDraftTransaction,
      hasMinimumCreateFields,
      formatToday,
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
      try {
        const text = await file.text();
        const importedTransactions =
          TransactionService.transformCSVToTransactions(text);

        if (importedTransactions.length === 0) {
          showNotification({
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

        showNotification({
          title: '✅ Import Successful',
          message: `${result.count} transactions imported with auto-calculated Unit Price and Line Total`,
          color: 'green',
          autoClose: 5000,
        });

        logNotification(
          `${result.count} transactions imported from ${file.name}.`,
          {
            type: 'csv-import',
            rowsImported: result.count,
            fileName: file.name,
          }
        );
      } catch (error) {
        logger.error('Import error:', error);
        showNotification({
          title: '❌ Import Failed',
          message: 'Failed to parse CSV file. Please check the file format.',
          color: 'red',
          autoClose: 4000,
        });
      }
    },
    [bulkUpdate, logNotification]
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
