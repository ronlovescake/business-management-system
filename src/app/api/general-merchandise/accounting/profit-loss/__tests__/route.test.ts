import { describe, expect, it, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/general-merchandise/accounting/profit-loss/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
  },
  generalMerchandiseTransactionPayment: {
    findMany: vi.fn(),
  },
  generalMerchandiseTransactionRefund: {
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/accounting/general-merchandise/inventory-cogs', () => ({
  computeCogsTotal: vi.fn().mockResolvedValue(0),
  computeInventorySeedAndShrinkageTotals: vi.fn().mockResolvedValue({
    shrinkageTotal: 0,
  }),
}));

describe('GET /api/general-merchandise/accounting/profit-loss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not count reservation fees as Sales Revenue until completion (prevents cross-month double counting)', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ one: 1 }]);

    // Reservation fee paid in January.
    mockPrisma.generalMerchandiseTransactionPayment.findMany.mockResolvedValue([
      {
        id: 1,
        transactionId: 200,
        paymentDate: '2026-01-10',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        isReservation: true,
        transaction: {
          id: 200,
          customers: 'Test Customer',
          productCode: 'P-200',
          orderDate: null,
          orderStatus: 'Paid',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransactionRefund.findMany.mockResolvedValue(
      []
    );

    // Transaction is completed/paid in February.
    mockPrisma.generalMerchandiseTransaction.findMany.mockImplementation(
      async (args: unknown) => {
        const typed = args as {
          where?: {
            orderStatus?: { in?: string[]; equals?: string };
            id?: { in?: number[] };
          };
        };

        if (Array.isArray(typed.where?.orderStatus?.in)) {
          return [
            {
              id: 200,
              updatedAt: new Date('2026-02-05T00:00:00.000Z'),
              statusChanges: [
                {
                  newStatus: 'Paid',
                  changedAt: new Date('2026-02-05T00:00:00.000Z'),
                },
              ],
              customers: 'Test Customer',
              productCode: 'P-200',
              orderStatus: 'Paid',
              quantity: 1,
              unitPrice: 0,
              lineTotal: 0,
              adjustment: 0,
              shippingFee: 0,
              discount: 0,
            },
          ];
        }

        return [];
      }
    );

    // January period: should NOT show Sales Revenue for reservation payment.
    {
      const request = mockNextRequest({
        method: 'GET',
        url: getTestApiUrl(
          '/api/general-merchandise/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
        ),
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      const sales = (
        body.data.rows as Array<{ category: string; amount: number }>
      ).find((row) => row.category === 'Sales Revenue');
      const forfeited = (
        body.data.rows as Array<{ category: string; amount: number }>
      ).find((row) => row.category === 'Forfeited Deposits');

      expect(sales).toBeUndefined();
      expect(forfeited).toBeUndefined();
      expect(body.data.stats.revenueTotal).toBe(0);
    }

    // February period: deposit is recognized into Sales Revenue (reclass).
    {
      const request = mockNextRequest({
        method: 'GET',
        url: getTestApiUrl(
          '/api/general-merchandise/accounting/profit-loss?from=2026-02-01&to=2026-02-28'
        ),
      });

      const response = await GET(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);

      const sales = (
        body.data.rows as Array<{ category: string; amount: number }>
      ).find((row) => row.category === 'Sales Revenue');

      expect(sales?.amount).toBe(500);
      expect(body.data.stats.revenueTotal).toBe(500);
    }
  });

  it('recognizes cancelled reservation payments as Forfeited Deposits on cancel date', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ one: 1 }]);

    mockPrisma.generalMerchandiseTransactionPayment.findMany.mockResolvedValue([
      {
        id: 1,
        transactionId: 123,
        paymentDate: '2026-01-05',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        isReservation: true,
        transaction: {
          id: 123,
          customers: 'Test Customer',
          productCode: 'P-1',
          orderStatus: 'Cancelled',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransactionRefund.findMany.mockResolvedValue(
      []
    );

    mockPrisma.generalMerchandiseTransaction.findMany.mockImplementation(
      async (args: unknown) => {
        const typed = args as {
          where?: {
            orderStatus?: { in?: string[]; equals?: string };
            id?: { in?: number[] };
          };
          select?: unknown;
          include?: unknown;
        };

        // Paid transactions fetch
        if (Array.isArray(typed.where?.orderStatus?.in)) {
          return [];
        }

        // Cancelled status change lookup
        if (Array.isArray(typed.where?.id?.in)) {
          return [
            {
              id: 123,
              updatedAt: new Date('2026-01-28T00:00:00.000Z'),
              statusChanges: [
                {
                  newStatus: 'Cancelled',
                  changedAt: new Date('2026-01-28T00:00:00.000Z'),
                },
              ],
            },
          ];
        }

        return [];
      }
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const forfeited = (
      body.data.rows as Array<{ category: string; amount: number }>
    ).find((row) => row.category === 'Forfeited Deposits');

    expect(forfeited?.amount).toBe(500);
    expect(body.data.stats.revenueTotal).toBe(500);
  });

  it('recognizes forfeited reservation payments as Forfeited Deposits on forfeiture date', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ one: 1 }]);

    mockPrisma.generalMerchandiseTransactionPayment.findMany.mockResolvedValue([
      {
        id: 1,
        transactionId: 124,
        paymentDate: '2026-01-05',
        amount: 500,
        method: 'Cash',
        notes: 'Reservation fee',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
        isReservation: true,
        transaction: {
          id: 124,
          customers: 'Test Customer',
          productCode: 'P-2',
          orderStatus: 'Forfeited',
        },
      },
    ]);

    mockPrisma.generalMerchandiseTransactionRefund.findMany.mockResolvedValue(
      []
    );

    const forfeitedAt = new Date('2026-01-29T00:00:00.000Z');

    mockPrisma.generalMerchandiseTransaction.findMany.mockImplementation(
      async (args: unknown) => {
        const typed = args as {
          where?: {
            orderStatus?: { in?: string[]; equals?: string };
            id?: { in?: number[] };
          };
          select?: unknown;
          include?: unknown;
        };

        // Paid transactions fetch
        if (Array.isArray(typed.where?.orderStatus?.in)) {
          return [];
        }

        // Forfeited status change lookup
        if (Array.isArray(typed.where?.id?.in)) {
          return [
            {
              id: 124,
              updatedAt: forfeitedAt,
              statusChanges: [
                {
                  newStatus: 'Forfeited',
                  changedAt: forfeitedAt,
                },
              ],
            },
          ];
        }

        return [];
      }
    );

    const request = mockNextRequest({
      method: 'GET',
      url: getTestApiUrl(
        '/api/general-merchandise/accounting/profit-loss?from=2026-01-01&to=2026-01-31'
      ),
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);

    const forfeited = (
      body.data.rows as Array<{ category: string; amount: number }>
    ).find((row) => row.category === 'Forfeited Deposits');

    expect(forfeited?.amount).toBe(500);
    expect(body.data.stats.revenueTotal).toBe(500);
  });
});
