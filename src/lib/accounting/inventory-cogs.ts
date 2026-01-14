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

function pickUnitCostFromProductRow(row: {
  basePrice?: number | null;
  cogs?: number | null;
  quantity?: number | null;
}): number {
  const base = pickUnitCost(row.basePrice);
  if (base > 0) {
    return base;
  }

  const cogs = Number(row.cogs ?? 0);
  const qty = Number(row.quantity ?? 0);
  if (!Number.isFinite(cogs) || cogs <= 0) {
    return 0;
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return 0;
  }

  return pickUnitCost(cogs / qty);
}

function normalizeIdSegment(value: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) {
    return '0';
  }
  const rounded = Math.round(qty * 1000) / 1000;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

function summarizeSignedTransitions(transitions: Map<string, number>): string {
  const parts = Array.from(transitions.entries())
    .map(([label, qty]) => {
      const q = Number(qty);
      if (!Number.isFinite(q) || q === 0) {
        return null;
      }
      const sign = q > 0 ? '+' : '';
      return `${label} ${sign}${formatQty(q)}`;
    })
    .filter(Boolean) as string[];

  return parts.join('; ');
}

function extractAutoSaleTransactionId(
  notes: string | null | undefined
): number | null {
  const raw = (notes ?? '').trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(/\bauto-sale\s+txn\s+(\d+)\b/i);
  if (!match) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function summarizeCustomerNames(names: string[]): string {
  const cleaned = names.map((n) => n.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return '';
  }
  const unique = Array.from(new Set(cleaned));
  if (unique.length <= 10) {
    return unique.join(', ');
  }
  return `${unique.slice(0, 10).join(', ')} +${unique.length - 10} more`;
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
      basePrice: true,
      cogs: true,
      quantity: true,
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
    unitCostByProductCode.set(code, pickUnitCostFromProductRow(row));
  }

  return unitCostByProductCode;
}

