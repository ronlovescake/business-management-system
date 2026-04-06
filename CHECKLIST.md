# Refactor Checklist

Last updated: 2026-04-06 (completed large-surface controller extractions, reconciled Audit Cycle 3 status, recorded defer decisions, landed soft-delete/schema groundwork, removed dead code, extracted shared schedule/attendance helpers, standardized the employee-automation, expense, attendance/apply-leave, attendance, schedules, leave-requests, and thirteenth-month-pay API route families, and converted the remaining route work into a continuous verified backlog)

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
- A Clothing Operations, Accounting, or Employees workflow change is not complete until the affected docs under `docs/business-logic/clothing/` are updated in the same work item.

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

Covered: `cash-advances`, `thirteenth-month-pay`, `attendance`, `attendance/apply-leave`, `employees`, `leave-requests`, `schedules`, `transactions`, `transactions/payments/bulk`, `payroll`, `payroll/generate`, `payroll/cleanup`, `payroll/generate-payslips`, `payroll/sync-lwop`, `employee-automation-settings`, `expenses`, `products`, `products/[id]`, `customers`, `customers/[id]`, `shipments`, `shipments/[id]`, `accounting/balance-sheet`, `accounting/ledger`, `accounting/journal`, `accounting/manual-journal`, `accounting/opening-balance`, `accounting/profit-loss`, `accounting/profit-loss/details`

Remaining GM route coverage gaps are now secondary subroutes rather than the base employee and operations families.

**Trucking API routes — materially improved, with remaining secondary gaps**:

Covered: `attendance`, `attendance/apply-leave`, `cash-advances`, `employees` (basic), `employees/salary-history`, `expenses`, `fleet-vehicles`, `invoices`, `leave-requests`, `payroll` subflows (`generate`, `cleanup`, `sync-lwop`, `generate-payslips`), `schedules`, `thirteenth-month-pay`, `trips`, `vehicle-assignments`

Remaining lower-coverage trucking routes: `analytics/profitability`, `employee-automation-settings`, `employees/[id]`, `payments`, `thirteenth-month-pay/[recordId]/status`, plus broader integration and browser workflow depth

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
- [x] P2-6 GM API test coverage expansion completed.
- [x] P2-6 slice: added dedicated GM route tests for `employee-automation-settings`, `expenses`, `products` + `[id]`, `customers` + `[id]`, and `shipments` + `[id]`, closing the remaining base-route GM coverage gap from Audit Cycle 2.
- [x] P2-6 validation: targeted GM API Vitest coverage passed, plus `npm run lint`, `npm run typecheck`, and `npm run test:unit` passed.
- [x] P2-7 trucking API test coverage expansion completed.
- [x] P2-7 slice: added dedicated trucking route tests for `attendance/apply-leave`, `leave-requests`, `expenses`, `fleet-vehicles`, `invoices`, `trips`, `vehicle-assignments`, and payroll subflows (`generate`, `cleanup`, `sync-lwop`, `generate-payslips`).
- [x] P2-7 validation: targeted trucking API Vitest coverage passed (`11` files / `34` tests), plus focused lint and `npm run typecheck` passed.
- [x] P2 users/payments/payroll hotspot decomposition completed.
- [x] P2 hotspot slice: `src/app/clothing/users/page.tsx`, `src/modules/clothing/operations/transactions/components/TransactionPaymentsModal.tsx`, and `src/modules/clothing/employees/payroll/hooks/usePayroll.ts` now delegate page logic, modal workflow state, and payroll orchestration into focused local hooks/components/shared flows.
- [x] P2 hotspot validation: focused lint and `npm run typecheck` passed after the extractions.
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
- [x] P3 global-settings JS cleanup completed.
- [x] P3 slice: removed stale duplicate artifacts `src/modules/settings/global/components/GlobalSettingsPage.js`, `src/modules/settings/global/hooks/useGlobalSettingsTabs.js`, and `src/modules/settings/global/types/global-settings.types.js` because the live module already resolves to the TS/TSX sources.
- [x] P3 validation: focused lint and `npm run typecheck` passed.
- [x] P3 user-management shared panel consolidation completed.
- [x] P3 slice: extracted a shared user-management module under `src/modules/shared/user-management/` and moved both `src/app/clothing/users/page.tsx` and `src/components/settings/UserManagementSection.tsx` to thin wrappers over the same panel, hook, and focused components.
- [x] P3 validation: targeted ESLint on the shared user-management module and wrappers plus `npm run typecheck` passed.
- [x] P3 trucking trips dashboard decomposition completed.
- [x] P3 slice: split `src/modules/trucking/operations/trips/hooks/useTripsDashboard.ts` into shared dashboard types/utilities plus dedicated data-loading and view-model hooks so the main hook now focuses on import/export, CRUD/finalize actions, and modal orchestration.
- [x] P3 validation: targeted ESLint on the trips dashboard hooks plus `npm run typecheck` passed.
- [x] P2 API route deduplication — shipments, invoices, message-templates, post-template-notice completed.
- [x] P2 dedup slice: extracted shared factories (`shipmentDetailRouteFactory`, `transitBuildRouteFactory`, `transitReclassRouteFactory`, `invoiceRouteFactory`) and shared services (`messageTemplateService`, `postTemplateNoticeService`), plus `shipmentUtils.ts` for shared conversion helpers. Clothing and GM domain route files are now thin wrappers delegating to the shared factories.
- [x] P2 dedup validation: `npm run typecheck`, `npm run lint`, `npm run guardrails:check`, and `npm run test:unit` (230 files / 2689 tests) passed.

### In Progress

- No active P2 items.

### Pending (Audit Cycle 2)

- P2 and current P3 implementation backlog closed. Remaining follow-up is secondary coverage expansion and future audit-cycle hygiene.

## Audit Cycle 3 — Verified Follow-up Checklist (2026-04-06)

Source: two-pass repo-wide refactor assessment with adversarial verification. Items below are limited to findings that survived independent re-checking against the current repo state.

### 1. Data Safety

- [x] Audit soft-delete policy for every schema model with `deletedAt` that is currently excluded from `SOFT_DELETE_MODELS` in `src/core/database/middleware/soft-delete.ts`.
- [x] Decide explicit keep-hard-delete exceptions before any middleware expansion, especially for `Message`, `Conversation`, and `User`.
- [x] Add `deletedAt` support to `LeaveRequest`, `CashAdvanceRecord`, `TruckingLeaveRequest`, `TruckingCashAdvanceRecord`, `GeneralMerchandiseLeaveRequest`, `GeneralMerchandiseCashAdvanceRecord`, `Expense`, `TruckingExpense`, and `GeneralMerchandiseExpense` if the approved data-retention policy requires soft delete.
- [x] Review and harden active destructive routes that currently perform observed hard deletes on models without soft-delete protection.
- [x] Confirm General Merchandise leave-request delete flows are intentionally destructive or migrate them to soft-delete-safe behavior.
- [x] Confirm clothing, trucking, and GM expense delete flows are intentionally destructive or migrate them to soft-delete-safe behavior.
- [x] Document the final per-model deletion policy in code comments or architecture docs so future refactors do not guess.

### 2. Dead Code Cleanup

- [x] Remove `src/modules/settings/global/components/BackupRestorePlaceholder.tsx` if no longer needed.
- [x] Remove `src/modules/settings/global/components/BackupSchedulerTab.tsx` if no longer needed.
- [x] Remove `src/modules/clothing/operations/messaging/data.ts` if the mock exports are permanently retired.
- [x] Remove stale workspace-picker and workspace modal CSS left behind in `src/app/globals.css` after workspaces removal.

### 3. Route And Module Consolidation

