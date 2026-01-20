function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

const IN_TRANSIT_STATUSES = new Set([
  'in transit',
  'manila port',
  'with pier gatepass',
  'ph warehouse',
  'for pickup',
]);

export function isInTransitShipmentStatus(
  value: string | null | undefined
): boolean {
  const normalized = normalizeStatus(value);

  // Business rule: no shipment status implies still in transit.
  if (!normalized) {
    return true;
  }

  if (normalized === 'delivered') {
    return false;
  }

  // Preserve existing ops behavior: unknown statuses are treated as in transit.
  if (IN_TRANSIT_STATUSES.has(normalized)) {
    return true;
  }

  return true;
}
