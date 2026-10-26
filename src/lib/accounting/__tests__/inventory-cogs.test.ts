import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  inventoryMovement: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
  shipment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  clothingAccountingJournalLine: { findUnique: vi.fn(), createMany: vi.fn() },
  clothingFinancialRequest: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

import {
  buildCogsAndInventoryEntries,
  buildInventorySeedAndShrinkageEntries,
} from '../inventory-cogs';
import {
  calculateCostCorrection,
  confirmZeroCostMovement,
  recordDatedCostCorrection,
} from '../inventory-valuation';

describe('dated cost correction allocation', () => {
  const details = {
    productId: 5,
    expectedUnitCost: 100,
    newUnitCost: 120,
    date: '2026-10-26',
    capitalizationLineId: 'capitalized',
    reason: 'Confirmed freight cost has been capitalized',
  };
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (work) =>
      work(prismaMock)
    );
    prismaMock.clothingFinancialRequest.findUnique.mockResolvedValue(null);
    prismaMock.clothingFinancialRequest.findMany.mockResolvedValue([]);
    prismaMock.product.findUnique.mockResolvedValue({
      id: 5,
      productCode: 'SKU',
      shipmentCode: 'SHIP',
      quantity: 10,
      landedUnitCost: 100,
    });
    prismaMock.product.findMany.mockResolvedValue([{ id: 5 }]);
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 42,
        productCode: 'SKU',
        quantity: 4,
        unitCost: 100,
        fromBucket: 'sellable',
        toBucket: 'sold',
        postingDate: '2026-10-20',
        createdAt: new Date('2026-10-20'),
      },
    ]);
    prismaMock.clothingAccountingJournalLine.findUnique.mockResolvedValue({
      id: 'capitalized',
      account: 'Stock on Hand',
      debit: 200,
      credit: 0,
      date: new Date('2026-10-25'),
      sourceType: 'MANUAL',
      ref: 'SKU',
    });
  });
  it('allocates an already-capitalized delta without rewriting sale movements or posting logistics twice', async () => {
    const result = await recordDatedCostCorrection(
      'dc9f8292-7188-4386-b7fc-6cd29cced72a',
      details,
      { id: 'admin', role: 'ADMIN' }
    );
    expect(result).toMatchObject({
      totalDelta: 200,
      soldDelta: 80,
      stockDelta: 120,
      resolvedMovementIds: [42],
      approvedBy: 'admin',
    });
    expect(
      prismaMock.clothingAccountingJournalLine.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ account: 'COGS', debit: 80, credit: 0 }),
        expect.objectContaining({
          account: 'Stock on Hand',
          debit: 0,
          credit: 80,
        }),
      ],
    });
    expect(prismaMock.product.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { landedUnitCost: 120, cogs: 1200 },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });
  it('replays an identical save once and rejects a changed payload under the same key', async () => {
    const key = 'dc9f8292-7188-4386-b7fc-6cd29cced72a';
    const result = await recordDatedCostCorrection(key, details, {
      id: 'admin',
      role: 'ADMIN',
    });
    const saved =
      prismaMock.clothingFinancialRequest.create.mock.calls[0][0].data;
    prismaMock.clothingFinancialRequest.findUnique.mockResolvedValue({
      ...saved,
      result,
    });
    expect(
      await recordDatedCostCorrection(key, details, {
        id: 'admin',
        role: 'ADMIN',
      })
    ).toEqual(result);
    await expect(
      recordDatedCostCorrection(
        key,
        { ...details, newUnitCost: 121 },
        { id: 'admin', role: 'ADMIN' }
      )
    ).rejects.toThrow('different details');
    expect(prismaMock.product.update).toHaveBeenCalledTimes(1);
    expect(
      prismaMock.clothingAccountingJournalLine.createMany
    ).toHaveBeenCalledTimes(1);
  });
  it.each([
    'stale',
    'already allocated',
    'different lot',
    'later movement',
    'different snapshot',
    'staff',
  ])(
    'rejects %s evidence before changing cost or posting journals',
    async (scenario) => {
      let input = details;
      if (scenario === 'stale') {
        input = { ...details, expectedUnitCost: 99 };
      }
      if (scenario === 'already allocated') {
        prismaMock.clothingFinancialRequest.findMany.mockResolvedValue([
          { result: { capitalizationLineId: 'capitalized', totalDelta: 200 } },
        ]);
      }
      if (scenario === 'different lot') {
        prismaMock.product.findMany.mockResolvedValue([{ id: 5 }, { id: 6 }]);
      }
      if (scenario === 'later movement') {
        prismaMock.inventoryMovement.findMany.mockResolvedValue([
          { postingDate: '2026-10-27', createdAt: new Date('2026-10-27') },
        ]);
      }
      if (scenario === 'different snapshot') {
        prismaMock.inventoryMovement.findMany.mockResolvedValue([
          {
            id: 42,
            quantity: 4,
            unitCost: 75,
            fromBucket: 'sellable',
            toBucket: 'sold',
            postingDate: '2026-10-20',
            createdAt: new Date('2026-10-20'),
          },
        ]);
      }
      await expect(
        recordDatedCostCorrection(
          'dc9f8292-7188-4386-b7fc-6cd29cced72a',
          input,
          { id: 'actor', role: scenario === 'staff' ? 'USER' : 'ADMIN' }
        )
      ).rejects.toThrow();
      expect(prismaMock.product.update).not.toHaveBeenCalled();
      expect(
        prismaMock.clothingAccountingJournalLine.createMany
      ).not.toHaveBeenCalled();
    }
  );
  it.each([
    [10, 4, 100, 120, 200, 80, 120],
    [10, 4, 120, 100, -200, -80, -120],
    [3, 1, 1, 1.005, 0.02, 0.01, 0.01],
    [10, 0, 100, 120, 200, 0, 200],
    [10, 10, 100, 120, 200, 200, 0],
  ])(
    'allocates quantity %s, sold %s, costs %s to %s without losing cents',
    (
      quantity,
      soldQuantity,
      oldUnitCost,
      newUnitCost,
      totalDelta,
      soldDelta,
      stockDelta
    ) => {
      expect(
        calculateCostCorrection({
          quantity,
          soldQuantity,
          oldUnitCost,
          newUnitCost,
        })
      ).toMatchObject({ totalDelta, soldDelta, stockDelta });
    }
  );
  it.each([
    [0, 0, 100, 120],
    [10, 11, 100, 120],
    [10, -1, 100, 120],
    [10, 4, -1, 120],
    [10, 4, 100, Infinity],
    [10, 4, 100, 100],
  ])(
    'rejects unconfirmed or inconsistent allocation inputs',
    (quantity, soldQuantity, oldUnitCost, newUnitCost) => {
      expect(() =>
        calculateCostCorrection({
          quantity,
          soldQuantity,
          oldUnitCost,
          newUnitCost,
        })
      ).toThrow();
    }
  );
});

