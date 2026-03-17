# Clothing — Employees: Leave Tracker Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts`
> - `src/app/clothing/employees/leave-tracker/hooks/useLeaveTrackerMutations.ts`
> - `src/app/clothing/employees/leave-tracker/hooks/useLeaveTrackerQueries.ts`
> - `src/app/clothing/employees/leave-tracker/hooks/leaveTrackerUtils.ts`
> - `src/app/clothing/employees/leave-tracker/hooks/leaveTrackerCsvUtils.ts`
> - `src/app/clothing/employees/leave-tracker/types.ts`

---

## A — Page Layout & Stats Cards

| #   | Logic                                                  | Explanation                                                                       |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 1   | Stats cards display: Total Requests, Pending, Approved | Derived from the filtered leave request list.                                     |
| 2   | Three tabs: list view, calendar view, analytics        | `activeTab` state. Both the calendar and analytics views consume the same data.   |
| 3   | Analytics tab shows monthly breakdown                  | `MonthlyBreakdownItem` contains `leaveType`, `total`, and `percentage` per month. |

---

## B — Data Loading

| #   | Logic                                                       | Explanation                                                                                          |
| --- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 4   | Two queries on mount: leave requests and employee schedules | Leave requests from `/leave-requests`; schedules from `/schedules` (used for day-count calculation). |
| 5   | Employee options are fetched from `/employees`              | Used to populate the employee dropdown in the form.                                                  |
| 6   | Timezone is `Asia/Manila` for all date operations           | All date formatting uses `dayjs.tz(TIMEZONE)`.                                                       |

---

## C — Filters

| #   | Logic                                                                                                                       | Explanation                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 7   | Filter controls: Search (text), Leave Type (select), Status (select)                                                        | All filters applied simultaneously with AND logic. |
| 8   | Leave type options: Sick Leave, Vacation Leave, Emergency Leave, Maternity Leave, Paternity Leave, Bereavement Leave, Other | Applied as exact match filter.                     |
| 9   | Status options: pending, approved, rejected                                                                                 | Applied as exact match filter.                     |

---

## D — Leave Type & Status Colours

| #   | Logic                                                                                                                              | Explanation                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 10  | Leave type badge colours: Sick=red, Vacation=blue, Emergency=orange, Maternity=pink, Paternity=cyan, Bereavement=gray, Other=grape | `getLeaveTypeColor` maps each `LeaveType`.         |
| 11  | Status badge colours: pending=yellow, approved=green, rejected=red                                                                 | `getStatusColor` maps each `LeaveStatus`.          |
| 12  | Payment status badge colours: paid=green, unpaid=red, not-applicable=gray                                                          | `getPaymentStatusColor` maps each `PaymentStatus`. |

---

## E — Day Count Calculation

| #   | Logic                                                         | Explanation                                                                                             |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 13  | `calculateDays` counts scheduled work days, not calendar days | If the employee has a schedule index, only days where a schedule entry exists in the range are counted. |
| 14  | Fallback to calendar days when no schedule exists             | If `employeeScheduleIndex[employeeId]` is empty or missing, `end.diff(start, 'day') + 1` is used.       |
| 15  | Single-day requests where start equals end count as 1 day     | `end.isSame(start, 'day')` returns 1.                                                                   |
| 16  | Invalid or backwards date ranges return 0 days                | If `end.isBefore(start)`, 0 is returned.                                                                |

---

## F — Leave Allocation

| #   | Logic                                                         | Explanation                                                                                                                                  |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Annual leave entitlement is 7 paid days per employee per year | `ANNUAL_LEAVE_ENTITLEMENT = 7`.                                                                                                              |
| 18  | Remaining allocation counts only approved paid leaves         | `calculateRemainingLeaveAllocation` sums `numberOfDays` for all `status === 'approved' && paymentStatus === 'paid'` leaves for the employee. |
| 19  | Remaining allocation floors at 0                              | `Math.max(ANNUAL_LEAVE_ENTITLEMENT - usedPaidLeaveDays, 0)`. Negative is not shown.                                                          |

