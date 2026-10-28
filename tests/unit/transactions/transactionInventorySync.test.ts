import { describe, expect, it, vi } from 'vitest';

import { syncInventoryMovementsForTransaction } from '@/modules/transactions/api/transactionInventorySync';
import { ensureSplitChildStock } from '@/lib/inventory/split-stock';

vi.mock('@/lib/inventory/split-stock', () => ({
  ensureSplitChildStock: vi.fn(),
}));

type MockClientOptions = {
  products?: Array<{ productCode: string; quantity: number }>;
  movements?: Array<{
    id?: number;
    productCode: string;
    quantity: number;
    unitCost?: number | null;
    costBasis?: string | null;
    sourceMovementId?: number | null;
    sourceTransactionId?: number | null;
    fromBucket: string;
    toBucket: string;
  }>;
  mixAndMatch?: {
    id: number;
    components: Array<{ componentProductCode: string }>;
  } | null;
  splitChildComponent?: {
    componentLabel: string;
    componentSku: string;
    includedQuantity: number;
    splitBatch: { id: number; splitSku: string };
  } | null;
};

function createMockClient(options: MockClientOptions = {}) {
  let nextMovementId = 100;

  const inventoryMovement = {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue(options.movements ?? []),
    create: vi.fn().mockImplementation(async () => ({ id: nextMovementId++ })),
    update: vi.fn().mockResolvedValue(undefined),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  };

  const client = {
    inventoryMovement,
    bundleBatch: {
      findFirst: vi.fn().mockResolvedValue(options.mixAndMatch ?? null),
    },
    splitBatchComponent: {
      findFirst: vi.fn().mockResolvedValue(options.splitChildComponent ?? null),
    },
    product: {
      findMany: vi.fn().mockResolvedValue(options.products ?? []),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };

  return {
    client: client as never,
    inventoryMovement,
  };
}

describe('syncInventoryMovementsForTransaction', () => {
  it('preserves actual fulfilled component allocations when current mix availability changes', async () => {
    const { client, inventoryMovement } = createMockClient({
      mixAndMatch: {
        id: 1,
        components: [
          { componentProductCode: 'COMP-A' },
          { componentProductCode: 'COMP-B' },
        ],
      },
      products: [
        { productCode: 'COMP-A', quantity: 0 },
        { productCode: 'COMP-B', quantity: 100 },
      ],
    });
    inventoryMovement.findFirst.mockResolvedValue({
      id: 8,
      productCode: 'COMP-A',
      quantity: 2,
      deletedAt: null,
      fromBucket: 'sellable',
      toBucket: 'sold',
      sourceTransactionId: 202,
      movementSource: 'transaction',
      movementType: 'sale',
    });
    await syncInventoryMovementsForTransaction(client, {
      id: 202,
      productCode: 'MIX-202',
      quantity: 2,
      unitPrice: 50,
      discount: 0,
      lineTotal: 100,
      orderDate: '2026-10-28',
      packedDate: '2026-10-28',
      orderStatus: 'Shipped',
      adjustment: 100,
    });
    expect(inventoryMovement.create).not.toHaveBeenCalled();
    expect(inventoryMovement.update).not.toHaveBeenCalled();
    expect(inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('fulfills extra orders from explicit free stock at zero cost after paid stock is exhausted', async () => {
    const { client, inventoryMovement } = createMockClient({
      movements: [
        {
          id: 1,
          productCode: 'SKU-FREE',
          quantity: 4,
          fromBucket: 'opening_inventory',
          toBucket: 'sellable',
          unitCost: 20,
        },
        {
          id: 2,
          productCode: 'SKU-FREE',
          quantity: 2,
          fromBucket: 'supplier_short',
          toBucket: 'sellable',
          unitCost: 0,
          costBasis: 'FREE_GOODS',
        },
        {
          id: 3,
          productCode: 'SKU-FREE',
          quantity: 4,
          fromBucket: 'sellable',
          toBucket: 'sold',
          unitCost: 20,
        },
      ],
    });
    await syncInventoryMovementsForTransaction(client, {
      id: 104,
      productCode: 'SKU-FREE',
      quantity: 2,
      unitPrice: 100,
      discount: 0,
      lineTotal: 200,
      orderDate: '2026-10-28',
      packedDate: '2026-10-28',
      orderStatus: 'Shipped',
      adjustment: 200,
    });
    expect(inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'SKU-FREE',
        quantity: 2,
        unitCost: 0,
        costBasis: 'FREE_GOODS',
        sourceMovementId: 2,
        toBucket: 'sold',
      }),
      select: { id: true },
    });
  });

  it('creates a sale movement for accounts-receivable shipments', async () => {
    const { client, inventoryMovement } = createMockClient();

    await syncInventoryMovementsForTransaction(client, {
      id: 100,
      productCode: 'SKU-AR',
      quantity: 2,
      unitPrice: 125,
      discount: 0,
      lineTotal: 250,
      orderDate: '2026-10-23',
      packedDate: null,
      orderStatus: 'Accounts Receivable',
      adjustment: 0,
    });

    expect(inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'SKU-AR',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: 'auto-sale txn 100',
      }),
      select: { id: true },
    });
  });

  it('creates a standard reserve movement for warehouse transactions', async () => {
    const { client, inventoryMovement } = createMockClient();

    await syncInventoryMovementsForTransaction(client, {
      id: 101,
      productCode: 'SKU-101',
      quantity: 3,
      unitPrice: 100,
      discount: 0,
      lineTotal: 300,
      orderDate: '2026-04-14',
      packedDate: null,
      orderStatus: 'Warehouse',
      adjustment: 0,
    });

    expect(inventoryMovement.create).toHaveBeenCalledTimes(1);
    expect(inventoryMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productCode: 'SKU-101',
        quantity: 3,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        postingDate: '2026-04-14',
        notes: 'auto-reserve txn 101',
      }),
      select: { id: true },
    });
  });

  it('allocates mix-and-match reserve movements across component SKUs', async () => {
    const { client, inventoryMovement } = createMockClient({
      mixAndMatch: {
        id: 1,
        components: [
          { componentProductCode: 'COMP-A' },
          { componentProductCode: 'COMP-B' },
        ],
      },
      products: [
        { productCode: 'COMP-A', quantity: 4 },
        { productCode: 'COMP-B', quantity: 2 },
      ],
      movements: [],
    });

    await syncInventoryMovementsForTransaction(client, {
      id: 202,
      productCode: 'MIX-202',
      quantity: 3,
      unitPrice: 150,
      discount: 0,
      lineTotal: 450,
      orderDate: '2026-04-14',
      packedDate: null,
      orderStatus: 'Warehouse',
      adjustment: 0,
    });

    expect(inventoryMovement.create).toHaveBeenCalledTimes(2);

    const createdCodes = inventoryMovement.create.mock.calls.map(
      ([payload]) => payload.data.productCode
    );
    const createdQuantities = inventoryMovement.create.mock.calls.map(
      ([payload]) => payload.data.quantity
    );
    const createdNotes = inventoryMovement.create.mock.calls.map(
      ([payload]) => payload.data.notes
    );

    expect(createdCodes).toEqual(['COMP-A', 'COMP-B']);
    expect(createdQuantities).toEqual([2, 1]);
    expect(createdNotes).toEqual([
      'auto-reserve txn 202 mix COMP-A',
      'auto-reserve txn 202 mix COMP-B',
    ]);
  });

  it('fulfills every originally reserved mix unit without subtracting its own reservation a second time', async () => {
    const movements = [
      {
        id: 1,
        productCode: 'COMP-A',
        quantity: 4,
        unitCost: 10,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
      },
      {
        id: 2,
        productCode: 'COMP-B',
        quantity: 2,
        unitCost: 20,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
      },
      {
        id: 3,
        productCode: 'COMP-A',
        quantity: 4,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        sourceTransactionId: 202,
      },
      {
        id: 4,
        productCode: 'COMP-B',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        sourceTransactionId: 202,
      },
    ];
    const { client, inventoryMovement } = createMockClient({
      mixAndMatch: {
        id: 1,
        components: [
          { componentProductCode: 'COMP-A' },
          { componentProductCode: 'COMP-B' },
        ],
      },
      products: [
        { productCode: 'COMP-A', quantity: 4 },
        { productCode: 'COMP-B', quantity: 2 },
      ],
    });
    inventoryMovement.findMany.mockImplementation(async ({ where }) =>
      movements.filter(
        (movement) =>
          !where.productCode?.equals ||
          movement.productCode === where.productCode.equals
      )
    );
    await syncInventoryMovementsForTransaction(client, {
      id: 202,
      productCode: 'MIX-202',
      quantity: 6,
      unitPrice: 50,
      discount: 0,
      lineTotal: 300,
      orderDate: '2026-10-28',
      packedDate: '2026-10-28',
      orderStatus: 'Accounts Receivable',
      adjustment: 0,
    });
    const sales = inventoryMovement.create.mock.calls
      .map(([call]) => call.data)
      .filter((movement) => movement.toBucket === 'sold');
    expect(
      sales.map((sale) => [
        sale.productCode,
        sale.quantity,
        sale.unitCost,
        sale.sourceMovementId,
      ])
    ).toEqual([
      ['COMP-A', 4, 10, 1],
      ['COMP-B', 2, 20, 2],
    ]);
  });

  it('opens recorded split stock then reserves and sells the actual child instead of double-charging its parent', async () => {
    const { client, inventoryMovement } = createMockClient({
      splitChildComponent: {
        componentLabel: 'Top',
        componentSku: 'TOP-303',
        includedQuantity: 1,
        splitBatch: {
          id: 1,
          splitSku: 'SET-303',
        },
      },
    });

    await syncInventoryMovementsForTransaction(client, {
      id: 303,
      productCode: 'TOP-303',
      quantity: 2,
      unitPrice: 125,
      discount: 0,
      lineTotal: Number.NaN,
      orderDate: '2026-04-14',
      packedDate: '2026-04-15',
      orderStatus: 'Prepared',
      adjustment: 250,
    });

    expect(inventoryMovement.create).toHaveBeenCalledTimes(2);
    expect(inventoryMovement.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        productCode: 'TOP-303',
        quantity: 2,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        postingDate: '2026-04-15',
        notes: 'auto-reserve txn 303',
      }),
      select: { id: true },
    });
    expect(inventoryMovement.create).toHaveBeenNthCalledWith(2, {
      data: expect.objectContaining({
        productCode: 'TOP-303',
        quantity: 2,
        fromBucket: 'reserved',
        toBucket: 'sold',
        postingDate: '2026-04-15',
        notes: 'auto-sale txn 303',
      }),
      select: { id: true },
    });
    expect(ensureSplitChildStock).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        parentSku: 'SET-303',
        componentSku: 'TOP-303',
        quantity: 2,
        transactionId: 303,
      })
    );
  });
});
