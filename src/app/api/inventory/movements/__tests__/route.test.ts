import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  product: { findFirst: vi.fn() },
  inventoryMovement: {
    findMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  clothingFinancialRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockUser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mockUser }));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: vi
    .fn()
    .mockResolvedValue(new Date('2020-01-01T00:00:00.000Z')),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const postMovement = (body: Record<string, unknown>) =>
  new NextRequest(getTestApiUrl('/api/inventory/movements'), {
    method: 'POST',
    body: JSON.stringify(body),
  });

const patchMovement = (body: Record<string, unknown>) =>
  new NextRequest(getTestApiUrl('/api/inventory/movements'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

const supplierShortPayload = (overrides: Record<string, unknown> = {}) => ({
  productCode: 'SKU-1',
  quantity: 2,
  fromBucket: 'sellable',
  toBucket: 'supplier_short',
  ...overrides,
});

describe('inventory movement supplier-short resolution', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockUser.mockResolvedValue({ id: 1, role: 'USER' });
    const savedRequests = new Map<string, Record<string, unknown>>();
    mockPrisma.clothingFinancialRequest.findUnique.mockImplementation(
      async ({ where }) => savedRequests.get(where.id) ?? null
    );
    mockPrisma.clothingFinancialRequest.create.mockImplementation(
      async ({ data }) => {
        savedRequests.set(data.id, { ...data, result: null });
        return data;
      }
    );
    mockPrisma.clothingFinancialRequest.update.mockImplementation(
      async ({ where, data }) => {
        const result = { ...savedRequests.get(where.id), ...data };
        savedRequests.set(where.id, result);
        return result;
      }
    );
    mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async (operation) =>
      operation(mockPrisma)
    );
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.inventoryMovement.create.mockImplementation(
      async ({ data }) => ({ id: 1, ...data })
    );
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
      id: 1,
      fromBucket: 'sellable',
      toBucket: 'supplier_short',
      notes: 'Supplier sent fewer units',
      supplierShortResolution: 'UNRESOLVED',
    });
    mockPrisma.inventoryMovement.update.mockImplementation(
      async ({ data }) => ({ id: 1, ...data })
    );
  });

  it('defaults genuine Supplier Short movements to unresolved', async () => {
    const { POST } = await import('../route');
    const response = await POST(postMovement(supplierShortPayload()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ supplierShortResolution: 'UNRESOLVED' }),
    });
    expect(body.data.supplierCreditAmount).toBeNull();
  });

  it('records Additionals as an explicitly zero-cost free-goods receipt', async () => {
    const { POST } = await import('../route');
    const response = await POST(
      postMovement({
        productCode: 'SKU-1',
        quantity: 5,
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        postingDate: '2026-10-28',
        notes: 'additionals supplier bonus',
      })
    );
    expect(response.status).toBe(201);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        quantity: 5,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        movementType: 'free_goods_receipt',
        movementSource: 'inventory_adjustment',
      }),
    });
  });

  it('requires a shipment code when shortage goods are expected later', async () => {
    const { POST } = await import('../route');
    const response = await POST(
      postMovement(
        supplierShortPayload({ supplierShortResolution: 'EXPECTED_LATER' })
      )
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('does not accept supplier-credit metadata on an unrelated movement', async () => {
    const { POST } = await import('../route');
    const response = await POST(
      postMovement({
        ...supplierShortPayload({ toBucket: 'damaged_hold' }),
        supplierCreditReference: 'CREDIT-1',
      })
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('requires an amount when marking a supplier credit received', async () => {
    const { PATCH } = await import('../route');
    const response = await PATCH(
      patchMovement({ id: 1, supplierShortResolution: 'CREDIT_RECEIVED' })
    );

    expect(response.status).toBe(400);
    expect(mockPrisma.inventoryMovement.update).not.toHaveBeenCalled();
  });

  it.each([
    'supplier_nonfulfillment',
    'inventory_transfer',
    'inventory_split',
    'inventory_bundle',
  ])(
    'protects source-owned %s history from editing and deletion',
    async (movementSource) => {
      mockPrisma.inventoryMovement.findFirst.mockResolvedValue({
        id: 1,
        fromBucket: 'sellable',
        toBucket: 'supplier_short',
        movementSource,
      });
      const { PATCH, DELETE } = await import('../route');
      expect((await PATCH(patchMovement({ id: 1, quantity: 1 }))).status).toBe(
        409
      );
      expect(
        (
          await DELETE(
            new Request(getTestApiUrl('/api/inventory/movements?id=1'))
          )
        ).status
      ).toBe(409);
      expect(mockPrisma.inventoryMovement.update).not.toHaveBeenCalled();
    }
  );

  it('rejects a separate reversal that would resurrect nonfulfilled stock', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({ id: 42 });
    const { POST } = await import('../route');
    const response = await POST(
      postMovement(
        supplierShortPayload({
          fromBucket: 'supplier_short',
          toBucket: 'sellable',
        })
      )
    );
    expect(response.status).toBe(409);
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('executes both transfer sides once and rejects changed details using the same key', async () => {
    mockPrisma.product.findFirst.mockImplementation(async ({ where }) => ({
      id: where.productCode.equals === 'SKU-1' ? 1 : 2,
      productCode: where.productCode.equals,
      landedUnitCost: 20,
    }));
    mockPrisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 7,
        quantity: 5,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        postingDate: '2020-01-01',
      },
    ]);
    const payload = {
      ...supplierShortPayload(),
      transferToProductCode: 'DEST',
      postingDate: '2020-01-01',
    };
    const request = (quantity = 2) =>
      new NextRequest(getTestApiUrl('/api/inventory/movements'), {
        method: 'POST',
        headers: { 'Idempotency-Key': '91cd877a-3301-42ba-8de6-32b9a7acf9d4' },
        body: JSON.stringify({ ...payload, quantity }),
      });
    const { POST } = await import('../route');
    expect((await POST(request())).status).toBe(201);
    expect((await POST(request())).status).toBe(201);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect((await POST(request(3))).status).toBe(409);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(mockPrisma.inventoryMovement.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        productCode: 'DEST',
        quantity: 2,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        movementType: 'transfer_in',
      }),
    });
  });

  it('requires an authenticated session and a stable key for atomic transfers', async () => {
    const { POST } = await import('../route');
    const payload = {
      ...supplierShortPayload(),
      transferToProductCode: 'DEST',
    };
    expect((await POST(postMovement(payload))).status).toBe(400);
    mockUser.mockResolvedValue(null);
    expect((await POST(postMovement(payload))).status).toBe(401);
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('rejects old one-sided transfer requests', async () => {
    const { POST } = await import('../route');
    expect(
      (
        await POST(
          postMovement(
            supplierShortPayload({ notes: 'transfer: from:sku-1; to:dest' })
          )
        )
      ).status
    ).toBe(400);
    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
