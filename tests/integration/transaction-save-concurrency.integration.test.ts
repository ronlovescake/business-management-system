import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { transactionService } from '@/modules/transactions/api/service';
import { mapToDTO } from '@/modules/transactions/api/dto';
import { randomUUID } from 'node:crypto';
import { generalMerchandiseTransactionService } from '@/modules/general-merchandise/transactions/api/service';
import { ensureGeneralMerchandiseCustomersForNames } from '@/modules/general-merchandise/customers/api/service';

let failMovementWrite = false;
prisma.$use(async (parameters, next) => {
  if (failMovementWrite && parameters.model === 'InventoryMovement') {
    throw new Error('INJECTED_TRANSACTION_MOVEMENT_FAILURE');
  }
  return next(parameters);
});

describe('Integration • Transaction save boundaries', () => {
  it('accepts only one of two simultaneous edits using the same revision', async () => {
    const row = await prisma.transaction.create({
      data: { quantity: 1, unitPrice: 10, lineTotal: 10, adjustment: 0 },
    });
    const revision = mapToDTO(row).revision;
    const results = await Promise.allSettled([
      transactionService.updateTransaction({
        id: row.id,
        revision,
        Quantity: 2,
      }),
      transactionService.updateTransaction({
        id: row.id,
        revision,
        'Unit Price': 12,
      }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    const saved = await prisma.transaction.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(saved.lineTotal).toBe(
      Number(saved.quantity) * Number(saved.unitPrice) -
        Number(saved.adjustment)
    );
    await prisma.transaction.delete({ where: { id: row.id } });
  });
  it('acknowledges the same clothing creation key exactly once after a lost response', async () => {
    const creationKey = randomUUID();
    const payload = [
      {
        creationKey,
        'Order Date': '2026-10-25',
        Customers: 'Alice Johnson',
        Notes: 'idempotent create',
      },
    ];
    const first = await transactionService.importTransactions(payload);
    const retry = await transactionService.importTransactions(payload);
    expect(retry.transactions?.[0].id).toBe(first.transactions?.[0].id);
    expect(await prisma.transaction.count({ where: { creationKey } })).toBe(1);
    await prisma.transaction.deleteMany({ where: { creationKey } });
  });

  it('acknowledges the same GM creation key exactly once after a lost response', async () => {
    await ensureGeneralMerchandiseCustomersForNames(['Alice Johnson']);
    const creationKey = randomUUID();
    const payload = [
      {
        creationKey,
        'Order Date': '2026-10-25',
        Customers: 'Alice Johnson',
        Notes: 'idempotent GM create',
      },
    ];
    const first =
      await generalMerchandiseTransactionService.importTransactions(payload);
    const retry =
      await generalMerchandiseTransactionService.importTransactions(payload);
    expect(retry.transactions?.[0].id).toBe(first.transactions?.[0].id);
    expect(
      await prisma.generalMerchandiseTransaction.count({
        where: { creationKey },
      })
    ).toBe(1);
    await prisma.generalMerchandiseTransaction.deleteMany({
      where: { creationKey },
    });
  });
  it('rolls back the row and status history when movement synchronization fails', async () => {
    const row = await prisma.transaction.create({
      data: { notes: 'before', orderStatus: '', quantity: 0 },
    });
    try {
      failMovementWrite = true;
      await expect(
        transactionService.updateTransaction({
          id: row.id,
          Notes: 'after',
          'Order Status': 'Prepared',
        })
      ).rejects.toThrow('INJECTED_TRANSACTION_MOVEMENT_FAILURE');
    } finally {
      failMovementWrite = false;
    }
    expect(
      (await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } }))
        .notes
    ).toBe('before');
    expect(
      await prisma.transactionStatusChange.count({
        where: { transactionId: row.id },
      })
    ).toBe(0);
    await prisma.transaction.delete({ where: { id: row.id } });
  });

  it('rejects a second client stale bulk snapshot without reverting a payment or note', async () => {
    const row = await prisma.transaction.create({
      data: {
        quantity: 2,
        unitPrice: 10,
        lineTotal: 20,
        adjustment: 0,
        notes: 'original',
      },
    });
    const stale = mapToDTO(row);
    await transactionService.updateTransaction({
      id: row.id,
      revision: stale.revision,
      Adjustment: 5,
      Notes: 'other client',
    });
    await expect(
      transactionService.bulkUpdateTransactions([
        { ...stale, Notes: 'stale paste' },
      ])
    ).rejects.toThrow('changed since');
    const saved = await prisma.transaction.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(saved).toMatchObject({
      adjustment: 5,
      notes: 'other client',
      lineTotal: 15,
    });
    await prisma.transaction.delete({ where: { id: row.id } });
  });

  it('returns a canonical bulk revision usable by the next partial write', async () => {
    const row = await prisma.transaction.create({
      data: { quantity: 0, notes: 'original' },
    });
    const bulk = await transactionService.bulkUpdateTransactions([
      { id: row.id, revision: mapToDTO(row).revision, Notes: 'bulk' },
    ]);
    expect(bulk.transactions?.[0].revision).not.toBe(mapToDTO(row).revision);
    await transactionService.updateTransaction({
      id: row.id,
      revision: bulk.transactions?.[0].revision,
      Notes: 'next',
    });
    expect(
      (await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } }))
        .notes
    ).toBe('next');
    await prisma.transaction.delete({ where: { id: row.id } });
  });
});
