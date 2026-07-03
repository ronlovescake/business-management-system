import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { requireInternalToken } from '@/lib/internal-jobs/auth';
import {
  buildSellableDeltaMap,
  normalizeProductCode,
  type MovementLike,
} from '@/lib/inventory/movements';

type Bucket =
  | 'sellable'
  | 'damaged_hold'
  | 'reserved'
  | 'assembly_wip'
  | 'scrap'
  | 'supplier_short'
  | 'sold';

type Balances = Record<Bucket, number>;

type ControlsArgs = {
  minAbsDelta?: number;
  onlyWithMovements?: boolean;
  driftLimit?: number;
  tolerance?: number;
  negativeLimit?: number;
};

function emptyBalances(): Balances {
  return {
    sellable: 0,
    damaged_hold: 0,
    reserved: 0,
    assembly_wip: 0,
    scrap: 0,
    supplier_short: 0,
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

  // `supplier_short` is informational and not part of physical bucket balancing.
  if (from === 'supplier_short' || to === 'supplier_short') {
    return;
  }

  balances[from] -= qty;
  balances[to] += qty;
}

function parseNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return n;
}

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }
  return fallback;
}

const requireInventoryControlsToken = (req: NextRequest) =>
  requireInternalToken(req, {
    missingTokenBody: {
      error: 'misconfigured',
      message: 'INTERNAL_JOB_TOKEN is not configured on the server',
    },
    unauthorizedBody: { error: 'unauthorized' },
  });

export async function POST(req: NextRequest) {
  const authError = requireInventoryControlsToken(req);
  if (authError) {
    return authError;
  }

  const timestamp = new Date().toISOString();

  let body: ControlsArgs = {};
  try {
    body = (await req.json()) as ControlsArgs;
  } catch {
    body = {};
  }

  const url = new URL(req.url);

  const minAbsDelta = Math.max(
    0,
    parseNumber(
      body.minAbsDelta ?? url.searchParams.get('minAbsDelta'),
      0.000001
    )
  );
  const tolerance = Math.max(
    0,
    parseNumber(body.tolerance ?? url.searchParams.get('tolerance'), 1e-9)
  );
  const driftLimit = Math.max(
    1,
    Math.floor(
      parseNumber(body.driftLimit ?? url.searchParams.get('driftLimit'), 200)
    )
  );
  const negativeLimit = Math.max(
    1,
    Math.floor(
      parseNumber(
        body.negativeLimit ?? url.searchParams.get('negativeLimit'),
        50
      )
    )
  );
  const onlyWithMovements = parseBool(
    body.onlyWithMovements ?? url.searchParams.get('onlyWithMovements'),
    true
  );

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

  const driftRows: Array<{
    productId: number;
    productCode: string;
    productQty: number;
    ledgerSellable: number;
    delta: number;
    absDelta: number;
    hasMovements: boolean;
  }> = [];

  for (const product of products) {
    const raw = (product.productCode ?? '').trim();
    const normalized = normalizeProductCode(raw);
    if (!normalized) {
      continue;
    }

    const hasMovements = sellableDeltas.has(normalized);
    if (onlyWithMovements && !hasMovements) {
      continue;
    }

    const ledgerSellable = sellableDeltas.get(normalized) ?? 0;
    const productQty = Number(product.quantity ?? 0);

    if (!Number.isFinite(productQty) || !Number.isFinite(ledgerSellable)) {
      continue;
    }

    const delta = productQty - ledgerSellable;
    const absDelta = Math.abs(delta);

    if (absDelta < minAbsDelta) {
      continue;
    }

    driftRows.push({
      productId: product.id,
      productCode: raw,
      productQty,
      ledgerSellable,
      delta,
      absDelta,
      hasMovements,
    });
  }

  driftRows.sort((a, b) => b.absDelta - a.absDelta);

  const bySku = new Map<string, Balances>();
  let invalidProductCodeCount = 0;

  for (const movement of movements) {
    const normalized = normalizeProductCode(movement.productCode);
    if (!normalized) {
      invalidProductCodeCount += 1;
      continue;
    }

    const balances = bySku.get(normalized) ?? emptyBalances();
    applyMovement(balances, movement);
    bySku.set(normalized, balances);
  }

  const negative = {
    sellable: [] as Array<{ productCode: string; value: number }>,
    damaged_hold: [] as Array<{ productCode: string; value: number }>,
    reserved: [] as Array<{ productCode: string; value: number }>,
    assembly_wip: [] as Array<{ productCode: string; value: number }>,
    sold: [] as Array<{ productCode: string; value: number }>,
  };

  for (const [productCode, balances] of Array.from(bySku.entries())) {
    if (balances.sellable < -tolerance) {
      negative.sellable.push({ productCode, value: balances.sellable });
    }
    if (balances.damaged_hold < -tolerance) {
      negative.damaged_hold.push({
        productCode,
        value: balances.damaged_hold,
      });
    }
    if (balances.reserved < -tolerance) {
      negative.reserved.push({ productCode, value: balances.reserved });
    }
    if (balances.assembly_wip < -tolerance) {
      negative.assembly_wip.push({
        productCode,
        value: balances.assembly_wip,
      });
    }
    if (balances.sold < -tolerance) {
      negative.sold.push({ productCode, value: balances.sold });
    }
  }

  negative.sellable.sort((a, b) => a.value - b.value);
  negative.damaged_hold.sort((a, b) => a.value - b.value);
  negative.reserved.sort((a, b) => a.value - b.value);
  negative.assembly_wip.sort((a, b) => a.value - b.value);
  negative.sold.sort((a, b) => a.value - b.value);

  const ok = negative.sellable.length === 0 && driftRows.length === 0;

  return NextResponse.json(
    {
      ok,
      timestamp,
      config: {
        minAbsDelta,
        onlyWithMovements,
        driftLimit,
        tolerance,
        negativeLimit,
      },
      scanned: {
        products: products.length,
        movements: movements.length,
        distinctMovementSkus: sellableDeltas.size,
        invalidProductCodeCount,
      },
      drift: {
        rows: driftRows.length,
        top: driftRows.slice(0, driftLimit),
      },
      negative: {
        sellable: {
          count: negative.sellable.length,
          top: negative.sellable.slice(0, negativeLimit),
        },
        damaged_hold: {
          count: negative.damaged_hold.length,
          top: negative.damaged_hold.slice(0, negativeLimit),
        },
        reserved: {
          count: negative.reserved.length,
          top: negative.reserved.slice(0, negativeLimit),
        },
        assembly_wip: {
          count: negative.assembly_wip.length,
          top: negative.assembly_wip.slice(0, negativeLimit),
        },
        sold: {
          count: negative.sold.length,
          top: negative.sold.slice(0, negativeLimit),
        },
      },
    },
    { status: ok ? 200 : 503 }
  );
}

export async function GET(req: NextRequest) {
  const authError = requireInventoryControlsToken(req);
  if (authError) {
    return authError;
  }

  return NextResponse.json(
    {
      error: 'method_not_allowed',
      message: 'Use POST to run inventory controls',
    },
    { status: 405 }
  );
}
