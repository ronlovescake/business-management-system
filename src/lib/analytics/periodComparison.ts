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
  switch (filter) {
    case 'ytd':
      return new Date(now.getFullYear(), 0, 1);
    case 'mtd':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'last7days':
      return new Date(now.getTime() - 7 * DAY_MS);
    case 'last30days':
      return new Date(now.getTime() - 30 * DAY_MS);
    case 'last3months':
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case 'last6months':
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
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
  return start ? (date) => date >= start && date <= now : () => true;
}

export interface ComparisonRange {
  currentStart: Date;
  previousStart: Date;
  previousEnd: Date;
}

// Clamps the day so e.g. Mar 31 shifted back one month lands on Feb 28/29, not Mar 2/3.
export function shiftMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInTarget = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate();
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(date.getDate(), daysInTarget),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
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
      return byMonths(new Date(now.getFullYear(), 0, 1), 12);
    case 'mtd':
      return byMonths(new Date(now.getFullYear(), now.getMonth(), 1), 1);
    case 'last7days':
      return byDays(7);
    case 'last30days':
      return byDays(30);
    case 'last3months':
      return byMonths(new Date(now.getFullYear(), now.getMonth() - 3, 1), 3);
    case 'last6months':
      return byMonths(new Date(now.getFullYear(), now.getMonth() - 6, 1), 6);
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
