/**
 * Centralized date/time formatting utilities
 * All formatters use Asia/Manila timezone by default
 */

const TIMEZONE = 'Asia/Manila';
const LOCALE = 'en-US';

/**
 * Format date as "Nov 05, 2025"
 */
export const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  timeZone: TIMEZONE,
});

/**
 * Format time as "07:30:00 PM"
 */
export const timeFormatter = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: TIMEZONE,
});

/**
 * Format time without seconds as "7:30 PM"
 */
export const timeFormatterShort = new Intl.DateTimeFormat(LOCALE, {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIMEZONE,
});

/**
 * Format date as "Nov 5, 2025"
 */
export const dateFormatterShort = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: TIMEZONE,
});

/**
 * Format full date and time as "Nov 05, 2025, 07:30:00 PM"
 */
export const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: TIMEZONE,
});

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
  return timeFormatterShort.format(date);
}

/**
 * Get the current timezone being used
 */
export function getTimezone(): string {
  return TIMEZONE;
}
