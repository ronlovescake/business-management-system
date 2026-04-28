# Business Management System

Production business platform built with Next.js + TypeScript + Prisma.

This repository serves multiple business domains in one app, with domain-parity patterns across clothing, general merchandise, trucking, and household finance.

## Current Scope (Active Domains)

- Clothing: operations, ledger/accounting, employees.
- General merchandise: operations, ledger/accounting, employees.
- Trucking: fleet/vehicle assignments, trips, payroll, expenses, invoices, payments.
- Personal/household: accounts, budgets, expenses, income, recurring payments.
- Platform/admin: auth, permissions, users, backup/restore, module marketplace, change/version history.

## Architecture at a Glance

- App routes/UI: `src/app/**`
- API routes: `src/app/api/**`
- Domain logic: `src/modules/**`
- Shared/core libraries: `src/lib/**`, `src/core/**`, `src/components/**`, `src/services/**`, `src/utils/**`
- Data model: `prisma/schema.prisma`

## Route Topology Snapshot (2026-02-20)

- App-router artifacts (`page.tsx`, `layout.tsx`, `route.ts`): **367**
- Pages: **127**
- API routes: **235**
- Dynamic routes (`[...]`): **60**

Detailed side-map and hotspot scan:

- `docs/reports/archive/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md` (archived 2026-04-19)

## Local Development

### Start app

```bash
npm install
npm run dev
```

Default dev host/port:

- `http://0.0.0.0:5001`

Playwright-focused dev server:

```bash
npm run dev:playwright
```

VS Code debugging guide:

- `docs/DEBUGGING.md`

### Typecheck and lint

```bash
npm run lint
npm run typecheck
```

### Test suites

```bash
npm run test:unit
npm run test:integration
npm run test:hardening
npm run test:coverage
```

Test environment notes:

- Vitest loads `.env.test` for unit, integration, hardening, and coverage runs.
- The tracked template is `.env.test.example`.
- The local Dockerized test database starts with `npm run docker:start:test` and listens on `localhost:5433` by default.

Full quality chain:

```bash
npm run test:full
```

## Deployment

This repository is no longer tied to a platform-specific manifest.

Generic production contract:

```bash
npm install
npm run build
npm run start
```

Host-neutral deployment assets:

- `docs/DEPLOYMENT.md`
- `docs/PITR_INVESTIGATION_AND_RECOVERY.md`
- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`

Required production environment variables:

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`

Bundled local Docker first-run bootstrap:

```bash
npm run docker:prepare-storage
docker compose --env-file .env.docker run --rm app npm run docker:bootstrap
```

Docker deploy shortcuts:

```bash
npm run docker:db:up
npm run docker:db:deploy
npm run docker:build
npm run docker:up
```

Use `npm run docker:prod` when you want the full db-up, rebuild, migrate, and app-up sequence.
If the image is already built, prefer `npm run docker:up` so Docker does not evaluate a rebuild unnecessarily.

Existing native PostgreSQL to Docker migration helpers:

```bash
npm run docker:backup:native-db -- business_management_db
npm run docker:restore:docker-db -- <dump-file> --confirm
```

Disaster-recovery restore policy:

- The only supported DR restore input is a full PostgreSQL `.dump` backup.
- The Docker restore command validates `MANIFEST.json` and the dump checksum before it stops the app or replaces the database.
- JSON, CSV, and XLSX backup artifacts are inspection/export formats only and are not supported DR restore inputs.
- Legacy restore scripts such as `scripts/restore-database.js` and `scripts/restore-from-backup.js` are retired.

Backup quality and scheduler helpers:

```bash
npm run backup:audit
npm run restore:plan -- --folder <backup-folder>
npm run docker:backup:scheduler
npm run docker:restore:runner:up
npm run restore:verify -- --dump <dump-file>
npm run restore:replay -- --folder <backup-folder>
npm run docker:restore:drill -- <dump-file>
npm run docker:restore:chain-drill -- <backup-folder>
npm run docker:restore:pitr -- --base-backup <folder> --target-time <ISO-8601> --confirm
```

Restore drill policy:

