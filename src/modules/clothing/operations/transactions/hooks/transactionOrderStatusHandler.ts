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
  }) => void | Promise<void>;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
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
      html: `Remaining balance: <strong>₱${remaining.toLocaleString()}</strong>.<br />Record full payment first, or use <strong>Pending Payment</strong> for shipped-but-unpaid orders.`,
      icon: 'warning',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'OK',
    });
    return true;
  }

  const recordedPayment = Number(transaction.Adjustment) || 0;
  if (isVoidedOrderStatus(dropdownValue) && recordedPayment > 0.01) {
    const marker = '/operations/transactions';
    const pathname = window.location.pathname;
    const basePath = pathname.includes(marker)
      ? pathname.slice(0, pathname.indexOf(marker))
      : '';
    const customersPath = basePath
      ? `${basePath}/operations/customers`
      : '/clothing/operations/customers';

    const result = await fireAlert({
      title: 'Refund reminder',
      html:
        `This transaction has <strong>${formatCurrencyValue(recordedPayment)}</strong> recorded as a payment/deposit.<br /><br />` +
        `If you mark it as <strong>Voided</strong>, remember to record any required refunds from the <strong>Customers</strong> page.`,
      icon: 'warning',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: 'Mark as Voided',
      denyButtonText: 'Open Customers',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });

    if (result.isDenied) {
      window.open(customersPath, '_blank', 'noopener,noreferrer');
      return true;
    }

    if (!result.isConfirmed) {
      return true;
    }
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

  return true;
}
