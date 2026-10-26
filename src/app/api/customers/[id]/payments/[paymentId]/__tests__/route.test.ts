import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '@/app/api/customers/[id]/payments/[paymentId]/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  customer: {
    findUnique: vi.fn(),
  },
  transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transactionPayment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));
vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'admin', role: 'ADMIN' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('DELETE /api/customers/[id]/payments/[paymentId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { orderStatus: 'Cancelled' },
    { orderStatus: 'Voided' },
    { orderStatus: 'Forfeited' },
    { cancellation: { id: 'approval' } },
    { initialDepositAmount: 100 },
    { financialRequestId: 'request' },
  ])(
    'preserves collections used by a financial decision or agreement: %j',
    async (protectedHistory) => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        customerName: 'Test Customer',
      });
      mockPrisma.transactionPayment.findFirst.mockResolvedValue({
        id: 132,
        transactionId: 2033,
        ...protectedHistory,
      });
      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 2033,
        quantity: 100,
        unitPrice: 65,
        ...protectedHistory,
      });
      mockPrisma.$transaction.mockImplementation(async (callback) =>
        callback(mockPrisma)
      );
      const response = await DELETE(mockNextRequest({ method: 'DELETE' }), {
        params: { id: '1', paymentId: '132' },
      });
      expect(response.status).toBe(409);
      expect(mockPrisma.transactionPayment.update).not.toHaveBeenCalled();
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    }
  );

  it('soft-deletes a payment and resyncs Transaction.adjustment/lineTotal from payment rows', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      customerName: 'Test Customer',
    });

    mockPrisma.transactionPayment.findFirst.mockResolvedValue({
      id: 132,
      transactionId: 2033,
    });

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          transaction: mockPrisma.transaction,
          transactionPayment: mockPrisma.transactionPayment,
        };
        return callback(tx);
      }
    );

    mockPrisma.transactionPayment.update.mockResolvedValue({ id: 132 });

    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: 2033,
      quantity: 100,
      unitPrice: 65,
    });

    mockPrisma.transactionPayment.groupBy.mockResolvedValue([
      { transactionId: 2033, _sum: { amount: 6500 } },
    ]);

    mockPrisma.transaction.update.mockResolvedValue({ id: 2033 });

    const request = mockNextRequest({
      method: 'DELETE',
      url: getTestApiUrl('/api/customers/1/payments/132'),
    });

    const response = await DELETE(request, {
      params: { id: '1', paymentId: '132' },
    });
    expect(response.status).toBe(200);

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 2033 },
      data: {
        adjustment: 6500,
        lineTotal: 100 * 65 - 6500,
      },
    });
  });
});
