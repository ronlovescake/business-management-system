import type { NotificationData } from '@mantine/notifications';
import type { SweetAlertResult } from 'sweetalert2';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { TransactionService } from '../services/TransactionService';
import type { PriceTier, TransactionData } from '../types/transaction.types';
import { getNumericValue } from './transactionCellValueUtils';

interface HandleQuantityColumnEditParams {
  columnId: string | undefined;
  rawValue: unknown;
  transaction: TransactionData;
  transactionDescriptor: string;
  shouldLog: boolean;
  apiBasePath?: string;
  isBatchMode: boolean;
  priceTiers: PriceTier[];
  getCurrentTransaction: () => TransactionData;
  updateTransactionData: (
    data: Partial<TransactionData>
  ) => void | Promise<void>;
  notify: (options: NotificationData) => void;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
  formatCurrencyValue: (value: number) => string;
  formatNumberValue: (value: number) => string;
  fireAlert: (options: Record<string, unknown>) => Promise<SweetAlertResult>;
}

export async function handleQuantityColumnEdit({
  columnId,
  rawValue,
  transaction,
  transactionDescriptor,
  shouldLog,
  apiBasePath,
  isBatchMode,
  priceTiers,
  getCurrentTransaction,
  updateTransactionData,
  notify,
  logNotification,
  formatCurrencyValue,
  formatNumberValue,
  fireAlert,
}: HandleQuantityColumnEditParams): Promise<boolean> {
  if (columnId !== 'quantity') {
    return false;
  }

  const newQuantity = getNumericValue(rawValue);
  const currentTransaction = getCurrentTransaction();

  const currentProductCode = currentTransaction['Product Code'] || '';
  const oldQuantity = transaction.Quantity || 0;
  const quantityChange = newQuantity - oldQuantity;

  if (
    quantityChange > 0 &&
    currentProductCode &&
    currentProductCode.trim() !== '' &&
    !isBatchMode
  ) {
    try {
      const stockResponse = await fetch(
        buildApiPath(apiBasePath, '/inventory/check-stock'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productCode: currentProductCode.trim(),
            requestedQuantity: quantityChange,
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

        if (stockInfo.status === 'SOLD_OUT') {
          await fireAlert({
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
          return true;
        }

        if (stockInfo.status === 'INSUFFICIENT_STOCK') {
          const remainingAvailable = Number(stockInfo.availableStock || 0);
          if (remainingAvailable > 0) {
            const maxQuantity = oldQuantity + remainingAvailable;
            const result = await fireAlert({
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
              await updateTransactionData({ Quantity: maxQuantity });
            }

            return true;
          }

          await fireAlert({
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
          return true;
        }

        if (stockInfo.status === 'LOW_STOCK') {
          await fireAlert({
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
        }
      }
    } catch (error) {
      logger.error('Stock check failed:', error);
    }
  } else if (quantityChange < 0) {
    logger.info(
      `Reducing quantity for ${currentProductCode}: ${oldQuantity} → ${newQuantity} (freeing ${Math.abs(quantityChange)} units)`
    );
  }

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

  const adjustment = currentTransaction.Adjustment || 0;
  const lineTotal = TransactionService.calculateLineTotal(
    newQuantity,
    autoPopulatedUnitPrice,
    adjustment
  );

  updateTransactionData({
    Quantity: newQuantity,
    'Unit Price': autoPopulatedUnitPrice,
    'Line Total': lineTotal,
  });

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

  return true;
}
