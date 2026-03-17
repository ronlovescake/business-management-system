# Clothing — Employees: Payroll Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/payroll/hooks/usePayroll.ts`
> - `src/app/clothing/employees/payroll/hooks/usePayrollPage.tsx`
> - `src/app/clothing/employees/payroll/hooks/payrollBulkActions.ts`
> - `src/app/clothing/employees/payroll/hooks/payrollPayslipGenerator.ts`
> - `src/app/clothing/employees/payroll/hooks/payrollCsvExport.ts`
> - `src/app/clothing/employees/payroll/hooks/payrollCsvImport.ts`
> - `src/app/clothing/employees/payroll/components/PayrollFormDialog.tsx`
> - `src/app/clothing/employees/payroll/types.ts`
> - `src/lib/payroll/payrollGenerationActions.ts`
> - `src/lib/payroll/payrollPaidActions.ts`

---

## A — Page Layout & Stat Cards

| #   | Logic                                                                             | Explanation                                                                    |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Four stat cards shown at the top of the page                                      | Total Records (blue), Pending (orange), Approved (green), Total Paid (indigo). |
| 2   | "Total Paid" displays formatted currency of sum of `netPay` from filtered records | Labeled with `₱` Philippine peso format.                                       |
| 3   | Data is filtered by `search`, `status`, and `payPeriod` filters                   | `filteredPayrolls` is re-derived on every filter change.                       |
| 4   | `staleTime = 30_000` ms (30 seconds) for the payroll query                        | Prevents excessive re-fetches during normal use.                               |

---

## B — Filters

| #   | Logic                                                                           | Explanation                                                                  |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 5   | Search filter: matches employee name (case-insensitive)                         | Controlled by `searchQuery` state.                                           |
| 6   | Status filter: `pending`, `approved`, `paid`, or `all`                          | `statusFilter` defaults to `'all'`.                                          |
| 7   | Pay period filter: dropdown of unique pay periods extracted from loaded records | `payPeriodOptions` is derived from the `payrolls` list.                      |
| 8   | Pay period format displayed as `'MMM D, YYYY – MMM D, YYYY'`                    | `formatPayPeriodDisplay` parses the raw `'YYYY-MM-DD to YYYY-MM-DD'` string. |

---

## C — Column Display & Totals Row

| #   | Logic                                                                                                                                                                                                                                 | Explanation                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 9   | Table columns: Employee Name, Pay Period, Basic Salary, Allowance, Overtime, Bonuses, 13th Month, Gross Pay, SSS, PhilHealth, Pag-IBIG, Tax, Loans, Cash Advance, LWOP, Absences/Lates, Total Deductions, Net Pay, Status, Bank/GCash | All monetary columns shown with `₱` prefix.                                                              |
| 10  | Gross Pay is rendered in **green**, Total Deductions in **red**, Net Pay in **blue bold large**                                                                                                                                       | Visual hierarchy to highlight key values.                                                                |
| 11  | Status badge shows colour + approved-by name or paid date when applicable                                                                                                                                                             | `approved` status shows `by {approvedBy}`; `paid` status shows `on {paidDate}`.                          |
| 12  | A totals row at the bottom sums all numeric columns from `columnTotals`                                                                                                                                                               | `INITIAL_TOTALS` zeroed then reduced over `filteredPayrolls`.                                            |
| 13  | SSS, PhilHealth, Pag-IBIG, and Tax fallback to employee directory contributions when the payroll row value is 0                                                                                                                       | `resolveContributionValue` checks the employee directory for stored monthly contributions as a fallback. |

---

## D — Payroll Formulas

| #   | Logic                                                                                                      | Explanation                                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 14  | `grossPay = basicSalary + allowance + overtime + bonuses + thirteenthMonth`                                | Calculated live in the form via `calculatePayrollTotals`.          |
| 15  | `totalDeductions = sss + philHealth + pagIbig + tax + loans + cashAdvance + lwop + absentsLates`           | All deduction fields contribute.                                   |
| 16  | `netPay = max(0, grossPay – totalDeductions)`                                                              | Net pay cannot go below zero.                                      |
| 17  | The form shows a live "Gross Pay / Total Deductions / Net Pay" summary panel that updates as fields change | Computed from `form.values` via `calculateTotals` on every render. |

---

