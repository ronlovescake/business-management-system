import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import {
  ensureSplitChildStock,
  rebuildReturnedSplitSets,
} from '../split-stock';

function fixture(cost: number | null = 5, bottomCost = 10) {
  const batch = {
    id: 1,
    splitSku: 'SET',
    components: [
      {
        componentLabel: 'Top',
        componentSku: 'TOP',
        includedQuantity: 2,
        acquisitionUnitCost: cost,
      },
      {
        componentLabel: 'Bottom',
        componentSku: 'BOTTOM',
        includedQuantity: 1,
        acquisitionUnitCost: bottomCost,
      },
    ],
  };
  const movements: Array<Record<string, unknown>> = [
    {
      id: 1,
      productCode: 'SET',
      quantity: 10,
      unitCost: 20,
      costBasis: 'RECORDED_COST',
      sourceMovementId: null,
      fromBucket: 'opening_inventory',
      toBucket: 'sellable',
      postingDate: '2026-10-28',
    },
  ];
  const create = vi.fn().mockImplementation(async ({ data }) => {
    const result = { id: movements.length + 1, ...data };
    movements.push(result);
    return result;
  });
  const client = {
    splitBatch: { findUnique: vi.fn().mockResolvedValue(batch) },
    splitBatchComponent: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ ...batch.components[0], splitBatch: batch }),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      create: vi.fn(),
    },
    inventoryMovement: {
      findMany: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          movements.filter(
            (movement) =>
              (!where.productCode ||
                movement.productCode ===
                  (typeof where.productCode === 'string'
                    ? where.productCode
                    : where.productCode.equals)) &&
              (!where.sourceMovementId ||
                movement.sourceMovementId === where.sourceMovementId) &&
              (!where.movementType ||
                movement.movementType === where.movementType)
          )
        ),
      findUnique: vi
        .fn()
        .mockImplementation(
          async ({ where }) =>
            movements.find((movement) => movement.id === where.id) ?? null
        ),
      findUniqueOrThrow: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          movements.find((movement) => movement.id === where.id)
        ),
      create,
    },
  } as unknown as Prisma.TransactionClient;
  const open = (componentSku = 'TOP', quantity = 2) =>
    ensureSplitChildStock(client, {
      splitBatchId: 1,
      parentSku: 'SET',
      componentSku,
      quantity,
      transactionId: 1,
      postingDate: '2026-10-28',
    });
  return { client, movements, create, open };
}

describe('recorded split inventory conversion', () => {
  it('records an explicit zero-cost component allocation without calling a paid parent supplier-free', async () => {
    const { open, movements } = fixture(0, 20);
    await open();
    const top = movements.find((movement) => movement.productCode === 'TOP');
    expect(top).toMatchObject({ unitCost: 0, costBasis: 'SPLIT_ALLOCATION' });
    expect(
      movements
        .filter((movement) => movement.movementType === 'split_piece_receipt')
        .reduce(
          (value, movement) =>
            value + Number(movement.quantity) * Number(movement.unitCost),
          0
        )
    ).toBe(20);
  });
  it('opens one parent for two included tops and retains the bottom for a sibling order', async () => {
    const { open, create, movements } = fixture();
    await open();
    expect(
      create.mock.calls.map(([args]) => [
        args.data.productCode,
        args.data.quantity,
        args.data.unitCost,
      ])
    ).toEqual([
      ['SET', 1, 20],
      ['TOP', 2, 5],
      ['BOTTOM', 1, 10],
    ]);
    await open('BOTTOM', 1);
    expect(create).toHaveBeenCalledTimes(3);
    expect(
      movements
        .filter((movement) => movement.movementType === 'split_piece_receipt')
        .reduce(
          (total, movement) =>
            total + Number(movement.quantity) * Number(movement.unitCost),
          0
        )
    ).toBe(20);
  });

  it.each([null, 4])(
    'rejects missing or nonconserving explicit component cost %s without stock writes',
    async (cost) => {
      const { open, create } = fixture(cost);
      await expect(open()).rejects.toThrow(
        cost === null ? 'explicit acquisition costs' : 'exactly conserve'
      );
      expect(create).not.toHaveBeenCalled();
    }
  );

  it('keeps partial returned pieces loose and rebuilds only the complete original set at its original cost', async () => {
    const { client, open, create, movements } = fixture();
    await open();
    const topReceipt = movements.find(
      (movement) =>
        movement.movementType === 'split_piece_receipt' &&
        movement.productCode === 'TOP'
    )!;
    await client.inventoryMovement.create({
      data: {
        productCode: 'TOP',
        quantity: 2,
        unitCost: 5,
        costBasis: 'RECORDED_COST',
        sourceMovementId: Number(topReceipt.id),
        fromBucket: 'sellable',
        toBucket: 'sold',
        movementType: 'sale',
      },
    });
    const topSale = movements[movements.length - 1];
    await client.inventoryMovement.create({
      data: {
        productCode: 'TOP',
        quantity: 1,
        unitCost: 5,
        costBasis: 'RECORDED_COST',
        sourceMovementId: Number(topSale.id),
        fromBucket: 'sold',
        toBucket: 'sellable',
        movementType: 'return',
      },
    });
    await rebuildReturnedSplitSets(client, 'TOP', '2026-10-28');
    expect(
      movements.filter(
        (movement) => movement.movementType === 'split_rebuild_receipt'
      )
    ).toHaveLength(0);
    await client.inventoryMovement.create({
      data: {
        productCode: 'TOP',
        quantity: 1,
        unitCost: 5,
        costBasis: 'RECORDED_COST',
        sourceMovementId: Number(topSale.id),
        fromBucket: 'sold',
        toBucket: 'sellable',
        movementType: 'return',
      },
    });
    await rebuildReturnedSplitSets(client, 'TOP', '2026-10-28');
    const rebuilt = movements.filter(
      (movement) => movement.movementType === 'split_rebuild_receipt'
    );
    expect(rebuilt).toHaveLength(1);
    expect(rebuilt[0]).toMatchObject({
      productCode: 'SET',
      quantity: 1,
      unitCost: 20,
    });
    const count = create.mock.calls.length;
    await rebuildReturnedSplitSets(client, 'TOP', '2026-10-28');
    expect(create).toHaveBeenCalledTimes(count);
  });
});
