import { afterEach, describe, it, expect, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react/pure';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useExpenseData,
  useGeneralMerchandiseExpenseData,
  useTruckingExpenseData,
} from '@/hooks/useSheetData';
import {
  ExpenseService,
  GeneralMerchandiseExpenseService,
  TruckingExpenseService,
} from '@/services';
import type { ExpenseDTO } from '@/types';
import {
  computeExpenseTotals,
  computeMonthlyBreakdownByCategory,
  type ExpenseLike,
} from '@/lib/accounting/expenses-utils';

vi.mock('@/services', () => {
  const service = () => ({
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
    bulkCreate: vi.fn(),
    bulkUpdate: vi.fn(),
  });
  return {
    ExpenseService: service(),
    GeneralMerchandiseExpenseService: service(),
    TruckingExpenseService: service(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('expense mutation during initial loading', () => {
  describe.each([
    ['clothing', useExpenseData, ExpenseService],
    [
      'general merchandise',
      useGeneralMerchandiseExpenseData,
      GeneralMerchandiseExpenseService,
    ],
    ['trucking', useTruckingExpenseData, TruckingExpenseService],
  ] as const)('%s', (_domain, useData, service) => {
    it.each([
      'create',
      'update',
      'delete',
      'bulkCreate',
      'bulkUpdate',
    ] as const)(
      '%s refreshes without publishing an older response',
      async (operation) => {
        const saved: ExpenseDTO = {
          id: 1,
          date: '2026-10-28',
          amount: 100,
          description: 'Fuel refresh regression',
          category: 'Fuel',
          notes: null,
          receipt: null,
          status: 'pending',
          employeeName: null,
        };
        const expected = operation === 'delete' ? [] : [saved];
        let resolveInitial: (rows: ExpenseDTO[]) => void = () => {};
        const initial = new Promise<ExpenseDTO[]>((resolve) => {
          resolveInitial = resolve;
        });
        vi.mocked(service.getAll)
          .mockReset()
          .mockImplementationOnce(() => initial)
          .mockResolvedValue(expected);
        vi.mocked(service.create).mockResolvedValue(saved);
        vi.mocked(service.update).mockResolvedValue(saved);
        vi.mocked(service.deleteById).mockResolvedValue(undefined);
        vi.mocked(service.bulkCreate).mockResolvedValue({ count: 1 });
        vi.mocked(service.bulkUpdate).mockResolvedValue({ count: 1 });
        const queryClient = new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 } },
        });
        const wrapper = ({ children }: { children: ReactNode }) =>
          createElement(QueryClientProvider, { client: queryClient }, children);
        const { result, unmount } = renderHook(() => useData(), { wrapper });
        let mutating: Promise<unknown> | undefined;
        const actions = {
          create: () => result.current.createAsync(saved),
          update: () =>
            result.current.updateAsync({ id: saved.id, data: saved }),
          delete: () => result.current.deleteAsync(saved.id),
          bulkCreate: () => result.current.bulkCreateAsync([saved]),
          bulkUpdate: () => result.current.bulkUpdateAsync([saved]),
        };
        try {
          await waitFor(() => expect(service.getAll).toHaveBeenCalledTimes(1));
          act(() => {
            mutating = actions[operation]();
          });
          await waitFor(() => expect(service.getAll).toHaveBeenCalledTimes(2));
          await act(async () => {
            await mutating;
          });
          await waitFor(() => expect(result.current.data).toEqual(expected));
          await act(async () => {
            resolveInitial([{ ...saved, description: 'Superseded response' }]);
            await initial;
          });
          expect(result.current.data).toEqual(expected);
        } finally {
          resolveInitial([]);
          await mutating;
          unmount();
          queryClient.clear();
        }
      }
    );
  });
});

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