- [x] Extract shared schedule-route parsing and validation logic from `src/app/api/general-merchandise/schedules/route.ts` and `src/app/api/trucking/schedules/route.ts`.
- [x] Extract shared attendance-route logic from `src/app/api/general-merchandise/attendance/route.ts` and `src/app/api/trucking/attendance/route.ts` where the overlap is stable enough.
- [x] Re-evaluate whether messaging mutation logic shared by `src/app/clothing/operations/messaging/MessagingClientPage.tsx` and `src/components/navigation/header-quick-actions/ChatWindows.tsx` is worth extracting now, or defer if the UI contexts continue to diverge.
- [x] Standardize API error-handling patterns opportunistically toward the repo-preferred middleware pattern instead of mixing wrappers, ad hoc try/catch blocks, and unwrapped handlers.

### 4. Coverage Gaps

- [x] Add Clothing employee-automation API route coverage to match the existing GM parity coverage.
- [x] Add UI/component tests for `src/app/employees/_shared/EmployeeAutomationSettingsPage.tsx`.
- [x] Add UI/component tests for `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx`.
- [x] Evaluate whether `src/modules/settings/global/components/scheduler/SchedulerTab.tsx` needs direct component coverage or can remain covered indirectly through shared employee automation tests.
- [x] Evaluate whether `src/components/GlobalMessageNotifications.tsx` needs direct component coverage or can remain covered indirectly through service- and route-level messaging tests.

### 5. Planning Notes

- [x] Treat missing explicit `export const dynamic` declarations as a consistency cleanup only, not a current defect, unless a specific route demonstrates caching/runtime issues.
- [x] Prioritize observed current deletion risks before broad style consistency work.
- [x] Re-check this checklist before each refactor batch so only confirmed items are promoted into active implementation plans.

### 6. Business Logic Documentation Drift

Source: two-pass verification of the shared route-family doc audit for shipments, invoices, message templates, and post-template notice.

- [x] Update `docs/business-logic/clothing/operations-message-templates.md` so the documented create/update payload uses `paragraphs` arrays instead of a `body` string.
- [x] Clarify `docs/business-logic/clothing/operations-message-templates.md` so the operator-facing blank-line editor is distinguished from the persisted `paragraphs` array contract.
- [x] Update `docs/business-logic/clothing/operations-message-templates.md` source-file references to the shared messaging route/service implementation.
- [x] Update `docs/business-logic/clothing/operations-post-template.md` to use the live `/api/post-template-notice` endpoint path for GET and PUT.
- [x] Update `docs/business-logic/clothing/operations-post-template.md` to document that the missing singleton notice record is created and persisted on first load, not just returned from an in-memory default.
- [x] Update `docs/business-logic/clothing/operations-post-template.md` to document the current minimum-one-bullet validation rule.
- [x] Update `docs/business-logic/clothing/operations-post-template.md` source-file references to the shared messaging route/service implementation.
- [x] Expand `docs/business-logic/clothing/operations-shipments.md` Transit Build coverage to include split mode, account allowlists, cutover enforcement, cents-precision validation, and mode-mixing guardrails.
- [x] Expand `docs/business-logic/clothing/operations-shipments.md` Transit Reclass coverage to include Delivered-only gating, cutover enforcement, `selectedIdempotencyKeys`, and missing/double-reclass guardrails.
- [x] Update `docs/business-logic/general-merchandise/operations-message-templates.md` to describe empty-table-only default seeding rather than selective missing-template re-seeding.
- [x] Update `docs/business-logic/general-merchandise/operations-message-templates.md` to document the real load-failure behavior (500 error) instead of fallback-to-default behavior.
- [x] Update `docs/business-logic/general-merchandise/operations-shipments.md` to document that GM shipment detail routes support GET/PUT only and do not expose DELETE.
- [x] Add explicit base invoice CRUD documentation for clothing and GM, while keeping the already-documented tickbox and calculate-weights behavior anchored in checkout-links docs.
- [x] Re-check these doc updates against the shared factories before closing the shared route-family documentation follow-up.

## Optimization And Enhancement Candidates (2026-04-06)

Source: repo-wide scan plus follow-up validation. These are improvement candidates, not confirmed safety defects.

### 1. Messaging Maintainability

- [x] Evaluate extracting a shared messaging mutation hook for `src/app/clothing/operations/messaging/MessagingClientPage.tsx` and `src/components/navigation/header-quick-actions/ChatWindows.tsx` so send/delete/cache invalidation logic does not drift.
- [x] Keep the full-page messaging UI and popup chat UI separate unless the shared extraction stays limited to business logic and does not force awkward UI abstraction.

### 2. Route-Level Consolidation Opportunities

- [x] Consolidate the shared parsing, validation, and request-shaping logic in the GM and trucking schedules routes into a factory/helper pattern similar to payroll.
- [x] Consolidate the stable shared logic in the GM and trucking attendance routes where doing so reduces duplicate behavior without collapsing domain-specific differences.
- [x] Review route factories already in use for payroll and apply the same threshold for future consolidation work instead of hand-merging domain routes aggressively.

### 3. Large-Surface Component Decomposition

- [x] Continue decomposing large orchestration-heavy shared surfaces such as `src/app/employees/_shared/EmployeeAutomationSettingsPage.tsx` into smaller hooks/components that are easier to test and reuse.
- [x] Continue decomposing `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx` where the remaining orchestration surface still limits testability and change safety.

### 4. Low-Risk Hygiene Wins

- [x] Remove dead placeholders, mock messaging data, and orphaned workspace CSS as a small-scope cleanup pass to reduce stale surface area.
- [x] Prefer quick-win cleanup items that reduce drift and review overhead without changing business behavior.

### 5. Defer Unless A Concrete Need Appears

- [x] Do not schedule a repo-wide `export const dynamic` normalization pass unless a route shows actual runtime or caching issues.
- [x] Do not force full messaging-page/popup-chat unification unless the shared logic boundary becomes clearly stable.

## HTTPS And Transport Security (Deferred)

Status: deferred. Current deployment is plain HTTP on a trusted private LAN (`192.168.68.63:3000`). Immich and Nextcloud on the same network also run plain HTTP. Promote this work when external access (VPN, tunnel, port forwarding) is needed or when defense-in-depth on the LAN becomes a priority.

### Current Baseline

- All three self-hosted services (business app, Immich, Nextcloud) run plain HTTP behind Docker on a private LAN.
- Security headers (HSTS, CSP, X-Frame-Options) are configured in `next.config.js` but HSTS is inert over HTTP.
- NextAuth session cookies do not carry the `Secure` flag because the transport is HTTP.
- Rate limiting middleware exists (`src/core/api/middleware.ts`) but is not applied to any route.

### When To Promote

- [ ] Promote to active when the app is exposed outside the private LAN (VPN, Tailscale, Cloudflare Tunnel, port forwarding, or public DNS).
- [ ] Promote to active if a device on the LAN is compromised or untrusted devices regularly join the network.

### Implementation Plan (Reverse Proxy — Recommended)

- [ ] Add a Caddy reverse-proxy service to `docker-compose.yml` (Alpine image, ~7 MB).
- [ ] Create a `Caddyfile` that terminates TLS and proxies to `app:5000`.
- [ ] Generate LAN certs with `mkcert` covering `localhost`, `127.0.0.1`, and `192.168.68.63`.
- [ ] Remove the `app` service `ports` mapping so the app is only reachable through Caddy inside the Docker network.
- [ ] Update `.env.docker` to set `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` to `https://192.168.68.63`.
- [ ] Install the mkcert root CA on LAN devices that need trusted access (phone, other computers).
- [ ] Verify `Secure` cookie flag activates, HSTS header becomes functional, and CSP `connect-src` still works over HTTPS.
- [ ] Consider applying the same Caddy proxy to Immich and Nextcloud as a single TLS termination point for all services.

### Companion Security Items (Can Be Done Independently)

- [ ] Apply `withRateLimit` to login, password reset, and other public-facing API routes.
- [ ] Align password reset minimum length to the declared 8-character policy in `src/constants/validation.ts`.
- [ ] Evaluate tightening CSP by removing `unsafe-eval` from `script-src` in `next.config.js`.
- [ ] Add auth-focused hardening tests (role boundaries, session abuse, negative-path coverage).

