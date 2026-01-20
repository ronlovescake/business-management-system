/**
 * Shared data fetching utilities for accounting modules
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ACCOUNTS_RECEIVABLE_STATUSES, PAID_STATUSES } from './constants';
import { parseDate } from './date-utils';
import { getAccountingCutoverDate } from './cutover';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';

const ACCOUNTING_CUTOVER = getAccountingCutoverDate();

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
  createdAt: Date;
  transaction: {
    id: number;
    customers: string | null;
    productCode: string | null;
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

  try {
    return await prisma.transaction.findMany({
      where: baseWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: [...PAID_STATUSES] } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  } catch (error) {
    logger.warn('Falling back to transactions without statusChanges', {
      error,
    });
    return await prisma.transaction.findMany({ where: baseWhere });
  }
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
    ],
  };

  try {
    const rows = await prisma.transaction.findMany({
      where: baseWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: [...PAID_STATUSES] } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
    return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
  } catch (error) {
    logger.warn('Falling back to transactions without statusChanges', {
      error,
    });
    const rows = await prisma.transaction.findMany({ where: baseWhere });
    return rows.filter((tx) => !isCancelledOrderStatus(tx.orderStatus));
  }
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
          orderStatus: true,
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
  const transactionPayment = (
    prisma as unknown as {
      transactionPayment?: { findMany?: (args: unknown) => Promise<unknown> };
    }
  ).transactionPayment;

  if (!transactionPayment?.findMany) {
    // This usually means the DB/schema was updated but Prisma Client wasn't regenerated yet.
    // Fail open so accounting pages still work using legacy transaction payment fields.
    logger.warn(
      'TransactionPayment model is unavailable on Prisma Client; returning no payment events',
      {
        hint: 'Run `npx prisma generate` and apply the payments migration to enable payment events.',
      }
    );
    return [];
  }

  const rows = (await transactionPayment.findMany({
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
          orderStatus: true,
        },
      },
    },
    orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionPaymentWithTransaction[];

  return rows;
}

export async function fetchManualJournalLines(params: {
  from: Date;
  to: Date | null;
}): Promise<ManualJournalLine[]> {
  const { from, to } = params;

  const journalModel = (
    prisma as unknown as {
      clothingAccountingJournalLine?: {
        findMany?: (args: unknown) => Promise<unknown>;
      };
    }
  ).clothingAccountingJournalLine;

  if (!journalModel?.findMany) {
    logger.warn(
      'Manual journal model is unavailable on Prisma Client; returning no manual journal lines',
      {
        hint: 'Run `npx prisma generate` and apply the manual journal migration to enable manual entries.',
      }
    );
    return [];
  }

  try {
    const rows = (await journalModel.findMany({
      where: {
        date: {
          gte: from,
          ...(to ? { lte: to } : {}),
        },
      },
      orderBy: { date: 'asc' },
    })) as ManualJournalLine[];

    return rows;
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = (error as { message?: string })?.message ?? '';
    if (code === 'P2021' || message.includes('does not exist')) {
      logger.warn(
        'Manual journal table is missing; returning no manual journal lines',
        {
          hint: 'Create/apply the ClothingAccountingJournalLine table to enable manual entries.',
        }
      );
      return [];
    }
    throw error;
  }
}

export function getPaidAtDate(
  transaction: TransactionWithStatusChanges
): Date | null {
  const orderDate = parseDate(transaction.orderDate);
  const paidStatusChangedAt = transaction.statusChanges?.[0]?.changedAt ?? null;

  // Pre-cutover transactions: anchor to orderDate to avoid retroactive status edits
  // moving historical revenue into the cutover period.
  if (orderDate && orderDate < ACCOUNTING_CUTOVER) {
    return orderDate;
  }

  // Post-cutover legacy transactions: prefer the paid-status change timestamp so
  // preorders/reservations don't recognize revenue until marked paid.
  return paidStatusChangedAt ?? orderDate ?? null;
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
