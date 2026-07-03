import { parseDate } from '@/lib/accounting/date-utils';

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