describe('administrator zero-cost confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (work) =>
      work(prismaMock)
    );
    prismaMock.clothingFinancialRequest.findUnique.mockResolvedValue(null);
    prismaMock.clothingFinancialRequest.findFirst.mockResolvedValue(null);
    prismaMock.inventoryMovement.findUnique.mockResolvedValue({
      id: 42,
      productCode: 'GIFT',
      quantity: 2,
      unitCost: null,
      fromBucket: 'sellable',
      toBucket: 'sold',
      deletedAt: null,
    });
  });

  it('records an immutable actor/reason result without rewriting the movement', async () => {
    const result = await confirmZeroCostMovement(
      '9e934494-f6ce-4829-b9bf-57230ae11722',
      { movementId: 42, reason: 'Supplier provided these goods free' },
      { id: 'admin', role: 'ADMIN' }
    );
    expect(result).toMatchObject({
      movementId: 42,
      productCode: 'GIFT',
      quantity: 2,
      confirmedBy: 'admin',
      reason: 'Supplier provided these goods free',
    });
    expect(result.confirmedAt).toBeTruthy();
    expect(prismaMock.clothingFinancialRequest.update).toHaveBeenCalled();
    expect(prismaMock.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });

  it('rejects staff confirmation before opening a write transaction', async () => {
    await expect(
      confirmZeroCostMovement(
        'request',
        { movementId: 42, reason: 'Goods were free of charge' },
        { id: 'staff', role: 'USER' }
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a second confirmation rather than duplicating its audit trail', async () => {
    prismaMock.clothingFinancialRequest.findFirst.mockResolvedValue({
      id: 'previous',
    });
    await expect(
      confirmZeroCostMovement(
        'request',
        { movementId: 42, reason: 'Goods were free of charge' },
        { id: 'admin', role: 'ADMIN' }
      )
    ).rejects.toThrow('already has');
    expect(prismaMock.clothingFinancialRequest.update).not.toHaveBeenCalled();
  });
});

describe('buildCogsAndInventoryEntries', () => {
  beforeEach(() => {
    prismaMock.inventoryMovement.findMany.mockReset();
    prismaMock.product.findMany.mockReset();
    prismaMock.transaction.findMany.mockReset();
    prismaMock.shipment.findMany.mockReset();
    prismaMock.shipment.findMany.mockResolvedValue([]);
  });

  it('nets COGS down when returns move sold -> stock', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-10T01:00:00.000Z'),
        postingDate: '2026-01-10',
        productCode: 'SKU-1',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'sold',
      },
      {
        id: 2,
        createdAt: new Date('2026-01-10T02:00:00.000Z'),
        postingDate: '2026-01-10',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sold',
        toBucket: 'sellable',
      },
    ]);

    prismaMock.product.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        landedUnitCost: 100,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: null,
    });

    expect(result.totalCogs).toBe(100);
    expect(result.entries).toHaveLength(2);

    const cogs = result.entries.find((e) => e.account === 'COGS');
    const inv = result.entries.find((e) => e.account === 'Stock on Hand');

    expect(cogs?.debit).toBe(100);
    expect(cogs?.credit).toBe(0);
    expect(inv?.credit).toBe(100);
    expect(inv?.debit).toBe(0);
  });

  it('creates reversal entries when returns exceed sales for a day', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 10,
        createdAt: new Date('2026-01-11T01:00:00.000Z'),
        postingDate: '2026-01-11',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'sold',
      },
      {
        id: 11,
        createdAt: new Date('2026-01-11T02:00:00.000Z'),
        postingDate: '2026-01-11',
        productCode: 'SKU-1',
        quantity: 2,
        fromBucket: 'sold',
        toBucket: 'sellable',
      },
    ]);

    prismaMock.product.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        landedUnitCost: 100,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: null,
    });

    expect(result.totalCogs).toBe(-100);
    expect(result.entries).toHaveLength(2);

    const cogs = result.entries.find((e) => e.account === 'COGS');
    const inv = result.entries.find((e) => e.account === 'Stock on Hand');

    expect(inv?.debit).toBe(100);
    expect(inv?.credit).toBe(0);
    expect(cogs?.credit).toBe(100);
    expect(cogs?.debit).toBe(0);
  });

  it('posts auto-sale inventory to COGS and dates by completion (createdAt) when postingDate is pre-cutover', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-20T01:00:00.000Z'),
        postingDate: '2026-01-01',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: 'auto-sale txn 123',
      },
    ]);

    prismaMock.product.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        landedUnitCost: 100,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 123,
        customers: 'Legacy Customer',
        packedDate: null,
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-17T00:00:00.000Z'),
      to: null,
    });

    expect(result.totalCogs).toBe(100);
    expect(result.entries).toHaveLength(2);

    const cogs = result.entries.find((e) => e.account === 'COGS');
    const inv = result.entries.find((e) => e.account === 'Stock on Hand');

    expect(cogs?.debit).toBe(100);
    expect(cogs?.credit).toBe(0);
    expect(inv?.credit).toBe(100);
    expect(inv?.debit).toBe(0);
  });

  it('prefers explicit auto-sale movement fields over legacy notes', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-20T01:00:00.000Z'),
        postingDate: '2026-01-01',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: 'manual correction, not a durable relation',
        sourceTransactionId: 456,
        movementSource: 'transaction',
        movementType: 'sale',
      },
    ]);

    prismaMock.product.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        landedUnitCost: 100,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    prismaMock.transaction.findMany.mockResolvedValue([
      {
        id: 456,
        customers: 'Explicit Customer',
        packedDate: null,
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-17T00:00:00.000Z'),
      to: null,
    });

    expect(result.totalCogs).toBe(100);
    expect(result.entries).toHaveLength(2);
    expect(prismaMock.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [456] } } })
    );
  });

  it('posts inventory shrinkage as an expense instead of directly to equity', async () => {
    prismaMock.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 50,
        createdAt: new Date('2026-01-25T01:00:00.000Z'),
        postingDate: '2026-01-25',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'scrap',
      },
    ]);
    prismaMock.product.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        shipmentCode: 'SHIP-1',
        shipmentStatus: 'Delivered',
        landedUnitCost: 100,
        cogs: 100,
        quantity: 1,
      },
    ]);

    const result = await buildInventorySeedAndShrinkageEntries({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: null,
    });

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account: 'Inventory Shrinkage',
          debit: 100,
          credit: 0,
        }),
        expect.objectContaining({
          account: 'Stock on Hand',
          debit: 0,
          credit: 100,
        }),
      ])
    );
  });
});
