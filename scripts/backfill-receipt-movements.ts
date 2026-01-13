import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

async function backfillReceiptMovements() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = prisma as any;

  const products = await client.product.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      productCode: true,
      quantity: true,
      postingDate: true,
    },
  });

  let created = 0;
  let skipped = 0;

  for (const product of products) {
    const productCode = normalizeProductCode(product.productCode);
    const quantity = product.quantity ?? 0;

    if (!productCode || quantity <= 0) {
      skipped += 1;
      continue;
    }

    const existing = await client.inventoryMovement.findFirst({
      where: {
        deletedAt: null,
        productCode: { equals: productCode, mode: 'insensitive' },
        fromBucket: 'scrap',
        toBucket: 'sellable',
        notes: 'receipt-backfill',
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await client.inventoryMovement.create({
      data: {
        productCode,
        quantity,
        fromBucket: 'scrap',
        toBucket: 'sellable',
        postingDate: product.postingDate ?? null,
        notes: 'receipt-backfill',
      },
    });

    created += 1;
  }

  return { created, skipped };
}

async function main() {
  const result = await backfillReceiptMovements();
  logger.info('Backfill receipt movements completed', result);
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to backfill receipt movements', { error });
    void prisma.$disconnect();
    process.exit(1);
  });
}

export { backfillReceiptMovements };
