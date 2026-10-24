import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transactionService } from '../service';

const database = vi.hoisted(() => ({
  transaction: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  inventoryMovement: { findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: database }));
vi.mock('../auditLogHelpers', () => ({
  logImportChange: vi.fn(),
  logOperationNotification: vi.fn(),
  logUpdateChanges: vi.fn(),
}));

const draft = {
  id: 1,
  orderStatus: 'Warehouse',
  adjustment: 0,
  payments: [],
  refunds: [],
};

describe('transaction bulk deletion integrity', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    database.$transaction.mockImplementation(
      async (operation: (client: typeof database) => Promise<unknown>) =>
        operation(database)
    );
    database.transaction.count.mockResolvedValue(0);
    database.transaction.findMany.mockResolvedValue([draft]);
    database.transaction.updateMany.mockResolvedValue({ count: 1 });
    database.inventoryMovement.findFirst.mockResolvedValue(null);
    database.inventoryMovement.updateMany.mockResolvedValue({ count: 1 });
  });

  it('deactivates only owned automatic movements while deleting unposted drafts', async () => {
    expect((await transactionService.softDeleteAll()).deleted).toBe(1);
    expect(database.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
    expect(database.inventoryMovement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceTransactionId: 1,
          movementSource: 'transaction',
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      })
    );
    expect(database.inventoryMovement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { notes: 'auto-reserve txn 1', deletedAt: null },
      })
    );
  });

  it.each([
    { orderStatus: 'Shipped' },
    { adjustment: 10 },
    { payments: [{ id: 1 }] },
    { refunds: [{ id: 1 }] },
    { refundAmount: 10 },
    { refundQty: 1 },
    { invoiceDate: '2026-10-24' },
    { statusChanges: [{ newStatus: 'Shipped' }] },
  ])(
    'rejects financial or fulfillment history %j before any deletion',
    async (history) => {
      database.transaction.findMany.mockResolvedValue([
        { ...draft, ...history },
      ]);
      await expect(transactionService.softDeleteAll()).rejects.toThrow(
        'Cannot mass-delete'
      );
      expect(database.transaction.updateMany).not.toHaveBeenCalled();
      expect(database.inventoryMovement.updateMany).not.toHaveBeenCalled();
    }
  );

  it('rejects a stale active sale movement even when the parent is a draft', async () => {
    database.inventoryMovement.findFirst.mockResolvedValue({ id: 55 });
    await expect(transactionService.softDeleteAll()).rejects.toThrow(
      'posted inventory movements'
    );
    expect(database.transaction.updateMany).not.toHaveBeenCalled();
  });

  it('does not delete the parent if movement deactivation fails', async () => {
    database.inventoryMovement.updateMany.mockRejectedValue(
      new Error('write failed')
    );
    await expect(transactionService.softDeleteAll()).rejects.toThrow(
      'write failed'
    );
    expect(database.transaction.updateMany).not.toHaveBeenCalled();
  });
});
