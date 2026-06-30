# Scripts Manifest

This document catalogs every script in `scripts/` so contributors can see at a
glance what each one does and how dangerous it is to run. Scripts are not
physically moved into subfolders because many are referenced from
`package.json`, `prisma/`, Dockerfiles, and other scripts; relocating them
would create churn without proportional benefit. Instead, prefer this manifest
as the source of truth for organization.

## Risk Levels

| Level          | Meaning                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------- |
| 🟢 Safe        | Read-only, idempotent, or operates only on dev/test data.                                |
| 🟡 Caution     | Mutates data or environment; review args before running.                                 |
| 🔴 Destructive | Hard-deletes, truncates, or rewrites production-shaped data. Requires explicit approval. |
| ⚙️ Build/CI    | Pure tooling — build, generation, lint, env validation.                                  |

Add the date you last ran a script in the **Last Used** column when known.

---

## Build / CI / Lint

| Script                                | Purpose                                                                                                                                                                                            | Risk | Last Used |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------- |
| `build-webpack.js`                    | Wraps `next build` with custom env handling.                                                                                                                                                       | ⚙️   |           |
| `build-refactor-changelog-stream.js`  | Builds the refactor changelog stream report.                                                                                                                                                       | ⚙️   |           |
| `check-imports.js`                    | Lint pass for forbidden imports.                                                                                                                                                                   | ⚙️   |           |
| `check-doc-command-drift.js`          | Verifies every `npm run <name>` referenced in docs exists in `package.json`. Wired into `guardrails:check`.                                                                                        | ⚙️   |           |
| `check-module-route-acl.js`           | Verifies every active module route has a matching ACL prefix in `src/core/routePermissions.ts`. Wired into `guardrails:check`.                                                                     | ⚙️   |           |
| `check-scripts-manifest.js`           | Verifies every top-level script is listed in `SCRIPTS_MANIFEST.md`. Wired into `guardrails:check`.                                                                                                 | ⚙️   |           |
| `codegen-module-route-permissions.js` | Generates `src/core/routePermissions.modules.generated.ts` (informational catalog of registered modules). Supports `--check` for CI drift detection. Wired into `prebuild` and `guardrails:check`. | ⚙️   |           |
| `audit-any-usage.js`                  | Reports `any`-typed usages across the codebase (audit-only).                                                                                                                                       | ⚙️   |           |
| `run-if-db.js`                        | Runs the listed npm scripts only when `DATABASE_URL` is set; skips cleanly otherwise. Used by `test:full` to gate database-dependent integrity checks.                                             | ⚙️   |           |
| `analyze-float-to-decimal.ts`         | Analyzes Float-typed Prisma fields for migration to Decimal (analysis-only).                                                                                                                       | ⚙️   |           |
| `check-required-env.js`               | Verifies required env vars before build.                                                                                                                                                           | ⚙️   |           |
| `check-schema-drift.js`               | Compares Prisma schema against the connected DB.                                                                                                                                                   | 🟢   |           |
| `clean-dev-cache.sh`                  | Wipes `.next/` and dev caches.                                                                                                                                                                     | 🟢   |           |
| `complete-modules.js`                 | Module-completion utility for code generation.                                                                                                                                                     | ⚙️   |           |
| `generate-barrel-exports.js`          | Generates `index.ts` barrels for module folders.                                                                                                                                                   | ⚙️   |           |
| `generate-module.js`                  | Scaffolds a new module skeleton.                                                                                                                                                                   | ⚙️   |           |
| `guard-no-legacy-browser-engine.js`   | Guardrail: blocks legacy browser-engine references.                                                                                                                                                | ⚙️   |           |
| `guardrails-check.js`                 | Aggregate guardrails check used in CI.                                                                                                                                                             | ⚙️   |           |
| `refactor-snapshot-report.js`         | Generates refactor snapshot report.                                                                                                                                                                | ⚙️   |           |
| `run-build-with-env-file.js`          | Runs build with a specific `.env*` file.                                                                                                                                                           | ⚙️   |           |
| `update-module-indexes.js`            | Refreshes module index registrations.                                                                                                                                                              | ⚙️   |           |

## Database — Backup / Restore / Snapshot

