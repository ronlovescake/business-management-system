export const EXPENSE_REQUIRED_COLUMNS = [
  'date',
  'amount',
  'description',
  'category',
] as const;

export type ExpenseImportRequiredColumn =
  (typeof EXPENSE_REQUIRED_COLUMNS)[number];

export function getMissingRequiredColumns(headers: string[]): string[] {
  return EXPENSE_REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
}

export function buildExpenseImportMissingColumnsMessage(
  missingColumns: string[],
  optionalColumns: string[]
): string {
  return (
    `Missing required columns: ${missingColumns.join(', ')}\n\n` +
    `Required columns: ${EXPENSE_REQUIRED_COLUMNS.join(', ')}\n` +
    `Optional columns: ${optionalColumns.join(', ')}`
  );
}
