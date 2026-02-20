import type { Transaction } from '@prisma/client';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import type { TransactionUpdateRecord } from './sanitizers';

export type ExistingTransactionForPaidStatusCheck = Pick<
  Transaction,
  'lineTotal' | 'quantity' | 'unitPrice' | 'discount' | 'adjustment'
>;

export function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isPaidStatus(value: string | null | undefined): boolean {
  const normalized = normalizeStatus(value);
  return PAID_STATUSES.some((status) => normalizeStatus(status) === normalized);
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeRemainingBalance(params: {
  lineTotal: unknown;
  quantity: unknown;
  unitPrice: unknown;
  discount: unknown;
  adjustment: unknown;
}): number {
  const lineTotal = toFiniteNumber(params.lineTotal, Number.NaN);
  if (Number.isFinite(lineTotal)) {
    return lineTotal;
  }

  const quantity = toFiniteNumber(params.quantity, 0);
  const unitPrice = toFiniteNumber(params.unitPrice, 0);
  const discount = toFiniteNumber(params.discount, 0);
  const adjustment = toFiniteNumber(params.adjustment, 0);

  return quantity * unitPrice - discount - adjustment;
}

export function computeLineTotalForUpdate(params: {
  existing: ExistingTransactionForPaidStatusCheck;
  updateValues: TransactionUpdateRecord['values'];
}): number {
  const quantity = toFiniteNumber(
    params.updateValues.Quantity ?? params.existing.quantity,
    0
  );
  const unitPrice = toFiniteNumber(
    params.updateValues['Unit Price'] ?? params.existing.unitPrice,
    0
  );
  const adjustment = toFiniteNumber(params.existing.adjustment, 0);

  return quantity * unitPrice - adjustment;
}
