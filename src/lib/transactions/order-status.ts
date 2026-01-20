export function normalizeOrderStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isCancelledOrderStatus(
  value: string | null | undefined
): boolean {
  return normalizeOrderStatus(value) === 'cancelled';
}
