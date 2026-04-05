# Host-Neutral Deployment Guide

This repository is deployment-neutral. You can run it on Docker, a VPS, or a generic PaaS without keeping a vendor-specific manifest in the repo.

## Universal Checklist

- Use PostgreSQL. This app is not designed for SQLite or MySQL.
- Set the required production environment variables before build and before runtime:
  - `DATABASE_URL`
  - `NEXT_PUBLIC_APP_URL`
  - `NEXTAUTH_URL`
  - `NEXTAUTH_SECRET`
- Make sure `NEXT_PUBLIC_APP_URL` and `NEXTAUTH_URL` use the real public HTTPS URL in production.
- Back up the database before the first production deployment and before every schema migration.
- Use `npm run db:deploy` as a deliberate step after backup, not as a hidden auto-start side effect.
- Verify the health endpoint after deployment: `GET /api/health`
- If your host needs a custom Playwright browser cache path, set `PLAYWRIGHT_BROWSERS_PATH`. Otherwise leave it unset.

## Docker Checklist

Files added for the generic Docker path:

- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `.dockerignore`

Host data root convention:

- Set `BMS_DATA_ROOT` in `.env.docker`
- Postgres live data is stored in `${BMS_DATA_ROOT}/postgres`
- Logical backups are stored in `${BMS_DATA_ROOT}/backup`
- Run `npm run backup:audit` after Prisma model changes so new persistent
  models are explicitly classified for backup coverage.

### Quick Start

1. Copy the example env file:

```bash
cp .env.docker.example .env.docker
```

2. Edit `.env.docker` with real values.

3. Prepare the host storage directories safely:

```bash
npm run docker:prepare-storage
```

4. Build and start the stack:

```bash
docker compose --env-file .env.docker build
docker compose --env-file .env.docker up -d
```

Repo wrapper scripts for the same flow:

```bash
npm run docker:db:up
npm run docker:build
npm run docker:up
```

Use `npm run docker:prod` only when you want all three steps together.
If you already built the image and only need to restart or recreate the app container, use `npm run docker:up`.

