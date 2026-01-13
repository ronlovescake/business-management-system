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
