import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

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

describe('GET /api/general-merchandise/accounting/profit-loss/details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchers.isWithinDateRange.mockImplementation(within);
  });

  it('does not treat reservation fee payments as TransactionPayment revenue; recognizes them on completion date', async () => {
    const paidAt = new Date('2026-02-05T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([
      {
        id: 300,
        orderStatus: 'Paid',
        updatedAt: paidAt,
        statusChanges: [{ newStatus: 'Paid', changedAt: paidAt }],
      },
    ]);
    mockFetchers.getPaidAtDate.mockReturnValue(paidAt);

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 300,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        transaction: {
          id: 300,
          customers: 'Test Customer',
          productCode: 'P-300',
          orderDate: null,
          orderStatus: 'Paid',
        },
      },
    ]);

    mockFetchers.fetchGeneralMerchandiseApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchGeneralMerchandiseTransactionRefunds.mockResolvedValue(
      []
    );

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/profit-loss/details/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/profit-loss/details?from=2026-02-01&to=2026-02-28'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{
      sourceType: string;
      category: string;
      amount: number;
      date: string;
    }>;

    // No TransactionPayment revenue row for reservation payment.
    expect(rows.some((r) => r.sourceType === 'TransactionPayment')).toBe(false);

    // Recognition row appears in Sales Revenue on completion date.
    const recognized = rows.find(
      (r) => r.sourceType === 'ReservationDepositRecognition'
    );
    expect(recognized?.category).toBe('Sales Revenue');
    expect(recognized?.amount).toBe(500);
    expect(new Date(recognized?.date ?? '').toISOString()).toBe(
      paidAt.toISOString()
    );
  });

  it('recognizes reservation fee as Forfeited Deposits on cancellation date', async () => {
    const cancelledAt = new Date('2026-01-28T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandisePaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchGeneralMerchandiseApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchGeneralMerchandiseTransactionRefunds.mockResolvedValue(
      []
    );

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 2,
        transactionId: 301,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        transaction: {
          id: 301,
          customers: 'Test Customer',
          productCode: 'P-301',
          orderDate: null,
          orderStatus: 'Cancelled',
        },
      },
    ]);

    // Details route queries prisma for cancellation timestamp.
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 301,
        updatedAt: cancelledAt,
        statusChanges: [{ newStatus: 'Cancelled', changedAt: cancelledAt }],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(cancelledAt);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/profit-loss/details/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/profit-loss/details?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{
      sourceType: string;
      category: string;
      amount: number;
      date: string;
    }>;

    const forfeited = rows.find(
      (r) => r.sourceType === 'ReservationDepositForfeit'
    );
    expect(forfeited?.category).toBe('Forfeited Deposits');
    expect(forfeited?.amount).toBe(500);
    expect(new Date(forfeited?.date ?? '').toISOString()).toBe(
      cancelledAt.toISOString()
    );
  });
});
