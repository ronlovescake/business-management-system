# Clothing - Accounting: Expenses Business Logic

> **Source files:**
>
> - `src/app/clothing/accounting/hooks/useExpenses.ts`
> - `src/app/clothing/accounting/components/ExpenseFormDialog.tsx`
> - `src/app/clothing/accounting/components/StatsCards.tsx`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                                                       | Explanation                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | Four glassmorphic stat cards at the top                                                                     | Total Expenses (blue), Pending Approval count (red), Approved Total (green), This Month (teal). |
| 2   | Total Expenses: sum of `amount` for all filtered records                                                    | Includes all statuses in the filtered view.                                                     |
| 3   | Pending Approval: count of records where `status === 'pending'`                                             | Shows integer count, not currency.                                                              |
| 4   | Approved Total: sum of `amount` where `status === 'approved'`                                               | Excludes pending, rejected, and paid.                                                           |
| 5   | This Month: sum of `amount` for records in the current calendar month                                       | Filter applied by comparing `date` field to the current month/year.                             |
| 6   | Expenses with `sourceType === 'PRODUCT'` or `sourceType === 'SHIPMENT'` are excluded from operational views | Only `MANUAL` and other manually-entered source types are shown.                                |

---

## B - Expense Status Lifecycle

| #   | Logic                                                                                | Explanation                                                                                                            |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 7   | Status flow: `pending` → `approved` or `rejected`; `approved` → `paid`               | No backwards transitions.                                                                                              |
| 8   | `pending`: default on creation                                                       | Awaiting manager approval.                                                                                             |
| 9   | `approved`: manually approved                                                        | Sets `status = 'approved'`; no SweetAlert2, direct action. Success: Mantine notification `'Expense approved'` (green). |
| 10  | `rejected`: manually rejected                                                        | Sets `status = 'rejected'`; direct action. Success notification `'Expense rejected'` (green).                          |
| 11  | `paid`: expense has been disbursed                                                   | Status transition from approved.                                                                                       |
| 12  | `systemGenerated` flag: records auto-created by the system (e.g. payroll, shipments) | Used to identify non-manual records; may be excluded from certain views.                                               |

---

## C - Add / Edit Expense Form

| #   | Logic                                                                                        | Explanation                                                                                                        |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 13  | "Add New Expense" opens the form in create mode                                              | `editingExpense = null`. Modal title: `'Add New Expense'`; subtitle: `'Fill in the details to add a new expense'`. |
| 14  | "Edit" row action pre-fills the form with the selected record                                | Modal title: `'Edit Expense'`; subtitle: `'Update the expense details below'`.                                     |
| 15  | Date (required): DateInput with standard date input props                                    | Cannot be empty.                                                                                                   |
| 16  | Category (required): Select from `expenseCategoryOptions`; searchable; dropdown height 400px | Must select a category from the list.                                                                              |
| 17  | Amount (required): NumberInput with ₱ prefix, 2 decimal scale, minimum 0                     | Must be > 0.                                                                                                       |
| 18  | Description (required): TextInput                                                            | Cannot be empty.                                                                                                   |
| 19  | Notes (optional): Textarea, minimum 3 rows                                                   | Free-form notes.                                                                                                   |
| 20  | Receipt (optional): FileButton accepting `image/*` and `application/pdf`                     | Stored as a data URL in component state.                                                                           |
| 21  | Account (optional): Select from `accountOptions` if provided                                 | Associates the expense with a ledger account.                                                                      |
| 22  | Trip ID (optional): TextInput shown only when `showTripId = true`                            | Context-specific field for trip-linked expenses.                                                                   |
| 23  | "Save and add new" button available during create mode only                                  | After saving, clears the form and keeps the modal open for another entry.                                          |
| 24  | "Add Expense" / "Update Expense" submit button is disabled while form is invalid             | Controlled by `isValid` form state.                                                                                |
| 25  | On successful create: Mantine notification `'Expense created successfully'` (green)          | Modal closes automatically.                                                                                        |
| 26  | On successful update: Mantine notification `'Expense updated successfully'` (green)          | Modal closes automatically.                                                                                        |

