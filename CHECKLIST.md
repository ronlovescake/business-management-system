# Refactor Checklist

Last updated: 2026-03-17 (Audit Cycle 2 — full repo re-audit)

This file is the canonical tracker for repo-wide refactor work.

## Refactor Contract

These rules apply to every future refactor in this repository.

- Shared code must stay data-source agnostic.
- Each business must keep its own API route namespace.
- Each business must keep its own Prisma model and delegate bindings.
- No shared code may hard-code a business path such as `/api/trucking` or `/api/general-merchandise`.
- Query keys must include domain context where relevant.
- Accounting and inventory logic must not be merged blindly.
- High-risk accounting refactors must be protected by per-business tests before consolidation.
- A refactor is not complete until lint and typecheck pass.
- A refactor is not complete until impacted business flows are validated for domain isolation.

## Audit Cycle 2 — Results (2026-03-17)

### Scope Coverage

| Path                                                              | Status  |
| ----------------------------------------------------------------- | ------- |
| `src/modules/clothing/**`                                         | covered |
| `src/modules/clothing/ledger/**`                                  | covered |
| `src/modules/clothing/employees/**`                               | covered |
| `src/modules/general-merchandise/**`                              | covered |
| `src/modules/trucking/**`                                         | covered |
| `src/modules/household/**`                                        | covered |
| `src/app/clothing/**`                                             | covered |
| `src/app/general-merchandise/**`                                  | covered |
| `src/app/trucking/**`                                             | covered |
| `src/app/personal/**`                                             | covered |
| `src/app/api/**`                                                  | covered |
| `src/lib/**`, `src/components/**`, `src/core/**`, `src/shared/**` | covered |
| `tests/**`                                                        | covered |

### Large-File Distribution

| Threshold     | Count |
| ------------- | ----- |
| >= 500 lines  | 134   |
| >= 800 lines  | 50    |
| >= 1000 lines | 20    |
| >= 1200 lines | 8     |
| >= 1500 lines | 2     |

**Top 15 largest files:**

| Lines | File                                                                           |
| ----- | ------------------------------------------------------------------------------ |
| 1523  | `src/components/ui/HandsontableGrid.tsx`                                       |
| 1324  | `src/components/navigation/HeaderQuickActions.tsx`                             |
| 1317  | `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx`     |
| 1284  | `src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts`            |
| 1246  | `src/modules/transactions/api/service.ts`                                      |
| 1208  | `src/lib/openapi/spec.ts`                                                      |
| 1201  | `src/app/clothing/employees/attendance/hooks/useAttendance.ts`                 |
| 1196  | `src/app/clothing/employees/schedules/hooks/useSchedules.ts`                   |
| 1186  | `src/modules/clothing/employees/payroll/hooks/usePayroll.ts`                   |
| 1183  | `src/app/api/backup/route.ts`                                                  |
| 1178  | `src/lib/accounting/general-merchandise/inventory-cogs.ts`                     |
| 1143  | `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts` |
| 1079  | `src/app/clothing/employees/team/hooks/useEmployeeDetail.ts`                   |
| 1051  | `src/app/api/restore/route.ts`                                                 |

### Duplication Metrics

| Family                         | Clothing            | GM                   | Trucking                | Diff Lines  | Clone Ratio | Status                    |
| ------------------------------ | ------------------- | -------------------- | ----------------------- | ----------- | ----------- | ------------------------- |
| `useEmployeeDetail` hook       | 1079 lines (source) | uses clothing source | 47 lines (thin wrapper) | shared core | n/a         | ✅ Trucking now delegates |
| `deductions.ts`                | 867 lines           | 889 lines (own copy) | 875 lines (own copy)    | 112–176     | **90–94%**  | ⚠️ Only utils extracted   |
| Accounting balance-sheet route | 949 lines           | 998 lines            | N/A                     | 271         | 86%         | ❌ Separate copies        |
| Accounting payroll route       | 667 lines           | 756 lines            | N/A                     | 147         | 90%         | ❌ Separate copies        |
| Accounting journal route       | 758 lines           | 755 lines            | N/A                     | 317         | 79%         | ❌ Separate copies        |
| Accounting ledger route        | 837 lines           | 878 lines            | N/A                     | 561         | 67%         | ⚠️ More diverged          |
| `inventory-cogs.ts`            | 741 lines           | 1178 lines           | N/A                     | 759         | 60%         | ❌ Significantly diverged |
| `check-stock` route            | 1018 lines          | 632 lines            | N/A                     | 550         | 67%         | ❌ Separate copies        |
| Accounting `data-fetchers.ts`  | 326 lines           | 452 lines            | N/A                     | 266         | 66%         | ❌ Separate copies        |

