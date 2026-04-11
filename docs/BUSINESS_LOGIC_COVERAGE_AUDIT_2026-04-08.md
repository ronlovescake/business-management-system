# Business Logic Coverage Audit (2026-04-08)

This file records the current documentation coverage of the application's business logic.

Status meanings:

- `Detailed` — detailed numbered-rule docs exist
- `Overview` — a route / module map exists, but not the full extracted rule set
- `Placeholder` — the surface exists but the documentation is intentionally scaffold-level
- `Gap` — the surface exists in code, but the business-logic documentation still needs a dedicated doc

---

## Domain Coverage

| Area | Surface | Status | Notes |
| --- | --- | --- | --- |
| Clothing | Operations | Detailed | Mature doc set already exists. |
| Clothing | Accounting | Detailed | Mature doc set already exists. |
| Clothing | Employees | Detailed | Mature doc set exists, including placeholders and redirects where applicable. |
| General Merchandise | Operations | Detailed | Parallel doc set exists. |
| General Merchandise | Accounting | Detailed | Parallel doc set exists. |
| General Merchandise | Employees | Detailed | Parallel doc set exists; redirect-only and shared-workflow surfaces are documented, with only a small number of backend-only parity notes still worth extracting later. |
| Household Finance | Overview and module docs | Detailed to Overview | Household has a strong overview set plus module docs; no active accuracy defects remain from the April 8 verification passes. |
| Trucking | Domain overview | Detailed | Trucking now has domain-level docs plus detailed operations, finance, profitability, and cashflow rules. |
| Trucking | Operations | Detailed | Fleet, vehicle assignments, trip lifecycle, and current caveats are documented rule by rule. |
| Trucking | Finance | Detailed | Invoices, payments, expenses, profitability linkage, trip-finalization expense creation, and cashflow interpretation are documented. |
| Trucking | Employees | Overview | Surface is mapped, but detailed rule docs still need extraction. |

---

## Platform / Shared Coverage

| Area | Surface | Status | Notes |
| --- | --- | --- | --- |
| Platform | Auth and access | Detailed | Login, session, password reset, profile, and permission rules are documented. |
| Platform | Admin backup and restore | Detailed | Backup/restore workflow, runner state, artifact contract, and destructive restore rules are documented. Scheduling, PITR WAL workflow, and restore drills are explicitly deferred for future expansion. |
| Platform | Settings and configuration | Detailed | Global settings, payment cards, invoice settings, accounting settings, and transactions settings are documented. |
| Platform | Change log and version history | Detailed | Redirect ownership, audit filters, UI behavior, and current version-history limits are documented. |
| Platform | User management and permissions | Placeholder | 22-line seed doc only. Permission inheritance, admin user edits, and failure behavior are not extracted. |
| Platform | Module marketplace and module operations | Detailed | Module registry, install/update/reload/config, download, and performance routes are documented. |
| Platform | Shared employee automation | Detailed | Expanded from stub to 34 numbered rules across sections A–H covering settings validation, stay-in attendance, payroll generation, orchestration, internal route utils, and run history. 49 tests created. |
| Platform | Internal messaging and conversations | Detailed | Conversation creation, unread state, visibility, and participant rules are documented. |
| Platform | Scheduler and internal-job orchestration | Detailed | Documented 2026-04-11 in `scheduler-and-internal-job-orchestration.md` with 59 numbered rules. 107 new tests added. |
| Platform | Internal job routes (7 routes) | Detailed | All 7 routes documented in `scheduler-and-internal-job-orchestration.md` sections E–H. Dedicated tests in `internal-backup-routes.api.test.ts`, `internal-prune-logs.api.test.ts`, `internal-employee-automation.api.test.ts`. |
| Platform | Docker infrastructure | Overview | Docker service architecture and PITR scripts documented in `scheduler-and-internal-job-orchestration.md` section J. Helper scripts still lack individual docs. |
| Platform | Middleware route permissions | Gap | `src/middleware.ts` (38 route-permission entries) is not cross-referenced with `auth-and-access.md`. |
| Platform | Log pruning and retention | Detailed | Documented in `scheduler-and-internal-job-orchestration.md` section G with retention constants in section K. Tests in `internal-prune-logs.api.test.ts`. |

