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
      getCancelledAtDate: vi.fn(),
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
      transaction: {
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
    getCancelledAtDate: mockFetchers.getCancelledAtDate,
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
    mockFetchers.getCancelledAtDate.mockImplementation((tx: unknown) => {
      const typed = tx as {
        statusChanges?: { newStatus: string | null; changedAt: Date }[];
        updatedAt?: Date;
      };
      return typed.statusChanges?.[0]?.changedAt ?? typed.updatedAt ?? null;
    });

    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.transaction.findMany.mockResolvedValue([]);

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

  it('includes reservation payment (Customer Deposits) and reclass to Sales Revenue on paid status', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([
      {
        id: 1,
        productCode: 'P-100',
        customers: 'Alice',
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        adjustment: 100,
        lineTotal: 0,
        orderDate: '2026-01-20',
        orderStatus: 'Checked Out',
      },
    ]);

    mockFetchers.getPaidAtDate.mockReturnValue(
      new Date('2026-01-20T00:00:00.000Z')
    );

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 10,
        transactionId: 1,
        paymentDate: '2026-01-10',
        amount: 50,
        method: 'cash',
        notes: 'reservation',
        isReservation: true,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
          orderStatus: 'Checked Out',
        },
      },
    ]);

    const res = await GET(
      buildRequest('/api/accounting/ledger?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);

    const entries: Array<{
      id: string;
      account: string;
      debit: number;
      credit: number;
    }> = payload.data.entries;

    expect(entries.some((e) => e.id === 'PM-10-deposits')).toBe(true);
    expect(entries.some((e) => e.id === 'DEP-REVENUE-TX-1-debit')).toBe(true);
    expect(entries.some((e) => e.id === 'DEP-REVENUE-TX-1-credit')).toBe(true);

    const credit = entries.find((e) => e.id === 'DEP-REVENUE-TX-1-credit');
    expect(credit?.account).toBe('Sales Revenue');
    expect(credit?.credit).toBe(50);
  });

  it('reclasses reservation deposits to Forfeited Deposits when forfeited', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 11,
        transactionId: 2,
        paymentDate: '2026-01-10',
        amount: 75,
        method: 'cash',
        notes: 'reservation',
        isReservation: true,
        transaction: {
          productCode: 'P-200',
          customers: 'Bob',
          orderStatus: 'Forfeited',
        },
      },
    ]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 2,
        updatedAt: new Date('2026-01-22T00:00:00.000Z'),
        statusChanges: [
          {
            newStatus: 'Forfeited',
            changedAt: new Date('2026-01-15T00:00:00.000Z'),
          },
        ],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(
      new Date('2026-01-15T00:00:00.000Z')
    );

    const res = await GET(
      buildRequest('/api/accounting/ledger?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.success).toBe(true);

    const entries: Array<{
      id: string;
      account: string;
      debit: number;
      credit: number;
    }> = payload.data.entries;

    expect(entries.some((e) => e.id === 'DEP-FORFEIT-TX-2-credit')).toBe(true);
    const credit = entries.find((e) => e.id === 'DEP-FORFEIT-TX-2-credit');
    expect(credit?.account).toBe('Forfeited Deposits');
    expect(credit?.credit).toBe(75);
  });
});
