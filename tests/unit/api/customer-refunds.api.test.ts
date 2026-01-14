import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {
      customer: {
        findUnique: vi.fn(),
      },
      transaction: {
        findFirst: vi.fn(),
      },
      transactionRefund: {
        create: vi.fn(),
        findMany: vi.fn(),
      },
      inventoryMovement: {
        findFirst: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import { POST } from '@/app/api/customers/[id]/refunds/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

describe('Customer Refunds API - POST /api/customers/:id/refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.$transaction.mockImplementation(
      async (
        callback: (tx: {
          transactionRefund: typeof mockPrisma.transactionRefund;
          inventoryMovement: typeof mockPrisma.inventoryMovement;
        }) => unknown
      ) =>
        callback({
          transactionRefund: mockPrisma.transactionRefund,
          inventoryMovement: mockPrisma.inventoryMovement,
        })
    );

    mockPrisma.customer.findUnique.mockResolvedValue({ customerName: 'Alice' });
    mockPrisma.transaction.findFirst.mockResolvedValue({
      id: 10,
      productCode: 'P-100',
      quantity: 2,
    });
  });

  const createMockRequest = (
    body: unknown,
    url: string = getTestApiUrl('/api/customers/1/refunds')
  ): NextRequest => {
    return {
      url,
      method: 'POST',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => body,
    } as NextRequest;
  };

  it('creates an inventory movement when returnedQuantity > 0', async () => {
    mockPrisma.transactionRefund.create.mockResolvedValue({
      id: 123,
      transactionId: 10,
      refundDate: '2026-01-01',
      amount: 100,
      reason: null,
      returnedQuantity: 1,
      restockBucket: 'sellable',
      notes: 'damaged but kept',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });
    mockPrisma.inventoryMovement.findFirst.mockResolvedValue(null);

    const request = createMockRequest({
      transactionId: 10,
      refundDate: '2026-01-01',
      amount: 100,
      returnedQuantity: 1,
      restockBucket: 'sellable',
      notes: 'damaged but kept',
    });

    const response = await POST(request, { params: { id: '1' } });
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);

    expect(mockPrisma.inventoryMovement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          notes: 'auto-return refund 123',
        }),
      })
    );

    expect(mockPrisma.inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'P-100',
        quantity: 1,
        fromBucket: 'sold',
        toBucket: 'sellable',
        postingDate: '2026-01-01',
        notes: 'auto-return refund 123',
      }),
    });
  });

  it('does not create a duplicate inventory movement for the same refund', async () => {
    mockPrisma.transactionRefund.create.mockResolvedValue({
      id: 456,
      transactionId: 10,
      refundDate: '2026-01-01',
      amount: 100,
      reason: null,
      returnedQuantity: 1,
      restockBucket: 'sellable',
      notes: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    mockPrisma.inventoryMovement.findFirst.mockResolvedValue({ id: 999 });

    const request = createMockRequest({
      transactionId: 10,
      refundDate: '2026-01-01',
      amount: 100,
      returnedQuantity: 1,
      restockBucket: 'sellable',
    });

    const response = await POST(request, { params: { id: '1' } });
    expect(response.status).toBe(201);

    expect(mockPrisma.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it("rejects restockBucket='sold' when returnedQuantity > 0", async () => {
    const request = createMockRequest({
      transactionId: 10,
      refundDate: '2026-01-01',
      amount: 100,
      returnedQuantity: 1,
      restockBucket: 'sold',
    });

    const response = await POST(request, { params: { id: '1' } });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
  });
});
