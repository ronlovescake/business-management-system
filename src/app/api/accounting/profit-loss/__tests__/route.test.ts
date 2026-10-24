import { describe, expect, it, beforeEach, vi } from 'vitest';
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'test-admin', role: 'ADMIN' })),
}));
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

// Freeze cutover for test determinism.
vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: () => new Date('2026-01-17T00:00:00.000Z'),
  getRuntimeAccountingCutoverDate: async () =>
    new Date('2026-01-17T00:00:00.000Z'),
}));

vi.mock('@/lib/accounting/inventory-cogs', () => ({
  computeCogsTotal: vi.fn().mockResolvedValue(0),
  buildCogsAndInventoryEntries: vi.fn().mockResolvedValue({ entries: [] }),
  buildInventorySeedAndShrinkageEntries: vi
    .fn()
    .mockResolvedValue({ entries: [], seedTotal: 0, shrinkageTotal: 0 }),
  computeInventorySeedAndShrinkageTotals: vi
    .fn()
    .mockResolvedValue({ seedTotal: 0, shrinkageTotal: 0 }),
}));

const mockFetchers = vi.hoisted(() => ({
  fetchAccountsReceivableTransactions: vi.fn(),
  fetchPaidTransactions: vi.fn(),
  fetchApprovedExpenses: vi.fn(),
  fetchInvestorReturnExpenses: vi.fn(),
  fetchTransactionRefunds: vi.fn(),
  fetchTransactionPayments: vi.fn(),
  getPaidAtDate: vi.fn(),
  getCancelledAtDate: vi.fn(),
  isWithinDateRange: vi.fn(),
}));

vi.mock('@/lib/accounting/data-fetchers', () => mockFetchers);

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

function within(date: Date | null, from: Date | null, to: Date | null) {
  if (!date) {
    return false;
  }
  if (from && date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

describe('GET /api/accounting/profit-loss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchers.isWithinDateRange.mockImplementation(within);
    mockFetchers.fetchAccountsReceivableTransactions.mockResolvedValue([]);
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchInvestorReturnExpenses.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([]);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
  });

  it('includes post-cutover payments in Sales Revenue regardless of orderDate', async () => {
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 10,
        paymentDate: '2026-01-20',
        amount: 1000,
        method: 'Cash',
        notes: 'Late payment for legacy order',
        isReservation: false,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        transaction: {
          id: 10,
          customers: 'Customer A',
          productCode: 'SKU-10',
          orderDate: '2026-01-10',
          orderStatus: 'Paid',
        },
      },
    ]);

    const { GET } = await import('@/app/api/accounting/profit-loss/route');

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const sales = (
      body.data.rows as Array<{ category: string; amount: number }>
    ).find((row) => row.category === 'Sales Revenue');

    expect(sales?.amount).toBe(1000);
    expect(body.data.stats.revenueTotal).toBe(1000);
  });

  it('does not report a voided reservation refund as Sales Returns', async () => {
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([
      {
        id: 99,
        transactionId: 44,
        refundDate: '2026-01-20',
        amount: 30,
        reason: 'Supplier unavailable',
        notes: null,
        createdAt: new Date('2026-01-20T00:00:00.000Z'),
        transaction: {
          id: 44,
          customers: 'Customer Void',
          productCode: 'SKU-44',
          orderStatus: 'Voided',
          payments: [{ amount: 30 }],
        },
      },
    ]);

    const { GET } = await import('@/app/api/accounting/profit-loss/route');
    const { GET: details } = await import(
      '@/app/api/accounting/profit-loss/details/route'
    );
    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();
    const detailBody = await (await details(request)).json();

    expect(body.data.stats.revenueTotal).toBe(0);
    expect(
      (body.data.rows as Array<{ category: string }>).some(
        (row) => row.category === 'Sales Returns'
      )
    ).toBe(false);
    expect(
      (detailBody.data.rows as Array<{ sourceId?: string }>).some(
        (row) => row.sourceId === '99'
      )
    ).toBe(false);
  });

  it('recognizes A/R revenue at shipment and excludes later collections from revenue', async () => {
    const shippedAt = new Date('2026-01-19T12:00:00.000Z');
    const statusChanges = [
      { newStatus: 'Accounts Receivable', changedAt: shippedAt },
    ];
    const receivableTransaction = {
      id: 20,
      quantity: 2,
      unitPrice: 100,
      adjustment: 50,
      lineTotal: 150,
      orderStatus: 'Accounts Receivable',
      shippedAt,
      customers: 'Customer B',
      productCode: 'SKU-20',
      statusChanges,
    };
    mockFetchers.fetchAccountsReceivableTransactions.mockResolvedValue([
      receivableTransaction,
    ]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 2,
        transactionId: 20,
        paymentDate: '2026-01-21',
        amount: 50,
        method: 'Cash',
        notes: 'Partial collection',
        isReservation: false,
        createdAt: new Date('2026-01-21T00:00:00.000Z'),
        transaction: {
          id: 20,
          customers: 'Customer B',
          productCode: 'SKU-20',
          orderDate: '2026-01-10',
          orderStatus: 'Accounts Receivable',
          shippedAt,
          statusChanges,
        },
      },
    ]);

    const { GET } = await import('@/app/api/accounting/profit-loss/route');
    const { GET: details } = await import(
      '@/app/api/accounting/profit-loss/details/route'
    );
    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();
    const detailBody = await (await details(request)).json();

    expect(body.data.stats.revenueTotal).toBe(200);
    expect(
      (body.data.rows as Array<{ category: string; amount: number }>).find(
        (row) => row.category === 'Sales Revenue'
      )?.amount
    ).toBe(200);
    expect(detailBody.data.rows).toEqual([
      expect.objectContaining({
        sourceType: 'AccountsReceivableShipment',
        amount: 200,
      }),
    ]);
  });

  it('includes investor returns in net profit and expense details, not revenue', async () => {
    mockFetchers.fetchInvestorReturnExpenses.mockResolvedValue([
      {
        id: 'journal-1',
        date: new Date('2026-04-28T00:00:00Z'),
        ref: 'INV-001',
        account: 'Investor Return Expense',
        debit: 50000,
        credit: 0,
        description: 'Investor return',
        sourceType: 'INVESTOR_RETURN',
        sourceId: 'payment-1',
      },
    ]);
    const { GET } = await import('@/app/api/accounting/profit-loss/route');
    const { GET: details } = await import(
      '@/app/api/accounting/profit-loss/details/route'
    );
    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/accounting/profit-loss?from=2026-04-01&to=2026-04-30'
      ),
    });
    const response = await GET(request);
    const body = await response.json();
    expect(body.data.stats.revenueTotal).toBe(0);
    expect(body.data.stats.expenseTotal).toBe(50000);
    expect(body.data.stats.netProfit).toBe(-50000);
    const detailBody = await (await details(request)).json();
    expect(detailBody.data.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'payment-1',
          category: 'Investor Return Expense',
          amount: 50000,
        }),
      ])
    );
  });
});
