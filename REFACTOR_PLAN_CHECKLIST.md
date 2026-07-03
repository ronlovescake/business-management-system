# Current Refactor Plan Checklist

Created: 2026-07-04

Purpose: step-by-step execution tracker for the current refactor plan. This file is scoped to the recent in-depth analysis and does not replace `CHECKLIST.md`, which remains the long-running repo-wide refactor history.

## How To Use This Checklist

- Work top to bottom unless a production bug forces a narrower detour.
- Keep each checkbox to one reviewable change set.
- Do not mix schema, API behavior, UI decomposition, and test cleanup in the same change set.
- Before marking an item complete, record the validation command and result in the notes under that item or in the PR/commit message.
- If a phase touches backup/restore, accounting, inventory, payroll, auth, or Prisma schema, run the high-risk validation gate for that phase before moving on.

## Global Refactor Contract

- [ ] Preserve business-domain isolation: clothing, general merchandise, trucking, household, and platform/admin keep their own route namespaces and Prisma bindings.
- [ ] Keep shared code data-source agnostic; pass delegates/config instead of importing a domain model inside shared modules.
- [ ] Avoid destructive schema or data operations unless explicitly approved with a rollback plan.
- [ ] Do not weaken auth, route access, scheduler tokens, or backup/restore checks to simplify a refactor.
- [ ] Do not rely on note text, UI labels, or display strings as a long-term relational contract when a stable field can exist.
- [ ] Add or update tests before behavior-sensitive cleanup in accounting, inventory, backup/restore, payroll, and auth.
- [ ] Update relevant docs in the same change set when behavior, commands, routes, scheduler policy, or operational expectations change.

## Validation Setup

- [x] Start from a clean baseline or clearly document unrelated local changes.
- [x] Start the Docker test database when running integration or full validation:

```bash
docker compose -f docker-compose.test.yml up -d --wait
```

- [ ] For full validation with DB-gated accounting/inventory controls, load the test env first when using the local shell:

```bash
set -a; . ./.env.test; set +a
npm run accounting:transactions:sanitycheck
npm run inventory:ledger:controls
```

- [ ] Default meaningful-change gate:

```bash
npm run guardrails:check
npm run lint
npm run typecheck
```

- [ ] High-risk gate for backup/restore, accounting, inventory, payroll, auth, API handlers, or schema work:

```bash
npm run test:unit
npm run test:integration
npm run test:hardening
```

- [ ] Full confidence gate before a broad refactor handoff:

```bash
npm run test:full
```

## Phase 0 - Baseline And Policy Drift

- [x] Run repository status check and confirm the starting worktree state.
- [x] Run the existing full validation gate and capture failures.
- [x] Fix backup scheduler retention policy drift by aligning tests/docs to the current 14-day runtime default.
  - Files: `tests/unit/backup/backupSchedulerSidecar.rules.test.ts`, `tests/unit/backup/scheduledBackupRunner.rules.test.ts`, `docs/business-logic/platform/scheduler-and-internal-job-orchestration.md`
  - Targeted validation: `npx vitest run tests/unit/backup/backupSchedulerSidecar.rules.test.ts tests/unit/backup/scheduledBackupRunner.rules.test.ts`
- [x] Confirm integration tests pass after starting the Docker test DB.
- [x] Confirm accounting and inventory DB-gated checks pass against the test DB.

## Phase 1 - Scheduler Config Single Source

Goal: remove the duplicated scheduler config surface that made backup retention policy drift easy.

- [x] Decide the single source of truth for scheduler constants and parsers.
  - Current duplicate files: `scripts/schedulerConfigShared.js`, `src/lib/backup/schedulerConfigShared.js`
  - Constraint: `scripts/run-backup-scheduler.js` is CommonJS and runs outside the Next/TS bundle.
- [x] Replace one copy with a generated or imported wrapper so updates cannot silently diverge.
  - Done: `scripts/schedulerConfigShared.js` now delegates to the app-owned `src/lib/backup/schedulerConfigShared.js` implementation.
- [x] Keep the public TypeScript facade stable in `src/lib/backup/schedulerConfig.ts`.
- [x] Add a regression check that proves the script-side and app-side config values match.
  - Done: `src/lib/__tests__/backupSchedulerConfig.test.ts` compares script-side and app-side scheduler config exports.
