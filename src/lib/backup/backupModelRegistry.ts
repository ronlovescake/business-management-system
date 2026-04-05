export type SelectiveBackupTable = {
  name: string;
  model: string;
  modelName: string;
};

export type LogBackupTable = {
  name: string;
  model: string;
  modelName: string;
  dateField: string;
};

export type BackupCoverageClass = 'selective-json' | 'log-only' | 'dump-only';

export const SELECTIVE_BACKUP_TABLES = [
  { name: 'transactions', model: 'transaction', modelName: 'Transaction' },
  {
    name: 'transaction_payments',
    model: 'transactionPayment',
    modelName: 'TransactionPayment',
  },
  {
    name: 'transaction_refunds',
    model: 'transactionRefund',
    modelName: 'TransactionRefund',
  },
  {
    name: 'transaction_status_changes',
    model: 'transactionStatusChange',
    modelName: 'TransactionStatusChange',
  },
  { name: 'customers', model: 'customer', modelName: 'Customer' },
  { name: 'products', model: 'product', modelName: 'Product' },
  { name: 'prices', model: 'price', modelName: 'Price' },
  { name: 'shipments', model: 'shipment', modelName: 'Shipment' },
  { name: 'employees', model: 'employee', modelName: 'Employee' },
  {
    name: 'employee_automation_settings',
    model: 'employeeAutomationSetting',
    modelName: 'EmployeeAutomationSetting',
  },
  {
    name: 'employee_automation_runs',
    model: 'employeeAutomationRun',
    modelName: 'EmployeeAutomationRun',
  },
  { name: 'schedules', model: 'schedule', modelName: 'Schedule' },
  { name: 'attendance', model: 'attendance', modelName: 'Attendance' },
  { name: 'payrolls', model: 'payroll', modelName: 'Payroll' },
  {
    name: 'thirteenth_month_pay_records',
    model: 'thirteenthMonthPayRecord',
    modelName: 'ThirteenthMonthPayRecord',
  },
  {
    name: 'salary_history',
    model: 'salaryHistory',
    modelName: 'SalaryHistory',
  },
  {
    name: 'leave_requests',
    model: 'leaveRequest',
    modelName: 'LeaveRequest',
  },
  { name: 'expenses', model: 'expense', modelName: 'Expense' },
  {
    name: 'trucking_employee_automation_settings',
    model: 'truckingEmployeeAutomationSetting',
    modelName: 'TruckingEmployeeAutomationSetting',
  },
  {
    name: 'trucking_employee_automation_runs',
    model: 'truckingEmployeeAutomationRun',
    modelName: 'TruckingEmployeeAutomationRun',
  },
  {
    name: 'cash_advances',
    model: 'cashAdvanceRecord',
    modelName: 'CashAdvanceRecord',
  },
  {
    name: 'cash_advance_deductions',
    model: 'cashAdvanceDeduction',
    modelName: 'CashAdvanceDeduction',
  },
  {
    name: 'clothing_accounting_opening_balances',
    model: 'clothingAccountingOpeningBalance',
    modelName: 'ClothingAccountingOpeningBalance',
  },
  {
    name: 'clothing_accounting_journal_lines',
    model: 'clothingAccountingJournalLine',
    modelName: 'ClothingAccountingJournalLine',
  },
  {
    name: 'clothing_recurring_payment_templates',
    model: 'clothingRecurringPaymentTemplate',
    modelName: 'ClothingRecurringPaymentTemplate',
  },
  {
    name: 'clothing_recurring_payment_drafts',
    model: 'clothingRecurringPaymentDraft',
    modelName: 'ClothingRecurringPaymentDraft',
  },
  {
    name: 'clothing_inventory_reclass_entries',
    model: 'clothingInventoryReclassEntry',
    modelName: 'ClothingInventoryReclassEntry',
  },
  {
    name: 'clothing_inventory_transit_build_entries',
    model: 'clothingInventoryTransitBuildEntry',
    modelName: 'ClothingInventoryTransitBuildEntry',
  },
  { name: 'invoices', model: 'invoice', modelName: 'Invoice' },
  { name: 'checkout_links', model: 'checkoutLink', modelName: 'CheckoutLink' },
  { name: 'item_weights', model: 'itemWeight', modelName: 'ItemWeight' },
  {
    name: 'general_merchandise_transactions',
    model: 'generalMerchandiseTransaction',
    modelName: 'GeneralMerchandiseTransaction',
  },
  {
    name: 'general_merchandise_transaction_payments',
    model: 'generalMerchandiseTransactionPayment',
    modelName: 'GeneralMerchandiseTransactionPayment',
  },
  {
    name: 'general_merchandise_transaction_refunds',
    model: 'generalMerchandiseTransactionRefund',
    modelName: 'GeneralMerchandiseTransactionRefund',
  },
  {
    name: 'general_merchandise_transaction_status_changes',
    model: 'generalMerchandiseTransactionStatusChange',
    modelName: 'GeneralMerchandiseTransactionStatusChange',
  },
  {
    name: 'general_merchandise_customers',
    model: 'generalMerchandiseCustomer',
    modelName: 'GeneralMerchandiseCustomer',
  },
  {
    name: 'general_merchandise_products',
    model: 'generalMerchandiseProduct',
    modelName: 'GeneralMerchandiseProduct',
  },
  {
    name: 'general_merchandise_prices',
    model: 'generalMerchandisePrice',
    modelName: 'GeneralMerchandisePrice',
  },
  {
    name: 'general_merchandise_shipments',
    model: 'generalMerchandiseShipment',
    modelName: 'GeneralMerchandiseShipment',
  },
  {
    name: 'general_merchandise_employees',
    model: 'generalMerchandiseEmployee',
    modelName: 'GeneralMerchandiseEmployee',
  },
  {
    name: 'general_merchandise_employee_automation_settings',
    model: 'generalMerchandiseEmployeeAutomationSetting',
    modelName: 'GeneralMerchandiseEmployeeAutomationSetting',
  },
  {
    name: 'general_merchandise_employee_automation_runs',
    model: 'generalMerchandiseEmployeeAutomationRun',
    modelName: 'GeneralMerchandiseEmployeeAutomationRun',
  },
  {
    name: 'general_merchandise_schedules',
    model: 'generalMerchandiseSchedule',
    modelName: 'GeneralMerchandiseSchedule',
  },
  {
    name: 'general_merchandise_attendance',
    model: 'generalMerchandiseAttendance',
    modelName: 'GeneralMerchandiseAttendance',
  },
  {
    name: 'general_merchandise_payrolls',
    model: 'generalMerchandisePayroll',
    modelName: 'GeneralMerchandisePayroll',
  },
  {
    name: 'general_merchandise_thirteenth_month_pay_records',
    model: 'generalMerchandiseThirteenthMonthPayRecord',
    modelName: 'GeneralMerchandiseThirteenthMonthPayRecord',
  },
  {
    name: 'general_merchandise_salary_history',
    model: 'generalMerchandiseSalaryHistory',
    modelName: 'GeneralMerchandiseSalaryHistory',
  },
  {
    name: 'general_merchandise_leave_requests',
    model: 'generalMerchandiseLeaveRequest',
    modelName: 'GeneralMerchandiseLeaveRequest',
  },
  {
    name: 'general_merchandise_expenses',
    model: 'generalMerchandiseExpense',
    modelName: 'GeneralMerchandiseExpense',
  },
  {
    name: 'general_merchandise_cash_advances',
    model: 'generalMerchandiseCashAdvanceRecord',
    modelName: 'GeneralMerchandiseCashAdvanceRecord',
  },
  {
    name: 'general_merchandise_cash_advance_deductions',
    model: 'generalMerchandiseCashAdvanceDeduction',
    modelName: 'GeneralMerchandiseCashAdvanceDeduction',
  },
  {
    name: 'general_merchandise_accounting_opening_balances',
    model: 'generalMerchandiseAccountingOpeningBalance',
    modelName: 'GeneralMerchandiseAccountingOpeningBalance',
  },
  {
    name: 'general_merchandise_accounting_journal_lines',
    model: 'generalMerchandiseAccountingJournalLine',
    modelName: 'GeneralMerchandiseAccountingJournalLine',
  },
  {
    name: 'general_merchandise_recurring_payment_templates',
    model: 'generalMerchandiseRecurringPaymentTemplate',
    modelName: 'GeneralMerchandiseRecurringPaymentTemplate',
  },
  {
    name: 'general_merchandise_recurring_payment_drafts',
    model: 'generalMerchandiseRecurringPaymentDraft',
    modelName: 'GeneralMerchandiseRecurringPaymentDraft',
  },
  {
    name: 'general_merchandise_invoices',
    model: 'generalMerchandiseInvoice',
    modelName: 'GeneralMerchandiseInvoice',
  },
  {
    name: 'general_merchandise_checkout_links',
    model: 'generalMerchandiseCheckoutLink',
    modelName: 'GeneralMerchandiseCheckoutLink',
  },
  {
    name: 'general_merchandise_item_weights',
    model: 'generalMerchandiseItemWeight',
    modelName: 'GeneralMerchandiseItemWeight',
  },
] as const satisfies readonly SelectiveBackupTable[];

