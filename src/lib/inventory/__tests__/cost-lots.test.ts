import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  allocateInventoryCostLots,
  loadAvailableInventoryCostLots,
  transferInventoryCostLots,
} from '../cost-lots';

const paid = {
  id: 1,
  productCode: 'ONESIES',
  quantity: 1000,
  unitCost: 20,
  costBasis: 'RECORDED_COST',
  sourceMovementId: null,
  sourceTransactionId: null,
  fromBucket: 'supplier_short',
  toBucket: 'sellable',
  postingDate: '2026-10-27',
};
const free = {
  ...paid,
  id: 2,
  quantity: 100,
  unitCost: 0,
  costBasis: 'FREE_GOODS',
};
const load = (movements: unknown[], transactionId: number | null = null) =>
  loadAvailableInventoryCostLots(
    {
      inventoryMovement: { findMany: vi.fn().mockResolvedValue(movements) },
    } as unknown as Prisma.TransactionClient,
    'ONESIES',
    transactionId,
    20,
    '2026-10-28'
  );

describe('recorded sellable inventory cost lots', () => {
  it('keeps paid and explicit free units separate without changing their costs', async () => {
    const lots = await load([paid, free]);
    expect(lots).toEqual([
      {
        sourceMovementId: 1,
        quantity: 1000,
        unitCost: 20,
        costBasis: 'RECORDED_COST',
      },
      {
        sourceMovementId: 2,
        quantity: 100,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
      },
    ]);
    expect(
      allocateInventoryCostLots(lots!, 1100)?.reduce(
        (total, lot) => total + lot.quantity * lot.unitCost!,
        0
      )
    ).toBe(20000);
    expect(allocateInventoryCostLots(lots!, 1101)).toBeNull();
  });

  it('does not make held or reserved units available to a transfer', async () => {
    const held = {
      ...paid,
      id: 3,
      quantity: 300,
      fromBucket: 'sellable',
      toBucket: 'damaged_hold',
    };
    const reserved = {
      ...paid,
      id: 4,
      quantity: 200,
      fromBucket: 'sellable',
      toBucket: 'reserved',
      sourceTransactionId: 8,
    };
    const lots = await load([paid, free, held, reserved]);
    expect(lots?.map((lot) => lot.quantity)).toEqual([500, 100]);
    expect(
      (await load([paid, free, held, reserved], 8))?.map((lot) => lot.quantity)
    ).toEqual([700, 100]);
  });

  it('consumes the exact free source instead of a paid FIFO lot', async () => {
    const transfer = {
      ...free,
      id: 3,
      sourceMovementId: free.id,
      quantity: 40,
      fromBucket: 'sellable',
      toBucket: 'supplier_short',
    };
    expect(
      (await load([paid, free, transfer]))?.map((lot) => [
        lot.quantity,
        lot.unitCost,
      ])
    ).toEqual([
      [1000, 20],
      [60, 0],
    ]);
  });

  it('preserves the original cost when held stock is released', async () => {
    const hold = {
      ...free,
      id: 3,
      sourceMovementId: free.id,
      quantity: 40,
      fromBucket: 'sellable',
      toBucket: 'damaged_hold',
    };
    const release = {
      ...hold,
      id: 4,
      quantity: 10,
      fromBucket: 'damaged_hold',
      toBucket: 'sellable',
    };
    const lots = await load([paid, free, hold, release]);
    expect(lots?.reduce((total, lot) => total + lot.quantity, 0)).toBe(1070);
    expect(
      lots
        ?.filter((lot) => lot.costBasis === 'FREE_GOODS')
        .reduce((total, lot) => total + lot.quantity, 0)
    ).toBe(70);
  });

  it('excludes future receipts and distinguishes absent legacy receipt evidence', async () => {
    expect(await load([{ ...free, postingDate: '2026-10-29' }])).toEqual([]);
    expect(await load([])).toBeNull();
    expect(
      await load([
        free,
        {
          ...free,
          id: 3,
          fromBucket: 'sellable',
          toBucket: 'sold',
          sourceMovementId: free.id,
        },
      ])
    ).toEqual([]);
  });

  it('writes matched paid and free transfer allocations with source costs, never destination costs', async () => {
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      id: create.mock.calls.length + 10,
      ...data,
    }));
    const client = {
      product: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 1,
            productCode: 'ONESIES',
            landedUnitCost: 20,
          })
          .mockResolvedValueOnce({
            id: 2,
            productCode: 'DEST',
            landedUnitCost: 99,
          }),
      },
      inventoryMovement: {
        findMany: vi.fn().mockResolvedValue([paid, free]),
        create,
      },
    } as unknown as Prisma.TransactionClient;
    const result = await transferInventoryCostLots(
      client,
      {
        productCode: 'ONESIES',
        transferToProductCode: 'DEST',
        quantity: 1100,
        postingDate: '2026-10-28',
      },
      'request'
    );
    expect(
      result.movements.map((movement) => [
        movement.productCode,
        movement.quantity,
        movement.unitCost,
        movement.costBasis,
      ])
    ).toEqual([
      ['ONESIES', 1000, 20, 'RECORDED_COST'],
      ['DEST', 1000, 20, 'RECORDED_COST'],
      ['ONESIES', 100, 0, 'FREE_GOODS'],
      ['DEST', 100, 0, 'FREE_GOODS'],
    ]);
    expect(result.movements[1].sourceMovementId).toBe(result.movements[0].id);
    expect(result.movements[3].sourceMovementId).toBe(result.movements[2].id);
  });

  it('rejects oversubscription before writing either transfer side', async () => {
    const create = vi.fn();
    const client = {
      product: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 1,
            productCode: 'ONESIES',
            landedUnitCost: 20,
          })
          .mockResolvedValueOnce({ id: 2, productCode: 'DEST' }),
      },
      inventoryMovement: {
        findMany: vi.fn().mockResolvedValue([free]),
        create,
      },
    } as unknown as Prisma.TransactionClient;
    await expect(
      transferInventoryCostLots(
        client,
        {
          productCode: 'ONESIES',
          transferToProductCode: 'DEST',
          quantity: 101,
          postingDate: '2026-10-28',
        },
        'request'
      )
    ).rejects.toThrow('Not enough recorded sellable stock');
    expect(create).not.toHaveBeenCalled();
  });

  it('does not reverse unrelated destination stock when original transferred units are gone', async () => {
    const create = vi.fn();
    const client = {
      product: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 2,
            productCode: 'DEST',
            landedUnitCost: 99,
          })
          .mockResolvedValueOnce({ id: 1, productCode: 'ONESIES' }),
      },
      inventoryMovement: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([paid])
          .mockResolvedValueOnce([]),
        create,
      },
    } as unknown as Prisma.TransactionClient;
    await expect(
      transferInventoryCostLots(
        client,
        {
          productCode: 'DEST',
          transferToProductCode: 'ONESIES',
          quantity: 1,
          postingDate: '2026-10-28',
          reverseTransfer: true,
        },
        'request'
      )
    ).rejects.toThrow('Not enough recorded sellable stock');
    expect(create).not.toHaveBeenCalled();
  });
});
