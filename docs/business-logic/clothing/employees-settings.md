# Clothing - Employees: Settings Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/settings/page.tsx`
> - `src/app/employees/_shared/EmployeeAutomationSettingsPage.tsx`
> - `src/app/api/employee-automation-settings/route.ts`
> - `src/app/api/internal/employee-automation/run-due/route.ts`

---

## A - Page Layout

| #   | Logic                                                                                           | Explanation                                                                    |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1   | Shared employee automation page renders two settings cards plus one history card                | Clothing, Trucking, and General Merchandise now use the same core settings UI. |
| 2   | A `LoadingOverlay` covers the page during `loading`, `saving`, or `running` states              | Prevents interaction while async operations are in progress.                   |
| 3   | Settings and history are fetched via `GET /employee-automation-settings` on mount               | The API returns an overview object with both `settings` and `history`.         |
| 4   | An informational alert explains that manual runs and scheduled runs share the same backend path | The UI communicates that run history is not just a client-side action log.     |

---

## B - Automation Settings Fields

| #   | Logic                                                                                                | Explanation                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | `stayInAutoPresenceEnabled` — Mantine `Switch` toggle                                                | Enables or disables stay-in attendance automation.                                                                                                 |
| 6   | `stayInAutoPresenceTime` — time input (24-hour format)                                               | Daily scheduler time for stay-in attendance. Default: `'02:00'`.                                                                                   |
| 7   | `stayInAutoPresenceTimezone` — text input                                                            | Timezone identifier for the stay-in schedule. Default: `'Asia/Manila'`.                                                                            |
| 8   | `stayInAutoPresenceGraceMinutes` — number input, range 0–120, step 5                                 | Grace period before the due window rolls over to the next day.                                                                                     |
| 9   | `payrollAutoGenerationEnabled` — Mantine `Switch` toggle                                             | Enables or disables automatic payroll generation for configured payroll cutoff dates.                                                              |
| 10  | `payrollAutoGenerationTime` — time input (24-hour format)                                            | Scheduler time used to decide when the current cutoff date becomes due.                                                                            |
| 11  | `payrollAutoGenerationTimezone` — text input                                                         | Timezone identifier for payroll automation.                                                                                                        |
| 12  | `payrollAutoGenerationCutoffDays` — date-picker-driven cutoff list plus explicit end-of-month action | Operators add example cutoff dates, and the system stores only the day-of-month values. The end-of-month button stores `31` as a month-end marker. |
| 13  | Time, timezone, and cutoff-date controls are disabled when payroll automation is off                 | Prevents editing run timing for a disabled automation.                                                                                             |

---

## C - Change Detection

| #   | Logic                                                                 | Explanation                                                                |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 14  | `hasChanges` is `true` when any stay-in or payroll field differs      | Change detection now covers both automation groups, including cutoff days. |
| 15  | Save button is disabled when there are no changes or the page is busy | Prevents redundant saves and concurrent operations.                        |
| 16  | Reset button is disabled when nothing changed and no status exists    | Reset is only active when it has something meaningful to clear or restore. |

---

## D - Save Settings

| #   | Logic                                                                                        | Explanation                                                                                     |
| --- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 17  | Save sends only changed fields via `PUT /employee-automation-settings`                       | Delta update keeps request bodies tight even though the page now manages two automation groups. |
| 18  | Payroll automation cannot be enabled without at least one cutoff day                         | The API rejects incomplete payroll schedules before they reach the scheduler.                   |
| 19  | The API requires `ADMIN` or `SUPER_ADMIN` and records a change-log entry                     | Settings changes now have explicit permission and audit coverage.                               |
| 20  | On success, the page updates `initial` from the API response and shows a green success alert | This resets change detection without refetching the full overview.                              |
| 21  | On validation or permission error, the page shows the API message inline                     | Errors stay in-context on the page instead of being hidden in the network tab.                  |

---

## E - Reset Settings

| #   | Logic                                                                     | Explanation                                                            |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 22  | Reset reverts `draft` back to the last loaded or saved `initial` state    | Discards unsaved changes for both stay-in and payroll fields together. |
| 23  | If no `initial` state is available, Reset triggers a fresh overview fetch | This recovers both settings and history after a failed initial load.   |

---

## F - Run Automation Now

| #   | Logic                                                                                                      | Explanation                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 24  | Each automation card has its own "Run now" button                                                          | Operators can manually test stay-in attendance and payroll generation independently.                               |
| 25  | `POST /employee-automation-settings` now requires an `automationType` in the request body                  | The same endpoint can run either `stay-in-attendance` or `payroll-generation`.                                     |
| 26  | Manual runs require `ADMIN` or `SUPER_ADMIN`, create an automation-run record, and log a change            | Manual execution now has explicit permission and audit coverage.                                                   |
| 27  | Payroll manual runs target the same current payroll period used by the Payroll page on the due cutoff date | This keeps manual payroll runs aligned with the Generate Payroll button while still supporting scheduler catch-up. |
| 28  | After a successful manual run, the page refetches overview data so the history table updates               | Run results become immediately visible below the settings cards.                                                   |

---

## G - Run History And Scheduler

| #   | Logic                                                                                                                                                                    | Explanation                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 29  | The page renders a recent history table with trigger source, status, target period, summary, and actor                                                                   | Users can see both manual and scheduler runs without leaving the settings page.                                                                      |
| 30  | Internal scheduler route: `POST /api/internal/employee-automation/run-due`                                                                                               | The server-side scheduler checks stay-in and payroll automations for any due work.                                                                   |
| 31  | Scheduled stay-in runs use a rolling 15-day catch-up window ending on the currently due target date                                                                      | This matches the Attendance page's auto-record backfill behavior for recent downtime.                                                                |
| 32  | Scheduled payroll runs use cutoff dates only to decide when payroll is due, then generate the same current payroll period the Payroll page would use on that cutoff date | Cutoff dates control timing, while payroll period selection stays aligned with the existing Generate Payroll flow.                                   |
| 33  | Late-month payroll cutoffs clamp to the last day of shorter months                                                                                                       | The explicit end-of-month UI option stores `31`, which automatically resolves to Feb 28/29, Apr 30, and other month ends without separate schedules. |
| 34  | Scheduled runs are deduplicated by period key before new history is written                                                                                              | The scheduler can poll every minute without creating repeated “already ran” history rows.                                                            |
| 35  | Disabled automations do not create scheduler history noise                                                                                                               | Only meaningful scheduled executions or first-time skips are persisted to the run history.                                                           |
