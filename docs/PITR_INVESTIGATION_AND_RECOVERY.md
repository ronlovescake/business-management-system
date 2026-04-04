# PITR Investigation And Recovery Runbook

This runbook is the operator-facing procedure for investigating incidents,
choosing the correct recovery path, and using the current PITR and restore
tooling safely.

Use this document together with [DEPLOYMENT.md](./DEPLOYMENT.md) when an
operator needs to investigate accidental deletes, late-discovered corruption,
or a restore decision under pressure.

## What Each Recovery Mechanism Solves

| Mechanism | Best Use | Does It Replace Live DB? | Current Support |
| --- | --- | --- | --- |
| Soft delete | Recover a record that was hidden, not physically removed | No | Available where the workflow already uses soft delete |
| Change log | Find who changed what, when, and which business identifiers were involved | No | Available |
| Audit log | Inspect before/after snapshots for Prisma-mediated writes | No | Available |
| Full dump restore | Recover the entire database to an exact dump snapshot | Yes | Supported production DR path |
| Differential/log chain drill | Rehearse replay into a temporary database | No | Drill-only |
| PostgreSQL PITR | Recover the live database to a time between base backup and WAL archive end | Yes | Supported production path |
| Scratch restore for row extraction | Restore safely, inspect, then copy specific rows back into live DB | No | Partial groundwork only; not yet a first-class operator workflow |

## Decision Tree

1. If the missing data is likely soft-deleted rather than physically removed, use the product workflow or database state to confirm soft delete first. Do not restore anything until that is ruled out.
2. If you need to know what happened before deciding on recovery, start in the PITR Recovery Inspector and use the Find Event tab to locate the destructive or suspicious event.
3. If you only need to inspect historical state safely, use a drill workflow that restores into a temporary database instead of touching the live app database.
4. If you need the entire live database rewound to a known time and you already know the exact cutoff, use PITR with the chosen base backup and target time.
5. If the exact event time is unknown, narrow the window with logs first. If logs are insufficient, use the binary-search procedure below. Do not repeatedly experiment against the live database when a safe drill path can narrow the window.
6. If the incident can be solved by extracting one or a few rows from a safe restored copy, prefer that over an in-place production rewind.
7. If the available evidence is weak and scratch PITR is not available for the scenario, stop and capture the current state before attempting production PITR.

## Investigation Workflow

### 1. Gather the incident facts

- Record who reported the issue, when it was noticed, and what business object is missing or wrong.
- Write down the strongest available business identifiers: customer name, invoice number, product code, employee name, transaction number, shipment code, route, or module.
- Decide whether the incident appears to be a delete, an incorrect update, an import problem, or a broader corruption event.

### 2. Use the PITR Recovery Inspector

- Open the PITR Recovery Inspector in Operations Settings.
- Go to the Find Event tab.
- Use Actor, Business identifier, Entity type, Entity ID, Action, Source, and date range to narrow the server-side result set.
- Use the Clue field to scan the returned payloads for the exact record details.
- Inspect the selected event's old value, new value, metadata, actor, and source.
- If the event is the destructive change you need to recover from, use Use This Event For Restore Planning.

### 3. Interpret the planner anchor

- The planner chooses the latest eligible physical base backup before the event.
- The suggested restore target is one second before the selected event when possible.
- If the selected event predates the oldest retained base backup, PITR around that event is not currently possible with the retained chain.

## Binary-Search PITR Procedure

Use this when no exact log entry exists, the logs are incomplete, or the only known fact is a coarse time window such as “it was still correct in the morning and wrong by afternoon.”

### Preconditions

- Define an earliest known good time.
- Define a latest known bad time.
- Confirm that the interval is covered by a retained base backup plus WAL or by a recoverable dump/chain drill path.
- Prefer a safe drill target whenever one exists. Repeated production rewinds are not the first choice.

### Procedure

1. Establish the initial window: earliest known good and latest known bad.
2. Choose a midpoint timestamp.
3. Inspect the state at that midpoint using the safest available method:
   - preferred: a drill workflow into a temporary database
   - fallback: a non-destructive query path if the history is already observable without restore
   - last resort: a production PITR only after explicit operator approval and state capture
