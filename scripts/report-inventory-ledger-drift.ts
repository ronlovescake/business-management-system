import fs from 'node:fs';
import path from 'node:path';

import { prisma } from '@/lib/db';
import {
  buildSellableDeltaMap,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { logger } from '@/lib/logger';

type Args = {
  minAbsDelta?: number;
  onlyWithMovements?: boolean;
  limit?: number;
  csv?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--onlyWithMovements') {
      args.onlyWithMovements = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (token === '--minAbsDelta') {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed >= 0) {
        args.minAbsDelta = parsed;
      }
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

    if (token === '--csv') {
      args.csv = next;
      index += 1;
      continue;
    }
  }

  return args;
}

type DriftRow = {
  productId: number;
  productCode: string;
  productQty: number;
  ledgerSellable: number;
  delta: number;
  absDelta: number;
  hasMovements: boolean;
};

function toCsv(rows: DriftRow[]): string {
  const header = [
    'productId',
    'productCode',
    'productQty',
    'ledgerSellable',
    'delta',
    'absDelta',
    'hasMovements',
  ];
  const lines = [header.join(',')];

  for (const row of rows) {
    const values = [
      String(row.productId),
      JSON.stringify(row.productCode),
      String(row.productQty),
      String(row.ledgerSellable),
      String(row.delta),
      String(row.absDelta),
      String(row.hasMovements),
    ];
    lines.push(values.join(','));
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const minAbsDelta = args.minAbsDelta ?? 0;
  const limit = args.limit ?? 200;

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, productCode: true, quantity: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { deletedAt: null },
      select: {
        productCode: true,
        quantity: true,
        fromBucket: true,
        toBucket: true,
      },
    }),
  ]);

  const sellableDeltas = buildSellableDeltaMap(movements);

  const drift: DriftRow[] = [];
  for (const product of products) {
    const code = (product.productCode ?? '').trim();
    const normalized = normalizeProductCode(code);
    if (!normalized) {
      continue;
    }

    const hasMovements = sellableDeltas.has(normalized);
    const ledgerSellable = sellableDeltas.get(normalized) ?? 0;
    const productQty = Number(product.quantity ?? 0);

    if (!Number.isFinite(productQty) || !Number.isFinite(ledgerSellable)) {
      continue;
    }

    const delta = productQty - ledgerSellable;
    const absDelta = Math.abs(delta);

    if (args.onlyWithMovements && !hasMovements) {
      continue;
    }

    if (absDelta < minAbsDelta) {
      continue;
    }

    drift.push({
      productId: product.id,
      productCode: code,
      productQty,
      ledgerSellable,
      delta,
      absDelta,
      hasMovements,
    });
  }

  drift.sort((a, b) => b.absDelta - a.absDelta);

  const top = drift.slice(0, limit);

  logger.info('Inventory ledger drift report', {
    productsScanned: products.length,
    movementsScanned: movements.length,
    distinctMovementSkus: sellableDeltas.size,
    rows: drift.length,
    minAbsDelta,
    onlyWithMovements: Boolean(args.onlyWithMovements),
    limit,
  });

  for (const row of top) {
    // Keep output human scannable in terminal.
    // eslint-disable-next-line no-console
    console.log(
      `${row.productCode} (id=${row.productId}) qty=${row.productQty} ledger=${row.ledgerSellable} delta=${row.delta}`
    );
  }

  if (args.csv) {
    const outPath = path.isAbsolute(args.csv)
      ? args.csv
      : path.join(process.cwd(), args.csv);
    fs.writeFileSync(outPath, toCsv(top), 'utf8');
    logger.info('Wrote CSV', { path: outPath, rows: top.length });
  }
}

main().catch((error) => {
  logger.error('Failed to generate inventory ledger drift report', { error });
  process.exitCode = 1;
});
