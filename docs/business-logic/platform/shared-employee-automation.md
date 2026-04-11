# Platform — Shared Employee Automation

This file documents the shared employee automation logic that serves multiple business domains (clothing, general-merchandise, trucking).

> **Primary route roots:** `src/app/employees/_shared/**`
>
> **Primary shared roots:** `src/modules/shared/employees/automation/**`, `src/modules/shared/employees/api/**`, `src/lib/automation/**`

---

## A — Automation Types and Domains

| #  | Rule |
|----|------|
| A1 | Two automation types exist: `stay-in-attendance` and `payroll-generation`. |
| A2 | Three business domains share the same automation engine: `clothing`, `general-merchandise`, and `trucking`. |
| A3 | Each domain has its own Prisma models for settings, run history, attendance, payroll, schedules, and leave requests, but the orchestration logic is shared. |
| A4 | Trigger sources are `manual` (operator-initiated) or `scheduler` (sidecar-initiated via internal routes). |
| A5 | Execution result statuses are `success`, `skipped`, or `error`. |
| A6 | The `EmployeeAutomationDomain` type union is `'clothing' | 'trucking' | 'general-merchandise'`. |

---

## B — Automation Settings

| #  | Rule |
|----|------|
| B1 | Each domain stores a single settings record keyed by `key = 'default'`. If no record exists a read operation upserts one with defaults. |
| B2 | Default settings: `stayInAutoPresenceEnabled = true`, `stayInAutoPresenceTime = '02:00'`, `stayInAutoPresenceTimezone = 'Asia/Manila'`, `stayInAutoPresenceGraceMinutes = 0`, `payrollAutoGenerationEnabled = false`, `payrollAutoGenerationTime = '02:00'`, `payrollAutoGenerationTimezone = 'Asia/Manila'`, `payrollAutoGenerationCutoffDays = []`. |
| B3 | Time fields must match `HH:mm` 24-hour format (`/^([01]\d|2[0-3]):[0-5]\d$/`). |
| B4 | Timezone must be a non-empty string. |
| B5 | Grace minutes must be a finite integer `≥ 0` and `≤ 120`. Values are floored. |
| B6 | Payroll cutoff days must be an array of integers between 1 and 31 inclusive. Duplicates are removed, result is sorted ascending. |
| B7 | Enabling payroll automation (`payrollAutoGenerationEnabled = true`) with zero cutoff days is rejected with a validation error. |
| B8 | If the Prisma schema for automation tables is missing (error codes `P2021` or `P2022`, or message contains "does not exist"), a `SchemaMismatchError` is thrown on write operations and defaults are returned on read operations. |
| B9 | Settings updates are merged: existing values are preserved for fields not present in the update payload. |
| B10 | The `sanitizeEmployeeAutomationSettingsUpdate()` function only processes fields that are explicitly provided (`!== undefined`), casting booleans and validating strings/numbers. |

---

## C — Stay-In Attendance Automation

### C.1 — Target-Date Resolution

