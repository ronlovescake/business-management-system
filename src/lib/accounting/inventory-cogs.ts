import { prisma } from '@/lib/db';
import { parseDate } from '@/lib/accounting/date-utils';

export type DerivedJournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

const COGS_ACCOUNT = 'COGS';
const INVENTORY_ACCOUNT = 'Stock on Hand';
const OPENING_EQUITY_ACCOUNT = 'Opening Equity';
const CURRENT_PERIOD_EARNINGS_ACCOUNT = 'Current Period Earnings';

const INVENTORY_ASSET_BUCKETS = new Set([
  'sellable',
  'reserved',
  'damaged_hold',
  'assembly_wip',
]);

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateKeyToIso(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

function isWithin(date: Date, from: Date, to: Date | null): boolean {
  if (date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

function pickMovementDate(params: {
  postingDate: string | null;
  createdAt: Date;
}): Date {
  return parseDate(params.postingDate) ?? params.createdAt;
}

function pickUnitCost(actualPrice: number | null | undefined): number {
  const cost = Number(actualPrice ?? 0);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

async function getUnitCostByProductCode(productCodes: string[]) {
  const codes = Array.from(
    new Set(productCodes.map((c) => c.trim()).filter(Boolean))
  );
  if (codes.length === 0) {
    return new Map<string, number>();
  }

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      productCode: { in: codes },
    },
    select: {
      productCode: true,
      actualPrice: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
  });

  const unitCostByProductCode = new Map<string, number>();
  for (const row of products) {
    const code = (row.productCode ?? '').trim();
    if (!code || unitCostByProductCode.has(code)) {
      continue;
    }
    unitCostByProductCode.set(code, pickUnitCost(row.actualPrice));
  }

  return unitCostByProductCode;
}

async function computeInventorySeedAndShrinkageByDate(params: {
  from: Date;
  to: Date | null;
}): Promise<{
  seedByDate: Map<string, number>;
  shrinkageByDate: Map<string, number>;
  seedTotal: number;
  shrinkageTotal: number;
}> {
  const { from, to } = params;

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: [{ fromBucket: 'scrap' }, { toBucket: 'scrap' }],
      createdAt: {
        gte: from,
      },
    },
    select: {
      id: true,
      createdAt: true,
      postingDate: true,
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
      notes: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const filtered = movements
    .map((m) => {
      const when = pickMovementDate({
        postingDate: m.postingDate ?? null,
        createdAt: m.createdAt,
      });
      return { ...m, when };
    })
    .filter((m) => isWithin(m.when, from, to));

  if (filtered.length === 0) {
    return {
      seedByDate: new Map(),
      shrinkageByDate: new Map(),
      seedTotal: 0,
      shrinkageTotal: 0,
    };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const seedByDate = new Map<string, number>();
  const shrinkageByDate = new Map<string, number>();
  let seedTotal = 0;
  let shrinkageTotal = 0;

  for (const m of filtered) {
    const qty = Number(m.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const code = (m.productCode ?? '').trim();
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const value = qty * unitCost;
    if (!Number.isFinite(value) || value === 0) {
      continue;
    }

    const dateKey = toDateKey(m.when);

    // Inventory seed: scrap -> asset bucket.
    if (m.fromBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.toBucket)) {
      seedByDate.set(dateKey, (seedByDate.get(dateKey) ?? 0) + value);
      seedTotal += value;
      continue;
    }

    // Inventory shrinkage: asset bucket -> scrap.
    if (m.toBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.fromBucket)) {
      shrinkageByDate.set(dateKey, (shrinkageByDate.get(dateKey) ?? 0) + value);
      shrinkageTotal += value;
      continue;
    }
  }

  return { seedByDate, shrinkageByDate, seedTotal, shrinkageTotal };
}

export async function buildCogsAndInventoryEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<{ entries: DerivedJournalEntry[]; totalCogs: number }> {
  const { from, to } = params;

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        // Sales: increase SOLD bucket (drives COGS + inventory reduction)
        { toBucket: 'sold' },
        // Returns/restocks: move from SOLD back into a stock bucket
        { fromBucket: 'sold' },
      ],
      createdAt: {
        gte: from,
      },
    },
    select: {
      id: true,
      createdAt: true,
      postingDate: true,
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const filtered = movements
    .map((m) => {
      const when = pickMovementDate({
        postingDate: m.postingDate ?? null,
        createdAt: m.createdAt,
      });
      return { ...m, when };
    })
    .filter((m) => isWithin(m.when, from, to));

  if (filtered.length === 0) {
    return { entries: [], totalCogs: 0 };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const cogsByDate = new Map<string, number>();
  let totalCogs = 0;

  for (const m of filtered) {
    const qty = Number(m.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    // Net COGS effect sign:
    // - Sales (.. -> sold): +qty
    // - Returns (sold -> ..): -qty
    const sign = m.toBucket === 'sold' ? 1 : m.fromBucket === 'sold' ? -1 : 0;
    if (sign === 0) {
      continue;
    }

    const code = (m.productCode ?? '').trim();
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const cost = sign * qty * unitCost;

    if (!Number.isFinite(cost) || cost === 0) {
      continue;
    }

    const key = toDateKey(m.when);
    cogsByDate.set(key, (cogsByDate.get(key) ?? 0) + cost);
    totalCogs += cost;
  }

  const entries: DerivedJournalEntry[] = Array.from(cogsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([dateKey, amount]) => {
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt === 0) {
        return [];
      }

      const date = dateKeyToIso(dateKey);
      const ref = `COGS-${dateKey}`;

      const abs = Math.abs(amt);

      // Positive: Dr COGS / Cr Inventory
      if (amt > 0) {
        return [
          {
            id: `${ref}-cogs-debit`,
            date,
            ref,
            account: COGS_ACCOUNT,
            debit: abs,
            credit: 0,
            description: 'Cost of goods sold (inventory movements)',
          },
          {
            id: `${ref}-inventory-credit`,
            date,
            ref,
            account: INVENTORY_ACCOUNT,
            debit: 0,
            credit: abs,
            description: 'Inventory reduction from sales (inventory movements)',
          },
        ];
      }

      // Negative: Dr Inventory / Cr COGS (return/restock reversal)
      return [
        {
          id: `${ref}-inventory-debit`,
          date,
          ref,
          account: INVENTORY_ACCOUNT,
          debit: abs,
          credit: 0,
          description: 'Inventory increase from returns (inventory movements)',
        },
        {
          id: `${ref}-cogs-credit`,
          date,
          ref,
          account: COGS_ACCOUNT,
          debit: 0,
          credit: abs,
          description: 'COGS reversal from returns (inventory movements)',
        },
      ];
    });

  return { entries, totalCogs };
}

export async function computeInventorySeedAndShrinkageTotals(params: {
  from: Date;
  to: Date | null;
}): Promise<{ seedTotal: number; shrinkageTotal: number }> {
  const { seedTotal, shrinkageTotal } =
    await computeInventorySeedAndShrinkageByDate(params);
  return { seedTotal, shrinkageTotal };
}

export async function buildInventorySeedAndShrinkageEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<{
  entries: DerivedJournalEntry[];
  seedTotal: number;
  shrinkageTotal: number;
}> {
  const { seedByDate, shrinkageByDate, seedTotal, shrinkageTotal } =
    await computeInventorySeedAndShrinkageByDate(params);

  const dateKeys = new Set<string>([
    ...Array.from(seedByDate.keys()),
    ...Array.from(shrinkageByDate.keys()),
  ]);

  const entries: DerivedJournalEntry[] = Array.from(dateKeys)
    .sort((a, b) => a.localeCompare(b))
    .flatMap((dateKey) => {
      const seedAmt = Number(seedByDate.get(dateKey) ?? 0);
      const shrinkAmt = Number(shrinkageByDate.get(dateKey) ?? 0);
      const date = dateKeyToIso(dateKey);
      const rows: DerivedJournalEntry[] = [];

      if (Number.isFinite(seedAmt) && seedAmt > 0) {
        const ref = `INV-SEED-${dateKey}`;
        rows.push(
          {
            id: `${ref}-inventory-debit`,
            date,
            ref,
            account: INVENTORY_ACCOUNT,
            debit: seedAmt,
            credit: 0,
            description: 'Inventory seeded from scrap (inventory movements)',
          },
          {
            id: `${ref}-opening-equity-credit`,
            date,
            ref,
            account: OPENING_EQUITY_ACCOUNT,
            debit: 0,
            credit: seedAmt,
            description: 'Opening equity offset for inventory seed',
          }
        );
      }

      if (Number.isFinite(shrinkAmt) && shrinkAmt > 0) {
        const ref = `INV-SHRINK-${dateKey}`;
        rows.push(
          {
            id: `${ref}-retained-earnings-debit`,
            date,
            ref,
            account: 'Retained Earnings',
            debit: shrinkAmt,
            credit: 0,
            description: 'Inventory shrinkage to scrap (inventory movements)',
          },
          {
            id: `${ref}-inventory-credit`,
            date,
            ref,
            account: INVENTORY_ACCOUNT,
            debit: 0,
            credit: shrinkAmt,
            description:
              'Inventory reduction from shrinkage (inventory movements)',
          }
        );
      }

      return rows;
    });

  return { entries, seedTotal, shrinkageTotal };
}

export const ACCOUNTING_INVENTORY_ACCOUNTS = {
  COGS_ACCOUNT,
  INVENTORY_ACCOUNT,
  OPENING_EQUITY_ACCOUNT,
  CURRENT_PERIOD_EARNINGS_ACCOUNT,
} as const;

export async function computeCogsTotal(params: {
  from: Date;
  to: Date | null;
}): Promise<number> {
  const { totalCogs } = await buildCogsAndInventoryEntries(params);
  return totalCogs;
}
