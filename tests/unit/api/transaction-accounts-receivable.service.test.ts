import { getTransactionRevision } from '@/modules/transactions/api/updateConcurrency';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrisma,
  mockAssertOrderStatusNotBackwardToInTransit,
  mockSyncInventoryMovementsForTransaction,
  mockLogStatusChange,
  mockLogOperationNotification,
  mockLogUpdateChanges,
} = vi.hoisted(() => ({
  mockPrisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    price: { findMany: vi.fn() },
    $transaction: vi.fn(),
    customer: {
      findMany: vi.fn(),
    },
  },
  mockAssertOrderStatusNotBackwardToInTransit: vi.fn(),
  mockSyncInventoryMovementsForTransaction: vi.fn(),
  mockLogStatusChange: vi.fn(),
  mockLogOperationNotification: vi.fn(),
  mockLogUpdateChanges: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/modules/transactions/api/referenceValidation', async () => ({
  ...(await vi.importActual<
    typeof import('@/modules/transactions/api/referenceValidation')
  >('@/modules/transactions/api/referenceValidation')),
  validateReferences: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/modules/transactions/api/transactionInventorySync', async () => {
  const actual = await vi.importActual<
    typeof import('@/modules/transactions/api/transactionInventorySync')
  >('@/modules/transactions/api/transactionInventorySync');
  return {
    ...actual,
    assertOrderStatusNotBackwardToInTransit:
      mockAssertOrderStatusNotBackwardToInTransit,
    syncInventoryMovementsForTransaction:
      mockSyncInventoryMovementsForTransaction,
  };
});
vi.mock('@/modules/transactions/api/movementStateHelpers', () => ({
  logStatusChange: mockLogStatusChange,
}));
vi.mock('@/modules/transactions/api/auditLogHelpers', () => ({
  logOperationNotification: mockLogOperationNotification,
  logUpdateChanges: mockLogUpdateChanges,
  logImportChange: vi.fn(),
}));

import { transactionService } from '@/modules/transactions/api/service';

const existingTransaction = {
  id: 51,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  orderDate: '2026-10-01',
  customers: 'Trusted Customer',
  customerId: 7,
  productCode: 'SKU-51',
  productId: 1,
  quantity: 1,
  unitPrice: 100,
  discount: 0,
  adjustment: 25,
  lineTotal: 75,
  refundQty: 0,
  refundAmount: 0,
  refundDate: null,
  orderStatus: 'Prepared',
  notes: null,
  invoiceDate: null,
  packedDate: null,
  shippedAt: null,
  accountsReceivableDueAt: null,
  shipmentCode: 'SHIP-51',
  deletedAt: null,
  statusChanges: [],
};

