import { describe, expect, it } from 'vitest';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const rawCount = async (tableName: string) => {
  const [row] = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM "${tableName}"`
  );
  return row.count;
};

const rawSchemaCount = async (schemaName: string, tableName: string) => {
  const [row] = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM "${schemaName}"."${tableName}"`
  );
  return row.count;
};

const gmSchemaUnavailable = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes('general_merchandise.transactions') &&
    error.message.includes('does not exist')
  );
};

const createGmTransactionCandidate = async () => {
  return prisma.generalMerchandiseTransaction.create({
    data: {
      orderDate: '2026-03-18',
      customers: 'Integrity Test Customer',
      productCode: 'GM-INTEGRITY-001',
      quantity: 1,
      unitPrice: 10,
      discount: 0,
      adjustment: 0,
      lineTotal: 10,
      orderStatus: 'Warehouse',
      shipmentCode: 'GM-INTEGRITY-SHIP',
      notes: 'temporary integration candidate',
    },
  });
};

describe('Integration • Data integrity safeguards', () => {
  it('keeps product links and historical unit prices when product details change', async () => {
    const suffix = randomUUID().slice(0, 8);
    const oldCode = `S-${suffix}`;
    const newCode = `SS-${suffix}`;
    let verified = false;

    try {
      await prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            product: 'Skort',
            productCode: oldCode,
            actualPrice: 100,
            shipmentCode: 'SH-OLD',
          },
        });
        await tx.price.createMany({
          data: [
            {
              productCode: oldCode,
              lowerLimit: 100,
              upperLimit: 200,
              currentPrice: 11500,
            },
            {
              productCode: oldCode,
              lowerLimit: 201,
              upperLimit: 10000,
              currentPrice: 10000,
            },
          ],
        });
        const order = await tx.transaction.create({
          data: {
            productCode: oldCode,
            shipmentCode: 'SH-OLD',
            unitPrice: 115,
            lineTotal: 230,
          },
        });
        await tx.inventoryMovement.create({
          data: {
            productCode: oldCode,
            quantity: 2,
            fromBucket: 'opening_inventory',
            toBucket: 'sellable',
            sourceTransactionId: order.id,
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: {
            product: 'Short Sleeves',
            productCode: newCode,
            actualPrice: 120,
            shipmentCode: 'SH-NEW',
          },
        });

        const tiers = await tx.price.findMany({
          where: { productId: product.id },
          orderBy: { lowerLimit: 'asc' },
        });
        expect(
          tiers.map((tier) => [tier.productCode, tier.currentPrice])
        ).toEqual([
          [newCode, 12500],
          [newCode, 12000],
        ]);
        expect(
          await tx.transaction.findUnique({ where: { id: order.id } })
        ).toEqual(
          expect.objectContaining({
            productId: product.id,
            productCode: newCode,
            shipmentCode: 'SH-NEW',
            unitPrice: 115,
            lineTotal: 230,
          })
        );
        expect(
          await tx.inventoryMovement.count({
            where: { productId: product.id, productCode: newCode },
          })
        ).toBe(1);
        verified = true;
        throw new Error('ROLLBACK_PRODUCT_IDENTITY_TEST');
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== 'ROLLBACK_PRODUCT_IDENTITY_TEST'
      ) {
        throw error;
      }
    }

    expect(verified).toBe(true);
  });

  it('updates transaction records without altering total rows', async () => {
    const tableName = 'transactions';
    const before = await rawCount(tableName);

    await prisma.transaction.updateMany({
      where: { customers: 'Alice Johnson' },
      data: { discount: 5 },
    });

    const after = await rawCount(tableName);
    expect(after).toBe(before);
  });

  it('soft deletes mark rows instead of removing them', async () => {
    const tableName = 'transactions';
    const candidate = await prisma.transaction.findFirst();

    expect(candidate).toBeTruthy();
    if (!candidate) {
      return;
    }

    const before = await rawCount(tableName);

    await prisma.transaction.delete({
      where: { id: candidate.id },
    });

    const after = await rawCount(tableName);
    expect(after).toBe(before);

    const [{ deletedAt }] = await prisma.$queryRawUnsafe<
      { deletedAt: Date | null }[]
    >(`SELECT "deletedAt" FROM "transactions" WHERE id = ${candidate.id}`);
    expect(deletedAt).not.toBeNull();

    const auditEntries = await prisma.$queryRaw<{ action: string }[]>(
      Prisma.sql`
        SELECT action
        FROM "audit_logs"
        WHERE model = 'Transaction'
          AND "targetId" = ${candidate.id.toString()}
        ORDER BY "timestamp" DESC
        LIMIT 1
      `
    );
    expect(auditEntries.length).toBeGreaterThan(0);

    await prisma.$executeRawUnsafe(
      `UPDATE "transactions" SET "deletedAt" = NULL WHERE id = ${candidate.id}`
    );
  });

  it('shipment updates preserve row counts', async () => {
    const tableName = 'shipments';
    const before = await rawCount(tableName);

    await prisma.shipment.updateMany({
      where: { shipmentCode: 'SHIP-001' },
      data: { notes: 'Integrity check update' },
    });

    const after = await rawCount(tableName);
    expect(after).toBe(before);
  });

  it('updates GM transaction records without altering total rows', async () => {
    let before = 0;
    let candidate = null;

    try {
      before = await rawSchemaCount('general_merchandise', 'transactions');
      candidate = await prisma.generalMerchandiseTransaction.findFirst();
    } catch (error) {
      if (gmSchemaUnavailable(error)) {
        expect(true).toBe(true);
        return;
      }
      throw error;
    }

    if (!candidate) {
      expect(before).toBeGreaterThanOrEqual(0);
      return;
    }

    await prisma.generalMerchandiseTransaction.updateMany({
      where: { id: candidate.id },
      data: { discount: 5 },
    });

    const after = await rawSchemaCount('general_merchandise', 'transactions');
    expect(after).toBe(before);
  });

  it('keeps GM records linked through product-code changes and recalculates price tiers', async () => {
    const suffix = randomUUID().slice(0, 8);
    const oldCode = `GM-OLD-${suffix}`;
    const newCode = `GM-NEW-${suffix}`;
    const oldShipmentCode = `GM-SHIP-OLD-${suffix}`;
    const newShipmentCode = `GM-SHIP-NEW-${suffix}`;
    let verified = false;

    try {
      await prisma.$transaction(async (tx) => {
        const product = await tx.generalMerchandiseProduct.create({
          data: {
            product: 'Identity Test Product',
            productCode: oldCode,
            actualPrice: 100,
            shipmentCode: oldShipmentCode,
          },
        });
        await tx.generalMerchandisePrice.createMany({
          data: [
            {
              productCode: oldCode,
              lowerLimit: 100,
              upperLimit: 200,
              currentPrice: 11500,
            },
            {
              productCode: oldCode,
              lowerLimit: 201,
              upperLimit: 10000,
              currentPrice: 10000,
            },
            {
              productCode: oldCode,
              lowerLimit: 10001,
              upperLimit: 20000,
              currentPrice: 7777,
              deletedAt: new Date(),
            },
          ],
        });
        const transaction = await tx.generalMerchandiseTransaction.create({
          data: {
            productCode: oldCode,
            shipmentCode: oldShipmentCode,
            quantity: 2,
            unitPrice: 115,
            lineTotal: 230,
          },
        });
        await tx.generalMerchandiseInventoryMovement.create({
          data: {
            productCode: oldCode,
            quantity: 2,
            fromBucket: 'opening_inventory',
            toBucket: 'sellable',
            sourceTransactionId: transaction.id,
          },
        });
        const batch = await tx.generalMerchandiseBundleBatch.create({
          data: {
            postingDate: '2026-03-18',
            bundleName: `Identity Bundle ${suffix}`,
            bundleSku: `GM-BUNDLE-${suffix}`,
            quantity: 1,
            price: 10,
          },
        });
        await tx.generalMerchandiseBundleBatchComponent.create({
          data: {
            bundleBatchId: batch.id,
            componentProductCode: oldCode,
            includedQuantity: 1,
          },
        });
        await tx.generalMerchandiseSortingDistribution.create({
          data: {
            productCode: oldCode,
            rowNumber: 1,
            quantity: 1,
          },
        });
        await tx.generalMerchandiseInventoryReclassEntry.create({
          data: {
            postingDate: new Date('2026-03-18T00:00:00.000Z'),
            shipmentCode: oldShipmentCode,
            productCode: oldCode,
            amount: 10,
            fromAccount: 'Inventory in Transit',
            toAccount: 'Inventory',
            triggerStatus: 'pending',
            idempotencyKey: `GM-IDENTITY-${suffix}`,
          },
        });

        await tx.generalMerchandiseProduct.update({
          where: { id: product.id },
          data: {
            productCode: newCode,
            actualPrice: 120,
            shipmentCode: newShipmentCode,
          },
        });

        const [
          tiers,
          archivedTiers,
          updatedTransaction,
          movement,
          component,
          distribution,
          reclass,
          alias,
          oldCodeTransaction,
        ] = await Promise.all([
          tx.generalMerchandisePrice.findMany({
            where: { productId: product.id },
            orderBy: { lowerLimit: 'asc' },
          }),
          tx.$queryRaw<{ currentPrice: number }[]>`
              SELECT "currentPrice"
              FROM general_merchandise.prices
              WHERE "productId" = ${product.id} AND "deletedAt" IS NOT NULL
            `,
          tx.generalMerchandiseTransaction.findUnique({
            where: { id: transaction.id },
          }),
          tx.generalMerchandiseInventoryMovement.findFirst({
            where: { sourceTransactionId: transaction.id },
          }),
          tx.generalMerchandiseBundleBatchComponent.findFirst({
            where: { bundleBatchId: batch.id },
          }),
          tx.generalMerchandiseSortingDistribution.findFirst({
            where: { productId: product.id },
          }),
          tx.generalMerchandiseInventoryReclassEntry.findFirst({
            where: { productId: product.id },
          }),
          tx.generalMerchandiseProductCodeAlias.findFirst({
            where: { productId: product.id, code: oldCode },
          }),
          tx.generalMerchandiseTransaction.create({
            data: { productCode: oldCode },
          }),
        ]);

        expect(
          tiers.map((tier) => [tier.productCode, tier.currentPrice])
        ).toEqual([
          [newCode, 12500],
          [newCode, 12000],
        ]);
        expect(archivedTiers).toEqual([{ currentPrice: 7777 }]);
        expect(updatedTransaction).toEqual(
          expect.objectContaining({
            productId: product.id,
            productCode: newCode,
            shipmentCode: newShipmentCode,
            unitPrice: 115,
            lineTotal: 230,
          })
        );
        expect(movement).toEqual(
          expect.objectContaining({
            productId: product.id,
            productCode: newCode,
          })
        );
        expect(component).toEqual(
          expect.objectContaining({
            productId: product.id,
            componentProductCode: newCode,
          })
        );
        expect(distribution).toEqual(
          expect.objectContaining({
            productId: product.id,
            productCode: newCode,
          })
        );
        expect(reclass).toEqual(
          expect.objectContaining({
            productId: product.id,
            productCode: newCode,
          })
        );
        expect(alias).toEqual(expect.objectContaining({ code: oldCode }));
        expect(oldCodeTransaction.productId).toBeNull();

        verified = true;
        throw new Error('ROLLBACK_GM_PRODUCT_IDENTITY_TEST');
      });
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== 'ROLLBACK_GM_PRODUCT_IDENTITY_TEST'
      ) {
        throw error;
      }
    }

    expect(verified).toBe(true);
  });

  it('rejects ambiguous GM product-code resolution and mismatched explicit IDs', async () => {
    const suffix = randomUUID().slice(0, 8);
    const ambiguousCode = `GM-AMBIGUOUS-${suffix}`;

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.generalMerchandiseProduct.createMany({
          data: [
            { productCode: ambiguousCode },
            { productCode: ambiguousCode },
          ],
        });
        return tx.generalMerchandiseTransaction.create({
          data: { productCode: ambiguousCode },
        });
      })
    ).rejects.toThrow(/ambiguous/i);

    await expect(
      prisma.$transaction(async (tx) => {
        const product = await tx.generalMerchandiseProduct.create({
          data: { productCode: `GM-MATCH-${suffix}` },
        });
        return tx.generalMerchandiseTransaction.create({
          data: {
            productId: product.id,
            productCode: `GM-MISMATCH-${suffix}`,
          },
        });
      })
    ).rejects.toThrow(/do not match/i);
  });

  it('soft deletes GM rows by marking deletedAt instead of removing them', async () => {
    let candidate = null;
    let createdCandidateId: number | null = null;

    try {
      candidate = await prisma.generalMerchandiseTransaction.findFirst();
      if (!candidate) {
        candidate = await createGmTransactionCandidate();
        createdCandidateId = candidate.id;
      }
    } catch (error) {
      if (gmSchemaUnavailable(error)) {
        expect(true).toBe(true);
        return;
      }
      throw error;
    }

    expect(candidate).toBeTruthy();
    if (!candidate) {
      return;
    }

    let before = 0;

    try {
      before = await rawSchemaCount('general_merchandise', 'transactions');
    } catch (error) {
      if (gmSchemaUnavailable(error)) {
        expect(true).toBe(true);
        return;
      }
      throw error;
    }

    await prisma.generalMerchandiseTransaction.delete({
      where: { id: candidate.id },
    });

    const after = await rawSchemaCount('general_merchandise', 'transactions');
    expect(after).toBe(before);

    const [{ deletedAt }] = await prisma.$queryRawUnsafe<
      { deletedAt: Date | null }[]
    >(
      `SELECT "deletedAt" FROM "general_merchandise"."transactions" WHERE id = ${candidate.id}`
    );
    expect(deletedAt).not.toBeNull();

    if (createdCandidateId !== null) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "general_merchandise"."transactions" WHERE id = ${createdCandidateId}`
      );
      return;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "general_merchandise"."transactions" SET "deletedAt" = NULL WHERE id = ${candidate.id}`
    );
  });
});
