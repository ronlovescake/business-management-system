import type { SweetAlertResult } from 'sweetalert2';
import type { NotificationData } from '@mantine/notifications';
import type { TransactionData } from '../types/transaction.types';
import { computeRemainingBalance } from './transactionDraftUtils';
import { getCellValue } from './transactionCellValueUtils';

interface HandleOrderStatusColumnEditParams {
  columnId: string | undefined;
  rawValue: unknown;
  transaction: TransactionData;
  transactionDescriptor: string;
  shouldLog: boolean;
  isPaidOrderStatus: (value: string | null | undefined) => boolean;
  isVoidedOrderStatus: (value: string | null | undefined) => boolean;
  formatCurrencyValue: (value: number) => string;
  notify: (options: NotificationData) => void;
  updateTransactionData: (data: {
    'Order Status': string;
  }) => void | Promise<Pick<TransactionData, 'Order Status'> | void>;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
  onVoidedStatusSaved?: (customerName: string) => void | Promise<void>;
  fireAlert: (options: Record<string, unknown>) => Promise<SweetAlertResult>;
}

export async function handleOrderStatusColumnEdit({
  columnId,
  rawValue,
  transaction,
  transactionDescriptor,
  shouldLog,
  isPaidOrderStatus,
  isVoidedOrderStatus,
  formatCurrencyValue,
  notify,
  updateTransactionData,
  logNotification,
  onVoidedStatusSaved,
  fireAlert,
}: HandleOrderStatusColumnEditParams): Promise<boolean> {
  if (columnId !== 'orderStatus') {
    return false;
  }

  const dropdownValue = getCellValue(rawValue);

  const remaining = computeRemainingBalance(transaction);
  if (isPaidOrderStatus(dropdownValue) && remaining > 0.01) {
    await fireAlert({
      title: 'Payment not complete',
      html: `Remaining balance: <strong>₱${remaining.toLocaleString()}</strong>.<br />Record full payment first, or use <strong>Accounts Receivable</strong> for shipped-but-unpaid orders.`,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'OK',
    });
    return true;
  }

  const recordedPayment = Number(transaction.Adjustment) || 0;
  if (isVoidedOrderStatus(dropdownValue) && recordedPayment > 0.01) {
    const result = await fireAlert({
      title: 'Refund reminder',
      html:
        `This transaction has <strong>${formatCurrencyValue(recordedPayment)}</strong> recorded as a payment/deposit.<br /><br />` +
        `After saving it as <strong>Voided</strong>, the customer details popup will open so you can record any required refund.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Mark as Voided',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });

    if (!result.isConfirmed) {
      return true;
    }
  }

  let savedStatus = dropdownValue;
  let savedTransaction: Pick<TransactionData, 'Order Status'> | void;
  try {
    savedTransaction = await updateTransactionData({
      'Order Status': dropdownValue,
    });
    if (savedTransaction) {
      savedStatus = savedTransaction['Order Status'] ?? '';
    }
  } catch (error) {
    notify({
      title: 'Order Status not saved',
      message:
        error instanceof Error ? error.message : 'Unable to save Order Status',
      color: 'red',
    });
    return true;
  }

  notify({
    title: 'Success',
    message: 'Order Status updated successfully',
    color: 'green',
  });

  if (shouldLog) {
    const previousStatus = transaction['Order Status'] ?? 'Unspecified';
    const nextStatus = savedStatus || 'Unspecified';

    if (previousStatus !== nextStatus) {
      logNotification(
        `Order Status changed from ${previousStatus} to ${nextStatus} for ${transactionDescriptor}.`,
        {
          column: 'Order Status',
          transactionId: transaction.id,
          previousValue: transaction['Order Status'] ?? '',
          newValue: savedStatus,
        }
      );
    }
  }

  const customerName = transaction.Customers?.trim();
  if (
    savedTransaction &&
    isVoidedOrderStatus(savedStatus) &&
    recordedPayment > 0.01 &&
    customerName &&
    onVoidedStatusSaved
  ) {
    await onVoidedStatusSaved(customerName);
  }

  return true;
}
