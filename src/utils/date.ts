import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import relativeTime from 'dayjs/plugin/relativeTime';

// Configure dayjs to always use the Philippines timezone across the app
const PH_TIMEZONE = 'Asia/Manila';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.tz.setDefault(PH_TIMEZONE);

export const DATE_STORAGE_FORMAT = 'YYYY-MM-DD';
export const DATE_DISPLAY_FORMAT = 'MMMM DD, YYYY';
export const DATETIME_DISPLAY_FORMAT = 'MMMM DD, YYYY [·] hh:mm A';
export const TIME_DISPLAY_FORMAT = 'hh:mm A';

/**
 * Returns current date in ISO (YYYY-MM-DD) respecting the configured timezone.
 */
export const getCurrentDateISO = () => dayjs().tz().format(DATE_STORAGE_FORMAT);

/**
 * Normalises any Date/string input to ISO (YYYY-MM-DD) using the configured timezone.
 */
export const toISODate = (value?: string | Date | null) =>
  value ? dayjs(value).tz().format(DATE_STORAGE_FORMAT) : '';

/**
 * Parses a stored ISO date into a native Date object in the configured timezone.
 */
export const toDate = (value?: string | null) =>
  value ? dayjs.tz(value, PH_TIMEZONE).toDate() : null;

/**
 * Formats a date for UI display (defaults to MMMM DD, YYYY).
 * Standard format: "April 01, 2026"
 */
export const formatDisplayDate = (
  value?: string | Date | null,
  format: string = DATE_DISPLAY_FORMAT
) => (value ? dayjs(value).tz().format(format) : '');

/**
 * Formats a date+time for UI display as "April 01, 2026 · 12:00 AM".
 */
export const formatDisplayDateTime = (
  value?: string | Date | null
) => (value ? dayjs(value).tz().format(DATETIME_DISPLAY_FORMAT) : '');

/**
 * Returns a human-readable relative time string, e.g. "3 hours ago".
 * Replaces date-fns `formatDistanceToNow(date, { addSuffix: true })`.
 */
export const timeAgo = (value: string | Date | null | undefined): string =>
  value ? dayjs(value).fromNow() : '';

/**
 * Formats a date using a dayjs format string, e.g. 'MMM d, yyyy' → 'MMM D, YYYY'.
 * Replaces date-fns `format(date, pattern)`.
 */
export const formatDate = (
  value: string | Date | null | undefined,
  pattern: string
): string => (value ? dayjs(value).tz().format(pattern) : '');

export { dayjs };
