import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const PAID_STATUSES = ['Shipped', 'Ready For Dispatch'];

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function buildPeriodLabel(from: Date | null, to: Date | null): string {
  if (!from && !to) {
    return 'All Time';
  }

  const format = (date: Date) =>
    date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  if (from && to) {
    return `${format(from)} - ${format(to)}`;
  }

  if (from) {
    return `From ${format(from)}`;
  }

  if (to) {
    return `Until ${format(to)}`;
  }

  return 'All Time';
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams;
  const fromParam = parseDate(searchParams.get('from'));
  const toParam = parseDate(searchParams.get('to'));
  const from = fromParam ? startOfDay(fromParam) : null;
  const to = toParam ? endOfDay(toParam) : null;

  const txWhere = {
    deletedAt: null,
    orderStatus: { in: PAID_STATUSES },
  } as const;

  let transactions: Array<
    Awaited<ReturnType<typeof prisma.transaction.findMany>>[number] & {
      statusChanges?: { newStatus: string | null; changedAt: Date }[];
    }
  > = [];

  try {
    transactions = await prisma.transaction.findMany({
      where: txWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: PAID_STATUSES } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  } catch (error) {
    logger.warn('Falling back to transactions without statusChanges', {
      error,
    });
    transactions = await prisma.transaction.findMany({ where: txWhere });
  }

  const expenses = await prisma.expense.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
    },
  });

  const txEntries = transactions
    .map((tx) => {
      const amount = tx.adjustment ?? tx.lineTotal ?? 0;
      if (!Number.isFinite(amount)) {
        return null;
      }

      const paidAt =
        tx.statusChanges?.[0]?.changedAt ?? parseDate(tx.orderDate) ?? null;
      if (
        (from || to) &&
        (!paidAt || (from && paidAt < from) || (to && paidAt > to))
      ) {
        return null;
      }

      const amt = Number(amount);
      const dateStr = (paidAt ?? new Date()).toISOString();
      const ref = tx.shipmentCode || `TX-${tx.id}`;

      return [
        {
          id: `${ref}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: Math.max(amt, 0),
          credit: 0,
          description: tx.notes ?? 'Cash received',
        },
        {
          id: `${ref}-sales`,
          date: dateStr,
          ref,
          account: 'Sales Revenue',
          debit: 0,
          credit: Math.max(amt, 0),
          description: tx.notes ?? 'Sales revenue',
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const expenseEntries = expenses
    .map((exp) => {
      const amount = Number(exp.amount ?? 0);
      if (!Number.isFinite(amount)) {
        return null;
      }

      const expDate = parseDate(exp.date);
      if (
        (from || to) &&
        (!expDate || (from && expDate < from) || (to && expDate > to))
      ) {
        return null;
      }

      const dateStr = (expDate ?? new Date()).toISOString();
      const ref = `EXP-${exp.id}`;

      return [
        {
          id: `${ref}-${exp.category}-debit`,
          date: dateStr,
          ref,
          account: exp.category,
          debit: Math.max(amount, 0),
          credit: 0,
          description: exp.description ?? exp.notes ?? 'Expense',
        },
        {
          id: `${ref}-cash-credit`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: 0,
          credit: Math.max(amount, 0),
          description: exp.description ?? exp.notes ?? 'Cash payment',
        },
      ];
    })
    .flat()
    .filter(Boolean) as Array<{
    id: string;
    date: string;
    ref: string;
    account: string;
    debit: number;
    credit: number;
    description: string;
  }>;

  const entries = [...txEntries, ...expenseEntries];

  const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
  const netChange = totalDebits - totalCredits;

  const now = new Date();
  const entriesThisMonth = entries.filter((e) => {
    const d = parseDate(e.date);
    return (
      d &&
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth()
    );
  }).length;

  const stats = {
    totalDebits,
    totalCredits,
    netChange,
    entriesThisMonth,
    period: buildPeriodLabel(from, to),
  };

  const sortedEntries = entries.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return ApiResponse.success({ entries: sortedEntries, stats });
});
