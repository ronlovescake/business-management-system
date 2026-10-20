import dayjs from 'dayjs';
import type { PeriodOption } from '@/lib/accounting/constants';
import { endOfDay, startOfDay } from '@/lib/accounting/date-utils';
import type {
  ProfitLossDetailRow,
  ProfitLossRow,
  ProfitLossStats,
} from '@/app/clothing/accounting/profit-loss/hooks/useProfitLoss';
import type { BalanceSheetRow } from '@/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet';

export const TREND_MONTHS = 12;

export type DateRangeIso = { from: string; to: string };

export type MonthlyTrendPoint = {
  key: string;
  month: string;
  revenue: number;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
};

export type ExpenseSlice = { name: string; value: number };

export type ProfitSnapshot = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  grossMargin: number | null;
  netMargin: number | null;
};

export type AssetAccount = { account: string; amount: number };

export type BalanceSheetSummary = {
  cashOnHand: number;
  topAssets: AssetAccount[];
};

const range = (from: Date, to: Date): DateRangeIso => ({
  from: startOfDay(from).toISOString(),
  to: endOfDay(to).toISOString(),
});

// Mirrors getPeriodRange; "This Year" compares year-to-date against the same span last year.
export function getComparisonRange(
  period: PeriodOption,
  now: Date = new Date()
): DateRangeIso | null {
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (period) {
    case 'This Month':
      return range(new Date(y, m - 1, 1), new Date(y, m, 0));
    case 'Last Month':
      return range(new Date(y, m - 2, 1), new Date(y, m - 1, 0));
    case 'Last 30 Days': {
      const to = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const from = new Date(now.getTime() - 59 * 24 * 60 * 60 * 1000);
      return range(from, to);
    }
    case 'This Year':
      return range(new Date(y - 1, 0, 1), new Date(y - 1, m, now.getDate()));
    default:
      return null;
  }
}

export function getTrendRange(now: Date = new Date()): DateRangeIso {
  const y = now.getFullYear();
  const m = now.getMonth();
  return range(new Date(y, m - (TREND_MONTHS - 1), 1), new Date(y, m + 1, 0));
}

export function getBalanceSheetAsOf(
  period: PeriodOption,
  now: Date = new Date()
): string {
  const asOf =
    period === 'Last Month'
      ? new Date(now.getFullYear(), now.getMonth(), 0)
      : now;
  return dayjs(asOf).format('YYYY-MM-DD');
}

export function percentChange(
  current: number,
  previous: number | null | undefined
): number | null {
  if (previous === null || previous === undefined || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function buildMonthlyTrend(
  rows: ProfitLossDetailRow[],
  now: Date = new Date()
): MonthlyTrendPoint[] {
  const start = dayjs(now)
    .startOf('month')
    .subtract(TREND_MONTHS - 1, 'month');
  const buckets = new Map<string, MonthlyTrendPoint>();

  for (let i = 0; i < TREND_MONTHS; i += 1) {
    const month = start.add(i, 'month');
    const key = month.format('YYYY-MM');
    buckets.set(key, {
      key,
      month: month.format("MMM 'YY"),
      revenue: 0,
      cogs: 0,
      operatingExpenses: 0,
      netProfit: 0,
    });
  }

  rows.forEach((row) => {
    const parsed = row.date ? dayjs(row.date) : null;
    const bucket = parsed?.isValid()
      ? buckets.get(parsed.format('YYYY-MM'))
      : undefined;
    if (!bucket || !Number.isFinite(row.amount)) {
      return;
    }
    if (row.type === 'Revenue') {
      bucket.revenue += row.amount;
    } else if (row.category === 'COGS') {
      bucket.cogs += row.amount;
    } else {
      bucket.operatingExpenses += row.amount;
    }
  });

  return Array.from(buckets.values()).map((bucket) => ({
    ...bucket,
    netProfit: bucket.revenue - bucket.cogs - bucket.operatingExpenses,
  }));
}

export function buildExpenseSlices(
  rows: ProfitLossRow[],
  maxSlices = 5
): ExpenseSlice[] {
  const expenses = rows
    .filter(
      (row) =>
        row.type === 'Expense' && row.category !== 'COGS' && row.amount > 0
    )
    .map((row) => ({ name: row.category, value: row.amount }))
    .sort((a, b) => b.value - a.value);

  if (expenses.length <= maxSlices) {
    return expenses;
  }

  const top = expenses.slice(0, maxSlices - 1);
  const others = expenses
    .slice(maxSlices - 1)
    .reduce((sum, slice) => sum + slice.value, 0);
  return [...top, { name: 'Others', value: others }];
}

// The API's expenseTotal already includes COGS and shrinkage.
export function buildProfitSnapshot(stats: ProfitLossStats): ProfitSnapshot {
  const revenue = stats.revenueTotal;
  return {
    revenue,
    cogs: stats.cogsTotal,
    grossProfit: stats.grossProfit,
    operatingExpenses: stats.expenseTotal - stats.cogsTotal,
    netProfit: stats.netProfit,
    grossMargin: revenue !== 0 ? (stats.grossProfit / revenue) * 100 : null,
    netMargin: revenue !== 0 ? (stats.netProfit / revenue) * 100 : null,
  };
}

export function summarizeBalanceSheet(
  rows: BalanceSheetRow[],
  maxAssets = 8
): BalanceSheetSummary {
  const assets = rows.filter((row) => row.type === 'Asset');
  // Same account the Balance Sheet page uses for its cash breakdown.
  const cashOnHand = assets
    .filter((row) => row.account.trim().toLowerCase() === 'cash')
    .reduce((sum, row) => sum + row.amount, 0);
  const topAssets = assets
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, maxAssets)
    .map((row) => ({ account: row.account, amount: row.amount }));

  return { cashOnHand, topAssets };
}
