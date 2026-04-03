export const DEFAULT_RESTORE_TABLE_ORDER = [
  // Backup metadata logs
  'change_log',
  'audit_logs',

  // Core reference data
  'customers',
  'products',
  'prices',
  'shipments',

  // Transactions + dependent tables
  'transactions',
  'transaction_status_changes',
  'transaction_payments',
  'transaction_refunds',

  // Employees + payroll-related
  'employees',
  'employee_automation_settings',
  'schedules',
  'attendance',
  'payrolls',
  'salary_history',
  'thirteenth_month_pay_records',
  'leave_requests',

  // Finance
  'expenses',
  'cash_advances',
  'cash_advance_deductions',

  // Operations
  'invoices',
  'checkout_links',
  'item_weights',

  // Clothing accounting + recurring payments
  'clothing_accounting_opening_balances',
  'clothing_accounting_journal_lines',
  'clothing_recurring_payment_templates',
  'clothing_recurring_payment_drafts',
  'clothing_inventory_reclass_entries',
  'clothing_inventory_transit_build_entries',

  // General Merchandise (GM)
  'general_merchandise_customers',
  'general_merchandise_products',
  'general_merchandise_prices',
  'general_merchandise_shipments',

  'general_merchandise_transactions',
  'general_merchandise_transaction_status_changes',
  'general_merchandise_transaction_payments',
  'general_merchandise_transaction_refunds',

  'general_merchandise_employees',
  'general_merchandise_employee_automation_settings',
  'general_merchandise_schedules',
  'general_merchandise_attendance',
  'general_merchandise_payrolls',
  'general_merchandise_salary_history',
  'general_merchandise_thirteenth_month_pay_records',
  'general_merchandise_leave_requests',

  'general_merchandise_expenses',
  'general_merchandise_cash_advances',
  'general_merchandise_cash_advance_deductions',

  'general_merchandise_invoices',
  'general_merchandise_checkout_links',
  'general_merchandise_item_weights',

  'general_merchandise_accounting_opening_balances',
  'general_merchandise_accounting_journal_lines',
  'general_merchandise_recurring_payment_templates',
  'general_merchandise_recurring_payment_drafts',
] as const;

export function sortTablesForRestore(
  tableNames: string[],
  order: readonly string[] = DEFAULT_RESTORE_TABLE_ORDER
) {
  const indexByName = new Map<string, number>();
  order.forEach((name, index) => indexByName.set(name, index));

  return tableNames
    .map((name, originalIndex) => ({
      name,
      originalIndex,
      orderIndex: indexByName.get(name) ?? Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => {
      if (a.orderIndex !== b.orderIndex) {
        return a.orderIndex - b.orderIndex;
      }
      return a.originalIndex - b.originalIndex;
    })
    .map((entry) => entry.name);
}