- Use `npm run restore:plan -- --folder <backup-folder>` to inspect the full, differential, and log chain required for a target backup before attempting any restore or future replay workflow.
- The planner reports whether the target is immediately restorable under the current dump-only DR contract (`ready`), structurally valid but dependent on future replay support (`advisory`), or broken (`invalid`).
- The backup preview modal now shows the same planner output in the Restore tab, including dump-only scheduled backups that do not have JSON inspection artifacts.
- Start `npm run docker:restore:runner:up` if you want the Restore tab to submit the validated full-dump restore from the UI instead of running the shell command yourself.
- Use `npm run docker:restore:drill -- <dump-file>` to rehearse a restore into a scratch Docker database without stopping the app or replacing the live database.
- The drill runs the same manifest/checksum validation as the real restore path, restores into a temporary database, runs post-restore row-count verification from the manifest, and drops the drill database afterward.
- Use `npm run docker:restore:chain-drill -- <backup-folder>` to rehearse a full baseline restore plus planned differential/log replay inside the same scratch Docker database.
- `npm run restore:replay -- --folder <backup-folder>` is the lower-level replay command for safe targets you prepare yourself; it is intended for drills and validation, not the supported production DR path.
- The UI restore button still performs the same validated Docker full-dump restore under the hood. It requires the `restore-runner` sidecar and will temporarily make the app unavailable while the database is replaced.
- `npm run restore:verify -- --dump <dump-file>` is available when you need to verify a restore against a specific database target manually.
- The Backup page now includes a True PITR / WAL card that shows PostgreSQL archiver health, the latest physical base backup, and a manual base-backup action for point-in-time recovery readiness.

Docker scheduler env knobs:

- `BACKUP_AUTO_ENABLED=true` to enable scheduled full dumps
- `BACKUP_AUTO_TIME=22:00` for the weekly full-dump time
- `BACKUP_AUTO_CADENCE=weekly` to keep full dumps on a weekly cadence
- `BACKUP_AUTO_DAY_OF_WEEK=sunday` to run the weekly full dump every Sunday
- `BACKUP_DIFF_AUTO_ENABLED=true` to enable scheduled differentials
- `BACKUP_DIFF_AUTO_TIME=12:00` for the daily differential snapshot time
- `BACKUP_DIFF_AUTO_FORMAT=json` for scheduled differential artifacts
- `BACKUP_AUTO_TIMEZONE=Asia/Manila` for scheduler timezone
- `BACKUP_RETENTION_DAYS=14` for automatic full/differential backup pruning
- `PITR_ENABLED=true` to enable PostgreSQL WAL archiving and the admin PITR status card
- `PITR_ARCHIVE_TIMEOUT_SECONDS=300` to force periodic WAL segment archival during lower write volume
- `PITR_BASE_AUTO_ENABLED=true` to let the scheduler create daily physical base backups automatically
- `PITR_BASE_AUTO_TIME=01:00` for the daily PITR base-backup time
- `PITR_BASE_BACKUP_RETENTION_DAYS=7` for PITR base-backup pruning
- `WAL_ARCHIVE_RETENTION_DAYS=7` for PITR WAL pruning
- `RESTORE_RUNNER_POLL_MS=5000` for the UI restore-runner poll interval

Optional Playwright browser override:

- Set `PLAYWRIGHT_BROWSERS_PATH` only if your host needs a custom browser cache/install path.

## Guardrails and CI

Run before PR:

```bash
npm run guardrails:check
npm run ci:quality
```

CI workflow:

- `.github/workflows/quality-gates.yml`

Engineering policy and anti-entropy standards:

- `.github/instructions/development.instructions.md`

## Database and Prisma

Generate Prisma client:

```bash
npm run db:generate
```

Push schema (non-destructive environments only):

```bash
npm run db:push
```

Open Prisma Studio:

```bash
npm run db:studio
```

## New Module Scaffolding Standard

Create new modules with the repository scaffold:

```bash
npm run generate:module -- --name=<module-name> --domain=<clothing|general-merchandise|trucking|household|shared> [--section=<section>] [--table=<handsontable|mantine|custom>] [--withPage=true]
```

Example:

```bash
npm run generate:module -- --name=inventory-aging --domain=clothing --section=operations --table=handsontable --withPage=true
```

## Operational Scripts (Selected)

Inventory/ledger controls:

```bash
npm run inventory:ledger:controls
```

Accounting transaction sanity check:

```bash
npm run accounting:transactions:sanitycheck
```

## Documentation Index

- Main repo README: `README.md`
- Documentation hub: `docs/README.md`
- Developer onboarding guide: `docs/DEVELOPER_ONBOARDING.md`
- Contributor guide: `CONTRIBUTING.md`
- Repo-verified executive summary: `docs/reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md`
- Repo-wide improvement checklist: `IMPROVEMENTS_CHECKLIST.md`
- Business logic index: `docs/BUSINESS_LOGIC_INDEX.md`
- Debugging guide: `docs/DEBUGGING.md`
- Deployment guide: `docs/DEPLOYMENT.md`
- Docker cheat sheet: `docs/DOCKER_CHEAT_SHEET.md`
- Operational workflow and accounting policy: `docs/OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md`
- Inventory ledger controls: `docs/inventory-ledger-controls.md`
- Historical docs index: `docs/HISTORICAL_INDEX.md`
- Archived structural reports: `docs/reports/archive/`
- Engineering policy: `.github/instructions/development.instructions.md`
