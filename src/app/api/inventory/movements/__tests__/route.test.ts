import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  inventoryMovement: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
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
    vi.clearAllMocks();
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
});
