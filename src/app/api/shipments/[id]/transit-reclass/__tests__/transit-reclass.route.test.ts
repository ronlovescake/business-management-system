import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/shipments/[id]/transit-reclass/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  shipment: {
    findUnique: vi.fn(),
  },
  clothingInventoryTransitBuildEntry: {
    findMany: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  clothingInventoryReclassEntry: {
    findMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('POST /api/shipments/[id]/transit-reclass', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates reclass entries when transit build-up totals match product valuation totals', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
      shipmentStatus: 'Delivered',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      {
        id: 'tb-1',
        idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:KPC-001:SPLIT:PAID',
        amount: 100,
        debitAccount: 'Inventory in Transit',
        creditAccount: 'Cash',
        postingDate: new Date('2026-01-14T00:00:00.000Z'),
      },
      {
        id: 'tb-2',
        idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:KPC-001:SPLIT:SUPPLIER_PAYABLE',
        amount: 200,
        debitAccount: 'Inventory in Transit',
        creditAccount: 'Accounts Payable',
        postingDate: new Date('2026-01-14T00:00:00.000Z'),
      },
    ]);

    mockPrisma.product.findMany.mockResolvedValue([
      {
        productCode: 'P-1',
        cogs: 100,
        grandTotal: 0,
        forwardersFee: 0,
        lalamove: 0,
        packagingCost: 0,
      },
      {
        productCode: 'P-2',
        cogs: 200,
        grandTotal: 0,
        forwardersFee: 0,
        lalamove: 0,
        packagingCost: 0,
      },
    ]);

    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.createMany.mockResolvedValue({
      count: 2,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-reclass'),
      body: {
        postingDate: '2026-02-01',
        selectedIdempotencyKeys: [
          'SHIPMENT_TRANSIT_BUILD:KPC-001:SPLIT:PAID',
          'SHIPMENT_TRANSIT_BUILD:KPC-001:SPLIT:SUPPLIER_PAYABLE',
        ],
        notes: 'Reclass after delivery',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.createdCount).toBe(2);
    expect(body.data.expectedTotalAmount).toBe(300);
    expect(body.data.selectedTransitTotalAmount).toBe(300);

    expect(
      mockPrisma.clothingInventoryReclassEntry.createMany
    ).toHaveBeenCalled();
  });

  it('rejects when transit build-up total does not match product valuation total', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
      shipmentStatus: 'Delivered',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      {
        id: 'tb-1',
        idempotencyKey: 'SHIPMENT_TRANSIT_BUILD:KPC-001:SPLIT:PAID',
        amount: 250,
        debitAccount: 'Inventory in Transit',
        creditAccount: 'Cash',
        postingDate: new Date('2026-01-14T00:00:00.000Z'),
      },
    ]);

    mockPrisma.product.findMany.mockResolvedValue([
      {
        productCode: 'P-1',
        cogs: 300,
        grandTotal: 0,
        forwardersFee: 0,
        lalamove: 0,
        packagingCost: 0,
      },
    ]);

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-reclass'),
      body: {
        postingDate: '2026-02-01',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe(
      'Transit build-up total does not match product valuation total'
    );
  });

  it('rejects when there are no transit build-up entries', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
      shipmentStatus: 'Delivered',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-reclass'),
      body: {
        postingDate: '2026-02-01',
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('No transit build-up entries found for shipment');
  });

  it('rejects when shipment status is not Delivered', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
      shipmentStatus: 'In Transit',
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-reclass'),
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

  it('reclasses product-origin transit build entries using their exact posted amounts', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 1,
      shipmentCode: 'KPC-001',
      shipmentStatus: 'Delivered',
    });

    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      {
        id: 'tb-1',
        idempotencyKey: 'PRODUCT_TRANSIT_BUILD:10:GRAND_TOTAL',
        amount: 100,
      },
    ]);

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 10,
        productCode: 'P-1',
        cogs: 115,
        grandTotal: 100,
        forwardersFee: 10,
        lalamove: 5,
        packagingCost: 0,
      },
    ]);

    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.createMany.mockResolvedValue({
      count: 1,
    });

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/shipments/1/transit-reclass'),
      body: {
        postingDate: '2026-02-01',
        selectedIdempotencyKeys: ['PRODUCT_TRANSIT_BUILD:10:GRAND_TOTAL'],
      },
    });

    const context: { params: { id: string } } = { params: { id: '1' } };

    const response = await POST(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.createdCount).toBe(1);
    expect(body.data.expectedTotalAmount).toBe(100);
    expect(body.data.selectedTransitTotalAmount).toBe(100);
    expect(
      mockPrisma.clothingInventoryReclassEntry.createMany
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            productCode: 'P-1',
            amount: 100,
            fromAccount: 'Inventory in Transit',
            toAccount: 'Stock on Hand',
          }),
        ],
        skipDuplicates: true,
      })
    );
  });
});
