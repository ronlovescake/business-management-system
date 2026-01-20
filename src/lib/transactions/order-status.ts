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
// Only the explicit "Cancelled" status is treated as cancelled.
// This matches the transactions dropdown and avoids filtering other labels.
// ============================================================================
export function isCancelledOrderStatus(
  value: string | null | undefined
): boolean {
  return normalizeOrderStatus(value) === 'cancelled';
}
