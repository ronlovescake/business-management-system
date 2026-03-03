import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: () => new Date('2020-01-01T00:00:00.000Z'),
  getRuntimeAccountingCutoverDate: async () =>
    new Date('2020-01-01T00:00:00.000Z'),
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

describe('GET /api/general-merchandise/accounting/ledger', () => {
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

  it('shows reservation fee liability and reclass to Sales Revenue on completion date', async () => {
    const paymentAt = new Date('2026-01-10T00:00:00.000Z');
    const paidAt = new Date('2026-02-05T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([
      {
        id: 500,
        orderStatus: 'Paid',
        updatedAt: paidAt,
        statusChanges: [{ newStatus: 'Paid', changedAt: paidAt }],
        customers: 'Test Customer',
        productCode: 'P-500',
      },
    ]);

    mockFetchers.getPaidAtDate.mockReturnValue(paidAt);

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 500,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: paymentAt,
        transaction: {
          id: 500,
          customers: 'Test Customer',
          productCode: 'P-500',
          orderDate: null,
          orderStatus: 'Paid',
        },
      },
    ]);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/ledger/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/ledger?from=2026-01-01&to=2026-02-28'
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

    expect(
      entries.some(
        (e) =>
          e.account === 'Customer Deposits' &&
          e.credit === 500 &&
          new Date(e.date).toISOString().startsWith('2026-01-10')
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
        transactionId: 501,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: paymentAt,
        transaction: {
          id: 501,
          customers: 'Test Customer',
          productCode: 'P-501',
          orderStatus: 'Cancelled',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 501,
        updatedAt: cancelledAt,
        statusChanges: [{ newStatus: 'Cancelled', changedAt: cancelledAt }],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(cancelledAt);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/ledger/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/ledger?from=2026-01-01&to=2026-01-31'
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

    expect(
      entries.some(
        (e) =>
          e.account === 'Forfeited Deposits' &&
          e.credit === 500 &&
          new Date(e.date).toISOString() === cancelledAt.toISOString()
      )
    ).toBe(true);
  });

  it('reclasses reservation fee to Forfeited Deposits on forfeiture date', async () => {
    const paymentAt = new Date('2026-01-10T00:00:00.000Z');
    const forfeitedAt = new Date('2026-01-29T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([]);

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 3,
        transactionId: 502,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: paymentAt,
        transaction: {
          id: 502,
          customers: 'Test Customer',
          productCode: 'P-502',
          orderStatus: 'Forfeited',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 502,
        updatedAt: forfeitedAt,
        statusChanges: [{ newStatus: 'Forfeited', changedAt: forfeitedAt }],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(forfeitedAt);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/ledger/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/ledger?from=2026-01-01&to=2026-01-31'
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

    expect(
      entries.some(
        (e) =>
          e.account === 'Forfeited Deposits' &&
          e.credit === 500 &&
          new Date(e.date).toISOString() === forfeitedAt.toISOString()
      )
    ).toBe(true);
  });
});