| #  | Rule |
|----|------|
| C1 | The target date is determined by `getDueStayInAutomationTarget()` using the configured schedule time, timezone, and grace minutes. |
| C2 | "Now" is computed as `dayjs().tz(timezone)`. The scheduled moment is today at the configured `scheduleTime`. |
| C3 | A grace window starts at `scheduledTime − graceMinutes`. If the current time is before the grace window start, the target date shifts back one day (yesterday's scheduled moment). Otherwise it uses today's scheduled moment. |
| C4 | The `targetDate` and `periodKey` are both `YYYY-MM-DD` formatted from the resolved target moment. |

### C.2 — Backfill (Catch-Up) Mode

| #  | Rule |
|----|------|
| C5 | When `backfillLookbackDays` is provided, `getStayInBackfillDateRange()` generates a rolling range of dates. |
| C6 | The constant `STAY_IN_ATTENDANCE_LOOKBACK_DAYS = 15` is the default lookback. |
| C7 | `buildRollingDateRange(endDate, lookbackDays)` produces an array of `lookbackDays` dates ending at `endDate`, ordered newest-first. The lookback is floored to a minimum of 1. |
| C8 | In backfill mode, dates are iterated in reverse (oldest first). Each date runs a separate `runStayInAutomationForDate()` call. |
| C9 | Results across all backfill dates are aggregated: `processed`, `inserted`, and `skipped` are summed. The overall status is `success` if any date inserted records. |
| C10 | Backfill metadata includes `oldestTargetDate`, `lookbackDays`, `checkedDates`, and per-date result summaries. |

### C.3 — Skip-If-Already-Recorded Logic

| #  | Rule |
|----|------|
| C11 | When `skipIfAlreadyRecorded = true`, the engine checks the automation run history for the period key. |
| C12 | A recorded stay-in run is considered safe to skip only if all expected attendance artifacts still exist in the database (not soft-deleted). |
| C13 | `getExpectedStayInArtifacts()` extracts target dates and expected counts from run metadata (`metadata.results[]`), falling back to `run.targetDate + run.inserted`. |
| C14 | `listActiveAutoAttendanceDates()` queries the domain-specific attendance table for non-deleted records matching the target dates with `details = 'Auto-recorded stay-in presence entry.'`. |
| C15 | If artifact counts match or exceed expected counts for all dates, the run is skipped with reason `already-recorded-run`. |
| C16 | If the recorded run had zero expected artifacts, the run is always skipped (no artifacts to verify). |

### C.4 — Per-Employee Execution

| #  | Rule |
|----|------|
| C17 | Stay-in automation only targets employees with `status = 'active'`, `employeeType = 'stay-in'`, and `deletedAt = null`. |
| C18 | Three checks run in parallel per domain: existing attendance, schedule snapshots, and approved leaves for the target date. |
| C19 | An employee is skipped with reason `already-recorded` if a non-deleted attendance record already exists for that date. |
| C20 | An employee is skipped with reason `on-leave` if they have an approved leave request covering the target date. |
| C21 | An employee is skipped with reason `no-schedule` if no active (non-cancelled, non-on-leave) schedule entries exist for the target date. |
| C22 | For eligible employees, `timeIn` is taken from the earliest schedule's `startTime`; `timeOut` from the latest schedule's `endTime`. Missing times fall back to the configured `stayInAutoPresenceTime`, then to `'00:00'`. |
| C23 | `totalHours` is calculated from `timeIn` and `timeOut`. If `endTime ≤ startTime`, it wraps around midnight (adds 24 hours). |
| C24 | Department and position are resolved from the first schedule entry, falling back to the employee record. |
| C25 | All attendance records in a single run are created in a Prisma `$transaction` (clothing domain) or equivalent batch. |
| C26 | The `details` field is always `'Auto-recorded stay-in presence entry.'` — this literal is used to identify automation-created records. |
| C27 | The `notes` field includes the run timestamp and timezone: `'Generated by stay-in automation on {timestamp} ({timezone}).'`. |
| C28 | The `status` field on created attendance records is always `'present'`. |
| C29 | Break fields (`break1Start`, `break1End`, `lunchStart`, `lunchEnd`, `break2Start`, `break2End`) are always `null` for auto-generated records. |

### C.5 — Domain Dispatch

| #  | Rule |
|----|------|
| C30 | Clothing domain: `runStayInAutoPresenceAutomation()` queries `prisma.employee`, `prisma.attendance`, `prisma.schedule`, `prisma.leaveRequest`. This is the original implementation with inline Prisma calls. |
| C31 | Trucking domain: `runTruckingStayInAutoPresenceAutomation()` delegates to `runSharedStayInAutoPresence()` with a client adapter loading `prisma.truckingEmployee`, `prisma.truckingAttendance`, `prisma.truckingSchedule`, `prisma.truckingLeaveRequest`. |
| C32 | General-merchandise domain: `runGeneralMerchandiseStayInAutoPresenceAutomation()` queries `prisma.generalMerchandiseEmployee`, `prisma.generalMerchandiseAttendance`, `prisma.generalMerchandiseSchedule`, `prisma.generalMerchandiseLeaveRequest`. |
| C33 | The `runSharedStayInAutoPresence()` runner in `stayInAutoPresenceRunner.ts` is a domain-agnostic engine that takes a `StayInAutomationClients` interface with five methods: `loadEmployees`, `loadExistingAttendance`, `loadScheduleSnapshots`, `loadApprovedLeaves`, `createAttendanceRecords`. Trucking uses this; clothing and GM do not yet. |
| C34 | All three domain runners filter `status: 'active'` and `employeeType: 'stay-in'` when loading employees. Cancelled/on-leave schedule entries are excluded. |

---

## D — Payroll Generation Automation

### D.1 — Cutoff and Period Resolution

| #  | Rule |
|----|------|
| D1 | Payroll cutoff days define which day(s) of the month trigger automatic payroll generation — for example `[15, 30]` means the 15th and 30th. |
| D2 | `normalizePayrollCutoffDays()` validates the array, floors to integers, deduplicates, sorts ascending, and rejects values outside 1–31. |
| D3 | `getDuePayrollAutomationPeriod()` builds cutoff candidates across a 3-month window (current month ± offset of −2, −1, 0). Each cutoff day in each month produces a candidate. |
| D4 | If a cutoff day exceeds the month's actual days (e.g., day 31 in a 30-day month), it clamps to the last day. |
| D5 | Duplicate cutoff dates (after clamping) within the same month are deduplicated, keeping the highest original `cutoffDay`. |
| D6 | The "due" cutoff is the latest candidate whose `scheduledAt` (cutoff date at the configured `scheduleTime`) is not after "now". |
| D7 | If no due cutoff is found, the function returns `null` and the automation skips with reason `no-due-cutoff`. |
| D8 | The payroll period is resolved from the due cutoff date via `getCurrentPayrollPeriod({ year, month, day })`. |
| D9 | The `periodKey` is `'{periodStart}:{periodEnd}'`. |

### D.2 — Manual vs Scheduler Trigger

| #  | Rule |
|----|------|
| D10 | When `triggerSource = 'manual'`, the payroll period uses `getCurrentPayrollPeriod()` with no date override (current date). The cutoff-day logic is bypassed entirely. |
| D11 | When `triggerSource = 'scheduler'` (default), the cutoff-day logic in D3–D8 applies. |

### D.3 — Skip-If-Already-Recorded Logic

| #  | Rule |
|----|------|
| D12 | When `skipIfAlreadyRecorded = true`, the engine checks the run history for the `periodKey` under `payroll-generation`. |
| D13 | `shouldSkipRecordedPayrollRun()` counts active (non-deleted) payroll records in the domain's payroll table for the period. |
| D14 | If active payroll records exist and the recorded run inserted records, skip if the active count ≥ the recorded `inserted` count. |
| D15 | If active payroll records exist and the recorded run inserted 0 (e.g., "already exists"), always skip. |
| D16 | If zero active payroll records exist, skip is refused only if the run is a "recovery candidate" — meaning `inserted > 0` or the message contains `'payroll already exists'`. |
| D17 | This recovery logic allows re-running payroll automation when previous payroll records were soft-deleted after a recorded successful run. |

### D.4 — Route Invocation

| #  | Rule |
|----|------|
| D18 | Payroll generation is executed by `invokePayrollGenerationRoute()`, which constructs a local `NextRequest` to the domain's `/api/{domain}/payroll/generate` route and calls the `POST` handler directly (in-process, no HTTP). |
| D19 | The request body includes `periodStart`, `periodEnd`, and `payPeriodLabel`. |
| D20 | Response interpretation: if `response.ok && body.success === true`, the result is `success` with `inserted = body.data.count ?? body.count`. |
| D21 | If the response is not OK or `success !== true`, the result is `skipped` when the message matches known skip patterns (e.g., "already exists for period", "no attendance records found", "no eligible employees"), otherwise `error`. |

---

## E — Orchestrated Execution (`executeDueAutomations`)

| #  | Rule |
|----|------|
| E1 | `executeDueAutomations()` runs both automation types sequentially for a single domain: stay-in first, then payroll. |
| E2 | Stay-in is always invoked with `skipIfAlreadyRecorded = true` and `backfillLookbackDays = STAY_IN_ATTENDANCE_LOOKBACK_DAYS` (15). |
| E3 | Payroll is always invoked with `skipIfAlreadyRecorded = true` and `triggerSource = 'scheduler'`. |
| E4 | This function is called by the internal automation routes (one route per domain) which are triggered by the backup-scheduler sidecar. |

---

## F — Internal Route Utilities

| #  | Rule |
|----|------|
| F1 | `requireInternalToken()` validates the `x-internal-token` header against `INTERNAL_JOB_TOKEN`. Returns 500 if the env var is empty, 401 if the token is missing or mismatched, or `null` if valid. |
| F2 | `shouldPersistScheduledRun()` returns `false` for execution results with `skipReason` of `'disabled'`, `'already-recorded-run'`, or `'no-due-cutoff'`. All other results (including errors) are persisted to the run history. |
| F3 | `summarizeScheduledResults()` counts `executed` (results that should be persisted), `succeeded`, `skipped`, and `failed` across an array of results. |

---

## G — Run History

| #  | Rule |
|----|------|
| G1 | Each automation execution can be recorded via `recordEmployeeAutomationRun()`. The record captures `automationType`, `triggerSource`, `status`, `periodKey`, `targetDate`, `payrollPeriodStart`, `payrollPeriodEnd`, `message`, `processed`, `inserted`, `skipped`, optional actor info, and freeform `metadata`. |
| G2 | Run history is listed via `listEmployeeAutomationRuns()` ordered by `createdAt DESC` with a default limit of 20. |
| G3 | `findRecordedAutomationRunForPeriod()` looks up the most recent run for a given `automationType` and `periodKey`. |
| G4 | `hasRecordedAutomationRunForPeriod()` is a boolean convenience wrapper around `findRecordedAutomationRunForPeriod()`. |
| G5 | The overview endpoint (`readEmployeeAutomationOverview`) returns both current settings and recent run history in parallel. |
| G6 | If the run-history schema is missing, `listEmployeeAutomationRuns()` returns an empty array instead of throwing. `findRecordedAutomationRunForPeriod()` returns `null` (treats period as not yet recorded). `recordEmployeeAutomationRun()` throws a `SchemaMismatchError`. |

---

## H — Settings Validation Summary

| #  | Rule |
|----|------|
| H1 | Time: must match `HH:mm` 24-hour regex. |
| H2 | Timezone: non-empty after trim. |
| H3 | Grace minutes: finite, floored, capped at 120. |
| H4 | Cutoff days: array of integers 1–31, deduplicated, sorted. |
| H5 | Cross-field: cannot enable payroll with empty cutoff days. |
| H6 | Schema mismatch: graceful degradation on read (defaults), hard error on write. |

---

## Notes

- Domain-specific behavior that differs between clothing, general-merchandise, and trucking at the operator UI level should be documented in the corresponding domain doc.
- The clothing domain's `stayInAutoPresence.ts` uses inline Prisma calls; trucking uses the shared `runSharedStayInAutoPresence()` runner. GM uses inline calls similar to clothing. A future refactor may migrate all domains to the shared runner pattern.