5. Wait for PostgreSQL to report healthy, then run the first-run bootstrap step:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker run --rm app npm run docker:bootstrap
```

The bootstrap command is idempotent for the bundled local stack. It:

- applies Prisma migrations
- seeds the initial Docker login users defined in `prisma/seeds/auth-users.js`

6. Verify health:

```bash
curl http://localhost:5000/api/health
```

### Scheduled Backups

Phase 1 automated backups use a dedicated Docker sidecar that triggers the
internal backup endpoint for weekly full PostgreSQL dumps and optional daily
differential snapshots.

The same `backup-scheduler` sidecar can also trigger employee automation
catch-up checks for Clothing, Trucking, and General Merchandise through the
internal employee automation endpoints.

Required `.env.docker` settings:

- `INTERNAL_JOB_TOKEN` must be set on both `app` and `backup-scheduler`
- `BACKUP_AUTO_ENABLED=true`
- `BACKUP_AUTO_TIME=22:00`
- `BACKUP_AUTO_CADENCE=weekly`
- `BACKUP_AUTO_DAY_OF_WEEK=sunday`
- `BACKUP_DIFF_AUTO_ENABLED=false`
- `BACKUP_DIFF_AUTO_TIME=12:00`
- `BACKUP_DIFF_AUTO_FORMAT=json`
- `BACKUP_AUTO_TIMEZONE=Asia/Manila`
- `BACKUP_RETENTION_DAYS=30`
- `PITR_ENABLED=false`
- `PITR_ARCHIVE_TIMEOUT_SECONDS=300`
- `PITR_BASE_AUTO_ENABLED=false`
- `PITR_BASE_AUTO_TIME=01:00`
- `EMPLOYEE_AUTOMATION_CLOTHING_ENABLED=true`
- `EMPLOYEE_AUTOMATION_TRUCKING_ENABLED=true`
- `EMPLOYEE_AUTOMATION_GENERAL_MERCHANDISE_ENABLED=true`

Notes:

- The scheduler calls `POST /api/internal/backup/run` with the internal token.
- Employee automation scheduler checks call the matching internal
  `POST /api/internal/*/employee-automation/run-due` endpoint once per minute
  by default. Use the `EMPLOYEE_AUTOMATION_*_ENABLED=false` flags only as an
  explicit hard-disable override for a workspace.
- The employee automation page settings remain the primary runtime control for
  whether attendance or payroll automations actually execute.
- Stay-in attendance scheduler checks sweep the same rolling 15-day catch-up
  window used by the Attendance page's automatic record-attendance action, so
  missed downtime days in that window are backfilled on the next successful
  scheduler check.
- Full scheduled runs always create restore-ready PostgreSQL dump backups.
- Weekly full scheduled runs default to Sunday at `22:00` in the configured timezone.
- Differential scheduled runs use the manual differential pipeline and default
  to JSON artifacts unless you override `BACKUP_DIFF_AUTO_FORMAT`.
- On startup, the scheduler performs one immediate catch-up check. If the app
  missed one or more prior scheduled periods while it was down, it creates the
  scheduled full or differential backup right away instead of waiting for the
  next scheduled clock time.
- The route skips creating a second scheduled backup if one already exists for
  the current scheduled period.
- Employee automation scheduler checks keep their own run history tables and do
  not create duplicate run entries once a due period has already been recorded.
- Scheduled differentials require an existing full backup baseline. If none
  exists yet, the scheduler skips the run instead of silently promoting it.
- Old backup folders are pruned after each successful scheduled run, while the
  latest full backup and any referenced chain bases are preserved.

### True PostgreSQL PITR And WAL Visibility

The Docker stack can now enable PostgreSQL-native point-in-time recovery by
turning on WAL archiving in the `db` container and exposing status in the admin
backup page.

Enable it in `.env.docker`:

- `PITR_ENABLED=true`
- `PITR_ARCHIVE_TIMEOUT_SECONDS=300`

What this enables:

- PostgreSQL starts with `wal_level=replica`
- PostgreSQL writes archived WAL segments into
  `${BMS_DATA_ROOT}/backup/pitr/wal`
- The admin backup page shows live `pg_stat_archiver` data plus the latest
  physical base backup
- Admins can create a new physical base backup from the UI, stored under
  `${BMS_DATA_ROOT}/backup/pitr/base/<timestamp>`
- Optional scheduler automation can create one PITR base backup per day through
  the same internal scheduler sidecar used by full and differential backups

Operational notes:

- Run `npm run docker:prepare-storage` before the first PITR-enabled startup so
  the base-backup and WAL archive directories already exist.
- After changing `PITR_ENABLED`, recreate the `db` container so PostgreSQL picks
  up the new runtime settings.
- If you enable `PITR_BASE_AUTO_ENABLED=true`, recreate the `app` and
  `backup-scheduler` containers so the scheduler can see the new base-backup
  schedule.
- The PITR status card is only considered healthy once PostgreSQL reports
  `archive_mode=on` and `wal_level=replica`.
- Scheduled PITR base backups run daily at `PITR_BASE_AUTO_TIME` and perform
  one startup catch-up run if a scheduled day was missed while the app was
  down.

Restore a Docker database to a point in time with the latest archived WAL chain:

```bash
npm run docker:restore:pitr -- --base-backup <base-backup-folder> --target-time <ISO-8601> --confirm
```

The PITR restore script:

- stops the app and database containers
- preserves the current live PostgreSQL data directory under a timestamped
  `.pre-pitr-*` folder
- replaces the live data directory with the selected physical base backup
- configures `restore_command` against `/backups/pitr/wal`
- starts PostgreSQL and promotes it at the requested recovery target time
- starts the app again after the recovered database is ready

### Supported Disaster-Recovery Restore Path

Phase 2A standardizes DR restore on one operator path only:

```bash
npm run docker:restore:docker-db -- <dump-file> --confirm
```

Rules:

- Only full PostgreSQL `.dump` backups are supported DR restore inputs.
- The restore script validates `MANIFEST.json` and the dump checksum before it
  stops the app or recreates the database.
- Full dump manifests now also carry restore-verification row counts so a drill
  can confirm the restored database matches the backup snapshot, not just the
  dump checksum.
- Browser/API restore is retired for DR. `POST /api/restore` now rejects
  restore attempts and points operators to the Docker restore command.
- JSON, CSV, and XLSX backup artifacts remain useful for inspection/export, but
  they are not supported DR restore inputs.
- Legacy scripts such as `scripts/restore-database.js` and
  `scripts/restore-from-backup.js` are retired and should not be used.

### Restore Verification And Drills

For the operator-facing investigation flow, restore decision tree, and
binary-search procedure, see
[PITR_INVESTIGATION_AND_RECOVERY.md](./PITR_INVESTIGATION_AND_RECOVERY.md).

Phase 3 adds a chain-aware planner so operators can inspect how a differential or
log backup relates to its required base backups even though Phase 2A still only
executes full dump restores.

Plan a restore chain for a target backup:

```bash
npm run restore:plan -- --folder <backup-folder>
```

Planner outcomes:

- `ready`: the target is a full dump backup and can be restored under the
  current DR contract.
- `advisory`: the chain is structurally valid, but one or more differential or
  log replay steps would still require the future replay engine.
- `invalid`: the chain is broken, such as a missing base backup or a log-window
  discontinuity.

The same planner output is surfaced in the admin backup preview Restore tab, so
operators can inspect chain health even for dump-only scheduled backups.

Run a safe restore rehearsal without replacing the live Docker database:

```bash
npm run docker:restore:drill -- <dump-file>
```

What the drill does:

- validates the selected dump against its adjacent `MANIFEST.json`
- restores the dump into a temporary Docker database named
  `${POSTGRES_DB}_restore_drill` by default
- runs `npm run restore:verify -- --dump <dump-file>` against that temporary
  database using the manifest's restore-verification snapshot
- drops the temporary drill database after the verification finishes

Run a safe chain rehearsal for a differential or log target:

```bash
npm run docker:restore:chain-drill -- <backup-folder>
```

What the chain drill does:

- runs `npm run restore:plan -- --folder <backup-folder>` and requires a valid
  chain with a full dump baseline
- restores the baseline dump into a temporary Docker database
- applies the planned differential/log JSON steps with
  `npm run restore:replay -- --folder <backup-folder>` against that temporary
  database
- verifies the final state against the target manifest's
  `restoreVerification` snapshot when one is present
- drops the temporary drill database after the rehearsal finishes

This remains a drill-only workflow. The supported production DR path is still a
direct full-dump restore.

### UI-Triggered Full Restore

If you want the admin Restore tab to submit the validated full-dump restore for
you, start the dedicated restore runner:

```bash
npm run docker:restore:runner:up
```

How the UI restore works:

- the admin modal still shows the exact dump, restore plan, and latest runner
  status before you confirm anything
- the same modal now includes a Changes tab that compares the selected full
  backup's saved row counts against the live database so you can see table-level
  count drift before restoring
- the browser submits a restore job only after a typed confirmation
- the `restore-runner` sidecar performs the same
  `docker:restore:docker-db` workflow under the hood
- the app becomes temporarily unavailable while the restore is running because
  the database is being replaced

This UI path is intentionally limited to full PostgreSQL dump restores. It does
not enable browser-driven differential or log replay into production.

Use direct verification when you have already restored a dump into a safe target
and want to compare the database state against the manifest:

```bash
npm run restore:verify -- --dump <dump-file>
```

Use direct replay when you have already prepared a safe database target and want
to apply the planned differential/log chain without the Docker wrapper:

```bash
npm run restore:replay -- --folder <backup-folder>
```

Optional flags:

- `--database-url <url>` to point verification at a specific restored database
- `--manifest <path/to/MANIFEST.json>` when you want to verify from a manifest
  directly instead of a dump path
- `RESTORE_DRILL_DB_NAME=<name>` to override the temporary drill database name
- `RESTORE_RUNNER_POLL_MS=<ms>` to control how often the UI restore-runner
  scans for pending restore jobs

### Migrating Existing Native PostgreSQL Data Into Docker

Safest approach: logical dump and restore. Do not copy raw PostgreSQL data files from a running native server into the Docker data directory.

1. Create a dump from the native PostgreSQL database:

```bash
npm run docker:backup:native-db -- business_management_db
```

2. Restore that dump into the Docker database:

```bash
npm run docker:restore:docker-db -- business_management_db-YYYYMMDD-HHMMSS.dump --confirm
```

The restore command:

- validates that the selected backup is a full PostgreSQL dump with a matching
  manifest and checksum
- starts the Docker `db` service if needed
- stops the app container temporarily
- recreates the Docker target database
- restores the dump from `${BMS_DATA_ROOT}/backup`
- starts the app again

### Docker Notes

- The compose file includes PostgreSQL for a self-hosted full stack.
- If you use an external or managed PostgreSQL instance, point `DATABASE_URL` to that database and skip the bundled `db` service.
- The first-run bootstrap command is intended for local bundled-Postgres setup. Review `prisma/seeds/auth-users.js` before using it outside local development because it creates default admin accounts.
- The storage prep step creates missing host folders, reuses an existing PostgreSQL data directory if present, and refuses to proceed if the target directory is non-empty but does not look like a real PostgreSQL cluster.
- The Docker image installs Chromium because the app uses Playwright for server-side document generation.
- The image uses non-sensitive local placeholder values at build time for server-only env validation. Real runtime values are still required when the container starts.
- `NEXT_PUBLIC_APP_URL` is a public build-time value. If your public domain changes, rebuild the image.
- `.dockerignore` excludes docs, tests, and other non-runtime files so doc-only changes do not invalidate the expensive app build layers.

## VPS Checklist

- Install Node.js 20 and npm.
- Install PostgreSQL on the VPS, or point the app to an external PostgreSQL service.
- Clone the repository onto the server.
- Create a production `.env` or equivalent secret store with the required environment variables.
- Install dependencies:

```bash
npm ci
```

- Generate Prisma client:

```bash
npm run db:generate
```

- Build the app:

```bash
npm run build
```

- Back up the database.
- Run migrations deliberately:

```bash
npm run db:deploy
```

- Start the app behind a reverse proxy such as Nginx or Caddy:

```bash
PORT=5000 npm run start
```

- Route public traffic from `443` to the app port and verify `GET /api/health`.

## PaaS Checklist

- Use a platform that supports a standard Node.js build/start flow.
- Configure the build command as:

```bash
npm install && npm run build
```

- Configure the start command as:

```bash
npm run start
```

- Provide the required production environment variables in the platform secret/config UI.
- Attach PostgreSQL and set `DATABASE_URL` to that service.
- If the platform separates build-time and runtime variables, make sure `NEXT_PUBLIC_APP_URL` is available during build.
- If the platform supports health checks, point them to `/api/health`.
- If the platform needs a custom Playwright browser path, set `PLAYWRIGHT_BROWSERS_PATH` there instead of changing source code.

## Rollback Checklist

- Keep database backups before each deploy.
- Keep a versioned image tag or git SHA for each release.
- Roll back the app version first if the issue is application-only.
- Restore the database only when the problem is data or migration related and you have confirmed the restore plan.

## Host Recovery Checklist

Use this when reinstalling the machine, moving to a new Linux host, or rebuilding Docker after a disk or OS issue.

1. Preserve the host data root before touching the machine:

```bash
sudo rsync -a /home/ron/business-management-system-data/ /path/to/external-backup/business-management-system-data/
```

2. Preserve the local Docker env files from each repo because they are not committed:

```bash
cp /home/ron/Websites/business-management-development/.env.docker /path/to/external-backup/development.env.docker
cp '/home/ron/Website Production/business-management-production/.env.docker' /path/to/external-backup/production.env.docker
```

3. Reinstall Docker on the replacement host and make sure the Docker service starts on boot:

```bash
sudo systemctl enable --now docker
```

4. Restore the host data folders exactly as separate environments:

```bash
/home/ron/business-management-system-data/development
/home/ron/business-management-system-data/production
```

5. Clone the repos back into their normal locations, then restore the saved `.env.docker` files into each repo.

6. Start development from the development repo when needed:

```bash
cd /home/ron/Websites/business-management-development
docker compose --env-file .env.docker up -d
```

7. Start production from the production repo:

```bash
cd '/home/ron/Website Production/business-management-production'
docker compose --env-file .env.docker up -d
```

8. Verify the final live services:

```bash
curl http://localhost:3000/api/health
curl http://localhost:5000/api/health
```

9. If the app starts but data is missing, do not copy raw PostgreSQL files from another running server. Restore from a logical dump with:

```bash
npm run docker:restore:docker-db -- <dump-file.dump> --confirm
```

10. Keep the host PostgreSQL service disabled on the production machine if Docker owns port `5432`:

```bash
sudo systemctl disable --now postgresql postgresql@16-main
```

## Validation Targets

- App responds on the configured port.
- `GET /api/health` returns healthy.
- Login/auth flows have the correct public URL.
- PDF and document-generation flows work, which confirms Playwright Chromium is available.
