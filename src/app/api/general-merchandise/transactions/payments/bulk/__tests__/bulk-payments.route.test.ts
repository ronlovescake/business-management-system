import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/general-merchandise/transactions/payments/bulk/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  generalMerchandiseTransactionPayment: {
    createMany: vi.fn(),
    groupBy: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/general-merchandise/transactions/payments/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates GM payments (including isReservation) and updates adjustment/lineTotal', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 100 },
    ]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          generalMerchandiseTransaction:
            mockPrisma.generalMerchandiseTransaction,
          generalMerchandiseTransactionPayment:
            mockPrisma.generalMerchandiseTransactionPayment,
        };
        return callback(tx);
      }
    );

    mockPrisma.generalMerchandiseTransactionPayment.createMany.mockResolvedValue(
      {
        count: 1,
      }
    );
    mockPrisma.generalMerchandiseTransactionPayment.groupBy.mockResolvedValue([
      { transactionId: 10, _sum: { amount: 25 } },
    ]);

    mockPrisma.generalMerchandiseTransaction.update.mockImplementation(
      async (args: unknown) => {
        const payload = args as {
          where: { id: number };
          data: { adjustment: number; lineTotal: number };
        };
        return {
          id: payload.where.id,
          adjustment: payload.data.adjustment,
          lineTotal: payload.data.lineTotal,
        };
      }
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/general-merchandise/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 25,
            method: 'Cash',
            notes: 'Reservation fee',
            isReservation: true,
          },
        ],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.paymentsCreated).toBe(1);

    expect(
      mockPrisma.generalMerchandiseTransactionPayment.createMany
    ).toHaveBeenCalledWith({
      data: [
        {
          transactionId: 10,
          paymentDate: '2026-01-17',
          amount: 25,
          method: 'Cash',
          notes: 'Reservation fee',
          isReservation: true,
        },
      ],
    });

    expect(mockPrisma.generalMerchandiseTransaction.update).toHaveBeenCalled();
  });
});
