/**
 * Shared constants for accounting modules
 */

export const PAID_STATUSES = ['Shipped', 'Ready For Dispatch'] as const;

export const PERIOD_OPTIONS = [
  'All Time',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'This Year',
] as const;

export type PeriodOption = (typeof PERIOD_OPTIONS)[number];