- [x] Validate:

```bash
npx vitest run src/lib/__tests__/backupSchedulerConfig.test.ts tests/unit/backup/backupSchedulerSidecar.rules.test.ts tests/unit/backup/scheduledBackupRunner.rules.test.ts
npm run guardrails:check
```

Validation note: the focused Vitest command passed on 2026-07-04 with 3 files / 61 tests. `npm run guardrails:check` passed after regenerating route-permission artifacts with `npm run codegen:route-permissions`. `npm run typecheck` passed. `npm run lint` passed with pre-existing warnings in accounting data fetchers and `SplitTab.tsx`.

## Phase 2 - Backup And Restore Hardening

Goal: reduce operational risk without changing backup artifact contracts unexpectedly.

- [x] Audit backup model coverage against the current Prisma schema.
  - File to inspect: `src/lib/backup/backupModelRegistry.ts`
  - Desired guard: new Prisma models must be classified as selective, log, dump-only, or intentionally excluded.
- [x] Review `src/app/api/backup/route.ts` for remaining sync file operations that should use the existing atomic helper in `src/app/api/backup/backupRouteFileOps.ts`.
  - Done: backup artifact writes already use `writeFileAtomic` or `writeWorkbookToFile`; remaining sync operations are directory creation, cleanup deletion, listing, and manifest reads.
- [x] Centralize internal backup job token validation if any internal route currently relies on caller-side checks only.
  - Done: added neutral `src/lib/internal-jobs/auth.ts`; backup, PITR, maintenance pruning, inventory controls, and employee automation internal routes now use the shared token validator directly or through the existing employee automation facade.
- [x] Keep admin-facing backup/restore authorization separate from internal sidecar authorization.
  - Done: admin routes continue to use `requireBackupRestoreAdmin`; internal sidecar routes use `requireInternalToken`.
- [x] Validate:

```bash
npm run backup:audit
npx vitest run tests/unit/backup
npm run test:hardening
```

Validation note: `npm run backup:audit` passed on 2026-07-04 for 120 Prisma models. Focused backup/internal Vitest passed with 19 files / 247 tests. `npm run test:hardening` passed with 4 files / 12 tests. `npm run typecheck` passed. `npm run lint` passed with pre-existing warnings in accounting data fetchers and `SplitTab.tsx`.

## Phase 3 - Inventory Movement Traceability

Goal: stop using auto-movement note text as the durable link between transactions, inventory movements, and COGS.

- [x] Design an additive schema change for auto-generated inventory movements.
  - Candidate fields: `transactionId`, `movementType`, `movementSource`, or equivalent domain-specific nullable references.
  - Current note writer: `src/modules/transactions/api/transactionInventorySync.ts`
  - Current note readers: `src/lib/accounting/inventory-cogs.ts`, `src/lib/accounting/general-merchandise/inventoryCogsHelpers.ts`, resync scripts.
- [x] Add nullable fields first; do not remove existing notes parsing in the same change.
- [x] Backfill new fields from existing notes with an auditable script and dry-run output.
- [x] Update new auto-movement writes to populate explicit fields and keep notes human-readable.
- [x] Update COGS lookup to prefer explicit fields and fall back to legacy notes.
- [x] Add tests proving old notes and new explicit fields both work during the transition.
- [x] Validate:

```bash
npx vitest run src/lib/accounting/__tests__/inventory-cogs.test.ts src/lib/accounting/general-merchandise/__tests__/inventory-cogs.test.ts
npx vitest run tests/unit/transactions/transactionInventorySync.test.ts tests/unit/transactions/transactionService.rules.test.ts
npm run inventory:ledger:controls
npm run accounting:transactions:sanitycheck
```

Validation note: added nullable `sourceTransactionId`, `movementSource`, and `movementType` fields to clothing and general-merchandise inventory movements. `npm run db:generate` passed, and the additive schema was pushed to the Docker test DB with `.env.test`. Focused COGS/transaction Vitest passed with 4 files / 56 tests. Dry-run traceability backfill completed with `npm run -s inventory:movements:backfill-traceability -- --domain all --limit 10`. `npm run inventory:ledger:controls` passed. `npm run accounting:transactions:sanitycheck` passed with 1 scanned transaction / 0 issues.

## Phase 4 - Shared COGS Engine

