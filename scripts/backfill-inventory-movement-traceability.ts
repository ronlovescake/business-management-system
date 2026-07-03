import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type Domain = 'clothing' | 'general-merchandise';
type MovementType = 'reserve' | 'sale';

type Args = {
  apply: boolean;
  domains: Domain[];
  limit: number;
};

type MovementRow = {
  id: number;
  notes: string | null;
  sourceTransactionId: number | null;
  movementSource: string | null;
  movementType: string | null;
};

type PlannedUpdate = {
  id: number;
  sourceTransactionId: number;
  movementSource: 'transaction';
  movementType: MovementType;
  notes: string;
};

const AUTO_MOVEMENT_NOTE_PATTERN = /^auto-(reserve|sale) txn (\d+)(?:\b|\s)/i;
const VALID_DOMAINS: Domain[] = ['clothing', 'general-merchandise'];

function parseArgs(argv: string[]): Args {
  const apply = argv.includes('--apply');
  const limitFlagIndex = argv.indexOf('--limit');
  const rawLimit = limitFlagIndex >= 0 ? Number(argv[limitFlagIndex + 1]) : 25;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 25;

  const domainFlagIndex = argv.indexOf('--domain');
  const domainArg =
    domainFlagIndex >= 0 ? (argv[domainFlagIndex + 1] ?? '').trim() : 'all';

  const domains =
    domainArg === 'all' || domainArg === ''
      ? VALID_DOMAINS
      : VALID_DOMAINS.filter((domain) => domain === domainArg);

  if (domains.length === 0) {
    throw new Error(
      `Invalid --domain "${domainArg}". Use clothing, general-merchandise, or all.`
    );
  }

  return { apply, domains, limit };
}

function parseAutoMovementMetadata(row: MovementRow): PlannedUpdate | null {
  const notes = (row.notes ?? '').trim();
  const match = notes.match(AUTO_MOVEMENT_NOTE_PATTERN);
  if (!match) {
    return null;
  }

  const movementType = match[1]?.toLowerCase();
  const sourceTransactionId = Number(match[2]);
  if (
    (movementType !== 'reserve' && movementType !== 'sale') ||
    !Number.isFinite(sourceTransactionId) ||
    sourceTransactionId <= 0
  ) {
    return null;
  }

  if (
    row.sourceTransactionId === sourceTransactionId &&
    row.movementSource === 'transaction' &&
    row.movementType === movementType
  ) {
    return null;
  }

  return {
    id: row.id,
    sourceTransactionId,
    movementSource: 'transaction',
    movementType,
    notes,
  };
}

async function findClothingCandidates(limit: number): Promise<MovementRow[]> {
  return prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { notes: { startsWith: 'auto-reserve txn ' } },
        { notes: { startsWith: 'auto-sale txn ' } },
      ],
    },
    select: {
      id: true,
      notes: true,
      sourceTransactionId: true,
      movementSource: true,
      movementType: true,
    },
    orderBy: { id: 'asc' },
    take: limit,
  });
}

async function findGeneralMerchandiseCandidates(
  limit: number
): Promise<MovementRow[]> {
  return prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { notes: { startsWith: 'auto-reserve txn ' } },
        { notes: { startsWith: 'auto-sale txn ' } },
      ],
    },
    select: {
      id: true,
      notes: true,
      sourceTransactionId: true,
      movementSource: true,
      movementType: true,
    },
    orderBy: { id: 'asc' },
    take: limit,
  });
}

async function applyClothingUpdates(updates: PlannedUpdate[]) {
  for (const update of updates) {
    await prisma.inventoryMovement.update({
      where: { id: update.id },
      data: {
        sourceTransactionId: update.sourceTransactionId,
        movementSource: update.movementSource,
        movementType: update.movementType,
      },
    });
  }
}

async function applyGeneralMerchandiseUpdates(updates: PlannedUpdate[]) {
  for (const update of updates) {
    await prisma.generalMerchandiseInventoryMovement.update({
      where: { id: update.id },
      data: {
        sourceTransactionId: update.sourceTransactionId,
        movementSource: update.movementSource,
        movementType: update.movementType,
      },
    });
  }
}

async function backfillDomain(domain: Domain, args: Args) {
  const rows =
    domain === 'clothing'
      ? await findClothingCandidates(args.limit)
      : await findGeneralMerchandiseCandidates(args.limit);

  const updates = rows
    .map(parseAutoMovementMetadata)
    .filter((update): update is PlannedUpdate => Boolean(update));

  logger.info('Inventory movement traceability backfill plan', {
    domain,
    dryRun: !args.apply,
    scanned: rows.length,
    updates: updates.length,
    sample: updates.slice(0, 10),
  });

  if (!args.apply || updates.length === 0) {
    return { domain, dryRun: !args.apply, scanned: rows.length, updated: 0 };
  }

  if (domain === 'clothing') {
    await applyClothingUpdates(updates);
  } else {
    await applyGeneralMerchandiseUpdates(updates);
  }

  return {
    domain,
    dryRun: false,
    scanned: rows.length,
    updated: updates.length,
  };
}

async function backfillInventoryMovementTraceability(args: Args) {
  const results = [];
  for (const domain of args.domains) {
    results.push(await backfillDomain(domain, args));
  }
  return results;
}

async function main() {
  if (process.argv.includes('--help')) {
    logger.info(
      'Usage: tsx scripts/backfill-inventory-movement-traceability.ts [--apply] [--domain clothing|general-merchandise|all] [--limit 500]'
    );
    await prisma.$disconnect();
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const result = await backfillInventoryMovementTraceability(args);
  logger.info('Inventory movement traceability backfill complete', { result });
  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to backfill inventory movement traceability', {
      error,
    });
    void prisma.$disconnect();
    process.exit(1);
  });
}

export { backfillInventoryMovementTraceability, parseAutoMovementMetadata };