## E — Add / Edit Payroll Form

| #   | Logic                                                                                                                                               | Explanation                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 18  | "Add Payroll" button opens the form in create mode (`editingPayroll = null`)                                                                        | Triggered by `handleOpenManualPayroll`.                             |
| 19  | "Edit" row action opens the form with the selected record pre-filled                                                                                | `handleEditPayroll(payroll)` sets `editingPayroll` and opens modal. |
| 20  | Required fields: Employee Name, Pay Period, Basic Salary, Bank/GCash                                                                                | Validation errors appear inline on the fields.                      |
| 21  | Optional fields (default to 0): Allowance, Overtime, Bonuses, 13th Month, SSS, PhilHealth, Pag-IBIG, Tax, Loans, Cash Advance, LWOP, Absences/Lates | All numeric inputs start at `'0'`.                                  |
| 22  | Employee Name: Autocomplete from `employeeOptions` list                                                                                             | Can also type a custom name.                                        |
| 23  | Pay Period: Autocomplete from existing `payPeriodOptions`; falls back to free-text input if no options exist                                        | Text format: `'YYYY-MM-DD to YYYY-MM-DD'`.                          |
| 24  | Basic Salary must be greater than 0; returns validation error `'Basic salary must be greater than 0'`                                               | Enforced before save.                                               |
| 25  | "Create Payroll" / "Update Payroll" button is disabled until all required fields are valid                                                          | `canSave = form.isValid()`.                                         |
| 26  | On successful save, form resets and modal closes                                                                                                    | `form.reset()` called in `handleSubmit`.                            |

---

## F — Generate Payroll Flow (SweetAlert2)

| #   | Logic                                                                                                                                                                                      | Explanation                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 27  | "Generate Payroll" button triggers `handleAddPayroll` → `runPayrollGenerationFlow`                                                                                                         | Uses SweetAlert2 picker dialog with period selection.                                                  |
| 28  | Guard: if `isGeneratingPayroll` is true, the flow returns early (idempotent)                                                                                                               | Prevents double-generation.                                                                            |
| 29  | Period picker dialog shows dropdown: "Current period (based on today)", missing periods since earliest payroll record, and "Custom period"                                                 | Options built by comparing existing payroll periods against expected semi-monthly periods.             |
| 30  | Current period auto-computes: days 1–15 → `{month}/1 to {month}/15`; days 16–end → `{month}/16 to {month}/last`                                                                            | Uses current system date to determine which half of the month it is.                                   |
| 31  | Custom period shows start date, end date, and optional label inputs inline in the dialog                                                                                                   | `didOpen` handler toggles custom fields based on dropdown selection.                                   |
| 32  | Validation in `preConfirm`: start date must be before end date; both must be provided                                                                                                      | Shows `Swal.showValidationMessage(...)` on error.                                                      |
| 33  | On generation success: SweetAlert2 `success` dialog shows `'{count} employee(s) generated for {period}'`                                                                                   | Count and period label are interpolated from the API response.                                         |
| 34  | "Deleted Payroll Found" cleanup dialog: if API returns `action = 'restore_or_hard_delete'` or `'cleanup_soft_deleted'`, prompts to permanently delete soft-deleted records and re-generate | `cleanupDialogTitle = 'Deleted Payroll Found'`; confirm button is red "Permanently Remove & Generate". |
| 35  | On generation error: SweetAlert2 `error` dialog with error message                                                                                                                         | Falls back to `defaultGenerateErrorMessage`.                                                           |
| 36  | After successful generation, optionally prompts user to generate payslips immediately                                                                                                      | Calls `runPayrollPayslipGenerationFlow` as a follow-up.                                                |

---

## G — Generate Payslips Flow (SweetAlert2)

| #   | Logic                                                                                                                               | Explanation                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 37  | "Generate Payslips" button triggers `handleGeneratePayslips` → `runPayrollPayslipGenerationFlow`                                    | Guard: returns early if `isGeneratingPayslips` is true.          |
| 38  | Requires `payPeriodFilter` to be set; if empty, SweetAlert2 `info` dialog: `'Please select a pay period to generate payslips for.'` | Cannot generate payslips without a period filter.                |
| 39  | API: `POST /payroll/generate-payslips` with `{ periodStart, periodEnd, payPeriodLabel }`                                            | Response is a zip blob of PDF payslips.                          |
| 40  | On success: browser downloads the zip file named `payslips-{periodEnd}.zip` (or from `Content-Disposition` header)                  | Downloads via `<a download>` click.                              |
| 41  | On error: SweetAlert2 `error` dialog with the error message                                                                         | Falls back to `'Failed to download payslips. Please try again.'` |

