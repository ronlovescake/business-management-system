import type { NotificationData } from '@mantine/notifications';
import { TransactionService } from '../services/TransactionService';
import type { PriceTier, TransactionData } from '../types/transaction.types';
import { getNumericValue } from './transactionCellValueUtils';

interface HandleComputedTransactionColumnEditParams {
  columnId: string | undefined;
  rawValue: unknown;
  transaction: TransactionData;
  transactionDescriptor: string;
  shouldLog: boolean;
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
}

export function handleComputedTransactionColumnEdit({
  columnId,
  rawValue,
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
}: HandleComputedTransactionColumnEditParams): boolean {
  if (columnId === 'unitPrice') {
    const newUnitPrice = getNumericValue(rawValue);
    const currentTransaction = getCurrentTransaction();
    const quantity = currentTransaction.Quantity || 0;
    const adjustment = currentTransaction.Adjustment || 0;
    const lineTotal = TransactionService.calculateLineTotal(
      quantity,
      newUnitPrice,
      adjustment
    );

    updateTransactionData({
      'Unit Price': newUnitPrice,
      'Line Total': lineTotal,
    });

    notify({
      title: 'Success',
      message: 'Unit Price updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      const previousUnitPrice = transaction['Unit Price'] ?? 0;

      if (previousUnitPrice !== newUnitPrice) {
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

    return true;
  }

  if (columnId === 'discount') {
    const newDiscount = getNumericValue(rawValue);
    const currentTransaction = getCurrentTransaction();

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

    const quantity = currentTransaction.Quantity || 0;
    const adjustment = currentTransaction.Adjustment || 0;
    const lineTotal = TransactionService.calculateLineTotal(
      quantity,
      recalculatedUnitPrice,
      adjustment
    );

    updateTransactionData({
      'Unit Price': recalculatedUnitPrice,
      Discount: newDiscount,
      'Line Total': lineTotal,
    });

    notify({
      title: 'Success',
      message: 'Discount updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      const previousDiscount = transaction.Discount ?? 0;
      const previousUnitPrice = transaction['Unit Price'] ?? 0;
      const previousLineTotal = transaction['Line Total'] ?? 0;

      if (previousDiscount !== newDiscount) {
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

    return true;
  }

  if (columnId === 'adjustment') {
    const newAdjustment = getNumericValue(rawValue);
    const currentTransaction = getCurrentTransaction();

    const quantity = currentTransaction.Quantity || 0;
    const unitPrice = currentTransaction['Unit Price'] || 0;
    const lineTotal = TransactionService.calculateLineTotal(
      quantity,
      unitPrice,
      newAdjustment
    );

    updateTransactionData({
      Adjustment: newAdjustment,
      'Line Total': lineTotal,
    });

    notify({
      title: 'Success',
      message: 'Adjustment updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      const previousAdjustment = transaction.Adjustment ?? 0;
      const previousLineTotal = transaction['Line Total'] ?? 0;

      if (previousAdjustment !== newAdjustment) {
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

    return true;
  }

  if (columnId === 'lineTotal') {
    const newLineTotal = getNumericValue(rawValue);
    const currentTransaction = getCurrentTransaction();
    const quantity = currentTransaction.Quantity || 0;
    const unitPrice = currentTransaction['Unit Price'] || 0;
    const recalculatedAdjustment = quantity * unitPrice - newLineTotal;

    updateTransactionData({
      'Line Total': newLineTotal,
      Adjustment: recalculatedAdjustment,
    });

    notify({
      title: 'Success',
      message: 'Line Total updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      const previousLineTotal = transaction['Line Total'] ?? 0;

      if (previousLineTotal !== newLineTotal) {
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

    return true;
  }

  return false;
}
