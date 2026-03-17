# Clothing — Employees: Schedules Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/schedules/hooks/useSchedules.ts`
> - `src/app/clothing/employees/schedules/hooks/scheduleTimeUtils.ts`
> - `src/app/clothing/employees/schedules/hooks/scheduleBulkUtils.ts`
> - `src/app/clothing/employees/schedules/hooks/scheduleCsvUtils.ts`
> - `src/app/clothing/employees/schedules/types.ts`

---

## A — Page Layout & Tabs

| #   | Logic                                                   | Explanation                                                                                                |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Two tabs: "list" and "calendar"                         | `activeTab` defaults to `'list'`. Both tabs share the same React Query data.                               |
| 2   | Four stat cards: Total, Scheduled, Completed, Cancelled | All counts are from `calculateScheduleStats(filteredSchedules)`.                                           |
| 3   | Weekly breakdown analytics are available                | `calculateWeeklyBreakdown(filteredSchedules)` produces per-day counts used by the analytics/calendar view. |

---

## B — Data Loading

| #   | Logic                                                            | Explanation                                                              |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 4   | Three queries run on mount: employees, schedules, leave requests | `GET /employees?status=active`, `GET /schedules`, `GET /leave-requests`. |
| 5   | Employees are fetched with `status=active` only                  | Inactive employees are excluded from the assignee dropdown.              |
| 6   | Employee data has a 1-minute stale time                          | `staleTime: 60_000`.                                                     |
| 7   | Schedule and leave request data have a 30-second stale time      | `staleTime: 30_000`.                                                     |

---

## C — Filters

| #   | Logic                                                                               | Explanation                                                               |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 8   | Filter controls: Search (text), Shift Type (select), Status (select), Year (select) | `filterSchedules` in `scheduleListUtils` applies all four simultaneously. |
| 9   | Year filter generates a 7-year window                                               | Options span `currentYear - 1` to `currentYear + 5`.                      |
| 10  | Shift type options: morning, afternoon, night, full-day                             | No partial matches — exact filter.                                        |
| 11  | Status options: scheduled, completed, cancelled                                     | Exact filter.                                                             |
| 12  | Sorted schedules display newest-first                                               | `sortSchedules(filteredSchedules)` orders by date descending.             |

---

## D — Shift Type & Status Colours

| #   | Logic                                                                                   | Explanation                                  |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------- |
| 13  | Shift type badge colours: morning=orange, afternoon=yellow, night=indigo, full-day=cyan | `getShiftTypeColor` maps each `ShiftType`.   |
| 14  | Status badge colours: scheduled=blue, completed=green, cancelled=red                    | `getStatusColor` maps each `ScheduleStatus`. |

---

## E — Add / Edit Schedule Modal

| #   | Logic                                                                                                     | Explanation                                                                  |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 15  | "Add Schedule" opens the modal with empty form                                                            | `resetFormForCreate()` clears all form fields before `setIsModalOpen(true)`. |
| 16  | "Edit" button populates the form from the existing schedule                                               | `populateFormFromSchedule(schedule)` fills all fields, then opens modal.     |
| 17  | Required fields: Employee Name, Employee ID, Date, Shift Type, Start Time, End Time, Position, Department | `alert('Please fill in all required fields')` is shown if any are missing.   |
| 18  | Optional fields: Break 1, Lunch, Break 2, Notes                                                           | All default to null if blank.                                                |
| 19  | Shift type selection auto-fills Start/End Time from `SHIFT_CONFIG`                                        | Pre-defined times are loaded for each shift type on selection change.        |

---

## F — Save Schedule (Create / Update)

| #   | Logic                                                                                   | Explanation                                                                                      |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 20  | Save uses `saveScheduleMutation`                                                        | For new schedules: `POST /schedules`. For edits: `PATCH /schedules` with `id`.                   |
| 21  | API returns `{ schedules: Schedule[] }` for create, `{ schedule: Schedule }` for update | Multiple schedules can be returned on create (e.g., when recurrence generates multiple records). |
| 22  | Optimistic create prepends a `temp-{timestamp}` record                                  | Appears immediately in the list.                                                                 |
| 23  | Optimistic update modifies the target record in cache                                   | Change is visible before the server responds.                                                    |
| 24  | Both optimistic operations roll back on error                                           | Previous cache is restored; `alert('Failed to save schedule. Please try again.')` is shown.      |
| 25  | On success, the modal closes                                                            | `setIsModalOpen(false)`.                                                                         |

---

## G — Delete Schedule

| #   | Logic                                            | Explanation                                                                          |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 26  | Delete fires without a confirmation dialog       | `handleDeleteSchedule(id)` calls `deleteScheduleMutation.mutate(id)` directly.       |
| 27  | Optimistic delete removes the record immediately | The schedule disappears from the list before the API responds.                       |
| 28  | Delete error rolls back and shows `alert`        | Cache is restored; `alert('Failed to delete schedule. Please try again.')` is shown. |

---

## H — Status Update (Mark Completed / Cancelled)

| #   | Logic                                                  | Explanation                                                            |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| 29  | Status can be updated via action buttons in the table  | `updateStatusMutation` fires `PATCH /schedules` with `{ id, status }`. |
| 30  | Optimistic status update changes the badge immediately | Cache updated before server responds.                                  |
| 31  | Status update error rolls back and shows `alert`       | `alert('Failed to update schedule status. Please try again.')`.        |

---

## I — Recurring Rules

| #   | Logic                                                                   | Explanation                                                                                                            |
| --- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 32  | Recurring rules are stored client-side only (not persisted separately)  | `recurringRules` is local state; `generateSchedulesForRule` generates schedule records from a rule.                    |
| 33  | Recurring rules specify days of week, start/end dates, and shift config | `RecurringRule` includes `daysOfWeek` (0=Sunday), `startDate`, `endDate`, `shiftType`, and optional break/lunch times. |
| 34  | `isStayIn` flag marks stay-in employee schedules                        | Stay-in employees are identified by `employeeType === 'stay-in'` and tracked in a `stayInEmployees` Set.               |

---

## J — Leave Awareness in Schedule View

| #   | Logic                                        | Explanation                                                                                                                   |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 35  | Schedules can show leave status for a date   | `getEmployeeLeaveForDate(employeeId, date)` looks up the approved leave requests list for any overlapping leave on that date. |
| 36  | Leave data is fetched from `/leave-requests` | Displayed in the calendar view to indicate when a scheduled employee is on approved leave.                                    |

---

## K — CSV Import / Export

| #   | Logic                                                         | Explanation                                                                 |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 37  | Import uses `parseImportedSchedulesCsv`                       | Parsed records are submitted via `bulkImportMutation` to `POST /schedules`. |
| 38  | Bulk import success shows `alert`                             | `alert('Successfully imported {N} schedule(s)')`.                           |
| 39  | Bulk import error shows `alert`                               | `alert('Failed to save imported schedules to database. Error: {error}')`.   |
| 40  | Export builds CSV from `buildSchedulesCsv(filteredSchedules)` | Downloads all currently visible (filtered) schedule records.                |
