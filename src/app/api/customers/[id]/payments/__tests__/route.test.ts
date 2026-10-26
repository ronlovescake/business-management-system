import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { POST } from '@/app/api/customers/[id]/payments/route';
import { requireAuth } from '@/lib/auth/session';
import {
  getTestApiUrl,
  mockNextRequest as baseMockNextRequest,
} from '@/core/testing/test-helpers';
import {
  transactionPaymentCreateSchema,
  transactionPaymentBulkCreateSchema,
} from '@/lib/validations/transaction-payment.validation';

const mockPrisma = vi.hoisted(() => ({
  clothingFinancialRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
  },
  transaction: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transactionPayment: {
    create: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));
vi.mock('@/lib/auth/session', () => ({
  requireAuth: vi
    .fn()
    .mockResolvedValue({ id: 'collector', name: 'Collector', role: 'USER' }),
}));

const mockNextRequest = (options: Parameters<typeof baseMockNextRequest>[0]) =>
  baseMockNextRequest({
    ...options,
    headers: {
      'Idempotency-Key': '123e4567-e89b-42d3-a456-426614174000',
      ...options?.headers,
    },
  });

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('POST /api/customers/[id]/payments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.clothingFinancialRequest.findUnique.mockResolvedValue(null);
  });

  it('rejects unauthenticated collections before reading or writing business records', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    const response = await POST(mockNextRequest({ method: 'POST', body: {} }), {
      params: { id: '1' },
    });
    expect(response.status).toBe(401);
    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 0.001, 0.004])(
    'rejects amount %s before starting a payment write',
    async (amount) => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        customerName: 'Test Customer',
      });
      mockPrisma.transaction.findFirst.mockResolvedValue({ id: 2033 });
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.$transaction.mockResolvedValue({ id: 999 });

      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/customers/1/payments'),
        body: {
          transactionId: 2033,
          paymentDate: '2026-02-03',
          amount,
        },
      });

      const response = await POST(request, { params: { id: '1' } });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(mockPrisma.transaction.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.transactionPayment.create).not.toHaveBeenCalled();
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    }
  );

  it.each([
    { amount: 5850, roundedAmount: 5850 },
    { amount: 0.01, roundedAmount: 0.01 },
    { amount: 0.005, roundedAmount: 0.01 },
  ])(
    'records $amount and resyncs balances from payment rows',
    async ({ amount, roundedAmount }) => {
      mockPrisma.customer.findUnique.mockResolvedValue({
        customerName: 'Test Customer',
      });

      mockPrisma.transaction.findFirst.mockResolvedValue({ id: 2033 });

      mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

      mockPrisma.$transaction.mockImplementation(
        async (callback: (tx: unknown) => unknown) => {
          const tx = {
            clothingFinancialRequest: mockPrisma.clothingFinancialRequest,
            transaction: mockPrisma.transaction,
            transactionPayment: mockPrisma.transactionPayment,
          };
          return callback(tx);
        }
      );

      mockPrisma.transactionPayment.create.mockResolvedValue({
        id: 999,
        transactionId: 2033,
        paymentDate: '2026-02-03',
        amount: roundedAmount,
        method: 'Cash',
        notes: null,
        isReservation: false,
        createdAt: new Date('2026-02-03T00:00:00.000Z'),
        updatedAt: new Date('2026-02-03T00:00:00.000Z'),
      });

      mockPrisma.transaction.findUnique.mockResolvedValue({
        id: 2033,
        quantity: 100,
        unitPrice: 65,
        adjustment: 0,
        orderStatus: null,
        customerId: 1,
        deletedAt: null,
      });

      mockPrisma.transactionPayment.groupBy.mockResolvedValue([
        { transactionId: 2033, _sum: { amount: 6500 - roundedAmount } },
      ]);

      mockPrisma.transaction.update.mockResolvedValue({ id: 2033 });

      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/customers/1/payments'),
        body: {
          transactionId: 2033,
          paymentDate: '2026-02-03',
          amount,
          method: 'Cash',
          notes: null,
          isReservation: false,
        },
      });

      const response = await POST(request, { params: { id: '1' } });
      expect(response.status).toBe(201);

      expect(mockPrisma.transactionPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: roundedAmount }),
        })
      );

      expect(mockPrisma.transaction.findFirst).toHaveBeenCalledWith({
        where: { id: 2033, deletedAt: null, customerId: 1 },
        select: { id: true },
      });

      expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 2033 },
        data: {
          adjustment: 6500,
          lineTotal: 100 * 65 - 6500,
        },
      });
    }
  );

  it('resyncs correctly after multiple payments over time', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      customerName: 'Test Customer',
    });

    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 2033 });
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          clothingFinancialRequest: mockPrisma.clothingFinancialRequest,
          transaction: mockPrisma.transaction,
          transactionPayment: mockPrisma.transactionPayment,
        };
        return callback(tx);
      }
    );

    mockPrisma.transaction.findUnique.mockResolvedValue({
      id: 2033,
      quantity: 100,
      unitPrice: 65,
      adjustment: 0,
      orderStatus: null,
      customerId: 1,
      deletedAt: null,
    });

    mockPrisma.transactionPayment.create
      .mockResolvedValueOnce({
        id: 111,
        transactionId: 2033,
        paymentDate: '2026-02-03',
        amount: 650,
        method: 'Cash',
        notes: null,
        isReservation: true,
        createdAt: new Date('2026-02-03T00:00:00.000Z'),
        updatedAt: new Date('2026-02-03T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 222,
        transactionId: 2033,
        paymentDate: '2026-02-04',
        amount: 5850,
        method: 'Cash',
        notes: null,
        isReservation: false,
        createdAt: new Date('2026-02-04T00:00:00.000Z'),
        updatedAt: new Date('2026-02-04T00:00:00.000Z'),
      });

    mockPrisma.transactionPayment.groupBy
      .mockResolvedValueOnce([{ transactionId: 2033, _sum: { amount: 0 } }])
      .mockResolvedValueOnce([{ transactionId: 2033, _sum: { amount: 650 } }]);

    mockPrisma.transaction.update.mockResolvedValue({ id: 2033 });

    const request1 = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/1/payments'),
      body: {
        transactionId: 2033,
        paymentDate: '2026-02-03',
        amount: 650,
        method: 'Cash',
        notes: null,
        isReservation: true,
        originalDepositRate: 10,
      },
    });

    const response1 = await POST(request1, { params: { id: '1' } });
    expect(response1.status).toBe(201);

    const request2 = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/1/payments'),
      headers: { 'Idempotency-Key': '123e4567-e89b-42d3-a456-426614174001' },
      body: {
        transactionId: 2033,
        paymentDate: '2026-02-04',
        amount: 5850,
        method: 'Cash',
        notes: null,
        isReservation: false,
      },
    });

    const response2 = await POST(request2, { params: { id: '1' } });
    expect(response2.status).toBe(201);

    expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.transaction.update).toHaveBeenNthCalledWith(1, {
      where: { id: 2033 },
      data: {
        adjustment: 650,
        lineTotal: 100 * 65 - 650,
        initialDepositAmount: new Prisma.Decimal(650),
        initialDepositRate: new Prisma.Decimal(10),
        depositConfirmedAt: expect.any(Date),
        depositConfirmedBy: 'Collector',
      },
    });
    expect(mockPrisma.transaction.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2033 },
      data: {
        adjustment: 6500,
        lineTotal: 100 * 65 - 6500,
      },
    });
  });
});

describe('Shared transaction payment amount validation', () => {
  it.each([
    { amount: 0, accepted: false },
    { amount: -1, accepted: false },
    { amount: Number.NaN, accepted: false },
    { amount: Number.POSITIVE_INFINITY, accepted: false },
    { amount: Number.NEGATIVE_INFINITY, accepted: false },
    { amount: 0.01, accepted: true },
    { amount: 25.5, accepted: true },
  ])(
    'validates $amount consistently for direct and bulk creation',
    ({ amount, accepted }) => {
      const payment = {
        transactionId: 2033,
        paymentDate: '2026-02-03',
        amount,
      };

      expect(transactionPaymentCreateSchema.safeParse(payment).success).toBe(
        accepted
      );
      expect(
        transactionPaymentBulkCreateSchema.safeParse({ payments: [payment] })
          .success
      ).toBe(accepted);
    }
  );
});
