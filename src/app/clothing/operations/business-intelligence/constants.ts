import type { DateFilterType } from './types';

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
