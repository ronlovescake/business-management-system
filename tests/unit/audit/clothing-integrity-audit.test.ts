import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { transactionService } from '@/modules/transactions/api/service';
import { syncInventoryMovementsForTransaction } from '@/modules/transactions/api/transactionInventorySync';
import { DELETE as deleteTransaction } from '@/app/api/transactions/[id]/route';
import { createShipmentDetailRoutes } from '@/modules/shipments/api/shipmentDetailRouteFactory';
import { buildCreateInput } from '@/modules/transactions/api/createInputHelpers';
import { sanitizeTransactionRecord } from '@/modules/transactions/api/sanitizers';

const db = vi.hoisted(() => ({
  transaction: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  price: { findMany: vi.fn() },
  customer: { findMany: vi.fn() },
  product: { findMany: vi.fn(), findFirst: vi.fn() },
  shipment: { findMany: vi.fn() },
  bundleBatch: { findFirst: vi.fn(), findMany: vi.fn() },
  splitBatchComponent: { findFirst: vi.fn(), findMany: vi.fn() },
  inventoryMovement: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  transactionStatusChange: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'audit', role: 'ADMIN' })),
}));
vi.mock('@/modules/transactions/api/auditLogHelpers', () => ({
  logImportChange: vi.fn(),
  logOperationNotification: vi.fn(),
  logUpdateChanges: vi.fn(),
}));

const order = () => ({
  id: 1,
  productCode: 'SKU',
  quantity: 10,
  unitPrice: 100,
  discount: 0,
  adjustment: 0,
  lineTotal: 1000,
  orderStatus: 'Warehouse',
  orderDate: '2026-10-01',
  packedDate: null,
  deletedAt: null,
  updatedAt: new Date('2026-10-01'),
  customers: 'Audit Customer',
  statusChanges: [],
});

