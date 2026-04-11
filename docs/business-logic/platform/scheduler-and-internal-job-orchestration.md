# Platform — Scheduler and Internal Job Orchestration

This file documents the backup-scheduler sidecar, the restore-runner sidecar, and the seven internal job routes they invoke.

> **Primary source files:**
>
> - `scripts/run-backup-scheduler.js` — Docker sidecar process
> - `scripts/run-restore-runner.js` — Docker sidecar process
> - `src/lib/backup/scheduledBackupRunner.ts` — app-side scheduled backup engine
> - `src/lib/backup/pitr.ts` — app-side PITR base backup engine
> - `src/modules/shared/employees/automation/` — shared automation execution engine
> - `src/modules/shared/employees/automation/internalRouteUtils.ts` — token auth and persist/skip helpers
> - `src/constants/limits.ts` — retention day constants
>
> **Internal route files:**
>
> - `src/app/api/internal/backup/run/route.ts`
> - `src/app/api/internal/backup/pitr/run/route.ts`
> - `src/app/api/internal/employee-automation/run-due/route.ts`
> - `src/app/api/internal/general-merchandise/employee-automation/run-due/route.ts`
> - `src/app/api/internal/trucking/employee-automation/run-due/route.ts`
> - `src/app/api/internal/maintenance/prune-logs/route.ts`
> - `src/app/api/internal/inventory/controls/route.ts`
>
> **Docker Compose services:** `backup-scheduler`, `restore-runner`

---

## A — Architecture Overview

| # | Rule | Explanation |
| --- | --- | --- |
| 1 | The system uses a sidecar architecture for background jobs | Background work is not embedded in the Next.js app process. Two separate Docker services (`backup-scheduler`, `restore-runner`) poll the app's internal API routes via HTTP. |
| 2 | Internal routes are protected by a shared secret token | Every internal route requires an `x-internal-token` header matching the `INTERNAL_JOB_TOKEN` environment variable. Routes return 401 if the token is missing or wrong, and 500 if the env var itself is not configured. |
| 3 | The app container must be healthy before the scheduler starts | `docker-compose.yml` sets `depends_on: app: condition: service_healthy` on the `backup-scheduler` service. |
| 4 | The restore runner has its own minimal Dockerfile | `Dockerfile.restore-runner` produces a lightweight Alpine image with only bash, Node.js, and the scripts directory. It does not include the full Next.js app. |

---

## B — Backup Scheduler Sidecar (`scripts/run-backup-scheduler.js`)