4. Ask one question only: was the target record already wrong at the midpoint?
5. If yes, move the latest known bad time back to the midpoint.
6. If no, move the earliest known good time forward to the midpoint.
7. Repeat until the interval is narrow enough to identify the likely destructive event or safe restore target.
8. Once narrowed, choose the final restore target just before the first known bad state.

### Operational rule

- Do not use repeated in-place production PITR as a search tool when a safe drill or temporary-database workflow can narrow the interval.
- If true scratch PITR for the exact WAL chain is not available yet, use logs plus any available drill workflows to narrow the window as much as possible, then perform one deliberate production PITR instead of multiple trial restores.

## Safe Recovery Patterns

### Full dump drill

Use when you have a full dump backup and want to inspect or verify data safely.

```bash
npm run docker:restore:drill -- <dump-file>
```

This restores into a temporary Docker database, verifies against the manifest snapshot, and drops the temporary database afterward.

### Chain drill

Use when the target is a differential or log backup chain and you need a safe rehearsal.

```bash
npm run docker:restore:chain-drill -- <backup-folder>
```

This remains drill-only. It is not the supported production DR path.

### Production PITR

Use only when you have already identified the correct target time and the business decision is to rewind the live database.

```bash
npm run docker:restore:pitr -- --base-backup <base-backup-folder> --target-time <ISO-8601> --confirm
```

This replaces the live PostgreSQL data directory with the selected base backup and replays archived WAL to the target time.

## When To Use In-Place PITR Versus Scratch Restore

| Criterion | In-Place PITR | Scratch Restore |
| --- | --- | --- |
| Scope of data loss | Entire database state at a point in time | One or a few specific rows or a small object graph |
| Side effects | Reverts all changes since the target time — including unrelated writes | No side effects on live data; surgical row reintroduction |
| Operator confidence in target time | High — you know the exact cutoff | Low or medium — you need to inspect before committing |
| Urgency | High — the system is unusable | Medium — individual records are missing but business continues |
| Current support | Fully supported production path | Drill-only; productization is in progress |

**Rule:** Prefer scratch restore whenever the incident can be resolved by recovering specific rows
and the drill workflows cover the required backup format. Use in-place PITR only when the scope of
loss requires reverting the entire database to a known time.

## Extracting Rows From A Safe Restored Copy

### Prerequisites

- Identify the specific rows to recover: table name, primary key values, approximate creation or
  modification time.
- Confirm the backup format — full dump or PITR differential — determines which drill command to
  use.
- Have write access to the live database for the reinsert step.

### Pattern (full-dump drill)

```bash
# 1. Restore into a temporary database — does NOT touch the live DB
npm run docker:restore:drill -- <dump-file>

# 2. Connect to the temporary database to inspect and extract rows
docker exec -it <db-container> psql -U <POSTGRES_USER> -d <POSTGRES_DB>_restore_drill

# 3. Export the specific rows to a SQL script
pg_dump \
  -U <POSTGRES_USER> \
  -d <POSTGRES_DB>_restore_drill \
  --table=<target-table> \
  --data-only \
  --column-inserts \
  -f /tmp/extracted_rows.sql

# 4. Review the script — confirm primary keys, foreign keys, and values
# 5. Apply to the live database ONLY after review
psql -U <POSTGRES_USER> -d <POSTGRES_DB> -f /tmp/extracted_rows.sql
```

### Important checks before reinserting

- Verify the primary key does not conflict with rows created since the backup was taken.
- Check foreign key constraints — verify the parent records still exist in the live database.
- For accounting records (invoices, expenses, payroll lines): check whether the reinserted rows
  will affect running balances, profit-loss summaries, or ledger entries.
- For inventory records: check reservation counts, shipment links, and stock levels.
- For payroll records: check deduction sync state and whether any subsequent payroll cycles ran
  against the same employee records.
- Record what was reinserted, why, who approved the decision, and the source backup identifier.

### What is not yet productized

- A true PITR scratch restore (restore into a temp DB using WAL-replayed state rather than a full
  dump) is not yet an available drill path. The `docker:restore:drill` command supports full dumps;
  PITR-into-temp-DB would require writing a scratch variant of `restore-pitr-into-docker.sh` that
  preserves the live DB untouched.