**Employee-level types (AttendanceRecord, LeaveRequest, CashAdvance, Schedule):**
Identical between clothing and trucking — zero diff. Consolidation is safe.

**Cross-family parity map:**

| Hook/Feature          | Clothing             | GM                           | Trucking              |
| --------------------- | -------------------- | ---------------------------- | --------------------- |
| Leave tracker hook    | ✅ shared source     | delegates to clothing        | ✅ thin wrapper       |
| Attendance hook       | ✅ shared source     | delegates to clothing        | ✅ thin wrapper       |
| Schedules hook        | ✅ shared source     | delegates to clothing        | ✅ thin wrapper       |
| Cash advance hook     | ✅ shared source     | delegates to clothing        | ✅ thin wrapper       |
| Team hook             | ✅ shared source     | delegates to clothing source | ✅ thin wrapper       |
| Employee detail hook  | ✅ shared source     | delegates to clothing source | ✅ thin wrapper       |
| Payroll hook          | ✅ via shared config | ✅ via shared config         | ✅ via shared config  |
| Deductions engine     | shared utils only    | 90% clone of clothing        | 90% clone of clothing |
| Thirteenth-month hook | ✅ via shared config | ✅ via shared config         | ✅ via shared config  |

### Risk Markers

| Marker                                                               | Files | Occurrences |
| -------------------------------------------------------------------- | ----- | ----------- |
| `as unknown as`                                                      | 0     | 0           |
| `TODO`                                                               | 0     | 0           |
| `FIXME`                                                              | 0     | 0           |
| `@ts-expect-error` / `@ts-ignore` / `eslint-disable no-explicit-any` | 1     | 1           |

The single `@ts-expect-error` is in `src/app/api/docs/page.tsx:28` and is legitimate — swagger-ui-react does not ship React 18-compatible types.

### API Test Coverage Gaps

**GM API routes — partial coverage, but broader than the initial audit claimed**:

Covered: `cash-advances`, `thirteenth-month-pay`, `attendance`, `attendance/apply-leave`, `employees`, `leave-requests`, `schedules`, `transactions`, `transactions/payments/bulk`, `payroll`, `payroll/generate`, `payroll/cleanup`, `payroll/generate-payslips`, `payroll/sync-lwop`, `accounting/balance-sheet`, `accounting/ledger`, `accounting/journal`, `accounting/manual-journal`, `accounting/opening-balance`, `accounting/profit-loss`, `accounting/profit-loss/details`

Still untested or lightly covered (high priority): `employee-automation-settings`, `expenses`, `products`, `customers` (full CRUD), `shipments`

**Trucking API routes — partial test coverage** (6 of 30+ routes have tests):

Covered: `attendance`, `cash-advances`, `employees` (basic), `employees/salary-history`, `schedules`, `thirteenth-month-pay`

Untested: `analytics/profitability`, `attendance/apply-leave`, `employee-automation-settings`, `employees/[id]`, `expenses`, `fleet-vehicles`, `invoices`, `leave-requests`, `payments`, `payroll` (full flow), `trips`, `vehicle-assignments`, `thirteenth-month-pay/[recordId]/status`

---

## Current Status

### Completed