---

## Route-Surface Notes

The following route families are especially important because they represent cross-domain or platform behavior and should continue to have dedicated docs or explicit rule references:

- `src/app/settings/**`
- `src/app/admin/**`
- `src/app/login/**`, `src/app/forgot-password/**`, `src/app/reset-password/**`, `src/app/profile/**`
- `src/app/api/backup/**`, `src/app/api/restore/**`
- `src/app/api/modules/**`, `src/app/api/marketplace/**`, `src/app/api/version-history/**`, `src/app/api/change-log/**`
- `src/app/api/conversations/**`, `src/app/api/users/messaging/**`
- `src/app/api/internal/backup/run/**`, `src/app/api/internal/backup/pitr/run/**`
- `src/app/api/internal/employee-automation/run-due/**`
- `src/app/api/internal/general-merchandise/employee-automation/run-due/**`
- `src/app/api/internal/trucking/employee-automation/run-due/**`
- `src/app/api/internal/maintenance/prune-logs/**`
- `src/app/api/internal/inventory/controls/**`

---

## Repo Surface Area (April 11 verification)

| Area | File Count |
| --- | --- |
| `src/app/api` TypeScript files | 283 |
| `src/modules` TypeScript files | 450 |
| `src/lib` TypeScript files | 141 |
| `scripts/` files | 94 |
| `tests/` test files | 212 |

The previous gap list was scoped primarily to domain UI docs and underestimated the operational side of the repo.

---

## Accuracy Reconciliation

The April 8 third-pass and fourth-pass reviews changed the earlier coverage interpretation in three important ways:

- Raw route-count coverage materially overstated the documentation gap. Many route families are already documented through workflow-level docs rather than route-by-route API catalogs.
- Several previously reported gaps were reclassified as already covered: recurring payments, checkout-links / invoicing subflows, Google Drive sync, profile management, and substantial parts of trucking and general-merchandise shared-workflow coverage.
- The remaining work is now primarily precision work: correcting wording, documenting a small number of backend-only behaviors, and extracting detailed rules for a few overview-only areas.

Confirmed documentation defects identified during the verification passes have now been corrected in the source docs, including:

- general-merchandise redirect destinations
- trucking profitability and trip-finalization finance caveats
- trucking truck-assignments redirect behavior
- platform auth landing-path wording
- profile photo workflow coverage
- clothing stock-alert copy alignment
- backup/restore checksum enforcement wording
- clothing transaction soft-delete wording

---

## Residual Gaps After Reconciliation

The following items remain the real documentation follow-up set after removing overstated route-count gaps:

1. Trucking employees still need full rule extraction rather than overview-only mapping.
2. Platform user management and permissions still need detailed numbered-rule extraction beyond the current overview notes.
3. Platform shared employee automation still needs rule-level documentation of scheduler, settings, and internal-run behavior.
4. A small number of backend-only invoice-generation utilities, especially standalone `generate-invoice` / `generate-in-transit-invoice` surfaces, still warrant explicit business-logic documentation if endpoint-level completeness is required.
5. Some low-priority maintenance and cleanup routes remain intentionally under-documented because they are operational utilities rather than primary operator workflows.

---

## Operational Infrastructure Gaps (added 2026-04-11)

The April 8 audit focused on domain and platform UI workflow coverage but did not assess operational infrastructure. Two independent scans on April 11 confirmed the following additional gaps:

### Scheduler and sidecar runners

- `scripts/run-backup-scheduler.js` — Docker sidecar that orchestrates backup, PITR base, log pruning, and three employee-automation domains. No canonical business-logic doc. No tests. **Caused a production outage April 6–10** when a missing fetch timeout allowed the scheduler to hang indefinitely.
- `scripts/run-restore-runner.js` — Docker sidecar that polls for restore requests. Referenced in `admin-backup-restore.md` source list but runner-specific rules are not documented. No dedicated tests.
- `scripts/docker/run-postgres-with-pitr.sh` — `db` service entrypoint that configures PostgreSQL WAL archiving for PITR. Not documented.
- `scripts/docker/archive-wal.sh` — WAL archive command mounted into the `db` container. Not documented.

