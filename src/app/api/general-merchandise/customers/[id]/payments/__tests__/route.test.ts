import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/general-merchandise/customers/[id]/payments/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseCustomer: {
    findUnique: vi.fn(),
  },
  generalMerchandiseTransaction: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  generalMerchandiseTransactionPayment: {
    create: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('POST /api/general-merchandise/customers/[id]/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([0, -1, 0.001, 0.004])(
    'rejects amount %s without creating a payment or changing balances',
    async (amount) => {
      mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
        customerName: 'Test Customer',
      });
      mockPrisma.generalMerchandiseTransaction.findFirst.mockResolvedValue({
        id: 777,
      });

      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/general-merchandise/customers/1/payments'),
        body: {
          transactionId: 777,
          paymentDate: '2026-02-03',
          amount,
        },
      });

      const response = await POST(request, { params: { id: '1' } });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(
        mockPrisma.generalMerchandiseTransaction.findFirst
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.generalMerchandiseTransactionPayment.create
      ).not.toHaveBeenCalled();
      expect(
        mockPrisma.generalMerchandiseTransaction.update
      ).not.toHaveBeenCalled();
    }
  );

  it.each([
    { amount: 25, roundedAmount: 25 },
    { amount: 0.01, roundedAmount: 0.01 },
    { amount: 0.005, roundedAmount: 0.01 },
  ])(
    'records GM amount $amount and resyncs balances from payment rows',
    async ({ amount, roundedAmount }) => {
      mockPrisma.generalMerchandiseCustomer.findUnique.mockResolvedValue({
        customerName: 'Test Customer',
      });

      mockPrisma.generalMerchandiseTransaction.findFirst.mockResolvedValue({
        id: 777,
      });

      mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

      mockPrisma.generalMerchandiseTransactionPayment.create.mockResolvedValue({
        id: 999,
        transactionId: 777,
      });

      mockPrisma.generalMerchandiseTransaction.findUnique.mockResolvedValue({
        id: 777,
        quantity: 2,
        unitPrice: 100,
      });

      mockPrisma.generalMerchandiseTransactionPayment.groupBy.mockResolvedValue(
        [{ transactionId: 777, _sum: { amount: 25 } }]
      );

      mockPrisma.generalMerchandiseTransaction.update.mockResolvedValue({
        id: 777,
      });

      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/general-merchandise/customers/1/payments'),
        body: {
          transactionId: 777,
          paymentDate: '2026-02-03',
          amount,
          method: 'Cash',
          notes: 'Deposit',
          isReservation: true,
        },
      });

      const response = await POST(request, { params: { id: '1' } });
      expect(response.status).toBe(200);

      expect(
        mockPrisma.generalMerchandiseTransactionPayment.create
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: roundedAmount }),
        })
      );

      expect(
        mockPrisma.generalMerchandiseTransaction.findFirst
      ).toHaveBeenCalledWith({
        where: { id: 777, deletedAt: null, customerId: 1 },
        select: { id: true },
      });

      expect(
        mockPrisma.generalMerchandiseTransaction.update
      ).toHaveBeenCalledWith({
        where: { id: 777 },
        data: {
          adjustment: 25,
          lineTotal: 2 * 100 - 25,
        },
      });
    }
  );
});
