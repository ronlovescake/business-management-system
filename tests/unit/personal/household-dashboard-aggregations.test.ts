import { describe, expect, it } from 'vitest';
import {
  buildHouseholdDashboardSummary,
  type DashboardAccountInput,
  type DashboardExpenseInput,
  type DashboardIncomeInput,
  type DashboardRecurringPaymentInput,
} from '@/modules/household/dashboard/api/aggregations';
import { getNextDueDate } from '@/modules/household/recurringPayments/api/schedule';

const emptyInput = {
  expenses: [] as DashboardExpenseInput[],
  income: [] as DashboardIncomeInput[],
  accounts: [] as DashboardAccountInput[],
  recurringPayments: [] as DashboardRecurringPaymentInput[],
};

function expense(
  overrides: Partial<DashboardExpenseInput> = {}
): DashboardExpenseInput {
  return {
    amount: 100,
    category: 'Food',
    date: '2026-10-21',
    status: 'paid',
    sourceType: 'MANUAL',
    sourceId: null,
    sourceLineKey: null,
    ...overrides,
  };
}

function recurringPayment(
  overrides: Partial<DashboardRecurringPaymentInput> = {}
): DashboardRecurringPaymentInput {
  return {
    id: 'payment-1',
    name: 'Monthly bill',
    amount: 300,
    category: 'Utilities',
    startDate: '2026-10-25',
    monthsCount: null,
    isActive: true,
    accountName: null,
    ...overrides,
  };
}

const asOf = new Date('2026-10-21T12:00:00.000Z');

describe('household dashboard aggregation', () => {
  it('compares the selected period and excludes rejected expenses', () => {
    const summary = buildHouseholdDashboardSummary(
      {
        ...emptyInput,
        expenses: [
          expense({ amount: 150, date: '2026-10-21' }),
          expense({ amount: 50, date: '2026-10-20', status: 'pending' }),
          expense({ amount: 100, date: '2026-10-14' }),
          expense({ amount: 900, date: '2026-10-19', status: 'rejected' }),
        ],
        income: [
          { amount: 500, date: '2026-10-21' },
          { amount: 400, date: '2026-10-14' },
        ],
      },
      'last7days',
      asOf
    );

    expect(summary.kpis).toMatchObject({
      income: 500,
      incomeDelta: 25,
      expenses: 200,
      expensesDelta: 100,
      netCashFlow: 300,
      netCashFlowDelta: 0,
      savingsRate: 60,
      previousSavingsRate: 75,
    });
    expect(summary.categories).toEqual([
      { category: 'Food', amount: 200, count: 2, share: 100 },
    ]);
    expect(summary.weekday.find((row) => row.day === 'Wed')).toEqual({
      day: 'Wed',
      amount: 150,
      count: 1,
    });
    expect(summary.trend).toHaveLength(7);
  });

  it('uses prior year-to-date monthly averages and subtracts liabilities from net worth', () => {
    const accounts: DashboardAccountInput[] = [
      {
        id: 'bank',
        name: 'Bank',
        type: 'BANK',
        balance: 2000,
        isActive: true,
      },
      {
        id: 'card',
        name: 'Credit card',
        type: 'CREDIT_CARD',
        balance: 500,
        isActive: true,
      },
      {
        id: 'loan',
        name: 'Loan',
        type: 'LOAN',
        balance: 200,
        isActive: true,
      },
      {
        id: 'inactive',
        name: 'Closed account',
        type: 'BANK',
        balance: 9000,
        isActive: false,
      },
    ];
    const summary = buildHouseholdDashboardSummary(
      {
        ...emptyInput,
        accounts,
        expenses: [
          expense({ amount: 900, date: '2026-01-10' }),
          expense({ amount: 400, category: 'Utilities', date: '2026-03-10' }),
          expense({ amount: 250, date: '2026-10-20', status: 'approved' }),
          expense({ amount: 1000, date: '2026-10-20', status: 'rejected' }),
        ],
      },
      'ytd',
      asOf
    );

    expect(summary.kpis.netWorth).toBe(1300);
    expect(summary.accounts).toHaveLength(3);
    expect(summary.budgets).toEqual([
      { category: 'Food', planned: 100, actual: 250, variance: 150 },
      {
        category: 'Utilities',
        planned: 44.44,
        actual: 0,
        variance: -44.44,
      },
    ]);
  });

  it('shows recurring bill states, excludes rejected generated bills, and skips ended plans', () => {
    const summary = buildHouseholdDashboardSummary(
      {
        ...emptyInput,
        recurringPayments: [
          recurringPayment({ id: 'scheduled', startDate: '2026-10-25' }),
          recurringPayment({
            id: 'pending',
            name: 'Pending bill',
            startDate: '2026-10-22',
          }),
          recurringPayment({
            id: 'rejected',
            name: 'Rejected bill',
            startDate: '2026-10-23',
          }),
          recurringPayment({
            id: 'ended',
            startDate: '2026-08-01',
            monthsCount: 2,
          }),
        ],
        expenses: [
          expense({
            amount: 300,
            date: '2026-10-22',
            status: 'pending',
            sourceType: 'RECURRING',
            sourceId: 'pending',
            sourceLineKey: '2026-10',
          }),
          expense({
            amount: 300,
            date: '2026-10-23',
            status: 'rejected',
            sourceType: 'RECURRING',
            sourceId: 'rejected',
            sourceLineKey: '2026-10',
          }),
        ],
      },
      'mtd',
      asOf
    );

    expect(
      summary.upcomingBills.map(({ id, status }) => ({ id, status }))
    ).toEqual([
      { id: 'pending', status: 'pending' },
      { id: 'scheduled', status: 'scheduled' },
    ]);
    expect(summary.kpis.upcomingBillsTotal).toBe(600);
    expect(summary.kpis.upcomingBillsCount).toBe(2);
  });

  it('uses Manila business dates when the server clock is still on the previous UTC date', () => {
    const summary = buildHouseholdDashboardSummary(
      {
        ...emptyInput,
        expenses: [expense({ date: '2026-10-22' })],
      },
      'mtd',
      new Date('2026-10-21T16:30:00.000Z')
    );

    expect(summary.asOf).toBe('2026-10-22');
    expect(summary.kpis.expenses).toBe(100);
  });

  it('returns stable zeroed weekday and financial summaries for empty data', () => {
    const summary = buildHouseholdDashboardSummary(emptyInput, 'all', asOf);

    expect(summary.kpis).toMatchObject({
      netWorth: 0,
      income: 0,
      expenses: 0,
      netCashFlow: 0,
      savingsRate: null,
      upcomingBillsTotal: 0,
      upcomingBillsCount: 0,
    });
    expect(summary.categories).toEqual([]);
    expect(summary.budgets).toEqual([]);
    expect(summary.weekday).toHaveLength(7);
    expect(
      summary.weekday.every((row) => row.amount === 0 && row.count === 0)
    ).toBe(true);
  });
});

describe('household recurring schedule dates', () => {
  it('clamps month-end occurrences and respects the configured duration', () => {
    expect(
      getNextDueDate(
        { startDate: '2026-01-31', monthsCount: 3 },
        new Date(2026, 1, 1)
      )
    ).toEqual(new Date(2026, 1, 28));
    expect(
      getNextDueDate(
        { startDate: '2026-01-31', monthsCount: 2 },
        new Date(2026, 2, 1)
      )
    ).toBeNull();
  });
});
