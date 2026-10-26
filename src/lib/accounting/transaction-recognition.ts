import { Prisma } from '@prisma/client';
import {
  isClothingAccountsReceivableStatus,
  isVoidedOrderStatus,
} from '@/lib/transactions/order-status';
import { parseDate } from './date-utils';
import { getIncomingCollectionAccount } from './payment-accounts';
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

export function getFinancialSourceTransaction<
  Transaction extends {
    orderStatus: string | null;
    cancellation?: { previousStatus: string | null } | null;
  },
>(transaction: Transaction): Transaction {
  return transaction.cancellation
    ? { ...transaction, orderStatus: transaction.cancellation.previousStatus }
    : transaction;
}

export function getReservationDepositRecognitionCreditAccount(params: {
  orderStatus?: string | null;
  isForfeited: boolean;
  transaction?: AccountsReceivableTransactionSource | null;
}): 'Forfeited Deposits' | 'Sales Revenue' | 'Accounts Receivable' | null {
  if (isVoidedOrderStatus(params.orderStatus)) {
    return null;
  }

  return params.isForfeited
    ? 'Forfeited Deposits'
    : hasAccountsReceivableShipment(params.transaction ?? {})
      ? 'Accounts Receivable'
      : 'Sales Revenue';
}

export function getTransactionRefundDebitAccount(params: {
  orderStatus?: string | null;
  isReservationRefund: boolean;
  isApprovedCancellationPayout?: boolean;
}): 'Customer Deposits' | 'Sales Returns' | 'Refunds Payable' {
  if (params.isApprovedCancellationPayout) {
    return 'Refunds Payable';
  }
  return isVoidedOrderStatus(params.orderStatus) && params.isReservationRefund
    ? 'Customer Deposits'
    : 'Sales Returns';
}

export function getTransactionRefundDescription(params: {
  orderStatus?: string | null;
  isReservationRefund: boolean;
  isApprovedCancellationPayout?: boolean;
  transactionId: number;
  customerName?: string | null;
  reason?: string | null;
  notes?: string | null;
}): string {
  const account = getTransactionRefundDebitAccount(params);
  const transactionRef = `TX-${params.transactionId}`;
  const customer = params.customerName?.trim();
  const descriptionBase =
    account === 'Customer Deposits'
      ? `Voided reservation refund • ${customer || 'Unknown customer'} • ${transactionRef}`
      : customer || `Refund for ${transactionRef}`;
  const suffix = [params.reason?.trim(), params.notes?.trim()]
    .filter(Boolean)
    .join(' • ');

  return suffix ? `${descriptionBase} • ${suffix}` : descriptionBase;
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
  transaction: AccountsReceivableTransactionSource,
  payments: Array<{
    transactionId: number;
    paymentDate: string;
    amount: number;
    isReservation?: boolean | null;
  }> = []
): AccountsReceivableJournalEntry[] {
  if (transaction.id === undefined) {
    return [];
  }

  const date = getAccountsReceivableRecognitionDate(transaction);
  const gross = normalizeTransactionAmountsForAccounting(transaction).grossSale;
  if (!date || !Number.isFinite(gross) || gross <= 0) {
    return [];
  }
  const earlierRevenue = payments.reduce((total, payment) => {
    const paidAt = parseDate(payment.paymentDate);
    return payment.transactionId === transaction.id &&
      !payment.isReservation &&
      paidAt &&
      paidAt < date &&
      Number.isFinite(payment.amount) &&
      payment.amount > 0
      ? total.plus(payment.amount)
      : total;
  }, new Prisma.Decimal(0));
  const amount = Prisma.Decimal.max(
    new Prisma.Decimal(gross).minus(earlierRevenue),
    0
  ).toNumber();
  if (amount === 0) {
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
  paymentDate?: string | null;
  transaction?: AccountsReceivableTransactionSource | null;
}): string {
  if (payment.isReservation) {
    return 'Customer Deposits';
  }

  const recognitionAt = getAccountsReceivableRecognitionDate(
    payment.transaction ?? {}
  );
  const paidAt = parseDate(payment.paymentDate);
  return hasAccountsReceivableShipment(payment.transaction ?? {}) &&
    (!recognitionAt || !paidAt || paidAt >= recognitionAt)
    ? 'Accounts Receivable'
    : 'Sales Revenue';
}

export function getTransactionPaymentDebitAccount(payment: {
  method?: string | null;
  transaction?: AccountsReceivableTransactionSource | null;
}): string {
  const account = getIncomingCollectionAccount(payment.method);
  if (account === 'Card Collections Clearing') {
    return account;
  }
  if (!hasAccountsReceivableShipment(payment.transaction ?? {})) {
    return 'Cash';
  }

  return account;
}
