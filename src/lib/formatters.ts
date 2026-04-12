export type NumberFormatOptions = Intl.NumberFormatOptions;
export type DateTimeFormatOptions = Intl.DateTimeFormatOptions;

export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * Standard date/time format options for the app.
 * Use these defaults unless you have a specific reason not to.
 */
export const STANDARD_DATE_OPTIONS: DateTimeFormatOptions = {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Manila',
};

export const STANDARD_TIME_OPTIONS: DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'Asia/Manila',
};

export function formatDateTime(
  value: Date | string,
  options: DateTimeFormatOptions = {},
  locale: string = 'en-US'
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const opts = { timeZone: 'Asia/Manila', ...options };
  return new Intl.DateTimeFormat(locale, opts).format(date);
}
