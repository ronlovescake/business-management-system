# Clothing — Employees: Attendance Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/attendance/hooks/useAttendance.ts`
> - `src/app/clothing/employees/attendance/hooks/attendanceHookUtils.ts`
> - `src/app/clothing/employees/attendance/hooks/attendanceAutoRecordUtils.ts`
> - `src/app/clothing/employees/attendance/hooks/attendanceCsvUtils.ts`
> - `src/app/clothing/employees/attendance/components/AttendanceFormDialog.tsx`
> - `src/app/clothing/employees/attendance/types.ts`

---

## A — Page Layout & Stats Cards

| #   | Logic                                                                                           | Explanation                                                                         |
| --- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Stats cards display: Total Records, Present, Late, Absent, On Leave, Total Hours, Average Hours | All counts are computed from the filtered record set, not the full unfiltered list. |
| 2   | Status badge colours: present=green, late=yellow, absent=red, on-leave=blue                     | `getStatusColor` maps each `AttendanceStatus` to a Mantine colour.                  |
| 3   | Total Hours is the sum of `totalHours` across filtered records                                  | Includes all statuses.                                                              |
| 4   | Average Hours divides total hours by number of records                                          | Returns 0 if there are no records to avoid division by zero.                        |

---

## B — Filters & Search

| #   | Logic                                                          | Explanation                                                                        |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 5   | Filter controls: Search (text), Status (select), Year (select) | `useAttendanceFiltering` applies all three simultaneously.                         |
| 6   | Year filter generates a 7-year window                          | Options span from `currentYear - 1` to `currentYear + 5`.                          |
| 7   | Status filter accepts: all, present, late, absent, on-leave    | Selecting "all" returns all records.                                               |
| 8   | Search matches by employee name and employee ID                | Case-insensitive partial match.                                                    |
| 9   | Data fetches with a 30-second stale time                       | Background refetches are suppressed within this window while the page is active.   |
| 10  | Fetch errors show a red Mantine notification                   | `color: 'red'`, `title: 'Error'`, `message: 'Failed to fetch attendance records'`. |

---

## C — Add Record Button: Choice Dialog

| #   | Logic                                                                    | Explanation                                                                                           |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 11  | Clicking "Add Record" opens a SweetAlert2 choice dialog                  | Icon: `question`, title: `'Record Attendance'`.                                                       |
| 12  | Dialog text explains the auto-record coverage window                     | Describes the number of days covered by auto-record (controlled by `AUTO_RECORD_LOOKBACK_DAYS = 15`). |
| 13  | "Yes, Record Automatically" button (blue `#228be6`) triggers auto-record | Calls `handleAutoRecordAttendance`.                                                                   |
| 14  | "Manual Entry" button (grey `#868e96`) opens the manual form modal       | Sets `isRecordModalOpen = true`.                                                                      |
| 15  | `reverseButtons: true` — Cancel appears on the right                     | The Confirm button is on the left.                                                                    |
| 16  | Dialog is non-dismissible via outside click                              | `allowOutsideClick: false`.                                                                           |

---

## D — Auto-Record Attendance Flow

| #   | Logic                                                                                 | Explanation                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 17  | Auto-record shows a loading SweetAlert2 while processing                              | `Swal.showLoading()` is displayed with text `'Checking schedules and generating attendance records'`.                                                                    |
| 18  | Auto-record looks back 15 days from today                                             | `AUTO_RECORD_LOOKBACK_DAYS = 15`; the date range is `[today, today-1, ..., today-14]`.                                                                                   |
| 19  | Three API calls are made in sequence: schedules, existing attendance, leave requests  | Schedules fetched from `/schedules`; existing attendance from `/attendance?startDate=...&endDate=...`; leave requests from `/leave-requests`.                            |
| 20  | `prepareAutoRecordAttendance` determines which records to create                      | Only employees with a scheduled shift in the window who don't already have an attendance record for that day get a new record.                                           |
| 21  | Employees with approved leave on a date are marked as `on-leave` instead of `present` | Leave requests are checked first; if the employee has approved leave on the date, that status takes precedence.                                                          |
| 22  | No schedules found shows an info SweetAlert2                                          | `icon: 'info'`, `title: 'No Schedules Found'`, with the date range in the message. `allowOutsideClick: false`.                                                           |
| 23  | All records already exist shows an info SweetAlert2                                   | `icon: 'info'`, `title: 'Already Recorded'`, with the covered date range in the message. `allowOutsideClick: false`.                                                     |
| 24  | Successful auto-record shows a detailed success SweetAlert2                           | `icon: 'success'`, `title: 'Attendance Recorded!'`. HTML body shows coverage dates, per-day counts (as `<li>` items), and status totals (present count, on-leave count). |
| 25  | Successful auto-record also shows a green Mantine notification                        | `color: 'green'`, `title: 'Success'`, `message: 'Recorded {N} attendance records'`.                                                                                      |
| 26  | Auto-record error shows a red SweetAlert2                                             | `icon: 'error'`, `title: 'Error'`, `text` contains the error message. `allowOutsideClick: false`.                                                                        |

---

## E — Manual Record Form Modal