describe('transactionService Accounts Receivable transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T12:00:00.000Z'));
    mockPrisma.transaction.findUnique.mockResolvedValue(existingTransaction);
    mockPrisma.transaction.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...existingTransaction,
        ...data,
      })
    );
    mockPrisma.transaction.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockPrisma.price.findMany.mockResolvedValue([]);
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 7, creditApproved: true },
    ]);
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma)
    );
    mockSyncInventoryMovementsForTransaction.mockResolvedValue(undefined);
    mockPrisma.transaction.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...existingTransaction,
        ...data,
      })
    );
    mockLogOperationNotification.mockResolvedValue(undefined);
    mockLogUpdateChanges.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { mode: 'single', lineTotal: 0 },
    { mode: 'bulk', lineTotal: 0 },
    { mode: 'single', lineTotal: null },
    { mode: 'bulk', lineTotal: null },
  ])(
    'preserves closed balances and stock history on a note edit: %j',
    async ({ mode, lineTotal }) => {
      const closed = {
        ...existingTransaction,
        orderStatus: 'Cancelled',
        lineTotal,
      };
      mockPrisma.transaction.findUnique.mockResolvedValue(closed);
      mockPrisma.transaction.update.mockImplementation(async ({ data }) => ({
        ...closed,
        ...data,
      }));
      const payload = { id: 51, Notes: 'Customer followed up' };
      if (mode === 'bulk') {
        await transactionService.bulkUpdateTransactions([payload]);
      } else {
        await transactionService.updateTransaction(payload);
      }
      expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { notes: 'Customer followed up' },
        })
      );
      expect(mockSyncInventoryMovementsForTransaction).not.toHaveBeenCalled();
    }
  );

  it.each(['single', 'bulk'])(
    'rejects a financial rewrite through the %s edit path',
    async (mode) => {
      mockPrisma.transaction.findUnique.mockResolvedValue({
        ...existingTransaction,
        orderStatus: 'Cancelled',
        lineTotal: 0,
      });
      const payload = { id: 51, Quantity: 2 };
      await expect(
        mode === 'bulk'
          ? transactionService.bulkUpdateTransactions([payload])
          : transactionService.updateTransaction(payload)
      ).rejects.toThrow('financial history');
      expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
      expect(mockSyncInventoryMovementsForTransaction).not.toHaveBeenCalled();
    }
  );

  it('keeps single-row status and movement writes inside the transaction and rejects movement failures', async () => {
    const tx = { transaction: mockPrisma.transaction };
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(tx)
    );
    mockSyncInventoryMovementsForTransaction.mockRejectedValueOnce(
      new Error('movement failure')
    );
    await expect(
      transactionService.updateTransaction({ id: 51, Notes: 'changed' })
    ).rejects.toThrow('movement failure');
    expect(mockLogStatusChange).toHaveBeenCalledWith(
      tx,
      51,
      'Prepared',
      'Prepared'
    );
    expect(mockSyncInventoryMovementsForTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ id: 51 })
    );
    expect(mockLogOperationNotification).not.toHaveBeenCalled();
    expect(mockLogUpdateChanges).not.toHaveBeenCalled();
  });

  it('saves the reported positive-balance order as A/R without customer credit approval', async () => {
    const reportedTransaction = {
      ...existingTransaction,
      orderDate: '2026-10-19',
      customers: 'Joseph Bautista | Aya Ole',
      productCode: 'Premium Shortsleeves Onesie (PSO-101226)',
      quantity: 50,
      unitPrice: 69,
      adjustment: 345,
      lineTotal: 3105,
    };
    mockPrisma.transaction.findUnique.mockResolvedValue(reportedTransaction);
    mockPrisma.transaction.update.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...reportedTransaction,
        ...data,
      })
    );
    mockPrisma.customer.findMany.mockResolvedValue([
      { id: 7, creditApproved: false },
    ]);

    const result = await transactionService.updateTransaction({
      id: 51,
      'Order Status': 'Accounts Receivable',
    });

    expect(result.transaction).toMatchObject({
      'Order Status': 'Accounts Receivable',
      'Line Total': 3105,
    });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({ orderStatus: 'Accounts Receivable' }),
    });
  });

  it('sets shipment and two-month due dates when an order ships on credit', async () => {
    await transactionService.updateTransaction({
      id: 51,
      'Order Status': 'Accounts Receivable',
    });

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({
        orderStatus: 'Accounts Receivable',
        shippedAt: new Date('2026-10-23T12:00:00.000Z'),
        accountsReceivableDueAt: new Date('2026-12-23T12:00:00.000Z'),
      }),
    });
  });

  it('rejects a stale revision without writing transaction or movements', async () => {
    await expect(
      transactionService.updateTransaction({
        id: 51,
        revision: getTransactionRevision({
          ...existingTransaction,
          notes: 'older',
        }),
        Notes: 'stale',
      })
    ).rejects.toThrow('changed since');
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
    expect(mockSyncInventoryMovementsForTransaction).not.toHaveBeenCalled();
  });

  it('conditionally writes the revision read by the client', async () => {
    await transactionService.updateTransaction({
      id: 51,
      revision: getTransactionRevision(existingTransaction),
      Notes: 'current',
    });
    expect(mockPrisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 51, updatedAt: existingTransaction.updatedAt },
      })
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('imports positive-balance A/R without a credit approval lookup', async () => {
    const result = await transactionService.importTransactions([
      {
        'Order Date': '2026-10-19',
        Customers: 'Joseph Bautista | Aya Ole',
        'Product Code': 'PSO-101226',
        Quantity: 50,
        'Unit Price': 69,
        Adjustment: 345,
        'Order Status': 'Accounts Receivable',
      },
    ]);

    expect(result.count).toBe(1);
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderStatus: 'Accounts Receivable',
        lineTotal: 3105,
      }),
    });
    expect(mockPrisma.transaction.createMany).not.toHaveBeenCalled();
    expect(mockSyncInventoryMovementsForTransaction).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({ id: 51, orderStatus: 'Accounts Receivable' })
    );
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('saves positive-balance A/R in a bulk update without credit approval', async () => {
    const findUnique = vi.fn().mockResolvedValue(existingTransaction);
    const update = vi
      .fn()
      .mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...existingTransaction,
          ...data,
        })
      );
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        transaction: { findUnique, update },
        customer: { findMany: mockPrisma.customer.findMany },
      })
    );

    await transactionService.bulkUpdateTransactions([
      { id: 51, 'Order Status': 'Accounts Receivable' },
    ]);

    expect(update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({ orderStatus: 'Accounts Receivable' }),
    });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('sets Shipped instead of A/R when a missing line total calculates to zero', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      ...existingTransaction,
      lineTotal: null,
      adjustment: 100,
    });

    await transactionService.updateTransaction({
      id: 51,
      'Order Status': 'Accounts Receivable',
    });

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({
        lineTotal: 0,
        orderStatus: 'Shipped',
      }),
    });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('ships an existing A/R order when an adjustment reduces its line total to zero', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      ...existingTransaction,
      orderStatus: 'Accounts Receivable',
      lineTotal: 100,
      adjustment: 0,
      shippedAt: new Date('2026-10-01T00:00:00.000Z'),
      accountsReceivableDueAt: new Date('2026-12-01T00:00:00.000Z'),
    });

    await transactionService.updateTransaction({
      id: 51,
      Adjustment: 100,
    });

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({
        adjustment: 100,
        lineTotal: 0,
        orderStatus: 'Shipped',
      }),
    });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('ships an existing A/R order in a batch update when its line total reaches zero', async () => {
    const existingReceivable = {
      ...existingTransaction,
      orderStatus: 'Accounts Receivable',
      lineTotal: 100,
      adjustment: 0,
    };
    const findUnique = vi.fn().mockResolvedValue(existingReceivable);
    const update = vi
      .fn()
      .mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => ({
          ...existingReceivable,
          ...data,
        })
      );
    const transactionClient = {
      transaction: { findUnique, update },
      customer: { findMany: mockPrisma.customer.findMany },
    };
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(transactionClient)
    );

    await transactionService.bulkUpdateTransactions([
      { id: 51, Adjustment: 100 },
    ]);

    expect(update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({
        adjustment: 100,
        lineTotal: 0,
        orderStatus: 'Shipped',
      }),
    });
  });

  it('does not treat a negative line total as zero when setting A/R', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      ...existingTransaction,
      lineTotal: -1,
    });

    await expect(
      transactionService.updateTransaction({
        id: 51,
        'Order Status': 'Accounts Receivable',
      })
    ).rejects.toThrow(
      'Accounts Receivable requires a positive outstanding balance'
    );

    expect(mockPrisma.transaction.update).not.toHaveBeenCalled();
  });

  it('does not replace the shipment or due date on later A/R updates', async () => {
    mockPrisma.transaction.findUnique.mockResolvedValue({
      ...existingTransaction,
      orderStatus: 'Accounts Receivable',
      shippedAt: new Date('2026-09-01T12:00:00.000Z'),
      accountsReceivableDueAt: new Date('2026-11-01T12:00:00.000Z'),
    });

    await transactionService.updateTransaction({
      id: 51,
      'Order Status': 'Accounts Receivable',
    });

    expect(mockPrisma.transaction.update).toHaveBeenCalledWith({
      where: { id: 51 },
      data: expect.objectContaining({
        shippedAt: new Date('2026-09-01T12:00:00.000Z'),
        accountsReceivableDueAt: new Date('2026-11-01T12:00:00.000Z'),
      }),
    });
  });
});
