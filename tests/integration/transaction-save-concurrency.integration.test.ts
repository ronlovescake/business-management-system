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
  it.each(['single', 'bulk'])(
    'clears and re-enters clothing customer and product cells through %s saves',
    async (mode) => {
      const product = await prisma.product.create({
        data: { productCode: `CLEAR-${randomUUID()}` },
      });
      const replacement = await prisma.product.create({
        data: { productCode: `REENTER-${randomUUID()}` },
      });
      const customer = await prisma.customer.create({
        data: {
          date: '2026-10-27',
          customerName: `Clear regression ${randomUUID()}`,
          phoneNumber: '',
          address: '',
          facebook: '',
          emailAddress: '',
          businessName: '',
          taxNumber: '',
          businessAddress: '',
          businessContactNumber: '',
          customerStatus: 'Active',
        },
      });
      const save = async (payload: Record<string, unknown>) => {
        if (mode === 'single') {
          return (await transactionService.updateTransaction(payload))
            .transaction;
        }
        const result = await transactionService.bulkUpdateTransactions([
          payload,
        ]);
        expect(result.transactions).toHaveLength(1);
        return result.transactions![0];
      };
      const row = await prisma.transaction.create({
        data: {
          orderDate: 'October 27, 2026',
          customers: customer.customerName,
          productCode: product.productCode,
          quantity: 0,
          unitPrice: 0,
          discount: 0,
          adjustment: 0,
          lineTotal: 0,
          orderStatus: '',
        },
      });
      try {
        expect(row.productId).toBe(product.id);
        expect(row.customerId).toBe(customer.id);
        const cleared = await save({
          ...mapToDTO(row),
          Customers: '',
          'Product Code': '',
        });
        expect(cleared).toMatchObject({
          Customers: '',
          'Product Code': '',
          Quantity: 0,
          'Line Total': 0,
        });
        const unlinked = await prisma.transaction.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(unlinked).toMatchObject({ productId: null, customerId: null });
        const customerReentered = await save({
          id: row.id,
          revision: cleared.revision,
          Customers: customer.customerName,
        });
        expect(customerReentered['Product Code']).toBe('');
        const reentered = await save({
          id: row.id,
          revision: customerReentered.revision,
          'Product Code': replacement.productCode,
        });
        const saved = await prisma.transaction.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(saved).toMatchObject({
          customers: customer.customerName,
          customerId: customer.id,
          productId: replacement.id,
          productCode: replacement.productCode,
          quantity: 0,
          lineTotal: 0,
        });
        expect(reentered['Product Code']).toBe(replacement.productCode);
        await save({
          id: row.id,
          revision: reentered.revision,
          Notes: 'Editable after correction',
        });
      } finally {
        await prisma.$executeRaw`DELETE FROM public.transactions WHERE id = ${row.id}`;
        await prisma.$executeRaw`DELETE FROM public.products WHERE id IN (${product.id}, ${replacement.id})`;
        await prisma.$executeRaw`DELETE FROM public."Customer" WHERE id = ${customer.id}`;
      }
    }
  );

  it('preserves automatic inventory history and financial values when a linked product is cleared', async () => {
    const product = await prisma.product.create({
      data: { productCode: `RESERVE-CLEAR-${randomUUID()}` },
    });
    const row = await prisma.transaction.create({
      data: {
        productCode: product.productCode,
        orderStatus: 'Prepared',
        quantity: 2,
        unitPrice: 10,
        adjustment: 0,
        lineTotal: 20,
      },
    });
    try {
      const reserved = await transactionService.updateTransaction({
        id: row.id,
        revision: mapToDTO(row).revision,
        Notes: 'Create owned reserve',
      });
      const movements = await prisma.inventoryMovement.findMany({
        where: { sourceTransactionId: row.id },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({
        productId: product.id,
        productCode: product.productCode,
        quantity: 2,
        movementSource: 'transaction',
        movementType: 'reserve',
        deletedAt: null,
      });
      await transactionService.updateTransaction({
        id: row.id,
        revision: reserved.transaction.revision,
        'Product Code': '',
        'Order Status': '',
      });
      const saved = await prisma.transaction.findUniqueOrThrow({
        where: { id: row.id },
      });
      expect(saved).toMatchObject({
        productId: null,
        productCode: '',
        quantity: 2,
        unitPrice: 10,
        adjustment: 0,
        lineTotal: 20,
      });
      const history = await prisma.$queryRaw<
        Array<{
          productId: number;
          productCode: string;
          quantity: number;
          deletedAt: Date | null;
        }>
      >`SELECT "productId", "productCode", quantity, "deletedAt" FROM public.inventory_movements WHERE id = ${movements[0].id}`;
      expect(history).toEqual([
        {
          productId: product.id,
          productCode: product.productCode,
          quantity: 2,
          deletedAt: expect.any(Date),
        },
      ]);
    } finally {
      await prisma.$executeRaw`DELETE FROM public.inventory_movements WHERE "sourceTransactionId" = ${row.id}`;
      await prisma.transactionStatusChange.deleteMany({
        where: { transactionId: row.id },
      });
      await prisma.$executeRaw`DELETE FROM public.transactions WHERE id = ${row.id}`;
      await prisma.$executeRaw`DELETE FROM public.products WHERE id = ${product.id}`;
    }
  });

  it('retains missing and ambiguous replacement guards and non-transaction product identity rules', async () => {
    const duplicateCode = `AMBIGUOUS-${randomUUID()}`;
    const products = await Promise.all(
      [`GUARD-${randomUUID()}`, duplicateCode, duplicateCode].map(
        (productCode) => prisma.product.create({ data: { productCode } })
      )
    );
    const product = products[0];
    const row = await prisma.transaction.create({
      data: {
        productCode: product.productCode,
        quantity: 0,
        notes: 'original',
      },
    });
    const price = await prisma.price.create({
      data: {
        productCode: product.productCode!,
        lowerLimit: 1,
        upperLimit: 10,
        currentPrice: 20,
      },
    });
    try {
      for (const productCode of [`MISSING-${randomUUID()}`, duplicateCode]) {
        await expect(
          transactionService.updateTransaction({
            id: row.id,
            revision: mapToDTO(row).revision,
            'Product Code': productCode,
            Notes: 'must roll back',
          })
        ).rejects.toThrow('Product code is missing or ambiguous');
        const saved = await prisma.transaction.findUniqueOrThrow({
          where: { id: row.id },
        });
        expect(saved).toMatchObject({
          productId: product.id,
          productCode: product.productCode,
          notes: 'original',
        });
        expect(mapToDTO(saved).revision).toBe(mapToDTO(row).revision);
      }
      expect(price.productId).toBe(product.id);
      await expect(
        prisma.price.update({
          where: { id: price.id },
          data: { productCode: '' },
        })
      ).rejects.toThrow('Product code is missing or ambiguous');
      await expect(
        prisma.transaction.create({
          data: { productId: product.id, productCode: '' },
        })
      ).rejects.toThrow('Product ID and code do not match');
    } finally {
      await prisma.$executeRaw`DELETE FROM public.prices WHERE id = ${price.id}`;
      await prisma.$executeRaw`DELETE FROM public.transactions WHERE id = ${row.id}`;
      await prisma.$executeRaw`DELETE FROM public.products WHERE id IN (${products[0].id}, ${products[1].id}, ${products[2].id})`;
    }
  });

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
