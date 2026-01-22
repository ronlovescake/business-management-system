import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

async function reclassReceiptBackfillOpeningInventory(options: {
  apply: boolean;
}) {
  const { apply } = options;

  const where = {
    deletedAt: null,
    notes: 'receipt-backfill',
    fromBucket: 'scrap' as const,
    toBucket: 'sellable' as const,
  };

  const count = await prisma.inventoryMovement.count({ where });

  if (!apply) {
    logger.info('Receipt backfill reclass dry run', { count });
    return { count, updated: 0 };
  }

  const result = await prisma.inventoryMovement.updateMany({
    where,
    data: { fromBucket: 'opening_inventory' },
  });

  logger.info('Receipt backfill reclass applied', {
    matched: count,
    updated: result.count,
  });

  return { count, updated: result.count };
}

async function main() {
  const apply = hasFlag('--apply');
  const result = await reclassReceiptBackfillOpeningInventory({ apply });
  await prisma.$disconnect();
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to reclass receipt backfill movements', { error });
    void prisma.$disconnect();
    process.exit(1);
  });
}

export { reclassReceiptBackfillOpeningInventory };
