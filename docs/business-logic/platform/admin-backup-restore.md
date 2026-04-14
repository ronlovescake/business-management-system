# Platform — Admin Backup And Restore

> **Source files:**
>
> - `src/app/admin/backup-restore/page.tsx`
> - `src/app/api/backup/**`
> - `src/app/api/restore/run/route.ts`
> - `src/lib/backup/restoreJobState.ts`
> - `scripts/run-restore-runner.js`
> - `scripts/docker/restore-dump-into-docker.sh`
> - `scripts/docker/validate-dump-backup.js`
> - `src/modules/clothing/operations/settings/components/backup-restore/**`

---

## A — Access Control And Scope

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Backup and restore endpoints are admin-gated | Backup / restore route handlers call `requireBackupRestoreAdmin`, so this surface is intentionally restricted to admin-level operators. |
| 2 | Backup / restore is platform logic, not one-domain logic | Although the UI currently surfaces strongly through settings and clothing-owned components, the workflow affects the whole database and belongs to the platform layer. |
| 3 | UI restore is operator-managed | The UI explicitly treats restore as an operator-managed workflow instead of a low-friction in-app action. |

---

## B — Backup Artifact Contract

| # | Logic | Explanation |
| --- | --- | --- |
| 4 | Full PostgreSQL dump is the supported disaster-recovery artifact | The current DR contract is dump-first: the restore flow is built around a PostgreSQL `.dump` artifact. |
| 5 | UI restore requires a backup manifest | `POST /api/restore/run` resolves the selected timestamp folder through `MANIFEST.json`; the queued restore cannot proceed without that manifest. |
| 6 | Only `.dump` files are accepted for DR restore | The restore target resolver requires a manifest entry whose selected artifact ends in `.dump`, and the restore script re-validates that requirement before execution. |
| 7 | Manifest strategy must be `full` for supported DR restore | Both restore-target resolution and the restore script reject backups whose manifest strategy is not `full`. |
| 8 | Manifest must explicitly reference the selected dump | Restore-target resolution requires the manifest to name the selected `.dump` artifact before the job can be queued. |
| 9 | Baseline dump checksum verification is enforced before replacement begins | The UI submission step queues an operator-managed restore target, then `scripts/docker/restore-dump-into-docker.sh` validates the planned full-dump baseline with `validate-dump-backup.js` before the Docker database is replaced. |
| 10 | JSON / CSV / XLSX artifacts are inspection exports only | The restore modal and docs consistently treat JSON, CSV, and XLSX artifacts as browse/export material, not supported DR restore inputs. |

---

## C — Restore Submission Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 11 | Restore target is selected by timestamp folder | UI restore submission identifies a backup by its timestamp-named folder, not by an arbitrary freeform path. |
| 12 | Restore timestamp must match the timestamp-folder pattern | `POST /api/restore/run` validates the timestamp with `isValidTimestampFolderName`. |
| 13 | Restore requires typed destructive confirmation | The confirmation text must exactly equal `RESTORE <timestamp>` or the request is rejected. |
| 14 | UI restore is rejected when the runner is offline | If the restore-runner heartbeat is stale or absent, the submission endpoint returns a `503` with a specific offline error. |
| 15 | Only one restore job may be active at a time | If the current status file shows `pending` or `running`, a new restore request is rejected with conflict semantics. |
| 16 | UI restore can queue replay-capable chains when the planner resolves a valid baseline | `resolveOperatorManagedRestoreTarget` allows differential/log targets only when the restore planner finds a valid full-dump baseline and every replay step has an executable artifact. |
| 17 | Backup folder path is bounded to the backup root | Restore target resolution rejects dump paths that escape the configured backup directory. |

---

## D — Restore Runner State Model

