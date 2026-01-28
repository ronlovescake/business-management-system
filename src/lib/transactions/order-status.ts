// ============================================================================
// ⚠️ ORDER STATUS NORMALIZATION
// ============================================================================
// Single source of truth for order-status comparisons.
// ============================================================================
export function normalizeOrderStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
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
