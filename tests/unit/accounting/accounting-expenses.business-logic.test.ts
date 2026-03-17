import { describe, it, expect } from 'vitest';
import {
  computeExpenseTotals,
  computeMonthlyBreakdownByCategory,
  type ExpenseLike,
} from '@/lib/accounting/expenses-utils';

// ──────────────────────────────────────────────────────────
// computeExpenseTotals
// ──────────────────────────────────────────────────────────

describe('computeExpenseTotals', () => {
  it('sums all amounts as total', () => {
    const expenses: ExpenseLike[] = [
      { date: '2026-01-01', amount: 100 },
      { date: '2026-01-02', amount: 200 },
    ];
    const result = computeExpenseTotals(expenses);
    expect(result.total).toBe(300);
  });

  it('returns zero total for empty array', () => {
    const result = computeExpenseTotals([]);
    expect(result.total).toBe(0);
    expect(result.pendingCount).toBe(0);
    expect(result.approvedTotal).toBe(0);
    expect(result.thisMonthTotal).toBe(0);
  });

  it('counts pending expenses', () => {
    const expenses: ExpenseLike[] = [
      { date: '2026-01-01', amount: 100, status: 'pending' },
      { date: '2026-01-02', amount: 200, status: 'approved' },
      { date: '2026-01-03', amount: 300, status: 'pending' },
    ];
    const result = computeExpenseTotals(expenses);
    expect(result.pendingCount).toBe(2);
  });

  it('sums approved amounts', () => {
    const expenses: ExpenseLike[] = [
      { date: '2026-01-01', amount: 500, status: 'approved' },
      { date: '2026-01-02', amount: 300, status: 'pending' },
      { date: '2026-01-03', amount: 200, status: 'approved' },
    ];
    const result = computeExpenseTotals(expenses);
    expect(result.approvedTotal).toBe(700);
  });

  it('computes this-month total based on current date', () => {
    const now = new Date();
    const thisMonthDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-10`;
    const lastYear = `${now.getFullYear() - 1}-01-10`;

    const expenses: ExpenseLike[] = [
      { date: thisMonthDate, amount: 400 },
      { date: lastYear, amount: 600 },
    ];
    const result = computeExpenseTotals(expenses);
    expect(result.thisMonthTotal).toBe(400);
  });

  it('handles expenses with null status', () => {
    const expenses: ExpenseLike[] = [
      { date: '2026-01-01', amount: 100, status: null },
    ];
    const result = computeExpenseTotals(expenses);
    expect(result.pendingCount).toBe(0);
    expect(result.approvedTotal).toBe(0);
    expect(result.total).toBe(100);
  });
});

// ──────────────────────────────────────────────────────────
// computeMonthlyBreakdownByCategory
// ──────────────────────────────────────────────────────────

describe('computeMonthlyBreakdownByCategory', () => {
  const expenses = [
    { date: '2026-01-15', amount: 500, category: 'Supplies' },
    { date: '2026-01-20', amount: 300, category: 'Supplies' },
    { date: '2026-02-10', amount: 200, category: 'Travel' },
    { date: '2026-03-05', amount: 100, category: 'Travel' },
  ];

  it('returns a row per category', () => {
    const result = computeMonthlyBreakdownByCategory(
      expenses,
      ['Supplies', 'Travel'],
      1100
    );
    expect(result).toHaveLength(2);
    const categories = result.map((r) => r.category);
    expect(categories).toContain('Supplies');
    expect(categories).toContain('Travel');
  });

  it('calculates category total correctly', () => {
    const result = computeMonthlyBreakdownByCategory(
      expenses,
      ['Supplies', 'Travel'],
      1100
    );
    const supplies = result.find((r) => r.category === 'Supplies');
    expect(supplies).toBeDefined();
    expect(supplies?.total).toBe(800);
  });

  it('calculates percentage correctly', () => {
    const result = computeMonthlyBreakdownByCategory(
      expenses,
      ['Supplies', 'Travel'],
      1000
    );
    const travel = result.find((r) => r.category === 'Travel');
    expect(travel).toBeDefined();
    expect(travel?.percentage).toBeCloseTo(30, 0); // 300/1000 * 100
  });

  it('assigns amounts to correct month buckets', () => {
    const result = computeMonthlyBreakdownByCategory(
      expenses,
      ['Supplies'],
      800
    );
    const supplies = result[0];
    expect(supplies.January).toBe(800);
    expect(supplies.February).toBe(0);
  });

  it('sorts categories by total descending', () => {
    const result = computeMonthlyBreakdownByCategory(
      expenses,
      ['Travel', 'Supplies'],
      1100
    );
    expect(result[0].category).toBe('Supplies');
    expect(result[1].category).toBe('Travel');
  });

  it('returns zero percentage when totalExpenses is 0', () => {
    const result = computeMonthlyBreakdownByCategory(expenses, ['Supplies'], 0);
    expect(result[0].percentage).toBe(0);
  });

  it('returns empty array for empty categories list', () => {
    const result = computeMonthlyBreakdownByCategory(expenses, [], 1000);
    expect(result).toEqual([]);
  });
});