- [x] Repo-wide refactor audit completed (Cycle 1).
- [x] Cross-family parity map corrected and normalized to `shared`, `partial`, and `separate`.
- [x] Prioritized action matrix created.
- [x] P1/P2/P3 implementation backlog created.
- [x] Refactor safety rules documented to protect business separation.
- [x] P1-1 payroll hook consolidation completed.
- [x] P1-1 slice: trucking payroll hook aligned to shared summary, query-key, and route-resolution pattern.
- [x] P1-1 slice: shared payroll CRUD mutation and handler wrapper extracted for clothing and trucking.
- [x] P1-1 slice: shared payroll generation and payslip action flow extracted for clothing and trucking.
- [x] P1-1 slice: shared payroll paid-status dialog flow and thirteenth-month record-id resolution extracted for clothing and trucking.
- [x] P1-1 validation: broader payroll flows passed targeted test coverage.
- [x] P1-1 decision: thirteenth-month sync endpoint wrappers stay per-business permanently because route namespaces and service bindings are business-specific.
- [x] P1-6 employee detail consolidation completed.
- [x] P1-6 slice: trucking employee detail now delegates to the clothing/shared core with trucking-specific error notifications preserved in a thin wrapper.
- [x] P1-6 validation: employee-detail refactor passed typecheck, focused lint, and editor diagnostics.
- [x] P1-7 deductions engine second pass completed.
- [x] P1-7 slice: clothing, GM, and trucking deduction-sync entrypoints now share generic orchestration helpers in `deductionsShared.ts` while keeping per-business Prisma-bound builders and adjusters local.
- [x] P1-7 validation: `npm run typecheck`, `npm run lint`, `src/lib/payroll/__tests__/deductions.test.ts`, and `tests/unit/payroll/PayrollService.comprehensive.test.ts` passed.
- [x] P2-9 `BackupRestoreTab.tsx` split completed.
- [x] P2-9 slice: extracted `BackupSection.tsx`, `RestoreSection.tsx`, and `TablePreviewSection.tsx` so `BackupRestoreTab.tsx` now primarily owns shared fetch, preview, and restore orchestration.
- [x] P2-9 validation: `npm run lint`, `npm run typecheck`, `tests/unit/api/backup-restore.api.test.ts`, and backup/restore hardening suites passed.
- [x] P3-6 accounting payroll route consolidation completed.
- [x] P3-6 slice: clothing and GM payroll routes now delegate GET/POST/PUT/DELETE orchestration to `src/modules/shared/ledger/payroll/api/routeAdapter.ts` while keeping route namespaces, Prisma models, deduction sync, and expense-sync bindings business-specific.
- [x] P3-6 validation: `npm run lint`, `npm run typecheck`, `tests/unit/api/payroll.api.test.ts`, and `tests/unit/api/general-merchandise.payroll.api.test.ts` passed.
- [x] P3-7 accounting `data-fetchers.ts` import-style normalization completed.
- [x] P3-7 slice: clothing and GM accounting fetchers now use the same absolute `@/lib/accounting/*` import style with no behavior change.
- [x] P3-8 `HeaderQuickActions.tsx` split completed.
- [x] P3-8 slice: extracted `AppsMenu`, `MessagesMenu`, `NotificationsMenu`, `SettingsButton`, `ProfileMenu`, `ChatWindows`, and `useChatWindows` under `src/components/navigation/header-quick-actions/` so the parent component now focuses on orchestration only.
- [x] P3-8 validation: `npm run lint` and `npm run typecheck` passed.
- [x] P3-9 `HandsontableGrid.tsx` split completed.
- [x] P3-9 slice: extracted `useHandsontableGridController`, `HandsontableGridToolbar`, `HandsontableGridTable`, `HandsontableGridFooter`, and shared grid types under `src/components/ui/handsontable-grid/` while keeping `HandsontableGrid.tsx` as the public integration wrapper.
- [x] P3-9 validation: `npm run lint`, `npm run typecheck`, `npx playwright test tests/e2e/example.spec.ts --project=chromium`, and `npx vitest run tests/unit/transactions/useTransactionOperations.test.tsx` passed.

### In Progress

- P2-7 Expand trucking API test coverage — 30+ routes with only 6 covered

### Pending (Audit Cycle 2)

