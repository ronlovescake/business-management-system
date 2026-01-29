import { prisma } from '@/lib/db';
import { parseDate } from '@/lib/accounting/date-utils';
import { isInTransitShipmentStatus } from '@/lib/inventory/shipment-status';

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
const INVENTORY_IN_TRANSIT_ACCOUNT = 'Inventory in Transit';
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

  const products = await prisma.generalMerchandiseProduct.findMany({
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

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
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

  const filteredCodes = Array.from(
    new Set(filtered.map((m) => (m.productCode ?? '').trim()).filter(Boolean))
  );

  const productRows =
    filteredCodes.length > 0
      ? await prisma.generalMerchandiseProduct.findMany({
          where: {
            deletedAt: null,
            productCode: { in: filteredCodes },
          },
          select: {
            productCode: true,
            shipmentCode: true,
            shipmentStatus: true,
          },
        })
      : [];

  const shipmentCodes = Array.from(
    new Set(
      productRows.map((row) => (row.shipmentCode ?? '').trim()).filter(Boolean)
    )
  );

  const shipmentRows =
    shipmentCodes.length > 0
      ? await prisma.generalMerchandiseShipment.findMany({
          where: { shipmentCode: { in: shipmentCodes } },
          select: { shipmentCode: true, shipmentStatus: true },
        })
      : [];

  const shipmentStatusByCode = new Map<string, string>();
  for (const row of shipmentRows) {
    const code = (row.shipmentCode ?? '').trim();
    if (code && !shipmentStatusByCode.has(code)) {
      shipmentStatusByCode.set(code, row.shipmentStatus ?? '');
    }
  }

  const productStatusByCode = new Map<string, string>();
  for (const row of productRows) {
    const code = (row.productCode ?? '').trim();
    if (!code || productStatusByCode.has(code)) {
      continue;
    }

    const directStatus = row.shipmentStatus ?? '';
    if (directStatus.trim()) {
      productStatusByCode.set(code, directStatus);
      continue;
    }

    const shipmentCode = (row.shipmentCode ?? '').trim();
    const fallbackStatus = shipmentCode
      ? (shipmentStatusByCode.get(shipmentCode) ?? '')
      : '';
    productStatusByCode.set(code, fallbackStatus);
  }

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
    const productCode = code || 'Unknown Product';
    const label = `${m.fromBucket}→${m.toBucket}`;
    const baseKey = `${dateKey}|||${productCode}|||${label}`;

    // Inventory seed: scrap -> asset bucket.
    if (m.fromBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.toBucket)) {
      const status = productStatusByCode.get(code) ?? '';
      const seedAccount = isInTransitShipmentStatus(status)
        ? INVENTORY_IN_TRANSIT_ACCOUNT
        : INVENTORY_ACCOUNT;
      const seedKey = `${baseKey}|||${seedAccount}`;
      const current = seedByKey.get(seedKey) ?? { value: 0, qty: 0, label };
      seedByKey.set(seedKey, {
        value: current.value + value,
        qty: current.qty + qty,
        label,
      });
      seedTotal += value;
      continue;
    }

    // Inventory shrinkage: asset bucket -> scrap.
    if (m.toBucket === 'scrap' && INVENTORY_ASSET_BUCKETS.has(m.fromBucket)) {
      const current = shrinkageByKey.get(baseKey) ?? {
        value: 0,
        qty: 0,
        label,
      };
      shrinkageByKey.set(baseKey, {
        value: current.value + value,
        qty: current.qty + qty,
        label,
      });
      shrinkageTotal += value;
      continue;
    }
  }

  return {
    seedByKey,
    shrinkageByKey,
    seedTotal,
    shrinkageTotal,
  };
}

async function computeInventoryMovementEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { from, to } = params;

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
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
    return [];
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const entries: DerivedJournalEntry[] = [];

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

    const from = m.fromBucket;
    const toBucket = m.toBucket;

    if (
      !INVENTORY_ASSET_BUCKETS.has(from) &&
      !INVENTORY_ASSET_BUCKETS.has(toBucket)
    ) {
      continue;
    }

    const idBase = `INV-${m.id}`;
    const dateStr = m.when.toISOString();
    const ref = code;
    const transition = `${from} → ${toBucket}`;
    const description = [code, transition].filter(Boolean).join(' • ');

    if (INVENTORY_ASSET_BUCKETS.has(toBucket)) {
      entries.push({
        id: `${idBase}-debit`,
        date: dateStr,
        ref,
        account: INVENTORY_ACCOUNT,
        debit: Math.max(value, 0),
        credit: 0,
        description,
      });
    }

    if (INVENTORY_ASSET_BUCKETS.has(from)) {
      entries.push({
        id: `${idBase}-credit`,
        date: dateStr,
        ref,
        account: INVENTORY_ACCOUNT,
        debit: 0,
        credit: Math.max(value, 0),
        description,
      });
    }
  }

  return entries;
}

