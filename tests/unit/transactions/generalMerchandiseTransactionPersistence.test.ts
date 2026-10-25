import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db, ensureCustomers } = vi.hoisted(() => ({
  db: {
    generalMerchandiseTransaction: {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    generalMerchandiseInventoryMovement: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  ensureCustomers: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
vi.mock('@/modules/general-merchandise/customers/api/service', () => ({
  ensureGeneralMerchandiseCustomersForNames: ensureCustomers,
}));
import { generalMerchandiseTransactionService as service } from '@/modules/general-merchandise/transactions/api/service';
import { getTransactionRevision } from '@/modules/transactions/api/updateConcurrency';

const existing = {
  id: 1,
  customerId: 7,
  customers: 'Customer',
  quantity: 0,
  productCode: '',
  adjustment: 0,
  updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  deletedAt: null,
};
describe('GM transaction persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback) => callback(db));
    db.generalMerchandiseTransaction.findUniqueOrThrow.mockResolvedValue(
      existing
    );
    db.generalMerchandiseTransaction.update.mockImplementation(
      async ({ data }) => ({
        ...existing,
        ...Object.fromEntries(
          Object.entries(data).filter(([, value]) => value !== undefined)
        ),
      })
    );
    db.generalMerchandiseInventoryMovement.findFirst.mockResolvedValue(null);
    db.generalMerchandiseInventoryMovement.updateMany.mockResolvedValue({
      count: 0,
    });
  });
  it('does not clear the customer relation on a Notes-only patch', async () => {
    await service.updateTransaction({ id: 1, Notes: 'note' });
    const data = db.generalMerchandiseTransaction.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('customerId');
    expect(ensureCustomers).not.toHaveBeenCalled();
  });
  it('persists Adjustment', async () => {
    const result = await service.updateTransaction({ id: 1, Adjustment: 25 });
    expect(result.transaction.Adjustment).toBe(25);
  });
  it('rejects invalid nested field values before updating', async () => {
    await expect(
      service.updateTransaction({ id: 1, 'Order Status': 'NOT_A_STATUS' })
    ).rejects.toThrow('Invalid transaction payload');
    expect(db.generalMerchandiseTransaction.update).not.toHaveBeenCalled();
  });
  it('rejects stale revisions and keeps per-row bulk acknowledgements', async () => {
    await expect(
      service.updateTransaction({
        id: 1,
        revision: getTransactionRevision({ ...existing, notes: 'older' }),
        Notes: 'old',
      })
    ).rejects.toThrow('changed since');
    const result = await service.bulkUpdateTransactions([
      { id: 1, Notes: 'new' },
    ]);
    expect(result).toMatchObject({
      count: 1,
      transactions: [{ id: 1, Notes: 'new' }],
    });
  });
});