- Until that exists, if the incident requires PITR-level precision and cannot be addressed with a
  full-dump drill, you must perform in-place PITR and extract the rows afterward from the
  pre-PITR fallback copy that the restore script preserves as `.pre-pitr-*`.

```bash
# The PITR restore script creates a pre-PITR fallback copy before making any changes:
# /backups/postgres/.pre-pitr-<timestamp>/
# Use this as your "scratch" source for row extraction after an in-place PITR restore.
```

## Post-Recovery Verification Checklist

After any restore or row reintroduction:

1. Verify the specific incident record is present and correct.
2. Verify related records that could have been affected by the same operation.
3. Check accounting balances if the incident touched invoices, expenses, payroll, or ledger state.
4. Check inventory quantities, reservations, shipment links, and order status if the incident touched stock or transactions.
5. Confirm the acting user, timestamp window, and recovery decision are documented.
6. Capture the exact command used, the source backup/base backup, and the final target time.
7. Decide whether logging coverage or metadata needs to be improved to avoid the same ambiguity next time.

## Command Reference

```bash
npm run restore:plan -- --folder <backup-folder>
npm run docker:restore:drill -- <dump-file>
npm run docker:restore:chain-drill -- <backup-folder>
npm run restore:verify -- --dump <dump-file>
npm run restore:replay -- --folder <backup-folder>
npm run docker:restore:pitr -- --base-backup <base-backup-folder> --target-time <ISO-8601> --confirm
```

## Log Coverage Audit

### What is covered automatically

The production application uses a global Prisma middleware (`applyAuditLogMiddleware` in
`src/core/database/middleware/audit-log.ts`) that intercepts every Prisma ORM operation — create,
update, upsert, delete, updateMany, deleteMany — and writes a before/after snapshot to `audit_logs`.
This middleware is applied once in `src/lib/db.ts` and covers all application API routes.

In addition, the `change_log` service in `src/core/change-log/change-log.service.ts` is called
explicitly by:

- Transaction import and update operations (`src/modules/transactions/api/auditLogHelpers.ts`)
- Manual-journal and expense operations (`src/modules/shared/ledger/expenses/api/serviceBase.ts`)
- GM ledger operations (`src/modules/general-merchandise/ledger/api/service.ts`)

### Log coverage by domain

| Domain | change_log | audit_log | Notes |
| --- | --- | --- | --- |
| Clothing — transactions (CRUD, import) | ✅ explicit | ✅ Prisma middleware | Import events include row count and empty/template split |
| Clothing — products (CRUD, bulk import, bulk update) | ❌ not explicit | ✅ Prisma middleware | Bulk operations are audited at the row level; no summary change_log entry |
| Clothing — customers (CRUD) | ❌ not explicit | ✅ Prisma middleware | |
| Clothing — shipments (CRUD, cascade) | ❌ not explicit | ✅ Prisma middleware | `$executeRaw` for `operations_notifications` only; shipment entity writes use ORM |
| Clothing — inventory movements | ❌ not explicit | ✅ Prisma middleware | |
| Clothing — accounting (expenses, manual journal) | ✅ explicit | ✅ Prisma middleware | |
| Clothing — payroll (generate, sync LWOP) | ❌ not explicit | ✅ Prisma middleware | |
| GM — transactions, expenses | ✅ explicit (shared base) | ✅ Prisma middleware | |
| GM — products, customers, shipments | ❌ not explicit | ✅ Prisma middleware | Same gap as clothing side |
| Trucking — trips, invoices, fleet | ❌ not explicit | ✅ Prisma middleware | |
| Backup / restore route | ❌ no app-level change_log | ❌ AuditLog skips system tables | Backup events are recorded in backup manifests on disk, not in the DB |
| Household — accounts, income, expenses | ❌ not explicit | ✅ Prisma middleware | |

### Genuine gaps (bypasses both layers)

| Source | What it does | Risk |
| --- | --- | --- |
| Scripts in `scripts/` | Backfill, seed, data-fix scripts use Prisma directly without the app middleware being applied | High for data-fix scripts; low for read-only audit scripts |
| `$executeRaw` for `operations_notifications` | Inserts into a notification table only; not a business data table | Low — no business entity writes go through this path |
| Prisma `deleteMany` with no `where` (if ever used) | Middleware records count only, no before-state per row | Medium — before-state is not captured per-row for batch deletes |