## Recovery And PITR Readiness Checklist (2026-04-04)

Purpose: make backup recovery, incident investigation, and row-level recovery operationally reliable so PITR is usable under pressure instead of only technically enabled.

### Current Baseline

- [x] Weekly full backup automation is in place.
- [x] Daily differential backup automation is in place.
- [x] PITR WAL archiving is enabled in Docker/PostgreSQL.
- [x] PITR base backup automation is in place.
- [x] PITR status and recovery-planner UI exists in Operations Settings.
- [x] `change_log` and `audit_logs` tables already exist in the schema.
- [x] `change_log` and `audit_logs` are already included in backup artifacts.

### 1. Infrastructure And Retention

- [x] Confirm `archive_mode=on`, `wal_level=replica`, and archive command are active in the live DB container.
- [x] Confirm manual PITR base backup creation works from the UI.
- [x] Confirm scheduled PITR base backup creation works with startup catch-up behavior.
- Current state: All retention constants are defined in `src/constants/limits.ts` (all 90 days) and documented in the runbook. `BACKUP_RETENTION_DAYS` default raised to 90 in `docker-compose.yml`. Scheduled log pruning is implemented at `src/app/api/internal/maintenance/prune-logs/route.ts` and wired into the backup scheduler via `LOG_PRUNE_AUTO_ENABLED`. Auto-pruning for PITR base backups and WAL segments remains accumulate-indefinitely until manual cleanup.
- [x] Define and document target retention windows for base backups, WAL archives, full backups, differential backups, `change_log`, and `audit_logs` so investigation history and recoverability expire together.
- [x] Add visibility for oldest retained base backup and oldest retained WAL segment in the PITR UI.
- [x] Add explicit operator alerting for failed WAL archiving, failed base backup runs, and retention drift.

### 2. Log Coverage And Investigation Quality

- Audit result (2026-04-04): `applyAuditLogMiddleware` in `src/lib/db.ts` covers all Prisma ORM operations globally. Genuine gaps are: (1) scripts in `scripts/` run outside the app middleware; (2) bulk `deleteMany` captures count-only before-state rather than per-row. Business-identifier enrichment now added to product bulk import/update and payroll generation.
- [x] Audit which critical mutation paths still bypass `change_log` coverage.
- [x] Audit which critical mutation paths still bypass `audit_logs` coverage because they use raw SQL, scripts, imports, or non-standard data paths.
- [x] For high-risk workflows, enrich log metadata with business identifiers that operators actually search by during incidents: customer name, invoice number, product code, transaction number, employee name, route/module, and workspace/domain.
- [x] Define the minimum required incident fields for every high-risk delete/update/import/restore event: actor, timestamp, entity type, entity ID, source, and searchable business identifier.
- [x] Add an explicit coverage matrix for logging guarantees on accounting, inventory, payroll, transactions, shipments, and customer/order records.

### 3. PITR Correlation Improvements

- Decision (2026-04-04): Approved strategy is app change_log + Prisma audit middleware. DB-side triggers and WAL/LSN correlation are explicitly deferred. See `docs/PITR_INVESTIGATION_AND_RECOVERY.md` Log Coverage Audit section.
- [x] Decide whether to add database-side audit triggers for the most critical tables instead of relying only on app-level logs.
- [x] If DB-side audit is added, capture exact DB timestamp plus before/after payload and a transaction marker such as `txid_current()` for correlation.
- [x] Evaluate whether WAL/LSN-level correlation is worth the added complexity for this deployment; do not add it repo-wide unless there is a concrete operator workflow that will use it.
- [x] Document the approved correlation strategy: app change log only, audit middleware only, selective DB audit, or a hybrid model.

### 4. Recovery Investigation Workflow

- [x] Add a “Locate Deleted Record” or equivalent investigation workflow to the backup/PITR UI.
- [x] Support searching logs by date window, entity type, actor, source, entity ID, and business identifiers.
- [x] Show a narrowed recovery window recommendation in the PITR UI based on matching log entries.
- [x] Document the binary-search PITR workflow for cases where no exact log entry exists.
- [x] Make it easy to copy the chosen target timestamp and base-backup folder into the restore command.

### 5. Safe Recovery Execution

- Current state: `docker:restore:pitr:scratch` is now a first-class operator workflow implemented in `scripts/docker/restore-pitr-into-scratch.sh`. It restores PITR into a temporary standalone container without touching the live database.
- [x] Promote the existing drill-only temporary restore flow into a first-class scratch-restore workflow that operators can use without immediate in-place production rollback.
- [x] Add a documented "extract missing row(s) from scratch restore and reinsert into live DB" workflow for accidental deletes.
- [x] Define when in-place PITR is allowed versus when scratch restore is mandatory.
- [x] Add a post-restore verification checklist for accounting, inventory, payroll, and permissions-sensitive workflows.

### 6. Validation And Drills

- Current state: Drill A (accidental delete) and Drill B (binary search) step-by-step procedures are documented in `docs/PITR_INVESTIGATION_AND_RECOVERY.md`. Log retention validation steps are also documented there. Run these drills manually against a live environment to record actual results.
- [ ] Run Drill A (accidental-delete recovery) and record the exact operator steps and elapsed time.
- [ ] Run Drill B (binary-search for unknown corruption window) and record the narrowing sequence.
- [x] Validate that logs remain available for as long as expected: `change_log` and `audit_logs` pruning is now enforced by the scheduled prune-logs job (90-day window). Use the validation steps in the runbook to confirm.
- [x] Add targeted automated tests for new PITR/log investigation routes and UI surfaces as they are implemented.

### 7. Documentation And Operator Readiness

- [x] Expand deployment/runbook docs with a dedicated PITR investigation-and-recovery procedure.
- [x] Document what PITR solves versus what soft delete, audit logs, and regular backups solve.
- [x] Document the decision tree: restore latest backup, restore differential chain, perform PITR, or use scratch restore to extract single rows.
- [x] Keep this section updated whenever PITR, backup retention, logging coverage, or restore tooling changes.

## Repository-Wide Coverage Matrix (2026-03-18)

This matrix is the repo-wide test visibility view for the entire app.

### Matrix Rules

- `Docs` means a business-logic markdown baseline exists for the workflow family.
- `Unit` means the workflow has direct logic or hook-level automated tests.
- `API` means route or handler-level automated tests exist.
- `Integration` means the workflow is validated across service, persistence, or multi-layer boundaries.
- `Hardening` means security, atomicity, integrity, or abuse-path validation exists.
- `E2E` means Playwright Chromium coverage only.
- `Prod-Shape` means the workflow has explicit messy-data or production-shape fixture coverage.
- Status legend: `✅ covered`, `◐ partial`, `❌ missing`, `n/a not applicable`.
- Priority legend: `P1 high regression risk`, `P2 important gap`, `P3 secondary gap`, `keep` maintain current coverage.

### Coverage Matrix

