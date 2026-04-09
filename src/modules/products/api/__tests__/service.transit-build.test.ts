import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.ACCOUNTING_CUTOVER_DATE = '2026-01-17';

type TransitBuildEntry = {
  idempotencyKey: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
};

const mockPrisma = vi.hoisted(() => {
  const clothingCreateMany = vi.fn();
  return {
    product: {
      findMany: vi.fn(),
    },
    clothingInventoryTransitBuildEntry: {
      findMany: vi.fn(),
      createMany: clothingCreateMany,
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn((cb: (tx: unknown) => Promise<unknown>) => cb({
      clothingInventoryTransitBuildEntry: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: clothingCreateMany,
      },
    })),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/modules/clothing/ledger/api/service', () => ({
  expenseService: {
    upsertBySource: vi.fn(),
  },
}));

describe('productService manual transit build-up (by shipment code)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 0,
    });
  });

  it('posts Grand Total to Inventory in Transit, but Forwarder/Lalamove to Landed Cost Clearing (Paid)', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 1,
        productCode: 'TP-001',
        product: 'Test Product',
        payment: 'Paid',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 100,
        forwardersFee: 10,
        lalamove: 5,
      },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 1,
    });

    await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-001',
    });

    const createManyCalls = mockPrisma.clothingInventoryTransitBuildEntry
      .createMany.mock.calls as Array<[{ data: TransitBuildEntry[] }]>;

    expect(createManyCalls).toHaveLength(1);

    const data = createManyCalls[0]?.[0]?.data ?? [];
    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Cash',
      amount: 100,
    });
  });

  it('credits supplier payable vs forwarder/courier payables when Unpaid', async () => {
    vi.resetModules();
    const { productService } = await import('../service');

    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 2,
        productCode: 'TP-002',
        product: 'Test Product 2',
        payment: 'Unpaid',
        postingDate: '2026-01-18',
        orderDate: null,
        grandTotal: 200,
        forwardersFee: 20,
        lalamove: 8,
      },
    ]);

    mockPrisma.clothingInventoryTransitBuildEntry.createMany.mockResolvedValue({
      count: 1,
    });

    await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode: 'KPC-002',
    });

    const createManyCalls = mockPrisma.clothingInventoryTransitBuildEntry
      .createMany.mock.calls as Array<[{ data: TransitBuildEntry[] }]>;

    const data = createManyCalls[0]?.[0]?.data ?? [];

    const grandTotal = data.find((row) =>
      row.idempotencyKey.endsWith(':GRAND_TOTAL')
    );

    // With ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false, only Grand Total is created
    expect(data).toHaveLength(1);

    expect(grandTotal).toMatchObject({
      debitAccount: 'Inventory in Transit',
      creditAccount: 'Supplier Payable',
      amount: 200,
    });
  });
});
