import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import {
  parseDateRangeFromParams,
  buildPeriodLabel,
  parseDate,
} from '@/lib/accounting/date-utils';
import {
  fetchPaidTransactions,
  fetchApprovedExpenses,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';

export const dynamic = 'force-dynamic';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);

  const transactions = await fetchPaidTransactions();
  const expenses = await fetchApprovedExpenses();

  const transactionsWithPaidAt = transactions.map((tx) => {
    const paidAt = getPaidAtDate(tx);
    return { ...tx, paidAt };
  });

  const filteredTransactions = transactionsWithPaidAt.filter((tx) =>
    isWithinDateRange(tx.paidAt, from, to)
  );

  const revenueTotal = filteredTransactions.reduce((sum, tx) => {
    const amount = tx.adjustment ?? tx.lineTotal ?? 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const expenseTotalsByCategory = new Map<string, number>();
  expenses.forEach((exp) => {
    const expenseDate = parseDate(exp.date);
    if (!isWithinDateRange(expenseDate, from, to)) {
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