describe('Clothing integrity audit — defect reproductions and verified corrections', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.$transaction.mockImplementation(async (work) => work(db));
    db.transaction.findUnique.mockResolvedValue(order());
    db.transaction.count.mockResolvedValue(0);
    db.transaction.update.mockImplementation(async ({ data }) => ({
      ...order(),
      ...data,
    }));
    db.inventoryMovement.findFirst.mockResolvedValue(null);
    db.inventoryMovement.findMany.mockResolvedValue([]);
    db.inventoryMovement.updateMany.mockResolvedValue({ count: 0 });
    db.inventoryMovement.create.mockResolvedValue({ id: 100 });
    db.bundleBatch.findFirst.mockResolvedValue(null);
    db.splitBatchComponent.findFirst.mockResolvedValue(null);
    db.product.findFirst.mockResolvedValue({
      landedUnitCost: 25,
      quantity: 10,
      cogs: 250,
    });
  });

  it('A01: generic edit accepts fabricated paid amount without payment events', async () => {
    await transactionService.updateTransaction({
      id: 1,
      Adjustment: 1000,
      'Order Status': 'Ready For Dispatch',
    });
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          adjustment: 1000,
          lineTotal: 0,
          orderStatus: 'Ready For Dispatch',
        }),
      })
    );
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toBucket: 'sold', quantity: 10 }),
      })
    );
  });

  it('A02: individual delete now rejects shipped/payment history without changing movements', async () => {
    db.transaction.findUnique.mockResolvedValue({
      ...order(),
      orderStatus: 'Shipped',
      adjustment: 1000,
    });
    db.transaction.findMany.mockResolvedValue([
      { ...order(), orderStatus: 'Shipped', adjustment: 1000 },
    ]);
    const response = await deleteTransaction(
      new NextRequest('http://localhost/api/transactions/1', {
        method: 'DELETE',
      }),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(409);
    expect(db.transaction.update).not.toHaveBeenCalled();
    expect(db.inventoryMovement.updateMany).not.toHaveBeenCalled();
  });

  it('A03: re-sync retains a fully reserved mix allocation using stock excluding its own reservation', async () => {
    db.bundleBatch.findFirst.mockResolvedValue({
      id: 1,
      components: [{ componentProductCode: 'A' }],
    });
    db.product.findMany.mockResolvedValue([{ productCode: 'A', quantity: 10 }]);
    db.inventoryMovement.findMany.mockResolvedValue([
      {
        productCode: 'A',
        quantity: 10,
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
      },
    ]);
    await syncInventoryMovementsForTransaction(db as never, {
      ...order(),
      productCode: 'MIX',
    });
    expect(db.inventoryMovement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          notes: { startsWith: 'auto-reserve txn 1 mix ' },
        }),
      })
    );
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productCode: 'A',
          quantity: 10,
          toBucket: 'reserved',
        }),
      })
    );
  });

  it('A04: bulk order creation and a movement failure share the same transaction', async () => {
    db.price.findMany.mockResolvedValue([]);
    db.customer.findMany.mockResolvedValue([
      { customerName: 'Audit Customer' },
    ]);
    db.product.findMany.mockResolvedValue([{ productCode: 'SKU' }]);
    db.bundleBatch.findMany.mockResolvedValue([]);
    db.splitBatchComponent.findMany.mockResolvedValue([]);
    db.transaction.create.mockResolvedValue(order());
    db.inventoryMovement.create.mockRejectedValue(
      new Error('movement write failed')
    );
    await expect(
      transactionService.importTransactions([
        {
          'Order Date': '2026-10-01',
          Customers: 'Audit Customer',
          'Product Code': 'SKU',
          Quantity: 10,
          'Unit Price': 100,
          'Order Status': 'Warehouse',
        },
      ])
    ).rejects.toThrow('movement write failed');
    expect(db.transaction.createMany).not.toHaveBeenCalled();
    expect(db.$transaction.mock.invocationCallOrder[0]).toBeLessThan(
      db.transaction.create.mock.invocationCallOrder[0]
    );
    expect(db.transaction.create.mock.invocationCallOrder[0]).toBeLessThan(
      db.inventoryMovement.create.mock.invocationCallOrder[0]
    );
  });

  it('A05: a generic status downgrade preserves the actual fulfilled sale', async () => {
    db.transaction.findUnique.mockResolvedValue({
      ...order(),
      orderStatus: 'Shipped',
      adjustment: 1000,
      lineTotal: 0,
    });
    db.inventoryMovement.findFirst.mockResolvedValue({
      id: 9,
      deletedAt: null,
      unitCost: 25,
    });
    await transactionService.updateTransaction({
      id: 1,
      'Order Status': 'Warehouse',
    });
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orderStatus: 'Warehouse' }),
      })
    );
    expect(db.inventoryMovement.updateMany).not.toHaveBeenCalled();
    expect(db.inventoryMovement.update).not.toHaveBeenCalled();
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('A06: shipment delete does not check existing accounting entries', async () => {
    const shipmentDelete = vi.fn(async () => ({}));
    const accountingGuard = vi.fn(async () => true);
    const routes = createShipmentDetailRoutes({
      shipmentModel: { delete: shipmentDelete } as never,
      productModel: {} as never,
      hasActiveAccountingEntriesForShipmentCode: accountingGuard,
    });
    const response = await routes.DELETE!(
      new NextRequest('http://localhost/api/shipments/1', { method: 'DELETE' }),
      { params: { id: '1' } }
    );
    expect(response.status).toBe(200);
    expect(shipmentDelete).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(accountingGuard).not.toHaveBeenCalled();
  });

  it('A07: simple SKU fulfillment rejects quantity exceeding recorded physical stock', async () => {
    db.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 10,
        productCode: 'SKU',
        quantity: 10,
        unitCost: 25,
        costBasis: 'PURCHASE',
        fromBucket: 'opening_inventory',
        toBucket: 'sellable',
        postingDate: '2026-10-01',
      },
    ]);
    await expect(
      syncInventoryMovementsForTransaction(db as never, {
        ...order(),
        quantity: 1000,
        orderStatus: 'Shipped',
      })
    ).rejects.toThrow('Insufficient recorded physical stock');
    expect(db.inventoryMovement.findMany).toHaveBeenCalled();
    expect(db.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('A08: import trusts a nonzero line total inconsistent with price and quantity', () => {
    const result = buildCreateInput(
      sanitizeTransactionRecord({
        'Order Date': '2026-10-01',
        Customers: 'Audit Customer',
        'Product Code': 'SKU',
        Quantity: 10,
        'Unit Price': 100,
        'Line Total': 1,
        'Order Status': 'Warehouse',
      }),
      []
    );
    expect(result.lineTotal).toBe(1);
    expect(
      Number(result.quantity) * Number(result.unitPrice) -
        Number(result.adjustment)
    ).toBe(1000);
  });
});
