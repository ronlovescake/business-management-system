# Clothing -- Employees: Cash Advance Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts`
> - `src/app/clothing/employees/cash-advance/types.ts`

---

## A -- Page Layout & Stat Cards

| #   | Logic                                                                                           | Explanation                                                                           |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1   | Four stat cards shown at the top of the page                                                    | Total Requests, Pending, Approved, and Total Amount (sum of approved + paid records). |
| 2   | Total Amount stat sums `amount` for records with `status === 'approved'` or `status === 'paid'` | Pending and rejected records do not contribute to the total.                          |
| 3   | Data loaded via `GET /cash-advances`; sorted by `createdAt` descending                          | `staleTime = 30_000` ms; newest records appear first.                                 |

---

## B -- Cash Advance Status Lifecycle

| #   | Logic                                                                         | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 4   | Status flow: `pending` -> `approved` -> `paid` (or `rejected` from `pending`) | No backwards transitions.                                                                                    |
| 5   | `pending`: newly submitted, awaiting approval                                 | Default status on creation.                                                                                  |
| 6   | `approved`: manually approved by a manager                                    | Sets `approvedBy = currentUserName`, `approvedDate = new Date().toISOString()`.                              |
| 7   | `rejected`: rejected from `pending` with a reason                             | Sets `rejectedBy`, `rejectedDate`, `rejectionReason`; clears approval fields.                                |
| 8   | `paid`: auto-triggered when `remainingBalance <= 0.01`                        | `useEffect` monitors all approved records; marks paid with `settledAmount = amount`, `remainingBalance = 0`. |

---

## C -- Monthly Payment Calculation

| #   | Logic                                                       | Explanation                                     |
| --- | ----------------------------------------------------------- | ----------------------------------------------- |
| 9   | `calculateMonthlyPayment(amount, terms)` = `amount / terms` | Simple equal instalment division (no interest). |
| 10  | Returns `undefined` if `terms <= 0` or result is not finite | No division shown when terms are invalid.       |
| 11  | Monthly payment is stored as `monthlyPayment` on the record | Computed and persisted on save.                 |

---

## D -- Deduction Cycle

| #   | Logic                                                                 | Explanation                                       |
| --- | --------------------------------------------------------------------- | ------------------------------------------------- |
| 12  | Deduction cycle type: `FIRST_HALF` or `SECOND_HALF`                   | Stored on the record as `deductionCycle`.         |
| 13  | `nextDeductionDate` and `lastDeductedDate` are tracked on each record | Used by payroll to schedule automatic deductions. |

---

## E -- Add / Edit Request Form

| #   | Logic                                                                                                                                              | Explanation                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 14  | "Add Request" button opens the form in create mode                                                                                                 | `handleAddRequest` sets `editingRequest = null`, opens modal.       |
| 15  | "Edit" row action opens the form pre-filled with the selected record                                                                               | `handleEditRequest(request)` sets `editingRequest` and opens modal. |
| 16  | Validation: employee is required -- `showError('Employee is required. Please select a valid employee.', 'Validation Error')`                       | `showError` is a SweetAlert2 wrapper.                               |
| 17  | Validation: amount must be a valid number greater than zero -- `showError('Amount must be a valid number greater than zero.', 'Validation Error')` | Checked before save.                                                |
| 18  | Employee field is a dropdown loaded from `GET /employees`; sorted alphabetically by name                                                           | `employeeOptions` built from the employee list on mount.            |
| 19  | On save error: `showError('Failed to save cash advance request. Please try again.', 'Save Failed')`                                                | Triggered in `saveMutation.onError`.                                |
| 20  | On successful save, form closes automatically                                                                                                      | `setIsFormOpen(false)` called in `saveMutation.onSuccess`.          |
| 21  | Optimistic update on create: temp record with `id = 'temp-{Date.now()}'` inserted at top of list                                                   | Rolled back on error.                                               |
| 22  | Optimistic update on edit: record updated in-place in the list                                                                                     | Rolled back on error.                                               |

---

## F -- Approve

| #   | Logic                                                                                                                                  | Explanation                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 23  | "Approve" action only shown when `status === 'pending'`                                                                                | Calls `handleApprove(id)`.                    |
| 24  | Approve sets `status = 'approved'`, `approvedBy = currentUserName`, `approvedDate = new Date().toISOString()`, clears rejection fields | Optimistic update via `updateStatusMutation`. |
| 25  | On error: `showError('Failed to update cash advance. Please try again.', 'Update Failed')`                                             | Rolls back optimistic update.                 |

---

## G -- Reject

| #   | Logic                                                                                                                                       | Explanation                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 26  | "Reject" action only shown when `status === 'pending'`                                                                                      | Calls `handleReject(id)`.                                                      |
| 27  | Native `prompt('Please enter rejection reason:')` dialog collects the reason                                                                | If the user cancels (returns `null` or empty string), no status change occurs. |
| 28  | Reject sets `status = 'rejected'`, `rejectedBy = currentUserName`, `rejectedDate = now`, `rejectionReason = reason`; clears approval fields | Optimistic update via `updateStatusMutation`.                                  |
| 29  | On error: `showError('Failed to update cash advance. Please try again.', 'Update Failed')`                                                  | Rolls back optimistic update.                                                  |

---

## H -- Delete

| #   | Logic                                                                                              | Explanation                                      |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 30  | "Delete" row action available on all records                                                       | Calls `handleDeleteRequest(id)`.                 |
| 31  | Delete uses `showDeleteConfirm('this cash advance request')` SweetAlert2 dialog                    | If confirmed, calls `deleteMutation.mutate(id)`. |
| 32  | Optimistic delete: record removed from list immediately                                            | Rolled back on error.                            |
| 33  | On error: `showError('Failed to delete cash advance request. Please try again.', 'Delete Failed')` | Triggered in `deleteMutation.onError`.           |

---

## I -- Filters

| #   | Logic                                                                      | Explanation                                |
| --- | -------------------------------------------------------------------------- | ------------------------------------------ |
| 34  | Search filter: matches employee name, purpose, or terms (case-insensitive) | Applied client-side to the cached records. |
| 35  | Status filter: `pending`, `approved`, `rejected`, `paid`, or `all`         | Defaults to `'all'`.                       |

---

## J -- CSV Export

| #   | Logic                                                                    | Explanation                    |
| --- | ------------------------------------------------------------------------ | ------------------------------ |
| 36  | "Export CSV" exports all `filteredRequests`                              | Calls `handleExportCSV`.       |
| 37  | Exported columns: Employee, Amount, Purpose, Terms, Request Date, Status | Simple comma-separated format. |
| 38  | Filename: `cash-advances-{YYYY-MM-DD}.csv`                               | Uses `getCurrentDateISO()`.    |

---

## K -- CSV Import

| #   | Logic                                                                                                          | Explanation                                           |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 39  | "Import CSV" file picker triggers `handleImportCSV(file)`                                                      | Uses `FileReader.readAsText`.                         |
| 40  | CSV column order: Employee, Amount, Purpose, Terms, Request Date, Status                                       | Header row skipped; index-based parsing.              |
| 41  | Each imported row is individually POSTed to `POST /cash-advances`                                              | Sequential loop; not a bulk endpoint.                 |
| 42  | On error during import: `showError('Failed to import some cash advances. Please try again.', 'Import Failed')` | Shown after the loop completes with failures.         |
| 43  | Successful import invalidates the cash advances query cache                                                    | `queryClient.invalidateQueries(cashAdvanceQueryKey)`. |
