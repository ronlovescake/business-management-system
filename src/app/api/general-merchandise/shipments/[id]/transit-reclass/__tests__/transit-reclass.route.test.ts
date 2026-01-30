import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/general-merchandise/shipments/[id]/transit-reclass/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseShipment: {
    findUnique: vi.fn(),
  },
  generalMerchandiseInventoryTransitBuildEntry: {
    findMany: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseInventoryReclassEntry: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/general-merchandise/shipments/[id]/transit-reclass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates reclass entries when totals match', async () => {
    mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'GM-001',
      shipmentStatus: 'Delivered',
    });

    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany.mockResolvedValue(
      [
        {
          id: 'tb-1',
          idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:GM-001:SPLIT:PAID',
          amount: 300,
          debitAccount: 'Inventory in Transit',
          creditAccount: 'Cash',
          postingDate: new Date('2026-01-14T00:00:00.000Z'),
        },
      ]
    );

    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
      {
        productCode: 'GM-P-1',
        cogs: 300,
        grandTotal: 0,
        forwardersFee: 0,
        lalamove: 0,
        packagingCost: 0,
      },
    ]);

    mockPrisma.generalMerchandiseInventoryReclassEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandiseInventoryReclassEntry.createMany.mockResolvedValue(
      { count: 1 }
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl(
        '/api/general-merchandise/shipments/1/transit-reclass'
      ),
      body: {
        postingDate: '2026-02-01',
        notes: 'Manual reclass',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.createdCount).toBe(1);
    expect(body.data.expectedTotalAmount).toBe(300);
    expect(body.data.selectedTransitTotalAmount).toBe(300);
  });

  it('rejects when shipment status is not Delivered', async () => {
    mockPrisma.generalMerchandiseShipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'GM-001',
      shipmentStatus: 'In Transit',
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl(
        '/api/general-merchandise/shipments/1/transit-reclass'
      ),
      body: {
        postingDate: '2026-02-01',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Shipment must be Delivered before reclassing');
  });
});