export async function buildCogsAndInventoryEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<{ entries: DerivedJournalEntry[] }> {
  const { from, to } = params;

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        // Sales: increase SOLD bucket (drives COGS + inventory reduction)
        { toBucket: 'sold' },
        // Returns/restocks: move from SOLD back into a stock bucket
        { fromBucket: 'sold' },
      ],
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

  const autoSaleTxnIds = Array.from(
    new Set(
      movements
        .map((m) => extractAutoSaleTransactionId(m.notes))
        .filter((id): id is number => typeof id === 'number' && id > 0)
    )
  );

  const customerNameByTransactionId = new Map<number, string>();
  const completionAtByTransactionId = new Map<number, Date | null>();
  if (autoSaleTxnIds.length > 0) {
    const transactions = await prisma.generalMerchandiseTransaction.findMany({
      where: { id: { in: autoSaleTxnIds } },
      select: { id: true, customers: true, packedDate: true },
    });

    for (const tx of transactions) {
      const name = (tx.customers ?? '').trim();
      if (name) {
        customerNameByTransactionId.set(tx.id, name);
      }

      completionAtByTransactionId.set(tx.id, parseDate(tx.packedDate ?? null));
    }
  }

  const filtered = movements
    .map((m) => {
      const txnId = extractAutoSaleTransactionId(m.notes);
      const when = txnId
        ? (completionAtByTransactionId.get(txnId) ?? m.createdAt)
        : pickMovementDate({
            postingDate: m.postingDate ?? null,
            createdAt: m.createdAt,
          });
      return { ...m, when };
    })
    .filter((m) => isWithin(m.when, from, to));

  if (filtered.length === 0) {
    return { entries: [] };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const cogsByGroup = new Map<
    string,
    {
      dateKey: string;
      productCode: string;
      debitAccount: string;
      netQty: number;
      netCost: number;
      transitions: Map<string, number>;
      customers: Set<string>;
    }
  >();

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

    const txnId = extractAutoSaleTransactionId(m.notes);
    const debitAccount = COGS_ACCOUNT;

    const groupKey = `${dateKey}|||${productCode}`;

    const transitionLabel = `${m.fromBucket}→${m.toBucket}`;

    const group = cogsByGroup.get(groupKey) ?? {
      dateKey,
      productCode,
      debitAccount,
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

    if (txnId) {
      const customerName = customerNameByTransactionId.get(txnId);
      if (customerName) {
        group.customers.add(customerName);
      }
    }

    cogsByGroup.set(groupKey, group);
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
            account: group.debitAccount,
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
          account: group.debitAccount,
          debit: 0,
          credit: abs,
          description,
        },
      ];
    });

  return { entries };
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
    const [dateKey = '', productCode = '', label = '', account = ''] =
      key.split('|||');
    return { dateKey, productCode, label, account };
  };

  const seedEntries: DerivedJournalEntry[] = Array.from(seedByKey.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([key, data]) => {
      const { dateKey, productCode, label, account } = parseKey(key);
      const seedAmt = Number(data.value ?? 0);
      const seedQty = Number(data.qty ?? 0);
      if (!Number.isFinite(seedAmt) || seedAmt <= 0) {
        return [];
      }

      const date = dateKeyToIso(dateKey);
      const qtyLabel = seedQty > 0 ? ` x${formatQty(seedQty)}` : '';
      const ref = `INV-SEED-${dateKey} ${productCode}${qtyLabel}`;
      const idBase = `INV-SEED-${dateKey}-${normalizeIdSegment(productCode)}-${normalizeIdSegment(label)}`;

      const seedAccount = account || INVENTORY_ACCOUNT;
      const description =
        seedAccount === INVENTORY_IN_TRANSIT_ACCOUNT
          ? `Inventory in Transit seeded (inventory movements) • ${productCode}${qtyLabel} • ${label}`
          : `Inventory seeded (inventory movements) • ${productCode}${qtyLabel} • ${label}`;

      return [
        {
          id: `${idBase}-inventory-debit`,
          date,
          ref,
          account: seedAccount,
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

export async function computeInventorySeedAndShrinkageTotals(params: {
  from: Date;
  to: Date | null;
}): Promise<{ seedTotal: number; shrinkageTotal: number }> {
  const { seedTotal, shrinkageTotal } =
    await computeInventorySeedAndShrinkageByDate(params);
  return { seedTotal, shrinkageTotal };
}

export async function computeCogsTotal(params: {
  from: Date;
  to: Date | null;
}): Promise<number> {
  const { entries } = await buildCogsAndInventoryEntries(params);
  const total = entries.reduce((sum, entry) => {
    if (entry.account !== COGS_ACCOUNT) {
      return sum;
    }
    return sum + (entry.debit - entry.credit);
  }, 0);
  return total;
}

export async function buildInventoryEntriesForLedger(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  return await computeInventoryMovementEntries(params);
}

export async function buildCogsEntriesForBalanceSheet(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { entries } = await buildCogsAndInventoryEntries(params);
  return entries.filter((entry) => entry.account === COGS_ACCOUNT);
}

export async function buildInventorySeedEntriesForBalanceSheet(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { entries } = await buildInventorySeedAndShrinkageEntries(params);
  return entries.filter((entry) => entry.account === OPENING_EQUITY_ACCOUNT);
}

export async function buildInventoryShrinkageEntriesForBalanceSheet(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { entries } = await buildInventorySeedAndShrinkageEntries(params);
  return entries.filter(
    (entry) => entry.account === CURRENT_PERIOD_EARNINGS_ACCOUNT
  );
}

export async function buildInventoryEntriesForProfitLoss(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  return await computeInventoryMovementEntries(params);
}

export async function computeInventoryInTransitTotals(params: {
  from: Date;
  to: Date | null;
}): Promise<{ inTransitTotal: number; labels: string[] }> {
  const { from, to } = params;

  const transactions = await prisma.generalMerchandiseTransaction.findMany({
    where: {
      deletedAt: null,
      shipmentCode: { not: null },
    },
    select: {
      id: true,
      shipmentCode: true,
      productCode: true,
      customers: true,
      quantity: true,
      unitPrice: true,
      notes: true,
      createdAt: true,
      orderStatus: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const shipments = await prisma.generalMerchandiseShipment.findMany({
    select: {
      shipmentCode: true,
      shipmentStatus: true,
    },
  });

  const shipmentStatusByCode = new Map<string, string>();
  for (const shipment of shipments) {
    const code = (shipment.shipmentCode ?? '').trim();
    if (code && !shipmentStatusByCode.has(code)) {
      shipmentStatusByCode.set(code, shipment.shipmentStatus ?? '');
    }
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    transactions.map((tx) => tx.productCode ?? '')
  );

  let inTransitTotal = 0;
  const labels: string[] = [];

  for (const tx of transactions) {
    const shipmentCode = (tx.shipmentCode ?? '').trim();
    if (!shipmentCode) {
      continue;
    }

    const status = shipmentStatusByCode.get(shipmentCode) ?? '';
    if (!isInTransitShipmentStatus(status)) {
      continue;
    }

    const createdAt = tx.createdAt ?? new Date();
    if (!isWithin(createdAt, from, to)) {
      continue;
    }

    const qty = Number(tx.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const unitCost =
      unitCostByProductCode.get((tx.productCode ?? '').trim()) ?? 0;
    const value = qty * unitCost;
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }

    inTransitTotal += value;
    labels.push(`${tx.productCode ?? ''} (${formatQty(qty)})`);
  }

  return { inTransitTotal, labels };
}

export async function computeInventoryStockOnHandTotals(params: {
  from: Date;
  to: Date | null;
}): Promise<{ stockOnHandTotal: number; labels: string[] }> {
  const { from, to } = params;

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
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

  const qtyByProduct = new Map<string, number>();
  for (const movement of filtered) {
    const qty = Number(movement.quantity ?? 0);
    if (!Number.isFinite(qty) || qty === 0) {
      continue;
    }

    const code = (movement.productCode ?? '').trim();
    if (!code) {
      continue;
    }

    if (INVENTORY_ASSET_BUCKETS.has(movement.toBucket)) {
      qtyByProduct.set(code, (qtyByProduct.get(code) ?? 0) + qty);
    }

    if (INVENTORY_ASSET_BUCKETS.has(movement.fromBucket)) {
      qtyByProduct.set(code, (qtyByProduct.get(code) ?? 0) - qty);
    }
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    Array.from(qtyByProduct.keys())
  );

  let stockOnHandTotal = 0;
  const labels: string[] = [];

  qtyByProduct.forEach((qty, code) => {
    if (!Number.isFinite(qty) || qty <= 0) {
      return;
    }
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const value = qty * unitCost;
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    stockOnHandTotal += value;
    labels.push(`${code} (${formatQty(qty)})`);
  });

  return { stockOnHandTotal, labels };
}

export async function computeInventoryMovementBreakdown(params: {
  from: Date;
  to: Date | null;
}): Promise<{
  transitions: Map<string, number>;
  totalQty: number;
  totalValue: number;
}> {
  const { from, to } = params;

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
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

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const transitions = new Map<string, number>();
  let totalQty = 0;
  let totalValue = 0;

  for (const movement of filtered) {
    const qty = Number(movement.quantity ?? 0);
    if (!Number.isFinite(qty) || qty === 0) {
      continue;
    }

    const code = (movement.productCode ?? '').trim();
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const value = qty * unitCost;
    if (!Number.isFinite(value) || value === 0) {
      continue;
    }

    const label = `${movement.fromBucket} → ${movement.toBucket}`;
    transitions.set(label, (transitions.get(label) ?? 0) + qty);
    totalQty += qty;
    totalValue += value;
  }

  return { transitions, totalQty, totalValue };
}

export async function buildInventoryMovementSummary(params: {
  from: Date;
  to: Date | null;
}): Promise<{ summary: string; totalQty: number; totalValue: number }> {
  const { transitions, totalQty, totalValue } =
    await computeInventoryMovementBreakdown(params);

  return {
    summary: summarizeSignedTransitions(transitions),
    totalQty,
    totalValue,
  };
}

export async function computeInventoryAutoSaleTotals(params: {
  from: Date;
  to: Date | null;
}): Promise<{ autoSaleTotal: number; labels: string[] }> {
  const { from, to } = params;

  const movements = await prisma.generalMerchandiseInventoryMovement.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        gte: from,
      },
      notes: { contains: 'auto-sale', mode: 'insensitive' },
    },
    select: {
      id: true,
      createdAt: true,
      postingDate: true,
      productCode: true,
      quantity: true,
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
    return { autoSaleTotal: 0, labels: [] };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const labels: string[] = [];
  let autoSaleTotal = 0;

  for (const movement of filtered) {
    const qty = Number(movement.quantity ?? 0);
    if (!Number.isFinite(qty) || qty === 0) {
      continue;
    }

    const code = (movement.productCode ?? '').trim();
    const unitCost = unitCostByProductCode.get(code) ?? 0;
    const value = qty * unitCost;
    if (!Number.isFinite(value) || value === 0) {
      continue;
    }

    autoSaleTotal += value;

    const txId = extractAutoSaleTransactionId(movement.notes);
    const label = txId ? `${code} (TX-${txId})` : code;
    labels.push(label);
  }

  return { autoSaleTotal, labels };
}

export async function buildInventoryAutoSaleEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { autoSaleTotal } = await computeInventoryAutoSaleTotals(params);
  if (!Number.isFinite(autoSaleTotal) || autoSaleTotal === 0) {
    return [];
  }

  const now = new Date();
  return [
    {
      id: `AUTOSALE-${normalizeIdSegment(now.toISOString())}`,
      date: now.toISOString(),
      ref: 'AUTO-SALE',
      account: INVENTORY_ACCOUNT,
      debit: 0,
      credit: Math.max(autoSaleTotal, 0),
      description: 'Auto-sale inventory reduction',
    },
    {
      id: `AUTOSALE-COGS-${normalizeIdSegment(now.toISOString())}`,
      date: now.toISOString(),
      ref: 'AUTO-SALE',
      account: COGS_ACCOUNT,
      debit: Math.max(autoSaleTotal, 0),
      credit: 0,
      description: 'Auto-sale inventory COGS',
    },
  ];
}

export async function buildInventoryCustomerSummary(params: {
  from: Date;
  to: Date | null;
}): Promise<string> {
  const { from, to } = params;

  const transactions = await prisma.generalMerchandiseTransaction.findMany({
    where: {
      deletedAt: null,
      createdAt: {
        gte: from,
      },
    },
    select: {
      id: true,
      customers: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });

  const filtered = transactions.filter((tx) =>
    isWithin(tx.createdAt ?? new Date(), from, to)
  );

  const customerNames = filtered
    .map((tx) => (tx.customers ?? '').trim())
    .filter(Boolean);

  return summarizeCustomerNames(customerNames);
}

export async function computeInventoryInTransitEntries(params: {
  from: Date;
  to: Date | null;
}): Promise<DerivedJournalEntry[]> {
  const { inTransitTotal } = await computeInventoryInTransitTotals(params);
  if (!Number.isFinite(inTransitTotal) || inTransitTotal === 0) {
    return [];
  }

  const now = new Date();
  return [
    {
      id: `INTRANSIT-${normalizeIdSegment(now.toISOString())}`,
      date: now.toISOString(),
      ref: 'IN-TRANSIT',
      account: INVENTORY_IN_TRANSIT_ACCOUNT,
      debit: Math.max(inTransitTotal, 0),
      credit: 0,
      description: 'Inventory in transit',
    },
    {
      id: `INTRANSIT-COGS-${normalizeIdSegment(now.toISOString())}`,
      date: now.toISOString(),
      ref: 'IN-TRANSIT',
      account: INVENTORY_ACCOUNT,
      debit: 0,
      credit: Math.max(inTransitTotal, 0),
      description: 'Inventory in transit adjustment',
    },
  ];
}