### Decision

**Correlation strategy: app change_log + Prisma audit middleware as the primary combination.**

- DB-side audit triggers are not added. The current Prisma middleware already covers every ORM
  operation including before-state for updates and deletes. Adding a second DB-trigger layer would
  duplicate data and add operational complexity without adding material coverage.
- WAL/LSN-level correlation is not pursued at this time. The PITR binary-search procedure already
  provides a workable narrow-window approach for cases where event timing is ambiguous.
- Explicit `change_log` entries will be added incrementally to high-risk workflows that currently
  lack them — starting with clothing product bulk operations and payroll generation — so that
  operators can search by business identifier during incidents without relying solely on audit_log
  before/after blobs.

## Retention Windows

The target retention policy is designed so that every artifact a PITR investigation depends on
expires at the same time. If audit logs are gone but base backups still exist, investigation is
blind. If base backups are gone but WAL segments still exist, PITR is impossible. The windows must
be aligned.

### Target numbers (policy; auto-pruning enforcement is not yet implemented)

| Artifact | Constant / Variable | Target | Notes |
| --- | --- | --- | --- |
| PITR base backups | `PITR_BASE_BACKUP_RETENTION_DAYS` (code) | 90 days | Must ≥ log retention so you can PITR within the same window you investigate |
| WAL archive segments | `WAL_ARCHIVE_RETENTION_DAYS` (code) | 90 days | Must match base backup retention |
| Full backups | `BACKUP_RETENTION_DAYS` (env var, default 30) | 90 days recommended | Currently defaults to 30; raise to match log retention |
| Differential backups | same scheduler as full backups | 90 days recommended | Keep until chain is superseded by a newer full backup |
| `change_log` | `CHANGE_LOG_RETENTION_DAYS` (code) | 90 days | Investigation window |
| `audit_logs` | `AUDIT_LOG_RETENTION_DAYS` (code) | 90 days | Compliance and investigation window |
| Soft-deleted records | `SOFT_DELETE_RETENTION_DAYS` (code) | 30 days | Grace period; shorter than investigation window by design |

All constants above live in `src/constants/limits.ts`. The `BACKUP_RETENTION_DAYS` env var is read
by `src/lib/backup/scheduledBackupRunner.ts`.

### What is still missing

- Scheduled pruning jobs for PITR base backups and WAL segments are not yet implemented. Currently
  those artifacts accumulate indefinitely until manual cleanup.
- ~~`BACKUP_RETENTION_DAYS` defaults to 30 in the scheduler.~~ Now defaults to 90 in `docker-compose.yml`.
- ~~`change_log` and `audit_logs` do not yet have a scheduled cleanup job.~~ A scheduled cleanup job
  now exists at `src/app/api/internal/maintenance/prune-logs/route.ts`, triggered daily via
  `LOG_PRUNE_AUTO_ENABLED=true` in the backup scheduler.

## Validation And Drills

Run these drills periodically to confirm that PITR remains usable under pressure. Record results in
the relevant incident docs or CHECKLIST.md comments.

### Drill A — Accidental Delete Recovery

**Scenario**: An operator reports that a known product record (or payroll entry) was deleted
accidentally. The exact timestamp is known.

**Steps**:

1. Open Operations Settings → Backup & Restore → PITR Recovery Inspector.
2. Go to the **Find Event** tab. Search by entity type (`product` or `payroll`) and a date window
   around the suspected deletion time.
3. Locate the matching `action: delete` entry in the change log. Note the `createdAt` timestamp and
   the product code or entity ID.
4. Switch to the **Restore Planner** tab. The narrowed recovery window from the log entry should
   already be pre-filled (or enter manually: set target time to 1-2 minutes before the deletion
   timestamp).
5. Copy the base backup folder name from the Restore Planner's recommended selection.
6. Start a scratch restore:
   ```bash
   npm run docker:restore:pitr:scratch -- \
     --base-backup <folder> \
     --target-time "<ISO-8601 timestamp 1 minute before deletion>"
   ```
