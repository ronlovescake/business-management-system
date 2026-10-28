import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  bundleBatch: {
    findMany: vi.fn(),
  },
  product: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  splitBatch: {
    findFirst: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
  inventoryMovement: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import { checkClothingStock } from '../stockCheckService';

describe('checkClothingStock', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma.bundleBatch.findMany.mockResolvedValue([]);
    mockPrisma.product.findFirst.mockResolvedValue(null);
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.splitBatch.findFirst.mockResolvedValue(null);
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.inventoryMovement.findMany.mockResolvedValue([]);
  });

  it('returns direct product availability after active demand', async () => {
    mockPrisma.product.findFirst.mockResolvedValue({ quantity: 30 });
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        quantity: 4,
        orderStatus: 'Warehouse',
      },
    ]);

    const result = await checkClothingStock({
      productCode: 'SKU-1',
      requestedQuantity: 2,
    });

    expect(result).toMatchObject({
      productCode: 'SKU-1',
      availableStock: 26,
      requestedQuantity: 2,
      status: 'IN_STOCK',
      canFulfill: true,
      message: '26 units available',
    });
  });

  it.each([0, 1000])(
    'counts supplier-free additional units once with %s paid units already sold',
    async (sold) => {
      mockPrisma.product.findFirst.mockResolvedValue({
        productCode: 'ONESIES',
        quantity: 1000,
      });
      mockPrisma.product.findMany.mockResolvedValue([
        { productCode: 'ONESIES', quantity: 1000 },
      ]);
      mockPrisma.inventoryMovement.findMany.mockResolvedValue([
        {
          productCode: 'ONESIES',
          quantity: 100,
          fromBucket: 'supplier_short',
          toBucket: 'sellable',
          notes: 'additionals: free supplier units',
        },
      ]);
      mockPrisma.transaction.findMany.mockResolvedValue(
        sold
          ? [{ productCode: 'ONESIES', quantity: sold, orderStatus: 'Shipped' }]
          : []
      );
      const result = await checkClothingStock({
        productCode: 'ONESIES',
        requestedQuantity: 100,
      });
      expect(result.availableStock).toBe(1100 - sold);
      expect(result.canFulfill).toBe(true);
    }
  );

  it('combines assembled bundle stock with component-constrained capacity', async () => {
    mockPrisma.bundleBatch.findMany.mockResolvedValue([
      {
        bundleName: 'Starter Bundle',
        bundleSku: 'BUNDLE-1',
        components: [
          { componentProductCode: 'COMP-A', includedQuantity: 1 },
          { componentProductCode: 'COMP-B', includedQuantity: 2 },
        ],
      },
    ]);
    mockPrisma.product.findFirst.mockResolvedValue({ quantity: 1 });
    mockPrisma.product.findMany.mockResolvedValue([
      { productCode: 'COMP-A', quantity: 4 },
      { productCode: 'COMP-B', quantity: 6 },
      { productCode: 'BUNDLE-1', quantity: 1 },
    ]);

    const result = await checkClothingStock({
      productCode: 'BUNDLE-1',
      requestedQuantity: 2,
    });

    expect(result).toMatchObject({
      productCode: 'BUNDLE-1',
      availableStock: 4,
      requestedQuantity: 2,
      status: 'LOW_STOCK',
      canFulfill: true,
      message:
        'Bundle availability: 1 assembled + 3 via components (limited by COMP-B)',
    });
  });

  it('uses pooled component capacity for mix-and-match stock checks', async () => {
    mockPrisma.bundleBatch.findMany.mockResolvedValue([
      {
        bundleName: '[MIXMATCH] Pool Mix',
        bundleSku: 'MIX-1',
        components: [
          { componentProductCode: 'COMP-A', includedQuantity: 1 },
          { componentProductCode: 'COMP-B', includedQuantity: 1 },
        ],
      },
    ]);
    mockPrisma.product.findMany.mockResolvedValue([
      { productCode: 'COMP-A', quantity: 4 },
      { productCode: 'COMP-B', quantity: 6 },
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        productCode: 'COMP-A',
        quantity: 1,
        orderStatus: 'Warehouse',
      },
    ]);

    const result = await checkClothingStock({
      productCode: 'MIX-1',
      requestedQuantity: 2,
    });

    expect(result).toMatchObject({
      productCode: 'MIX-1',
      availableStock: 9,
      requestedQuantity: 2,
      status: 'LOW_STOCK',
      canFulfill: true,
      message: 'Only 7 units remaining',
    });
  });

  it('reports split-child stock from loose pieces plus remaining parent sets', async () => {
    mockPrisma.product.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ quantity: 328 });
    mockPrisma.splitBatch.findFirst.mockResolvedValue({
      splitSku: 'SET-1',
      components: [
        { componentSku: 'TOP-1', includedQuantity: 1 },
        { componentSku: 'BOTTOM-1', includedQuantity: 1 },
      ],
    });
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        productCode: 'TOP-1',
        quantity: 300,
        orderStatus: 'Warehouse',
        unitPrice: 100,
      },
      {
        productCode: 'BOTTOM-1',
        quantity: 300,
        orderStatus: 'Warehouse',
        unitPrice: 100,
      },
    ]);

    const result = await checkClothingStock({
      productCode: 'TOP-1',
      requestedQuantity: 20,
    });

    expect(result).toMatchObject({
      productCode: 'TOP-1',
      availableStock: 28,
      requestedQuantity: 20,
      status: 'IN_STOCK',
      canFulfill: true,
      message:
        'Split-child of "SET-1": 0 loose piece(s) + 28 complete set(s) remaining',
    });
  });

  it.each([
    ['SET', 9],
    ['TOP', 19],
    ['BOTTOM', 10],
  ])(
    'uses actual opened and returned split lots for %s instead of reallocating the sale',
    async (productCode, expected) => {
      mockPrisma.product.findFirst.mockResolvedValue({ quantity: 10 });
      mockPrisma.splitBatch.findFirst.mockResolvedValue({
        splitSku: 'SET',
        components: [
          { componentSku: 'TOP', includedQuantity: 2 },
          { componentSku: 'BOTTOM', includedQuantity: 1 },
        ],
      });
      mockPrisma.transaction.findMany.mockResolvedValue([
        { productCode: 'TOP', quantity: 2, orderStatus: 'Shipped' },
      ]);
      const rows = [
        {
          id: 1,
          productCode: 'SET',
          quantity: 10,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          unitCost: 20,
        },
        {
          id: 2,
          productCode: 'SET',
          quantity: 1,
          fromBucket: 'sellable',
          toBucket: 'opening_inventory',
          unitCost: 20,
          movementSource: 'inventory_split',
          sourceMovementId: 1,
        },
        {
          id: 3,
          productCode: 'TOP',
          quantity: 2,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          unitCost: 5,
          movementSource: 'inventory_split',
          sourceMovementId: 2,
        },
        {
          id: 4,
          productCode: 'BOTTOM',
          quantity: 1,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          unitCost: 10,
          movementSource: 'inventory_split',
          sourceMovementId: 2,
        },
        {
          id: 5,
          productCode: 'TOP',
          quantity: 2,
          fromBucket: 'sellable',
          toBucket: 'reserved',
          unitCost: 5,
          sourceMovementId: 3,
        },
        {
          id: 6,
          productCode: 'TOP',
          quantity: 2,
          fromBucket: 'reserved',
          toBucket: 'sold',
          unitCost: 5,
          sourceMovementId: 3,
        },
        {
          id: 7,
          productCode: 'TOP',
          quantity: 1,
          fromBucket: 'sold',
          toBucket: 'sellable',
          unitCost: 5,
          sourceMovementId: 6,
        },
      ];
      mockPrisma.inventoryMovement.findMany.mockImplementation(
        async ({ where }) =>
          rows.filter(
            (row) =>
              !where.productCode?.equals ||
              row.productCode === where.productCode.equals
          )
      );
      expect(
        (
          await checkClothingStock({
            productCode: String(productCode),
            requestedQuantity: 1,
          })
        ).availableStock
      ).toBe(expected);
    }
  );
});