### Internal job routes (7 routes, zero dedicated tests)

| Route | Purpose | Doc Status |
| --- | --- | --- |
| `src/app/api/internal/backup/run/route.ts` | Triggers full/diff backup | Not in business-logic docs |
| `src/app/api/internal/backup/pitr/run/route.ts` | Triggers PITR base backup | Not in business-logic docs |
| `src/app/api/internal/employee-automation/run-due/route.ts` | Clothing employee automation | Partially referenced in `clothing/employees-settings.md` |
| `src/app/api/internal/general-merchandise/employee-automation/run-due/route.ts` | GM employee automation | Not in business-logic docs |
| `src/app/api/internal/trucking/employee-automation/run-due/route.ts` | Trucking employee automation | Not in business-logic docs |
| `src/app/api/internal/maintenance/prune-logs/route.ts` | Prunes audit/change logs by retention days | Not in business-logic docs |
| `src/app/api/internal/inventory/controls/route.ts` | Inventory ledger drift detection | In `docs/inventory-ledger-controls.md` only (not in `business-logic/`) |

### Automation source modules (11 files, no business-logic docs)

- `src/modules/shared/employees/automation/execution.ts`
- `src/modules/shared/employees/automation/scheduling.ts`
- `src/modules/shared/employees/automation/settingsService.ts`
- `src/modules/shared/employees/automation/stayInAutoPresenceRunner.ts`
- `src/modules/shared/employees/automation/stayInBackfill.ts`
- `src/modules/shared/employees/automation/payrollRouteInvoker.ts`
- `src/modules/shared/employees/automation/payrollCutoffDays.ts`
- `src/modules/shared/employees/automation/internalRouteUtils.ts`
- `src/lib/automation/stayInAutoPresence.ts`
- `src/lib/automation/stayInAutoPresenceGeneralMerchandise.ts`
- `src/lib/automation/stayInAutoPresenceTrucking.ts`

### Backup library modules (8 files — tested but not in business-logic docs)

- `src/lib/backup/scheduledBackupRunner.ts` (62+ tests exist in `tests/unit/backup/`)
- `src/lib/backup/backupRetention.ts`
- `src/lib/backup/pitr.ts`
- `src/lib/backup/replayExecutor.ts`
- `src/lib/backup/restorePlanner.ts`
- `src/lib/backup/restoreVerification.ts`
- `src/lib/backup/backupCoverageAudit.ts`
- `src/lib/backup/backupChangePreview.ts`

### Docker infrastructure

- `docker-compose.yml` — 4 services (`db`, `app`, `backup-scheduler`, `restore-runner`), 2 with custom entry points. Documented in `docs/DEPLOYMENT.md` only.
- `Dockerfile.restore-runner` — Separate image for restore sidecar. Not documented.
- `scripts/docker/prepare-host-storage.sh`, `scripts/docker/backup-native-db.sh`, and 5 PITR/restore shell scripts — Not in business-logic docs.

### Middleware and shared utility logic

- `src/middleware.ts` — 147 lines, 38 route-permission entries. Not cross-referenced with `auth-and-access.md`.
- `src/core/api/middleware.ts` — Reusable API error handler and validation. Not documented.
- `src/lib/formatters.ts` — Date/number formatting with `Asia/Manila` timezone default. Not documented. (Timezone bug fixed 2026-04-11.)
- `src/constants/limits.ts` — `AUDIT_LOG_RETENTION_DAYS`, `CHANGE_LOG_RETENTION_DAYS`. Not documented.
- `src/constants/timeouts.ts` — System timeout constants. Not documented.
- `src/lib/inventory/movements.ts` — Inventory movement calculations used by internal controls route. Not in business-logic docs.

