/*
  One-time cleanup script: soft-delete duplicate auto inventory movements
  and duplicate transaction payments.

  Safety:
  - DRY RUN by default (no changes).
  - Apply requires explicit --apply --confirm=cleanup-duplicates.
  - Uses soft-delete (sets deletedAt) only.

  Usage:
    npx tsx scripts/one-time-cleanup-duplicates.ts

  Apply (soft-delete duplicates):
    npx tsx scripts/one-time-cleanup-duplicates.ts --apply --confirm=cleanup-duplicates
*/

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const CONFIRM_VALUE = 'cleanup-duplicates';
const DUPLICATE_NOTES_PREFIXES = ['auto-reserve txn ', 'auto-sale txn '];

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const apply = args.includes('--apply');
  const confirmArg = args.find((a) => a.startsWith('--confirm='));
  const confirmValue = confirmArg?.split('=')[1] ?? null;
  return { apply, confirmValue };
}

function toKeyPart(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim().toLowerCase();
}

function toAmountKey(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return '0.00';
  }
  return n.toFixed(2);
}

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length <= size) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const { apply, confirmValue } = parseArgs(process.argv);

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: DUPLICATE_NOTES_PREFIXES.map((prefix) => ({
        notes: { startsWith: prefix },
      })),
    },
    select: {
      id: true,
      createdAt: true,
      notes: true,
      productCode: true,
      fromBucket: true,
      toBucket: true,
      quantity: true,
      postingDate: true,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });

  const movementsByNote = new Map<string, typeof movements>();
  for (const movement of movements) {
    const note = (movement.notes ?? '').trim();
    if (!note) {
      continue;
    }
    const existing = movementsByNote.get(note) ?? [];
    existing.push(movement);
    movementsByNote.set(note, existing);
  }

  const duplicateMovementIds: number[] = [];
  const movementSummary = Array.from(movementsByNote.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([note, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        const diff = b.createdAt.getTime() - a.createdAt.getTime();
        if (diff !== 0) {
          return diff;
        }
        return b.id - a.id;
      });
      const keep = sorted[0];
      const toDelete = sorted.slice(1);
      duplicateMovementIds.push(...toDelete.map((row) => row.id));
      return {
        note,
        keepId: keep.id,
        duplicateIds: toDelete.map((row) => row.id),
        count: rows.length,
      };
    });

  const payments = await prisma.transactionPayment.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      transactionId: true,
      paymentDate: true,
      amount: true,
      method: true,
      notes: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const paymentsByKey = new Map<string, typeof payments>();
  for (const payment of payments) {
    const key = [
      payment.transactionId,
      toKeyPart(payment.paymentDate),
      toAmountKey(payment.amount),
      toKeyPart(payment.method),
      toKeyPart(payment.notes),
    ].join('|');
    const existing = paymentsByKey.get(key) ?? [];
    existing.push(payment);
    paymentsByKey.set(key, existing);
  }

  const duplicatePaymentIds: number[] = [];
  const paymentSummary = Array.from(paymentsByKey.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => {
      const sorted = [...rows].sort((a, b) => {
        const diff = a.createdAt.getTime() - b.createdAt.getTime();
        if (diff !== 0) {
          return diff;
        }
        return a.id - b.id;
      });
      const keep = sorted[0];
      const toDelete = sorted.slice(1);
      duplicatePaymentIds.push(...toDelete.map((row) => row.id));
      return {
        key,
        keepId: keep.id,
        duplicateIds: toDelete.map((row) => row.id),
        count: rows.length,
      };
    });

  logger.error('Duplicate cleanup summary', {
    dryRun: !apply,
    duplicateMovementCount: duplicateMovementIds.length,
    duplicatePaymentCount: duplicatePaymentIds.length,
    movementGroups: movementSummary,
    paymentGroups: paymentSummary,
  });

  if (!apply) {
    logger.error('DRY RUN ONLY. To apply:', {
      command:
        'npx tsx scripts/one-time-cleanup-duplicates.ts --apply --confirm=cleanup-duplicates',
    });
    return;
  }

  if (confirmValue !== CONFIRM_VALUE) {
    throw new Error(
      `Safety check failed: pass --confirm=${CONFIRM_VALUE} to apply changes.`
    );
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    for (const ids of chunk(duplicateMovementIds, 500)) {
      if (ids.length === 0) {
        continue;
      }
      await tx.inventoryMovement.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: now },
      });
    }

    for (const ids of chunk(duplicatePaymentIds, 500)) {
      if (ids.length === 0) {
        continue;
      }
      await tx.transactionPayment.updateMany({
        where: { id: { in: ids }, deletedAt: null },
        data: { deletedAt: now },
      });
    }
  });

  logger.error('APPLIED duplicate cleanup (soft-delete only).', {
    duplicateMovementCount: duplicateMovementIds.length,
    duplicatePaymentCount: duplicatePaymentIds.length,
  });
}

main().catch((error) => {
  logger.error('one-time-cleanup-duplicates failed', { error });
  process.exitCode = 1;
});