| # | Logic | Explanation |
| --- | --- | --- |
| 18 | Restore-runner liveness is tracked by heartbeat file | The runner writes `_restore-jobs/heartbeat.json` on a polling cadence so the UI can detect availability. |
| 19 | Runner availability is freshness-based | `isRestoreRunnerAvailable` treats the runner as online only when the heartbeat is recent enough, defaulting to a 15-second max age. |
| 20 | Restore job state lives in one status file | `_restore-jobs/status.json` is the canonical runner job-state file. |
| 21 | Restore jobs use four phases | The current phase model is `pending`, `running`, `succeeded`, and `failed`. |
| 22 | Pending restore status is created before execution begins | The API writes a `pending` status record immediately after accepting a validated restore request. |
| 23 | Runner converts pending jobs into running jobs | The sidecar polls the status file and promotes a `pending` job to `running` when it begins execution. |
| 24 | Runner marks stale running jobs failed after restart | If the runner restarts while a job is still marked `running`, it rewrites the status to `failed` to avoid silently implying success. |
| 25 | Runner captures failure output into status | When restore execution fails, the runner writes the error output back into the job status so the UI can show the failure context. |

---

## E — Destructive Restore Execution

| # | Logic | Explanation |
| --- | --- | --- |
| 26 | Restore intentionally stops the app before replacing the database | `restore-dump-into-docker.sh` stops the `app` service before dropping and recreating the target database. |
| 27 | Temporary app downtime is expected during restore | Because the same app serves the UI and is stopped during restore, the browser can temporarily lose connection to the site. |
| 28 | Restore waits for Postgres readiness before destructive DB operations | The restore script repeatedly runs `pg_isready` and aborts if Postgres does not become ready in time. |
| 29 | Restore terminates active database connections before dropping the DB | The script explicitly terminates other backends connected to the target database before `DROP DATABASE`. |
| 30 | Restore recreates the target database before `pg_restore` | The flow is replace-in-place: drop DB, create DB, then restore the dump into the new database. |
| 31 | Restore starts the app again after `pg_restore` succeeds | App restart is the last step of the destructive restore sequence. |
| 32 | The current UI restore flow is full replacement, not in-place reconciliation | The restore path does not merge rows or replay business operations incrementally; it replaces the database contents. |

---

## F — UI Behavior And Operator Experience

| # | Logic | Explanation |
| --- | --- | --- |
| 33 | Restore availability is shown in the Backup Preview modal | The restore tab displays runner online/offline state, heartbeat time, latest job status, and planner output. |
| 34 | Restore planner is shown before execution | The modal displays the restore chain and planner readiness so the operator can review what will be restored. |
| 35 | Restore job status persists after the app comes back | Because status is file-backed in the shared backup directory, the UI can read the latest completed or failed job after restart. |
| 36 | UI restore warns that the app may become unavailable | The restore confirmation text and modal copy explicitly warn the operator that the app will go offline while the database is replaced. |
| 38 | Replay-capable restores keep the app offline until chain replay completes | When the queued target is differential or log based, the restore-runner restores the baseline dump, runs `restore:replay` in a one-off app container, and only then starts the app again. |
| 37 | Restore-runner startup is now documented in the modal when offline | The restore tab includes the command to start `restore-runner` when the runner is unavailable. |

---

## G — Current Operational Caveats

| # | Logic | Explanation |
| --- | --- | --- |
| 39 | Successful restore does not imply zero downtime | The current design intentionally trades temporary downtime for a simpler and safer replace-the-database restore flow. |
| 40 | UI restore depends on the sidecar runner being started separately | `restore-runner` is not part of the default app startup path and must be available for UI restore to work. |
| 41 | Restore correctness depends on the platform file / volume contract | The runner, status files, dump artifacts, manifest, replay artifacts, and Docker-level backup mount all have to align for the workflow to succeed. |

---

## Coverage Note

This file now records the core current behavior of backup / restore as implemented today.

Future detailed expansions can split out:

- PITR readiness and WAL workflow
- backup scheduling and retention rules
- restore drills, replay, and verification subflows

if this document becomes too large.