import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

type TransitBuildEntry = {
  idempotencyKey: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
};

const mockPrisma = vi.hoisted(() => {
  const gmCreateMany = vi.fn();
  return {
    product: {},
    generalMerchandiseProduct: {
      findMany: vi.fn(),
    },
    generalMerchandiseInventoryTransitBuildEntry: {
      findMany: vi.fn(),
      createMany: gmCreateMany,
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({
      generalMerchandiseInventoryTransitBuildEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: gmCreateMany,
      },
    })),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('generalMerchandiseProductService manual transit build-up (by shipment code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.createMany.mockResolvedValue(
      {
        count: 0,
      }
    );
  });

  it('posts Grand Total to Inventory in Transit, but Forwarder/Lalamove to Landed Cost Clearing (Paid)', async () => {
    vi.resetModules();
    const { generalMerchandiseProductService } = await import('../service');

    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
      {
        id: 10,
        productCode: 'GM-001',
        product: 'GM Product',
        payment: 'Paid',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 300,
        forwardersFee: 30,
        lalamove: 12,
      },
    ]);

    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.createMany.mockResolvedValue(
      {
        count: 1,
      }
    );

    await generalMerchandiseProductService.postManualTransitBuildUpByShipmentCode(
      {
        shipmentCode: 'GM-SHIP-001',
      }
    );

    const createManyCalls = mockPrisma
      .generalMerchandiseInventoryTransitBuildEntry.createMany.mock
      .calls as Array<[{ data: TransitBuildEntry[] }]>;

    const data = createManyCalls[0]?.[0]?.data ?? [];

    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Cash',
      amount: 300,
    });
  });

  it('credits supplier payable vs forwarder/courier payables when Unpaid', async () => {
    vi.resetModules();
    const { generalMerchandiseProductService } = await import('../service');

    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([
      {
        id: 11,
        productCode: 'GM-002',
        product: 'GM Product 2',
        payment: 'Unpaid',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 400,
        forwardersFee: 40,
        lalamove: 15,
      },
    ]);

    mockPrisma.generalMerchandiseInventoryTransitBuildEntry.createMany.mockResolvedValue(
      {
        count: 1,
      }
    );

    await generalMerchandiseProductService.postManualTransitBuildUpByShipmentCode(
      {
        shipmentCode: 'GM-SHIP-002',
      }
    );

    const createManyCalls = mockPrisma
      .generalMerchandiseInventoryTransitBuildEntry.createMany.mock
      .calls as Array<[{ data: TransitBuildEntry[] }]>;

    const data = createManyCalls[0]?.[0]?.data ?? [];

    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Supplier Payable',
      amount: 400,
    });
  });
});
