import { describe, expect, it, beforeEach, vi } from 'vitest';
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'test-admin', role: 'ADMIN' })),
}));
import { POST } from '@/app/api/shipments/[id]/transit-reclass/route';
import { mockNextRequest, getTestApiUrl } from '@/core/testing/test-helpers';

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
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
    mockPrisma.$transaction.mockImplementation(
      async (operation: (client: typeof mockPrisma) => Promise<unknown>) =>
        operation(mockPrisma)
    );
  });

  it('reclasses opening-funded supplier cost without adding fees or another equity or payment entry', async () => {
    mockPrisma.shipment.findUnique.mockResolvedValue({
      id: 236,
      shipmentCode: 'KPC 23930A-236',
      shipmentStatus: 'Delivered',
    });
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue([
      {
        id: 'opening-pso',
        idempotencyKey: 'PRODUCT_TRANSIT_BUILD:290:GRAND_TOTAL',
        amount: 30636.64,
        postingDate: new Date('2026-10-12T00:00:00.000Z'),
        debitAccount: 'Inventory in Transit',
        creditAccount: 'Opening Equity',
      },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 290,
        productCode: 'PSO-101226',
        grandTotal: 30636.64,
        cogs: 35166.64,
        forwardersFee: 1530,
        lalamove: 1500,
        packagingCost: 1500,
      },
    ]);
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.createMany.mockResolvedValue({
      count: 1,
    });

    const response = await POST(
      mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/shipments/236/transit-reclass'),
        body: {
          postingDate: '2026-10-13',
          selectedIdempotencyKeys: ['PRODUCT_TRANSIT_BUILD:290:GRAND_TOTAL'],
        },
      }),
      { params: { id: '236' } }
    );

    expect(response.status).toBe(200);
    expect((await response.json()).data.selectedTransitTotalAmount).toBe(
      30636.64
    );
    expect(
      mockPrisma.clothingInventoryReclassEntry.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productId: 290,
          productCode: 'PSO-101226',
          amount: 30636.64,
          postingDate: new Date('2026-10-13T00:00:00.000Z'),
          fromAccount: 'Inventory in Transit',
          toAccount: 'Stock on Hand',
        }),
      ],
      skipDuplicates: true,
    });
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

  it('does not reclass a stable product identity again after its code changes', async () => {
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
      { id: 10, productCode: 'NEW', cogs: 100 },
    ]);
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([
      { productId: 10, productCode: 'OLD' },
    ]);

    const response = await POST(
      mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/shipments/1/transit-reclass'),
        body: { postingDate: '2026-02-01' },
      }),
      { params: { id: '1' } }
    );

    expect((await response.json()).data.createdCount).toBe(0);
    expect(
      mockPrisma.clothingInventoryReclassEntry.createMany
    ).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: 'ACTIVE',
      selected: ['PRODUCT_TRANSIT_BUILD:10:GRAND_TOTAL'],
      message: 'all funding components',
    },
    {
      status: 'CREDIT_ISSUED',
      selected: [
        'PRODUCT_TRANSIT_BUILD:10:GRAND_TOTAL',
        'PRODUCT_TRANSIT_BUILD:10:SUPPLIER_CREDIT',
      ],
      message: 'supplier-nonfulfilled',
    },
  ])(
    'rejects incomplete or nonfulfilled product selections: $status',
    async ({ status, selected, message }) => {
      mockPrisma.shipment.findUnique.mockResolvedValue({
        id: 1,
        shipmentCode: 'KPC-001',
        shipmentStatus: 'Delivered',
      });
      const entries = [
        {
          id: 'tb-1',
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:10:GRAND_TOTAL',
          amount: 2000,
          debitAccount: 'Inventory in Transit',
          creditAccount: 'Credit Card Payable',
        },
        {
          id: 'tb-2',
          idempotencyKey: 'PRODUCT_TRANSIT_BUILD:10:SUPPLIER_CREDIT',
          amount: 1000,
          debitAccount: 'Inventory in Transit',
          creditAccount: 'Supplier Credits',
        },
      ];
      mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockImplementation(
        async (args) => {
          const keys = args.where.idempotencyKey?.in;
          return keys
            ? entries.filter((entry) => keys.includes(entry.idempotencyKey))
            : entries;
        }
      );
      mockPrisma.product.findMany.mockResolvedValue([
        { id: 10, productCode: 'P-1', supplierFulfillmentStatus: status },
      ]);
      const response = await POST(
        mockNextRequest({
          method: 'POST',
          url: getTestApiUrl('/api/shipments/1/transit-reclass'),
          body: {
            postingDate: '2026-02-01',
            selectedIdempotencyKeys: selected,
          },
        }),
        { params: { id: '1' } }
      );
      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain(message);
      expect(
        mockPrisma.clothingInventoryReclassEntry.createMany
      ).not.toHaveBeenCalled();
    }
  );

  it('reports the actual insert count when idempotency skips a row', async () => {
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
      { id: 10, productCode: 'P-1', cogs: 100 },
    ]);
    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryReclassEntry.createMany.mockResolvedValue({
      count: 0,
    });

    const response = await POST(
      mockNextRequest({
        method: 'POST',
        url: getTestApiUrl('/api/shipments/1/transit-reclass'),
        body: { postingDate: '2026-02-01' },
      }),
      { params: { id: '1' } }
    );

    expect((await response.json()).data).toMatchObject({
      createdCount: 0,
      skippedCount: 1,
    });
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