| Script                            | Purpose                                                            | Risk             |
| --------------------------------- | ------------------------------------------------------------------ | ---------------- |
| `backup-database.js`              | Takes a logical backup of the database.                            | 🟡               |
| `db-snapshot.js`                  | Captures a snapshot of the current DB state.                       | 🟡               |
| `restore-database.js`             | Restores from a backup file.                                       | 🔴               |
| `restore-from-backup.js`          | Wrapper that orchestrates a restore flow.                          | 🔴               |
| `plan-restore.ts`                 | Plans a restore without executing it.                              | 🟢               |
| `replay-restore-chain.ts`         | Replays a chain of incremental restores.                           | 🔴               |
| `run-backup-scheduler.js`         | Background scheduler for automated backups.                        | 🟡               |
| `schedulerConfigShared.js`        | Shared schedule parsing/defaults used by backup scheduler tooling. | ⚙️               |
| `run-restore-runner.js`           | Runs the restore runner container/process.                         | 🔴               |
| `verify-restore.js`               | Validates that a restore completed successfully.                   | 🟢               |
| `verify-restore.ts`               | TS variant of restore verification.                                | 🟢               |
| `verify-database-state.js`        | Sanity checks DB state against expectations.                       | 🟢               |
| `backup-schema-coverage-audit.ts` | Audits backup-schema coverage; used in `guardrails:check`.         | 🟢               |
| `prisma-safe-reset.js`            | Safer wrapper for `prisma migrate reset`.                          | 🔴               |
| `reset-test-db.js`                | Resets the test database. **Test DB only.**                        | 🔴 (test-scoped) |
| `test-db.js`                      | Test-database helper.                                              | 🟢               |

## Database — Accounting / Inventory Integrity

| Script                                          | Purpose                                              | Risk |
| ----------------------------------------------- | ---------------------------------------------------- | ---- |
| `accounting-db-integrity-check.ts`              | Read-only accounting integrity audit.                | 🟢   |
| `accounting-sanity-check.ts`                    | Read-only accounting sanity checks.                  | 🟢   |
| `inventory-ledger-healthcheck.ts`               | Read-only inventory ledger healthcheck.              | 🟢   |
| `report-inventory-ledger-drift.ts`              | Reports inventory ledger drift.                      | 🟢   |
| `debug-opening-balances.ts`                     | Debug helper for opening balances.                   | 🟢   |
| `debug-retained-earnings.ts`                    | Debug helper for retained earnings.                  | 🟢   |
| `set-opening-balances.ts`                       | Writes opening balances. Review args carefully.      | 🔴   |
| `reclass-receipt-backfill-opening-inventory.ts` | Reclassifies receipt backfills to opening inventory. | 🔴   |
| `adjust-receipt-delta.ts`                       | Adjusts receipt delta entries.                       | 🔴   |
| `cleanup-duplicate-auto-receipts.ts`            | Removes duplicate auto-generated receipts.           | 🔴   |

## Database — Backfills / Resyncs

| Script                                        | Purpose                                          | Risk |
| --------------------------------------------- | ------------------------------------------------ | ---- |
| `backfill-receipt-movements.ts`               | Backfills receipt-driven inventory movements.    | 🔴   |
| `backfill-reservation-movements.ts`           | Backfills reservation movements.                 | 🔴   |
| `backfill-sale-movements.ts`                  | Backfills sale-driven movements.                 | 🔴   |
| `resync-paid-prepared-inventory-movements.ts` | Resyncs paid/prepared inventory movements.       | 🔴   |
| `rollback-sale-backfill-movements.ts`         | Rolls back a sale-backfill run.                  | 🔴   |
| `trucking-trip-customer-backfill.js`          | Backfills customer references on trucking trips. | 🔴   |

## Database — Destructive Cleanups

