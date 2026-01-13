import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isFulfilledStatus } from '@/lib/inventory/statuses';

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function buildAutoSaleMovementNote(transactionId: number) {
  return `auto-sale txn ${transactionId}`;
}

async function backfillSaleMovements() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prisma as any;

  const fulfilledCandidates = await client.transaction.findMany({
    where: {
      deletedAt: null,
      productCode: { not: null },
      quantity: { gt: 0 },
      orderStatus: { not: null },
    },
    select: {
      id: true,
      productCode: true,
      quantity: true,
      orderDate: true,
      orderStatus: true,
    },
    orderBy: { id: 'asc' },
  });

  let created = 0;
  let skipped = 0;
  let ignored = 0;

  for (const transaction of fulfilledCandidates) {
    if (!isFulfilledStatus(transaction.orderStatus)) {
      ignored += 1;
      continue;
    }

    const productCode = normalizeProductCode(transaction.productCode);
    const quantity = transaction.quantity ?? 0;

    if (!productCode || quantity <= 0) {
      ignored += 1;
      continue;
    }

    const note = buildAutoSaleMovementNote(transaction.id);

    const existingMovement = await client.inventoryMovement.findFirst({
      where: {
        deletedAt: null,
        productCode: {
          equals: productCode,
          mode: 'insensitive',
        },
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: note,
      },
      select: { id: true },
    });

    if (existingMovement) {
      skipped += 1;
      continue;
    }

    await client.inventoryMovement.create({
      data: {
        productCode,
        quantity,
        fromBucket: 'sellable',
        toBucket: 'sold',
        notes: note,
        postingDate: transaction.orderDate ?? null,
      },
    });

    created += 1;
  }

  return {
    totalCandidates: fulfilledCandidates.length,
    created,
    skipped,
    ignored,
  };
}

async function main() {
  const result = await backfillSaleMovements();
  logger.info('Backfill sale movements completed', result);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to backfill sale movements', { error });
    void prisma.$disconnect();
    process.exit(1);
  });
}

export { backfillSaleMovements };
