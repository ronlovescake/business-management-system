import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: () => new Date('2020-01-01T00:00:00.000Z'),
}));

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/accounting/general-merchandise/inventory-cogs', () => ({
  buildCogsAndInventoryEntries: vi.fn().mockResolvedValue({ entries: [] }),
  buildInventorySeedAndShrinkageEntries: vi
    .fn()
    .mockResolvedValue({ entries: [] }),
}));

const mockFetchers = vi.hoisted(() => ({
  fetchGeneralMerchandisePaidTransactions: vi.fn(),
  fetchGeneralMerchandiseApprovedExpenses: vi.fn(),
  fetchGeneralMerchandiseTransactionRefunds: vi.fn(),
  fetchGeneralMerchandiseTransactionPayments: vi.fn(),
  fetchGeneralMerchandiseManualJournalLines: vi.fn(),
  getPaidAtDate: vi.fn(),
  getCancelledAtDate: vi.fn(),
  isWithinDateRange: vi.fn(),
}));

vi.mock(
  '@/lib/accounting/general-merchandise/data-fetchers',
  () => mockFetchers
);

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

describe('GET /api/general-merchandise/accounting/journal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchers.isWithinDateRange.mockImplementation(within);
    mockFetchers.fetchGeneralMerchandiseApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchGeneralMerchandiseTransactionRefunds.mockResolvedValue(
      []
    );
    mockFetchers.fetchGeneralMerchandiseManualJournalLines.mockResolvedValue(
      []
    );
  });

  it('posts reservation fee to Customer Deposits and reclasses to Sales Revenue on completion date', async () => {
    const paymentAt = new Date('2026-01-10T00:00:00.000Z');
    const paidAt = new Date('2026-02-05T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([
      {
        id: 400,
        orderStatus: 'Paid',
        updatedAt: paidAt,
        statusChanges: [{ newStatus: 'Paid', changedAt: paidAt }],
        customers: 'Test Customer',
        productCode: 'P-400',
      },
    ]);

    mockFetchers.getPaidAtDate.mockReturnValue(paidAt);

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 400,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: paymentAt,
        transaction: {
          id: 400,
          customers: 'Test Customer',
          productCode: 'P-400',
          orderStatus: 'Paid',
        },
      },
    ]);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/journal/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/journal?from=2026-01-01&to=2026-02-28'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const entries = body.data.entries as Array<{
      date: string;
      account: string;
      debit: number;
      credit: number;
    }>;

    // Payment time: credit Customer Deposits (not Sales Revenue).
    expect(
      entries.some(
        (e) =>
          e.account === 'Customer Deposits' &&
          e.credit === 500 &&
          new Date(e.date).toISOString().startsWith('2026-01-10')
      )
    ).toBe(true);

    // Recognition time: Dr Customer Deposits / Cr Sales Revenue on paidAt.
    expect(
      entries.some(
        (e) =>
          e.account === 'Customer Deposits' &&
          e.debit === 500 &&
          new Date(e.date).toISOString() === paidAt.toISOString()
      )
    ).toBe(true);
    expect(
      entries.some(
        (e) =>
          e.account === 'Sales Revenue' &&
          e.credit === 500 &&
          new Date(e.date).toISOString() === paidAt.toISOString()
      )
    ).toBe(true);
  });

  it('reclasses reservation fee to Forfeited Deposits on cancellation date', async () => {
    const paymentAt = new Date('2026-01-10T00:00:00.000Z');
    const cancelledAt = new Date('2026-01-28T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([]);

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 2,
        transactionId: 401,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: paymentAt,
        transaction: {
          id: 401,
          customers: 'Test Customer',
          productCode: 'P-401',
          orderStatus: 'Cancelled',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 401,
        updatedAt: cancelledAt,
        statusChanges: [{ newStatus: 'Cancelled', changedAt: cancelledAt }],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(cancelledAt);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/journal/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/journal?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const entries = body.data.entries as Array<{
      date: string;
      account: string;
      debit: number;
      credit: number;
    }>;

    // Cancellation reclass: Cr Forfeited Deposits on cancelledAt.
    expect(
      entries.some(
        (e) =>
          e.account === 'Forfeited Deposits' &&
          e.credit === 500 &&
          new Date(e.date).toISOString() === cancelledAt.toISOString()
      )
    ).toBe(true);
  });
});