Goal: consolidate clothing and general-merchandise COGS behavior only after traceability is explicit and covered.

- [x] Identify logic that is truly shared between `src/lib/accounting/inventory-cogs.ts` and `src/lib/accounting/general-merchandise/inventory-cogs.ts`.
- [x] Extract pure helpers first; keep Prisma model selection domain-local.
- [x] Introduce a shared engine that accepts delegates/config for product, movement, shipment, and transaction access.
- [x] Preserve domain-specific account names, schema bindings, and route behavior.
- [x] Add parity tests for clothing and general merchandise using the same fixtures where possible.
- [x] Validate:

```bash
npx vitest run src/lib/accounting/__tests__/inventory-cogs.test.ts src/lib/accounting/general-merchandise/__tests__/inventory-cogs.test.ts
npx vitest run src/app/api/accounting/profit-loss/__tests__/route.test.ts src/app/api/general-merchandise/accounting/balance-sheet/__tests__/route.test.ts
npm run inventory:ledger:controls
npm run accounting:transactions:sanitycheck
```

Validation note: added neutral `src/lib/accounting/inventoryCogsShared.ts` for shared COGS helpers and movement-to-journal grouping. Clothing and general-merchandise Prisma reads remain domain-local and pass account/config values into the shared engine. Focused COGS Vitest passed with 2 files / 8 tests. Accounting route Vitest passed with 2 files / 7 tests. `npm run inventory:ledger:controls` passed. `npm run accounting:transactions:sanitycheck` passed with 1 scanned transaction / 0 issues.

## Phase 5 - Large Page And Hook Decomposition

Goal: reduce high-churn UI/controller files without changing behavior.

- [ ] Decompose `src/modules/clothing/operations/transactions/components/TransactionsPage.tsx`.
  - [ ] Extract tab/search/filter orchestration.
  - [ ] Extract payments modal coordination.
  - [ ] Extract customer detail modal coordination.
  - [ ] Keep `apiBasePath` behavior intact for general-merchandise wrappers.
- [ ] Decompose `src/modules/clothing/operations/inventory/components/InventoryPage.tsx`.
  - [ ] Group adjustment submit/edit/selection/quick-adjust logic behind a composite hook.
  - [x] Group inventory display/derived movement data behind a composite hook.
    - Done: extracted `src/modules/clothing/operations/inventory/hooks/useInventoryViewModel.ts` to compose inventory display filtering, movement-derived maps, transfer summaries, adjustment bucket notes, product options, totals, and sellable preview data for the page.
  - [x] Keep component-level tests focused on rendered states and callbacks.
    - Done: added `src/modules/clothing/operations/inventory/hooks/__tests__/useInventoryViewModel.test.tsx` alongside the existing `InventoryPage.test.tsx` coverage.
- [ ] Decompose `src/modules/clothing/employees/dashboard/components/EmployeeDashboardPage.tsx`.
  - [ ] Extract chart/data transform hooks.
  - [x] Extract focused metric/chart components.
    - Done: extracted pure `ChartEmptyState` into `src/modules/clothing/employees/dashboard/components/ChartEmptyState.tsx`.
- [ ] Decompose backup/settings hotspots only after backup behavior tests are green.
  - [ ] Candidates: `ChangeLogPage.tsx`, `BackupPreviewModal.tsx`, `PitrInvestigationTab.tsx`, `useBackupRestorePreviewController.ts`
- [x] Validate after each touched file family, not after the entire UI phase:

```bash
npx vitest run <touched test files>
npm run lint
npm run typecheck
```

Validation note: dashboard component extraction passed editor diagnostics, `npm run typecheck`, and `npm run lint` on 2026-07-04. InventoryPage view-model extraction passed focused Vitest with 2 files / 4 tests, `npm run lint`, and `npm run typecheck`; lint still reports the known pre-existing warnings in accounting data fetchers and `SplitTab.tsx`. Regression double-check after Phase 5 updates passed focused Phase 5 Vitest with 3 files / 5 tests, `npm run guardrails:check`, `npm run lint`, `npm run typecheck`, and `npm run test:full` with exit code 0. Because `test:full` skipped DB-gated checks without `DATABASE_URL`, the Docker test DB was started and `.env.test` was loaded for `npm run accounting:transactions:sanitycheck` and `npm run inventory:ledger:controls`; both passed, with inventory controls returning exit code 0. Remaining Phase 5 work is now limited to the still-open UI hotspots and any deeper modal/component extraction selected as a follow-up slice.

