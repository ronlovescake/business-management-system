import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockFetchers, mockPrisma, mockInventoryCogs } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchRecognizedTransactions: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      isWithinDateRange: vi.fn(),
    },
    mockPrisma: {
      clothingAccountingOpeningBalance: {
        findMany: vi.fn(),
      },
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
    fetchRecognizedTransactions: mockFetchers.fetchRecognizedTransactions,
    fetchApprovedExpenses: mockFetchers.fetchApprovedExpenses,
    fetchTransactionRefunds: mockFetchers.fetchTransactionRefunds,
    getPaidAtDate: mockFetchers.getPaidAtDate,
    isWithinDateRange: mockFetchers.isWithinDateRange,
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

import { GET } from '@/app/api/accounting/balance-sheet/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Accounting Balance Sheet API - GET /api/accounting/balance-sheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchers.fetchRecognizedTransactions.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);

    // Date helpers: route uses isWithinDateRange for various flows; keep it permissive.
    mockFetchers.isWithinDateRange.mockReturnValue(true);
    mockFetchers.getPaidAtDate.mockReturnValue(null);

    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([]);

    mockInventoryCogs.computeCogsTotal.mockResolvedValue(100);
    mockInventoryCogs.computeInventorySeedAndShrinkageTotals.mockResolvedValue({
      seedTotal: 500,
      shrinkageTotal: 25,
    });
  });

  it('applies inventory seed (opening equity) and shrinkage (retained earnings) alongside COGS', async () => {
    const res = await GET(
      buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{ account: string; amount: number }> = payload.data.rows;

    const byAccount = new Map(rows.map((r) => [r.account, r.amount]));

    // Stock on Hand = +seed - COGS - shrinkage
    expect(byAccount.get('Stock on Hand')).toBe(500 - 100 - 25);

    // Seed is booked against Opening Equity (credit => negative signed balance)
    expect(byAccount.get('Opening Equity')).toBe(-500);

    // COGS and shrinkage reduce equity (positive signed balances)
    expect(byAccount.get('Retained Earnings')).toBe(100 + 25);
  });
});
