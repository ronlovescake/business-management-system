import { describe, expect, it } from 'vitest';
import { filterAndSortExpenses } from '@/lib/accounting/expense-filters';

type Expense = {
  id: string;
  date: string;
  description: string;
  category: string;
  status: string;
  sourceType?: string;
};

describe('expense filters', () => {
  const expenses: Expense[] = [
    {
      id: '1',
      date: '2026-01-10',
      description: 'Fuel refill',
      category: 'Fuel',
      status: 'approved',
      sourceType: 'MANUAL',
    },
    {
      id: '2',
      date: '2026-01-12',
      description: 'Office supplies',
      category: 'Supplies',
      status: 'pending',
      sourceType: 'PRODUCT',
    },
  ];

  it('filters by search and status', () => {
    const result = filterAndSortExpenses(expenses, {
      searchQuery: 'office',
      filterCategory: null,
      filterStatus: 'pending',
      getSearchTokens: (expense) => [
        expense.description,
        expense.category,
        expense.sourceType,
      ],
      getCategory: (expense) => expense.category,
      getStatus: (expense) => expense.status,
      getDate: (expense) => expense.date,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('sorts by date descending', () => {
    const result = filterAndSortExpenses(expenses, {
      searchQuery: '',
      filterCategory: null,
      filterStatus: null,
      getSearchTokens: (expense) => [expense.description],
      getCategory: (expense) => expense.category,
      getStatus: (expense) => expense.status,
      getDate: (expense) => expense.date,
    });

    expect(result.map((item) => item.id)).toEqual(['2', '1']);
  });
});
