import type { NotificationData } from '@mantine/notifications';
import type { TransactionData } from '../types/transaction.types';
import { getCellValue } from './transactionCellValueUtils';

interface HandleSimpleTransactionColumnEditParams {
  columnId: string | undefined;
  rawValue: unknown;
  transaction: TransactionData;
  transactionDescriptor: string;
  shouldLog: boolean;
  updateTransactionData: (
    data: Partial<TransactionData>
  ) => void | Promise<void>;
  notify: (options: NotificationData) => void;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
  truncateText: (value: string, max?: number) => string;
}

export function handleSimpleTransactionColumnEdit({
  columnId,
  rawValue,
  transaction,
  transactionDescriptor,
  shouldLog,
  updateTransactionData,
  notify,
  logNotification,
  truncateText,
}: HandleSimpleTransactionColumnEditParams): boolean {
  if (columnId === 'orderDate') {
    const newDate = getCellValue(rawValue);
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

    return true;
  }

  if (columnId === 'notes') {
    const notesValue = getCellValue(rawValue);

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
        `Notes updated for ${transactionDescriptor}. Previous: "${truncateText(previousNotes)}" • New: "${truncateText(nextNotes)}"`,
        {
          column: 'Notes',
          transactionId: transaction.id,
          previousValue: previousNotes,
          newValue: nextNotes,
        }
      );
    }

    return true;
  }

  if (columnId === 'invoiceDate') {
    const invoiceDateValue = getCellValue(rawValue).trim();

    updateTransactionData({ 'Invoice Date': invoiceDateValue });

    notify({
      title: 'Success',
      message: 'Invoice Date updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      logNotification(`Invoice Date updated for ${transactionDescriptor}.`, {
        column: 'Invoice Date',
        transactionId: transaction.id,
        previousValue: transaction['Invoice Date'] ?? '',
        newValue: invoiceDateValue,
      });
    }

    return true;
  }

  if (columnId === 'packedDate') {
    const packedDateValue = getCellValue(rawValue).trim();

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

    return true;
  }

  if (columnId === 'shipmentCode') {
    const shipmentCodeValue = getCellValue(rawValue).trim();

    updateTransactionData({ 'Shipment Code': shipmentCodeValue });

    notify({
      title: 'Success',
      message: 'Shipment Code updated successfully',
      color: 'green',
    });

    if (shouldLog) {
      logNotification(`Shipment Code updated for ${transactionDescriptor}.`, {
        column: 'Shipment Code',
        transactionId: transaction.id,
        previousValue: transaction['Shipment Code'] ?? '',
        newValue: shipmentCodeValue,
      });
    }

    return true;
  }

  return false;
}
