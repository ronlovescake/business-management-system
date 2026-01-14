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
import { buildCogsAndInventoryEntries } from '@/lib/accounting/inventory-cogs';

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

  const txEntries = transactions
    .map((tx) => {
      const { paymentReceived } = normalizeTransactionAmounts(tx);
      const amount = paymentReceived;

      const paidAt = getPaidAtDate(tx);
      if (!isWithinDateRange(paidAt, effectiveFrom, effectiveTo)) {
        return null;
      }

      const amt = Number(amount);
      const dateStr = (paidAt ?? new Date()).toISOString();
      const productRef = (tx.productCode ?? '').trim();
      const ref = productRef || `TX-${tx.id}`;
      const idBase = `TX-${tx.id}`;
      const customer = (tx.customers ?? '').trim();

      return [
        {
          id: `${idBase}-cash`,
          date: dateStr,
          ref,
          account: 'Cash',
          debit: Math.max(amt, 0),
          credit: 0,
          description: customer || 'Unknown customer',
        },
        {
          id: `${idBase}-sales`,
          date: dateStr,
          ref,
          account: 'Sales Revenue',
          debit: 0,
          credit: Math.max(amt, 0),
          description: customer || 'Unknown customer',
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
      if (!isWithinDateRange(expDate, effectiveFrom, effectiveTo)) {
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

  const { entries: cogsEntries } = await buildCogsAndInventoryEntries({
    from: effectiveFrom,
    to: effectiveTo,
  });

  const entries = [...txEntries, ...expenseEntries, ...cogsEntries];

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