---

## H — Approve (Single Record)

| #   | Logic                                                                                      | Explanation                                            |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| 42  | "Approve" row action visible only when `status === 'pending'`                              | `show: (item) => item.status === 'pending'`.           |
| 43  | Approve sets `status = 'approved'`, `approvedBy = currentUserName`, `approvedDate = today` | Calls `handleApprove(id)` via `usePayrollCrudActions`. |
| 44  | Optimistic update: list updates immediately; rolls back on API error                       | Standard React Query optimistic pattern.               |

---

## I — Approve All (Bulk SweetAlert2)

| #   | Logic                                                                                                                 | Explanation                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 45  | "Approve All" button triggers `handleApproveAll` → `runBulkApprovePayrolls`                                           | Operates on `filteredPayrolls` (respects current filters).   |
| 46  | If no pending records in view: SweetAlert2 `info` — `'There are no pending payrolls in the current view to approve.'` | Short-circuits with an OK dialog.                            |
| 47  | Confirmation dialog: `'Approve All Pending Payrolls?'` with count of pending records                                  | Icon `question`, confirm green `'Yes, approve all'`, cancel. |
| 48  | Loading dialog: `'Approving...'` with `Swal.showLoading()` spinner while processing                                   | Shown during the sequential update loop.                     |
| 49  | Each pending record individually updated via `updateMutation.mutateAsync`                                             | Sequential loop; failures tracked in `failures[]` array.     |
| 50  | If all succeed: SweetAlert2 `success` — `'Successfully approved {n} payroll record(s).'`                              | Green confirm button.                                        |
| 51  | If some fail: SweetAlert2 `warning` — `'Approved {n} record(s). Failed: {names}.'`                                    | Orange confirm button.                                       |
| 52  | On catastrophic error: SweetAlert2 `error` — `'Failed to approve all payrolls. Please try again.'`                    | Red confirm button.                                          |

---

## J — Mark as Paid (Single Record, SweetAlert2)

| #   | Logic                                                                                                                              | Explanation                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 53  | "Mark as Paid" row action visible only when `status === 'approved'`                                                                | `show: (item) => item.status === 'approved'`.                                                    |
| 54  | Confirmation dialog shows employee name, pay period, net pay, and 13th month note if applicable                                    | If `thirteenthMonth > 0`, a blue info box states the 13th month record will also be marked paid. |
| 55  | On confirm: shows `'Processing...'` loader, marks payroll `status = 'paid'` with `paidDate = today`                                | Calls `updatePayroll` via `updateMutation.mutateAsync`.                                          |
| 56  | If the payroll has `thirteenthMonth > 0`: also calls `PATCH /thirteenth-month-pay/{id}/status` with `{ status: 'paid', paidDate }` | `syncThirteenthMonthStatus` determines the record ID as `{employeeId}-{year}`.                   |
| 57  | If sync of 13th month fails, logs a warning but does **not** block the payroll marking                                             | `logger.warn('Failed to sync 13th month pay status:', ...)`.                                     |
| 58  | Success dialog: `'Marked as Paid!'` — different message depending on whether 13th month was included                               | Green confirm button `'Okay'`.                                                                   |
| 59  | Error dialog: `'Error'` — `'Failed to mark payroll as paid. Please try again.'`                                                    | Red confirm button.                                                                              |

---

## K — Mark All as Paid (Bulk SweetAlert2)

