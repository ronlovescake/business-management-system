import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/transactions/payments/bulk/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  transaction: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  transactionPayment: {
    createMany: vi.fn(),
    groupBy: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/transactions/payments/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates payments and updates transaction adjustments', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 100 },
      { id: 11, quantity: 1, unitPrice: 50 },
    ]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          transaction: mockPrisma.transaction,
          transactionPayment: mockPrisma.transactionPayment,
        };
        return callback(tx);
      }
    );

    mockPrisma.transactionPayment.createMany.mockResolvedValue({ count: 2 });
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([
      { transactionId: 10, _sum: { amount: 25 } },
      { transactionId: 11, _sum: { amount: 10 } },
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

  it('persists isReservation when supported by schema', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      { id: 10, quantity: 2, unitPrice: 100 },
    ]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
          transaction: mockPrisma.transaction,
          transactionPayment: mockPrisma.transactionPayment,
        };
        return callback(tx);
      }
    );

    mockPrisma.transactionPayment.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.transactionPayment.groupBy.mockResolvedValue([
      { transactionId: 10, _sum: { amount: 25 } },
    ]);

    mockPrisma.transaction.update.mockResolvedValue({
      id: 10,
      adjustment: 25,
      lineTotal: 2 * 100 - 25,
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
            notes: 'Reservation fee',
            isReservation: true,
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
      amount: 25,
      isReservation: true,
    });
  });
});
