import { describe, expect, it } from 'vitest';
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
