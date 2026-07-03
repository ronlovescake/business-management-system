import { prisma } from '@/lib/db';
import { parseDate } from '@/lib/accounting/date-utils';
import { isInTransitShipmentStatus } from '@/lib/inventory/shipment-status';
import {
  buildCogsEntriesFromMovements,
  dateKeyToIso,
  formatQty,
  INVENTORY_ASSET_BUCKETS,
  isWithin,
  normalizeIdSegment,
  pickMovementDate,
  pickUnitCostFromProductRow,
  resolveAutoSaleTransactionId,
  toDateKey,
} from '@/lib/accounting/inventoryCogsShared';

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
      landedUnitCost: true,
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
      sourceTransactionId: true,
      movementSource: true,
      movementType: true,
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
      ? await prisma.product.findMany({
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
      ? await prisma.shipment.findMany({
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
    const productCode = (m.productCode ?? '').trim() || 'Unknown Product';
    const label = `${m.fromBucket}→${m.toBucket}`;
    const baseKey = `${dateKey}|||${productCode}|||${label}`;

    // ========================================================================
    // ⚠️ INVENTORY SEED (IN-TRANSIT VS ON-HAND)
    // ========================================================================
    // Uses shared shipment-status helper so blank/unknown statuses remain in
    // "Inventory in Transit" and match ops workflow.
    // ========================================================================
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

  return { seedByKey, shrinkageByKey, seedTotal, shrinkageTotal };
}

export async function buildCogsAndInventoryEntries(params: {
  from: Date;
  to: Date | null;
  cogsDescriptionStyle?: 'verbose' | 'short';
}): Promise<{ entries: DerivedJournalEntry[]; totalCogs: number }> {
  const { from, to } = params;
  const cogsDescriptionStyle = params.cogsDescriptionStyle ?? 'verbose';

  const movements = await prisma.inventoryMovement.findMany({
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
        .map(resolveAutoSaleTransactionId)
        .filter((id): id is number => typeof id === 'number' && id > 0)
    )
  );

  const customerNameByTransactionId = new Map<number, string>();
  const completionAtByTransactionId = new Map<number, Date | null>();
  if (autoSaleTxnIds.length > 0) {
    const transactions = await prisma.transaction.findMany({
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
      const txnId = resolveAutoSaleTransactionId(m);
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
    return { entries: [], totalCogs: 0 };
  }

  const unitCostByProductCode = await getUnitCostByProductCode(
    filtered.map((m) => m.productCode)
  );

  const { entries, totalCogs } = buildCogsEntriesFromMovements({
    movements: filtered,
    unitCostByProductCode,
    customerNameByTransactionId,
    cogsAccount: COGS_ACCOUNT,
    inventoryAccount: INVENTORY_ACCOUNT,
    cogsDescriptionStyle,
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
      const displayLabel = label.startsWith('scrap→')
        ? `opening→${label.slice('scrap→'.length)}`
        : label;

      const description = `${productCode}${qtyLabel} • ${displayLabel}`;

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

export const ACCOUNTING_INVENTORY_ACCOUNTS = {
  COGS_ACCOUNT,
  INVENTORY_ACCOUNT,
  INVENTORY_IN_TRANSIT_ACCOUNT,
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
