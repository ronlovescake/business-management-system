import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RESERVED_STATUSES, isReservedStatus } from '@/lib/inventory/statuses';

type Args = {
  dryRun?: boolean;
  limit?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--dry-run') {
      args.dryRun = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === '--limit') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      index += 1;
      continue;
    }
  }

  return args;
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function buildAutoReserveMovementNote(transactionId: number): string {
  return `auto-reserve txn ${transactionId}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = Boolean(args.dryRun);

  const transactions = await prisma.transaction.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      productCode: true,
      quantity: true,
      orderStatus: true,
      orderDate: true,
    },
  });

  const reserved = transactions.filter((tx) =>
    isReservedStatus(tx.orderStatus)
  );

  logger.info('Backfill reservation movements: scanned transactions', {
    total: transactions.length,
    reserved: reserved.length,
    reservedStatuses: RESERVED_STATUSES,
    dryRun,
    limit: args.limit ?? null,
  });

  let created = 0;
  let skipped = 0;
  let invalid = 0;

  const limit = args.limit ?? reserved.length;

  for (const tx of reserved.slice(0, limit)) {
    const productCode = normalizeProductCode(tx.productCode);
    const quantity = Number(tx.quantity ?? 0);

    if (!productCode || !Number.isFinite(quantity) || quantity <= 0) {
      invalid += 1;
      continue;
    }

    const note = buildAutoReserveMovementNote(tx.id);

    const existing = await prisma.inventoryMovement.findFirst({
      where: {
        deletedAt: null,
        notes: note,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await prisma.inventoryMovement.create({
        data: {
          productCode,
          quantity,
          fromBucket: 'sellable' as never,
          toBucket: 'reserved' as never,
          postingDate: tx.orderDate ?? null,
          notes: note,
        },
      });
    }

    created += 1;
  }

  logger.info('Backfill reservation movements complete', {
    created,
    skipped,
    invalid,
    dryRun,
  });
}

main().catch((error) => {
  logger.error('Backfill reservation movements failed', { error });
  process.exitCode = 1;
});
