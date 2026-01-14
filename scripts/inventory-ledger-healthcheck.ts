import { prisma } from '@/lib/db';
import {
  normalizeProductCode,
  type MovementLike,
} from '@/lib/inventory/movements';
import { logger } from '@/lib/logger';

type Bucket =
  | 'sellable'
  | 'damaged_hold'
  | 'reserved'
  | 'assembly_wip'
  | 'scrap'
  | 'sold';

type Args = {
  limit?: number;
  tolerance?: number;
  failOnNegativeSellable?: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--failOnNegativeSellable') {
      args.failOnNegativeSellable = true;
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

    if (token === '--tolerance') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.tolerance = parsed;
      }
      index += 1;
      continue;
    }
  }

  return args;
}

type Balances = Record<Bucket, number>;

function emptyBalances(): Balances {
  return {
    sellable: 0,
    damaged_hold: 0,
    reserved: 0,
    assembly_wip: 0,
    scrap: 0,
    sold: 0,
  };
}

function applyMovement(balances: Balances, movement: MovementLike): void {
  const from = movement.fromBucket as Bucket;
  const to = movement.toBucket as Bucket;
  const qty = Number(movement.quantity);

  if (!Number.isFinite(qty) || qty <= 0) {
    return;
  }

  balances[from] -= qty;
  balances[to] += qty;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tolerance = args.tolerance ?? 1e-9;
  const limit = args.limit ?? 100;

  const movements = await prisma.inventoryMovement.findMany({
    where: { deletedAt: null },
    select: {
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
    },
  });

  const bySku = new Map<string, Balances>();
  const invalidProductCodes: number[] = [];

  for (const movement of movements) {
    const normalized = normalizeProductCode(movement.productCode);
    if (!normalized) {
      invalidProductCodes.push(1);
      continue;
    }

    const balances = bySku.get(normalized) ?? emptyBalances();
    applyMovement(balances, movement);
    bySku.set(normalized, balances);
  }

  const negativeSellable: Array<{ productCode: string; sellable: number }> = [];
  const negativeDamaged: Array<{ productCode: string; damaged_hold: number }> =
    [];
  const negativeReserved: Array<{ productCode: string; reserved: number }> = [];
  const negativeAssembly: Array<{
    productCode: string;
    assembly_wip: number;
  }> = [];
  const negativeSold: Array<{ productCode: string; sold: number }> = [];

  for (const [productCode, balances] of Array.from(bySku.entries())) {
    if (balances.sellable < -tolerance) {
      negativeSellable.push({ productCode, sellable: balances.sellable });
    }
    if (balances.damaged_hold < -tolerance) {
      negativeDamaged.push({
        productCode,
        damaged_hold: balances.damaged_hold,
      });
    }
    if (balances.reserved < -tolerance) {
      negativeReserved.push({ productCode, reserved: balances.reserved });
    }
    if (balances.assembly_wip < -tolerance) {
      negativeAssembly.push({
        productCode,
        assembly_wip: balances.assembly_wip,
      });
    }
    if (balances.sold < -tolerance) {
      negativeSold.push({ productCode, sold: balances.sold });
    }
  }

  negativeSellable.sort((a, b) => a.sellable - b.sellable);
  negativeDamaged.sort((a, b) => a.damaged_hold - b.damaged_hold);
  negativeReserved.sort((a, b) => a.reserved - b.reserved);
  negativeAssembly.sort((a, b) => a.assembly_wip - b.assembly_wip);
  negativeSold.sort((a, b) => a.sold - b.sold);

  logger.info('Inventory ledger healthcheck summary', {
    movementsScanned: movements.length,
    distinctSkus: bySku.size,
    invalidProductCodeCount: invalidProductCodes.length,
    negativeSellableCount: negativeSellable.length,
    negativeDamagedHoldCount: negativeDamaged.length,
    negativeReservedCount: negativeReserved.length,
    negativeAssemblyWipCount: negativeAssembly.length,
    negativeSoldCount: negativeSold.length,
    tolerance,
  });

  const printList = (
    label: string,
    rows: Array<{ productCode: string; value: number }>
  ) => {
    if (rows.length === 0) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log(`\n${label} (showing up to ${limit}):`);
    for (const row of rows.slice(0, limit)) {
      // eslint-disable-next-line no-console
      console.log(`- ${row.productCode}: ${row.value}`);
    }
  };

  printList(
    'Negative SELLABLE on-hand (critical)',
    negativeSellable.map((r) => ({
      productCode: r.productCode,
      value: r.sellable,
    }))
  );
  printList(
    'Negative DAMAGED_HOLD balance (unexpected)',
    negativeDamaged.map((r) => ({
      productCode: r.productCode,
      value: r.damaged_hold,
    }))
  );
  printList(
    'Negative RESERVED balance (unexpected)',
    negativeReserved.map((r) => ({
      productCode: r.productCode,
      value: r.reserved,
    }))
  );
  printList(
    'Negative ASSEMBLY_WIP balance (unexpected)',
    negativeAssembly.map((r) => ({
      productCode: r.productCode,
      value: r.assembly_wip,
    }))
  );
  printList(
    'Negative SOLD balance (unexpected)',
    negativeSold.map((r) => ({ productCode: r.productCode, value: r.sold }))
  );

  if (args.failOnNegativeSellable && negativeSellable.length > 0) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    logger.error('Inventory ledger healthcheck failed', { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
