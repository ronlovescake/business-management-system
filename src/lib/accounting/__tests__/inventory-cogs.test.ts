import { describe, expect, it, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  inventoryMovement: {
    findMany: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

import { buildCogsAndInventoryEntries } from '../inventory-cogs';

describe('buildCogsAndInventoryEntries', () => {
  beforeEach(() => {
    prismaMock.inventoryMovement.findMany.mockReset();
    prismaMock.product.findMany.mockReset();
    prismaMock.transaction.findMany.mockReset();
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
});
