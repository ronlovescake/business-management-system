import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

type Args = {
  apply: boolean;
  productCodeContains?: string;
};

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply');

  const productCodeContainsFlag = '--productCodeContains';
  const productCodeContainsIndex = argv.indexOf(productCodeContainsFlag);
  const productCodeContains =
    productCodeContainsIndex >= 0
      ? (argv[productCodeContainsIndex + 1] ?? '').trim()
      : undefined;

  return {
    apply,
    productCodeContains: productCodeContains ? productCodeContains : undefined,
  };
}

function buildWhere(args: Args): Prisma.InventoryMovementWhereInput {
  return {
    deletedAt: null,
    fromBucket: 'sellable',
    toBucket: 'sold',
    notes: {
      startsWith: 'auto-sale txn ',
    },
    ...(args.productCodeContains
      ? {
          productCode: {
            contains: args.productCodeContains,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  };
}

async function rollbackSaleBackfillMovements(args: Args) {
  const client = prisma;

  const where = buildWhere(args);

  const total = await client.inventoryMovement.count({ where });

  const topByProductCode = await client.inventoryMovement.groupBy({
    by: ['productCode'],
    where,
    _count: { id: true },
    _sum: { quantity: true },
    orderBy: [{ _count: { id: 'desc' } }],
    take: 25,
  });

  logger.info('Auto-sale backfill movements found', {
    total,
    productCodeFilter: args.productCodeContains ?? null,
    topByProductCode: topByProductCode.map((row) => ({
      productCode: row.productCode,
      count: row._count.id,
      quantity: row._sum.quantity ?? 0,
    })),
  });

  if (!args.apply) {
    logger.warn('Dry-run only. Re-run with --apply to soft-delete these rows.');
    return { dryRun: true, total };
  }

  const updated = await client.inventoryMovement.updateMany({
    where,
    data: {
      deletedAt: new Date(),
    },
  });

  logger.warn('Soft-deleted auto-sale backfill movements', {
    updated: updated.count,
  });

  return { dryRun: false, total, updated: updated.count };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (process.argv.includes('--help')) {
    // Keep it minimal to avoid long logs in CI.
    logger.info(
      'Usage: tsx scripts/rollback-sale-backfill-movements.ts [--apply] [--productCodeContains <text>]'
    );
    await prisma.$disconnect();
    return;
  }

  const result = await rollbackSaleBackfillMovements(args);
  logger.info('Rollback sale backfill movements complete', result);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to rollback sale backfill movements', { error });
    void prisma.$disconnect();
    process.exit(1);
  });
}

export { rollbackSaleBackfillMovements };
