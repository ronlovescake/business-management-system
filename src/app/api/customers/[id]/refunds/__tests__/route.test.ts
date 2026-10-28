import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  customer: { findUnique: vi.fn() },
  transaction: { findFirst: vi.fn() },
  transactionPayment: { findMany: vi.fn() },
  clothingFinancialRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  transactionRefund: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  inventoryMovement: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  splitBatchComponent: { findFirst: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: async () =>
    new Date('2026-01-17T00:00:00.000Z'),
}));
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
    vi.resetAllMocks();
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
    mockPrisma.clothingFinancialRequest.findUnique.mockResolvedValue(null);
    mockPrisma.clothingFinancialRequest.create.mockResolvedValue({});
    mockPrisma.clothingFinancialRequest.update.mockResolvedValue({});
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
    mockPrisma.splitBatchComponent.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryMovement.findMany.mockImplementation(
      async ({ where }) => {
        if (where.movementType === 'return') {
          return [];
        }
        const sale = await mockPrisma.inventoryMovement.findFirst();
        return sale
          ? [
              {
                id: 1,
                productCode: 'SKU-5',
                costBasis: null,
                createdAt: new Date('2026-05-30T00:00:00.000Z'),
                ...sale,
              },
            ]
          : [];
      }
    );
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

  it('records an independent zero-money physical return after an approved cancellation', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 5,
      productCode: 'SKU-5',
      quantity: 4,
      lineTotal: 100,
      adjustment: 0,
      unitPrice: 25,
      discount: 0,
      orderStatus: 'Cancelled',
      cancellation: { id: 'approval-1' },
    });
    mockPrisma.inventoryMovement.findFirst
      .mockResolvedValueOnce({
        quantity: 4,
        unitCost: 12,
        postingDate: '2026-05-30',
      })
      .mockResolvedValueOnce(null);
    const { POST } = await import('../route');
    const request = buildRequest(
      buildBody({ amount: 0, returnedQuantity: 1, restockBucket: 'sellable' })
    );
    request.headers.set(
      'Idempotency-Key',
      '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1'
    );
    const response = await POST(request, { params: { id: '1' } });

    expect(response.status).toBe(201);
    expect(mockPrisma.transactionRefund.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 0, returnedQuantity: 1 }),
      })
    );
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 1,
        unitCost: 12,
        fromBucket: 'sold',
        toBucket: 'sellable',
        postingDate: '2026-06-01',
      }),
    });
    expect(mockPrisma.transactionPayment.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['missing sale', null],
    [
      'missing cost',
      { quantity: 4, unitCost: null, postingDate: '2026-05-30' },
    ],
    [
      'insufficient sold quantity',
      { quantity: 0.5, unitCost: 12, postingDate: '2026-05-30' },
    ],
  ])(
    'rejects a physical-only return with %s without refund or movement writes',
    async (_label, sale) => {
      mockPrisma.inventoryMovement.findFirst.mockResolvedValueOnce(sale);
      const { POST } = await import('../route');
      const request = buildRequest(
        buildBody({ amount: 0, returnedQuantity: 1, restockBucket: 'sellable' })
      );
      request.headers.set(
        'Idempotency-Key',
        '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1'
      );
      const response = await POST(request, { params: { id: '1' } });
      expect(response.status).toBe(400);
      expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    }
  );

  it.each(['2026-01-16', '2026-02-30', '2026-05-29', '2099-01-01'])(
    'rejects an invalid, out-of-period or pre-sale physical-return date %s',
    async (refundDate) => {
      mockPrisma.inventoryMovement.findFirst.mockResolvedValueOnce({
        quantity: 4,
        unitCost: 12,
        postingDate: '2026-05-30',
      });
      const { POST } = await import('../route');
      const request = buildRequest(
        buildBody({
          amount: 0,
          returnedQuantity: 1,
          restockBucket: 'sellable',
          refundDate,
        })
      );
      request.headers.set(
        'Idempotency-Key',
        '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1'
      );
      expect((await POST(request, { params: { id: '1' } })).status).toBe(400);
      expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
      expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    }
  );

  it('replays a physical return once and rejects changed details using the same key', async () => {
    mockPrisma.inventoryMovement.findFirst
      .mockResolvedValueOnce({
        quantity: 4,
        unitCost: 12,
        postingDate: '2026-05-30',
      })
      .mockResolvedValueOnce(null);
    const { POST } = await import('../route');
    const makeRequest = (quantity: number) => {
      const request = buildRequest(
        buildBody({
          amount: 0,
          returnedQuantity: quantity,
          restockBucket: 'sellable',
        })
      );
      request.headers.set(
        'Idempotency-Key',
        '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1'
      );
      return request;
    };
    const first = await POST(makeRequest(1), { params: { id: '1' } });
    expect(first.status).toBe(201);
    mockPrisma.clothingFinancialRequest.findUnique.mockResolvedValue({
      ...mockPrisma.clothingFinancialRequest.create.mock.calls[0][0].data,
      result:
        mockPrisma.clothingFinancialRequest.update.mock.calls[0][0].data.result,
    });
    const replay = await POST(makeRequest(1), { params: { id: '1' } });
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect((await POST(makeRequest(2), { params: { id: '1' } })).status).toBe(
      409
    );
    expect(mockPrisma.transactionRefund.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(1);
  });

  it('requires a stable key for a physical-only return', async () => {
    const { POST } = await import('../route');
    const response = await POST(
      buildRequest(
        buildBody({ amount: 0, returnedQuantity: 1, restockBucket: 'sellable' })
      ),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(400);
    expect(mockPrisma.transactionRefund.create).not.toHaveBeenCalled();
  });

  it('preserves the original free-unit sale provenance on a zero-money physical return', async () => {
    mockPrisma.inventoryMovement.findFirst
      .mockResolvedValueOnce({
        id: 75,
        quantity: 2,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        postingDate: '2026-05-30',
      })
      .mockResolvedValueOnce(null);
    const { POST } = await import('../route');
    const request = buildRequest(
      buildBody({ amount: 0, returnedQuantity: 1, restockBucket: 'sellable' })
    );
    request.headers.set(
      'Idempotency-Key',
      '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1'
    );
    expect((await POST(request, { params: { id: '1' } })).status).toBe(201);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 1,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        sourceMovementId: 75,
        fromBucket: 'sold',
        toBucket: 'sellable',
      }),
    });
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
