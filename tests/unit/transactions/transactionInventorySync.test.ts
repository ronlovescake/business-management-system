import { describe, expect, it, vi } from 'vitest';

import { syncInventoryMovementsForTransaction } from '@/modules/transactions/api/transactionInventorySync';

type MockClientOptions = {
  products?: Array<{ productCode: string; quantity: number }>;
  movements?: Array<{
    productCode: string;
    quantity: number;
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
    },
  };

  return {
    client: client as never,
    inventoryMovement,
  };
}

describe('syncInventoryMovementsForTransaction', () => {
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

  it('redirects split-child prepared paid movements to the parent SKU', async () => {
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
        productCode: 'SET-303',
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
        productCode: 'SET-303',
        quantity: 2,
        fromBucket: 'reserved',
        toBucket: 'sold',
        postingDate: '2026-04-15',
        notes: 'auto-sale txn 303',
      }),
      select: { id: true },
    });
  });
});