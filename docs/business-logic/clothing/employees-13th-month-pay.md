# Clothing - Employees: 13th Month Pay Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts`
> - `src/app/clothing/employees/thirteenth-month-pay/types.ts`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                                                                           | Explanation                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Stat cards shown at the top of the page: Total Records, Pending/Calculated, Approved, Paid                                      | Counts derived from the aggregated record list.                               |
| 2   | Data loaded via three parallel React Query fetches: `GET /employees?status=active`, `GET /payroll`, `GET /thirteenth-month-pay` | `staleTime = 30_000` ms; all three are required to build the aggregated view. |

---

## B - Data Aggregation Model

| #   | Logic                                                                                                                                               | Explanation                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Records are aggregated into a `Map<string, AggregatedThirteenthData>` keyed by `{normalizedEmployeeId or normalizedEmployeeName}-{year}`            | One aggregated row per employee per year.                                                                                       |
| 4   | `normalizedEmployeeId` is the lowercase, trimmed employee ID; `normalizedEmployeeName` is lowercase+trimmed name used as fallback when ID is absent | Ensures payroll and employee records with slightly different identifiers are merged correctly.                                  |
| 5   | `monthsWorked` is a `Set<number>` of unique calendar month numbers (1–12) extracted from each payroll record's `payPeriod` field                    | Using a `Set` prevents double-counting when an employee has two payroll records in the same month (e.g. first and second half). |
| 6   | `totalBasicSalary` accumulates the `basicSalary` field from every payroll record belonging to the employee for that year                            | Semi-monthly payrolls contribute both halves.                                                                                   |
| 7   | `totalLwop` accumulates the `lwop` (Leave Without Pay) deductions from payroll records                                                              | Reduces the net basic salary base.                                                                                              |
| 8   | `totalAbsencesLates` accumulates the `absentsLates` field from payroll records                                                                      | Also reduces the net basic salary base.                                                                                         |

---

## C - Computation Formula

| #   | Logic                                                                                                           | Explanation                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 9   | `netBasicSalary = max(0, totalBasicSalary - totalLwop - totalAbsencesLates)`                                    | Floor at 0; cannot be negative.                                                       |
| 10  | `thirteenthMonthPay = netBasicSalary / monthsWorked.size`                                                       | Divides net basic salary by the number of distinct months the employee worked.        |
| 11  | `monthsWorked.size` is clamped to the range 1–12                                                                | Prevents division-by-zero (minimum 1) and values above a full year (maximum 12).      |
| 12  | This follows Philippine DOLE guidelines: 13th month pay = (total basic salary earned in the calendar year) / 12 | The formula approximates the DOLE standard using actual months worked as the divisor. |

---

## D - Record Status Lifecycle

| #   | Logic                                                                                         | Explanation                                                                         |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 13  | Status flow: `pending` / `calculated` → `approved` → `paid`                                   | No backwards transitions once approved.                                             |
| 14  | `calculated`: auto-computed from payroll data on each page load; values are not persisted yet | The record exists only in aggregated state until a persistence action is triggered. |
| 15  | `pending`: record has been persisted to the database but not yet approved                     | Written via `buildPersistencePayload` PATCH call.                                   |
| 16  | `approved`: record is locked — values will not be recalculated from payroll                   | Triggered by `approveRecord`; SweetAlert2 confirms the lock.                        |
| 17  | `paid`: 13th month pay has been disbursed                                                     | Triggered by `markAsPaid`; SweetAlert2 confirms.                                    |

---

## E - Locking Behaviour (Approved / Paid Records)

| #   | Logic                                                                                                                                                  | Explanation                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 18  | Records with `status === 'approved'` or `status === 'paid'` are "locked"                                                                               | The aggregation logic skips recalculating `thirteenthMonthPay` and `monthsWorked` for locked records. |
| 19  | Locked records overlay the aggregated map: existing `thirteenthMonthPay`, `netBasicSalary`, and `monthsWorked` are preserved from the persisted record | New payroll rows added after approval do not change the value.                                        |
| 20  | `calculated`-status persisted records are not locked                                                                                                   | Their values are overwritten by the fresh aggregation on each load.                                   |

