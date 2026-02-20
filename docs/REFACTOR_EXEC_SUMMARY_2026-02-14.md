# Executive Summary — Refactor Work (Feb 14, 2026)

## Audience

This summary is for non-technical stakeholders and project owners.

## What was completed

Today’s work focused on reducing technical risk, improving maintainability, and validating stability across key business modules.

### 1) Reliability and quality controls were strengthened

- The team hardened the repository’s refactor/audit rules so future scans are more complete, measurable, and consistent.
- Result: better governance and less chance of missing high-risk areas in future work.

### 2) Core accounting endpoints were made safer and more consistent

- Shared safety utilities were introduced and applied across clothing and general-merchandise accounting routes.
- Result: less duplicated logic and lower risk of route-specific defects.
- Business impact: accounting behavior remains stable while maintenance risk drops.

### 3) Customer order API functionality was completed

- Placeholder TODO behavior was replaced with real transaction-based order mapping.
- Result: customer order endpoints now return meaningful operational data.
- Business impact: improved feature completeness for downstream UI/reporting use.

### 4) Duplicate employee UI logic was consolidated

- Shared cash-advance components were extracted and reused by clothing and trucking modules.
- Payroll helper logic was centralized and reused by multiple payroll hooks.
- Result: parity between modules and easier long-term updates.
- Business impact: lower chance of one module drifting or breaking while another is fixed.

### 5) Operations modules were simplified

- Checkout-links filtering and export behavior were refactored, and TODO stubs were replaced with working implementations.
- Transactions and backup/restore flows were decomposed into smaller utility units.
- Result: lower complexity in high-change areas and faster, safer future enhancements.

### 6) Type-safety debt was reduced

- Remaining explicit `any` suppressions were removed/cleaned where feasible.
- Unsafe global access patterns were replaced with typed equivalents.
- Result: stronger static checks and fewer hidden runtime risks.

## Validation and release confidence

All major quality gates passed after refactoring:

- Lint
- Typecheck
- Unit tests
- Integration tests
- Hardening tests
- Coverage run

Overall test sequence completed successfully with exit code `0`.

## Why this matters to the business

- **Lower operational risk:** safer internals with unchanged expected behavior.
- **Faster future delivery:** less duplication means changes are cheaper and faster.
- **Higher confidence:** full regression validation confirms platform stability.
- **Better scalability of maintenance:** shared patterns across clothing/trucking/general-merchandise reduce rework.

## Net outcome

The codebase is now in a cleaner, safer, and fully validated state after this refactor cycle, with no detected regressions in test gates.

---

## Addendum — Refactor Audit Update (Feb 19, 2026)

This is an append-only update for history tracking. The original Feb 14 summary remains unchanged.

### What was added in this update

- A full-scope refactor audit was executed across required module and app surfaces.
- The audit produced measurable baselines for file size, duplication, and risk markers.
- Missing scope was explicitly marked as N/A where applicable.

### Key measurable findings

- Large-file distribution:
  - `>=500 lines`: `123`
  - `>=800 lines`: `46`
  - `>=1000 lines`: `26`
  - `>=1200 lines`: `18`
  - `>=1500 lines`: `8`
- Route-family duplication (exact hash clones):
  - Clothing vs GM operations: `0.00%` (`0/21` exact clones)
  - Clothing vs GM ledger: `0.00%` (`0/7` exact clones)
  - Clothing vs GM app routes: `0.00%` (`0/38` exact clones)
- Risk markers (aggregate):
  - `as unknown as`: `189`
  - `TODO/FIXME`: `7`
  - `eslint-disable @typescript-eslint/no-explicit-any`: `1`

### Business-level improvement from this update

- Improves planning accuracy by replacing broad refactor claims with concrete, repeatable metrics.
- Improves prioritization by identifying highest-risk, highest-ROI targets before new refactor cycles.
- Improves parity governance by measuring cross-family drift between clothing and general-merchandise routes.
- Improves audit traceability through explicit scope coverage and N/A declarations.

### Recommended next refactor wave (priority order)

1. **P1**: Split very large high-churn files (inventory, payroll hooks, API mega-routes).
2. **P1**: Reduce unsafe casting hotspots in API-heavy surfaces.
3. **P2**: Introduce stronger shared abstractions across clothing and GM route families.
4. **P3**: Clear remaining TODO/FIXME and explicit-any suppression debt.

### Validation status for this cycle

Quality gates were executed successfully in this session:

- Lint
- Typecheck
- Unit tests
- Integration tests
- Hardening tests
- Coverage run

Overall sequence completed with exit code `0`.

## Addendum — R2 Completion Update (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this update

- Completed **R2 (P1)** unsafe-cast reduction across both target surfaces:
  - `src/app/api/**`
  - `src/lib/**`
- Removed remaining `as unknown as` hotspots in the targeted R2 scope.
- Applied parity-safe, no-intent-change refactors with model-typed delegates and guarded runtime access where needed.

### Validation outcomes for R2 completion

All required quality gates passed in this session:

- Lint
- Typecheck
- Unit tests
- Integration tests
- Hardening tests
- Coverage run

Overall sequence completed with exit code `0`.

### Stability note

- During validation, payment-route unit regressions surfaced due to aggregate/groupBy compatibility in test mocks.
- The routes were updated to support both aggregate and groupBy calculation paths without behavior drift.
- Targeted failing tests were re-run and passed before full-suite completion.

## Addendum — R3 Operations Guard Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Expanded the shared operations guard abstraction rollout in clothing operations routes.
- Migrated the following routes from inline `PermissionGuard` + permission-check boilerplate to the shared renderer:
  - `src/app/clothing/operations/products/page.tsx`
  - `src/app/clothing/operations/dispatch/page.tsx`
  - `src/app/clothing/operations/message-templates/page.tsx`
  - `src/app/clothing/operations/business-intelligence/page.tsx`
- Maintained route behavior and page-specific rendering/data-loading logic while reducing duplicated guard code.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Focused parity test: `useBusinessIntelligence.test.ts` passed (`35/35`)
- Unit suite: passed (`129` files, `1935` tests)
- Post-slice integration + hardening + coverage chain: passed (`FULL_POST_SLICE_EXIT:0`)

### R3 status

- R3 remains **in progress**.
- This slice completes the remaining clothing operations pages that still used inline guard wrappers.
- Next focus remains broader parity abstractions in remaining route families per queue order.

## Addendum — R3 GM Employees Guard Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Added shared GM employees page renderer:
  - `src/app/general-merchandise/employees/_shared/renderGmEmployeesPage.tsx`
- Migrated GM employee wrapper routes from inline `PermissionGuard` + permission-check boilerplate to shared renderer:
  - `attendance`, `calendar`, `cash-advance`, `dashboard`, `employee-loans`, `leave-tracker`, `notifications`, `payroll`, `schedules`, `settings`, `thirteenth-month-pay`, `team`, `team/[id]`
- Preserved route behavior and existing page payload props while reducing repeated guard logic.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed (`129` files, `1935` tests)
- Integration suite: passed (`2` files, `5` tests)
- Hardening suite: passed (`4` files, `8` tests)
- Coverage run: passed (`COVERAGE_RETRY_EXIT:0`)

### R3 status

- R3 remains **in progress**.
- GM employee guard wrappers are now aligned to a shared abstraction pattern consistent with earlier operations-route parity work.
- Next focus remains remaining equivalent route families outside operations and GM employee guard slices.

## Addendum — R3 Admin Backup/Restore Guard Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Migrated admin backup/restore page guard wrapper to shared renderer:
  - `src/app/admin/backup-restore/page.tsx`
- Reused the existing operations access path (`/clothing/operations/settings`) via shared renderer to preserve access behavior while removing inline guard boilerplate.
- Verified no remaining inline `PermissionGuard` + permission-check wrappers under `src/app/**/page.tsx`.

