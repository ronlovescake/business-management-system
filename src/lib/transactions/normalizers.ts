export function parseLineTotal(
  value: number | string | null | undefined
): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const sanitized = value.replace(/[^\d.-]/g, '');
    const parsed = Number(sanitized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}