- P2-6 Expand GM API test coverage — most core employee/operations routes are now covered; remaining gaps are secondary GM routes
- P2-8 Extract sub-hooks from large shared hooks (`useLeaveTracker`, `useAttendance`, `useSchedules`) — completed

## Canonical Risk Boundaries

### Safe To Share

- UI formatting helpers
- Filter and search logic
- Query-key builders with explicit domain input
- Hook orchestration with injected domain config
- Form validation logic
- CSV import and export utilities
- Route-handler scaffolding with explicit per-business bindings
- Service and repository base classes with explicit model injection

### Keep Per-Business

- Prisma model bindings
- API route prefixes
- Domain-specific repository wiring
- Accounting data sources
- Business-specific accounting rules
- Ownership-defining database filters
- Per-business accounting and inventory report behavior unless proven equivalent

## Execution Queue

### P1

- [x] P1-1 Finish payroll hook consolidation
  - [x] Move shared summary derivation into shared utilities or base layer
  - [x] Align clothing and trucking query-key behavior
  - [x] Keep trucking route resolution domain-explicit while using shared path construction
  - [x] Extract shared payroll domain config for clothing and trucking wrappers
  - [x] Extract shared payroll CRUD mutation and basic action wrapper logic
  - [x] Extract shared payroll generation prompt, cleanup/retry, refresh, and payslip action flow
  - [x] Extract shared payroll mark-as-paid dialog flow and thirteenth-month record-id resolution
  - [x] Validate broader payroll flows after full P1-1 completion
  - [x] Keep thirteenth-month sync endpoint wrappers separate as a permanent business boundary

- [x] P1-2 Unify payroll deduction engine
  - [x] Start delegate-seam cleanup by removing the duplicate trucking deduction update helper
  - [x] Extract one shared deduction calculation core
  - [x] Inject per-business model or delegate bindings
  - [x] Keep clothing, GM, and trucking entrypoints thin
  - [x] Compare sample outputs before and after

- [x] P1-3 Consolidate deduction update helpers
  - [x] Replace duplicate helper files with one shared implementation
  - [x] Update imports in affected domains

- [x] P1-4 Build shared base for leave tracker
  - [x] Extract shared filter, CRUD, CSV, and schedule-index behavior
  - [x] Keep domain route resolution explicit

- [x] P1-5 Build shared base for attendance
  - [x] Extract shared query, mutation, and auto-record behavior
  - [x] Keep domain route resolution explicit

- [x] P1-6 Share `useEmployeeDetail` between clothing and trucking
  - [x] Verify employee-related types can be shared structurally across clothing and trucking
  - [x] Consolidate trucking `useEmployeeDetail.ts` as a thin wrapper around the shared clothing core with trucking `apiBasePath`
  - [x] Preserve trucking-specific duplicate/update notifications via injected error handling
  - [x] Validate broader employee-detail flows: `npm run typecheck`, focused lint, editor diagnostics

- [x] P1-7 Deepen deductions engine extraction (second pass)
  - [x] Map the exact per-business difference in each of the three `sync*` functions — currently only Prisma delegate names differ
  - [x] Extract delegate-injected `syncPayrollLwop`, `syncPayrollAttendanceDeductions`, `syncPayrollDeductions` into `deductionsShared.ts` using the same delegate-seam pattern as P1-2
  - [x] Keep clothing, GM, and trucking entrypoints as thin delegates that bind their Prisma models and call shared core
  - [x] Validate: `npm run typecheck`, `npm run lint`, `src/lib/payroll/__tests__/deductions.test.ts`, `tests/unit/payroll/PayrollService.comprehensive.test.ts`

### P2

- [x] P2-1 Build shared base for schedules
- [x] P2-2 Build shared base for team hook
- [x] P2-3 Build shared base for cash advance hook
- [x] P2-4 Expand trucking API behavior tests
- [x] P2-5 Standardize adapter usage for already-shared accounting routes

