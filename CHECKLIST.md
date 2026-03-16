# Refactor Checklist

Last updated: 2026-03-17

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

## Current Status

### Completed

- [x] Repo-wide refactor audit completed.
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

### In Progress

- None.

### Pending

- None within the current checklist scope.

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

### P2

- [x] P2-1 Build shared base for schedules
- [x] P2-2 Build shared base for team hook
- [x] P2-3 Build shared base for cash advance hook
- [x] P2-4 Expand trucking API behavior tests
- [x] P2-5 Standardize adapter usage for already-shared accounting routes

### P3

- [x] P3-1 Build shared base for thirteenth-month-pay hook
- [x] P3-2 Evaluate employee-loans for shared abstraction
- [x] P3-3 Add GM API behavior tests beyond parity checks
- [x] P3-4 Remove or relocate route factory example files
- [x] P3-5 Split large non-critical monoliths after higher-ROI duplication work stabilizes

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

- [x] Current active slice: `P1-1` payroll hook consolidation
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
- [x] Final validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/trucking.attendance.api.test.ts`, `tests/unit/api/trucking.schedules.api.test.ts`, `tests/unit/api/trucking.employees.api.test.ts`, `tests/unit/api/trucking.cash-advances.api.test.ts`, `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`, `tests/unit/api/general-merchandise.cash-advances.api.test.ts`, `tests/unit/api/general-merchandise.thirteenth-month-pay.api.test.ts`
- [x] Next step: none. Current checklist scope is complete.

## Notes

- This checklist tracks both planning work already completed and implementation work still pending.
- Only real execution work should use unchecked checkboxes. Reference rules and guardrails should remain plain bullets.
- Mark items in `Completed`, `In Progress`, and `Pending` as work advances.
- For accounting and inventory refactors, do not change behavior until domain differences are explicitly mapped and tested.