| Domain              | Workflow Family                                                                                                                    | Docs | Unit | API | Integration | Hardening | E2E Chromium | Prod-Shape | Priority | Notes                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---- | ---- | --- | ----------- | --------- | ------------ | ---------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Clothing            | Operations core (`customers`, `products`, `prices`, `shipments`, `transactions`, `inventory`, `sorting-distribution`)              | ✅   | ✅   | ◐   | ◐           | ◐         | ✅           | ◐          | keep     | Broad validation exists, but API and integration depth is uneven by route family.                            |
| Clothing            | Accounting / ledger (`balance-sheet`, `ledger`, `journal`, `manual-journal`, `opening-balance`, `profit-loss`, recurring payments) | ✅   | ✅   | ◐   | ◐           | ◐         | ✅           | ◐          | P2       | High-risk accounting surfaces are covered, but route-family parity is not yet uniformly deep.                |
| Clothing            | Employees (`attendance`, `leave`, `payroll`, `cash advances`, `thirteenth-month`, schedules, team)                                 | ✅   | ✅   | ✅  | ◐           | ◐         | ✅           | ◐          | keep     | Strong shared-hook and route coverage; production-shape and deeper integration scenarios can still expand.   |
| Clothing            | Operations settings / module management                                                                                            | ◐    | ◐    | ◐   | ◐           | ◐         | ◐            | ❌         | P3       | Backup/restore areas are stronger than other settings tabs.                                                  |
| General Merchandise | Operations core (`customers`, `products`, `expenses`, `shipments`, `transactions`)                                                 | ✅   | ✅   | ✅  | ◐           | ◐         | ✅           | ◐          | keep     | Core GM API expansion is complete; next gains are deeper integration and messy-data cases.                   |
| General Merchandise | Accounting / ledger (`balance-sheet`, `ledger`, `journal`, `manual-journal`, `opening-balance`, `profit-loss`, recurring payments) | ✅   | ✅   | ✅  | ◐           | ◐         | ✅           | ◐          | P2       | Route coverage is materially better; accounting parity and production-shape depth remain the next layer.     |
| General Merchandise | Employees (`attendance`, `leave`, `payroll`, `cash advances`, `thirteenth-month`, schedules)                                       | ✅   | ✅   | ✅  | ◐           | ◐         | ◐            | ◐          | keep     | GM employee routes are now broadly covered; browser workflow depth is lighter than Clothing.                 |
| Trucking            | Operations core (`trips`, `vehicle-assignments`, `fleet-vehicles`, `invoices`, `payments`)                                         | ❌   | ◐    | ❌  | ❌          | ❌        | ❌           | ❌         | P1       | This is the largest current repo-wide test gap and the main unresolved queue.                                |
| Trucking            | Employees (`attendance`, `leave`, `payroll`, `cash advances`, `thirteenth-month`, schedules)                                       | ◐    | ✅   | ◐   | ❌          | ❌        | ◐            | ❌         | P1       | Shared hook coverage is good, but route, integration, and browser depth are still behind Clothing and GM.    |
| Trucking            | Analytics / profitability / low-traffic ops routes                                                                                 | ❌   | ❌   | ❌  | ❌          | ❌        | ❌           | ❌         | P2       | Low-traffic trucking surfaces need explicit route and permission coverage.                                   |
| Household           | Dashboard / navigation                                                                                                             | ✅   | n/a  | n/a | n/a         | n/a       | ✅           | ❌         | keep     | Dashboard is scaffolded and currently validated at the Chromium smoke level.                                 |
| Household           | Accounts                                                                                                                           | ✅   | ◐    | ❌  | ❌          | ❌        | ✅           | ❌         | P2       | Docs and smoke coverage exist; direct API and integration depth is still light.                              |
| Household           | Expenses                                                                                                                           | ✅   | ◐    | ❌  | ◐           | ❌        | ✅           | ❌         | P2       | Expense and recurring behavior are partly covered through shared flows and household integrations.           |
| Household           | Recurring payments                                                                                                                 | ✅   | ✅   | ◐   | ✅          | ❌        | ✅           | ◐          | keep     | This is the strongest Household workflow and includes direct regression coverage for the date bug.           |
| Household           | Income                                                                                                                             | ✅   | ◐    | ❌  | ❌          | ❌        | ✅           | ❌         | P2       | Good docs and smoke coverage, but deeper service and route coverage is still open.                           |
| Household           | Budgets                                                                                                                            | ✅   | ❌   | ❌  | ❌          | ❌        | ✅           | ❌         | P2       | Current page contract is mostly scaffolded; add tests when live workflows deepen.                            |
| Household           | Reports / Categories / Settings                                                                                                    | ✅   | ❌   | ❌  | ❌          | ❌        | ✅           | ❌         | P3       | Chromium smoke coverage exists for the scaffolded pages; deeper tests should wait for live workflows.        |
| Admin               | Users / change log / admin operations                                                                                              | ◐    | ◐    | ◐   | ❌          | ❌        | ❌           | ❌         | P2       | Admin and low-traffic surfaces need stronger permission and negative-path validation.                        |
| Auth                | Login / password reset / profile / permission boundaries                                                                           | ◐    | ◐    | ◐   | ❌          | ❌        | ◐            | ❌         | P2       | Core auth flows exist, but explicit role-boundary and negative-path coverage should be expanded.             |
| Shared              | Backup / restore / safety-critical maintenance                                                                                     | ❌   | ✅   | ✅  | ✅          | ✅        | ❌           | ◐          | keep     | This is one of the strongest non-business workflow families because of hardening depth.                      |
| Shared              | Cross-domain route adapters, repositories, middleware, shared payroll and ledger scaffolding                                       | ❌   | ✅   | ◐   | ◐           | ◐         | ❌           | ◐          | keep     | Shared infrastructure is tested indirectly through domain suites; direct contract coverage can keep growing. |
| Shared              | Navigation, layout, header quick actions, workspace switching                                                                      | ❌   | ◐    | n/a | ❌          | ❌        | ◐            | ❌         | P3       | UI orchestration is partly validated through smoke coverage, but not deeply across all interaction paths.    |

### Current High-Value Gaps

| Priority | Area                                   | Gap                                                                          | Recommended Next Step                                                                                                  |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| P1       | Trucking operations routes             | Route families remain the most obvious repo-wide blind spot                  | Complete `P2-7` with route tests for trips, vehicle assignments, fleet vehicles, invoices, expenses, and payroll flow. |
| P1       | Trucking employees integration         | Shared hooks are covered, but multi-layer flow confidence is still low       | Add integration tests for trucking payroll, leave, and attendance data paths.                                          |
| P2       | Household non-recurring live workflows | Accounts, income, and budgets rely mostly on docs plus Chromium smoke        | Add focused unit and integration tests for account balance rules, income CRUD, and budget derivations.                 |
| P2       | Admin and auth permission boundaries   | Low-traffic and role-gated areas have weaker explicit negative-path coverage | Add route-level permission and malformed-request tests for admin, auth, and settings surfaces.                         |
| P2       | Cross-domain production-shape fixtures | Most domains still rely more on clean fixtures than messy real-world states  | Add shared production-shape fixture packs for imports, null-heavy rows, and historical soft-delete states.             |
| P3       | Shared UI interaction depth            | Browser coverage is mostly smoke-oriented outside critical business pages    | Add Chromium workflow tests for high-value modal, tab, import, and error-recovery paths.                               |

### Chromium E2E Policy

- Repository-wide browser coverage is tracked as Playwright Chromium only.
- Firefox and WebKit are not required for this matrix unless explicitly added later.
- `E2E Chromium` should represent either smoke coverage or critical workflow coverage, not just page existence checks.

### Maintenance Notes

- Keep this matrix at workflow-family level, not individual component level, so it remains maintainable.
- When a new workflow is added, update the matching row instead of creating ad hoc coverage notes elsewhere.
- When a scaffolded page becomes a live workflow, upgrade its row from smoke-only coverage to unit, API, and integration expectations.

## Architecture Standards

These rules turn the refactor audit conclusions into default implementation standards for all future work.

### Feature Ownership

- New business features must be module-first and live under the relevant domain path in `src/modules/**`.
- `src/app/**` page files should stay thin and primarily compose routing, permission checks, and page-level orchestration.
- Business rules, data mapping, and workflow logic must not be introduced directly in page files when a module hook, service, or utility is the correct boundary.
- Generic cross-domain helpers must not become a parallel feature layer that competes with domain modules.

### Shared Code Boundaries

