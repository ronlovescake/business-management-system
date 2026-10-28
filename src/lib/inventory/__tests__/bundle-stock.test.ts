import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { assembleInventoryBundle } from '../bundle-stock';

const input = {
  batchId: 7,
  bundleSku: 'KIT',
  bundleName: 'Kit',
  quantity: 2,
  postingDate: '2026-10-28',
  components: [
    { productCode: 'TOP', includedQuantity: 2 },
    { productCode: 'BOTTOM', includedQuantity: 1 },
  ],
};

function fixture() {
  const receipts = [
    {
      id: 1,
      productCode: 'TOP',
      quantity: 2,
      unitCost: 5,
      costBasis: 'RECORDED_COST',
      fromBucket: 'opening_inventory',
      toBucket: 'sellable',
    },
    {
      id: 2,
      productCode: 'TOP',
      quantity: 2,
      unitCost: 0,
      costBasis: 'FREE_GOODS',
      fromBucket: 'supplier_short',
      toBucket: 'sellable',
    },
    {
      id: 3,
      productCode: 'BOTTOM',
      quantity: 2,
      unitCost: 10,
      costBasis: 'RECORDED_COST',
      fromBucket: 'opening_inventory',
      toBucket: 'sellable',
    },
  ];
  let id = 100;
  const client = {
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 9 }),
    },
    inventoryMovement: {
      findMany: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          receipts.filter(
            (receipt) => receipt.productCode === where.productCode.equals
          )
        ),
      create: vi
        .fn()
        .mockImplementation(async ({ data }) => ({ id: id++, ...data })),
    },
  };
  return {
    client,
    receipts,
    tx: client as unknown as Prisma.TransactionClient,
  };
}

describe('recorded bundle source-cost assembly', () => {
  it('conserves each original component cost across separate paid/free source lanes without using the selling price', async () => {
    const { client, tx } = fixture();
    await assembleInventoryBundle(tx, input);
    const rows = client.inventoryMovement.create.mock.calls.map(
      ([call]) => call.data
    );
    expect(
      rows
        .filter((row) => row.movementType === 'bundle_receipt')
        .map((row) => [row.quantity, row.unitCost])
    ).toEqual([
      [1, 20],
      [1, 10],
    ]);
    const value = (type: string) =>
      rows
        .filter((row) => row.movementType === type)
        .reduce((sum, row) => sum + row.quantity * row.unitCost, 0);
    expect(value('bundle_receipt')).toBe(30);
    expect(value('bundle_component_out')).toBe(30);
    expect(
      rows
        .filter((row) => row.movementType === 'bundle_component_out')
        .map((row) => row.sourceMovementId)
    ).toEqual([1, 3, 2, 3]);
    expect(
      rows.filter(
        (row) =>
          row.movementType === 'bundle_component_out' && row.unitCost === 0
      )
    ).toEqual([
      expect.objectContaining({
        productCode: 'TOP',
        quantity: 2,
        costBasis: 'FREE_GOODS',
      }),
    ]);
  });

  it('rejects insufficient original component stock before any stock or product writes', async () => {
    const { client, tx } = fixture();
    await expect(
      assembleInventoryBundle(tx, { ...input, quantity: 3 })
    ).rejects.toThrow('Not enough recorded sellable stock');
    expect(client.inventoryMovement.create).not.toHaveBeenCalled();
    expect(client.product.create).not.toHaveBeenCalled();
  });

  it('does not silently treat an unknown zero component cost as supplier-free stock', async () => {
    const { client, receipts, tx } = fixture();
    receipts[0].unitCost = 0;
    receipts[0].costBasis = 'RECORDED_COST';
    await expect(assembleInventoryBundle(tx, input)).rejects.toThrow(
      'Resolve the acquisition cost'
    );
    expect(client.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
