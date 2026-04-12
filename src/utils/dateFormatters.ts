/**
 * Centralized date/time formatting utilities
 * All formatters use Asia/Manila timezone by default
 *
 * STANDARD FORMAT: "April 01, 2026 · 12:00 AM"
 * - Date: full month, zero-padded day, 4-digit year
 * - Separator: " · " (middle dot U+00B7)
 * - Time: zero-padded 12-hour, minutes, AM/PM
 * - Always Asia/Manila timezone
 *
 * All new modules/pages MUST use these formatters.
 * Do NOT create inline date formatters — import from here instead.
 */

const TIMEZONE = 'Asia/Manila';
const LOCALE = 'en-US';

/** Middle dot separator used between date and time parts */
export const DATE_TIME_SEPARATOR = ' \u00B7 ';

/**
 * Format date as "April 01, 2026"
 */
export const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  day: '2-digit',
  year: 'numeric',
  timeZone: TIMEZONE,
});

/**
 * Format time as "12:00 AM"
 */
export const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: TIMEZONE,
});

/**
 * Format date as "April 01, 2026" (same as dateFormatter — kept for backward compat)
 */
export const dateFormatterShort = dateFormatter;

/**
 * Format time without seconds as "12:00 AM" (same as timeFormatter — kept for backward compat)
 */
export const timeFormatterShort = timeFormatter;

/**
 * Format full date and time as "April 01, 2026 · 12:00 AM"
 *
 * NOTE: Intl.DateTimeFormat doesn't support custom separators,
 * so this formats date and time separately and joins with " · ".
 * Use `formatDateTimeFull()` for the standard combined format.
 */
export const dateTimeFormatter = {
  format(date: Date): string {
    return `${dateFormatter.format(date)}${DATE_TIME_SEPARATOR}${timeFormatter.format(date)}`;
  },
};

/**
 * Format a date+time as "April 01, 2026 · 12:00 AM"
 */
export function formatDateTimeFull(date: Date | string): string {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return `${dateFormatter.format(parsed)}${DATE_TIME_SEPARATOR}${timeFormatter.format(parsed)}`;
}

/**
 * Format a date as "April 01, 2026"
 */
export function formatDateOnly(date: Date | string): string {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return dateFormatter.format(parsed);
}

/**
 * Format a time as "12:00 AM"
 */
export function formatTimeOnly(date: Date | string): string {
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return timeFormatter.format(parsed);
}

/**
 * Helper function to format date parts separately
 */
export function formatDateParts(isoDate: string): {
  date: string;
  time: string;
} {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '-', time: '-' };
  }
  return {
    date: dateFormatter.format(parsed),
    time: timeFormatter.format(parsed),
  };
}

/**
 * Helper function to format time from HH:mm string
 */
export function formatTimeString(time: string): string {
  if (!time) {
    return '';
  }

  const [hours, minutes] = time.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return '—';
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return timeFormatter.format(date);
}

/**
 * Get the current timezone being used
 */
export function getTimezone(): string {
  return TIMEZONE;
}
