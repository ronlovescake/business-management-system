export type NumberFormatOptions = Intl.NumberFormatOptions;
export type DateTimeFormatOptions = Intl.DateTimeFormatOptions;

export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDateTime(
  value: Date | string,
  options: DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat(locale, options).format(date);
}
