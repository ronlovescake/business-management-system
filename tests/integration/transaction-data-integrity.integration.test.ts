import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const rawCount = async (tableName: string) => {
  const [row] = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM "${tableName}"`
  );
  return row.count;
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
});
