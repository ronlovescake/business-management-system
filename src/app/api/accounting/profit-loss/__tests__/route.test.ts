import { describe, expect, it, beforeEach, vi } from 'vitest';
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
  computeInventorySeedAndShrinkageTotals: vi
    .fn()
    .mockResolvedValue({ seedTotal: 0, shrinkageTotal: 0 }),
}));

const mockFetchers = vi.hoisted(() => ({
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