async function computeInventorySeedAndShrinkageByDate(params: {
  from: Date;
  to: Date | null;
}): Promise<{
  seedByKey: Map<string, { value: number; qty: number; label: string }>;
  shrinkageByKey: Map<string, { value: number; qty: number; label: string }>;
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
      seedByKey: new Map(),
      shrinkageByKey: new Map(),
      seedTotal: 0,
      shrinkageTotal: 0,
    };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const seedByKey = new Map<
    string,
    { value: number; qty: number; label: string }
  >();
  const shrinkageByKey = new Map<
    string,
    { value: number; qty: number; label: string }
  >();
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
    const productCode = (m.productCode ?? '').trim() || 'Unknown Product';
    const label = `${m.fromBucket}→${m.toBucket}`;
    const key = `${dateKey}|||${productCode}|||${label}`;

    // Inventory seed: scrap -> asset bucket.
    if (m.fromBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.toBucket)) {
      const current = seedByKey.get(key) ?? { value: 0, qty: 0, label };
      seedByKey.set(key, {
        value: current.value + value,
        qty: current.qty + qty,
        label,
      });
      seedTotal += value;
      continue;
    }

    // Inventory shrinkage: asset bucket -> scrap.
    if (m.toBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.fromBucket)) {
      const current = shrinkageByKey.get(key) ?? { value: 0, qty: 0, label };
      shrinkageByKey.set(key, {
        value: current.value + value,
        qty: current.qty + qty,
        label,
      });
      shrinkageTotal += value;
      continue;
    }
  }

  return { seedByKey, shrinkageByKey, seedTotal, shrinkageTotal };
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
    return { entries: [], totalCogs: 0 };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const autoSaleTxnIds = Array.from(
    new Set(
      filtered
        .map((m) => extractAutoSaleTransactionId(m.notes))
        .filter((id): id is number => typeof id === 'number' && id > 0)
    )
  );

  const customerNameByTransactionId = new Map<number, string>();
  if (autoSaleTxnIds.length > 0) {
    const transactions = await prisma.transaction.findMany({
      where: { id: { in: autoSaleTxnIds } },
      select: { id: true, customers: true },
    });

    for (const tx of transactions) {
      const name = (tx.customers ?? '').trim();
      if (name) {
        customerNameByTransactionId.set(tx.id, name);
      }
    }
  }

  const cogsByGroup = new Map<
    string,
    {
      dateKey: string;
      productCode: string;
      netQty: number;
      netCost: number;
      transitions: Map<string, number>;
      customers: Set<string>;
    }
  >();
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

    const dateKey = toDateKey(m.when);
    const productCode = code || 'Unknown Product';
    const groupKey = `${dateKey}|||${productCode}`;

    const transitionLabel = `${m.fromBucket}→${m.toBucket}`;

    const group = cogsByGroup.get(groupKey) ?? {
      dateKey,
      productCode,
      netQty: 0,
      netCost: 0,
      transitions: new Map<string, number>(),
      customers: new Set<string>(),
    };

    group.netQty += sign * qty;
    group.netCost += cost;
    group.transitions.set(
      transitionLabel,
      (group.transitions.get(transitionLabel) ?? 0) + sign * qty
    );

    const txnId = extractAutoSaleTransactionId(m.notes);
    if (txnId) {
      const customerName = customerNameByTransactionId.get(txnId);
      if (customerName) {
        group.customers.add(customerName);
      }
    }

    cogsByGroup.set(groupKey, group);
    totalCogs += cost;
  }

  const entries: DerivedJournalEntry[] = Array.from(cogsByGroup.values())
    .sort((a, b) => {
      const byDate = a.dateKey.localeCompare(b.dateKey);
      if (byDate !== 0) {
        return byDate;
      }
      return a.productCode.localeCompare(b.productCode);
    })
    .flatMap((group) => {
      const amt = Number(group.netCost);
      if (!Number.isFinite(amt) || amt === 0) {
        return [];
      }

      const date = dateKeyToIso(group.dateKey);
      const qtyAbs = Math.abs(Number(group.netQty));
      const qtyLabel = qtyAbs > 0 ? ` x${formatQty(qtyAbs)}` : '';
      const ref = `COGS-${group.dateKey} ${group.productCode}${qtyLabel}`;

      const customerSummary = summarizeCustomerNames(
        Array.from(group.customers)
      );
      const transitionSummary = summarizeSignedTransitions(group.transitions);
      const details = [
        transitionSummary ? `Movements: ${transitionSummary}` : null,
        customerSummary ? `Customers: ${customerSummary}` : null,
      ]
        .filter(Boolean)
        .join(' • ');

      const abs = Math.abs(amt);
      const idBase = `COGS-${group.dateKey}-${normalizeIdSegment(group.productCode)}`;

      const baseDescription = `Cost of goods sold (inventory movements) • ${group.productCode}${qtyLabel}`;
      const description = details
        ? `${baseDescription} • ${details}`
        : baseDescription;

      // Positive: Dr COGS / Cr Inventory
      if (amt > 0) {
        return [
          {
            id: `${idBase}-cogs-debit`,
            date,
            ref,
            account: COGS_ACCOUNT,
            debit: abs,
            credit: 0,
            description,
          },
          {
            id: `${idBase}-inventory-credit`,
            date,
            ref,
            account: INVENTORY_ACCOUNT,
            debit: 0,
            credit: abs,
            description,
          },
        ];
      }

      // Negative: Dr Inventory / Cr COGS (return/restock reversal)
      return [
        {
          id: `${idBase}-inventory-debit`,
          date,
          ref,
          account: INVENTORY_ACCOUNT,
          debit: abs,
          credit: 0,
          description,
        },
        {
          id: `${idBase}-cogs-credit`,
          date,
          ref,
          account: COGS_ACCOUNT,
          debit: 0,
          credit: abs,
          description,
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
  const { seedByKey, shrinkageByKey, seedTotal, shrinkageTotal } =
    await computeInventorySeedAndShrinkageByDate(params);

  const parseKey = (key: string) => {
    const [dateKey = '', productCode = '', label = ''] = key.split('|||');
    return { dateKey, productCode, label };
  };

  const seedEntries: DerivedJournalEntry[] = Array.from(seedByKey.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, data]) => {
      const { dateKey, productCode, label } = parseKey(key);
      const seedAmt = Number(data.value ?? 0);
      const seedQty = Number(data.qty ?? 0);
      if (!Number.isFinite(seedAmt) || seedAmt <= 0) {
        return [];
      }

      const date = dateKeyToIso(dateKey);
      const qtyLabel = seedQty > 0 ? ` x${formatQty(seedQty)}` : '';
      const ref = `INV-SEED-${dateKey} ${productCode}${qtyLabel}`;
      const idBase = `INV-SEED-${dateKey}-${normalizeIdSegment(productCode)}-${normalizeIdSegment(label)}`;

      const description = `Inventory seeded (inventory movements) • ${productCode}${qtyLabel} • ${label}`;

      return [
        {
          id: `${idBase}-inventory-debit`,
          date,
          ref,
          account: INVENTORY_ACCOUNT,
          debit: seedAmt,
          credit: 0,
          description,
        },
        {
          id: `${idBase}-opening-equity-credit`,
          date,
          ref,
          account: OPENING_EQUITY_ACCOUNT,
          debit: 0,
          credit: seedAmt,
          description: `${description} • Offset`,
        },
      ];
    });

  const shrinkEntries: DerivedJournalEntry[] = Array.from(
    shrinkageByKey.entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, data]) => {
      const { dateKey, productCode, label } = parseKey(key);
      const shrinkAmt = Number(data.value ?? 0);
      const shrinkQty = Number(data.qty ?? 0);
      if (!Number.isFinite(shrinkAmt) || shrinkAmt <= 0) {
        return [];
      }

      const date = dateKeyToIso(dateKey);
      const qtyLabel = shrinkQty > 0 ? ` x${formatQty(shrinkQty)}` : '';
      const ref = `INV-SHRINK-${dateKey} ${productCode}${qtyLabel}`;
      const idBase = `INV-SHRINK-${dateKey}-${normalizeIdSegment(productCode)}-${normalizeIdSegment(label)}`;
      const description = `Inventory shrinkage (inventory movements) • ${productCode}${qtyLabel} • ${label}`;

      return [
        {
          id: `${idBase}-retained-earnings-debit`,
          date,
          ref,
          account: 'Retained Earnings',
          debit: shrinkAmt,
          credit: 0,
          description,
        },
        {
          id: `${idBase}-inventory-credit`,
          date,
          ref,
          account: INVENTORY_ACCOUNT,
          debit: 0,
          credit: shrinkAmt,
          description,
        },
      ];
    });

  const entries: DerivedJournalEntry[] = [...seedEntries, ...shrinkEntries];

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
