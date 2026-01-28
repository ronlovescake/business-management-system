import { describe, expect, it, beforeEach, vi } from 'vitest';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

vi.mock('@/lib/accounting/cutover', () => ({
  getAccountingCutoverDate: () => new Date('2020-01-01T00:00:00.000Z'),
}));

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseShipment: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/accounting/general-merchandise/inventory-cogs', () => ({
  computeCogsTotal: vi.fn().mockResolvedValue(0),
  buildInventorySeedAndShrinkageEntries: vi
    .fn()
    .mockResolvedValue({ entries: [] }),
}));

const mockFetchers = vi.hoisted(() => ({
  fetchGeneralMerchandiseRecognizedTransactions: vi.fn(),
  fetchGeneralMerchandiseTransactionPayments: vi.fn(),
  fetchGeneralMerchandiseApprovedExpenses: vi.fn(),
  fetchGeneralMerchandiseTransactionRefunds: vi.fn(),
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

describe('GET /api/general-merchandise/accounting/balance-sheet (reservation deposits)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchers.isWithinDateRange.mockImplementation(within);

    mockFetchers.fetchGeneralMerchandiseRecognizedTransactions.mockResolvedValue(
      []
    );
    mockFetchers.fetchGeneralMerchandiseApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchGeneralMerchandiseTransactionRefunds.mockResolvedValue(
      []
    );
    mockFetchers.fetchGeneralMerchandiseManualJournalLines.mockResolvedValue(
      []
    );

    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseShipment.findMany.mockResolvedValue([]);
  });

  it('shows open reservation fee as Customer Deposits liability', async () => {
    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 600,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        transaction: {
          id: 600,
          customers: 'Test Customer',
          productCode: 'P-600',
          orderStatus: 'Pending',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 600,
        orderStatus: 'Pending',
        updatedAt: new Date('2026-01-10T00:00:00.000Z'),
        statusChanges: [],
      },
    ]);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/balance-sheet/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/balance-sheet?asOf=2026-01-15'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{
      account: string;
      amount: number;
      details?: Array<{ label: string; amount: number }>;
    }>;

    const cash = rows.find((r) => r.account === 'Cash');
    const deposits = rows.find((r) => r.account === 'Customer Deposits');

    expect(cash?.amount).toBe(500);
    expect(deposits?.amount).toBe(-500);

    expect(cash?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Reservation Deposits (open)',
          amount: 500,
        }),
      ])
    );
  });

  it('does not show Customer Deposits for a paid/completed reservation order', async () => {
    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 601,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        transaction: {
          id: 601,
          customers: 'Test Customer',
          productCode: 'P-601',
          orderStatus: 'Checked Out',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 601,
        orderStatus: 'Checked Out',
        updatedAt: new Date('2026-02-05T00:00:00.000Z'),
        statusChanges: [
          {
            newStatus: 'Checked Out',
            changedAt: new Date('2026-02-05T00:00:00.000Z'),
          },
        ],
      },
    ]);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/balance-sheet/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/balance-sheet?asOf=2026-02-06'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{ account: string; amount: number }>;
    expect(rows.some((r) => r.account === 'Customer Deposits')).toBe(false);
  });

  it('moves cancelled reservation fee into Retained Earnings (forfeited) on cancellation date', async () => {
    const cancelledAt = new Date('2026-01-28T00:00:00.000Z');

    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue([
      {
        id: 1,
        transactionId: 602,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        isReservation: true,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        transaction: {
          id: 602,
          customers: 'Test Customer',
          productCode: 'P-602',
          orderStatus: 'Cancelled',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 602,
        orderStatus: 'Cancelled',
        updatedAt: cancelledAt,
        statusChanges: [{ newStatus: 'Cancelled', changedAt: cancelledAt }],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(cancelledAt);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/balance-sheet/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/balance-sheet?asOf=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{
      account: string;
      amount: number;
      details?: Array<{ label: string; amount: number }>;
    }>;

    const cash = rows.find((r) => r.account === 'Cash');
    const retained = rows.find((r) => r.account === 'Retained Earnings');

    expect(cash?.amount).toBe(500);
    expect(retained?.amount).toBe(-500);

    expect(cash?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Reservation Deposits (forfeited)',
          amount: 500,
        }),
      ])
    );
  });

  it('adds Cash breakdown details for expenses (can show negative Cash)', async () => {
    mockFetchers.fetchGeneralMerchandiseTransactionPayments.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([]);

    mockFetchers.fetchGeneralMerchandiseApprovedExpenses.mockResolvedValue([
      {
        id: 10,
        date: '2026-01-20',
        amount: 1000,
        description: 'Box tape and supplies',
        category: 'Supplies',
        paymentMethod: 'GCash',
        employeeName: null,
        sourceId: null,
      },
    ]);

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/balance-sheet/route'
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/balance-sheet?asOf=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const rows = body.data.rows as Array<{
      account: string;
      amount: number;
      details?: Array<{ label: string; amount: number }>;
    }>;

    const cash = rows.find((r) => r.account === 'Cash');
    expect(cash?.amount).toBe(-1000);
    expect(cash?.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Expense – Supplies (GCash)',
          amount: -1000,
        }),
      ])
    );
  });
});
