# Clothing - Employees: 13th Month Pay Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts`
> - `src/app/clothing/employees/thirteenth-month-pay/page.tsx`
> - `src/app/clothing/employees/thirteenth-month-pay/types.ts`
> - `src/app/api/thirteenth-month-pay/calculatedRecords.ts`
> - `src/app/api/thirteenth-month-pay/calculated/route.ts`
> - `src/modules/shared/employees/thirteenth-month-pay/api/calculations.ts`
> - `src/modules/shared/employees/api/thirteenthMonthPayRouteFactory.ts`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                                      | Explanation                                                                                                              |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | Stat cards shown at the top of the page: Total Records, Pending/Calculated, Approved, Paid | Counts derived from the aggregated record list.                                                                          |
| 2   | Records are loaded from `GET /thirteenth-month-pay/calculated`                             | The server loads employee, payroll, and persisted records, then returns the merged calculation; `staleTime = 30_000` ms. |

---

## B - Data Aggregation Model

| #   | Logic                                                                                                                                               | Explanation                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 3   | The server aggregates records by `{normalizedEmployeeId or normalizedEmployeeName}-{year}`                                                          | One calculated row per employee per year is returned to the page.                                                               |
| 4   | `normalizedEmployeeId` is the lowercase, trimmed employee ID; `normalizedEmployeeName` is lowercase+trimmed name used as fallback when ID is absent | Ensures payroll and employee records with slightly different identifiers are merged correctly.                                  |
| 5   | `monthsWorked` is a `Set<number>` of unique calendar month numbers (1–12) extracted from each payroll record's `payPeriod` field                    | Using a `Set` prevents double-counting when an employee has two payroll records in the same month (e.g. first and second half). |
| 6   | `totalBasicSalary` accumulates the `basicSalary` field from every payroll record belonging to the employee for that year                            | Semi-monthly payrolls contribute both halves.                                                                                   |
| 7   | `totalLwop` accumulates the `lwop` (Leave Without Pay) deductions from payroll records                                                              | Reduces the net basic salary base.                                                                                              |
| 8   | `totalAbsencesLates` accumulates the `absentsLates` field from payroll records                                                                      | Also reduces the net basic salary base.                                                                                         |

---

## C - Computation Formula

| #   | Logic                                                                        | Explanation                                                                                                                                    |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `netBasicSalary = max(0, totalBasicSalary - totalLwop - totalAbsencesLates)` | Calculated by the shared server helper; floor at 0.                                                                                            |
| 10  | Generated `thirteenthMonthPay = netBasicSalary / 12`                         | The server calculation always divides by 12, regardless of months worked.                                                                      |
| 11  | `monthsWorked.size` is clamped to the range 1–12 and stored for reference    | Tracks how many distinct months had payroll; used for display only, not as divisor.                                                            |
| 12  | Generated pay uses the calendar-year net basic salary divided by 12          | The generated calculation retains its `/12` divisor; it is not normalized to the legacy edit formula, and existing records are not backfilled. |

---

## D - Record Status Lifecycle

Both the main PATCH (when a status is supplied) and the dedicated status PATCH
accept only `pending`, `calculated`, `approved`, or `paid`. Unsupported, empty,
null or numeric statuses return 400 before service reads/writes. This enum
validation does not add a new server-enforced transition policy.

| #   | Logic                                                                                                       | Explanation                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 13  | The UI flow is `pending` / `calculated` → `approved` → `paid`                                               | This describes the available UI actions, not a complete server-enforced monotonic state machine. |
| 14  | `calculated`: recomputed from payroll data by the server calculation endpoint; values are not persisted yet | The record remains a calculated view until approval persists the server-generated snapshot.      |
| 15  | `pending`: record has been persisted to the database but not yet approved                                   | Written via `buildPersistencePayload` PATCH call.                                                |
| 16  | `approved`: record is locked — values will not be recalculated from payroll                                 | Triggered by `approveRecord`; SweetAlert2 confirms the lock.                                     |
| 17  | `paid`: 13th month pay has been disbursed                                                                   | Triggered by `markAsPaid`; SweetAlert2 confirms.                                                 |

---

## E - Locking Behaviour (Approved / Paid Records)

| #   | Logic                                                                                                                                   | Explanation                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 18  | Records with `status === 'approved'` or `status === 'paid'` are "locked"                                                                | The server calculation preserves their persisted financial values instead of recalculating them. |
| 19  | Locked records overlay the fresh server aggregation: persisted `thirteenthMonthPay`, `netBasicSalary`, and `monthsWorked` are preserved | New payroll rows added after approval do not change the stored value.                            |
| 20  | `calculated`-status persisted records are not locked                                                                                    | Their values are overwritten by the fresh aggregation on each load.                              |

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

## H - Persist Calculated Status

| #   | Logic                                                                                                             | Explanation                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 32  | The current page exposes Approve and Mark as Paid actions, not an edit form                                       | Both actions send status-only PATCH requests to `/thirteenth-month-pay`.                                                     |
| 33  | Approving a calculated record asks the server to build the persistence payload from its current calculated record | The server derives the employee ID from the composite `{employeeId}-{year}` record ID.                                       |
| 34  | Financial values sent by the browser are not used for the approval snapshot                                       | The generated `/12` calculation remains distinct from the legacy edit formula; this work does not rewrite historical values. |
| 35  | If a persisted record is already approved or paid, later status updates preserve its stored financial values      | New payroll rows do not change the locked record.                                                                            |

---

## I - Record Maintenance Availability

| #   | Logic                                                                      | Explanation                                                                                |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 36  | The current page has no Add Record, Edit, or Delete row action             | Only Approve and Mark as Paid are exposed in the table.                                    |
| 37  | Calculated values remain transient until a status action persists a record | Approval stores the server-generated calculation snapshot.                                 |
| 38  | Existing approved or paid values are not recalculated or backfilled        | This preserves the distinction between generated calculations and legacy persisted values. |
| 39  | The server-backed calculated list is refreshed after status changes        | React Query invalidates the list after the mutation settles.                               |

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
