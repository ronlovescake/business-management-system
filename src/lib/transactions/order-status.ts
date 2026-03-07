// ============================================================================
// ⚠️ ORDER STATUS NORMALIZATION
// ============================================================================
// Single source of truth for order-status comparisons.
// ============================================================================
export const ORDER_STATUS_OPTIONS = [
  'In Transit',
  'Warehouse',
  'Prepared',
  'Ready For Dispatch',
  'Checked Out',
  'On-Hold',
  'Pending Payment',
  'Shipped',
  'Cancelled',
  'Forfeited',
  'Voided',
] as const;

export type KnownOrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];

export function normalizeOrderStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const ORDER_STATUS_CANONICAL_MAP: Record<string, KnownOrderStatus> = {
  'in transit': 'In Transit',
  warehouse: 'Warehouse',
  prepared: 'Prepared',
  'ready for dispatch': 'Ready For Dispatch',
  'checked out': 'Checked Out',
  'on-hold': 'On-Hold',
  'on hold': 'On-Hold',
  'pending payment': 'Pending Payment',
  shipped: 'Shipped',
  cancelled: 'Cancelled',
  forfeited: 'Forfeited',
  voided: 'Voided',
};

export function canonicalizeOrderStatus(
  value: string | null | undefined
): KnownOrderStatus | undefined {
  const normalized = normalizeOrderStatus(value);
  if (!normalized) {
    return undefined;
  }
  return ORDER_STATUS_CANONICAL_MAP[normalized];
}

// ============================================================================
// ⚠️ CANCELLED STATUS RULE
// ============================================================================
// Cancellation-like terminal statuses.
// We treat these as "cancelled" for filtering/exclusion purposes.
// NOTE: Some business rules (e.g. buyer-fault vs not) should use the more
// specific helpers below.
// ============================================================================
export function isCancelledOrderStatus(
  value: string | null | undefined
): boolean {
  const normalized = normalizeOrderStatus(value);
  return (
    normalized === 'cancelled' ||
    normalized === 'forfeited' ||
    normalized === 'voided'
  );
}

// ============================================================================
// Buyer-fault cancellations (can count against the buyer)
// ============================================================================
export function isBuyerFaultCancellationStatus(
  value: string | null | undefined
): boolean {
  const normalized = normalizeOrderStatus(value);
  return normalized === 'cancelled' || normalized === 'forfeited';
}

// ============================================================================
// Deposit forfeiture triggers
// ============================================================================
// These statuses imply a reservation/deposit is forfeited (income recognized).
// Voided is explicitly excluded.
export function isDepositForfeitureOrderStatus(
  value: string | null | undefined
): boolean {
  return isBuyerFaultCancellationStatus(value);
}

export function isVoidedOrderStatus(value: string | null | undefined): boolean {
  return normalizeOrderStatus(value) === 'voided';
}

export function isForfeitedOrderStatus(
  value: string | null | undefined
): boolean {
  return normalizeOrderStatus(value) === 'forfeited';
}