- Shared code must remain data-source agnostic and business-path agnostic.
- Shared code may accept injected domain config, route builders, repository bindings, Prisma delegates, or query-key builders.
- Shared code must not hard-code `/api/trucking`, `/api/general-merchandise`, `/api/clothing`, or equivalent business-specific paths.
- When two businesses share behavior but keep different namespaces or bindings, use a thin wrapper over a shared core instead of duplicating the full implementation.
- If domain behavior materially diverges, keep the implementation per-business until the exact shared seam is proven safe.

### API Route Standards

- New API routes must follow one shared route pattern per route family instead of ad hoc raw handlers.
- Prefer shared route middleware or shared route adapters with explicit per-business bindings.
- CRUD-style route families should use shared scaffolding where feasible, but business-specific Prisma models, repository bindings, and namespaces must remain explicit.
- Route files should focus on request parsing, validation, authorization, and delegation. They should not absorb deep business logic that belongs in services or domain helpers.
- When an existing route family already has a local standard, extend that standard instead of introducing a second pattern in the same family.

### Query Key Standards

- React Query keys must come from centralized builders when the data is shared across pages, workflows, or businesses.
- Query keys must include domain context where relevant so cache invalidation cannot bleed across businesses.
- Inline array query keys are allowed only for strictly local, isolated page state with no cross-domain reuse and no shared invalidation contract.
- Shared hooks must not embed fixed business-specific query keys; inject the domain context instead.

### Hook, Service, and Component Boundaries

- Hooks should separate data loading, mutation orchestration, derived state, and UI-only form state whenever the file starts mixing multiple concerns.
- Services should own business operations and persistence orchestration, not view concerns.
- Components should prefer composition over monolithic “god components” that combine layout, data loading, business rules, and modal orchestration.
- If a hook or component becomes a cross-business shared core, keep business-specific notifications, copy, route prefixes, and edge-case handling in thin wrappers when needed.

### Size And Decomposition Guardrails

- Treat `>=500` lines as a warning threshold that requires a decomposition note.
- Treat `>=800` lines as mandatory decomposition planning work.
- Do not add broad new logic to files at `>=1000` lines unless blocked; extract a seam first when feasible.
- Large-file exceptions must be justified by the implementation shape, not by convenience or deadline pressure.

### Legacy And Migration Rules

- Legacy generic feature hooks or service layers should be retired, isolated, or marked as migration targets instead of expanded indefinitely.
- When touching a known legacy hotspot, prefer moving the affected logic toward the current module-first standard rather than adding another layer of compatibility code.
- New work must not introduce a fresh competing pattern when the repository already has an accepted shared approach for the same concern.

### Enforcement Expectations

- Code review should reject new work that adds architecture drift without an explicit reason and follow-up item.
- Refactor follow-ups should name the violated boundary plainly: API pattern split, query-key inconsistency, monolithic hook, monolithic route, or domain leakage.
- When equivalent route or hook families exist across clothing, GM, trucking, or household, apply the same refactor pattern consistently unless there is a documented business-specific reason not to.

## Reusable Architecture Audit Rubric

Use this rubric for future architecture audits so results stay measurable and comparable over time.

### Scoring Model (0-2 per category)

- `0`: no consistent pattern or active regression.
- `1`: pattern exists but inconsistent enforcement or legacy drift remains.
- `2`: pattern is clear, measurable, and consistently enforced.

### Categories

| Category                     | What To Measure                                                    | Score (0-2) |
| ---------------------------- | ------------------------------------------------------------------ | ----------- |
| Module ownership             | Feature logic in `src/modules/**` vs scattered route/page logic    |             |
| API route consistency        | One family pattern per concern vs mixed raw/wrapper/factory styles |             |
| Query-key discipline         | Centralized domain-aware keys vs inline ad hoc keys                |             |
| Domain isolation             | No cross-business namespace/model leakage                          |             |
| Shared-layer boundaries      | Injected config/delegates vs hard-coded business paths             |             |
| File-size risk posture       | Large-file guardrails followed with decomposition evidence         |             |
| Parity across route families | Equivalent families refactored with same pattern                   |             |
| Legacy migration progress    | Known hotspots shrinking instead of expanding                      |             |

### Rubric Output Requirements

- Include a `score by category` table and total score.
- Include measurable evidence for each category (counts, file paths, or route-family snapshots).
- Include a `top drift items` list with explicit file paths.
- Include a `P1/P2/P3` execution queue with owner-ready action wording.
- Include a second-pass verification note confirming or correcting first-pass findings.

## Current Architecture Violation Backlog (2026-03-27)

This is the active file-by-file backlog generated from the current repo state.

### P1 - High Blast Radius

- [x] `src/app/api/trucking/expenses/route.ts` — aligned to the route-family shared API pattern used by comparable domains.
- [x] `src/app/api/trucking/payroll/route.ts` — migrated to the shared payroll route adapter while preserving trucking-specific deduction sync rules and payroll-to-expense posting.
- [x] `src/app/api/trucking/attendance/route.ts` — standardized route structure and helpers while preserving the current attendance response contract used by shared hooks.
- [x] `src/app/api/inventory/check-stock/route.ts` — route is now thin, delegating clothing stock-check business logic into the products service layer.
- [x] `src/app/api/invoices/route.ts` — aligned to the invoice route-family response pattern with focused regression coverage for fetch, replace, update guardrails, and soft delete.
- [x] `src/modules/transactions/api/service.ts` — extracted reference-validation plus inventory/status orchestration into dedicated transaction API modules, reducing the service to transaction CRUD flow and audit wiring.
- [x] `src/app/api/restore/route.ts` — extracted restore model bindings plus table preview/restore orchestration into dedicated restore modules so the route can focus on API flow.
- [x] `src/app/clothing/accounting/ledger/hooks/useLedger.ts` — opening-balance and manual-journal managers now live in dedicated hooks, leaving the main hook focused on ledger data loading, derived state, CSV actions, and transit-build actions.
- [x] `src/app/personal/hooks/useHouseholdAccountsData.ts` — migrated to centralized household query-key builders.
- [x] `src/app/personal/hooks/useHouseholdIncomeData.ts` — migrated to centralized household query-key builders.

### P2 - Important Consistency Gaps

- [x] `src/app/personal/hooks/useHouseholdBudgetsData.ts` — migrated to centralized household query-key builders.
- [x] `src/app/personal/expenses/components/RecurringPaymentsPanel.tsx` — now uses centralized household recurring-payment query keys, with shared household-expenses invalidation also centralized.
- [x] `src/app/clothing/operations/messaging/MessagingClientPage.tsx` — messaging queries now use centralized messaging query keys shared with chat windows, global notifications, and header quick actions.
- [x] `src/modules/clothing/operations/dispatch/hooks/useDispatchData.ts` — dispatch orders, transactions, possible matches, and customer invalidation now use centralized dispatch/customer query-key builders.
- [x] `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts` — invoice settings and customer-orders queries now use centralized checkout-links query keys.
- [x] `src/modules/clothing/operations/settings/change-log/hooks/useChangeLogQuery.ts` — change-log queries now use a centralized query-key namespace.
- [x] `src/hooks/useSheetData.ts` — touched household-expense slice moved out into a module-local personal hook so the generic cross-domain hook layer is no longer expanding in that path.
- [x] `src/app/clothing/users/page.tsx` — decomposed into a thin route composition layer plus page-local hook, table, modal, and permission-tree components.
- [x] `src/modules/clothing/operations/transactions/components/TransactionPaymentsModal.tsx` — split payment-entry, validation, and side-effect orchestration into `useTransactionPaymentsState`, filter rendering, and table rendering helpers.
- [x] `src/modules/clothing/employees/payroll/hooks/usePayroll.ts` — reduced to a shared-base payroll composition while keeping module-local CSV import/export behavior.

### P3 - Secondary Migration/Hygiene

