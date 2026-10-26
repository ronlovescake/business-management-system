import { dayjs, toDate } from '@/utils/date';

export function parseAnalyticsDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? (toDate(value) ?? new Date(Number.NaN))
    : new Date(value);
}

export type DateFilterType =
  | 'ytd'
  | 'mtd'
  | 'last7days'
  | 'last30days'
  | 'last3months'
  | 'last6months'
  | 'all';

export const DATE_FILTER_VALUES = [
  'ytd',
  'mtd',
  'last7days',
  'last30days',
  'last3months',
  'last6months',
  'all',
] as const satisfies readonly DateFilterType[];

export const DATE_FILTER_OPTIONS: { value: DateFilterType; label: string }[] = [
  { value: 'ytd', label: 'Year to Date' },
  { value: 'mtd', label: 'Month to Date' },
  { value: 'last7days', label: 'Last 7 Days' },
  { value: 'last30days', label: 'Last 30 Days' },
  { value: 'last3months', label: 'Last 3 Months' },
  { value: 'last6months', label: 'Last 6 Months' },
  { value: 'all', label: 'All Time' },
];

export const PERIOD_BADGE_LABELS: Record<DateFilterType, string> = {
  ytd: 'YTD',
  mtd: 'MTD',
  last7days: '7D',
  last30days: '30D',
  last3months: '3M',
  last6months: '6M',
  all: 'ALL',
};

export const COMPARISON_CAPTIONS: Record<DateFilterType, string> = {
  ytd: 'vs same period last year',
  mtd: 'vs same days last month',
  last7days: 'vs previous 7 days',
  last30days: 'vs previous 30 days',
  last3months: 'vs previous 3 months',
  last6months: 'vs previous 6 months',
  all: '',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the window a filter covers; null for 'all'. */
export function getFilterStart(
  filter: string,
  now: Date = new Date()
): Date | null {
  const current = dayjs(now).tz('Asia/Manila');
  switch (filter) {
    case 'ytd':
      return current.startOf('year').toDate();
    case 'mtd':
      return current.startOf('month').toDate();
    case 'last7days':
      return new Date(now.getTime() - 7 * DAY_MS);
    case 'last30days':
      return new Date(now.getTime() - 30 * DAY_MS);
    case 'last3months':
      return current.subtract(3, 'month').startOf('month').toDate();
    case 'last6months':
      return current.subtract(6, 'month').startOf('month').toDate();
    case 'all':
    default:
      return null;
  }
}

export function getDateRangeFilter(
  filter: string,
  now: Date = new Date()
): (date: Date) => boolean {
  const start = getFilterStart(filter, now);
  return (date) =>
    Number.isFinite(date.getTime()) && (!start || date >= start) && date <= now;
}

export interface ComparisonRange {
  currentStart: Date;
  previousStart: Date;
  previousEnd: Date;
}

// Clamps the day so e.g. Mar 31 shifted back one month lands on Feb 28/29, not Mar 2/3.
export function shiftMonths(date: Date, months: number): Date {
  return dayjs(date).tz('Asia/Manila').add(months, 'month').toDate();
}

/**
 * Window the selected filter covers (currentStart..now) and the same-length window
 * immediately before it. Returns null when there is nothing to compare against.
 */
export function getComparisonRange(
  filter: string,
  now: Date = new Date()
): ComparisonRange | null {
  const byMonths = (currentStart: Date, months: number): ComparisonRange => ({
    currentStart,
    previousStart: shiftMonths(currentStart, -months),
    previousEnd: shiftMonths(now, -months),
  });

  const byDays = (days: number): ComparisonRange => ({
    currentStart: new Date(now.getTime() - days * DAY_MS),
    previousStart: new Date(now.getTime() - 2 * days * DAY_MS),
    previousEnd: new Date(now.getTime() - days * DAY_MS),
  });

  switch (filter) {
    case 'ytd':
      return byMonths(
        dayjs(now).tz('Asia/Manila').startOf('year').toDate(),
        12
      );
    case 'mtd':
      return byMonths(
        dayjs(now).tz('Asia/Manila').startOf('month').toDate(),
        1
      );
    case 'last7days':
      return byDays(7);
    case 'last30days':
      return byDays(30);
    case 'last3months':
      return byMonths(
        dayjs(now)
          .tz('Asia/Manila')
          .subtract(3, 'month')
          .startOf('month')
          .toDate(),
        3
      );
    case 'last6months':
      return byMonths(
        dayjs(now)
          .tz('Asia/Manila')
          .subtract(6, 'month')
          .startOf('month')
          .toDate(),
        6
      );
    case 'all':
    default:
      return null;
  }
}

export function percentChange(
  current: number,
  previous: number
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }
  if (previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}