## Phase 6 - API Route Factory And Delegate Typing

Goal: reduce repeated route orchestration while preserving domain-specific Prisma delegates and route namespaces.

- [x] Inventory existing route factories before adding new ones.
  - Current examples: `src/modules/transactions/api/routeFactory.ts`, `src/modules/products/api/routeFactory.ts`, `src/modules/shared/employees/api/*RouteFactory.ts`, `src/modules/shared/ledger/*/api/*`.
- [x] Prefer extending an existing route factory over creating another near-duplicate abstraction.
- [x] Replace structural `any` only where a typed delegate keeps concrete Prisma compatibility.
- [x] Keep route files as thin domain wrappers that bind delegates, permissions, and route namespace.
- [x] Validate:

```bash
npm run lint
npm run typecheck
npm run test:unit -- tests/unit/api
```

Validation note: kept the existing shipment detail route factory and replaced its explicit `any` delegate contract with narrow typed operation shapes. Clothing and general-merchandise route files remain thin delegate binders. Focused shipment detail business tests passed with 1 file / 18 tests. Full API unit slice passed with 110 files / 891 tests. `npm run lint` passed with known pre-existing warnings. `npm run typecheck` passed.

## Phase 7 - Coverage And Regression Hardening

Goal: make future refactors cheaper by covering the seams being extracted.

- [ ] Add hook tests for extracted transaction and inventory orchestration hooks.
  - Progress: added focused coverage for `useInventoryViewModel`; transaction hook extraction and remaining inventory modal extraction remain follow-up slices.
- [ ] Add parity tests for clothing and general-merchandise wrappers that share clothing components with `apiBasePath`.
  - Deferred: no shared wrapper behavior changed in this slice.
- [ ] Add integration tests around sale -> reserve/sold movement -> accounting/COGS reporting.
- [x] Add backup scheduler tests that fail on script/app config divergence.
  - Done in Phase 1 with `src/lib/__tests__/backupSchedulerConfig.test.ts`.
- [x] Add regression tests for newly extracted/shared seams.
  - Done: `src/lib/accounting/__tests__/inventoryCogsShared.test.ts`, `src/modules/clothing/employees/dashboard/components/__tests__/ChartEmptyState.test.tsx`, and `src/modules/clothing/operations/inventory/hooks/__tests__/useInventoryViewModel.test.tsx`.
- [ ] Ratchet coverage thresholds only after the new coverage is stable locally and in CI.
- [x] Validate:

```bash
npm run test:coverage:enforce
npm run test:integration
```

Validation note: new regression tests passed with the paired COGS tests: 4 files / 11 tests. `npm run test:coverage:enforce` passed with 286 files / 3521 tests. `npm run test:integration` passed with 3 files / 9 tests.

## Phase 8 - Documentation And Handoff Hygiene

Goal: keep the refactor understandable to the next developer and safe for operators.

- [x] Update business-logic docs when accounting, inventory, backup, scheduler, or route behavior changes.
  - Done: transaction movement docs and P&L docs now describe explicit movement traceability and shared COGS fallback behavior.
- [x] Update operational docs when commands, env vars, Docker setup, backup retention, or validation workflow changes.
  - Done: `docs/inventory-ledger-controls.md` documents the dry-run/apply traceability backfill command.
- [x] Record deliberate defer decisions in this checklist so they are not rediscovered as fresh mysteries later.
  - Deferred: remaining InventoryPage modal/component extraction, TransactionsPage decomposition, shared `apiBasePath` wrapper parity tests, and sale -> reserve/sold -> accounting integration coverage remain follow-up slices.
- [x] Keep final handoff summaries focused on files changed, behavior changed, validation run, and residual risk.

## Final Pre-Handoff Checklist

- [x] `git --no-pager status --short` reviewed.
- [x] No unrelated user changes were reverted.
- [x] New or changed tests cover the behavior-sensitive part of the refactor.
- [x] Focused validation passed for the touched area.
- [x] Broader validation passed or any skipped gate is explicitly documented with the reason.
- [x] Docs are updated for any changed behavior, route, command, env var, or operational policy.
- [x] Residual risks and next recommended phase are documented before handoff.