- [ ] P2-6 Expand GM API test coverage (core routes covered; remaining GM routes are employee-automation-settings, expenses, products, customers, shipments)
  - [x] Add GM accounting route coverage for `balance-sheet`, `ledger`, `journal`, `profit-loss`
  - [x] Add GM accounting route coverage for `manual-journal`, `opening-balance`
  - [x] Add `general-merchandise.attendance.api.test.ts` + `apply-leave`
  - [x] Add `general-merchandise.employees.api.test.ts`
  - [x] Add `general-merchandise.leave-requests.api.test.ts`
  - [x] Add `general-merchandise.payroll.api.test.ts` (generate, cleanup, sync-lwop, payslips)
  - [x] Add `general-merchandise.schedules.api.test.ts`
  - [x] Add `general-merchandise.transactions.api.test.ts`
  - [x] Validate: `npm run test:unit`

- [ ] P2-7 Expand trucking API test coverage (partial — 6 of 30+ routes tested)
  - [ ] Add `trucking.attendance-apply-leave.api.test.ts`
  - [ ] Add `trucking.leave-requests.api.test.ts`
  - [ ] Add `trucking.payroll.api.test.ts` (generate, cleanup, sync-lwop, payslips)
  - [ ] Add `trucking.expenses.api.test.ts`
  - [ ] Add `trucking.fleet-vehicles.api.test.ts`
  - [ ] Add `trucking.invoices.api.test.ts`
  - [ ] Add `trucking.trips.api.test.ts`
  - [ ] Add `trucking.vehicle-assignments.api.test.ts`
  - [ ] Validate: `npm run test:unit`

- [x] P2-8 Extract sub-hooks from large shared hooks
  - [x] `useLeaveTracker.ts` (1284 lines) — extracted query/data layer, mutation layer, CSV helpers, and form state into composable sub-hooks
  - [x] `useAttendance.ts` (1201 lines) — extracted auto-record payload generation, bulk CSV helpers, and filter/stats helpers
  - [x] `useSchedules.ts` (1196 lines) — extracted recurring-rule generation plus CSV bulk-action logic alongside the earlier time/list/form/leave seams
  - [x] `useSchedules.ts` first seam: extracted shared time-range, duration, and overlap helpers into `scheduleTimeUtils.ts`
  - [x] `useSchedules.ts` second seam: extracted shared filtering, sorting, weekly breakdown, and status-count helpers into `scheduleListUtils.ts`
  - [x] `useSchedules.ts` third seam: extracted schedule form-state/reset/populate orchestration into `useScheduleFormState.ts`
  - [x] `useSchedules.ts` fourth seam: extracted leave-date matching into `scheduleLeaveUtils.ts`
  - [x] `useSchedules.ts` fifth seam: extracted recurring-rule generation into `scheduleBulkUtils.ts` and CSV import/export helpers into `scheduleCsvUtils.ts`
  - [x] Validate unchanged behavior: existing clothing + trucking schedule/leave/attendance tests

- [x] P2-9 Split `BackupRestoreTab.tsx` (1317 lines) into sub-components
  - [x] Extract `BackupSection` for backup creation controls, schedule cards, auto-backup controls, and backup list
  - [x] Extract `RestoreSection` for restore-entry backup list flow
  - [x] Extract `TablePreviewSection` for table sample viewing
  - [x] Validate: `npm run typecheck`, `npm run lint`, `tests/unit/api/backup-restore.api.test.ts`, `tests/hardening/backup-restore.security.test.ts`, `tests/hardening/backup-restore.atomic.test.ts`, `tests/hardening/backup-restore.workflow.test.ts`, `tests/hardening/backup-restore.integrity.test.ts`

### P3

- [x] P3-1 Build shared base for thirteenth-month-pay hook
- [x] P3-2 Evaluate employee-loans for shared abstraction
- [x] P3-3 Add GM API behavior tests beyond parity checks
- [x] P3-4 Remove or relocate route factory example files
- [x] P3-5 Split large non-critical monoliths after higher-ROI duplication work stabilizes

- [x] P3-6 Consolidate accounting payroll routes (clothing vs GM — 90% similar, 147 diff lines)
  - [x] Map exact per-business differences (delegated Prisma models, route namespace)
  - [x] Extract shared route handler scaffolding that accepts per-business service injection
  - [x] Validate: `npm run typecheck`, `npm run lint`, `tests/unit/api/payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll.api.test.ts`

