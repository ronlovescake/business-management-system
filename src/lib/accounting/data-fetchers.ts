/**
 * Shared data fetching utilities for accounting modules
 */

import { prisma } from '@/lib/db';
import {
  ACCOUNTS_RECEIVABLE_STATUSES,
  PAID_STATUSES,
} from '@/lib/accounting/constants';
import { parseDate } from '@/lib/accounting/date-utils';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import {
  fetchOptionalModelRows,
  fetchWithStatusChangesFallback,
  findChangedAtForStatuses,
  getCancelledAtDateFromStatusChanges,
} from '@/lib/accounting/fetcher-helpers';

type TransactionWithStatusChanges = Awaited<
  ReturnType<typeof prisma.transaction.findMany>
>[number] & {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
};

type TransactionRefundWithTransaction = {
  id: number;
  transactionId: number;
  refundDate: string;
  amount: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
  };
};

type TransactionPaymentWithTransaction = {
  id: number;
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation?: boolean | null;
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
    orderDate: string | Date | null;
    orderStatus: string | null;
  };
};

export type ManualJournalLine = {
  id: string;
  date: Date;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
  sourceType: string;
  sourceId: string | null;
  sourceLineKey: string;
  systemGenerated: boolean;
};

export async function fetchPaidTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const baseWhere = {
    deletedAt: null,
    orderStatus: { in: [...PAID_STATUSES] },
  };

  return await fetchWithStatusChangesFallback({
    fetchWithChanges: () =>
      prisma.transaction.findMany({
        where: baseWhere,
        include: {
          statusChanges: {
            where: { newStatus: { in: [...PAID_STATUSES] } },
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
    fetchWithoutChanges: () =>
      prisma.transaction.findMany({ where: baseWhere }),
    logMessage: 'Falling back to transactions without statusChanges',
  });
}

export async function fetchRecognizedTransactions(): Promise<
  TransactionWithStatusChanges[]
> {
  const recognizedStatuses = [
    ...PAID_STATUSES,
    ...ACCOUNTS_RECEIVABLE_STATUSES,
  ] as const;

  const baseWhere = {
    deletedAt: null,
    NOT: {
      orderStatus: { equals: 'Cancelled' },
    },
    OR: [
      { orderStatus: { in: [...recognizedStatuses] } },
      // Cash-basis support: include any transaction that has recorded payment
      // so Balance Sheet cash reflects actual receipts even if ops status is
      // not tagged as Pending Payment / Paid yet.
      { adjustment: { gt: 0 } },
      // Prefer real payment events over legacy adjustment fields.
      // This keeps balance sheet cash aligned with transaction_payments.
      { payments: { some: { deletedAt: null, amount: { gt: 0 } } } },
    ],
  };

  // ============================================================================
  // ⚠️ CANCELLED STATUS FILTER (RECOGNIZED TRANSACTIONS)
  // ============================================================================
  // We only treat the explicit "Cancelled" status as cancelled.
  // This matches the transactions dropdown and avoids filtering other labels.
  // ============================================================================
  const rows = await fetchWithStatusChangesFallback({
    fetchWithChanges: () =>
      prisma.transaction.findMany({
        where: baseWhere,
        include: {
          statusChanges: {
            where: { newStatus: { in: [...PAID_STATUSES] } },
            orderBy: { changedAt: 'asc' },
          },
        },
      }),
    fetchWithoutChanges: () =>
      prisma.transaction.findMany({ where: baseWhere }),
    logMessage: 'Falling back to transactions without statusChanges',
  });

  return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
}

export async function fetchApprovedExpenses() {
  return await prisma.expense.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
    },
  });
}

export async function fetchTransactionRefunds(): Promise<
  TransactionRefundWithTransaction[]
> {
  const rows = (await prisma.transactionRefund.findMany({
    where: {
      deletedAt: null,
      transaction: { deletedAt: null },
    },
    include: {
      transaction: {
        select: {
          id: true,
          customers: true,
          productCode: true,
        },
      },
    },
    orderBy: [{ refundDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionRefundWithTransaction[];

  return rows;
}

export async function fetchTransactionPayments(): Promise<
  TransactionPaymentWithTransaction[]
> {
  const transactionPayment = Reflect.get(prisma, 'transactionPayment') as
    | {
        findMany?: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  return fetchOptionalModelRows<TransactionPaymentWithTransaction>({
    model: transactionPayment,
    unavailableLogMessage:
      'TransactionPayment model is unavailable on Prisma Client; returning no payment events',
    unavailableHint:
      'Run `npx prisma generate` and apply the payments migration to enable payment events.',
    query: async () =>
      (await transactionPayment!.findMany!({
        where: {
          deletedAt: null,
          transaction: { deletedAt: null },
        },
        include: {
          transaction: {
            select: {
              id: true,
              customers: true,
              productCode: true,
              orderDate: true,
              orderStatus: true,
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
      })) as TransactionPaymentWithTransaction[],
  });
}

export async function fetchManualJournalLines(params: {
  from: Date;
  to: Date | null;
}): Promise<ManualJournalLine[]> {
  const { from, to } = params;

  const journalModel = Reflect.get(prisma, 'clothingAccountingJournalLine') as
    | {
        findMany?: (args: unknown) => Promise<unknown>;
      }
    | undefined;

  return fetchOptionalModelRows<ManualJournalLine>({
    model: journalModel,
    unavailableLogMessage:
      'Manual journal model is unavailable on Prisma Client; returning no manual journal lines',
    unavailableHint:
      'Run `npx prisma generate` and apply the manual journal migration to enable manual entries.',
    missingTableLogMessage:
      'Manual journal table is missing; returning no manual journal lines',
    missingTableHint:
      'Create/apply the ClothingAccountingJournalLine table to enable manual entries.',
    query: async () =>
      (await journalModel!.findMany!({
        where: {
          date: {
            gte: from,
            ...(to ? { lte: to } : {}),
          },
        },
        orderBy: { date: 'asc' },
      })) as ManualJournalLine[],
  });
}

export function getPaidAtDate(
  transaction: TransactionWithStatusChanges & {
    packedDate?: string | Date | null;
  }
): Date | null {
  const packedDate = parseDate(transaction.packedDate);
  const paidStatusChangedAt = findChangedAtForStatuses(
    transaction.statusChanges,
    PAID_STATUSES
  );
  const orderDate = parseDate(transaction.orderDate);

  // Cutover policy: recognition is based on completion, not order date.
  // Prefer packedDate (ops completion), then paid status-change timestamp, then orderDate.
  return packedDate ?? paidStatusChangedAt ?? orderDate ?? null;
}

export function getCancelledAtDate(tx: {
  statusChanges?: { newStatus: string | null; changedAt: Date }[];
  orderStatus?: string | null;
  updatedAt?: Date;
}): Date | null {
  return getCancelledAtDateFromStatusChanges(tx);
}

export function isWithinDateRange(
  date: Date | null,
  from: Date | null,
  to: Date | null
): boolean {
  if (!from && !to) {
    return true;
  }

  if (!date) {
    return false;
  }

  if (from && date < from) {
    return false;
  }

  if (to && date > to) {
    return false;
  }

  return true;
}