| #   | Logic                                                                                                                                                  | Explanation                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 60  | "Mark All as Paid" button operates on `filteredPayrolls` (respects current filters)                                                                    | Calls `runBulkMarkAllAsPaid`.                                 |
| 61  | If no approved records in view: SweetAlert2 `info` — `'There are no approved payrolls in the current view to mark as paid.'`                           | Short-circuits.                                               |
| 62  | Confirmation dialog: `'Mark All as Paid?'` with record count, **total disbursement** (`formatCurrency(sum of netPay)`), and note about 13th month sync | Icon `question`, confirm blue `'Yes, mark all as paid'`.      |
| 63  | Loading dialog: `'Processing...'` with `Swal.showLoading()` while iterating                                                                            | Sequential loop.                                              |
| 64  | Each record: syncs 13th month status first, then marks payroll paid                                                                                    | Same `syncThirteenthMonthStatus` logic as single-record flow. |
| 65  | Partial success: SweetAlert2 `warning` — `'Updated {n} record(s). Failed: {names}.'`                                                                   | Orange confirm button.                                        |
| 66  | Full success: SweetAlert2 `success` — `'Successfully marked {n} payroll record(s) as paid.'`                                                           | Green confirm button.                                         |
| 67  | Catastrophic error: SweetAlert2 `error` — `'Failed to mark payrolls as paid. Please try again.'`                                                       | Red confirm button.                                           |

---

## L — Sync LWOP (SweetAlert2)

| #   | Logic                                                                                                                                                  | Explanation                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 68  | "Sync LWOP" button triggers `handleSyncLwop`                                                                                                           | Guard: returns early if `isSyncingLwop` is true.    |
| 69  | Confirmation dialog: `'Sync LWOP Deductions?'` — `'This will calculate and update LWOP for all payroll records using approved unpaid leave requests.'` | Icon `question`, confirm `'Yes, sync now'`, cancel. |
| 70  | API: `POST /payroll/sync-lwop?all=true`                                                                                                                | Returns `{ synced: number, total: number }`.        |
| 71  | Success dialog: `'LWOP Synced'` — `'Updated {synced} of {total} payroll record(s).'`                                                                   | Invalidates query cache after.                      |
| 72  | Error dialog: `'Sync Failed'` — `'Failed to sync LWOP: {errorMessage}'`                                                                                | Logs error with `logger.error`.                     |

---

## M — Delete Payroll

| #   | Logic                                                           | Explanation                                |
| --- | --------------------------------------------------------------- | ------------------------------------------ |
| 73  | "Delete" row action visible on all records regardless of status | Calls `handleDeletePayroll(id)`.           |
| 74  | Delete uses `showDeleteConfirm` (SweetAlert2) before proceeding | Optimistic removal with rollback on error. |

---

## N — CSV Export

| #   | Logic                                                                                                                                                                                                                   | Explanation                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 75  | "Export CSV" button exports all `filteredPayrolls`                                                                                                                                                                      | Calls `exportPayrollCsv(filteredPayrolls)`.                |
| 76  | Exported columns: Employee, Pay Period, Basic Salary, Allowance, Overtime, Bonuses, Gross Pay, SSS, PhilHealth, Pag-IBIG, Tax, Loans, Cash Advance, LWOP, Absences/Lates, Total Deductions, Net Pay, Status, Bank/GCash | Note: `thirteenthMonth` is **not** included in the export. |
| 77  | Filename: `payroll-{YYYY-MM-DD}.csv`                                                                                                                                                                                    | Uses current date from `getCurrentDateISO()`.              |

---

## O — CSV Import

| #   | Logic                                                                                                                                                                                                                              | Explanation                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 78  | "Import CSV" file picker triggers `handleImportCSV(file)`                                                                                                                                                                          | Uses `FileReader.readAsText` then `importPayrollCsv`.    |
| 79  | CSV column order for import: Employee, Pay Period, Basic Salary, Allowance, Overtime, Bonuses, Gross Pay, SSS, PhilHealth, Pag-IBIG, Tax, Loans, Cash Advance, LWOP, Absences/Lates, Total Deductions, Net Pay, Status, Bank/GCash | Index-based parsing; header row is skipped.              |
| 80  | Employee name in CSV is matched against the employee directory by name                                                                                                                                                             | Unmatched employees tracked in `unmatchedEmployees` set. |
| 81  | If any employees could not be matched: SweetAlert2 `warning` — `'Some employees could not be matched: {names}. Cash advance deductions applied only to matched employees.'`                                                        | Orange confirm button.                                   |
| 82  | On error: SweetAlert2 `error` — `'Failed to import payroll data. Please try again.'`                                                                                                                                               | Red confirm button.                                      |
| 83  | Successful import invalidates the payroll query cache                                                                                                                                                                              | `queryClient.invalidateQueries(payrollQueryKey)`.        |