| # | Rule | Explanation |
| --- | --- | --- |
| 5 | The scheduler runs seven independent job configs in a single polling loop | Configs: PITR base backup, full dump backup, differential backup, log pruning, clothing employee automation, trucking employee automation, general-merchandise employee automation. |
| 6 | The polling interval is 60 seconds | `CHECK_INTERVAL_MS = 60 * 1000`. Every 60 seconds, `tick()` iterates all enabled configs. |
| 7 | Each config has an independent enable/disable flag | `BACKUP_AUTO_ENABLED`, `BACKUP_DIFF_AUTO_ENABLED`, `PITR_BASE_AUTO_ENABLED`, `LOG_PRUNE_AUTO_ENABLED`, `EMPLOYEE_AUTOMATION_CLOTHING_ENABLED`, `EMPLOYEE_AUTOMATION_TRUCKING_ENABLED`, `EMPLOYEE_AUTOMATION_GENERAL_MERCHANDISE_ENABLED`. Disabled configs are filtered out at startup. |
| 8 | If all configs are disabled, the scheduler stays alive but does nothing | It enters a no-op `setInterval` loop so the Docker container doesn't exit. |
| 9 | If `INTERNAL_JOB_TOKEN` is empty and any config is enabled, the scheduler exits immediately | `process.exit(1)` with an error message. |
| 10 | Time-scheduled jobs use `periodStrategy: 'scheduled'` | Full, differential, PITR base, and log pruning use a schedule time (HH:MM), cadence (daily or weekly), and optional day-of-week. |
| 11 | Employee automation jobs use `periodStrategy: 'minute'` | They fire every tick (every 60 seconds). The app-side logic decides whether work is actually due. |
| 12 | All time calculations use the configured timezone | Default `Asia/Manila`. Uses `Intl.DateTimeFormat` to convert UTC to zoned parts. The scheduler itself never uses the system clock's timezone. |
| 13 | Each config maintains a `lastTriggeredPeriodKey` | This is a string like `2026-04-11` (daily) or `2026-04-06` (weekly, keyed to the week's start day) or `2026-04-11T14:30` (minute). A config is skipped if its period key hasn't changed since the last successful trigger. |
| 14 | On startup, the scheduler fires one catch-up check per config | The first `tick()` runs immediately. Since `lastTriggeredPeriodKey` starts as `null`, every enabled config will fire once, allowing the app-side logic to catch up on missed periods. |
| 15 | Catch-up is delegated to the app-side engine | The scheduler sends `allowCatchUpBeforeScheduledTime: true` and `skipIfAlreadyCompletedToday: true` in the request body. The app decides whether a backup actually needs to run. |
| 16 | Weekly cadence keys on the configured day of week | If today is Wednesday and the schedule day is Sunday, the period key is the previous Sunday's date. The scheduler will not fire again until the next Sunday's date becomes the current period key. |
| 17 | Daily cadence rolls based on the schedule time | Before the scheduled HH:MM, the period key is yesterday's date. After HH:MM, it's today's date. This ensures a daily backup fires once per calendar day in the configured timezone. |
| 18 | Fetch requests have a 5-minute timeout | An `AbortController` aborts the request after 300,000ms. This prevents the scheduler from hanging indefinitely if the app becomes unresponsive. (Added 2026-04-11 after an outage caused by a missing timeout.) |
| 19 | A failed trigger does not advance `lastTriggeredPeriodKey` | The scheduler will retry the same period key on the next tick. |
| 20 | A skipped-but-successful response may still advance the period key | If the app responds with `success: true` and the skip reason indicates the period was already covered or not yet due, the key advances. This prevents re-triggering a period that the app already handled. |

---

## C — Backup Scheduler Defaults

| Parameter | Env Var | Default |
| --- | --- | --- |
| Full backup time | `BACKUP_AUTO_TIME` | `22:00` |
| Full backup cadence | `BACKUP_AUTO_CADENCE` | `weekly` |
| Full backup day | `BACKUP_AUTO_DAY_OF_WEEK` | `sunday` |
| Differential backup time | `BACKUP_DIFF_AUTO_TIME` | `12:00` |
| Differential format | `BACKUP_DIFF_AUTO_FORMAT` | `json` |
| PITR base backup time | `PITR_BASE_AUTO_TIME` | `01:00` |
| Log pruning time | `LOG_PRUNE_AUTO_TIME` | `03:00` |
| Timezone | `BACKUP_AUTO_TIMEZONE` | `Asia/Manila` |
| Retention days | `BACKUP_RETENTION_DAYS` | `30` (minimum 1) |
| Polling interval | — | 60 seconds (hardcoded) |
| Fetch timeout | — | 5 minutes (hardcoded) |

---

## D — Restore Runner Sidecar (`scripts/run-restore-runner.js`)

| # | Rule | Explanation |
| --- | --- | --- |
| 21 | The restore runner polls a status file for pending jobs | It reads `{BACKUP_DIR}/_restore-jobs/status.json` every `RESTORE_RUNNER_POLL_MS` (default 5000ms, minimum 2000ms). |
| 22 | The restore runner writes a heartbeat file | `{BACKUP_DIR}/_restore-jobs/heartbeat.json` is updated on every tick so the app can detect whether the runner is alive. |
| 23 | Only `pending` phase triggers a restore | The runner looks for `status.phase === 'pending'`. All other phases are ignored. |
| 24 | On startup, a stale `running` job is marked as `failed` | If the runner restarts while a job was `running`, it writes phase `failed` with a message to review the database before retrying. |
| 25 | Restores are executed via `scripts/docker/restore-dump-into-docker.sh` | The runner spawns a bash child process with the dump artifact path and `--confirm`. |
| 26 | Only one restore can run at a time | A `running` boolean prevents concurrent restores even if the polling interval is short. |
| 27 | Status transitions are: `pending` → `running` → `succeeded` or `failed` | Each transition is written atomically (write to `.tmp` then rename). |
| 28 | Output is capped at 12KB | The runner keeps only the last 12,000 characters of combined stdout/stderr from the restore process. |
| 29 | The runner resolves its Docker Compose project name automatically | It inspects its own container via `docker inspect $HOSTNAME` and reads the `com.docker.compose.project` label. |
| 30 | File permissions use 0o777/0o666 for cross-container compatibility | The jobs directory and status files are world-readable/writable so both the app container and the runner container can access them. |

---

## E — Internal Backup Routes

| # | Rule | Explanation |
| --- | --- | --- |
| 31 | `POST /api/internal/backup/run` triggers a scheduled backup job | Accepts `strategy` (full/differential), `format`, `retentionDays`, `skipIfAlreadyCompletedToday`, `scheduleTime`, `scheduleCadence`, `scheduleDayOfWeek`, `timeZone`, and `allowCatchUpBeforeScheduledTime`. Delegates to `runScheduledBackupJob()` in `scheduledBackupRunner.ts`. |
| 32 | Configuration errors return 400 | If `ScheduledBackupConfigurationError` is thrown (bad time format, bad cadence, etc.), the route returns 400. All other errors return 500. |
| 33 | `POST /api/internal/backup/pitr/run` triggers a PITR base backup | Delegates to `runScheduledPitrBaseBackup()` in `pitr.ts`. PITR-specific errors carry a `statusCode` property that the route forwards. |

---

## F — Internal Employee Automation Routes

| # | Rule | Explanation |
| --- | --- | --- |
| 34 | Three parallel routes exist for clothing, general-merchandise, and trucking | `/api/internal/employee-automation/run-due` (clothing), `/api/internal/general-merchandise/employee-automation/run-due`, `/api/internal/trucking/employee-automation/run-due`. |
| 35 | Each route loads domain-specific settings then calls `executeDueAutomations()` | The shared engine in `src/modules/shared/employees/automation/` decides which automations are due for the domain. |
| 36 | Results are selectively persisted | `shouldPersistScheduledRun()` returns false for `disabled`, `already-recorded-run`, and `no-due-cutoff` skip reasons. All other results are persisted as `EmployeeAutomationRun` records. |
| 37 | Persisted runs also write a change-log entry | `recordChange()` logs the automation type, status, message, period key, domain, and trigger source (`'scheduler'`). |
| 38 | Success is `true` only if no result has status `error` | Partial success (some skipped, some succeeded) still returns `success: true`. |
| 39 | The response includes a summary | `{ executed, succeeded, skipped, failed }` counts from `summarizeScheduledResults()`. |

---

## G — Internal Maintenance Route: Log Pruning

| # | Rule | Explanation |
| --- | --- | --- |
| 40 | `POST /api/internal/maintenance/prune-logs` deletes old log entries | Prunes `changeLog` and `auditLog` tables based on retention constants. |
| 41 | Change log retention is 90 days | `CHANGE_LOG_RETENTION_DAYS = 90` in `src/constants/limits.ts`. |
| 42 | Audit log retention is 90 days | `AUDIT_LOG_RETENTION_DAYS = 90` in `src/constants/limits.ts`. |
| 43 | Both tables are pruned in parallel | `Promise.all()` runs both `deleteMany` operations concurrently. |
| 44 | The response reports per-table counts and cutoff dates | `{ changeLog: { pruned, retentionDays, cutoff }, auditLog: { pruned, retentionDays, cutoff } }`. |

---

## H — Internal Inventory Controls Route

| # | Rule | Explanation |
| --- | --- | --- |
| 45 | `POST /api/internal/inventory/controls` runs inventory ledger integrity checks | Compares `products.quantity` against ledger-derived sellable balances and flags negative bucket balances. |
| 46 | Drift detection compares product quantity to ledger sellable balance | Uses `buildSellableDeltaMap()` from `src/lib/inventory/movements.ts` to aggregate all inventory movements. |
| 47 | Negative balance detection scans 5 buckets | `sellable`, `damaged_hold`, `reserved`, `assembly_wip`, `sold`. A balance below the tolerance threshold (default 1e-9) is flagged. |
| 48 | `supplier_short` is excluded from balance calculations | This bucket is informational and not part of physical inventory. |
| 49 | The route returns 503 if any drift or negative sellable balances are found | `ok: true` with status 200 only when there are zero drift rows and zero negative sellable balances. |
| 50 | Results are paginated by configurable limits | `driftLimit` (default 200), `negativeLimit` (default 50) control how many rows are returned. |
| 51 | GET returns 405 | Only POST is supported. |

---

## I — Token Authentication Contract

| # | Rule | Explanation |
| --- | --- | --- |
| 52 | All 7 internal routes use the same token pattern | Each route has a `requireInternalToken()` function that compares `x-internal-token` header against `process.env.INTERNAL_JOB_TOKEN`. |
| 53 | Empty or missing server-side token returns 500 | This is a configuration error, not a client auth failure. |
| 54 | Wrong or missing client token returns 401 | With `WWW-Authenticate: Bearer` header. |
| 55 | Token comparison is exact string match after trim | Both values are trimmed before comparison. |

---

## J — Docker Infrastructure

| # | Rule | Explanation |
| --- | --- | --- |
| 56 | The `db` service uses a custom PITR-aware entrypoint | `scripts/docker/run-postgres-with-pitr.sh` configures WAL archiving when `PITR_ENABLED=true`. |
| 57 | WAL archiving uses `scripts/docker/archive-wal.sh` | Mounted read-only into the `db` container at `/usr/local/bin/archive-wal.sh`. |
| 58 | Backup volumes are shared between `app`, `backup-scheduler`, and `restore-runner` | All mount `${BMS_DATA_ROOT}/backup:/backups`. |
| 59 | The restore runner has Docker socket access | Mounts `/var/run/docker.sock` to orchestrate container restarts during restore. |

---

## K — Retention Policy Constants (`src/constants/limits.ts`)

| Constant | Value | Used By |
| --- | --- | --- |
| `AUDIT_LOG_RETENTION_DAYS` | 90 | `prune-logs` route |
| `CHANGE_LOG_RETENTION_DAYS` | 90 | `prune-logs` route |
| `PITR_BASE_BACKUP_RETENTION_DAYS` | 90 | Policy target (auto-pruning not yet implemented) |
| `WAL_ARCHIVE_RETENTION_DAYS` | 90 | Policy target (auto-pruning not yet implemented) |
| `SOFT_DELETE_RETENTION_DAYS` | 30 | Soft-delete cleanup |

---

## Coverage Note

This document was created 2026-04-11 after two independent repo-wide scans identified that the scheduler sidecar, restore runner, and all 7 internal job routes had zero business-logic documentation and zero dedicated tests. A missing fetch timeout in the undocumented scheduler caused a production outage April 6–10.

Related docs:

- `docs/business-logic/platform/admin-backup-restore.md` — backup/restore workflow and artifact contract
- `docs/business-logic/platform/shared-employee-automation.md` — automation settings (stub, pending expansion)
- `docs/inventory-ledger-controls.md` — operational runbook for inventory health checks
- `docs/PITR_INVESTIGATION_AND_RECOVERY.md` — PITR investigation procedures
