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

  const baseWhere = {
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
      where: baseWhere,
      include: {
        statusChanges: {
          where: { newStatus: { in: PAID_STATUSES } },
          orderBy: { changedAt: 'asc' },
        },
      },
    });
  } catch (error) {
    // If the status change table is missing or inaccessible, fall back gracefully.
    logger.warn('Falling back to transactions without statusChanges', {
      error,
    });
    transactions = await prisma.transaction.findMany({ where: baseWhere });
  }

  const expenses = await prisma.expense.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
    },
  });

  const transactionsWithPaidAt = transactions.map((tx) => {
    const paidAt =
      tx.statusChanges?.[0]?.changedAt ?? parseDate(tx.orderDate) ?? null;
    return { ...tx, paidAt };
  });

  const filteredTransactions = transactionsWithPaidAt.filter((tx) => {
    if (!from && !to) {
      return true;
    }

    if (!tx.paidAt) {
      return false;
    }

    if (from && tx.paidAt < from) {
      return false;
    }

    if (to && tx.paidAt > to) {
      return false;
    }

    return true;
  });

  const revenueTotal = filteredTransactions.reduce((sum, tx) => {
    const amount = tx.adjustment ?? tx.lineTotal ?? 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const expenseTotalsByCategory = new Map<string, number>();
  expenses.forEach((exp) => {
    const expenseDate = parseDate(exp.date);
    if (from && expenseDate && expenseDate < from) {
      return;
    }
    if (to && expenseDate && expenseDate > to) {
      return;
    }
    if ((from || to) && !expenseDate) {
      return;
    }

    const amount = Number.isFinite(exp.amount) ? exp.amount : 0;
    const current = expenseTotalsByCategory.get(exp.category) ?? 0;
    expenseTotalsByCategory.set(exp.category, current + amount);
  });

  const rows = [] as Array<{
    id: string;
    category: string;
    type: 'Revenue' | 'Expense';
    amount: number;
  }>;

  if (revenueTotal !== 0) {
    rows.push({
      id: 'revenue-sales',
      category: 'Sales Revenue',
      type: 'Revenue',
      amount: revenueTotal,
    });
  }

  expenseTotalsByCategory.forEach((amount, category) => {
    rows.push({
      id: `expense-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      category,
      type: 'Expense',
      amount,
    });
  });

  const expenseTotal = Array.from(expenseTotalsByCategory.values()).reduce(
    (sum, amt) => sum + amt,
    0
  );

  const stats = {
    revenueTotal,
    expenseTotal,
    netProfit: revenueTotal - expenseTotal,
    period: buildPeriodLabel(from, to),
  };

  return ApiResponse.success({ rows, stats });
});
