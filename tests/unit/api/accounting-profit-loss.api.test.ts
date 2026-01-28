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
      getCancelledAtDate: vi.fn(),
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
    getCancelledAtDate: mockFetchers.getCancelledAtDate,
    isWithinDateRange: mockFetchers.isWithinDateRange,
  };
});

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      transaction: {
        findMany: vi.fn(),
      },
    },
  };
});

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    prisma: mockPrisma,
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

    mockFetchers.isWithinDateRange.mockImplementation((date: Date | null) => {
      return date instanceof Date;
    });
    mockFetchers.getPaidAtDate.mockReturnValue(null);
    mockFetchers.getCancelledAtDate.mockImplementation((tx: unknown) => {
      const typed = tx as {
        statusChanges?: { newStatus: string | null; changedAt: Date }[];
        updatedAt?: Date;
      };
      return typed.statusChanges?.[0]?.changedAt ?? typed.updatedAt ?? null;
    });

    mockPrisma.transaction.findMany.mockResolvedValue([]);

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

  it('excludes reservation payments from Sales Revenue until recognized', async () => {
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-10',
        amount: 200,
        method: 'cash',
        notes: null,
        isReservation: true,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
          orderStatus: 'Pending Payment',
        },
      },
    ]);

    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
    mockInventoryCogs.computeInventorySeedAndShrinkageTotals.mockResolvedValue({
      seedTotal: 0,
      shrinkageTotal: 0,
    });

    const res = await GET(
      buildRequest('/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);

    const stats: { revenueTotal: number } = payload.data.stats;
    expect(stats.revenueTotal).toBe(0);

    const rows: Array<{ category: string; amount: number }> = payload.data.rows;
    expect(rows.some((r) => r.category === 'Sales Revenue')).toBe(false);
    expect(rows.some((r) => r.category === 'Forfeited Deposits')).toBe(false);
  });

  it('recognizes reservation deposits as Sales Revenue once the order is in a paid status', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([
      {
        id: 123,
        productCode: 'P-100',
        customers: 'Alice',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        adjustment: 0,
        lineTotal: 0,
        orderDate: '2026-01-20',
        orderStatus: 'Checked Out',
        statusChanges: [
          {
            newStatus: 'Checked Out',
            changedAt: new Date('2026-01-20T00:00:00.000Z'),
          },
        ],
      },
    ]);

    mockFetchers.getPaidAtDate.mockReturnValue(
      new Date('2026-01-20T00:00:00.000Z')
    );

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-10',
        amount: 200,
        method: 'cash',
        notes: null,
        isReservation: true,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
          orderStatus: 'Checked Out',
        },
      },
    ]);

    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
    mockInventoryCogs.computeInventorySeedAndShrinkageTotals.mockResolvedValue({
      seedTotal: 0,
      shrinkageTotal: 0,
    });

    const res = await GET(
      buildRequest('/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{ category: string; amount: number }> = payload.data.rows;
    const sales = rows.find((r) => r.category === 'Sales Revenue')?.amount ?? 0;
    expect(sales).toBe(200);

    const stats: { revenueTotal: number } = payload.data.stats;
    expect(stats.revenueTotal).toBe(200);
  });

  it('recognizes forfeited deposits on the cancellation/forfeit date (not as Sales Revenue)', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-10',
        amount: 200,
        method: 'cash',
        notes: null,
        isReservation: true,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
          orderStatus: 'Forfeited',
        },
      },
    ]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 123,
        updatedAt: new Date('2026-01-21T00:00:00.000Z'),
        statusChanges: [
          {
            newStatus: 'Forfeited',
            changedAt: new Date('2026-01-18T00:00:00.000Z'),
          },
        ],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(
      new Date('2026-01-18T00:00:00.000Z')
    );

    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
    mockInventoryCogs.computeInventorySeedAndShrinkageTotals.mockResolvedValue({
      seedTotal: 0,
      shrinkageTotal: 0,
    });

    const res = await GET(
      buildRequest('/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{ category: string; amount: number }> = payload.data.rows;
    const sales = rows.find((r) => r.category === 'Sales Revenue')?.amount ?? 0;
    const forfeited =
      rows.find((r) => r.category === 'Forfeited Deposits')?.amount ?? 0;

    expect(sales).toBe(0);
    expect(forfeited).toBe(200);
  });
});
