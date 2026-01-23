import { prisma } from '@/lib/db';

type Args = {
  apply?: boolean;
  rollback?: boolean;
  limit?: number;
};

type Candidate = {
  id: number;
  productCode: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    if (token === '--rollback') {
      args.rollback = true;
      continue;
    }

    const next = argv[i + 1];
    if (!next) {
      continue;
    }

    if (token === '--limit') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      i += 1;
      continue;
    }
  }

  return args;
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function findDuplicateAutoReceipts(limit?: number): Promise<Candidate[]> {
  const receiptBackfills = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      toBucket: 'sellable',
      notes: 'receipt-backfill',
    },
    select: {
      productCode: true,
    },
  });

  const receiptBackfillCodes = new Set(
    receiptBackfills
      .map((row) => normalizeProductCode(row.productCode))
      .filter(Boolean)
  );

  const autoReceipts = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      fromBucket: 'scrap',
      toBucket: 'sellable',
      notes: {
        startsWith: 'auto-receipt product',
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      productCode: true,
      quantity: true,
      notes: true,
      createdAt: true,
    },
    orderBy: { id: 'asc' },
  });

  const candidates = autoReceipts
    .map((row) => ({
      id: row.id,
      productCode: normalizeProductCode(row.productCode),
      quantity: row.quantity ?? 0,
      notes: row.notes ?? null,
      createdAt: row.createdAt,
    }))
    .filter(
      (row) => row.productCode && receiptBackfillCodes.has(row.productCode)
    )
    .filter((row) => Number.isFinite(row.quantity) && row.quantity > 0);

  return typeof limit === 'number' ? candidates.slice(0, limit) : candidates;
}

async function softDeleteMovementsById(ids: number[]): Promise<number> {
  if (ids.length === 0) {
    return 0;
  }

  let updated = 0;
  for (const batch of chunk(ids, 500)) {
    const res = await prisma.inventoryMovement.updateMany({
      where: {
        id: { in: batch },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    updated += res.count;
  }

  return updated;
}

async function rollbackSoftDeletedAutoReceipts(
  limit?: number
): Promise<number> {
  const rows = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: { not: null },
      fromBucket: 'scrap',
      toBucket: 'sellable',
      notes: {
        startsWith: 'auto-receipt product',
        mode: 'insensitive',
      },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const ids = rows.map((r) => r.id);
  const limited = typeof limit === 'number' ? ids.slice(0, limit) : ids;

  let updated = 0;
  for (const batch of chunk(limited, 500)) {
    const res = await prisma.inventoryMovement.updateMany({
      where: { id: { in: batch } },
      data: { deletedAt: null },
    });
    updated += res.count;
  }

  return updated;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.apply && args.rollback) {
    throw new Error('Use only one of --apply or --rollback');
  }

  if (args.rollback) {
    const updated = await rollbackSoftDeletedAutoReceipts(args.limit);
    console.log('Rollback complete (restored deleted auto-receipts)', {
      restoredCount: updated,
    });
    return;
  }

  const candidates = await findDuplicateAutoReceipts(args.limit);

  const totalQty = candidates.reduce((sum, row) => sum + row.quantity, 0);

  console.log('Duplicate auto-receipt candidates (scrap->sellable) found', {
    candidateCount: candidates.length,
    totalQuantity: totalQty,
    mode: args.apply ? 'apply' : 'dry-run',
  });

  // Print a small sample for quick review
  candidates.slice(0, 25).forEach((row) => {
    console.log('Candidate', {
      id: row.id,
      productCode: row.productCode,
      quantity: row.quantity,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
    });
  });

  if (!args.apply) {
    console.log(
      'Dry run only. Re-run with --apply to soft-delete these rows.',
      {
        example: 'npx tsx scripts/cleanup-duplicate-auto-receipts.ts --apply',
      }
    );
    return;
  }

  const ids = candidates.map((c) => c.id);
  const updated = await softDeleteMovementsById(ids);

  console.log('Soft-delete complete', {
    requested: ids.length,
    updated,
    note: 'These were auto-receipt product movements into sellable for productCodes that already had receipt-backfill baseline.',
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('cleanup-duplicate-auto-receipts failed', error);
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
