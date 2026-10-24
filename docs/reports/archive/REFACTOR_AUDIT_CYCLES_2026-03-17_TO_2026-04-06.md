# Refactor Audit Cycles: March-April 2026

Historical sections extracted from the [canonical tracker](../../plans/REFACTOR_CHECKLIST.md)
on 2026-10-25 to keep it within the existing size guardrails. Counts, statuses and
recommendations below are dated evidence, not current verification or new policy.

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
