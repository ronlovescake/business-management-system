import { parseDate } from '@/lib/accounting/date-utils';
import { toISODate } from '@/utils/date';

export type DerivedJournalEntry = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

export type CogsMovementInput = {
  id?: number;
  createdAt: Date;
  postingDate: string | null;
  productCode: string;
  quantity: number;
  unitCost?: number | null;
  costBasis?: string | null;
  fromBucket: string;
  toBucket: string;
  notes?: string | null;
  sourceTransactionId?: number | null;
  sourceMovementId?: number | null;
  movementSource?: string | null;
  movementType?: string | null;
  when: Date;
  valuationConfirmed?: boolean;
  costBasisProjected?: boolean;
};

export type InventoryValuationIssue = {
  movementId: number | null;
  productCode: string;
  date: string;
  quantity: number;
  direction: 'SALE' | 'RETURN';
  reason: 'MISSING_COST' | 'INVALID_COST' | 'LEGACY_PRODUCT_COST';
};

export function summarizeInventoryValuation(
  issues: InventoryValuationIssue[] = []
) {
  return {
    complete: issues.length === 0,
    affectedQuantity: issues.reduce((sum, issue) => sum + issue.quantity, 0),
    issues,
  };
}

export type InventoryValuationSummary = ReturnType<
  typeof summarizeInventoryValuation
>;

export type DatedInventoryCostCorrection = {
  productCode: string;
  date: string;
  newUnitCost: number;
  resolvedMovementIds: number[];
  movementCosts: Array<{ movementId: number; unitCost: number }>;
};

export function isFreeGoodsCost(
  movement: Pick<CogsMovementInput, 'costBasis' | 'unitCost'>
): boolean {
  return movement.costBasis === 'FREE_GOODS' && movement.unitCost === 0;
}

export function isKnownZeroAcquisitionCost(
  movement: Pick<CogsMovementInput, 'costBasis' | 'unitCost'>
): boolean {
  return (
    movement.unitCost === 0 &&
    (isFreeGoodsCost(movement) ||
      movement.costBasis === 'SPLIT_ALLOCATION' ||
      movement.costBasis === 'ASSEMBLY')
  );
}

export function projectDatedMovementCosts(
  movements: CogsMovementInput[],
  corrections: DatedInventoryCostCorrection[],
  asOf: Date
) {
  const ordered = [...corrections].sort((left, right) =>
    left.date.localeCompare(right.date)
  );
  const projected = movements.map((movement) => {
    const evidence = ordered.filter(
      (correction) =>
        correction.productCode === movement.productCode &&
        movement.id !== undefined &&
        correction.movementCosts.some((cost) => cost.movementId === movement.id)
    );
    const firstCost = evidence
      .flatMap((correction) => correction.movementCosts)
      .find((cost) => cost.movementId === movement.id)?.unitCost;
    const valuationConfirmed =
      isKnownZeroAcquisitionCost(movement) ||
      (typeof movement.unitCost === 'number' && movement.unitCost > 0) ||
      evidence.some(
        (correction) =>
          correction.date <= toISODate(asOf) &&
          correction.resolvedMovementIds.includes(movement.id!)
      );
    return {
      ...movement,
      unitCost: isKnownZeroAcquisitionCost(movement)
        ? 0
        : movement.unitCost === null ||
            movement.unitCost === undefined ||
            movement.unitCost === 0
          ? (firstCost ?? movement.unitCost)
          : movement.unitCost,
      valuationConfirmed,
      costBasisProjected: firstCost !== undefined,
    };
  });
  return projected.map((movement) => {
    if (
      movement.fromBucket !== 'sold' ||
      !INVENTORY_ASSET_BUCKETS.has(movement.toBucket) ||
      !movement.sourceTransactionId ||
      isKnownZeroAcquisitionCost(movement)
    ) {
      return movement;
    }
    const sales = projected.filter(
      (sale) =>
        sale.toBucket === 'sold' &&
        sale.productCode === movement.productCode &&
        sale.sourceTransactionId === movement.sourceTransactionId &&
        (!movement.sourceMovementId || sale.id === movement.sourceMovementId) &&
        sale.when <= movement.when
    );
    const costs = new Set(
      sales
        .map((sale) => sale.unitCost)
        .filter(
          (cost): cost is number =>
            typeof cost === 'number' && Number.isFinite(cost) && cost >= 0
        )
    );
    if (costs.size !== 1) {
      return movement;
    }
    const latest = ordered
      .filter(
        (correction) =>
          correction.productCode === movement.productCode &&
          correction.date <= toISODate(movement.when) &&
          correction.date <= toISODate(asOf) &&
          sales.some(
            (sale) =>
              sale.id !== undefined &&
              correction.resolvedMovementIds.includes(sale.id)
          )
      )
      .pop();
    return {
      ...movement,
      unitCost: latest?.newUnitCost ?? Array.from(costs)[0],
      valuationConfirmed:
        Boolean(latest) || sales.every((sale) => sale.valuationConfirmed),
    };
  });
}

export const INVENTORY_ASSET_BUCKETS = new Set([
  'sellable',
  'reserved',
  'damaged_hold',
  'assembly_wip',
]);

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateKeyToIso(dateKey: string): string {
  return `${dateKey}T00:00:00.000Z`;
}

export function isWithin(date: Date, from: Date, to: Date | null): boolean {
  if (date < from) {
    return false;
  }
  if (to && date > to) {
    return false;
  }
  return true;
}