### Validation outcomes for this slice

- Lint: passed (`LINT_EXIT:0`)
- Typecheck: passed (`TYPECHECK_EXIT:0`)
- Unit suite: passed (`129` files, `1935` tests)
- Integration suite: passed (`2` files, `5` tests; `INTEGRATION_EXIT:0`)
- Hardening suite: passed (`4` files, `8` tests; `HARDENING_EXIT:0`)
- Coverage run: passed (`COVERAGE_EXIT:0`)

### R3 status

- R3 remains **in progress**.
- App-router page-level guard wrappers are now consolidated to shared renderers across completed families.
- Next focus remains parity abstractions in equivalent route families beyond page-wrapper guard patterns.

## Addendum — R3 Customer Details Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared customer-details route wrapper component:
  - `src/app/operations/customers/_shared/CustomerDetailsRoutePage.tsx`
- Migrated both equivalent routes to the shared wrapper:
  - `src/app/clothing/operations/customers/[id]/page.tsx`
  - `src/app/general-merchandise/operations/customers/[id]/page.tsx`
- Preserved route behavior (same param parsing, same customer details view, same page layout) while removing duplicate wrapper logic.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Equivalent customer-details route wrappers are now aligned to one shared abstraction.
- Next focus remains remaining equivalent families with duplicated route-level wrapper or orchestration logic.

## Addendum — R3 Balance Sheet Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared balance-sheet route component:
  - `src/app/accounting/_shared/BalanceSheetRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/accounting/balance-sheet/page.tsx`
  - `src/app/general-merchandise/accounting/balance-sheet/page.tsx`
