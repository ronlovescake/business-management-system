# Business Logic Index

This index is the shortest path to the domain and workspace logic documents without having to browse deep folder trees.

## Clothing

- [Business overview](./business-logic/clothing/business-overview.md)

### Operations

- [Transactions](./business-logic/clothing/operations-transactions.md)
- [Inventory](./business-logic/clothing/operations-inventory.md)
- [Products](./business-logic/clothing/operations-products.md)
- [Prices](./business-logic/clothing/operations-prices.md)
- [Shipments](./business-logic/clothing/operations-shipments.md)
- [Customers](./business-logic/clothing/operations-customers.md)
- [Dispatch](./business-logic/clothing/operations-dispatch.md)
- [Sorting and distribution](./business-logic/clothing/operations-sorting-distribution.md)
- [Dashboard](./business-logic/clothing/operations-dashboard.md)
- [Settings](./business-logic/clothing/operations-settings.md)

### Accounting

- [Accounting overview](./business-logic/clothing/accounting-overview.md)
- [Balance sheet](./business-logic/clothing/accounting-balance-sheet.md)
- [Ledger](./business-logic/clothing/accounting-ledger.md)
- [Journal](./business-logic/clothing/accounting-journal.md)
- [Profit and loss](./business-logic/clothing/accounting-profit-loss.md)
- [Expenses](./business-logic/clothing/accounting-expenses.md)

### Employees

- [Employees overview](./business-logic/clothing/employees-overview.md)
- [Attendance](./business-logic/clothing/employees-attendance.md)
- [Schedules](./business-logic/clothing/employees-schedules.md)
- [Payroll](./business-logic/clothing/employees-payroll.md)
- [Leave requests](./business-logic/clothing/employees-leave-requests.md)
- [Leave tracker](./business-logic/clothing/employees-leave-tracker.md)
- [Cash advance](./business-logic/clothing/employees-cash-advance.md)
- [13th month pay](./business-logic/clothing/employees-13th-month-pay.md)
- [Team](./business-logic/clothing/employees-team.md)

## General Merchandise

- [Business overview](./business-logic/general-merchandise/business-overview.md)

### Operations

- [Transactions](./business-logic/general-merchandise/operations-transactions.md)
- [Inventory](./business-logic/general-merchandise/operations-inventory.md)
- [Products](./business-logic/general-merchandise/operations-products.md)
- [Prices](./business-logic/general-merchandise/operations-prices.md)
- [Shipments](./business-logic/general-merchandise/operations-shipments.md)
- [Customers](./business-logic/general-merchandise/operations-customers.md)
- [Dispatch](./business-logic/general-merchandise/operations-dispatch.md)
- [Sorting and distribution](./business-logic/general-merchandise/operations-sorting-distribution.md)
- [Dashboard](./business-logic/general-merchandise/operations-dashboard.md)
- [Settings](./business-logic/general-merchandise/operations-settings.md)

### Accounting

- [Accounting overview](./business-logic/general-merchandise/accounting-overview.md)
- [Balance sheet](./business-logic/general-merchandise/accounting-balance-sheet.md)
- [Ledger](./business-logic/general-merchandise/accounting-ledger.md)
- [Journal](./business-logic/general-merchandise/accounting-journal.md)
- [Profit and loss](./business-logic/general-merchandise/accounting-profit-loss.md)
- [Expenses](./business-logic/general-merchandise/accounting-expenses.md)

### Employees

- [Employees overview](./business-logic/general-merchandise/employees-overview.md)
- [Attendance](./business-logic/general-merchandise/employees-attendance.md)
- [Schedules](./business-logic/general-merchandise/employees-schedules.md)
- [Payroll](./business-logic/general-merchandise/employees-payroll.md)
- [Leave tracker](./business-logic/general-merchandise/employees-leave-tracker.md)
- [Cash advance](./business-logic/general-merchandise/employees-cash-advance.md)
- [13th month pay](./business-logic/general-merchandise/employees-13th-month-pay.md)
- [Team](./business-logic/general-merchandise/employees-team.md)

## Household / Personal Finance

- [Household overview](./business-logic/household-finance/household-overview.md)
- [Accounts](./business-logic/household-finance/household-accounts.md)
- [Expenses](./business-logic/household-finance/household-expenses.md)
- [Income](./business-logic/household-finance/household-income.md)
- [Budgets](./business-logic/household-finance/household-budgets.md)
- [Recurring payments](./business-logic/household-finance/household-recurring-payments.md)
- [Dashboard](./business-logic/household-finance/household-dashboard.md)
- [Reports](./business-logic/household-finance/household-reports.md)
- [Settings](./business-logic/household-finance/household-settings.md)

## Trucking

- [Business overview](./business-logic/trucking/business-overview.md)
- [Operations overview](./business-logic/trucking/operations-overview.md)
- [Finance overview](./business-logic/trucking/finance-overview.md)
- [Employees overview](./business-logic/trucking/employees-overview.md)
- [Profitability analytics](./business-logic/trucking/analytics-profitability.md)
- [Cashflow report](./business-logic/trucking/reports-cashflow.md)

## Platform / Shared Logic

- [Platform overview](./business-logic/platform/platform-overview.md)
- [Auth and access](./business-logic/platform/auth-and-access.md)
- [Admin backup and restore](./business-logic/platform/admin-backup-restore.md)
- [Settings and configuration](./business-logic/platform/settings-and-configuration.md)
- [Change log and version history](./business-logic/platform/change-log-and-version-history.md)
- [User management and permissions](./business-logic/platform/user-management-and-permissions.md)
- [Module marketplace and module operations](./business-logic/platform/module-marketplace-and-module-operations.md)
- [Internal messaging and conversations](./business-logic/platform/internal-messaging-and-conversations.md)
- [Shared employee automation](./business-logic/platform/shared-employee-automation.md)

## Documentation Standards

- [Business Logic Documentation Standard](./BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md)
- [Business Logic Coverage Audit (2026-04-08)](./BUSINESS_LOGIC_COVERAGE_AUDIT_2026-04-08.md)

## Coverage Gap Notes

- Trucking operations, finance, profitability, and cashflow now have detailed rule docs; trucking employees remain the main trucking area that still needs deeper rule extraction.
- Platform user management / permissions and shared employee automation still have documentation homes but remain overview-level compared with the more mature detailed docs.
- Cross-domain admin, auth, backup/restore, permission, and shared automation logic now has a dedicated `docs/business-logic/platform/**` home instead of being scattered across unrelated docs.
- The next pass should expand trucking and platform docs from overview-level mapping into detailed per-module rule tables.