- [x] P3-7 Standardize `data-fetchers.ts` import style across `lib/accounting/`
  - [x] GM version uses absolute paths; clothing uses relative — align to one style
  - [x] No behavior change; purely a maintenance improvement

- [x] P3-8 Split `HeaderQuickActions.tsx` (1324 lines) into named action-group sub-components
  - [x] Identify logical sections (search, notifications, profile, settings) and extract
  - [x] Validate no visual or functional regression

- [x] P3-9 Split `HandsontableGrid.tsx` (1523 lines) into focused areas
  - [x] Extract cell-selection/navigation logic into a custom hook
  - [x] Extract keyboard shortcut map into a separate constants/handler file
  - [x] Keep main `HandsontableGrid` as the integration point

## Do Not Merge Blindly

- `inventory-cogs.ts`
- `balance-sheet` routes
- `ledger` routes
- `check-stock` routes
- employee detail hook

## Validation Checklist

Run this for each completed implementation ticket.

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] Run targeted unit tests for affected feature areas
- [x] Run broader payroll-focused unit tests before closing `P1-1`
- [x] Confirm each business still uses only its own API namespace
- [x] Confirm each business still uses only its own model bindings and data sources
- [x] Confirm no cross-business accounting data is exposed or reused

## Current Slice Notes

