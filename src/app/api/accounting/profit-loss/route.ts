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
  fetchTransactionRefunds,
  fetchTransactionPayments,
  getPaidAtDate,
  isWithinDateRange,
} from '@/lib/accounting/data-fetchers';
import {
  computeCogsTotal,
  computeInventorySeedAndShrinkageTotals,
} from '@/lib/accounting/inventory-cogs';
import { normalizeTransactionAmountsForAccounting } from '@/lib/accounting/transaction-normalization';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';

export const dynamic = 'force-dynamic';

const CUTOVER = getAccountingCutoverDate();

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
  const refunds = await fetchTransactionRefunds();
  const payments = await fetchTransactionPayments();

  const paymentTransactionIds = new Set(payments.map((p) => p.transactionId));

  const paymentRevenueTotal = payments.reduce((sum, payment) => {
    const paymentAt = parseDate(payment.paymentDate);
    if (!isWithinDateRange(paymentAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const amt = Number(payment.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return sum;
    }

    return sum + amt;
  }, 0);

  const transactionsWithPaidAt = transactions
    .filter((tx) => !paymentTransactionIds.has(tx.id))
    .map((tx) => {
      const paidAt = getPaidAtDate(tx);
      return { ...tx, paidAt };
    });

  const filteredTransactions = transactionsWithPaidAt.filter((tx) =>
    isWithinDateRange(tx.paidAt, effectiveFrom, effectiveTo)
  );

  const legacyRevenueTotal = filteredTransactions.reduce((sum, tx) => {
    const { paymentReceived } = normalizeTransactionAmountsForAccounting(tx);
    return sum + paymentReceived;
  }, 0);

  const revenueTotal = paymentRevenueTotal + legacyRevenueTotal;

  const refundTotal = refunds.reduce((sum, refund) => {
    const refundAt = parseDate(refund.refundDate);
    if (!isWithinDateRange(refundAt, effectiveFrom, effectiveTo)) {
      return sum;
    }

    const amt = Number(refund.amount ?? 0);
    if (!Number.isFinite(amt) || amt <= 0) {
      return sum;
    }

    return sum + amt;
  }, 0);

  const netRevenueTotal = revenueTotal - refundTotal;

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

  if (refundTotal !== 0) {
    rows.push({
      id: 'revenue-sales-returns',
      category: 'Sales Returns',
      type: 'Revenue',
      amount: -refundTotal,
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

  const { shrinkageTotal } = await computeInventorySeedAndShrinkageTotals({
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

  if (shrinkageTotal !== 0) {
    rows.push({
      id: 'expense-inventory-shrinkage',
      category: 'Inventory Shrinkage',
      type: 'Expense',
      amount: shrinkageTotal,
    });
  }

  const totalExpenses = expenseTotal + cogsTotal + shrinkageTotal;
  const grossProfit = netRevenueTotal - cogsTotal;

  const stats = {
    revenueTotal: netRevenueTotal,
    cogsTotal,
    grossProfit,
    expenseTotal: totalExpenses,
    netProfit: netRevenueTotal - totalExpenses,
    period: buildPeriodLabel(from, to),
  };

  return ApiResponse.success({ rows, stats });
});
