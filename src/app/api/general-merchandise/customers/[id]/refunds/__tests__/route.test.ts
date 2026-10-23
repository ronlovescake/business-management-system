import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  generalMerchandiseTransaction: { findFirst: vi.fn() },
  generalMerchandiseTransactionRefund: { findMany: vi.fn(), create: vi.fn() },
  generalMerchandiseInventoryMovement: { findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/modules/general-merchandise/customers/api/service', () => ({
  findGeneralMerchandiseCustomerForClothingId: vi.fn().mockResolvedValue({
    id: 77,
  }),
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest(
    getTestApiUrl('/api/general-merchandise/customers/1/refunds'),
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

const buildBody = (overrides: Record<string, unknown> = {}) => ({
  transactionId: 5,
  refundDate: '2026-06-01',
  amount: 20,
  returnedQuantity: 0,
  reason: 'Customer return',
  ...overrides,
});

describe('GM customer refund route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (work) =>
      work(mockPrisma)
    );
    mockPrisma.generalMerchandiseTransaction.findFirst.mockResolvedValue({
      id: 5,
      productCode: 'GM-5',
      quantity: 4,
      lineTotal: 100,
      adjustment: 0,
      unitPrice: 25,
      discount: 0,
    });
    mockPrisma.generalMerchandiseTransactionRefund.findMany.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandiseTransactionRefund.create.mockImplementation(
      async ({ data }) => ({ id: 9, ...data })
    );
    mockPrisma.generalMerchandiseInventoryMovement.findFirst.mockResolvedValue({
      unitCost: 12,
    });
    mockPrisma.generalMerchandiseInventoryMovement.create.mockResolvedValue({
      id: 10,
    });
  });

  it('rejects a return that exceeds prior cumulative returned quantity', async () => {
    mockPrisma.generalMerchandiseTransactionRefund.findMany.mockResolvedValue([
      { amount: 20, returnedQuantity: 3.5 },
    ]);
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest(
        buildBody({ returnedQuantity: 0.51, restockBucket: 'sellable' })
      ),
      { params: { id: '1' } }
    );

    expect(response.status).toBe(400);
    expect(
      mockPrisma.generalMerchandiseTransactionRefund.create
    ).not.toHaveBeenCalled();
    expect(
      mockPrisma.generalMerchandiseInventoryMovement.create
    ).not.toHaveBeenCalled();
  });

  it('copies the original sale cost to a returned item movement', async () => {
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest(buildBody({ returnedQuantity: 1, restockBucket: 'scrap' })),
      { params: { id: '1' } }
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(
      mockPrisma.generalMerchandiseInventoryMovement.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'GM-5',
        quantity: 1,
        unitCost: 12,
        fromBucket: 'sold',
        toBucket: 'scrap',
      }),
    });
  });
});