| Script                               | Purpose                               | Risk            |
| ------------------------------------ | ------------------------------------- | --------------- |
| `clear-all-tables.js`                | Truncates **all** tables.             | 🔴              |
| `clear-customers.js`                 | Truncates customers.                  | 🔴              |
| `clear-products.ts`                  | Truncates products.                   | 🔴              |
| `clear-transactions.js`              | Truncates transactions.               | 🔴              |
| `delete-all-customers.ts`            | Deletes all customer rows.            | 🔴              |
| `delete-change-log.ts`               | Deletes the change log.               | 🔴              |
| `delete-qa-recurring-payments.ts`    | Deletes QA-only recurring payments.   | 🔴 (QA-scoped)  |
| `hard-delete-notifications.js`       | Hard-deletes notifications.           | 🔴              |
| `hard-delete-operations-tables.js`   | Hard-deletes operations tables.       | 🔴              |
| `hard-delete-transactions.js`        | Hard-deletes transactions.            | 🔴              |
| `remove-placeholder-transactions.js` | Removes placeholder transactions.     | 🔴              |
| `one-time-cleanup-duplicates.ts`     | Historical one-off duplicate cleanup. | 🔴 (deprecated) |

## Data Fixes / Imports

| Script                            | Purpose                                           | Risk |
| --------------------------------- | ------------------------------------------------- | ---- |
| `clean-prices-csv.js`             | Cleans an external prices CSV before import.      | 🟢   |
| `cross-check-leave-attendance.js` | Cross-checks leave vs attendance records.         | 🟢   |
| `fix-apostrophes.js`              | Normalizes apostrophes in text fields.            | 🟡   |
| `fix-data-integrity.js`           | Misc data integrity fixes. Review before running. | 🔴   |
| `fix-localhost-urls.js`           | Rewrites localhost URLs in stored data.           | 🟡   |
| `replace-localhost-urls.js`       | Bulk localhost URL replacement.                   | 🟡   |
| `merge-customer-data.js`          | Merges duplicate customer records.                | 🔴   |
| `normalize-addresses.js`          | Normalizes customer addresses.                    | 🟡   |
| `import-schedules.js`             | Imports work schedules from a source file.        | 🟡   |
| `transform-attendance-csv.js`     | Transforms an attendance CSV for import.          | 🟢   |
| `transform-leave-csv.js`          | Transforms a leave CSV for import.                | 🟢   |
| `validate-data-integrity.js`      | Runs read-only data-integrity validations.        | 🟢   |
| `check-schedules.js`              | Validates schedule data.                          | 🟢   |

## Generators / One-offs

| Script                             | Purpose                                              | Risk |
| ---------------------------------- | ---------------------------------------------------- | ---- |
| `generate-attendance.js`           | Generates synthetic attendance data.                 | 🟡   |
| `generate-bulk-payroll.js`         | Generates a bulk payroll run.                        | 🔴   |
| `generate-notification-sound.html` | Browser tool to generate a notification sound asset. | 🟢   |
| `seed-emp-0005-salary-history.js`  | Seeds salary history for a specific employee.        | 🟡   |
| `seed-modules.ts`                  | Seeds module registry rows.                          | 🟡   |
| `add-react-memo.sh`                | Codemod adding `React.memo` wrappers.                | 🟢   |
| `sync-liv1-status.js`              | Sync helper used inside `guardrails:check`.          | ⚙️   |

## Playwright / E2E Plumbing

| Script                          | Purpose                                    | Risk |
| ------------------------------- | ------------------------------------------ | ---- |
| `ensure-playwright-browsers.js` | Ensures Playwright browsers are installed. | ⚙️   |
| `start-playwright-dev.js`       | Starts the Playwright dev session.         | ⚙️   |
| `test-enterprise-features.sh`   | Smoke test for enterprise features.        | 🟢   |
| `test-google-drive.sh`          | Smoke test for Google Drive integration.   | 🟢   |
| `test-p2-constraints.js`        | Tests P2 schema constraints.               | 🟢   |

## Docker / Infra

See `scripts/docker/` for container/host orchestration scripts. They are
invoked via the `docker:*` npm scripts in `package.json`.

## SQL Snippets

| File                                    | Purpose                                              |
| --------------------------------------- | ---------------------------------------------------- |
| `create-sorting-distribution-table.sql` | One-off SQL: creates the sorting distribution table. |

---

## Conventions for Adding New Scripts

1. Add a row to this manifest in the same change.
2. Pick the correct risk level. When in doubt, mark 🔴.
3. For destructive scripts, require an explicit `--confirm` flag and print the
   target environment before doing anything.
4. Prefer TypeScript (`.ts` via `tsx`) for new scripts so they share types
   with `src/`.
5. Long-running operational scripts should accept `--dry-run`.
