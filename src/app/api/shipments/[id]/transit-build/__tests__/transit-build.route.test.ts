import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/shipments/[id]/transit-build/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  shipment: {
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/shipments/[id]/transit-build', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new transit build-up entry', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
    });

    mockPrisma.product.findMany.mockResolvedValue([
      { cogs: 100 },
      { cogs: 200 },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue({
      id: 'tb-1',
      postingDate: new Date('2026-01-14T00:00:00.000Z'),
      amount: 300,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-build'),
      body: {
        postingDate: '2026-01-14',
        creditAccount: 'Cash',
        notes: 'Paid supplier',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.wasDuplicate).toBe(false);
    expect(body.data.expectedTotalAmount).toBe(300);
    expect(body.data.entries).toHaveLength(1);
    expect(body.data.entries[0].amount).toBe(300);
    expect(body.data.entries[0].debitAccount).toBe('Inventory in Transit');
    expect(body.data.entries[0].creditAccount).toBe('Cash');

    expect(
      mockPrisma.clothingInventoryTransitBuildEntry.create
    ).toHaveBeenCalled();
  });

  it('returns success with wasDuplicate=true when the entry already exists', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
    });

    mockPrisma.product.findMany.mockResolvedValue([{ cogs: 300 }]);

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    mockPrisma.clothingInventoryTransitBuildEntry.create.mockRejectedValue({
      code: 'P2002',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findUnique.mockResolvedValue({
      id: 'tb-existing',
      postingDate: new Date('2026-01-14T00:00:00.000Z'),
      amount: 300,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-build'),
      body: {
        postingDate: '2026-01-14',
        creditAccount: 'Cash',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.wasDuplicate).toBe(true);
    expect(body.data.entries).toHaveLength(1);
    expect(body.data.entries[0].id).toBe('tb-existing');
  });

  it('rejects invalid credit accounts', async () => {
    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-build'),
      body: {
        postingDate: '2026-01-14',
        creditAccount: 'Random Account',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid credit account');
  });

  it('creates split-mode entries including supplier payable', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
    });

    mockPrisma.product.findMany.mockResolvedValue([
      { cogs: 100 },
      { cogs: 200 },
    ]);

    // No existing parts
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    type UpsertCreate = {
      idempotencyKey: string;
      shipmentId: number;
      shipmentCode: string;
      amount: number;
      creditAccount: string;
    };
    type UpsertArgs = { create: UpsertCreate };

    mockPrisma.clothingInventoryTransitBuildEntry.upsert.mockImplementation(
      async ({ create }: UpsertArgs) => ({
        id: `tb-${create.idempotencyKey}`,
        postingDate: new Date('2026-01-14T00:00:00.000Z'),
        shipmentId: create.shipmentId,
        shipmentCode: create.shipmentCode,
        amount: create.amount,
        creditAccount: create.creditAccount,
        idempotencyKey: create.idempotencyKey,
        deletedAt: null,
      })
    );

    mockPrisma.$transaction.mockImplementation(
      async (ops: Array<Promise<unknown>>) => Promise.all(ops)
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-build'),
      body: {
        postingDate: '2026-01-14',
        paidAccount: 'Cash',
        paidAmount: 100,
        supplierEstimate: 200,
        forwarderEstimate: 0,
        courierEstimate: 0,
        notes: 'Partially paid supplier',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.expectedTotalAmount).toBe(300);
    expect(body.data.totalAmount).toBe(300);
    expect(body.data.entries).toHaveLength(2);

    const creditAccounts = (
      body.data.entries as Array<{ creditAccount: string }>
    ).map((entry) => entry.creditAccount);
    expect(creditAccounts).toContain('Cash');
    expect(creditAccounts).toContain('Accounts Payable');
  });

  it('falls back to derived COGS when cogs is missing', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
    });

    mockPrisma.product.findMany.mockResolvedValue([
      {
        cogs: 0,
        grandTotal: 100,
        forwardersFee: 10,
        lalamove: 5,
        packagingCost: 0,
      },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    mockPrisma.clothingInventoryTransitBuildEntry.create.mockResolvedValue({
      id: 'tb-1',
      postingDate: new Date('2026-01-14T00:00:00.000Z'),
      amount: 115,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-build'),
      body: {
        postingDate: '2026-01-14',
        creditAccount: 'Cash',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.expectedTotalAmount).toBe(115);
    expect(body.data.entries[0].amount).toBe(115);
  });
});
