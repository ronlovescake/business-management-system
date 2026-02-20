export function getCellValue(rawValue: unknown): string {
  if (
    rawValue === null ||
    rawValue === undefined ||
    (typeof rawValue === 'string' && rawValue.trim().toLowerCase() === 'null')
  ) {
    return '';
  }

  return String(rawValue);
}

export function getNumericValue(rawValue: unknown): number {
  const strVal = getCellValue(rawValue);
  const sanitizedNumeric = strVal.replace(/,/g, '').trim();

  if (sanitizedNumeric === '') {
    return 0;
  }

  const parsed = Number(sanitizedNumeric);
  return Number.isFinite(parsed) ? parsed : 0;
}
