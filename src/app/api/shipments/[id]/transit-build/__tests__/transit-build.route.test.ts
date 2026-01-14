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
    findUnique: vi.fn(),
  },
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
    expect(body.data.amount).toBe(300);
    expect(body.data.debitAccount).toBe('Inventory in Transit');
    expect(body.data.creditAccount).toBe('Cash');

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
    expect(body.data.id).toBe('tb-existing');
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
});
