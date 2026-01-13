export const RESERVED_STATUSES = [
  'In Transit',
  'Warehouse',
  'Prepared',
  'On-Hold',
] as const;

export const FULFILLED_STATUSES = [
  'Ready For Dispatch',
  'Checked Out',
  'Shipped',
  'Pending Payment',
] as const;

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isReservedStatus(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return RESERVED_STATUSES.some((status) => normalize(status) === normalized);
}

export function isFulfilledStatus(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return FULFILLED_STATUSES.some((status) => normalize(status) === normalized);
}

export function normalizeStatus(value: string | null | undefined): string {
  return normalize(value);
}