---

## G — Overlap Detection

| #   | Logic                                                                                 | Explanation                                                                                                   |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 20  | A leave request cannot overlap with an existing request for the same employee         | `hasLeaveOverlap` checks all existing `leaveRequests` for date range intersection with the same `employeeId`. |
| 21  | Editing a request ignores its own dates in the overlap check                          | `ignoreRequestId` parameter excludes the current record from overlap detection.                               |
| 22  | CSV import also checks overlap against other records being imported in the same batch | `additionalRequests` array is checked in addition to existing database records.                               |

---

## H — Add / Edit Leave Request Modal

| #   | Logic                                                                         | Explanation                                                                                          |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 23  | "Add Request" opens modal with empty form                                     | All fields reset to defaults.                                                                        |
| 24  | "Edit" button populates form from the existing request                        | `populateFormFromRequest` fills employee name, ID, leave type, payment status, dates, reason, notes. |
| 25  | Required fields: Employee Name, Employee ID, Leave Type, Start Date, End Date | Validation alerts with `alert('Please fill in required fields')` if any are missing.                 |
| 26  | Optional fields: Reason, Notes, Payment Status                                | Payment status defaults to `'not-applicable'`.                                                       |
| 27  | Payment status options: paid, unpaid, not-applicable                          | Controls whether the leave counts toward the 7-day paid leave allocation.                            |

---

## I — Save Leave Request

| #   | Logic                                                                       | Explanation                                                              |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 28  | `saveMutation` calls `POST /leave-requests`                                 | Works for both create and update (passed as payload with optional `id`). |
| 29  | Save error shows `alert('Failed to save leave request. Please try again.')` | Native browser alert.                                                    |
| 30  | Save success invalidates the leave requests query                           | The list is re-fetched after successful save.                            |

---

## J — Approve Leave Request

| #   | Logic                                                                                                 | Explanation                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 31  | Approving calls `PATCH /leave-requests` with `{ id, status: 'approved', approvedBy: 'System Admin' }` | Optimistic update changes status to `'approved'` in cache immediately.                                                                         |
| 32  | After successful approval, attendance records are synchronised                                        | `POST /attendance/apply-leave` is called with employee details and date range to create `on-leave` attendance records for the approved period. |
| 33  | Attendance sync failure is logged but does not block the approval                                     | `logger.error` is called; the leave request remains approved regardless.                                                                       |
| 34  | Approve error rolls back the optimistic change                                                        | Previous cache snapshot is restored; `alert('Failed to approve leave request: {error}')`.                                                      |

---

## K — Reject Leave Request

| #   | Logic                                                                     | Explanation                                                            |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 35  | Rejecting calls `PATCH /leave-requests` with `{ id, status: 'rejected' }` | Optimistic update changes status to `'rejected'` in cache immediately. |
| 36  | Reject error rolls back and shows `alert`                                 | `alert('Failed to reject leave request: {error}')`.                    |

---

## L — Delete Leave Request

| #   | Logic                                      | Explanation                                         |
| --- | ------------------------------------------ | --------------------------------------------------- |
| 37  | Delete calls `DELETE /leave-requests/{id}` | Optimistically removes the record from cache.       |
| 38  | Delete error rolls back and shows `alert`  | `alert('Failed to delete leave request: {error}')`. |

---

## M — CSV Export

| #   | Logic                                                  | Explanation                                                 |
| --- | ------------------------------------------------------ | ----------------------------------------------------------- |
| 39  | Export calls `buildLeaveRequestsCsv(filteredRequests)` | Exports all currently filtered leave records to a CSV file. |

---

## N — CSV Import

| #   | Logic                                                    | Explanation                                                                           |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 40  | Import uses `parseImportedLeaveRequests`                 | Parsed rows call `saveMutation` as a bulk array payload.                              |
| 41  | Import overlap checks are applied per-row during parsing | Each imported row is validated against existing requests and other rows in the batch. |
| 42  | `isImporting` flag prevents concurrent import operations | Set to `true` during import, `false` on completion.                                   |
