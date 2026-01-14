import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type Args = {
  apply?: boolean;
  createdFrom?: string;
  limit?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--apply') {
      args.apply = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === '--createdFrom' || token === '--from') {
      args.createdFrom = next;
      index += 1;
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

function buildAutoSaleMovementNote(transactionId: number): string {
  return `auto-sale txn ${transactionId}`;
}

function buildAutoReserveMovementNote(transactionId: number): string {
  return `auto-reserve txn ${transactionId}`;
}

type AutoMovementRecord = {
  id: number;
  deletedAt: Date | null;
};

async function findLatestAutoMovement(
  note: string
): Promise<AutoMovementRecord | null> {
  return prisma.inventoryMovement.findFirst({
    where: { notes: note },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deletedAt: true },
  });
}

async function setAutoMovementActive(params: {
  existing: AutoMovementRecord | null;
  productCode: string;
  quantity: number;
  fromBucket: 'sellable' | 'reserved';
  toBucket: 'reserved' | 'sold';
  postingDate: string | null;
  note: string;
}) {
  const {
    existing,
    productCode,
    quantity,
    fromBucket,
    toBucket,
    postingDate,
    note,
  } = params;

  if (existing) {
    await prisma.inventoryMovement.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        productCode,
        quantity,
        fromBucket,
        toBucket,
        postingDate,
        notes: note,
      },
    });
    return;
  }

  await prisma.inventoryMovement.create({
    data: {
      productCode,
      quantity,
      fromBucket,
      toBucket,
      postingDate,
      notes: note,
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);

  const createdFrom = args.createdFrom
    ? new Date(`${args.createdFrom}T00:00:00.000Z`)
    : null;

  const candidates = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      orderStatus: { equals: 'Prepared', mode: 'insensitive' },
      adjustment: { gt: 0 },
      ...(createdFrom ? { createdAt: { gte: createdFrom } } : {}),
    },
    select: {
      id: true,
      productCode: true,
      quantity: true,
      orderDate: true,
      orderStatus: true,
      adjustment: true,
    },
    orderBy: { id: 'asc' },
  });

  const limit = args.limit ?? candidates.length;

  logger.info('Resync paid+Prepared inventory movements: scanned candidates', {
    total: candidates.length,
    applying: apply,
    createdFrom: args.createdFrom ?? null,
    limit,
  });

  let wouldUpsertReserve = 0;
  let wouldUpsertSale = 0;
  let invalid = 0;

  for (const tx of candidates.slice(0, limit)) {
    const productCode = normalizeProductCode(tx.productCode);
    const quantity = Number(tx.quantity ?? 0);

    if (!productCode || !Number.isFinite(quantity) || quantity <= 0) {
      invalid += 1;
      continue;
    }

    const postingDate = tx.orderDate ?? null;

    const reserveNote = buildAutoReserveMovementNote(tx.id);
    const saleNote = buildAutoSaleMovementNote(tx.id);

    const [existingReserve, existingSale] = await Promise.all([
      findLatestAutoMovement(reserveNote),
      findLatestAutoMovement(saleNote),
    ]);

    wouldUpsertReserve += 1;
    wouldUpsertSale += 1;

    if (!apply) {
      continue;
    }

    await Promise.all([
      setAutoMovementActive({
        existing: existingReserve,
        productCode,
        quantity,
        fromBucket: 'sellable',
        toBucket: 'reserved',
        postingDate,
        note: reserveNote,
      }),
      setAutoMovementActive({
        existing: existingSale,
        productCode,
        quantity,
        fromBucket: 'reserved',
        toBucket: 'sold',
        postingDate,
        note: saleNote,
      }),
    ]);
  }

  logger.info('Resync paid+Prepared inventory movements complete', {
    applying: apply,
    processed: Math.min(limit, candidates.length),
    wouldUpsertReserve,
    wouldUpsertSale,
    invalid,
  });

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Resync paid+Prepared inventory movements failed', { error });
    process.exitCode = 1;
  });
}
