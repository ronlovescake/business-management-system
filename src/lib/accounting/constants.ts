/**
 * Shared constants for accounting modules
 */

export const PAID_STATUSES = [
  'Checked Out',
  'Shipped',
  'Ready For Dispatch',
] as const;

// Transactions in these statuses are considered recognized on credit (unpaid).
// They should be treated as Accounts Receivable on the balance sheet.
export const ACCOUNTS_RECEIVABLE_STATUSES = ['Pending Payment'] as const;

export const PERIOD_OPTIONS = [
  'All Time',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'This Year',
] as const;

export type PeriodOption = (typeof PERIOD_OPTIONS)[number];
