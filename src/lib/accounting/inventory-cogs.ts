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

export async function buildCogsAndInventoryEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<{ entries: DerivedJournalEntry[]; totalCogs: number }> {
  const { from, to } = params;

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      toBucket: 'sold',
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

  const productCodes = Array.from(
    new Set(filtered.map((m) => (m.productCode ?? '').trim()).filter(Boolean))
  );

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
      productCode: { in: productCodes },
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

  const cogsByDate = new Map<string, number>();
  let totalCogs = 0;

  for (const m of filtered) {
    const qty = Number(m.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const code = (m.productCode ?? '').trim();
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const cost = qty * unitCost;

    if (!Number.isFinite(cost) || cost <= 0) {
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
      if (!Number.isFinite(amt) || amt <= 0) {
        return [];
      }

      const date = dateKeyToIso(dateKey);
      const ref = `COGS-${dateKey}`;

      return [
        {
          id: `${ref}-cogs-debit`,
          date,
          ref,
          account: COGS_ACCOUNT,
          debit: amt,
          credit: 0,
          description: 'Cost of goods sold (inventory movements)',
        },
        {
          id: `${ref}-inventory-credit`,
          date,
          ref,
          account: INVENTORY_ACCOUNT,
          debit: 0,
          credit: amt,
          description: 'Inventory reduction from sales (inventory movements)',
        },
      ];
    });

  return { entries, totalCogs };
}

export async function computeCogsTotal(params: {
  from: Date;
  to: Date | null;
}): Promise<number> {
  const { totalCogs } = await buildCogsAndInventoryEntries(params);
  return totalCogs;
}
