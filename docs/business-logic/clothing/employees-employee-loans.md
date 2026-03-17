# Clothing - Employees: Employee Loans Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/employee-loans/hooks/useEmployeeLoans.ts`
> - `src/app/clothing/employees/employee-loans/types.ts`
>
> **⚠️ CRITICAL: This module uses LOCAL STATE ONLY — `useState<EmployeeLoan[]>([])`. There is no API, no React Query, and no persistence. All data is lost on page refresh.**

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                                            | Explanation                                                              |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 1   | Five stat cards shown at the top of the page                                                     | Total Loans, Pending, Active, Total Disbursed, Total Outstanding.        |
| 2   | Total Disbursed sums `amount` for records with `status === 'active'` or `status === 'completed'` | Reflects all loans that have been activated or fully repaid.             |
| 3   | Total Outstanding sums `remainingBalance` for records with `status === 'active'` only            | Completed loans have `remainingBalance = 0` and are excluded.            |
| 4   | Data is stored in `useState<EmployeeLoan[]>([])` initialised to an empty array                   | No server fetch occurs on mount; the list is always empty on first load. |

---

## B - Loan Types

| #   | Logic                                                                              | Explanation                                       |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| 5   | Supported loan types: `personal`, `emergency`, `educational`, `housing`, `vehicle` | Stored as a string union on the `loanType` field. |

---

## C - Loan Status Lifecycle

| #   | Logic                                                                                       | Explanation                                                     |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 6   | Status flow: `pending` → `approved` → `active` → `completed` (or `rejected` from `pending`) | Each transition is a distinct action; no backwards transitions. |
| 7   | `pending`: newly submitted, awaiting approval                                               | Default status on record creation.                              |
| 8   | `approved`: approved by a manager, not yet disbursed                                        | Intermediate state before activation.                           |
| 9   | `active`: loan is disbursed and repayments are in progress                                  | Set by `handleActivate`.                                        |
| 10  | `completed`: all payments made; `remainingBalance` zeroed                                   | Set by `handleMarkCompleted`.                                   |
| 11  | `rejected`: rejected from `pending` with a reason                                           | Set by `handleReject` after reason entry.                       |

---

## D - Monthly Payment Calculation

| #   | Logic                                                                                                  | Explanation                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 12  | `calculateLoanMonthlyPayment(amount, interestRate, termMonths)` uses the standard amortisation formula | `M = P * [r(1+r)^n] / [(1+r)^n - 1]` where `r = interestRate / 100 / 12`, `n = termMonths`. |
| 13  | If `interestRate === 0`, the formula simplifies to `amount / termMonths`                               | Avoids division-by-zero when interest is zero.                                              |
| 14  | `remainingBalance` is set equal to `amount` when a new loan record is created                          | Decrements as payments are recorded.                                                        |
| 15  | `monthlyPayment` is stored on the record and recomputed on every edit save                             | Computed from `amount`, `interestRate`, and `termMonths`.                                   |

---

## E - Add / Edit Loan Form

| #   | Logic                                                                | Explanation                                                |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------- |
| 16  | "Add Loan" button opens the form in create mode                      | `handleAddLoan` sets `editingLoan = null`, opens modal.    |
| 17  | "Edit" row action opens the form pre-filled with the selected record | `handleEditLoan(loan)` sets `editingLoan` and opens modal. |
| 18  | On create, record `id` is generated as `Date.now().toString()`       | Simple timestamp-based local ID; not a UUID.               |
| 19  | `createdAt` is set to `new Date().toISOString()` on create           | Stored on the local record.                                |
| 20  | Saving an edit replaces the matching record in the local state array | No API call is made.                                       |

---

## F - Approve

| #   | Logic                                                                                                 | Explanation                                       |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 21  | Approve action available when `status === 'pending'`                                                  | Calls `handleApproveLoan(id)`.                    |
| 22  | Sets `status = 'approved'`, `approvedBy = currentUserName`, `approvedDate = new Date().toISOString()` | Updates local state only; no confirmation dialog. |

---

## G - Reject

| #   | Logic                                                                                                        | Explanation                             |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| 23  | Reject action available when `status === 'pending'`                                                          | Calls `handleRejectLoan(id)`.           |
| 24  | Native `prompt('Please enter rejection reason:')` dialog collects the reason                                 | Browser-native prompt, not SweetAlert2. |
| 25  | If the user cancels or submits an empty string, no status change occurs                                      | Guard: `if (!reason) return`.           |
| 26  | Sets `status = 'rejected'`, `rejectedBy = currentUserName`, `rejectedDate = now`, `rejectionReason = reason` | Updates local state.                    |

---

## H - Activate

| #   | Logic                                                  | Explanation                                              |
| --- | ------------------------------------------------------ | -------------------------------------------------------- |
| 27  | Activate action available when `status === 'approved'` | Calls `handleActivateLoan(id)`.                          |
| 28  | Transitions status from `approved` to `active`         | No confirmation dialog; updates local state immediately. |

---

## I - Mark as Completed

| #   | Logic                                                      | Explanation                                              |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- |
| 29  | Mark Completed action available when `status === 'active'` | Calls `handleMarkLoanCompleted(id)`.                     |
| 30  | Sets `status = 'completed'` and `remainingBalance = 0`     | No confirmation dialog; updates local state immediately. |

---

## J - Delete

| #   | Logic                                                                             | Explanation                              |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------- |
| 31  | Delete row action available on all records                                        | Calls `handleDeleteLoan(id)`.            |
| 32  | Native `confirm('Are you sure you want to delete this loan application?')` dialog | Browser-native confirm, not SweetAlert2. |
| 33  | If user cancels the confirm dialog, no deletion occurs                            | Guard: `if (!confirmed) return`.         |
| 34  | On confirm, the record is removed from local state                                | No API call is made.                     |

---

## K - Filters

| #   | Logic                                                                             | Explanation                                   |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| 35  | Search filter: matches employee name, loan type, or purpose (case-insensitive)    | Applied client-side to the local state array. |
| 36  | Status filter: `pending`, `approved`, `active`, `completed`, `rejected`, or `all` | Defaults to `all`.                            |

---

## L - CSV Export

| #   | Logic                                                                                                                            | Explanation                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 37  | Export CSV exports all `filteredLoans` from local state                                                                          | Calls `handleExportCSV`.    |
| 38  | Exported columns: Employee, Loan Type, Amount, Interest Rate, Term (Months), Monthly Payment, Remaining Balance, Status, Purpose | Standard column set.        |
| 39  | Filename: `employee-loans-{YYYY-MM-DD}.csv`                                                                                      | Uses `getCurrentDateISO()`. |

---

## M - CSV Import

| #   | Logic                                                            | Explanation                                                    |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------- |
| 40  | "Import CSV" file picker triggers `handleImportCSV(file)`        | Uses `FileReader.readAsText`.                                  |
| 41  | Each parsed row is converted via `createImportedLoanRecord(row)` | Assigns a new `Date.now().toString()` ID to each imported row. |
| 42  | Imported records are appended to the existing local state array  | No API call; records do not persist on page refresh.           |
| 43  | No unmatched-employee warning or error dialog for import         | Import is purely additive with no server-side validation.      |
