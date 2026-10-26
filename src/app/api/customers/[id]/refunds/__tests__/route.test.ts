import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  customer: { findUnique: vi.fn() },
  transaction: { findFirst: vi.fn() },
  transactionPayment: { findMany: vi.fn() },
  transactionRefund: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  inventoryMovement: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => ({ id: 'user-1', role: 'USER' }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const buildRequest = (body: Record<string, unknown>) =>
  new NextRequest(getTestApiUrl('/api/customers/1/refunds'), {
    method: 'POST',
    body: JSON.stringify(body),
  });

const buildBody = (overrides: Record<string, unknown> = {}) => ({
  transactionId: 5,
  refundDate: '2026-06-01',
  amount: 20,
  returnedQuantity: 0,
  reason: 'Customer return',
  ...overrides,
});

describe('clothing customer refund route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (work) =>
      work(mockPrisma)
    );
    mockPrisma.customer.findUnique.mockResolvedValue({ customerName: 'ACME' });
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 5,
      productCode: 'SKU-5',
      quantity: 4,
      lineTotal: 100,
      adjustment: 0,
      unitPrice: 25,
      discount: 0,
      orderStatus: 'Shipped',
    });
    mockPrisma.transactionPayment.findMany.mockResolvedValue([]);
    mockPrisma.transactionRefund.findMany.mockResolvedValue([]);
    mockPrisma.transactionRefund.create.mockImplementation(
      async ({ data }) => ({
        id: 9,
        ...data,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      })
    );
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({ unitCost: 12 });
    mockPrisma.inventoryMovement.create.mockResolvedValue({ id: 10 });
  });

  it('rejects a refund that exceeds prior cumulative refunds without writing', async () => {
    mockPrisma.transactionRefund.findMany.mockResolvedValue([
      { amount: 85, returnedQuantity: 2 },
    ]);
    const { POST } = await import('../route');

    const response = await POST(buildRequest(buildBody({ amount: 16 })), {
      params: { id: '1' },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Refund exceeds transaction limits');
    expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('cannot bypass an approved cancellation through the legacy refund form', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 5,
      cancellation: { id: 'approval-1' },
    });
    const { POST } = await import('../route');
    const response = await POST(buildRequest(buildBody()), {
      params: { id: '1' },
    });
    expect(response.status).toBe(400);
    expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('preserves a completed cash payout and its physical return when delete is requested', async () => {
    mockPrisma.transactionRefund.findFirst.mockResolvedValue({ id: 9 });
    const { DELETE } = await import('../[refundId]/route');
    const response = await DELETE(
      new NextRequest(getTestApiUrl('/api/customers/1/refunds/9'), {
        method: 'DELETE',
      }),
      {
        params: { id: '1', refundId: '9' },
      }
    );
    expect(response.status).toBe(409);
    expect(mockPrisma.transactionRefund.update).not.toHaveBeenCalled();
    expect(mockPrisma.inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('copies the original sale cost to a returned item movement', async () => {
    mockPrisma.inventoryMovement.findFirst
      .mockResolvedValueOnce({ unitCost: 12 })
      .mockResolvedValueOnce(null);
    const { POST } = await import('../route');

    const response = await POST(
      buildRequest(buildBody({ returnedQuantity: 1, restockBucket: 'scrap' })),
      { params: { id: '1' } }
    );

    expect(response.status).toBe(201);
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'SKU-5',
        quantity: 1,
        unitCost: 12,
        fromBucket: 'sold',
        toBucket: 'scrap',
      }),
    });
  });

  it('limits a voided reservation refund to collected deposits less prior refunds', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 5,
      productCode: 'SKU-5',
      quantity: 4,
      lineTotal: 100,
      adjustment: 0,
      unitPrice: 25,
      discount: 0,
      orderStatus: 'Voided',
    });
    mockPrisma.transactionPayment.findMany.mockResolvedValue([{ amount: 30 }]);
    mockPrisma.transactionRefund.findMany.mockResolvedValue([
      { amount: 10, returnedQuantity: 0 },
    ]);
    const { POST } = await import('../route');

    const response = await POST(buildRequest(buildBody({ amount: 20.01 })), {
      params: { id: '1' },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.validationErrors.amount).toBe(
      'Total refunds cannot exceed collected reservation payments.'
    );
    expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('records a voided reservation refund without returning inventory', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 5,
      productCode: 'SKU-5',
      quantity: 4,
      lineTotal: 100,
      adjustment: 0,
      unitPrice: 25,
      discount: 0,
      orderStatus: 'Voided',
    });
    mockPrisma.transactionPayment.findMany.mockResolvedValue([{ amount: 30 }]);
    const { POST } = await import('../route');

    const response = await POST(buildRequest(buildBody({ amount: 30 })), {
      params: { id: '1' },
    });

    expect(response.status).toBe(201);
    expect(mockPrisma.transactionRefund.create).toHaveBeenCalled();
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
