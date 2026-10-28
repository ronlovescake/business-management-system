import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mock = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
    bundleBatch: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    splitBatch: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn() },
    transaction: { findFirst: vi.fn(), findMany: vi.fn() },
    product: { findFirst: vi.fn(), create: vi.fn() },
    inventoryMovement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    clothingFinancialRequest: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  user: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: mock.prisma }));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mock.user }));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: async () => new Date('2026-01-17T00:00:00Z'),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const body = {
  postingDate: '2026-06-01',
  bundleName: 'Kit',
  bundleSku: 'KIT',
  quantity: 2,
  price: 99,
  components: [
    { productCode: 'TOP', includedQuantity: 2 },
    { productCode: 'BOTTOM', includedQuantity: 1 },
  ],
};
const key = '93e8abea-8bb9-4f4b-927c-1d3f4dbf04c1';
const request = (payload = body, requestId: string | null = key) =>
  new NextRequest('http://localhost/api/bundles', {
    method: 'POST',
    headers: requestId ? { 'Idempotency-Key': requestId } : {},
    body: JSON.stringify(payload),
  });

describe('recorded bundle assembly route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const registry = new Map<string, Record<string, unknown>>();
    mock.user.mockResolvedValue({ id: 'user-1', role: 'USER' });
    mock.prisma.$transaction.mockImplementation(async (work) =>
      work(mock.prisma)
    );
    mock.prisma.bundleBatch.create.mockImplementation(async ({ data }) => ({
      id: 7,
      ...data,
    }));
    mock.prisma.bundleBatch.findUnique.mockResolvedValue({ id: 7 });
    mock.prisma.product.findFirst.mockResolvedValue({ id: 8 });
    mock.prisma.inventoryMovement.findFirst.mockResolvedValue(null);
    mock.prisma.inventoryMovement.findMany.mockImplementation(
      async ({ where }) => [
        {
          id: where.productCode.equals === 'TOP' ? 1 : 2,
          productCode: where.productCode.equals,
          quantity: 10,
          unitCost: where.productCode.equals === 'TOP' ? 5 : 10,
          costBasis: 'RECORDED_COST',
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
        },
      ]
    );
    mock.prisma.inventoryMovement.create.mockImplementation(
      async ({ data }) => ({
        id: 20 + mock.prisma.inventoryMovement.create.mock.calls.length,
        ...data,
      })
    );
    mock.prisma.clothingFinancialRequest.findUnique.mockImplementation(
      async ({ where }) => registry.get(where.id) ?? null
    );
    mock.prisma.clothingFinancialRequest.create.mockImplementation(
      async ({ data }) => {
        registry.set(data.id, { ...data });
        return data;
      }
    );
    mock.prisma.clothingFinancialRequest.update.mockImplementation(
      async ({ where, data }) => {
        const updated = { ...registry.get(where.id), ...data };
        registry.set(where.id, updated);
        return updated;
      }
    );
  });

  it('records source-cost assembly once and replays the same request without duplicate inventory', async () => {
    const { POST } = await import('../route');
    const first = await POST(request());
    expect(first.status).toBe(201);
    expect((await POST(request())).status).toBe(201);
    expect(mock.prisma.bundleBatch.create).toHaveBeenCalledTimes(1);
    expect(mock.prisma.inventoryMovement.create).toHaveBeenCalledTimes(3);
    expect(mock.prisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'KIT',
        quantity: 2,
        unitCost: 20,
        movementType: 'bundle_receipt',
      }),
    });
    expect((await POST(request({ ...body, quantity: 3 }))).status).toBe(409);
  });

  it.each([null, 'not-a-uuid'])(
    'requires a valid stable assembly save key %s',
    async (requestId) => {
      const { POST } = await import('../route');
      expect((await POST(request(body, requestId))).status).toBe(400);
      expect(mock.prisma.bundleBatch.create).not.toHaveBeenCalled();
    }
  );

  it('rejects unauthenticated assembly before writing', async () => {
    mock.user.mockResolvedValue(null);
    const { POST } = await import('../route');
    expect((await POST(request())).status).toBe(401);
    expect(mock.prisma.bundleBatch.create).not.toHaveBeenCalled();
  });

  it.each(['2026-02-30', '2026-01-16', '2099-01-01'])(
    'rejects invalid or out-of-period assembly date %s',
    async (postingDate) => {
      const { POST } = await import('../route');
      expect((await POST(request({ ...body, postingDate }))).status).toBe(400);
      expect(mock.prisma.bundleBatch.create).not.toHaveBeenCalled();
    }
  );

  it('protects recorded assembly movements from definition edits and deletion', async () => {
    mock.prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 1 });
    const { PATCH, DELETE } = await import('../route');
    expect(
      (
        await PATCH(
          new NextRequest('http://localhost/api/bundles', {
            method: 'PATCH',
            body: JSON.stringify({ ...body, id: 7 }),
          })
        )
      ).status
    ).toBe(409);
    expect(
      (
        await DELETE(
          new NextRequest('http://localhost/api/bundles?id=7', {
            method: 'DELETE',
          })
        )
      ).status
    ).toBe(409);
    expect(mock.prisma.bundleBatch.update).not.toHaveBeenCalled();
    expect(mock.prisma.bundleBatch.delete).not.toHaveBeenCalled();
    expect(mock.prisma.inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('does not erase original mix sales through definition edits or deletion', async () => {
    mock.prisma.bundleBatch.findUnique.mockResolvedValue({
      id: 7,
      bundleName: '[MIXMATCH] Pool',
      bundleSku: 'MIX',
    });
    mock.prisma.transaction.findFirst.mockResolvedValue({ id: 9 });
    mock.prisma.transaction.findMany.mockResolvedValue([{ id: 9 }]);
    const { PATCH, DELETE } = await import('../../mix-and-match/route');
    const payload = {
      id: 7,
      postingDate: '2026-06-01',
      mixAndMatchName: 'Pool',
      mixAndMatchSku: 'MIX',
      price: 99,
      components: body.components,
    };
    expect(
      (
        await PATCH(
          new NextRequest('http://localhost/api/mix-and-match', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        )
      ).status
    ).toBe(409);
    expect(
      (
        await DELETE(
          new NextRequest('http://localhost/api/mix-and-match?id=7', {
            method: 'DELETE',
          })
        )
      ).status
    ).toBe(409);
    expect(mock.prisma.inventoryMovement.updateMany).not.toHaveBeenCalled();
    expect(mock.prisma.bundleBatch.update).not.toHaveBeenCalled();
    expect(mock.prisma.bundleBatch.delete).not.toHaveBeenCalled();
  });

  it('does not rewrite or delete an opened split component definition', async () => {
    mock.prisma.splitBatch.findUnique.mockResolvedValue({
      id: 7,
      splitSku: 'SET',
    });
    mock.prisma.inventoryMovement.findFirst.mockResolvedValue({ id: 1 });
    const { PATCH, DELETE } = await import('../../split-batches/route');
    const payload = {
      id: 7,
      postingDate: '2026-06-01',
      splitSku: 'SET',
      components: [
        {
          componentLabel: 'Top',
          componentSku: 'TOP',
          componentPrice: 50,
          includedQuantity: 2,
          acquisitionUnitCost: 5,
        },
        {
          componentLabel: 'Bottom',
          componentSku: 'BOTTOM',
          componentPrice: 50,
          includedQuantity: 1,
          acquisitionUnitCost: 10,
        },
      ],
    };
    expect(
      (
        await PATCH(
          new NextRequest('http://localhost/api/split-batches', {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        )
      ).status
    ).toBe(409);
    expect(
      (
        await DELETE(
          new NextRequest('http://localhost/api/split-batches?id=7', {
            method: 'DELETE',
          })
        )
      ).status
    ).toBe(409);
    expect(mock.prisma.splitBatch.update).not.toHaveBeenCalled();
    expect(mock.prisma.splitBatch.delete).not.toHaveBeenCalled();
  });
});
