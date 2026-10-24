import {
  isClothingAccountsReceivableStatus,
  isVoidedOrderStatus,
} from '@/lib/transactions/order-status';
import { parseDate } from './date-utils';
import { getPaymentAccountForMethod } from './payment-accounts';
import { normalizeTransactionAmountsForAccounting } from './transaction-normalization';

export type AccountsReceivableTransactionSource = {
  id?: number;
  orderStatus?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  adjustment?: number | null;
  lineTotal?: number | null;
  customers?: string | null;
  productCode?: string | null;
  shippedAt?: Date | string | null;
  packedDate?: Date | string | null;
  orderDate?: Date | string | null;
  statusChanges?: Array<{
    newStatus: string | null;
    changedAt: Date | string;
  }>;
};

export type AccountsReceivableJournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

export function getReservationDepositRecognitionCreditAccount(params: {
  orderStatus?: string | null;
  isForfeited: boolean;
}): 'Forfeited Deposits' | 'Sales Revenue' | null {
  if (isVoidedOrderStatus(params.orderStatus)) {
    return null;
  }

  return params.isForfeited ? 'Forfeited Deposits' : 'Sales Revenue';
}

export function getTransactionRefundDebitAccount(params: {
  orderStatus?: string | null;
  isReservationRefund: boolean;
}): 'Customer Deposits' | 'Sales Returns' {
  return isVoidedOrderStatus(params.orderStatus) && params.isReservationRefund
    ? 'Customer Deposits'
    : 'Sales Returns';
}

export function calculateAccountsReceivableBalances(
  grossSale: number,
  paymentsCollected: number
): { receivable: number; recognizedSale: number } {
  const saleAmount = Number.isFinite(grossSale) ? Math.max(grossSale, 0) : 0;
  const collected = Number.isFinite(paymentsCollected)
    ? Math.max(paymentsCollected, 0)
    : 0;

  return {
    receivable: Math.max(saleAmount - collected, 0),
    recognizedSale: saleAmount,
  };
}

export function hasAccountsReceivableShipment(
  transaction: AccountsReceivableTransactionSource
): boolean {
  return (
    isClothingAccountsReceivableStatus(transaction.orderStatus) ||
    Boolean(parseDate(transaction.shippedAt)) ||
    Boolean(
      transaction.statusChanges?.some((change) =>
        isClothingAccountsReceivableStatus(change.newStatus)
      )
    )
  );
}

export function getAccountsReceivableRecognitionDate(
  transaction: AccountsReceivableTransactionSource
): Date | null {
  const shippedAt = parseDate(transaction.shippedAt);
  if (shippedAt) {
    return shippedAt;
  }

  const statusChangeAt = transaction.statusChanges
    ?.filter((change) => isClothingAccountsReceivableStatus(change.newStatus))
    .map((change) => parseDate(change.changedAt))
    .find((date): date is Date => date !== null);
  if (statusChangeAt) {
    return statusChangeAt;
  }

  if (!isClothingAccountsReceivableStatus(transaction.orderStatus)) {
    return null;
  }

  return (
    parseDate(transaction.packedDate) ??
    parseDate(transaction.orderDate) ??
    null
  );
}

export function buildAccountsReceivableShipmentEntries(
  transaction: AccountsReceivableTransactionSource
): AccountsReceivableJournalEntry[] {
  if (transaction.id === undefined) {
    return [];
  }

  const date = getAccountsReceivableRecognitionDate(transaction);
  const amount =
    normalizeTransactionAmountsForAccounting(transaction).grossSale;
  if (!date || !Number.isFinite(amount) || amount <= 0) {
    return [];
  }

  const id = `TX-${transaction.id}-ar`;
  const ref = transaction.productCode?.trim() || `TX-${transaction.id}`;
  const description = transaction.customers?.trim() || 'Unknown customer';

  return [
    {
      id: `${id}-receivable`,
      date: date.toISOString(),
      ref,
      account: 'Accounts Receivable',
      debit: amount,
      credit: 0,
      description,
    },
    {
      id: `${id}-sales`,
      date: date.toISOString(),
      ref,
      account: 'Sales Revenue',
      debit: 0,
      credit: amount,
      description,
    },
  ];
}

export function getTransactionPaymentCreditAccount(payment: {
  isReservation?: boolean | null;
  transaction?: AccountsReceivableTransactionSource | null;
}): string {
  if (payment.isReservation) {
    return 'Customer Deposits';
  }

  return hasAccountsReceivableShipment(payment.transaction ?? {})
    ? 'Accounts Receivable'
    : 'Sales Revenue';
}

export function getTransactionPaymentDebitAccount(payment: {
  method?: string | null;
  transaction?: AccountsReceivableTransactionSource | null;
}): string {
  if (!hasAccountsReceivableShipment(payment.transaction ?? {})) {
    return 'Cash';
  }

  return getPaymentAccountForMethod(payment.method) ?? 'Cash';
}