export const LOG_BACKUP_TABLES = [
  {
    name: 'change_log',
    model: 'changeLog',
    modelName: 'ChangeLog',
    dateField: 'createdAt',
  },
  {
    name: 'audit_logs',
    model: 'auditLog',
    modelName: 'AuditLog',
    dateField: 'timestamp',
  },
] as const satisfies readonly LogBackupTable[];

export const DUMP_ONLY_BACKUP_MODELS = [
  'HealthCheck',
  'AdditionalCustomerInfo',
  'BundleBatch',
  'BundleBatchComponent',
  'InventoryMovement',
  'PaymentCard',
  'ShippingFeeCalculatorState',
  'TruckingFleetRegistry',
  'TruckingTrip',
  'TruckingVehicleAssignment',
  'OperationsNotification',
  'SortingDistribution',
  'InstalledModule',
  'ModuleMarketplace',
  'HouseholdExpense',
  'HouseholdAccount',
  'HouseholdRecurringPayment',
  'HouseholdIncome',
  'HouseholdBudget',
  'TruckingEmployee',
  'TruckingLeaveRequest',
  'TruckingCashAdvanceRecord',
  'TruckingCashAdvanceDeduction',
  'TruckingSchedule',
  'TruckingAttendance',
  'TruckingPayroll',
  'TruckingThirteenthMonthPayRecord',
  'TruckingExpense',
  'TruckingInvoice',
  'TruckingPayment',
  'TruckingPaymentAllocation',
  'TruckingSalaryHistory',
  'User',
  'PasswordResetToken',
  'Module',
  'UserPermission',
  'DispatchOrder',
  'Conversation',
  'ConversationParticipant',
  'Message',
  'InvoiceSettings',
  'MessageTemplate',
  'PostTemplateNotice',
  'TransactionsSettings',
  'AccountingSettings',
  'GeneralMerchandiseAdditionalCustomerInfo',
  'GeneralMerchandiseBundleBatch',
  'GeneralMerchandiseBundleBatchComponent',
  'GeneralMerchandiseInventoryMovement',
  'GeneralMerchandiseInventoryReclassEntry',
  'GeneralMerchandiseInventoryTransitBuildEntry',
  'GeneralMerchandiseOperationsNotification',
  'GeneralMerchandiseDispatchOrder',
  'GeneralMerchandiseSortingDistribution',
  'GeneralMerchandiseShippingFeeCalculatorState',
  'GeneralMerchandiseMessageTemplate',
  'GeneralMerchandisePostTemplateNotice',
] as const;

export const BACKUP_MODEL_CLASSIFICATION: Record<string, BackupCoverageClass> =
  Object.freeze({
    ...Object.fromEntries(
      SELECTIVE_BACKUP_TABLES.map(({ modelName }) => [
        modelName,
        'selective-json' as BackupCoverageClass,
      ])
    ),
    ...Object.fromEntries(
      LOG_BACKUP_TABLES.map(({ modelName }) => [
        modelName,
        'log-only' as BackupCoverageClass,
      ])
    ),
    ...Object.fromEntries(
      DUMP_ONLY_BACKUP_MODELS.map((modelName) => [
        modelName,
        'dump-only' as BackupCoverageClass,
      ])
    ),
  });
