/**
 * Shared constants for accounting modules
 */

export const PAID_STATUSES = [
  'Checked Out',
  'Shipped',
  'Ready For Dispatch',
] as const;

/**
 * Business rule (ops workflow):
 * - When a transaction is tagged "Ready For Dispatch" or "Checked Out", it means the order is
 *   being shipped within the same day (i.e., treat as "shipped" for revenue recognition).
 * - We do not tag these statuses and then leave orders sitting in the warehouse for days.
 */

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