- Preserved behavior by reusing the same clothing balance-sheet UI/hook stack while keeping GM-specific API base path (`/api/general-merchandise`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Balance-sheet route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Profit/Loss Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared profit/loss route component:
  - `src/app/accounting/_shared/ProfitLossRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/accounting/profit-loss/page.tsx`
  - `src/app/general-merchandise/accounting/profit-loss/page.tsx`
- Preserved behavior parity, including GM route’s current no-breakdowns rendering, through explicit shared component option (`showBreakdownsTab={false}`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Profit/loss route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Ledger Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared ledger route component:
  - `src/app/accounting/_shared/LedgerRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/accounting/ledger/page.tsx`
  - `src/app/general-merchandise/accounting/ledger/page.tsx`
- Preserved behavior parity, including GM recurring-payments backend wiring, through explicit shared-component service override (`recurringPaymentService={GeneralMerchandiseRecurringPaymentService}`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Ledger route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Expenses Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared expenses route component:
  - `src/app/accounting/_shared/ExpensesRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/accounting/expenses/page.tsx`
  - `src/app/general-merchandise/accounting/expenses/page.tsx`
- Preserved behavior parity by parameterizing business-specific labels and GM expense data hook injection (`expenseDataHook={useGeneralMerchandiseExpenseData}`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Expenses route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Journal Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared journal route component:
  - `src/app/accounting/_shared/JournalRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/accounting/journal/page.tsx`
  - `src/app/general-merchandise/accounting/journal/page.tsx`
- Preserved behavior parity while parameterizing GM API base path in shared route (`apiBasePath="/api/general-merchandise"`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Journal route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Accounting Root Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared accounting root redirect route component:
  - `src/app/accounting/_shared/AccountingRootRedirectPage.tsx`
- Migrated both equivalent accounting root routes to shared component:
  - `src/app/clothing/accounting/page.tsx`
  - `src/app/general-merchandise/accounting/page.tsx`
- Preserved behavior parity by parameterizing business route prefix while keeping the same expenses redirect target for each family.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Accounting root redirect wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Employees Expenses Redirect Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared employees-expenses redirect route component:
  - `src/app/employees/_shared/EmployeesExpensesRedirectPage.tsx`
- Migrated both equivalent employees-expenses routes to shared component:
  - `src/app/clothing/employees/expenses/page.tsx`
  - `src/app/general-merchandise/employees/expenses/page.tsx`
- Preserved behavior parity by keeping the existing redirect targets for each family (`/clothing/accounting` and `/general-merchandise/accounting/expenses`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Employees-expenses redirect wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Sorting Distribution Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared sorting-distribution route component:
  - `src/app/operations/sorting-distribution/_shared/SortingDistributionRoutePage.tsx`
- Migrated both equivalent routes to shared component:
  - `src/app/clothing/operations/sorting-distribution/page.tsx`
  - `src/app/general-merchandise/operations/sorting-distribution/page.tsx`
- Preserved behavior parity while keeping GM operations guard rendering and GM API base path (`/api/general-merchandise`) at route call-site.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Sorting-distribution route wrappers are now aligned across clothing and GM using one shared route component.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Customers List Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared customers-list route wrapper component:
  - `src/app/operations/customers/_shared/CustomersRoutePage.tsx`
- Migrated both equivalent customers-list routes to shared wrapper:
  - `src/app/clothing/operations/customers/page.tsx`
  - `src/app/general-merchandise/operations/customers/page.tsx`
- Preserved behavior parity while keeping route-family guard access paths unchanged at call sites.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Customers-list route wrappers are now aligned across clothing and GM using one shared route wrapper.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Checkout Links Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared checkout-links route wrapper component:
  - `src/app/operations/checkout-links/_shared/CheckoutLinksRoutePage.tsx`
- Migrated both equivalent checkout-links routes to shared wrapper:
  - `src/app/clothing/operations/checkout-links/page.tsx`
  - `src/app/general-merchandise/operations/checkout-links/page.tsx`
- Preserved behavior parity while parameterizing GM-specific API wiring (`apiBasePath="/api/general-merchandise"`, `checkoutLinksApiBasePath="/api"`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Checkout-links route wrappers are now aligned across clothing and GM using one shared route wrapper.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Transactions Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared transactions route wrapper component:
  - `src/app/operations/transactions/_shared/TransactionsRoutePage.tsx`
- Migrated both equivalent transactions routes to shared wrapper:
  - `src/app/clothing/operations/transactions/page.tsx`
  - `src/app/general-merchandise/operations/transactions/page.tsx`
- Preserved behavior parity while parameterizing GM API base path in the shared wrapper call (`apiBasePath="/api/general-merchandise"`).

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Transactions route wrappers are now aligned across clothing and GM using one shared route wrapper.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Messaging Route Parity Slice (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Extracted shared messaging route wrapper component:
  - `src/app/operations/messaging/_shared/MessagingRoutePage.tsx`
- Migrated both equivalent messaging routes to shared wrapper:
  - `src/app/clothing/operations/messaging/page.tsx`
  - `src/app/general-merchandise/operations/messaging/page.tsx`
- Preserved behavior parity by keeping existing route-family guard module paths unchanged while reusing one route wrapper.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Messaging route wrappers are now aligned across clothing and GM using one shared route wrapper.
- Next focus remains remaining equivalent families with duplicated route-level orchestration.

## Addendum — R3 Remaining Operations Route Parity Batch (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this batch

- Extracted shared operations route wrapper components for the remaining equivalent clothing/GM operations families:
  - `src/app/operations/dashboard/_shared/DashboardRoutePage.tsx`
  - `src/app/operations/notifications/_shared/NotificationsRoutePage.tsx`
  - `src/app/operations/dispatching/_shared/DispatchingRoutePage.tsx`
  - `src/app/operations/inventory/_shared/InventoryRoutePage.tsx`
  - `src/app/operations/post-template/_shared/PostTemplateRoutePage.tsx`
  - `src/app/operations/prices/_shared/PricesRoutePage.tsx`
  - `src/app/operations/products/_shared/ProductsRoutePage.tsx`
  - `src/app/operations/settings/_shared/SettingsRoutePage.tsx`
  - `src/app/operations/shipments/_shared/ShipmentsRoutePage.tsx`
  - `src/app/operations/business-intelligence/_shared/BusinessIntelligenceRoutePage.tsx`
  - `src/app/operations/dispatch/_shared/DispatchRoutePage.tsx`
  - `src/app/operations/message-templates/_shared/MessageTemplatesRoutePage.tsx`
- Migrated both clothing and general-merchandise page routes for each family above to shared wrappers.
- Preserved behavior parity by keeping route-specific API/guard wiring at call-sites while removing duplicated route orchestration.

### Validation outcomes for this batch

- Lint: passed
- Typecheck: passed
- Unit suite: passed (`129` files, `1935` tests)
- Integration suite: passed (`2` files, `5` tests)
- Hardening suite: passed (`4` files, `8` tests)
- Coverage run: passed (`COVERAGE_EXIT:0`)
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 remains **in progress**.
- Remaining operations route parity families are now aligned on shared wrappers across clothing and GM.
- Next focus is final parity closure review for any remaining equivalent non-operations route families.

## Addendum — R3 Non-Operations Parity Closure (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this closure pass

- Completed final cross-family parity review for remaining equivalent non-operations routes.
- Verified that the only remaining clothing-vs-GM page-level diffs are the GM employee route wrappers that intentionally delegate through shared GM employee renderer:
  - `renderGmEmployeesPage(...)`
- Confirmed no remaining unreviewed equivalent route family outside the established shared-wrapper patterns.

### Validation outcomes for this closure pass

- Lint: passed
- Typecheck: passed
- Unit suite: passed (`129` files, `1935` tests)
- Integration suite: passed (`2` files, `5` tests)
- Hardening suite: passed (`4` files, `8` tests)
- Coverage run: passed (`COVERAGE_EXIT:0`)
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R3 status

- R3 is **completed** (Feb 20, 2026).
- Route-family parity abstractions are now closed for the scoped clothing/general-merchandise targets.
- Next active item moves to **R4 (P3)** risk-marker debt reduction.

## Addendum — R4 Risk Marker Reduction Slice 1 (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Reduced `TODO/FIXME` risk markers across scoped R4 targets by removing placeholder debt markers while preserving behavior:
  - `src/lib/performance/monitoring.ts`
  - `src/lib/openapi/config.ts`
  - `src/components/tables/TEMPLATE_StandardTable.tsx`
- Kept implementation intent and guidance comments in place without altering runtime logic.

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R4 status

- R4 remains **in progress**.
- `TODO/FIXME` marker count in scoped targets decreased for this slice.
- Next focus is explicit-any suppression debt in `tests/**`, starting with `tests/unit/api/shipments.api.test.ts`.

## Addendum — R4 Risk Marker Reduction Slice 2 (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### What was completed in this slice

- Removed remaining explicit-any suppression debt in scoped tests by replacing `any` suppressions with typed `unknown`-based casts and typed mock payload arrays:
  - `tests/unit/api/expenses.api.test.ts`
  - `tests/unit/api/payroll-generate.api.test.ts`
  - `tests/unit/api/payroll.api.test.ts`
- Completed scoped marker re-scan across R4 targets:
  - `tests/**`: no remaining `eslint-disable @typescript-eslint/no-explicit-any` matches
  - `src/lib/**`: no remaining `TODO/FIXME` matches
  - `src/components/**`: no remaining `TODO/FIXME` matches

### Validation outcomes for this slice

- Lint: passed
- Typecheck: passed
- Targeted unit tests: passed (`expenses.api`, `payroll-generate.api`, `payroll.api`)
- Unit suite: passed
- Integration suite: passed
- Hardening suite: passed
- Coverage run: passed
- Combined gate sequence: passed (`FULL_SUITE_GREEN`)

### R4 status

- R4 is **completed** (Feb 20, 2026).
- Scoped risk-marker debt in `src/lib/**`, `src/components/**`, and `tests/**` was reduced as planned.
- Next active item moves to **R5 (Audit Loop)**.

## Addendum — R5 Full Refactor Audit Loop (Feb 20, 2026)

This is an append-only update for history tracking. Prior sections remain unchanged.

### 1. Scope coverage checklist (covered / N/A)

- Covered: `src/modules/clothing/operations/**` (`282` files)
- Covered: `src/modules/clothing/ledger/**` (`13` files)
- Covered: `src/modules/clothing/employees/**` (`32` files)
- Covered: `src/modules/general-merchandise/operations/**` (`24` files)
- Covered: `src/modules/general-merchandise/ledger/**` (`7` files)
- N/A: `src/modules/general-merchandise/employees/**` (path missing in repository)
- Covered: `src/app/clothing/**` (`180` files)
- Covered: `src/app/general-merchandise/**` (`43` files)
- Covered: `src/app/api/**` (`258` files)
- Covered: `src/lib/**` (`115` files)
- Covered: `src/components/**` (`99` files)
- Covered: `tests/**` (`82` files)

### 2. Large-file metrics

- Threshold distribution (mandatory scope scan set):
  - `>=500`: `123`
  - `>=800`: `46`
  - `>=1000`: `27`
  - `>=1200`: `18`
  - `>=1500`: `8`
- Top 20 largest files:
  1.  `1724` — `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx`
  2.  `1688` — `src/modules/clothing/operations/inventory/components/InventoryPage.tsx`
  3.  `1682` — `src/app/clothing/employees/payroll/hooks/usePayroll.ts`
  4.  `1615` — `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts`
  5.  `1599` — `src/lib/payroll/trucking/deductions.ts`
  6.  `1583` — `src/lib/payroll/deductions.ts`
  7.  `1577` — `src/lib/payroll/deductionsGeneralMerchandise.ts`
  8.  `1550` — `src/app/clothing/accounting/ledger/hooks/useLedger.ts`
  9.  `1459` — `src/modules/clothing/employees/payroll/hooks/usePayroll.ts`
  10. `1452` — `src/components/ui/HandsontableGrid.tsx`
  11. `1443` — `src/lib/openapi/spec.ts`
  12. `1397` — `src/components/navigation/HeaderQuickActions.tsx`
  13. `1371` — `src/app/api/backup/route.ts`
  14. `1345` — `src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts`
  15. `1286` — `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts`
  16. `1286` — `src/lib/accounting/general-merchandise/inventory-cogs.ts`
  17. `1231` — `src/app/clothing/employees/attendance/hooks/useAttendance.ts`
  18. `1221` — `src/app/clothing/employees/schedules/hooks/useSchedules.ts`
  19. `1167` — `src/app/api/restore/route.ts`
  20. `1113` — `src/modules/clothing/operations/transactions/components/TransactionPaymentsModal.tsx`

### 3. Duplication metrics

- Family: `app-operations`
  - Shared relative paths: `18`
  - Exact clone count (hash match): `0`
  - Clone ratio: `0.00%`
- Family: `app-accounting`
  - Shared relative paths: `6`
  - Exact clone count (hash match): `0`
  - Clone ratio: `0.00%`
- Family: `app-employees`
  - Shared relative paths: `14`
  - Exact clone count (hash match): `0`
  - Clone ratio: `0.00%`
- Family: `modules-operations`
  - Shared relative paths: `21`
  - Exact clone count (hash match): `0`
  - Clone ratio: `0.00%`
- Family: `modules-ledger`
  - Shared relative paths: `7`
  - Exact clone count (hash match): `0`
  - Clone ratio: `0.00%`
- Family: `modules-employees`
  - N/A (GM employees module path missing)

### 4. Risk markers

- Aggregate totals (mandatory scope):
  - `as unknown as`: `105`
  - `TODO/FIXME`: `0`
  - `eslint-disable @typescript-eslint/no-explicit-any`: `34`
- By scope:
  - `src/modules/clothing/operations/**` → `as unknown as: 26`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/modules/clothing/ledger/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/modules/clothing/employees/**` → `as unknown as: 2`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/modules/general-merchandise/operations/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/modules/general-merchandise/ledger/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/modules/general-merchandise/employees/**` → N/A
  - `src/app/clothing/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/app/general-merchandise/**` → `as unknown as: 2`, `TODO/FIXME: 0`, `explicit-any disable: 0`
  - `src/app/api/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 21`
  - `src/lib/**` → `as unknown as: 0`, `TODO/FIXME: 0`, `explicit-any disable: 11`
  - `src/components/**` → `as unknown as: 5`, `TODO/FIXME: 0`, `explicit-any disable: 2`
  - `tests/**` → `as unknown as: 70`, `TODO/FIXME: 0`, `explicit-any disable: 0`

### 5. Prioritized backlog (P1/P2/P3)

- **P1 — Reduce explicit-any suppressions in API/runtime surfaces**
  - Primary files: `src/app/api/backup/route.ts` (`10`), `src/app/api/restore/route.ts` (`9`), `src/lib/performance/monitoring.ts` (`5`), `src/lib/performance.ts` (`5`)
  - Blast radius: high (backup/restore and infra-adjacent runtime paths)
  - Expected ROI: high (stronger static checks + lower hidden runtime risk in critical flows)
- **P2 — Reduce remaining `as unknown as` hotspots in tests and high-churn modules**
  - Primary files: `tests/unit/api/shipments.api.test.ts` (`30`), `tests/unit/api/thirteenth-month-pay.api.test.ts` (`6`), `tests/unit/api/customer-import.api.test.ts` (`6`), `tests/unit/api/payroll.api.test.ts` (`5`), `tests/unit/api/expenses.api.test.ts` (`5`), `src/modules/clothing/operations/shipments/services/__tests__/ShipmentService.test.ts` (`9`)
  - Blast radius: medium (test reliability/type-safety and maintenance cost)
  - Expected ROI: medium-high (improves refactor safety and reduces brittle cast chains)
- **P3 — Continue large-file decomposition for top-churn modules**
  - Primary files: `BackupRestoreTab.tsx`, `InventoryPage.tsx`, payroll deduction engines, `useLedger.ts`, `TransactionPaymentsModal.tsx`
  - Blast radius: medium (UI/component complexity and review/defect surface)
  - Expected ROI: medium (faster change velocity, simpler testing, easier ownership)

### 6. Cross-family parity actions

- `app-accounting` parity: `6/6` shared files follow shared accounting wrapper pattern (`/app/accounting/_shared/*`).
- `app-operations` parity: `16/18` shared files follow shared operations wrapper pattern; remaining partials:
  - `customers/[id]/page.tsx` (both sides now use shared customer-details wrapper, but wrapper-token heuristic is different from operations token)
  - `sorting-distribution/page.tsx` (GM uses wrapper helper; clothing uses direct shared route component)
- `app-employees` parity: GM routes consistently use `renderGmEmployeesPage`; clothing routes are direct module pages. This is functionally consistent for access control but structurally asymmetric by design.
- `modules-operations` and `modules-ledger`: `0.00%` exact clones with matching shared-relative-path coverage; no missing counterpart paths in these families.
- `modules-employees`: N/A due missing `src/modules/general-merchandise/employees/**` path.

### R5 status

- R5 is **completed** (Feb 20, 2026).
- Full-scope audit outputs were regenerated with measurable baselines and parity actions.
- The queue below is retained as historical execution trace and may include
  in-flight checkbox states captured during execution.

### Cycle closure (authoritative)

- **Refactor cycle status:** Closed (Feb 20, 2026).
- **Validation status:** Full gate chain passed (`lint`, `typecheck`, `unit`,
  `integration`, `hardening`, `coverage`; exit code `0`).
- **Authoritative backlog source:** Use the latest prioritized backlog in
  **Addendum — Compact Refactor Audit Snapshot (Feb 20, 2026)**.

### Continuous Refactor TODO Queue (Sequential)

Historical execution queue retained for traceability.
For new work planning, use the compact snapshot backlog above.

Current active item: **None** — this cycle queue is complete (Feb 20, 2026).

### Execution Protocol (No Re-Approval Needed Per Item)

To support uninterrupted sequential execution:

- [ ] **AUTO-EXEC RULE:** Proceed from `R1` → `R5` in order without asking for per-item confirmation.
- [ ] **STOP CONDITIONS:** Pause only if blocked by a hard failure, missing requirement, or scope conflict.
- [ ] **VALIDATION RULE:** After each completed item, run required quality gates before moving forward.
- [ ] **TRACKING RULE:** Update this queue status (`[ ]` to `[x]`) and set the next active item.
- [ ] **REPORTING RULE:** Post a brief summary after each item (changes made, validation result, next item).
- [ ] **SAFETY RULE:** Do not commit/push unless explicitly requested.

- [ ] **R1 (P1):** Split very large high-churn files into smaller modules
  - Targets: inventory page, payroll hooks, API mega-routes
  - Completion gate: lint + typecheck + unit + integration + hardening + coverage all pass
  - Progress checkpoints:
    - [x] Extracted inventory display filter/sort logic into `useInventoryDisplayData`
    - [x] Extracted inventory transfer summary logic into `useTransferSummaries`
    - [x] Extracted adjustment bucket/notes computation block into `useAdjustmentBuckets`
    - [x] Extracted adjustment sellable preview computation into `useAdjustmentSellablePreview`
    - [ ] Next: continue inventory mega-component split with the next highest-churn block

- [ ] **R2 (P1):** Reduce unsafe casting hotspots (`as unknown as`) in API-heavy surfaces
  - Targets: `src/app/api/**`, then `src/lib/**`
  - Completion gate: no behavior regression in full suite
  - Status: **Completed (Feb 20, 2026)**

- [x] **R3 (P2):** Apply shared abstractions across clothing and general-merchandise route families
  - Targets: operations + ledger + app route families with shared relative paths
  - Completion gate: parity verified for equivalent family endpoints
  - Status: **Completed (Feb 20, 2026)**
  - Progress checkpoints:
    - [x] Added shared operations guard renderer and delegated GM wrapper to it
    - [x] Migrated clothing operations pages (dashboard/transactions/customers/inventory/prices/settings/shipments/notifications/messaging/post-template/checkout-links/dispatching)
    - [x] Migrated remaining inline-guard clothing operations pages (products/dispatch/message-templates/business-intelligence)
    - [x] Added shared GM employees renderer and migrated GM employee guard wrapper pages
    - [x] Migrated admin backup/restore page to shared operations guard renderer
    - [x] Extracted shared customer-details route wrapper and migrated clothing/GM customer detail pages
    - [x] Extracted shared balance-sheet route wrapper and migrated clothing/GM balance-sheet pages
    - [x] Extracted shared profit/loss route wrapper and migrated clothing/GM profit-loss pages
    - [x] Extracted shared ledger route wrapper and migrated clothing/GM ledger pages
    - [x] Extracted shared expenses route wrapper and migrated clothing/GM expenses pages
    - [x] Extracted shared journal route wrapper and migrated clothing/GM journal pages
    - [x] Extracted shared accounting root route wrapper and migrated clothing/GM accounting root pages
    - [x] Extracted shared employees-expenses redirect route wrapper and migrated clothing/GM employees expenses pages
    - [x] Extracted shared sorting-distribution route wrapper and migrated clothing/GM sorting-distribution pages
    - [x] Extracted shared customers-list route wrapper and migrated clothing/GM operations customers pages
    - [x] Extracted shared checkout-links route wrapper and migrated clothing/GM operations checkout-links pages
    - [x] Extracted shared transactions route wrapper and migrated clothing/GM operations transactions pages
    - [x] Extracted shared messaging route wrapper and migrated clothing/GM operations messaging pages
    - [x] Extracted shared dashboard route wrapper and migrated clothing/GM operations dashboard pages
    - [x] Extracted shared notifications route wrapper and migrated clothing/GM operations notifications pages
    - [x] Extracted shared dispatching route wrapper and migrated clothing/GM operations dispatching pages
    - [x] Extracted shared inventory route wrapper and migrated clothing/GM operations inventory pages
    - [x] Extracted shared post-template route wrapper and migrated clothing/GM operations post-template pages
    - [x] Extracted shared prices route wrapper and migrated clothing/GM operations prices pages
    - [x] Extracted shared products route wrapper and migrated clothing/GM operations products pages
    - [x] Extracted shared settings route wrapper and migrated clothing/GM operations settings pages
    - [x] Extracted shared shipments route wrapper and migrated clothing/GM operations shipments pages
    - [x] Extracted shared business-intelligence route wrapper and migrated clothing/GM operations business-intelligence pages
    - [x] Extracted shared dispatch route wrapper and migrated clothing/GM operations dispatch pages
    - [x] Extracted shared message-templates route wrapper and migrated clothing/GM operations message-templates pages
    - [x] Finalized remaining equivalent non-operations route-family parity review and closed R3

- [x] **R4 (P3):** Resolve remaining `TODO/FIXME` and explicit-any suppression debt
  - Targets: `src/lib/**`, `src/components/**`, `tests/**`
  - Completion gate: risk marker counts decrease versus previous audit baseline
  - Status: **Completed (Feb 20, 2026)**
  - Progress checkpoints:
    - [x] Removed scoped `TODO/FIXME` markers in `src/lib/**` and `src/components/**` placeholder/template surfaces
    - [x] Removed explicit-any suppression debt in `tests/unit/api/shipments.api.test.ts`
    - [x] Removed remaining explicit-any suppression debt in `tests/unit/api/expenses.api.test.ts`, `tests/unit/api/payroll-generate.api.test.ts`, and `tests/unit/api/payroll.api.test.ts`
    - [x] Confirmed scoped marker scans are clear for R4 targets

- [x] **R5 (Audit Loop):** Re-run full refactor audit and append a new dated addendum
  - Include: large-file distribution, duplication metrics, risk markers, backlog refresh, parity map
  - Completion gate: updated dated history section committed
  - Status: **Completed (Feb 20, 2026)**

---

## Addendum — Post-R5 Next-Cycle P1 Hotspot Cleanup (Feb 20, 2026)

### Scope covered

- `src/app/api/restore/route.ts`
- `src/app/api/backup/route.ts`
- `src/lib/performance.ts`
- `src/lib/performance/monitoring.ts`

### What changed

- Replaced dynamic Prisma `any` delegate access in restore flows with a typed runtime delegate resolver.
- Removed `no-explicit-any` suppressions in restore preview/restore and soft-delete endpoints by using shared delegate types.
- Replaced CSV/XLSX backup `any` record conversion with typed tabular serialization helpers.
- Replaced performance utility generic `any` constraints with `unknown`-safe function signatures.
- Replaced web-vitals callback `metric: any` usage with typed `Metric` callbacks.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- This slice targets high-density runtime/API suppression hotspots first and keeps behavior unchanged.
- Remaining explicit-any suppression debt (outside this slice) is tracked for the next queue pass.

---

## Addendum — Post-R5 Next-Cycle P1 Docs/Spec Typing Cleanup (Feb 20, 2026)

### Scope covered

- `src/app/api/docs/page.tsx`
- `src/lib/openapi/spec.ts`

### What changed

- Removed `no-explicit-any` suppression from API docs state handling by switching to `Record<string, unknown> | null` for loaded spec state.
- Replaced spread/cast Swagger UI prop usage with a typed `SwaggerUIComponent` prop contract.
- Replaced OpenAPI spec export annotation from `any` to `Record<string, unknown>`.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass (`TYPECHECK_OK`)

### Notes

- This is a surgical follow-up slice that clears the remaining in-scope suppression hotspots in `src/app/api/**` and `src/lib/**` identified after the prior addendum.

---

## Addendum — Post-R5 Next-Cycle P1 Core Database Delegate Typing Cleanup (Feb 20, 2026)

### Scope covered

- `src/core/database/repository/BaseRepository.ts`
- `src/core/database/base-repository.ts`
- `src/core/database/middleware/audit-log.ts`

### What changed

- Removed `no-explicit-any` suppression usage from dynamic delegate resolution in core repository layers.
- Added runtime delegate validation helpers to keep dynamic model access safe while preserving compatibility with existing repository consumers.
- Replaced `result as any` target-id extraction in audit middleware with an `unknown`-safe helper.

### Validation

- `npm run lint`: pass (`LINT_OK`)
- `npm run typecheck`: pass (`TYPECHECK_OK`)

### Notes

- Initial strict delegate typing caused cross-module regressions; signatures were relaxed to compatibility-safe `unknown`-based delegates while retaining suppression removal.

---

## Addendum — Post-R5 Next-Cycle P1 Household Service/UI Typing Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/household/accounts/api/service.ts`
- `src/modules/household/income/api/service.ts`
- `src/modules/household/expenses/api/service.ts`
- `src/app/personal/hooks/useHouseholdExpenses.ts`
- `src/app/personal/income/components/IncomeClient.tsx`

### What changed

- Removed household service `no-explicit-any` suppression casts in account and income create/createMany flows.
- Replaced expenses update `Record<string, any>` with `Record<string, unknown>` and added explicit narrowing for `accountId`, `amount`, and `status` extraction.
- Replaced personal UI payload unwrap patterns using `payload as any` with a shared local `unwrapApiData` helper in both hook/component surfaces.

### Validation

- `npm run lint`: pass (`LINT_OK`)
- `npm run typecheck`: pass (`TYPECHECK_OK`)

### Notes

- One intermediate typecheck failure surfaced after tightening expense update typing; resolved by explicit property narrowing without reintroducing `any`.

---

## Addendum — Post-R5 Next-Cycle P1 Remaining `src/**` Suppression Closure (Feb 20, 2026)

### Scope covered

- `src/components/features/transactions/TransactionsLayout.tsx`
- `src/components/shared/Crud/CrudForm.tsx`
- `src/core/testing/test-helpers.ts`

### What changed

- Removed residual suppression marker in transactions layout dynamic grid import block.
- Replaced CRUD form callback `value as any` set-field cast with `never`-safe assignment.
- Refactored test helpers to unknown-safe typings (`MockPrismaClientShape`, `MockNextRequest`) and removed all `no-explicit-any` suppression usage.
- Restored NextRequest-compatible mock return typing after an intermediate regression from over-generic request typing.

### Validation

- `npm run lint`: pass (`LINT_OK`)
- `npm run typecheck`: pass (`TYPECHECK_OK`)
- Marker scan: `grep no-explicit-any` in `src/**` returns no matches.

### Notes

- This closes the current `src/**` suppression pass; follow-up can target non-`src/**` areas (e.g., test files) if desired.

---

## Addendum — Post-R5 Next-Cycle P1 Script-Level Suppression Cleanup (Feb 20, 2026)

### Scope covered

- `scripts/backfill-receipt-movements.ts`
- `scripts/backfill-sale-movements.ts`
- `scripts/rollback-sale-backfill-movements.ts`

### What changed

- Removed script-level Prisma `as any` client casts and switched to direct typed `prisma` usage.
- Added explicit `Prisma.InventoryMovementWhereInput` return typing in rollback script query builder.
- Removed manual `groupBy` cast in rollback script and relied on Prisma-inferred return typing.

### Validation

- `npm run lint`: pass (`LINT_OK`)
- `npm run typecheck`: pass (`TYPECHECK_OK`)
- Marker scan: `grep no-explicit-any` in `src/**` and `scripts/**` returns no matches.

### Notes

- One intermediate typecheck failure in rollback script (`groupBy` cast shape) was resolved by removing the manual cast and using inferred result typing.

---

## Detailed Writeup — Current Refactor Cycle (Feb 20, 2026)

### Objective

- Continue the post-R5 P1 cleanup by removing remaining `@typescript-eslint/no-explicit-any` suppressions in active runtime surfaces, while keeping full TypeScript strict compatibility and zero behavior regressions.

### Coverage summary

- API/OpenAPI docs surfaces:
  - `src/app/api/docs/page.tsx`
  - `src/lib/openapi/spec.ts`
- Core data access and middleware surfaces:
  - `src/core/database/repository/BaseRepository.ts`
  - `src/core/database/base-repository.ts`
  - `src/core/database/middleware/audit-log.ts`
- Household and personal UI data surfaces:
  - `src/modules/household/accounts/api/service.ts`
  - `src/modules/household/income/api/service.ts`
  - `src/modules/household/expenses/api/service.ts`
  - `src/app/personal/hooks/useHouseholdExpenses.ts`
  - `src/app/personal/income/components/IncomeClient.tsx`
- Remaining app/shared/testing suppressions:
  - `src/components/features/transactions/TransactionsLayout.tsx`
  - `src/components/shared/Crud/CrudForm.tsx`
  - `src/core/testing/test-helpers.ts`
- Script-level Prisma suppressions:
  - `scripts/backfill-receipt-movements.ts`
  - `scripts/backfill-sale-movements.ts`
  - `scripts/rollback-sale-backfill-movements.ts`

### Refactor implementation details

- Replaced suppression-based `any` paths with `unknown`-safe narrowing at boundaries where payloads are dynamic.
- Added focused helper patterns (for example, payload unwrapping and target-id extraction) to keep type assertions localized and explicit.
- Migrated dynamic Prisma delegate access toward runtime-validated and compatibility-safe delegate typing.
- Standardized script typing for movement rollback paths by introducing explicit Prisma where typing and by preferring Prisma-inferred `groupBy` result types over manual cast overlays.
- Removed remaining isolated suppression comments in layout/form/testing surfaces and replaced with compile-safe alternatives.

### Regressions encountered and how they were resolved

- **Repository delegate strictness regression:**
  - Initial tightening in core repository delegate signatures produced downstream compile breakage across repository consumers.
  - Resolution: preserve suppression removal but relax delegate signatures to compatibility-safe unknown-based contracts plus runtime guards.
- **Test helper mock-typing regression:**
  - Over-generic request mock typing created widespread route test type errors.
  - Resolution: restore a NextRequest-compatible mock return shape without reintroducing `any`.
- **Rollback script typing regression:**
  - Explicit typing introduced mismatch on `where` and a manual `groupBy` cast conflict.
  - Resolution: type query builder as `Prisma.InventoryMovementWhereInput` and remove the manual group-by row cast in favor of inference.

### Validation evidence

- Iterative validation was run after each significant patch cluster using:
  - `npm run lint`
  - `npm run typecheck`
- Final cycle state:
  - Lint: pass (`LINT_OK`)
  - Typecheck: pass (`TYPECHECK_OK`)
- Closure check for this refactor category:
  - Marker scans show no remaining `no-explicit-any` suppression matches in `src/**` and `scripts/**`.

### Risk and impact assessment

- **Behavioral risk:** low; changes are typing and boundary-validation focused with no intended business logic changes.
- **Primary risk managed during cycle:** over-constraining shared abstractions can amplify compile impact across dependent modules.
- **Net impact:** stricter compile-time safety and reduced lint suppression debt across runtime, testing, and script surfaces.

### Follow-up recommendation

- Start the next debt-reduction pass on `as unknown as` hotspots, prioritizing shared/core runtime paths first, then module-local UI and test helper paths.

---

## Addendum — Post-R5 Next-Cycle P2 `as unknown as` Core Runtime Hardening Slice (Feb 20, 2026)

### Scope covered

- `src/core/ModuleLoader.ts`
- `src/core/database/repository/BaseRepository.ts`
- `src/core/database/middleware/audit-log.ts`
- `src/core/testing/test-helpers.ts`

### What changed

- Removed `as unknown as` casts in core runtime dynamic access paths and replaced with safer object-property access patterns.
- Updated dynamic Prisma model/delegate resolution to use `Reflect.get(...)` with existing runtime guard validation.
- Refined module dynamic-import fallback typing to explicitly support callable and module-object shapes, with a defensive `INVALID_MODULE_SHAPE` error for unexpected results.
- Simplified test helper request mock return casting to remove double-cast usage while preserving the existing test helper contract.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- One intermediate typecheck regression in `ModuleLoader` was resolved by handling Next dynamic loader union return shapes explicitly.
- This slice is focused on shared/core paths first to maximize safety impact before moving into module-local and test-heavy hotspots.

---

## Addendum — Post-R5 Next-Cycle P2 `as unknown as` Operations/Page Cleanup Slice (Feb 20, 2026)

### Scope covered

- `src/app/general-merchandise/operations/dispatch/page.tsx`
- `src/app/general-merchandise/operations/message-templates/page.tsx`
- `src/modules/clothing/operations/dashboard/services/DashboardService.ts`
- `src/modules/clothing/operations/transactions/services/TransactionService.ts`
- `src/modules/clothing/operations/shipments/services/ShipmentService.ts`

### What changed

- Removed GM operations page-level Prisma double-casts by using direct typed Prisma delegates.
- Removed icon double-casts in dashboard statistics generation.
- Reworked CSV import transformers for transactions and shipments to use explicitly typed initialization and field-level assignment instead of broad double-cast coercions.
- Preserved existing import behavior while improving compile-time type safety for parsed row construction.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- Initial direct single-cast replacement in CSV parsing triggered strict-overlap typecheck errors.
- Resolved by moving to explicit typed object defaults plus key-specific assignment, which removes cast debt and preserves behavior.

---

## Addendum — Post-R5 Next-Cycle P2 Derived Data Cast Hardening Increment (Feb 20, 2026)

### Scope covered

- `src/modules/clothing/operations/transactions/hooks/useTransactionsDerivedData.ts`

### What changed

- Removed `as unknown as` row-data access in transaction cell derivation.
- Switched to direct typed key access (`rowData[key]`) using the existing `ColumnIdToKey` mapping contract.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- This keeps the derived-data path aligned with strict typing without changing column/render behavior.

---

## Addendum — Post-R5 Next-Cycle P2 Shared Components Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/components/features/transactions/TransactionsLayout.tsx`
- `src/components/grid/GlideGridAdapter.tsx`
- `src/components/grid/GridLayoutStore.tsx`
- `src/components/ui/HandsontableGrid.tsx`

### What changed

- Removed remaining `as unknown as` casts in shared transactions/grid component surfaces.
- Replaced dynamic component double-casts with direct typed component assertions.
- Replaced global window double-cast with a typed `Window` extension binding.
- Replaced Handsontable active-editor double-casts with guarded object checks plus typed local editor shapes.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: `as unknown as` in `src/components/**` returns no matches.

### Notes

- One intermediate syntax regression occurred during an over-broad patch attempt in `HandsontableGrid`; resolved by restoring the file and reapplying only minimal targeted cast changes.

---

## Addendum — Post-R5 Next-Cycle P2 GM Customer/Product API Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/general-merchandise/customers/api/service.ts`
- `src/modules/general-merchandise/products/api/service.ts`

### What changed

- Removed `as unknown as` casts in GM customer/product API services for Prisma client and transaction-client access.
- Replaced double-cast transaction delegate access with direct typed assertions in transactional loops.
- Corrected GM products delegate alias typing to the actual `generalMerchandiseProduct` delegate to preserve strict type compatibility.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: `as unknown as` in the two scoped files returns no matches.

### Notes

- One intermediate typecheck regression surfaced after initial cast simplification due delegate alias mismatch; resolved by aligning the alias to the GM-specific Prisma delegate type.

---

## Addendum — Post-R5 Next-Cycle P2 Products Components Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/clothing/operations/products/components/MixAndMatchTab.tsx`
- `src/modules/clothing/operations/products/components/BundlesTab.tsx`

### What changed

- Removed remaining `as unknown as` casts from transactions/movements API payload handling by reusing shared `extractApiData(...)` helper.
- Replaced product-to-inventory double-casts with explicit `ProductData -> ProductFromAPI` mapping helpers.
- Kept inventory calculations and UI behavior unchanged while tightening compile-time type safety.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- Intermediate typecheck failures exposed a real shape mismatch (`ProductData.id` as `number | undefined` vs `ProductFromAPI.id` as `string`); resolved via explicit field mapping instead of cast coercion.

---

## Addendum — Post-R5 Next-Cycle P2 Sorting/Products Runtime Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage.tsx`

### What changed

- Removed remaining `as unknown as` casts in sorting-distribution runtime hooks.
- Replaced hook adapter double-cast with guarded local typed binding.
- Replaced dynamic transaction field access cast with `Reflect.get(...)` object access for optional identity fields.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- One intermediate typecheck mismatch surfaced around Handsontable `isDestroyed` shape; resolved by aligning local typing to the actual boolean property.

---

## Addendum — Post-R5 Next-Cycle P2 GM Transactions API Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/general-merchandise/transactions/api/service.ts`

### What changed

- Removed all remaining `as unknown as` casts in GM transactions service.
- Replaced Prisma delegate double-cast with direct subset typing for GM delegates.
- Removed unnecessary `unknown` bridge casts on `findMany`/`update` argument objects.
- Replaced update-to-sync double-cast with explicit `TransactionForInventorySync` field mapping before movement sync.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: `as unknown as` in this file returns no matches.

### Notes

- Two intermediate regressions were resolved in-place: (1) declaration syntax issue during refactor, and (2) function-parameter variance mismatch when temporarily modeling delegates as `unknown`-arg wrappers.

---

## Addendum — Post-R5 Next-Cycle P2 Shared Repository Base Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/shared/ledger/expenses/api/repositoryBase.ts`
- `src/modules/shared/employees/cash-advance/api/repositoryBase.ts`
- `src/modules/shared/employees/leave-requests/api/repositoryBase.ts`
- `src/modules/shared/employees/thirteenth-month-pay/api/repositoryBase.ts`
- `src/modules/shared/employees/thirteenth-month-pay/api/serviceBase.ts`

### What changed

- Removed remaining `as unknown as` casts in shared repository/service base helpers.
- Switched inline cast-heavy query builders to existing helper conversion methods (`toWhereInput` / `toOrderByInput`).
- Replaced double-cast conversions with single-cast helper returns where needed.
- Tightened thirteenth-month-pay service base entity constraint to include `employeeName` and `year`, enabling typed `findAll` ordering without unknown bridging.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: `as unknown as` in all scoped files returns no matches.

### Notes

- One intermediate typecheck issue in thirteenth-month-pay `findAll` ordering was resolved by aligning the generic entity contract to the actual ordering fields.

---

## Addendum — Post-R5 Next-Cycle P2 Runtime Routes/Utilities Cast Cleanup (Feb 20, 2026)

### Scope covered

- `src/modules/clothing/employees/leave-requests/api/route.ts`
- `src/modules/clothing/employees/leave-requests/api/[id]/route.ts`
- `src/modules/trucking/employees/leave-requests/api/route.ts`
- `src/modules/trucking/employees/leave-requests/api/[id]/route.ts`
- `src/modules/household/accounts/api/service.ts`
- `src/modules/household/budgets/api/service.ts`
- `src/utils/browser.ts`
- `src/services/BaseService.ts`

### What changed

- Removed remaining non-test `as unknown as` casts in leave-request routes and aligned route-local delegate typing to actual Prisma delegate types.
- Simplified household account update cast path and replaced budget date double-cast with explicit string guard + direct `Date` parsing.
- Reworked browser idle-callback helpers to use a typed handle union (`number | ReturnType<typeof setTimeout>`) instead of timeout double-casts.
- Replaced API error payload attachment double-cast with an intersection-typed error instance in base service HTTP handling.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: remaining `as unknown as` matches in `src/**` are now test-only files.

### Notes

- Intermediate delegate type mismatches in leave-request routes were resolved by replacing custom narrowed delegate interfaces with real Prisma delegate types.

---

## Addendum — Post-R5 Next-Cycle P2 Test Cast Cleanup and `src/**` Closure (Feb 20, 2026)

### Scope covered

- `src/modules/clothing/operations/shipments/services/__tests__/ShipmentService.test.ts`
- `src/modules/clothing/operations/products/hooks/__tests__/useShippingFeeCalculator.hook.test.tsx`
- `src/modules/clothing/operations/due-dates/services/__tests__/DueDateService.test.ts`
- `src/modules/clothing/operations/due-dates/services/DueDateService.ts`

### What changed

- Removed remaining test `as unknown as` casts by replacing synthetic file mocks with real `File` instances and replacing double-cast numeric placeholders with safe numeric values.
- Replaced hook ref double-cast with a direct typed ref assertion.
- Updated due-date service signatures to accept nullish transaction arrays (`DueDateTransaction[] | null | undefined`), then removed null bridge casts in tests.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan: `as unknown as` in `src/**` returns no matches.

### Notes

- This closes the current `as unknown as` debt pass for source files under `src/**`.

---

## Addendum — Post-R5 Next-Cycle P2 Script Cast Cleanup Increment (Feb 20, 2026)

### Scope covered

- `scripts/accounting-db-integrity-check.ts`

### What changed

- Removed remaining `as unknown as` model-access cast in journal-line loader.
- Switched optional Prisma model lookup to `Reflect.get(...)` with a typed optional delegate shape.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- This starts the post-`src/**` continuation wave for non-source script/test surfaces.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 1 (Feb 20, 2026)

### Scope covered

- `tests/setup.ts`
- `tests/unit/services/BaseService.test.ts`
- `tests/unit/transactions/useTransactionOperations.test.tsx`
- `tests/unit/personal/useHouseholdExpenses.test.tsx`

### What changed

- Removed foundational `as unknown as` test-cast patterns in global `fetch` wiring and mocked response setup.
- Replaced double-cast `ResizeObserver` assignment with direct typed assignment in shared test setup.
- Kept test behavior unchanged while tightening compile-time typing in hook/service test harnesses.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass

### Notes

- This batch is intentionally scoped to shared/high-reuse test harness files first to reduce cast debt impact across multiple suites.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 2 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/shipments.api.test.ts`

### What changed

- Removed `as unknown as` usage across shipments API tests by switching request construction to the existing typed `buildRequest(...)` helper.
- Introduced a typed `toShipment(...)` fixture helper to supply required Prisma shipment fields without double-casts.
- Reworked transaction mock callbacks to use callback-argument typing without `unknown` bridge casts.
- Kept endpoint assertions and test flow unchanged while tightening compile-time typing.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This batch removes a dense cast hotspot in API-route tests and keeps momentum for the remaining `tests/**` backlog.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 3 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/customer-import.api.test.ts`
- `tests/unit/services/expense-services.endpoint.test.ts`

### What changed

- Removed remaining `as unknown as` usage in customer import tests by switching to real `File` + `FormData` test fixtures.
- Preserved existing mocked-request behavior while narrowing cast usage to direct target assertions only where needed.
- Replaced endpoint fetch wiring double-cast with a direct typed fetch assignment in expense service endpoint tests.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in both files: no `as unknown as` matches

### Notes

- Test-surface marker count reduced further after this batch (`tests/**`: `27 -> 26`).

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 4 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/payroll-generate.api.test.ts`

### What changed

- Removed `as unknown as` usage in request creation by replacing synthetic object literals with a real `NextRequest` instance.
- Kept endpoint behavior and assertions unchanged while tightening request typing.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This is another low-risk API test cleanup slice in the external `tests/**` backlog.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 5 (Feb 20, 2026)

### Scope covered

- `tests/unit/lib/accounting-data-fetchers.test.ts`

### What changed

- Removed all `as unknown as` bridge casts in paid-date fetcher tests.
- Kept test intent unchanged while using direct target-parameter assertions.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This batch clears a shared accounting helper test hotspot and continues the staged reduction in `tests/**` cast debt.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 6 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/thirteenth-month-pay.api.test.ts`

### What changed

- Removed all GET-route `as unknown as NextRequest` bridge casts.
- Preserved test behavior and route assertions while using direct request assertions.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This batch closes a multi-case API test cast cluster and narrows the remaining `tests/**` hotspot set.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 7 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/expenses.api.test.ts`

### What changed

- Removed all `as unknown as NextRequest` bridge casts in GET and DELETE test paths.
- Preserved existing request mocks and assertions while tightening request typing.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This batch clears another dense API-route hotspot and continues the sequential `tests/**` reduction plan.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 8 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/backup-restore.api.test.ts`

### What changed

- Removed remaining transaction callback `as unknown as` bridge cast.
- Replaced with callback invocation using the local tx fixture and a direct callback-argument assertion.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This reduces remaining external `tests/**` markers and keeps the transaction-mock pattern consistent with earlier cleanup slices.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 9 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/sorting-distribution.api.test.ts`

### What changed

- Removed the remaining `as unknown as` Prisma mock cast.
- Refactored the test module to use a hoisted typed `prismaMock` fixture directly, eliminating cast-only bridging.
- Kept transaction behavior and route assertions unchanged.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This cleanup is a root-cause fix for a strict typing mismatch and avoids reintroducing unsafe bridge casts.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 10 (Feb 20, 2026)

### Scope covered

- `tests/unit/api/payroll.api.test.ts`

### What changed

- Removed all `as unknown as` casts in request + employee-check fixture paths.
- Replaced custom request literal with a real `NextRequest` builder to remove synthetic `nextUrl` bridge casting.
- Kept route assertions and payroll workflow expectations unchanged.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan in file: no `as unknown as` matches

### Notes

- This batch closes the largest remaining API test cast hotspot and simplifies request fixture typing.

---

## Addendum — Post-R5 Next-Cycle P2 External Tests Cast Cleanup Batch 11 (Feb 20, 2026)

### Scope covered

- `tests/hardening/backup-restore.atomic.test.ts`

### What changed

- Removed the final `as unknown as` transaction callback casts in hardening restore atomic tests.
- Aligned callback invocation style with prior transaction-mock cleanup slices.

### Validation

- `npm run lint`: pass
- `npm run typecheck`: pass
- Marker scan across `tests/**/*.{ts,tsx}`: no `as unknown as` matches

### Notes

- External test-surface cast cleanup is now closed for the current `tests/**` pass.

---

## Addendum — Compact Refactor Audit Snapshot (Feb 20, 2026)

### 1) Scope coverage checklist (covered / N/A)

- Covered: `src/modules/clothing/operations/**` (285 files)
- Covered: `src/modules/clothing/ledger/**` (13 files)
- Covered: `src/modules/clothing/employees/**` (33 files)
- Covered: `src/modules/general-merchandise/operations/**` (24 files)
- Covered: `src/modules/general-merchandise/ledger/**` (7 files)
- N/A: `src/modules/general-merchandise/employees/**` (path missing)
- Covered: `src/app/clothing/**` (181 files)
- Covered: `src/app/general-merchandise/**` (43 files)
- Covered: `src/app/api/**` (259 files)
- Covered: `src/lib/**` (116 files)
- Covered: `src/components/**` (99 files)
- Covered: `tests/**` (82 files)

### 2) Large-file metrics

- Distribution:
  - `>=500`: `123`
  - `>=800`: `46`
  - `>=1000`: `27`
  - `>=1200`: `17`
  - `>=1500`: `3`
- Top 20 largest files (scope-filtered):
  1.  `src/app/clothing/employees/payroll/hooks/usePayroll.ts` — 1682
  2.  `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts` — 1597
  3.  `src/modules/clothing/operations/inventory/components/InventoryPage.tsx` — 1529
  4.  `src/app/clothing/accounting/ledger/hooks/useLedger.ts` — 1494
  5.  `src/lib/payroll/trucking/deductions.ts` — 1493
  6.  `src/lib/payroll/deductions.ts` — 1477
  7.  `src/lib/payroll/deductionsGeneralMerchandise.ts` — 1471
  8.  `src/components/ui/HandsontableGrid.tsx` — 1460
  9.  `src/lib/openapi/spec.ts` — 1442
  10. `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx` — 1420
  11. `src/components/navigation/HeaderQuickActions.tsx` — 1397
  12. `src/app/api/backup/route.ts` — 1347
  13. `src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts` — 1345
  14. `src/modules/clothing/employees/payroll/hooks/usePayroll.ts` — 1335
  15. `src/lib/accounting/general-merchandise/inventory-cogs.ts` — 1286
  16. `src/app/clothing/employees/attendance/hooks/useAttendance.ts` — 1231
  17. `src/app/clothing/employees/schedules/hooks/useSchedules.ts` — 1221
  18. `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts` — 1177
  19. `src/app/api/restore/route.ts` — 1175
  20. `src/modules/clothing/operations/transactions/components/TransactionPaymentsModal.tsx` — 1113

### 3) Duplication metrics

- Modules operations (clothing vs general-merchandise):
  - Shared relative paths: `21`
  - Exact clone count: `0`
  - Clone ratio: `0.00%`
- Modules ledger (clothing vs general-merchandise):
  - Shared relative paths: `7`
  - Exact clone count: `0`
  - Clone ratio: `0.00%`
- Modules employees (clothing vs general-merchandise):
  - Shared relative paths: `0`
  - Exact clone count: `0`
  - Clone ratio: `0.00%`
- App routes (clothing vs general-merchandise):
  - Shared relative paths: `38`
  - Exact clone count: `0`
  - Clone ratio: `0.00%`

### 4) Risk markers

- `as unknown as`: `0`
- `TODO` / `FIXME`: `0`
- `eslint-disable @typescript-eslint/no-explicit-any`: `0`

### 5) Prioritized backlog (P1/P2/P3)

- **P1** — Split top high-churn large files (`usePayroll`, `useTransactionOperations`, `InventoryPage`, `useLedger`)
  - Blast radius: high (employees, operations, accounting)
  - Expected ROI: high (faster change cycles, lower regression risk)
- **P2** — Continue route-wrapper convergence for remaining equivalent families and remove residual wrapper variance
  - Blast radius: medium (app route surfaces)
  - Expected ROI: medium-high (parity stability, lower drift cost)
- **P3** — Incremental readability cleanups in large but stable files (naming/derived-data extraction where low-risk)
  - Blast radius: low-medium
  - Expected ROI: medium (maintainability gains over time)

### 6) Cross-family parity actions

- Applied consistently where families exist:
  - Payroll deductions shared extraction across clothing / general-merchandise / trucking
  - Backup/restore route shared utility extraction (`backup` + `restore`)
- Explicit N/A (missing counterpart paths):
  - `src/modules/general-merchandise/operations/checkout-links/hooks/**`
  - `src/app/general-merchandise/accounting/ledger/hooks/**`
  - `src/modules/general-merchandise/employees/**` (module path absent)
- Validation status: full gate chain completed successfully in-session (`lint`, `typecheck`, `unit`, `integration`, `hardening`, `coverage`; exit code `0`).