| #   | Logic                                                                                                                                                | Explanation                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Modal title: "Record Attendance" with a `IconClipboardCheck` icon (green)                                                                            | Subtitle: "Capture today's attendance details for this employee".                                                                                                                      |
| 28  | Required fields: Employee Name, Employee ID, Date                                                                                                    | Validation shows a red Mantine notification if any are missing: `title: 'Incomplete details'`, `message: 'Employee name, employee ID, and date are required.'`.                        |
| 29  | Optional fields: Department, Position, Time In, Time Out, Break 1 Start/End, Lunch Start/End, Break 2 Start/End, Total Hours, Status, Details, Notes | All default to empty or `'present'`.                                                                                                                                                   |
| 30  | Total Hours auto-calculates from Time In / Time Out                                                                                                  | When either `timeIn` or `timeOut` changes, `calculateTotalHours` computes hours as `(outHours*60 + outMinutes - inHours*60 - inMinutes) / 60`. Result is stored as a 2-decimal string. |
| 31  | Total Hours is `0` if Time In or Out is missing or invalid                                                                                           | Null / empty times produce `totalHours = 0`. Negative diff also produces 0.                                                                                                            |
| 32  | Department and Position default to `'N/A'` if blank on save                                                                                          | Empty strings are replaced with `'N/A'` in the data payload.                                                                                                                           |
| 33  | Time In and Time Out default to `'00:00'` if blank on save                                                                                           | Missing times are stored as midnight rather than null.                                                                                                                                 |
| 34  | Status defaults to `'present'`                                                                                                                       | The Select dropdown starts with `'present'` selected.                                                                                                                                  |
| 35  | Status options: present, late, absent, on-leave                                                                                                      | Defined in `ATTENDANCE_STATUS_OPTIONS` constant.                                                                                                                                       |
| 36  | Date defaults to today's ISO date                                                                                                                    | `getCurrentDateISO()` populates the default value.                                                                                                                                     |

---

## F — Save Manual Record Notifications

| #   | Logic                                         | Explanation                                                                                                                                                            |
| --- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 37  | Success creates a green Mantine notification  | `color: 'green'`, `title: 'Attendance recorded'`, `message: '{employeeName} marked as {StatusLabel}.'`. Status label is capitalised (e.g., `'Present'`, `'On Leave'`). |
| 38  | Save error creates a red Mantine notification | `color: 'red'`, `title: 'Error'`, `message: 'Failed to save attendance record'`.                                                                                       |
| 39  | On success the form resets and modal closes   | `setRecordForm(createEmptyFormValues())` and `setIsRecordModalOpen(false)`.                                                                                            |
| 40  | Optimistic insert prepends the new record     | A `temp-{timestamp}` entry appears immediately in the table.                                                                                                           |

---

## G — Update Status (Quick Badge Click)

| #   | Logic                                                               | Explanation                                                                                |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 41  | Status can be changed directly from the table row                   | `handleMarkStatus` calls `updateStatusMutation` with the new status value.                 |
| 42  | Optimistic update changes the badge colour immediately              | The cache is updated before the server responds.                                           |
| 43  | Status update success shows a green Mantine notification            | `color: 'green'`, `title: 'Updated'`, `message: 'Status updated successfully'`.            |
| 44  | Status update error shows a red Mantine notification and rolls back | Cache is restored; `color: 'red'`, `title: 'Error'`, `message: 'Failed to update status'`. |

---

## H — Delete Record

| #   | Logic                                                        | Explanation                                                                                           |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| 45  | Delete shows `showDeleteConfirm` SweetAlert2                 | Title: `'Delete this attendance record?'` with confirm/cancel buttons.                                |
| 46  | Confirmed delete optimistically removes record from list     | Record disappears immediately from the table.                                                         |
| 47  | Delete success shows a green Mantine notification            | `color: 'green'`, `title: 'Deleted'`, `message: 'Attendance record deleted successfully'`.            |
| 48  | Delete error shows a red Mantine notification and rolls back | Cache is restored; `color: 'red'`, `title: 'Error'`, `message: 'Failed to delete attendance record'`. |

---

## I — CSV Export

| #   | Logic                                                       | Explanation                                                       |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 49  | Export button exports the currently filtered records        | `handleExportCSV` calls `buildAttendanceCsv(filteredRecords)`.    |
| 50  | Export error shows a Swal `showError` if no records exist   | `'No attendance records to export'` is displayed before download. |
| 51  | File is downloaded as `attendance_records_{YYYY-MM-DD}.csv` | A hidden `<a>` element is created and clicked programmatically.   |

---

## J — CSV Import

| #   | Logic                                               | Explanation                                                                                         |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 52  | Import reads the file with `FileReader.readAsText`  | `parseImportedAttendanceCsv` parses the text into attendance records.                               |
| 53  | Successful import uses `bulkCreateMutation`         | Calls the same mutation as auto-record; optimistically prepends all temp records.                   |
| 54  | Import success shows a `showSuccess` SweetAlert2    | `title: 'Import Successful'`, `message: 'Successfully imported {N} attendance records'`.            |
| 55  | Import save failure shows a `showError` SweetAlert2 | `title: 'Import Failed'`, `message: 'Failed to save imported records to database. Error: {error}'`. |
| 56  | Parse/read errors show a `showError` SweetAlert2    | `title: 'Import Error'` / `'File Read Error'`, with message describing the failure type.            |