---

## D - Delete

| #   | Logic                                                                               | Explanation                                   |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------- |
| 27  | Delete row action uses `showDeleteConfirm('this expense')` SweetAlert2 dialog       | If confirmed, calls `deleteExpenseAsync(id)`. |
| 28  | On successful delete: Mantine notification `'Expense deleted successfully'` (green) | Record removed from list.                     |

---

## E - Filters

| #   | Logic                                                                              | Explanation                                |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------ |
| 29  | Search filter: matches description, category, and employee name (case-insensitive) | Applied client-side.                       |
| 30  | Category filter: select from expense categories or `all`                           | Defaults to `all`.                         |
| 31  | Status filter: `pending`, `approved`, `rejected`, `paid`, or `all`                 | Defaults to `all`.                         |
| 32  | Source filter: filters by `sourceType` field                                       | Allows filtering by MANUAL vs other types. |

---

## F - Category Color Mapping

| #   | Logic                                                | Explanation                                                                                                                                                                             |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | Each category has a badge color assigned in the UI   | Examples: `'Driver Pay'` → blue, `'Fuel'` → orange, `'Maintenance & Repairs'` → red, `'Meal'` → green, `'Payroll'` → cyan, `'Products'` → blue.6, `'Shipping / Delivery Fee'` → teal.6. |
| 34  | Unrecognised categories fall back to a default color | No error is thrown for unlisted categories.                                                                                                                                             |

---

## G - CSV Export

| #   | Logic                                                                                        | Explanation                   |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------- |
| 35  | Export CSV exports all `filteredExpenses`                                                    | Calls `handleExportCSV`.      |
| 36  | Error if no expenses: Mantine notification `'No expenses to export'` (red)                   | Guard before generating file. |
| 37  | Exported headers: Date, Amount, Description, Category, Notes, Receipt, Status, Employee Name | Standard column set.          |
| 38  | Filename: `expenses_${YYYY-MM-DD}.csv`                                                       | Uses `getCurrentDateISO()`.   |

---

## H - CSV Import

| #   | Logic                                                                                | Explanation                                                  |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| 39  | Import CSV file picker triggers `handleImportCSV(file)`                              | Uses `FileReader.readAsText`.                                |
| 40  | Maximum file size: 5 MB                                                              | Error shown if exceeded.                                     |
| 41  | Maximum rows: 1,000                                                                  | Rows beyond 1,000 are skipped and tracked.                   |
| 42  | Required columns: `date`, `amount`, `description`, `category`                        | Missing required columns cause row to be skipped with error. |
| 43  | Optional columns: `notes`, `receipt`, `status`, `employeeName`                       | Missing optional columns use defaults.                       |
| 44  | `date` parsed via `parseCsvDateToISO(row.date)`                                      | Flexible date parsing supporting multiple formats.           |
| 45  | `amount` parsed via `parseCsvAmount(row.amount)`                                     | Removes currency symbols and commas.                         |
| 46  | `status` defaults to `'pending'` if not provided or invalid                          | Valid values: `pending`, `approved`, `rejected`.             |
| 47  | On success: Mantine notification `'${count} expenses imported successfully'` (green) | Count reflects successfully imported rows.                   |
| 48  | On error: Up to 10 error messages displayed in an alert                              | Errors shown after the full import attempt.                  |

---

## I - CSV Template Download

| #   | Logic                                                                                                      | Explanation                                      |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 49  | "Download Template" generates a blank CSV template                                                         | Filename: `expenses_template_${YYYY-MM-DD}.csv`. |
| 50  | Template fields: `date`, `amount`, `description`, `category`, `notes`, `receipt`, `status`, `employeeName` | Matches the import column expectations.          |
