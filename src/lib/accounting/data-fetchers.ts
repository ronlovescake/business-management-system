/**
 * Shared data fetching utilities for accounting modules
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ACCOUNTS_RECEIVABLE_STATUSES, PAID_STATUSES } from './constants';
import { parseDate } from './date-utils';

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
  };
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
    orderStatus: { in: [...recognizedStatuses] },
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
        },
      },
    },
    orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
  })) as TransactionPaymentWithTransaction[];

  return rows;
}

export function getPaidAtDate(
  transaction: TransactionWithStatusChanges
): Date | null {
  return (
    transaction.statusChanges?.[0]?.changedAt ??
    parseDate(transaction.orderDate) ??
    null
  );
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
