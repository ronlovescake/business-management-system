import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

// Configure dayjs to always use the Philippines timezone across the app
const PH_TIMEZONE = 'Asia/Manila';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(PH_TIMEZONE);

export const DATE_STORAGE_FORMAT = 'YYYY-MM-DD';
export const DATE_DISPLAY_FORMAT = 'MMMM D, YYYY';

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
 * Formats a date for UI display (defaults to MMMM D, YYYY).
 */
export const formatDisplayDate = (
  value?: string | Date | null,
  format: string = DATE_DISPLAY_FORMAT
) => (value ? dayjs(value).tz().format(format) : '');

export { dayjs };