- [x] `src/modules/settings/global/components/GlobalSettingsPage.js` — removed stale JS duplicate; TSX source is canonical.
- [x] `src/modules/settings/global/hooks/useGlobalSettingsTabs.js` — removed stale JS duplicate; TS source is canonical.
- [x] `src/modules/settings/global/types/global-settings.types.js` — removed stale JS duplicate; TS type source is canonical.
- [x] `src/components/settings/UserManagementSection.tsx` — replaced the duplicated large UI section with a thin wrapper over the shared user-management panel.
- [x] `src/modules/trucking/operations/trips/hooks/useTripsDashboard.ts` — split query/loading, derived view-model, and action orchestration concerns across dedicated hooks and shared utilities.

### Backlog Maintenance Rules

- Re-score this backlog during each audit cycle.
- Move completed items into the implementation queue sections (`P1`, `P2`, `P3`) with validation evidence.
- Do not close an item until lint/typecheck and impacted domain isolation checks pass.

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

- [x] P2-6 Expand GM API test coverage (core and remaining base GM routes are now covered)
  - [x] Add GM accounting route coverage for `balance-sheet`, `ledger`, `journal`, `profit-loss`
  - [x] Add GM accounting route coverage for `manual-journal`, `opening-balance`
  - [x] Add `general-merchandise.attendance.api.test.ts` + `apply-leave`
  - [x] Add `general-merchandise.employees.api.test.ts`
  - [x] Add `general-merchandise.leave-requests.api.test.ts`
  - [x] Add `general-merchandise.payroll.api.test.ts` (generate, cleanup, sync-lwop, payslips)
  - [x] Add `general-merchandise.schedules.api.test.ts`
  - [x] Add `general-merchandise.transactions.api.test.ts`
  - [x] Add `general-merchandise.employee-automation-settings.api.test.ts`
  - [x] Add `general-merchandise.expenses.api.test.ts`
  - [x] Add `general-merchandise.products.api.test.ts` (`route.ts` + `[id]/route.ts`)
  - [x] Add `general-merchandise.customers.api.test.ts` (`route.ts` + `[id]/route.ts`)
  - [x] Add `general-merchandise.shipments.api.test.ts` (`route.ts` + `[id]/route.ts`)
  - [x] Validate: `npm run test:unit`

- [x] P2-7 Expand trucking API test coverage
  - [x] Add `trucking.attendance-apply-leave.api.test.ts`
  - [x] Add `trucking.leave-requests.api.test.ts`
  - [x] Add trucking payroll subroute tests (`generate`, `cleanup`, `sync-lwop`, `generate-payslips`)
  - [x] Add `trucking.expenses.api.test.ts`
  - [x] Add `trucking.fleet-vehicles.api.test.ts`
  - [x] Add `trucking.invoices.api.test.ts`
  - [x] Add `trucking.trips.api.test.ts`
  - [x] Add `trucking.vehicle-assignments.api.test.ts`
  - [x] Validate: targeted trucking Vitest batch (`11` files / `34` tests), focused lint, `npm run typecheck`

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

- [x] P3-10 Consolidate duplicated user-management UI into a shared panel
  - [x] Extract shared user-management hook, types, table, permission tree, modals, and panel under `src/modules/shared/user-management/`
  - [x] Convert `src/app/clothing/users/page.tsx` and `src/components/settings/UserManagementSection.tsx` into thin wrappers over the shared panel
  - [x] Validate with targeted ESLint on the shared module and wrappers plus `npm run typecheck`

- [x] P3-11 Split `useTripsDashboard.ts` into dedicated data, view-model, and utility layers
  - [x] Extract shared trips dashboard types and pure helper utilities under `src/modules/trucking/operations/trips/hooks/`
  - [x] Extract trip loading/reference-data effects into `useTripsDashboardData.ts`
  - [x] Extract filters, derived stats, collections, and expected-crew resolution into `useTripsDashboardViewModel.ts`
  - [x] Validate with targeted ESLint on the trips dashboard hooks plus `npm run typecheck`

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