---

## F - Approve Record

| #   | Logic                                                                                                                                            | Explanation                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 21  | "Approve" action available on `pending` / `calculated` records                                                                                   | Calls `approveRecord(record)`.                                        |
| 22  | SweetAlert2 confirmation dialog with a yellow warning box: `'Once approved, values will be locked and will no longer be automatically updated.'` | Title: `'Approve 13th Month Pay?'`, confirm button: `'Yes, Approve'`. |
| 23  | Loading spinner shown during the PATCH request                                                                                                   | `Swal.showLoading()` after confirm.                                   |
| 24  | On success: SweetAlert2 `'Approved!'` success alert                                                                                              | Record status updates to `approved` in cache.                         |
| 25  | On error: SweetAlert2 error alert `'Failed to approve the record.'`                                                                              | Cache is not mutated on failure.                                      |

---

## G - Mark as Paid

| #   | Logic                                                                                                                                 | Explanation                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | "Mark as Paid" action available on `approved` records                                                                                 | Calls `markAsPaid(record)`.                                                                                                                                                  |
| 27  | SweetAlert2 confirmation dialog: `'Mark as Paid?'` with employee name and amount shown                                                | Confirm button: `'Yes, Mark as Paid'`.                                                                                                                                       |
| 28  | Loading spinner shown during the PATCH request                                                                                        | `Swal.showLoading()` after confirm.                                                                                                                                          |
| 29  | On success: SweetAlert2 `'Marked as Paid!'` success alert                                                                             | Record status updates to `paid` in cache.                                                                                                                                    |
| 30  | On error: SweetAlert2 error alert `'Failed to mark as paid.'`                                                                         | Cache is not mutated on failure.                                                                                                                                             |
| 31  | When a payroll record is marked as paid via payroll's "Mark as Paid" flow, the linked 13th month record is also auto-synced to `paid` | Handled by `syncThirteenthMonthStatus` in `usePayroll.ts`; PATCH to `/thirteenth-month-pay/{id}/status`; ID = `{employeeId}-{year}`. Failure is silent (only `logger.warn`). |

---

## H - Edit Record

| #   | Logic                                                                                                                     | Explanation                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 32  | "Edit" row action opens the form pre-filled with the selected record                                                      | Calls `editRecord(record)`.                                            |
| 33  | Saving sends a PATCH to `/thirteenth-month-pay` via `buildPersistencePayload`                                             | Optimistic update applied immediately; rolled back on error.           |
| 34  | No confirmation dialog for editing                                                                                        | Changes are applied directly on save.                                  |
| 35  | `buildPersistencePayload` extracts `employeeId` from the record's composite ID by stripping the trailing `-{year}` suffix | Required because the aggregation key embeds both employee ID and year. |

---

## I - Delete Record

| #   | Logic                                                                       | Explanation                                                  |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 36  | "Delete" row action removes the persisted record                            | Calls `deleteRecord(id)`.                                    |
| 37  | Sends `DELETE /thirteenth-month-pay/{id}`                                   | Optimistic delete applied immediately; rolled back on error. |
| 38  | No confirmation dialog for deletion                                         | Delete is immediate with no SweetAlert2.                     |
| 39  | Errors are logged only (`logger.error`); no user-facing error message shown | Silent failure on delete error.                              |

---

## J - Year Filter

| #   | Logic                                                                                          | Explanation                                             |
| --- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 40  | Year selector filters the aggregated records to a specific calendar year                       | Default is the current year.                            |
| 41  | Changing the year filter triggers re-aggregation from the cached payroll and persisted records | No new server fetch required if payroll cache is fresh. |

---

## K - CSV Export

| #   | Logic                                                                                                                                           | Explanation                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 42  | Export CSV exports all records visible in the current filtered view                                                                             | Calls `handleExportCSV`.    |
| 43  | Exported columns: Employee, Year, Months Worked, Total Basic Salary, Total LWOP, Total Absences/Lates, Net Basic Salary, 13th Month Pay, Status | Covers all computed fields. |
| 44  | Filename: `13th-month-pay-{YYYY-MM-DD}.csv`                                                                                                     | Uses `getCurrentDateISO()`. |