7. After the scratch container is ready, extract the deleted row:
   ```bash
   docker exec bms-pitr-scratch pg_dump \
     -U <POSTGRES_USER> --data-only --column-inserts \
     --table=<table_name> -d <POSTGRES_DB> \
     > /tmp/recovered_rows.sql
   ```
8. Review `/tmp/recovered_rows.sql`. Filter to the specific row by product code or entity ID.
9. Validate the row against the live DB (no primary key conflict, FK constraints satisfied,
   no duplicate inventory movement).
10. Reinsert into the live DB:
    ```bash
    psql -h 127.0.0.1 -p <POSTGRES_PORT> -U <POSTGRES_USER> -d <POSTGRES_DB> \
      -f /tmp/recovered_rows.sql
    ```
11. Verify the record is visible in the UI. Confirm accounting and inventory totals are correct.
12. Clean up: `docker rm -f bms-pitr-scratch && rm -rf <scratch_dir>`
13. Record the drill: time taken, which log entry identified the event, whether extraction was
    clean.

### Drill B — Binary Search For Unknown Corruption Window

**Scenario**: Data irregularities are discovered but the exact time they were introduced is unknown
(no matching log entry, or log entry is ambiguous).

**Steps**:

1. Identify the affected table and the symptom (wrong values, missing rows, phantom totals).
2. Check the `change_log` and `audit_logs` for any entries in the suspected time window via the
   PITR UI **Find Event** tab.
3. If no matching log entry exists, conduct a binary search:
   a. Pick the midpoint between the last known-good timestamp and now as the target time.
   b. Run: `npm run docker:restore:pitr:scratch -- --base-backup <folder> --target-time <midpoint>`
   c. Connect to the scratch DB and check whether the corruption is present at that point.
   d. If present: the window is before the midpoint. Repeat with a midpoint between base backup
      time and current midpoint.
   e. If absent: the window is after the midpoint. Repeat with a midpoint between the current
      midpoint and now.
   f. Narrow in until you have a ≤ 10-minute window.
4. Once the window is identified, use Drill A procedure to extract the pre-corruption state.
5. Verify the fix against accounting, inventory, and payroll totals as appropriate.
6. Record the drill: number of PITR points tested, final target time, total elapsed time.

### Log Retention Validation

**Goal**: Confirm that `change_log` and `audit_logs` entries are available for at least 90 days
and that the pruning job removes entries older than the retention window without removing recent
entries.

**Steps**:

1. Enable log pruning: set `LOG_PRUNE_AUTO_ENABLED=true` in `.env.docker` and restart the
   backup-scheduler service.
2. Trigger the prune-logs job manually to verify it runs:
   ```bash
   curl -s -X POST \
     -H "x-internal-token: <INTERNAL_JOB_TOKEN>" \
     http://localhost:5000/api/internal/maintenance/prune-logs | jq .
   ```
   Expected response: `{ "success": true, "changeLog": { "pruned": N, ... }, "auditLog": { ... } }`
3. Confirm that entries from the last 90 days are still present by querying the change log in the
   PITR UI or via psql:
   ```sql
   SELECT COUNT(*) FROM change_log WHERE "createdAt" > NOW() - INTERVAL '90 days';
   SELECT COUNT(*) FROM audit_logs WHERE timestamp > NOW() - INTERVAL '90 days';
   ```
4. Record the pruned counts and confirm they match expectations (only entries older than 90 days
   should be removed).

## Current Boundaries

- Full PostgreSQL dump restore is still the standard production DR path.
- PITR is supported for deliberate live-database rewind when you know the target time.
- `docker:restore:pitr:scratch` provides a safe scratch PITR restore into a temporary standalone
  container without touching the live database. This is the recommended path for row extraction
  and binary-search drills.
- `change_log` and `audit_logs` are pruned automatically when `LOG_PRUNE_AUTO_ENABLED=true`
  in the backup scheduler.
- Do not treat change logs or audit logs as recovery mechanisms by themselves. They are investigation and correlation tools.
- Retention constants in `src/constants/limits.ts` define the policy target of 90 days across all artifact types. Auto-pruning enforcement for PITR base backups and WAL segments is not yet implemented.