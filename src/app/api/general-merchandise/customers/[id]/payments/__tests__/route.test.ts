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

  it('creates a GM payment and resyncs adjustment/lineTotal from payment rows', async () => {
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

    mockPrisma.generalMerchandiseTransactionPayment.groupBy.mockResolvedValue([
      { transactionId: 777, _sum: { amount: 25 } },
    ]);

    mockPrisma.generalMerchandiseTransaction.update.mockResolvedValue({
      id: 777,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/general-merchandise/customers/1/payments'),
      body: {
        transactionId: 777,
        paymentDate: '2026-02-03',
        amount: 25,
        method: 'Cash',
        notes: 'Deposit',
        isReservation: true,
      },
    });

    const response = await POST(request, { params: { id: '1' } });
    expect(response.status).toBe(200);

    expect(
      mockPrisma.generalMerchandiseTransaction.update
    ).toHaveBeenCalledWith({
      where: { id: 777 },
      data: {
        adjustment: 25,
        lineTotal: 2 * 100 - 25,
      },
    });
  });
});
