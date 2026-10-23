export const ACCOUNTS_RECEIVABLE_TERM_MONTHS = 2;

export function calculateAccountsReceivableDueDate(shippedAt: Date): Date {
  const dueDate = new Date(shippedAt);
  const originalDay = dueDate.getUTCDate();

  dueDate.setUTCDate(1);
  dueDate.setUTCMonth(dueDate.getUTCMonth() + ACCOUNTS_RECEIVABLE_TERM_MONTHS);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  dueDate.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));

  return dueDate;
}