### Scripts and repair tooling (no repo-wide catalog exists)

No maintained catalog of active, destructive, read-only, or retired scripts exists. The following operationally important scripts have no documentation home and no dedicated tests:

| Script | Category |
| --- | --- |
| `scripts/run-backup-scheduler.js` | Production-critical sidecar |
| `scripts/run-restore-runner.js` | Production-critical sidecar |
| `scripts/plan-restore.ts` | Restore tooling |
| `scripts/replay-restore-chain.ts` | Restore tooling |
| `scripts/verify-restore.ts` | Restore verification |
| `scripts/accounting-db-integrity-check.ts` | Accounting integrity |
| `scripts/accounting-sanity-check.ts` | Accounting integrity |
| `scripts/set-opening-balances.ts` | Accounting setup |
| `scripts/backfill-sale-movements.ts` | Data repair |
| `scripts/backfill-receipt-movements.ts` | Data repair |
| `scripts/backfill-reservation-movements.ts` | Data repair |
| `scripts/rollback-sale-backfill-movements.ts` | Data repair (destructive) |
| `scripts/reclass-receipt-backfill-opening-inventory.ts` | Data repair |
| `scripts/resync-paid-prepared-inventory-movements.ts` | Data repair |
| `scripts/inventory-ledger-healthcheck.ts` | Inventory integrity |
| `scripts/report-inventory-ledger-drift.ts` | Inventory integrity |

---

## Priority Order For The Next Detailed Pass (revised 2026-04-11)

1. **Scheduler and internal-job orchestration doc** — create one canonical platform doc anchored to `scripts/run-backup-scheduler.js`, `src/lib/backup/scheduledBackupRunner.ts`, `src/modules/shared/employees/automation/stayInAutoPresenceRunner.ts`, and the 7 internal routes. This is the highest priority because a missing fetch timeout in the undocumented scheduler caused a production outage.
2. **Shared employee automation** — ✅ expanded to detailed rules (sections A–H, 49 tests).
3. **Internal job route tests** — add dedicated tests for all 7 internal routes and the two sidecar scripts before relying on repo-wide test generation.
4. **Trucking employees** — full rule extraction starting from `docs/business-logic/trucking/employees-overview.md`.
5. **Platform user management and permissions** — expand from placeholder to real rule doc.
6. **Backup scheduling, retention, PITR WAL, and restore drills** — fill the explicit "future expansion" items noted in `admin-backup-restore.md`.
7. **Scripts catalog** — create a maintained reference covering active, destructive, read-only, retired, and production-critical scripts.
8. **Middleware route-permission cross-reference** — document or link from `auth-and-access.md`.
9. **Standalone invoice-generation utility surfaces**.
10. **Remaining low-priority maintenance / cleanup route families** if operational documentation depth is desired.

---

## Current Working Conclusion (revised 2026-04-11)

The repository has a documentation home for every major domain and cross-domain area, and the business-critical **workflow** coverage is substantially stronger than the earlier raw route-count estimate implied.

However, the April 8 audit significantly underestimated operational infrastructure gaps. Two independent scans on April 11 confirmed that:

- The backup scheduler sidecar (`scripts/run-backup-scheduler.js`) has **no documentation and no tests**, and a missing timeout in this script caused a production outage lasting April 6–10.
- All 7 internal job routes have **no business-logic docs and no dedicated tests**.
- 11 automation source modules have **no business-logic documentation**.
- 8 backup library modules are tested but **invisible to the business-logic doc set** that drives test generation.
- Docker infrastructure (4 services, 2 Dockerfiles, PITR entrypoint, WAL archiver, 5+ helper scripts) is documented only in `DEPLOYMENT.md`, not in business-logic docs.
- No repo-wide script catalog exists. At least 16 operationally important scripts have no documentation home.
- Middleware route permissions (38 entries) are not cross-referenced with auth docs.

The remaining work is no longer just precision rule-extraction. It includes a material operational documentation backlog that must be addressed to prevent the same class of undetected failures that caused the April 6 outage.