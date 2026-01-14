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
import { normalizeTransactionAmounts } from '@/lib/accounting/transaction-normalization';
import { computeCogsTotal } from '@/lib/accounting/inventory-cogs';

export const dynamic = 'force-dynamic';

const CUTOVER = new Date(Date.UTC(2026, 0, 1));

function clampFrom(from: Date | null): Date {
  if (!from) {
    return CUTOVER;
  }
  return from < CUTOVER ? CUTOVER : from;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { from, to } = parseDateRangeFromParams(req.nextUrl.searchParams);
  const effectiveFrom = clampFrom(from);
  const effectiveTo = to ?? null;

  const transactions = await fetchPaidTransactions();
  const expenses = await fetchApprovedExpenses();

  const transactionsWithPaidAt = transactions.map((tx) => {
    const paidAt = getPaidAtDate(tx);
    return { ...tx, paidAt };
  });

  const filteredTransactions = transactionsWithPaidAt.filter((tx) =>
    isWithinDateRange(tx.paidAt, effectiveFrom, effectiveTo)
  );

  const revenueTotal = filteredTransactions.reduce((sum, tx) => {
    const { paymentReceived } = normalizeTransactionAmounts(tx);
    return sum + paymentReceived;
  }, 0);

  const expenseTotalsByCategory = new Map<string, number>();
  expenses.forEach((exp) => {
    const expenseDate = parseDate(exp.date);
    if (!isWithinDateRange(expenseDate, effectiveFrom, effectiveTo)) {
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

  const cogsTotal = await computeCogsTotal({
    from: effectiveFrom,
    to: effectiveTo,
  });

  if (cogsTotal !== 0) {
    rows.push({
      id: 'expense-cogs',
      category: 'COGS',
      type: 'Expense',
      amount: cogsTotal,
    });
  }

  const totalExpenses = expenseTotal + cogsTotal;
  const grossProfit = revenueTotal - cogsTotal;

  const stats = {
    revenueTotal,
    cogsTotal,
    grossProfit,
    expenseTotal: totalExpenses,
    netProfit: revenueTotal - totalExpenses,
    period: buildPeriodLabel(from, to),
  };

  return ApiResponse.success({ rows, stats });
});
