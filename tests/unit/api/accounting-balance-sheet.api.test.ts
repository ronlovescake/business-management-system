import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'test-admin', role: 'ADMIN' })),
}));
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { Prisma } from '@prisma/client';
import { investorPostingLines } from '@/lib/investors/accounting';
import { buildCancellationJournalAmounts } from '@/lib/accounting/customer-money';

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

  it.each([
    {
      asOf: '2026-01-21',
      orderStatus: 'Accounts Receivable',
      recognized: false,
    },
    {
      asOf: '2026-01-23',
      orderStatus: 'Accounts Receivable',
      recognized: true,
    },
    { asOf: '2026-01-21', orderStatus: 'Shipped', recognized: false },
    { asOf: '2026-01-23', orderStatus: 'Shipped', recognized: true },
  ])(
    'respects shipment and payment history at an earlier cutoff: %j',
    async ({ asOf, orderStatus, recognized }) => {
      mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue(
        { entries: [], seedTotal: 0, shrinkageTotal: 0 }
      );
      mockFetchers.isWithinDateRange.mockImplementation((date, from, to) =>
        Boolean(date && (!from || date >= from) && (!to || date <= to))
      );
      mockFetchers.getPaidAtDate.mockReturnValue(new Date('2026-01-24'));
      const order = {
        id: 1,
        quantity: 1,
        unitPrice: 1000,
        adjustment: 400,
        lineTotal: 600,
        orderDate: '2026-01-20',
        orderStatus,
        shippedAt: new Date('2026-01-22'),
      };
      mockFetchers.fetchRecognizedTransactions.mockResolvedValue([order]);
      mockFetchers.fetchTransactionPayments.mockResolvedValue([
        {
          id: 1,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 100,
          method: 'Cash',
          isReservation: true,
          transaction: order,
        },
        {
          id: 2,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 300,
          method: 'Cash',
          isReservation: false,
          transaction: order,
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        { ...order, statusChanges: [] },
      ]);
      const response = await GET(
        buildRequest(`/api/accounting/balance-sheet?asOf=${asOf}`)
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const amount = (account: string) =>
        (payload.data.rows as Array<{ account: string; amount: number }>).find(
          (row) => row.account === account
        )?.amount ?? 0;
      expect(amount('Cash')).toBe(400);
      expect(amount('Customer Deposits')).toBe(recognized ? 0 : -100);
      expect(amount('Accounts Receivable')).toBe(recognized ? 600 : 0);
      expect(amount('Retained Earnings')).toBe(recognized ? -1000 : -300);
      expect(payload.data.stats.balance).toBe(0);
    }
  );

  it.each(['Cancelled', 'Forfeited'])(
    'keeps a historical %s card deposit outside Cash',
    async (orderStatus) => {
      mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue(
        { entries: [], seedTotal: 0, shrinkageTotal: 0 }
      );
      const order = {
        id: 1,
        quantity: 1,
        unitPrice: 1000,
        orderStatus,
        updatedAt: new Date('2026-01-22'),
        statusChanges: [],
      };
      mockFetchers.fetchTransactionPayments.mockResolvedValue([
        {
          id: 1,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 100,
          method: 'CARD',
          isReservation: true,
          transaction: order,
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([order]);
      const response = await GET(
        buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const amount = (account: string) =>
        (payload.data.rows as Array<{ account: string; amount: number }>).find(
          (row) => row.account === account
        )?.amount ?? 0;
      expect(amount('Cash')).toBe(0);
      expect(amount('Card Collections Clearing')).toBe(100);
      expect(amount('Retained Earnings')).toBe(-100);
      expect(payload.data.stats.balance).toBe(0);
    }
  );

  it.each([
    { isReservation: false, settled: false },
    { isReservation: true, settled: false },
    { isReservation: false, settled: true },
  ])(
    'separates card receipts from actual cash for %j',
    async ({ isReservation, settled }) => {
      mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue(
        { entries: [], seedTotal: 0, shrinkageTotal: 0 }
      );
      const order = {
        id: 1,
        quantity: 1,
        unitPrice: 1000,
        adjustment: 1000,
        lineTotal: 0,
        orderDate: '2026-01-20',
        orderStatus: 'Prepared',
      };
      mockFetchers.fetchRecognizedTransactions.mockResolvedValue([order]);
      mockFetchers.fetchTransactionPayments.mockResolvedValue([
        {
          id: 1,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 1000,
          method: 'CARD',
          isReservation,
          transaction: order,
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        { ...order, statusChanges: [] },
      ]);
      if (settled) {
        mockFetchers.fetchManualJournalLines.mockResolvedValue([
          {
            account: 'Cash',
            debit: 970,
            credit: 0,
            ref: 'CARD-SETTLEMENT',
            date: new Date('2026-01-21'),
          },
          {
            account: 'Card Processing Fees',
            debit: 30,
            credit: 0,
            ref: 'CARD-SETTLEMENT',
            date: new Date('2026-01-21'),
          },
          {
            account: 'Card Collections Clearing',
            debit: 0,
            credit: 1000,
            ref: 'CARD-SETTLEMENT',
            date: new Date('2026-01-21'),
          },
        ]);
      }
      const response = await GET(
        buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const rows = payload.data.rows as Array<{
        account: string;
        amount: number;
      }>;
      const amount = (account: string) =>
        rows.find((row) => row.account === account)?.amount ?? 0;
      expect(amount('Cash')).toBe(settled ? 970 : 0);
      expect(amount('Card Collections Clearing')).toBe(settled ? 0 : 1000);
      expect(amount('Credit Card Payable')).toBe(0);
      expect(payload.data.stats.balance).toBe(0);
    }
  );

  it.each(['Prepared', 'Accounts Receivable'])(
    'preserves receipts and clears duplicated deposits/debt after approved cancellation from %s',
    async (orderStatus) => {
      mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue(
        { entries: [], seedTotal: 0, shrinkageTotal: 0 }
      );
      const hasReceivable = orderStatus === 'Accounts Receivable';
      const order = {
        id: 1,
        customers: 'Customer',
        productCode: 'SKU',
        orderDate: '2026-01-20',
        orderStatus,
        shippedAt: hasReceivable ? new Date('2026-01-20') : null,
        quantity: 1,
        unitPrice: 1000,
        adjustment: 400,
        lineTotal: 0,
      };
      mockFetchers.fetchRecognizedTransactions.mockResolvedValue([order]);
      mockFetchers.fetchTransactionPayments.mockResolvedValue([
        {
          id: 1,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 100,
          isReservation: true,
          transaction: order,
        },
        {
          id: 2,
          transactionId: 1,
          paymentDate: '2026-01-20',
          amount: 300,
          isReservation: false,
          transaction: order,
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          ...order,
          orderStatus: 'Cancelled',
          cancellation: { previousStatus: orderStatus },
          statusChanges: [],
        },
      ]);
      mockFetchers.fetchManualJournalLines.mockResolvedValue(
        buildCancellationJournalAmounts({
          collectedAmount: 400,
          priorRefundAmount: 0,
          openDepositLiability: hasReceivable ? 0 : 100,
          receivableCreditAmount: hasReceivable ? 600 : 0,
          retainedAmount: 100,
          approvedRefundAmount: 300,
        }).map((line) => ({
          ...line,
          id: line.sourceLineKey,
          date: new Date('2026-01-21T00:00:00Z'),
          ref: 'TX-1',
        }))
      );
      mockFetchers.fetchTransactionRefunds.mockResolvedValue([
        {
          id: 3,
          transactionId: 1,
          refundDate: '2026-01-22',
          amount: 100,
          transaction: order,
          approvedPayout: { id: 'payout', cancellationId: 'approval' },
        },
      ]);
      const response = await GET(
        buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const rows = payload.data.rows as Array<{
        account: string;
        amount: number;
      }>;
      const amount = (account: string) =>
        rows.find((row) => row.account === account)?.amount ?? 0;
      expect(amount('Cash')).toBe(300);
      expect(amount('Refunds Payable')).toBe(-200);
      expect(amount('Customer Deposits')).toBe(0);
      expect(amount('Accounts Receivable')).toBe(0);
      expect(amount('Retained Earnings')).toBe(-100);
      expect(payload.data.stats.balance).toBe(0);
    }
  );

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

  it.each([100, 0, -75])(
    'preserves signed net COGS of %s in stock, equity, and stock details',
    async (cogsTotal) => {
      mockInventoryCogs.computeCogsTotal.mockResolvedValue(cogsTotal);
      mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue(
        {
          seedTotal: 0,
          shrinkageTotal: 0,
          entries: [],
        }
      );

      const response = await GET(
        buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
      );
      expect(response.status).toBe(200);
      const payload = await response.json();
      const rows = payload.data.rows as Array<{
        account: string;
        amount: number;
        details?: Array<{ label: string; amount: number }>;
      }>;
      const stock = rows.find((row) => row.account === 'Stock on Hand');
      const retained = rows.find((row) => row.account === 'Retained Earnings');

      expect(stock?.amount ?? 0).toBe(cogsTotal === 0 ? 0 : -cogsTotal);
      expect(retained?.amount ?? 0).toBe(cogsTotal);
      expect(rows.reduce((total, row) => total + row.amount, 0)).toBe(0);
      if (cogsTotal !== 0) {
        expect(stock?.details).toContainEqual({
          label: 'COGS (inventory movements)',
          amount: -cogsTotal,
        });
      }
    }
  );

  it('clears a fully refunded voided reservation deposit from the balance sheet', async () => {
    mockInventoryCogs.computeCogsTotal.mockResolvedValue(0);
    mockInventoryCogs.buildInventorySeedAndShrinkageEntries.mockResolvedValue({
      seedTotal: 0,
      shrinkageTotal: 0,
      entries: [],
    });
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 45,
        transactionId: 44,
        paymentDate: '2026-01-20',
        amount: 30,
        method: 'Cash',
        isReservation: true,
        transaction: {
          id: 44,
          customers: 'Customer Void',
          productCode: 'SKU-44',
          orderDate: '2026-01-18',
          orderStatus: 'Voided',
        },
      },
    ]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([
      {
        id: 99,
        transactionId: 44,
        refundDate: '2026-01-21',
        amount: 30,
        reason: 'Supplier unavailable',
        notes: null,
        createdAt: new Date('2026-01-21T00:00:00.000Z'),
        transaction: {
          id: 44,
          customers: 'Customer Void',
          productCode: 'SKU-44',
          orderStatus: 'Voided',
          payments: [{ amount: 30 }],
        },
      },
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 44,
        orderStatus: 'Voided',
        updatedAt: new Date('2026-01-21T00:00:00.000Z'),
        statusChanges: [],
      },
    ]);

    const response = await GET(
      buildRequest('/api/accounting/balance-sheet?asOf=2026-01-31')
    );
    const payload = await response.json();
    const rows = payload.data.rows as Array<{
      account: string;
      amount: number;
    }>;
    const amount = (account: string) =>
      rows.find((row) => row.account === account)?.amount ?? 0;

    expect(amount('Cash')).toBe(0);
    expect(amount('Customer Deposits')).toBe(0);
    expect(amount('Retained Earnings')).toBe(0);
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