- [x] Current active slice: `P3-8` header quick actions split
- [x] `HeaderQuickActions.tsx` now delegates the app launcher, messages popover, notification/settings/profile actions, and floating chat windows to focused components in `src/components/navigation/header-quick-actions/` while keeping routing/session/query orchestration in the parent
- [x] Header quick actions validation passed: `npm run lint`, `npm run typecheck`
- [x] Clothing and GM payroll routes now share `src/modules/shared/ledger/payroll/api/routeAdapter.ts` for CRUD orchestration while preserving per-business Prisma bindings, route namespaces, and payroll-to-expense sync delegates
- [x] Payroll route consolidation validation passed: `npm run lint`, `npm run typecheck`, `tests/unit/api/payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll.api.test.ts`
- [x] Clothing and GM accounting `data-fetchers.ts` now use the same absolute `@/lib/accounting/*` import style with no behavior change
- [x] `BackupRestoreTab.tsx` now delegates tab-panel rendering to `BackupSection.tsx`, `RestoreSection.tsx`, and `TablePreviewSection.tsx` while keeping shared preview/restore orchestration in the parent
- [x] Backup/restore tab split validation passed: `npm run lint`, `npm run typecheck`, `tests/unit/api/backup-restore.api.test.ts`, `tests/hardening/backup-restore.security.test.ts`, `tests/hardening/backup-restore.atomic.test.ts`, `tests/hardening/backup-restore.workflow.test.ts`, `tests/hardening/backup-restore.integrity.test.ts`
- [x] `useSchedules.ts` now delegates pure time-range, duration, and overlap calculations to `scheduleTimeUtils.ts`
- [x] `useSchedules.ts` now delegates filtering, sorting, weekly breakdown, and status aggregation to `scheduleListUtils.ts`
- [x] `useSchedules.ts` now delegates form-state reset/edit population to `useScheduleFormState.ts`
- [x] `useSchedules.ts` now delegates leave-date matching to `scheduleLeaveUtils.ts`
- [x] `useLeaveTracker.ts` now delegates form state to `useLeaveTrackerFormState.ts`, data/query loading to `useLeaveTrackerQueries.ts`, mutations to `useLeaveTrackerMutations.ts`, and CSV import/export to `leaveTrackerCsvUtils.ts`
- [x] `useAttendance.ts` now delegates filter/stats derivation to `useAttendanceFiltering.ts`, bulk CSV handling to `attendanceCsvUtils.ts`, and auto-record payload generation to `attendanceAutoRecordUtils.ts`
- [x] `useSchedules.ts` now delegates recurring-rule generation to `scheduleBulkUtils.ts` and CSV import/export to `scheduleCsvUtils.ts`
- [x] P2-8 validation passed for the completed shared-hook decomposition: `npm run lint`, `npm run typecheck`, `src/app/clothing/employees/leave-tracker/hooks/__tests__/useLeaveTracker.test.ts`, `src/app/trucking/employees/leave-tracker/hooks/__tests__/useLeaveTracker.test.ts`, `src/app/clothing/employees/schedules/hooks/__tests__/useSchedules.test.ts`, `src/app/trucking/employees/schedules/hooks/__tests__/useSchedules.test.ts`, `tests/unit/api/attendance.api.test.ts`, `tests/unit/api/attendance-apply-leave.api.test.ts`, and `tests/unit/api/trucking.attendance.api.test.ts` (`288` tests passed)
- [x] Focused tests passed: `tests/unit/api/payroll.api.test.ts`, `tests/unit/api/payroll-generate.api.test.ts`
- [x] Broader payroll validation passed: `tests/unit/payroll/PayrollService.comprehensive.test.ts`, `tests/unit/api/payroll-generate-payslips.api.test.ts`, `tests/unit/api/payroll-sync-lwop.api.test.ts`, `tests/unit/thirteenth-month-pay/ThirteenthMonthPayService.comprehensive.test.ts`
- [x] Trucking payroll hook now uses explicit domain-aware cache keys and shared payroll summary utilities
- [x] Clothing and trucking payroll hooks now share `usePayrollDomainConfig`
- [x] Clothing and trucking payroll hooks now share `usePayrollCrudActions`
- [x] Clothing and trucking payroll hooks now share payroll generation and payslip action orchestration
- [x] Clothing and trucking payroll hooks now share single-record paid-status orchestration and thirteenth-month record-id resolution
- [x] Remaining thirteenth-month sync endpoint wrappers intentionally stay separate because they terminate in distinct business routes and services
- [x] P1-2 started with deduction helper seam cleanup for trucking
- [x] Clothing, GM, and trucking payroll deduction entrypoints now share a delegate-driven non-cash-advance adjustment core
- [x] Payroll deduction refactor validation passed: `npm run typecheck`, `src/lib/payroll/__tests__/deductions.test.ts`, `tests/unit/payroll/PayrollService.comprehensive.test.ts`, `tests/unit/api/payroll.api.test.ts`
- [x] P1-7 extracted shared deduction-sync orchestration helpers into `deductionsShared.ts` for clothing, GM, and trucking `syncPayrollLwop`, `syncPayrollAttendanceDeductions`, and `syncPayrollDeductions`
- [x] Before-vs-after sample output comparison matched for representative clothing, GM, and trucking deduction scenarios
- [x] Trucking leave tracker now uses the shared domain-aware leave-tracker hook with explicit `/api/trucking` routing
- [x] Leave-tracker refactor validation passed: `npm run typecheck`, `npm run lint`
- [x] Trucking attendance now uses the shared domain-aware attendance page and hook with explicit `/api/trucking` routing
- [x] Attendance refactor validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/attendance.api.test.ts`, `tests/unit/api/attendance-apply-leave.api.test.ts`
- [x] Trucking schedules now use the shared domain-aware schedules page and hook with explicit `/api/trucking` routing
- [x] Schedules refactor validation passed: `npm run typecheck`, `npm run lint`, `src/app/clothing/employees/schedules/hooks/__tests__/useSchedules.test.ts`, `src/app/trucking/employees/schedules/hooks/__tests__/useSchedules.test.ts`
- [x] Trucking team hook now uses the shared domain-aware team hook with explicit `/api/trucking` routing
- [x] Trucking cash-advance hook now uses the shared domain-aware cash-advance hook with explicit `/api/trucking` routing and session-derived approver names
- [x] Trucking thirteenth-month-pay hook now uses the shared domain-aware thirteenth-month-pay hook with explicit `/api/trucking` routing
- [x] Team and cash-advance refactor validation passed: `npm run typecheck`, `npm run lint`, `src/app/clothing/employees/team/hooks/__tests__/useTeam.test.ts`, `src/app/trucking/employees/team/hooks/__tests__/useTeam.test.ts`, `tests/unit/api/cash-advances.api.test.ts`, `tests/unit/api/trucking.cash-advances.api.test.ts`
- [x] Added trucking-specific thirteenth-month API coverage: `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`
- [x] Thirteenth-month refactor validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/thirteenth-month-pay.api.test.ts`, `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`
- [x] Added trucking-specific employees API coverage: `tests/unit/api/trucking.employees.api.test.ts`
- [x] Trucking API coverage validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/trucking.employees.api.test.ts`, `tests/unit/api/trucking.cash-advances.api.test.ts`, `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`
- [x] Removed unused route factory example files from clothing and trucking leave-requests modules
- [x] Added trucking-specific attendance and schedules API coverage: `tests/unit/api/trucking.attendance.api.test.ts`, `tests/unit/api/trucking.schedules.api.test.ts`
- [x] Clothing accounting manual-journal and opening-balance routes now use the same static deferred-handler adapter pattern as general merchandise
- [x] Trucking employee-loans now reuse the clothing implementation via thin wrappers and shared types/components
- [x] Extracted pure employee-loan formatting/import helpers into `employeeLoanUtils.ts` to reduce hook size and isolate pure logic
- [x] Added general-merchandise API coverage for cash advances and thirteenth-month pay: `tests/unit/api/general-merchandise.cash-advances.api.test.ts`, `tests/unit/api/general-merchandise.thirteenth-month-pay.api.test.ts`
- [x] Added general-merchandise accounting route coverage for manual journal and opening balance: `src/app/api/general-merchandise/accounting/manual-journal/__tests__/route.test.ts`, `src/app/api/general-merchandise/accounting/opening-balance/__tests__/route.test.ts`
- [x] Added general-merchandise attendance and employees API coverage: `tests/unit/api/general-merchandise.attendance.api.test.ts`, `tests/unit/api/general-merchandise.employees.api.test.ts`
- [x] Added general-merchandise leave-request and schedule API coverage: `tests/unit/api/general-merchandise.leave-requests.api.test.ts`, `tests/unit/api/general-merchandise.schedules.api.test.ts`
- [x] Added general-merchandise transactions API coverage: `tests/unit/api/general-merchandise.transactions.api.test.ts`
- [x] Added general-merchandise payroll API coverage: `tests/unit/api/general-merchandise.payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate.api.test.ts`, `tests/unit/api/general-merchandise.payroll-cleanup.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate-payslips.api.test.ts`, `tests/unit/api/general-merchandise.payroll-sync-lwop.api.test.ts`
- [x] Broader unit validation passed after GM API expansion: `npm run test:unit` (155 files, 2026 tests)
- [x] Added general-merchandise payroll API coverage: `tests/unit/api/general-merchandise.payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate.api.test.ts`, `tests/unit/api/general-merchandise.payroll-cleanup.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate-payslips.api.test.ts`, `tests/unit/api/general-merchandise.payroll-sync-lwop.api.test.ts`
- [x] Final validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/trucking.attendance.api.test.ts`, `tests/unit/api/trucking.schedules.api.test.ts`, `tests/unit/api/trucking.employees.api.test.ts`, `tests/unit/api/trucking.cash-advances.api.test.ts`, `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`, `tests/unit/api/general-merchandise.cash-advances.api.test.ts`, `tests/unit/api/general-merchandise.thirteenth-month-pay.api.test.ts`
- [x] Next step narrowed: remaining GM API gaps are `employee-automation-settings`, `expenses`, `products`, `customers`, and `shipments`; the remaining non-trucking backlog is now primarily P2-8/P2-9/P3-6/P3-7/P3-8/P3-9.

## Notes

- This checklist tracks both planning work already completed and implementation work still pending.
- Only real execution work should use unchecked checkboxes. Reference rules and guardrails should remain plain bullets.
- Mark items in `Completed`, `In Progress`, and `Pending` as work advances.
- For accounting and inventory refactors, do not change behavior until domain differences are explicitly mapped and tested.