export function pickMovementDate(params: {
  postingDate: string | null;
  createdAt: Date;
}): Date {
  return parseDate(params.postingDate) ?? params.createdAt;
}

export function pickUnitCost(actualPrice: number | null | undefined): number {
  const cost = Number(actualPrice ?? 0);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

export function pickUnitCostFromProductRow(row: {
  landedUnitCost?: number | null;
  cogs?: number | null;
  quantity?: number | null;
}): number {
  const base = pickUnitCost(row.landedUnitCost);
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

export function normalizeIdSegment(value: string): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) {
    return '0';
  }
  const rounded = Math.round(qty * 1000) / 1000;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }
  return String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

export function summarizeSignedTransitions(
  transitions: Map<string, number>
): string {
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

export function extractAutoSaleTransactionId(
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

export function resolveAutoSaleTransactionId(movement: {
  sourceTransactionId?: number | null;
  movementSource?: string | null;
  movementType?: string | null;
  notes?: string | null;
}): number | null {
  const explicitId = Number(movement.sourceTransactionId ?? 0);
  const explicitSource = (movement.movementSource ?? '').trim().toLowerCase();
  const explicitType = (movement.movementType ?? '').trim().toLowerCase();

  if (
    Number.isFinite(explicitId) &&
    explicitId > 0 &&
    explicitSource === 'transaction' &&
    explicitType === 'sale'
  ) {
    return explicitId;
  }

  return extractAutoSaleTransactionId(movement.notes);
}

export function summarizeCustomerNames(names: string[]): string {
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

export function buildCogsEntriesFromMovements(params: {
  movements: CogsMovementInput[];
  unitCostByProductCode: Map<string, number>;
  customerNameByTransactionId: Map<number, string>;
  cogsAccount: string;
  inventoryAccount: string;
  cogsDescriptionStyle: 'verbose' | 'short';
  confirmedZeroCostMovementIds?: ReadonlySet<number>;
}): {
  entries: DerivedJournalEntry[];
  totalCogs: number;
  valuationIssues: InventoryValuationIssue[];
} {
  const {
    movements,
    unitCostByProductCode,
    customerNameByTransactionId,
    cogsAccount,
    inventoryAccount,
    cogsDescriptionStyle,
  } = params;

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
  let totalCogs = 0;
  const valuationIssues: InventoryValuationIssue[] = [];

  for (const movement of movements) {
    const qty = Number(movement.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      continue;
    }

    const sign =
      movement.toBucket === 'sold'
        ? 1
        : movement.fromBucket === 'sold' &&
            INVENTORY_ASSET_BUCKETS.has(movement.toBucket)
          ? -1
          : 0;
    if (sign === 0) {
      continue;
    }

    const code = (movement.productCode ?? '').trim();
    if (
      isKnownZeroAcquisitionCost(movement) ||
      (movement.id &&
        params.confirmedZeroCostMovementIds?.has(movement.id) &&
        (movement.unitCost === null ||
          movement.unitCost === undefined ||
          Number(movement.unitCost) === 0))
    ) {
      continue;
    }
    const recordedUnitCost = Number(movement.unitCost ?? 0);
    const hasCost = Number.isFinite(recordedUnitCost) && recordedUnitCost > 0;
    const hasSnapshot = hasCost && movement.valuationConfirmed !== false;
    const fallbackCost = unitCostByProductCode.get(code) ?? 0;
    const unitCost =
      movement.costBasisProjected || hasCost ? recordedUnitCost : fallbackCost;
    if (!hasSnapshot && !movement.valuationConfirmed) {
      valuationIssues.push({
        movementId: movement.id ?? null,
        productCode: code || 'Unknown Product',
        date: toDateKey(movement.when),
        quantity: qty,
        direction: sign > 0 ? 'SALE' : 'RETURN',
        reason:
          !Number.isFinite(recordedUnitCost) ||
          recordedUnitCost < 0 ||
          !Number.isFinite(fallbackCost) ||
          fallbackCost < 0
            ? 'INVALID_COST'
            : fallbackCost > 0
              ? 'LEGACY_PRODUCT_COST'
              : 'MISSING_COST',
      });
    }
    if (!Number.isFinite(unitCost) || unitCost <= 0) {
      continue;
    }
    const cost = sign * qty * unitCost;

    if (!Number.isFinite(cost) || cost === 0) {
      continue;
    }

    const dateKey = toDateKey(movement.when);
    const productCode = code || 'Unknown Product';
    const groupKey = `${dateKey}|||${productCode}`;
    const transitionLabel = `${movement.fromBucket}→${movement.toBucket}`;

    const group = cogsByGroup.get(groupKey) ?? {
      dateKey,
      productCode,
      debitAccount: cogsAccount,
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

    const txnId = resolveAutoSaleTransactionId(movement);
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

      const baseDescription =
        cogsDescriptionStyle === 'short'
          ? `${group.productCode}${qtyLabel}`
          : `Cost of goods sold (inventory movements) • ${group.productCode}${qtyLabel}`;
      const description = details
        ? `${baseDescription} • ${details}`
        : baseDescription;

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
            account: inventoryAccount,
            debit: 0,
            credit: abs,
            description,
          },
        ];
      }

      return [
        {
          id: `${idBase}-inventory-debit`,
          date,
          ref,
          account: inventoryAccount,
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

  return { entries, totalCogs, valuationIssues };
}
