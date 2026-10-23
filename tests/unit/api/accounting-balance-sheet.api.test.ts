import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { Prisma } from '@prisma/client';
import { investorPostingLines } from '@/lib/investors/accounting';

const { mockFetchers, mockPrisma, mockInventoryCogs } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchRecognizedTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchManualJournalLines: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      isWithinDateRange: vi.fn(),
    },
    mockPrisma: {
      clothingAccountingOpeningBalance: {
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      shipment: {
        findMany: vi.fn(),
      },
    },
    mockInventoryCogs: {
      computeCogsTotal: vi.fn(),
      buildInventorySeedAndShrinkageEntries: vi.fn(),
    },
  };
});

vi.mock('@/lib/accounting/data-fetchers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    fetchRecognizedTransactions: mockFetchers.fetchRecognizedTransactions,
    fetchTransactionPayments: mockFetchers.fetchTransactionPayments,
    fetchApprovedExpenses: mockFetchers.fetchApprovedExpenses,
    fetchManualJournalLines: mockFetchers.fetchManualJournalLines,
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
    buildInventorySeedAndShrinkageEntries:
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries,
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
    mockFetchers.fetchTransactionPayments.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchManualJournalLines.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);

    // Date helpers: route uses isWithinDateRange for various flows; keep it permissive.
    mockFetchers.isWithinDateRange.mockReturnValue(true);
    mockFetchers.getPaidAtDate.mockReturnValue(null);

    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.shipment.findMany.mockResolvedValue([]);

    mockInventoryCogs.computeCogsTotal.mockResolvedValue(100);
    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      seedTotal: 500,
      shrinkageTotal: 25,
      entries: [
        {
          id: 'seed-inventory',
          date: '2026-01-01T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-01 TEST',
          account: 'Stock on Hand',
          debit: 500,
          credit: 0,
          description: 'Inventory seeded (inventory movements) • TEST',
        },
        {
          id: 'seed-equity',
          date: '2026-01-01T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-01 TEST',
          account: 'Opening Equity',
          debit: 0,
          credit: 500,
          description: 'Inventory seeded (inventory movements) • TEST • Offset',
        },
        {
          id: 'shrink-retained',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SHRINK-2026-01-02 TEST',
          account: 'Retained Earnings',
          debit: 25,
          credit: 0,
          description: 'Inventory shrinkage (inventory movements) • TEST',
        },
        {
          id: 'shrink-inventory',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SHRINK-2026-01-02 TEST',
          account: 'Stock on Hand',
          debit: 0,
          credit: 25,
          description: 'Inventory shrinkage (inventory movements) • TEST',
        },
      ],
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

  it('reflects investor funding, monthly returns and principal repayment without losing balance', async () => {
    mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [],
      seedTotal: 0,
      shrinkageTotal: 0,
    });
    const input = {
      agreementId: 'investor-agreement',
      reference: 'CR-001',
      sourceId: 'investor-agreement',
      date: '2026-04-28',
      cutover: new Date('2026-01-17T00:00:00Z'),
      amount: new Prisma.Decimal('1000000'),
    };
    const funding = investorPostingLines({ ...input, kind: 'funding' });
    const returns = investorPostingLines({
      ...input,
      kind: 'return',
      sourceId: 'payment',
      amount: new Prisma.Decimal('50000'),
    });
    const repayment = investorPostingLines({ ...input, kind: 'repayment' });
    for (const scenario of [
      { lines: funding, cash: 1000000, liability: -1000000, retained: 0 },
      {
        lines: [...funding, ...returns],
        cash: 950000,
        liability: -1000000,
        retained: 50000,
      },
      {
        lines: [...funding, ...returns, ...repayment],
        cash: -50000,
        liability: 0,
        retained: 50000,
      },
    ]) {
      mockFetchers.fetchManualJournalLines.mockResolvedValue(scenario.lines);
      const response = await GET(
        buildRequest('/api/accounting/balance-sheet?asOf=2026-04-30')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const rows = payload.data.rows as Array<{
        account: string;
        amount: number;
      }>;
      const amount = (account: string) =>
        rows.find((row) => row.account === account)?.amount ?? 0;
      expect(amount('Cash')).toBe(scenario.cash);
      expect(amount('Loan Payable - Investor investor-agreement')).toBe(
        scenario.liability
      );
      expect(amount('Retained Earnings')).toBe(scenario.retained);
      expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(0);
    }
  });

  it('includes Cash details breakdown when available', async () => {
    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([
      {
        id: 'OB-1',
        date: new Date('2026-01-01T00:00:00.000Z'),
        ref: 'OB-1',
        account: 'Cash',
        debit: 100,
        credit: 0,
        description: 'Initial cash',
      },
    ]);

    mockFetchers.fetchApprovedExpenses.mockResolvedValue([
      {
        id: 10,
        date: '2026-01-11',
        status: 'Paid',
        paymentMethod: 'Cash',
        category: 'Rent',
        amount: 25,
        description: 'Rent',
        notes: null,
      },
    ]);

    const res = await GET(
      buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{
      account: string;
      details?: Array<{ label: string; amount: number }>;
    }> = payload.data.rows;

    const cashRow = rows.find((r) => r.account === 'Cash');
    expect(cashRow).toBeTruthy();
    expect(cashRow?.details?.length ?? 0).toBeGreaterThan(0);

    expect(cashRow?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('Opening Balance'),
          amount: 100,
        }),
        expect.objectContaining({
          label: 'Expenses – Rent',
          amount: -25,
        }),
      ])
    );
  });

  it('treats reservation payments as Customer Deposits (liability) for open orders', async () => {
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-10',
        amount: 250,
        method: 'Cash',
        notes: null,
        isReservation: true,
        transaction: {
          id: 123,
          customers: 'Alice',
          productCode: 'P-1',
          orderStatus: 'Reserved',
        },
      },
    ]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 123,
        orderStatus: 'Reserved',
        updatedAt: new Date('2026-01-10T00:00:00.000Z'),
        statusChanges: [],
      },
    ]);

    const res = await GET(
      buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const rows: Array<{ account: string; amount: number }> = payload.data.rows;
    const byAccount = new Map(rows.map((r) => [r.account, r.amount]));

    expect(byAccount.get('Customer Deposits')).toBe(-250);
    // Cash should include the deposit.
    expect(byAccount.get('Cash')).toBe(250);
  });
});