- [x] Started the new architecture P1 backlog with `src/app/api/trucking/expenses/route.ts`; the route now uses `withErrorHandler` + `ApiResponse` like the clothing and GM expense route family while preserving trucking-specific service behavior.
- [x] Trucking expenses route validation passed: `npm run lint -- --file src/app/api/trucking/expenses/route.ts`, `npm run typecheck`
- [x] `src/modules/shared/ledger/payroll/api/routeAdapter.ts` now syncs payroll-to-expense posting when paid payrolls are created, closing the last trucking-specific gap before moving the trucking payroll route onto the shared family.
- [x] `src/app/api/trucking/payroll/route.ts` now uses the shared payroll route adapter with trucking-specific expense posting and pending-only deduction sync preserved.
- [x] Trucking payroll route validation passed: `npm run lint -- --file src/app/api/trucking/payroll/route.ts --file src/modules/shared/ledger/payroll/api/routeAdapter.ts --file tests/unit/api/trucking.payroll.api.test.ts`, `npm run test:unit -- tests/unit/api/payroll.api.test.ts tests/unit/api/general-merchandise.payroll.api.test.ts tests/unit/api/trucking.payroll.api.test.ts`, `npm run typecheck`
- [x] `src/app/api/invoices/route.ts` now matches the generic/GM invoice route-family response pattern and no longer mixes `NextResponse.json` payload styles across methods.
- [x] Invoices route validation passed: `npm run lint -- --file src/app/api/invoices/route.ts --file tests/unit/api/invoices.api.test.ts`, `npm run test:unit -- tests/unit/api/invoices.api.test.ts`
- [x] `src/app/api/inventory/check-stock/route.ts` now delegates the stock availability algorithm to `src/modules/clothing/operations/products/services/stockCheckService.ts`, reducing the route to request validation and response shaping only.
- [x] Inventory stock-check decomposition validation passed: `npm run lint -- --file src/app/api/inventory/check-stock/route.ts --file src/modules/clothing/operations/products/services/stockCheckService.ts --file src/modules/clothing/operations/products/services/index.ts`, `npm run typecheck`
- [x] `src/app/api/restore/route.ts` now relies on `restoreModelMap.ts` and `restoreTableService.ts` for table binding and preview/restore orchestration instead of carrying the full restore engine inline.
- [x] Restore route decomposition validation passed: `npm run lint -- --file src/app/api/restore/route.ts --file src/app/api/restore/restoreModelMap.ts --file src/app/api/restore/restoreTableService.ts`, `npm run typecheck`
- [x] Partial transaction-service decomposition: reference validation and transaction error types now live in `src/modules/transactions/api/referenceValidation.ts`, reducing inline import-write validation logic in `src/modules/transactions/api/service.ts` while keeping the public error exports stable.
- [x] Transaction reference-validation extraction validation passed: `npm run lint -- --file src/modules/transactions/api/service.ts --file src/modules/transactions/api/referenceValidation.ts`, `npm run typecheck`
- [x] `src/modules/transactions/api/service.ts` now delegates paid-status guards, shipment-status guards, and inventory movement orchestration to `transactionInventorySync.ts`, closing the remaining large inline transaction write-path hotspot while preserving the service export surface.
- [x] Transaction inventory/status extraction validation passed: `npm run lint -- --file src/modules/transactions/api/service.ts --file src/modules/transactions/api/transactionInventorySync.ts`, `npm run typecheck`
- [x] `src/lib/queryKeys.ts` now defines a centralized `household` namespace, and the P1 personal finance hooks consume it instead of inline cache-key strings.
- [x] Household query-key migration validation passed: `npm run lint -- --file src/lib/queryKeys.ts --file src/app/personal/hooks/useHouseholdAccountsData.ts --file src/app/personal/hooks/useHouseholdIncomeData.ts`, `npm run typecheck`
- [x] `src/lib/queryKeys.ts` now also centralizes `household.expenses`, `household.budgets`, and `household.recurringPayments`, with personal budgets, recurring payments, recurring-generation invalidation, and `useSheetData` household-expense wiring aligned to the same household namespace.
- [x] Household budgets/recurring query-key cleanup validation passed: `npm run lint -- --file src/lib/queryKeys.ts --file src/app/personal/hooks/useHouseholdBudgetsData.ts --file src/app/personal/expenses/components/RecurringPaymentsPanel.tsx --file src/app/personal/hooks/usePersonalExpensesView.ts --file src/hooks/useSheetData.ts`, `npm run typecheck`
- [x] `src/lib/queryKeys.ts` now also centralizes `messaging`, `dispatch`, `checkoutLinks`, and `changeLog` query-key families, and the current consumers in clothing operations messaging, dispatch, checkout links, change log, global notifications, and header chat windows all use those shared builders.
- [x] Operations query-key cleanup validation passed: `npm run lint -- --file src/lib/queryKeys.ts --file src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts --file src/modules/clothing/operations/settings/change-log/hooks/useChangeLogQuery.ts --file src/modules/clothing/operations/dispatch/hooks/usePossibleMatches.ts --file src/modules/clothing/operations/dispatch/hooks/useDispatchData.ts --file src/app/clothing/operations/messaging/MessagingClientPage.tsx --file src/components/GlobalMessageNotifications.tsx --file src/components/navigation/HeaderQuickActions.tsx --file src/components/navigation/header-quick-actions/ChatWindows.tsx`, `npm run typecheck`
- [x] Household expenses now use `src/app/personal/hooks/useHouseholdExpenseData.ts` instead of the legacy generic `useSheetData` layer, trimming the touched household slice back to a module-local hook boundary.
- [x] Household expense hook extraction validation passed: `npm run lint -- --file src/hooks/useSheetData.ts --file src/app/personal/hooks/useHouseholdExpenseData.ts --file src/app/personal/hooks/useHouseholdExpenses.ts`, `npm run typecheck`
- [x] `src/app/clothing/accounting/ledger/hooks/useLedger.ts` now composes `useLedgerManualEntries.ts` and `useLedgerOpeningEntries.ts` with shared `ledgerTypes.ts`, removing the last large inline mutation/form clusters from the ledger hook.
- [x] Ledger hook decomposition validation passed: `npm run lint -- --file src/app/clothing/accounting/ledger/hooks/useLedger.ts --file src/app/clothing/accounting/ledger/hooks/useLedgerManualEntries.ts --file src/app/clothing/accounting/ledger/hooks/useLedgerOpeningEntries.ts --file src/app/clothing/accounting/ledger/hooks/ledgerTypes.ts --file src/app/clothing/accounting/ledger/hooks/ledgerCsvHandlers.ts --file src/app/clothing/accounting/ledger/hooks/ledgerTransitBuildActions.ts`, `npm run typecheck`
- [x] `src/app/api/trucking/attendance/route.ts` now uses the same structured helper layout as the comparable attendance routes while keeping the existing raw JSON response shapes expected by the shared attendance hook.
- [x] Trucking attendance route validation passed: `npm run lint -- --file src/app/api/trucking/attendance/route.ts`, `npm run test:unit -- tests/unit/api/trucking.attendance.api.test.ts`
- [x] Current active slice completed: `P2-6` GM API coverage expansion
- [x] Added dedicated GM API tests for `employee-automation-settings`, `expenses`, `products` + `[id]`, `customers` + `[id]`, and `shipments` + `[id]`, closing the remaining base-route GM coverage gap from Audit Cycle 2
- [x] GM API coverage expansion validation passed: targeted GM Vitest batch, `npm run lint`, `npm run typecheck`, `npm run test:unit`
- [x] `HeaderQuickActions.tsx` now delegates the app launcher, messages popover, notification/settings/profile actions, and floating chat windows to focused components in `src/components/navigation/header-quick-actions/` while keeping routing/session/query orchestration in the parent
- [x] Header quick actions validation passed: `npm run lint`, `npm run typecheck`
- [x] Clothing and GM payroll routes now share `src/modules/shared/ledger/payroll/api/routeAdapter.ts` for CRUD orchestration while preserving per-business Prisma bindings, route namespaces, and payroll-to-expense sync delegates
- [x] Payroll route consolidation validation passed: `npm run lint`, `npm run typecheck`, `tests/unit/api/payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll.api.test.ts`
- [x] Clothing and GM accounting `data-fetchers.ts` now use the same absolute `@/lib/accounting/*` import style with no behavior change
- [x] `BackupRestoreTab.tsx` now delegates tab-panel rendering to `BackupSection.tsx`, `RestoreSection.tsx`, and `TablePreviewSection.tsx` while keeping shared preview/restore orchestration in the parent
- [x] Backup/restore tab split validation passed: `npm run lint`, `npm run typecheck`, `tests/unit/api/backup-restore.api.test.ts`, `tests/hardening/backup-restore.security.test.ts`, `tests/hardening/backup-restore.atomic.test.ts`, `tests/hardening/backup-restore.workflow.test.ts`, `tests/hardening/backup-restore.integrity.test.ts`
- [x] `EmployeeAutomationSettingsPage.tsx` now delegates fetch/save/run form orchestration into `useEmployeeAutomationSettingsController.ts` and renders history through `EmployeeAutomationHistoryCard.tsx`, reducing parent-page state density while keeping shared route resolution intact
- [x] `BackupRestoreTab.tsx` now delegates preview/restore/sidebar/polling orchestration into `backup-restore/useBackupRestorePreviewController.ts`, leaving the parent focused on backup/PITR composition and panel wiring
- [x] Post-decomposition validation passed: `npm run guardrails:check`, `npm run test:full`, `npm run test:e2e:chromium`, `npm run docker:build`, `npm run docker:up`, and `curl -fsS http://localhost:5000/api/health`
- [x] Clothing, trucking, and GM employee-automation settings routes now share `src/modules/shared/employees/api/employeeAutomationRouteFactory.ts`, centralizing auth/error mapping/manual-run logging while preserving per-domain services and response semantics
- [x] Follow-up validation after API error-handling standardization passed: `npm run guardrails:check`, `npm run test:full`, `npm run test:e2e:chromium`, `npm run docker:build`, `npm run docker:up`, and `curl -fsS http://localhost:5000/api/health`
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
- [x] Added remaining GM base-route coverage for employee automation settings, expenses, products, customers, and shipments: `tests/unit/api/general-merchandise.employee-automation-settings.api.test.ts`, `tests/unit/api/general-merchandise.expenses.api.test.ts`, `tests/unit/api/general-merchandise.products.api.test.ts`, `tests/unit/api/general-merchandise.customers.api.test.ts`, `tests/unit/api/general-merchandise.shipments.api.test.ts`
- [x] Broader unit validation passed after GM API expansion: `npm run test:unit` (155 files, 2026 tests)
- [x] Added general-merchandise payroll API coverage: `tests/unit/api/general-merchandise.payroll.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate.api.test.ts`, `tests/unit/api/general-merchandise.payroll-cleanup.api.test.ts`, `tests/unit/api/general-merchandise.payroll-generate-payslips.api.test.ts`, `tests/unit/api/general-merchandise.payroll-sync-lwop.api.test.ts`
- [x] Final validation passed: `npm run typecheck`, `npm run lint`, `tests/unit/api/trucking.attendance.api.test.ts`, `tests/unit/api/trucking.schedules.api.test.ts`, `tests/unit/api/trucking.employees.api.test.ts`, `tests/unit/api/trucking.cash-advances.api.test.ts`, `tests/unit/api/trucking.thirteenth-month-pay.api.test.ts`, `tests/unit/api/general-merchandise.cash-advances.api.test.ts`, `tests/unit/api/general-merchandise.thirteenth-month-pay.api.test.ts`
- [x] GM API base-route coverage gap is closed; the remaining repo test-expansion backlog is now primarily trucking-focused under P2-7.
- [x] Trucking API coverage expansion closed the active P2 route-testing queue for apply-leave, leave requests, expenses, fleet vehicles, invoices, trips, vehicle assignments, and payroll subflows.
- [x] Users page decomposition completed: `src/app/clothing/users/page.tsx` now composes `useUserManagementPage`, `UserManagementTable`, `UserManagementModals`, and `UserPermissionTree`.
- [x] Transaction payments modal decomposition completed: `TransactionPaymentsModal.tsx` now composes `useTransactionPaymentsState`, `TransactionPaymentsFilters`, and `TransactionPaymentsTable`.
- [x] Clothing payroll hook decomposition completed: `src/modules/clothing/employees/payroll/hooks/usePayroll.ts` now follows the shared payroll-base pattern while retaining module-local CSV behavior.
- [x] Final P2 close-out validation passed: focused lint, `npm run typecheck`, and the targeted trucking API Vitest batch (`11` files / `34` tests).
- [x] Global settings JS artifact cleanup passed: focused lint on the live TS/TSX files and `npm run typecheck`.

