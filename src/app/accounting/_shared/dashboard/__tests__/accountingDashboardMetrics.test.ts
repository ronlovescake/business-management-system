import { describe, expect, it } from 'vitest';
import {
  buildExpenseSlices,
  buildMonthlyTrend,
  buildProfitSnapshot,
  getBalanceSheetAsOf,
  getComparisonRange,
  getTrendRange,
  percentChange,
  summarizeBalanceSheet,
} from '../accountingDashboardMetrics';
import type { ProfitLossDetailRow } from '@/app/clothing/accounting/profit-loss/hooks/useProfitLoss';

const NOW = new Date(2026, 9, 21, 12, 0, 0);

function comparison(period: Parameters<typeof getComparisonRange>[0]) {
  const range = getComparisonRange(period, NOW);
  if (!range) {
    throw new Error(`Expected a comparison range for ${period}`);
  }
  return { from: new Date(range.from), to: new Date(range.to) };
}

const detail = (
  date: Date,
  type: 'Revenue' | 'Expense',
  category: string,
  amount: number
): ProfitLossDetailRow => ({
  id: `${date.toISOString()}-${category}-${amount}`,
  date: date.toISOString(),
  category,
  type,
  sourceType: 'test',
  sourceId: null,
  ref: null,
  description: '',
  amount,
  customer: null,
  productCode: null,
  method: null,
});

describe('accountingDashboardMetrics', () => {
  it('builds comparison ranges for each period', () => {
    const thisMonth = comparison('This Month');
    expect(thisMonth.from.getMonth()).toBe(8);
    expect(thisMonth.to.getDate()).toBe(30);

    const lastMonth = comparison('Last Month');
    expect(lastMonth.from.getMonth()).toBe(7);
    expect(lastMonth.to.getMonth()).toBe(7);

    const ytd = comparison('This Year');
    expect(ytd.from.getFullYear()).toBe(2025);
    expect(ytd.to.getMonth()).toBe(9);
    expect(ytd.to.getDate()).toBe(21);

    expect(getComparisonRange('All Time', NOW)).toBeNull();
  });

  it('covers the last 12 calendar months for the trend range', () => {
    const { from, to } = getTrendRange(NOW);
    expect(new Date(from)).toEqual(new Date(2025, 10, 1, 0, 0, 0, 0));
    expect(new Date(to).getMonth()).toBe(9);
    expect(new Date(to).getDate()).toBe(31);
  });

  it('uses month end for Last Month balance sheet', () => {
    expect(getBalanceSheetAsOf('Last Month', NOW)).toBe('2026-09-30');
    expect(getBalanceSheetAsOf('This Year', NOW)).toBe('2026-10-21');
  });

  it('computes percent change and guards zero baselines', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(-50, -100)).toBe(50);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
  });

  it('buckets detail rows into 12 months and ignores rows outside the window', () => {
    const trend = buildMonthlyTrend(
      [
        detail(new Date(2026, 9, 5), 'Revenue', 'Sales Revenue', 1000),
        detail(new Date(2026, 9, 6), 'Expense', 'COGS', 400),
        detail(new Date(2026, 9, 7), 'Expense', 'Rent', 100),
        detail(new Date(2026, 9, 8), 'Revenue', 'Sales Returns', -50),
        detail(new Date(2024, 0, 1), 'Revenue', 'Sales Revenue', 999),
      ],
      NOW
    );

    expect(trend).toHaveLength(12);
    expect(trend[0].key).toBe('2025-11');
    const october = trend[11];
    expect(october).toMatchObject({
      key: '2026-10',
      revenue: 950,
      cogs: 400,
      operatingExpenses: 100,
      netProfit: 450,
    });
    expect(trend.slice(0, 11).every((point) => point.revenue === 0)).toBe(true);
  });

  it('builds expense slices without COGS and groups the tail into Others', () => {
    const slices = buildExpenseSlices(
      [
        { id: '1', category: 'Sales Revenue', type: 'Revenue', amount: 5000 },
        { id: '2', category: 'COGS', type: 'Expense', amount: 3000 },
        { id: '3', category: 'Rent', type: 'Expense', amount: 500 },
        { id: '4', category: 'Utilities', type: 'Expense', amount: 200 },
        { id: '5', category: 'Fuel', type: 'Expense', amount: 100 },
        { id: '6', category: 'Supplies', type: 'Expense', amount: 50 },
      ],
      3
    );

    expect(slices).toEqual([
      { name: 'Rent', value: 500 },
      { name: 'Utilities', value: 200 },
      { name: 'Others', value: 150 },
    ]);
  });

  it('separates operating expenses from COGS in the snapshot', () => {
    const snapshot = buildProfitSnapshot({
      revenueTotal: 1000,
      cogsTotal: 400,
      grossProfit: 600,
      expenseTotal: 700,
      netProfit: 300,
      period: 'test',
    });

    expect(snapshot.operatingExpenses).toBe(300);
    expect(snapshot.grossMargin).toBe(60);
    expect(snapshot.netMargin).toBe(30);
    expect(
      buildProfitSnapshot({
        revenueTotal: 0,
        cogsTotal: 0,
        grossProfit: 0,
        expenseTotal: 0,
        netProfit: 0,
        period: 'test',
      }).grossMargin
    ).toBeNull();
  });

  it('summarizes cash and top asset accounts', () => {
    const summary = summarizeBalanceSheet(
      [
        { id: 'a', account: 'Cash', type: 'Asset', amount: 1200 },
        { id: 'b', account: 'Stock on Hand', type: 'Asset', amount: 5000 },
        { id: 'c', account: 'Cash Advances', type: 'Asset', amount: 300 },
        { id: 'd', account: 'Loan Payable', type: 'Liability', amount: 900 },
        { id: 'e', account: 'Overdraft', type: 'Asset', amount: -20 },
      ],
      2
    );

    expect(summary.cashOnHand).toBe(1200);
    expect(summary.topAssets).toEqual([
      { account: 'Stock on Hand', amount: 5000 },
      { account: 'Cash', amount: 1200 },
    ]);
  });
});
