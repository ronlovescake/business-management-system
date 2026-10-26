import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/transactions/payments/bulk/route';
import { requireAuth } from '@/lib/auth/session';
import {
  mockNextRequest as baseMockNextRequest,
  getTestApiUrl,
} from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  clothingFinancialRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  transactionPayment: {
    createMany: vi.fn(),
    groupBy: vi.fn(),
  },
  transactionStatusChange: {
    create: vi.fn(),
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

describe('POST /api/transactions/payments/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.clothingFinancialRequest.findUnique.mockResolvedValue(null);
  });

  it('rejects unauthenticated collections before reading or writing business records', async () => {
    vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Unauthorized'));
    const response = await POST(mockNextRequest({ method: 'POST', body: {} }));
    expect(response.status).toBe(401);
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([0, -1, 0.001, 0.004])(
    'rejects an entire batch containing amount %s before writing',
    async (amount) => {
      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/transactions/payments/bulk'),
        body: {
          payments: [
            { transactionId: 10, paymentDate: '2026-02-03', amount: 25 },
            { transactionId: 11, paymentDate: '2026-02-03', amount },
          ],
        },
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.transactionPayment.createMany).not.toHaveBeenCalled();
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    }
  );

  it('creates payments and updates transaction adjustments', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 100 },
      { id: 11, quantity: 1, unitPrice: 50 },
    ]);

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

    mockPrisma.transactionPayment.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([
      { transactionId: 10, _sum: { amount: 0 } },
      { transactionId: 11, _sum: { amount: 0 } },
    ]);

    mockPrisma.transaction.update.mockImplementation(async (args: unknown) => {
      const payload = args as {
        where: { id: number };
        data: { adjustment: number; lineTotal: number };
      };
      return {
        id: payload.where.id,
        adjustment: payload.data.adjustment,
        lineTotal: payload.data.lineTotal,
      };
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 25,
            method: 'Cash',
            notes: 'Deposit',
          },
          {
            transactionId: 11,
            paymentDate: '2026-01-17',
            amount: 10,
            method: 'GCash',
          },
        ],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.paymentsCreated).toBe(2);
    expect(body.data.updates).toHaveLength(2);

    type UpdateRow = { id: number; adjustment: number; lineTotal: number };
    const updates = body.data.updates as UpdateRow[];

    const update10 = updates.find((u) => u.id === 10);
    expect(update10).toBeDefined();
    if (!update10) {
      throw new Error('Expected update for transaction 10');
    }
    expect(update10.adjustment).toBe(25);
    expect(update10.lineTotal).toBe(2 * 100 - 25);

    const update11 = updates.find((u) => u.id === 11);
    expect(update11).toBeDefined();
    if (!update11) {
      throw new Error('Expected update for transaction 11');
    }
    expect(update11.adjustment).toBe(10);
    expect(update11.lineTotal).toBe(1 * 50 - 10);

    expect(mockPrisma.transactionPayment.createMany).toHaveBeenCalled();
    expect(mockPrisma.transactionPayment.groupBy).toHaveBeenCalled();
    expect(mockPrisma.transaction.update).toHaveBeenCalledTimes(2);
  });

  it('rejects when any transaction id is missing', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 100 },
    ]);

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 25,
          },
          {
            transactionId: 999,
            paymentDate: '2026-01-17',
            amount: 10,
          },
        ],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid transaction IDs');
  });

  it.each([10, 20] as const)(
    'persists the original %s percent agreement with its receipt',
    async (originalDepositRate) => {
      mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

      mockPrisma.transaction.findMany.mockResolvedValue([
        { id: 10, quantity: 2, unitPrice: 100 },
      ]);

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

      mockPrisma.transactionPayment.createMany.mockResolvedValue({ count: 1 });
      mockPrisma.transactionPayment.groupBy.mockResolvedValue([
        { transactionId: 10, _sum: { amount: 0 } },
      ]);

      mockPrisma.transaction.update.mockResolvedValue({
        id: 10,
        adjustment: originalDepositRate * 2,
        lineTotal: 2 * 100 - originalDepositRate * 2,
      });

      const request = mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/transactions/payments/bulk'),
        body: {
          payments: [
            {
              transactionId: 10,
              paymentDate: '2026-01-17',
              amount: originalDepositRate * 2,
              method: 'Cash',
              notes: 'Reservation Deposit',
              isReservation: true,
              originalDepositRate,
            },
          ],
        },
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const createManyArgs = mockPrisma.transactionPayment.createMany.mock
        .calls[0]?.[0] as { data?: Array<Record<string, unknown>> } | undefined;

      expect(createManyArgs?.data?.[0]).toMatchObject({
        transactionId: 10,
        amount: originalDepositRate * 2,
        isReservation: true,
      });
      const update = mockPrisma.transaction.update.mock.calls[0]?.[0];
      expect(update.data.initialDepositAmount.toNumber()).toBe(
        originalDepositRate * 2
      );
      expect(update.data.initialDepositRate.toNumber()).toBe(
        originalDepositRate
      );
      expect(update.data.depositConfirmedBy).toBe('Collector');
      expect(update.data.depositConfirmedAt).toBeInstanceOf(Date);
    }
  );

  it('rejects a payment that exceeds the outstanding balance without writing', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 50, adjustment: 0 },
    ]);
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([]);
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

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 101,
            method: 'Cash',
          },
        ],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Payment validation failed');
    expect(mockPrisma.transactionPayment.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
  });

  it('rejects reservation deposits for Accounts Receivable transactions', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 10,
        quantity: 2,
        unitPrice: 50,
        adjustment: 0,
        orderStatus: 'Accounts Receivable',
      },
    ]);
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([]);
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

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 25,
            method: 'Cash',
            isReservation: true,
          },
        ],
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Payment validation failed');
    expect(mockPrisma.transactionPayment.createMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
  });

  it('moves a fully collected A/R transaction to Shipped and records status history', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 10,
        quantity: 1,
        unitPrice: 100,
        adjustment: 0,
        orderStatus: 'Accounts Receivable',
      },
    ]);
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([]);
    mockPrisma.transactionPayment.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.transaction.update.mockImplementation(
      async (args: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => ({
        id: args.where.id,
        adjustment: args.data.adjustment,
        lineTotal: args.data.lineTotal,
        orderStatus: args.data.orderStatus ?? 'Accounts Receivable',
      })
    );
    mockPrisma.transactionStatusChange.create.mockResolvedValue({ id: 1 });
    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          clothingFinancialRequest: mockPrisma.clothingFinancialRequest,
          transaction: mockPrisma.transaction,
          transactionPayment: mockPrisma.transactionPayment,
          transactionStatusChange: mockPrisma.transactionStatusChange,
        };
        return callback(tx);
      }
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/transactions/payments/bulk'),
      body: {
        payments: [
          {
            transactionId: 10,
            paymentDate: '2026-01-17',
            amount: 100,
            method: 'Cash',
          },
        ],
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: expect.objectContaining({
          adjustment: 100,
          lineTotal: 0,
          orderStatus: 'Shipped',
        }),
      })
    );
    expect(mockPrisma.transactionStatusChange.create).toHaveBeenCalledWith({
      data: {
        transactionId: 10,
        previousStatus: 'Accounts Receivable',
        newStatus: 'Shipped',
      },
    });
  });
});
