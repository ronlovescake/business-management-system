import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  generalMerchandiseInventoryMovement: {
    findMany: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

import { buildCogsAndInventoryEntries } from '../inventory-cogs';

describe('GM buildCogsAndInventoryEntries', () => {
  beforeEach(() => {
    prismaMock.generalMerchandiseInventoryMovement.findMany.mockReset();
    prismaMock.generalMerchandiseProduct.findMany.mockReset();
    prismaMock.generalMerchandiseTransaction.findMany.mockReset();
  });

  it('creates COGS + inventory entries for sold movements', async () => {
    prismaMock.generalMerchandiseInventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-10T01:00:00.000Z'),
        postingDate: '2026-01-10',
        productCode: 'SKU-1',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: null,
      },
    ]);

    prismaMock.generalMerchandiseProduct.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        basePrice: 100,
        cogs: 0,
        quantity: 0,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: null,
    });

    expect(result.entries).toHaveLength(2);

    const cogs = result.entries.find((e) => e.account === 'COGS');
    const inv = result.entries.find((e) => e.account === 'Stock on Hand');

    expect(cogs?.debit).toBe(200);
    expect(cogs?.credit).toBe(0);
    expect(inv?.credit).toBe(200);
    expect(inv?.debit).toBe(0);
  });

  it('creates reversal entries when returns exceed sales for a day', async () => {
    prismaMock.generalMerchandiseInventoryMovement.findMany.mockResolvedValue([
      {
        id: 10,
        createdAt: new Date('2026-01-11T01:00:00.000Z'),
        postingDate: '2026-01-11',
        productCode: 'SKU-1',
        quantity: 1,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: null,
      },
      {
        id: 11,
        createdAt: new Date('2026-01-11T02:00:00.000Z'),
        postingDate: '2026-01-11',
        productCode: 'SKU-1',
        quantity: 2,
        fromBucket: 'sold',
        toBucket: 'sellable',
        notes: null,
      },
    ]);

    prismaMock.generalMerchandiseProduct.findMany.mockResolvedValue([
      {
        productCode: 'SKU-1',
        basePrice: 100,
        cogs: 0,
        quantity: 0,
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await buildCogsAndInventoryEntries({
      from: new Date('2026-01-01T00:00:00.000Z'),
      to: null,
    });

    expect(result.entries).toHaveLength(2);

    const cogs = result.entries.find((e) => e.account === 'COGS');
    const inv = result.entries.find((e) => e.account === 'Stock on Hand');

    expect(inv?.debit).toBe(100);
    expect(inv?.credit).toBe(0);
    expect(cogs?.credit).toBe(100);
    expect(cogs?.debit).toBe(0);
  });
});
