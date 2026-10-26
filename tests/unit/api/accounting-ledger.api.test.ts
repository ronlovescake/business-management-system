import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'test-admin', role: 'ADMIN' })),
}));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: vi.fn(
    async () => new Date('2026-01-01T00:00:00Z')
  ),
}));
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { Prisma } from '@prisma/client';
import { investorPostingLines } from '@/lib/investors/accounting';
import { filterAndSortLedgerEntries } from '@/app/clothing/accounting/ledger/hooks/ledgerDerivedData';
import { buildLedgerPeriod } from '@/lib/accounting/ledger-balances';
import { exportLedgerCsv } from '@/app/clothing/accounting/ledger/hooks/ledgerCsvHandlers';
import { downloadCsvFile } from '@/lib/accounting/csv';

vi.mock('@/lib/accounting/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/accounting/csv')>()),
  downloadCsvFile: vi.fn(),
}));

const { mockFetchers, mockPrisma, mockInventoryCogs } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchPaidTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchManualJournalLines: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      getCancelledAtDate: vi.fn(),
      isWithinDateRange: vi.fn(),
    },
    mockPrisma: {
      product: {
        findMany: vi.fn(),
      },
      shipment: {
        findMany: vi.fn(),
      },
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
    fetchManualJournalLines: mockFetchers.fetchManualJournalLines,
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
  it('exports the displayed search-stable balance rather than filtered net movement', () => {
    const entries = filterAndSortLedgerEntries(
      [
        {
          id: 'receipt',
          date: '2026-02-02',
          ref: 'RECEIPT',
          account: 'Cash',
          debit: 10,
          credit: 0,
          description: 'Receipt',
          balance: 90,
        },
      ],
      'RECEIPT',
      'Cash'
    );
    exportLedgerCsv({ entries });
    const csv = vi.mocked(downloadCsvFile).mock.calls[0]?.[1];
    expect(csv).toContain('Credit,Balance,Description');
    expect(csv).toContain(',90.00,');
  });

  it('returns period activity with its earlier balance through the real route', async () => {
    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [],
      seedTotal: 0,
      shrinkageTotal: 0,
    });
    mockFetchers.fetchManualJournalLines.mockResolvedValue([
      {
        id: 'opening',
        date: new Date('2026-01-18'),
        ref: 'OLD',
        account: 'Cash',
        debit: 40,
        credit: 0,
        description: 'Earlier collection',
      },
      {
        id: 'receipt',
        date: new Date('2026-02-05'),
        ref: 'NEW',
        account: 'Cash',
        debit: 60,
        credit: 0,
        description: 'Current collection',
      },
    ]);
    const response = await GET(
      buildRequest('/api/accounting/ledger?from=2026-02-01&to=2026-02-28')
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.entries).toHaveLength(1);
    expect(payload.data.entries[0]).toMatchObject({ balance: 100, debit: 60 });
    expect(payload.data.openingBalances.Cash).toBe(40);
    expect(payload.data.closingBalances.Cash).toBe(100);
    expect(payload.data.stats.totalDebits).toBe(60);
  });

  it('brings forward earlier money without inflating selected-period movements', () => {
    const result = buildLedgerPeriod(
      [
        { date: '2026-01-18', account: 'Cash', debit: 40, credit: 0 },
        { date: '2026-01-18', account: 'Opening Equity', debit: 0, credit: 40 },
        { date: '2026-02-05', account: 'Cash', debit: 60, credit: 0 },
        { date: '2026-02-05', account: 'Sales Revenue', debit: 0, credit: 60 },
        { date: '2026-03-05', account: 'Cash', debit: 900, credit: 0 },
      ],
      new Date('2026-02-01'),
      new Date('2026-02-28T23:59:59Z')
    );
    expect(result.openingBalances).toEqual({ Cash: 40, 'Opening Equity': -40 });
    expect(result.closingBalances.Cash).toBe(100);
    expect(
      result.entries.find((entry) => entry.account === 'Cash')?.balance
    ).toBe(100);
    expect(result.entries).toHaveLength(2);
    expect(result.totalDebits).toBe(60);
    expect(result.totalCredits).toBe(60);
  });

  it('does not introduce floating-point cents in account balances', () => {
    const result = buildLedgerPeriod(
      [
        { date: '2026-01-18', account: 'Cash', debit: 0.1, credit: 0 },
        { date: '2026-01-19', account: 'Cash', debit: 0.2, credit: 0 },
      ],
      new Date('2026-01-01'),
      null
    );
    expect(result.entries[1]?.balance).toBe(0.3);
    expect(result.totalDebits).toBe(0.3);
  });

  it('keeps account balances unchanged when text search hides earlier activity', () => {
    const rows = [
      {
        date: '2026-01-01',
        ref: 'OPEN',
        account: 'Cash',
        debit: 100,
        credit: 0,
        description: 'Opening',
      },
      {
        date: '2026-02-01',
        ref: 'EXPENSE',
        account: 'Cash',
        debit: 0,
        credit: 20,
        description: 'Expense',
      },
      {
        date: '2026-02-02',
        ref: 'RECEIPT',
        account: 'Cash',
        debit: 10,
        credit: 0,
        description: 'Receipt',
      },
    ];
    expect(
      filterAndSortLedgerEntries(rows, 'RECEIPT', 'Cash')[0]?.balance
    ).toBe(90);
    expect(filterAndSortLedgerEntries(rows, '', 'Cash')[0]?.balance).toBe(90);
  });

  it('preserves a server balance that already includes earlier periods', () => {
    const rows = [
      {
        date: '2026-02-02',
        ref: 'RECEIPT',
        account: 'Cash',
        debit: 10,
        credit: 0,
        description: 'Receipt',
        balance: 90,
      },
    ];
    expect(
      filterAndSortLedgerEntries(rows, 'RECEIPT', 'Cash')[0]?.balance
    ).toBe(90);
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchManualJournalLines.mockResolvedValue([]);
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

    // Ledger route may apply a post-cutover Inventory in Transit snapshot adjustment
    // which requires these models even when returning empty data.
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.shipment.findMany.mockResolvedValue([]);

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

  it.each([0, -1, Number.NaN, 50])(
    'uses only posting payments of %s to replace a legacy paid sale',
    async (amount) => {
      mockFetchers.fetchPaidTransactions.mockResolvedValue([
        {
          id: 1,
          quantity: 1,
          unitPrice: 100,
          adjustment: 100,
          orderDate: '2026-01-20',
        },
      ]);
      mockFetchers.getPaidAtDate.mockReturnValue(new Date('2026-01-20'));
      mockFetchers.fetchTransactionPayments.mockResolvedValue([
        {
          id: 10,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount,
          transaction: {},
        },
      ]);
      const response = await GET(
        buildRequest('/api/accounting/ledger?from=2026-01-01&to=2026-01-31')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const entries = payload.data.entries as Array<{
        account: string;
        debit: number;
        credit: number;
      }>;
      const expectedRevenue = amount > 0 ? amount : 100;
      expect(
        entries
          .filter((entry) => entry.account === 'Cash')
          .reduce((total, entry) => total + entry.debit - entry.credit, 0)
      ).toBe(expectedRevenue);
      expect(
        entries
          .filter((entry) => entry.account === 'Sales Revenue')
          .reduce((total, entry) => total + entry.credit - entry.debit, 0)
      ).toBe(expectedRevenue);
    }
  );

  it('tracks investor cash, return expense and cleared principal balances', async () => {
    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [],
      seedTotal: 0,
      shrinkageTotal: 0,
    });
    const lines = (['funding', 'return', 'repayment'] as const).flatMap(
      (kind, index) =>
        investorPostingLines({
          kind,
          agreementId: 'agreement',
          reference: 'CR-001',
          sourceId: kind === 'return' ? 'payment' : 'agreement',
          amount: new Prisma.Decimal(kind === 'return' ? '50000' : '1000000'),
          date: `2026-04-${20 + index}`,
          cutover: new Date('2026-01-17T00:00:00Z'),
        }).map((line) => ({ ...line, id: `${kind}-${line.sourceLineKey}` }))
    );
    mockFetchers.fetchManualJournalLines.mockResolvedValue(lines);
    const response = await GET(
      buildRequest('/api/accounting/ledger?from=2026-04-01&to=2026-04-30')
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    const entries = payload.data.entries as Array<{
      account: string;
      balance: number;
    }>;
    const balances = (account: string) =>
      entries
        .filter((entry) => entry.account === account)
        .map((entry) => entry.balance);
    expect(entries).toHaveLength(6);
    expect(balances('Cash')).toEqual([1000000, 950000, -50000]);
    expect(balances('Loan Payable - Investor agreement')).toEqual([
      -1000000, 0,
    ]);
    expect(balances('Investor Return Expense')).toEqual([50000]);
    expect(payload.data.stats.netChange).toBe(0);
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

  it('debits the recorded payment account for A/R collections', async () => {
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 44,
        transactionId: 44,
        paymentDate: '2026-01-22',
        amount: 75,
        method: 'Bank Transfer',
        notes: null,
        isReservation: false,
        transaction: {
          id: 44,
          productCode: 'AR-44',
          customers: 'Customer A',
          orderDate: '2026-01-20',
          orderStatus: 'Accounts Receivable',
          shippedAt: new Date('2026-01-20T00:00:00.000Z'),
          statusChanges: [],
        },
      },
    ]);

    const response = await GET(
      buildRequest('/api/accounting/ledger?from=2026-01-01&to=2026-01-31')
    );
    const payload = await response.json();
    const entries = payload.data.entries as Array<{
      id: string;
      account: string;
      debit: number;
      credit: number;
    }>;

    expect(response.status).toBe(200);
    expect(entries).toContainEqual(
      expect.objectContaining({
        id: 'PM-44-cash',
        account: 'Bank',
        debit: 75,
        credit: 0,
      })
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        id: 'PM-44-receivable',
        account: 'Accounts Receivable',
        debit: 0,
        credit: 75,
      })
    );
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

  it('labels a voided reservation refund clearly in the ledger', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 45,
        transactionId: 44,
        paymentDate: '2026-10-24',
        amount: 163.5,
        method: 'Cash',
        isReservation: true,
        transaction: {
          id: 44,
          productCode: 'OD-020726',
          customers: 'Shiela Marie Hambleton | Daisy Ella',
          orderStatus: 'Voided',
          orderDate: '2026-10-20',
        },
      },
    ]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([
      {
        id: 99,
        transactionId: 44,
        refundDate: '2026-10-24',
        amount: 163.5,
        reason: 'Supplier unavailable',
        notes: 'Refunded after void',
        createdAt: new Date('2026-10-24T00:00:00.000Z'),
        transaction: {
          id: 44,
          customers: 'Shiela Marie Hambleton | Daisy Ella',
          productCode: 'OD-020726',
          orderStatus: 'Voided',
          payments: [{ amount: 163.5 }],
        },
      },
    ]);

    const response = await GET(
      buildRequest('/api/accounting/ledger?from=2026-10-01&to=2026-10-31')
    );
    const payload = await response.json();
    const entries = payload.data.entries as Array<{
      id: string;
      ref: string;
      account: string;
      debit: number;
      credit: number;
      description: string;
    }>;
    const debit = entries.find((entry) => entry.id === 'RF-99-refund-debit');
    const credit = entries.find((entry) => entry.id === 'RF-99-cash');

    expect(debit).toMatchObject({
      ref: 'VOID-REFUND-TX-44',
      account: 'Customer Deposits',
      debit: 163.5,
      description: expect.stringContaining(
        'Voided reservation refund • Shiela Marie Hambleton | Daisy Ella • TX-44'
      ),
    });
    expect(credit).toMatchObject({
      ref: 'VOID-REFUND-TX-44',
      account: 'Cash',
      credit: 163.5,
      description: debit?.description,
    });
  });
});
