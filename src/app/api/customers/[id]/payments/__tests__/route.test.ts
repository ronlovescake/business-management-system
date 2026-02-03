import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/customers/[id]/payments/route';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
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
  });

  it('creates a payment and resyncs Transaction.adjustment/lineTotal from payment rows', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      customerName: 'Test Customer',
    });

    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 2033 });

    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
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
      amount: 5850,
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
    });

    mockPrisma.transactionPayment.groupBy.mockResolvedValue([
      { transactionId: 2033, _sum: { amount: 6500 } },
    ]);

    mockPrisma.transaction.update.mockResolvedValue({ id: 2033 });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/1/payments'),
      body: {
        transactionId: 2033,
        paymentDate: '2026-02-03',
        amount: 5850,
        method: 'Cash',
        notes: null,
        isReservation: false,
      },
    });

    const response = await POST(request, { params: { id: '1' } });
    expect(response.status).toBe(201);

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 2033 },
      data: {
        adjustment: 6500,
        lineTotal: 100 * 65 - 6500,
      },
    });
  });

  it('resyncs correctly after multiple payments over time', async () => {
    mockPrisma.customer.findUnique.mockResolvedValue({
      customerName: 'Test Customer',
    });

    mockPrisma.transaction.findFirst.mockResolvedValue({ id: 2033 });
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);

    mockPrisma.$transaction.mockImplementation(
      async (callback: (tx: unknown) => unknown) => {
        const tx = {
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
      .mockResolvedValueOnce([{ transactionId: 2033, _sum: { amount: 650 } }])
      .mockResolvedValueOnce([{ transactionId: 2033, _sum: { amount: 6500 } }]);

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
      },
    });

    const response1 = await POST(request1, { params: { id: '1' } });
    expect(response1.status).toBe(201);

    const request2 = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/customers/1/payments'),
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
