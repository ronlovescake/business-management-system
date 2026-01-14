import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockFetchers, mockPrisma, mockInventoryCogs } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchPaidTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      isWithinDateRange: vi.fn(),
    },
    mockPrisma: {
      clothingAccountingOpeningBalance: {
        findMany: vi.fn(),
      },
      clothingInventoryReclassEntry: {
        findMany: vi.fn(),
      },
      clothingInventoryTransitBuildEntry: {
        findMany: vi.fn(),
      },
    },
    mockInventoryCogs: {
      buildCogsAndInventoryEntries: vi.fn(),
      buildInventorySeedAndShrinkageEntries: vi.fn(),
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
    buildCogsAndInventoryEntries:
      mockInventoryCogs.buildCogsAndInventoryEntries,
    buildInventorySeedAndShrinkageEntries:
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries,
  };
});

import { GET } from '@/app/api/accounting/ledger/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Accounting Ledger API - GET /api/accounting/ledger', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);

    // Ledger route checks date range for each entry.
    mockFetchers.isWithinDateRange.mockReturnValue(true);
    mockFetchers.getPaidAtDate.mockReturnValue(null);

    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    mockInventoryCogs.buildCogsAndInventoryEntries.mockResolvedValue({
      entries: [],
      totalCogs: 0,
    });

    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [
        {
          id: 'INV-SEED-2026-01-02-inventory-debit',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-02',
          account: 'Stock on Hand',
          debit: 100,
          credit: 0,
          description: 'seed',
        },
        {
          id: 'INV-SEED-2026-01-02-opening-equity-credit',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-02',
          account: 'Opening Equity',
          debit: 0,
          credit: 100,
          description: 'seed offset',
        },
        {
          id: 'INV-SHRINK-2026-01-03-retained-earnings-debit',
          date: '2026-01-03T00:00:00.000Z',
          ref: 'INV-SHRINK-2026-01-03',
          account: 'Retained Earnings',
          debit: 20,
          credit: 0,
          description: 'shrinkage',
        },
        {
          id: 'INV-SHRINK-2026-01-03-inventory-credit',
          date: '2026-01-03T00:00:00.000Z',
          ref: 'INV-SHRINK-2026-01-03',
          account: 'Stock on Hand',
          debit: 0,
          credit: 20,
          description: 'inventory reduction',
        },
      ],
      seedTotal: 100,
      shrinkageTotal: 20,
    });
  });

  it('includes derived seed/shrinkage entries and computes running balances', async () => {
    const res = await GET(
      buildRequest('/api/accounting/ledger?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const entries: Array<{ id: string; account: string; balance: number }> =
      payload.data.entries;

    expect(
      entries.some((e) => e.id === 'INV-SEED-2026-01-02-inventory-debit')
    ).toBe(true);
    expect(
      entries.some((e) => e.id === 'INV-SHRINK-2026-01-03-inventory-credit')
    ).toBe(true);

    const stockBalances = entries
      .filter((e) => e.account === 'Stock on Hand')
      .map((e) => e.balance);

    // Seed increases inventory to 100, then shrinkage reduces it to 80.
    expect(stockBalances[stockBalances.length - 1]).toBe(80);
  });
});
