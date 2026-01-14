import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockFetchers, mockInventoryCogs } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchPaidTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      isWithinDateRange: vi.fn(),
    },
    mockInventoryCogs: {
      computeCogsTotal: vi.fn(),
      computeInventorySeedAndShrinkageTotals: vi.fn(),
    },
  };
});

vi.mock('@/lib/accounting/data-fetchers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    fetchPaidTransactions: mockFetchers.fetchPaidTransactions,
    fetchTransactionPayments: mockFetchers.fetchTransactionPayments,
    fetchApprovedExpenses: mockFetchers.fetchApprovedExpenses,
    fetchTransactionRefunds: mockFetchers.fetchTransactionRefunds,
    getPaidAtDate: mockFetchers.getPaidAtDate,
    isWithinDateRange: mockFetchers.isWithinDateRange,
  };
});

vi.mock('@/lib/accounting/inventory-cogs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    computeCogsTotal: mockInventoryCogs.computeCogsTotal,
    computeInventorySeedAndShrinkageTotals:
      mockInventoryCogs.computeInventorySeedAndShrinkageTotals,
  };
});

import { GET } from '@/app/api/accounting/profit-loss/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Accounting Profit & Loss API - GET /api/accounting/profit-loss', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-10',
        amount: 200,
        method: 'cash',
        notes: null,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
        },
      },
    ]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([
      {
        id: 10,
        date: '2026-01-11',
        category: 'Rent',
        amount: 50,
        description: 'Rent',
        notes: null,
      },
    ]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);

    mockFetchers.isWithinDateRange.mockReturnValue(true);
    mockFetchers.getPaidAtDate.mockReturnValue(null);

    mockInventoryCogs.computeCogsTotal.mockResolvedValue(100);
    mockInventoryCogs.computeInventorySeedAndShrinkageTotals.mockResolvedValue({
      seedTotal: 0,
      shrinkageTotal: 25,
    });
  });

  it('includes inventory shrinkage as its own expense line and in net profit', async () => {
    const res = await GET(
      buildRequest('/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{
      id: string;
      category: string;
      type: string;
      amount: number;
    }> = payload.data.rows;

    expect(rows.some((r) => r.id === 'expense-inventory-shrinkage')).toBe(true);

    const stats: {
      revenueTotal: number;
      cogsTotal: number;
      grossProfit: number;
      expenseTotal: number;
      netProfit: number;
    } = payload.data.stats;

    // Revenue 200; expenses 50 + COGS 100 + shrinkage 25
    expect(stats.revenueTotal).toBe(200);
    expect(stats.cogsTotal).toBe(100);
    expect(stats.expenseTotal).toBe(50 + 100 + 25);
    expect(stats.netProfit).toBe(200 - (50 + 100 + 25));
  });
});
