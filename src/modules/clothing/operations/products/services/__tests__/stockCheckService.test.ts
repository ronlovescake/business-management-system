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
      message: 'Split-child of "SET-1": 0 loose piece(s) + 28 complete set(s) remaining',
    });
  });
});