## Continuous API Refactor Backlog (2026-04-06)

Purpose: keep one verified queue of remaining route-family refactors so future batches can be pulled continuously without re-auditing the API surface each time.

### Already Standardized Route Families

- [x] `employee-automation-settings` — clothing, trucking, and GM now use `src/modules/shared/employees/api/employeeAutomationRouteFactory.ts`
- [x] `expenses` — clothing, trucking, and GM now use `src/modules/shared/ledger/expenses/api/routeFactory.ts`
- [x] `payroll` — clothing, trucking, and GM now use `src/modules/shared/ledger/payroll/api/routeAdapter.ts`
- [x] `cash-advances` — clothing, trucking, and GM now use `src/modules/employees/cash-advance/api/routeFactory.ts`
- [x] `customers` base routes — clothing and GM use `src/modules/customers/api/routeFactory.ts`
- [x] `products` base routes — clothing and GM use `src/modules/products/api/routeFactory.ts`
- [x] `transactions` base routes — clothing and GM use `src/modules/transactions/api/routeFactory.ts`
- [x] `opening-balance` — clothing and GM use `src/modules/shared/ledger/opening-balance/api/routeAdapter.ts`
- [x] `manual-journal` — clothing and GM use `src/modules/shared/ledger/manual-journal/api/routeAdapter.ts`
- [x] `recurring-payments` (`templates`, `generate`, `drafts`, `approve`, `skip`) — clothing and GM use `src/modules/shared/ledger/recurring-payments/api/routeAdapters.ts`
- [x] `employees/[id]/salary-history` — clothing and trucking use `src/modules/employees/salary-history/api/routeFactory.ts`

### P1 — Next Shared Route Families

- [x] `attendance/apply-leave` — extracted one shared POST handler across clothing, GM, and trucking in `src/modules/shared/employees/api/applyLeaveRouteFactory.ts` while keeping per-domain Prisma delegates explicit; validation passed with focused route tests, `npm run guardrails:check`, `npm run typecheck`, and `npm run test:integration`.
- [x] `attendance` — clothing, GM, and trucking now use `src/modules/shared/employees/api/attendanceRouteFactory.ts` for GET/POST/PATCH/DELETE flow, normalized success envelopes, and shared Prisma error mapping while keeping per-domain delegates explicit; validation passed with focused ESLint, focused attendance route unit tests, `npm run guardrails:check`, `npm run typecheck`, and `npm run test:integration`.
- [x] `schedules` — clothing, GM, and trucking now use `src/modules/shared/employees/api/scheduleRouteFactory.ts` for GET/POST/PATCH/DELETE flow, duplicate detection, employee existence checks, and normalized success envelopes while keeping per-domain Prisma delegates explicit; validation passed with focused ESLint, focused schedules route unit tests, `npm run guardrails:check`, `npm run typecheck`, and `npm run test:integration`.
- [x] `leave-requests` (`route.ts` and `[id]/route.ts`) — clothing, GM, and trucking now use `src/modules/shared/employees/api/leaveRequestRouteFactory.ts` for shared list/detail parsing, employee existence checks, bulk/single update handling, and soft-delete flows while keeping per-domain Prisma bindings explicit; validation passed with focused leave-request and thirteenth-month route unit tests, focused ESLint, `npm run guardrails:check`, `npm run typecheck`, and `npm run test:integration`.
- [x] `thirteenth-month-pay` (`route.ts` and `[recordId]/status/route.ts`) — clothing, GM, and trucking now use `src/modules/shared/employees/api/thirteenthMonthPayRouteFactory.ts` for shared query, upsert, and status-update route scaffolding, with GM normalized through `src/app/api/general-merchandise/thirteenth-month-pay/serviceAdapter.ts`; validation passed with focused leave-request and thirteenth-month route unit tests, focused ESLint, `npm run guardrails:check`, `npm run typecheck`, and `npm run test:integration`.

### P2 — Medium-Complexity Cross-Domain Families

- [ ] `shipments` — evaluate a shared route family for clothing and GM covering base routes plus `[id]`, `transit-build`, and `transit-reclass` without collapsing domain-specific shipment rules.
- [ ] `invoices` — evaluate a shared route family for clothing and GM covering base CRUD plus `customer-orders`, `calculate-weights`, `generate-*`, and `[id]/tickbox`; assess trucking invoice overlap separately instead of forcing one abstraction immediately.
- [ ] `message-templates` and `post-template-notice` — extract thin shared CRUD/request-shaping adapters if the GM and clothing payload contracts are still materially identical.
- [ ] `inventory` — review `check-stock` and `movements` route pairs across clothing and GM for adapter extraction opportunities that preserve inventory and accounting invariants.
- [ ] `sorting-distribution` — review `sorting-distribution` and `generate-distribution` route pairs across clothing and GM for a shared validation/request-shaping seam.

### P3 — Lower-Priority Or Pattern-Only Standardization

- [ ] `prices`, `bundles`, `mix-and-match`, and `item-weights` — standardize only if field mapping can be injected cleanly without hiding business rules in a generic adapter.
- [ ] Clothing/GM operations-settings side routes (`change-log`, `notifications`, shipping-fee calculator, checkout-links-adjacent routes) — extract thin shared adapters only where the route shape is already stable.
- [ ] Trucking ops routes (`trips`, `vehicle-assignments`, `fleet-vehicles`, `payments`, `analytics/profitability`) — standardize internal handler structure, middleware usage, and service boundaries even where no cross-domain factory is appropriate yet.
- [ ] Low-traffic admin/auth/internal routes — opportunistically standardize error handling, auth wrappers, and request parsing when those files are touched for other work.

### Explicit Defers And Guardrails

- [x] Do not reopen `cash-advances` as a candidate unless the existing factory proves insufficient; GM is already using the shared route factory.
- [x] Do not treat household routes as cross-domain consolidation targets; they remain intentionally separate.
- [x] Do not merge accounting-heavy `balance-sheet`, `ledger`, or `journal` routes blindly; treat them as dedicated accounting refactors only after data-contract differences are mapped first.
- [x] Do not count a family as complete until route-level tests are added or updated for every touched domain.
- [x] Keep this section API-first; large-hook and large-component decomposition work remains tracked in the rest of this checklist and should not be mixed into this route queue.

### Working Rules For Continuous Execution

- Work top-to-bottom unless a higher item is blocked by domain risk or missing tests.
- For each family, complete route extraction, parity tests, and any required docs updates in the same batch.
- If a family turns out to be more divergent than expected, downgrade it here with a short note instead of forcing a bad abstraction.
- When a shared factory already exists, prefer adoption and cleanup before inventing a second adapter pattern.

## Notes

- This checklist tracks both planning work already completed and implementation work still pending.
- Only real execution work should use unchecked checkboxes. Reference rules and guardrails should remain plain bullets.
- Mark items in `Completed`, `In Progress`, and `Pending` as work advances.
- For accounting and inventory refactors, do not change behavior until domain differences are explicitly mapped and tested.
