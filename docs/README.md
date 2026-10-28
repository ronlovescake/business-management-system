# Documentation Hub

This is the main documentation entry point for the repository.

Use these two files as the top-level starting points:

- `README.md` for project overview, commands, environment, and operational scripts
- `docs/README.md` for documentation navigation

Nested `*-overview.md` files under `docs/business-logic/**` are domain and workspace overview documents, not additional repository entry points.

## Start Here

- [README.md](../README.md) — project overview, local development, scripts, deployment contract
- [DEVELOPER_ONBOARDING.md](./DEVELOPER_ONBOARDING.md) — human-facing onboarding guide that mirrors the repo developer instructions
- [CONTRIBUTING.md](../CONTRIBUTING.md) — contributor workflow and coding standards
- [docs/reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md](./reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md) — short validated summary of the repo (archived 2026-04-19)

## Everyday Guides

- [DEBUGGING.md](./DEBUGGING.md) — VS Code debugging and regression workflows
- [DEPLOYMENT.md](./DEPLOYMENT.md) — host-neutral deployment guide
- [PITR_INVESTIGATION_AND_RECOVERY.md](./PITR_INVESTIGATION_AND_RECOVERY.md) — operator runbook for PITR investigation, binary-search narrowing, and recovery decisions
- [DOCKER_CHEAT_SHEET.md](./DOCKER_CHEAT_SHEET.md) — short command-only reference for development and production Docker flows
- [OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md](./OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md) — accounting and workflow policy
- [inventory-ledger-controls.md](./inventory-ledger-controls.md) — inventory ledger checks and recovery notes
- [Scripts manifest](./tooling/SCRIPTS_MANIFEST.md) - canonical script inventory and operational risk levels

## Business Logic

- [BUSINESS_LOGIC_INDEX.md](./BUSINESS_LOGIC_INDEX.md) — flattened index for clothing, general merchandise, and household domain docs

The detailed business-logic documents still live under `docs/business-logic/**`, but this index is the intended shortcut so you do not have to browse deep folder paths to find the right file.

The [clothing operating workflow](./business-logic/clothing/operations-workflow.md)
describes the user-confirmed business sequence. The
[accounting policy](./OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md) and linked
module contracts distinguish confirmed actual logistics charges from pricing estimates.

## Plans And Templates

- [Repo-wide refactor tracker](./plans/REFACTOR_CHECKLIST.md) - long-running backlog and dated audit evidence
- [Refactor execution plan](./plans/REFACTOR_PLAN_CHECKLIST.md) - phased work and recorded validations
- [Improvements checklist](./plans/IMPROVEMENTS_CHECKLIST.md) - improvement decisions and deferred high-risk work
- [Investment agreement template](./legal/INVESTMENT_AGREEMENT_TEMPLATE.md) - retained legal/business artifact, not an application behavior specification

Plan checkboxes and historical metrics are not proof of current behavior. Recheck
the owning source and focused tests before implementing or closing an item.

## Repository Maps And Deep Analysis

- [Accounting integrity and correctness review](./reports/ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md) - clothing accounting findings, first-batch fixes, policy decisions, validation evidence, and reconciliation limits.
- [Clothing supplier and accounting reconciliation](./reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md) - current checklist evidence, deeper Expenses/P&L/Balance Sheet analysis, shared UI repairs and unresolved historical expense defects.
- [Development supplier-migration recovery](./reports/DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md) - verified backup, restored-copy rehearsal, development migration, and unresolved historical-file/checksum evidence.
- [Clothing integrity audit and remediation](./reports/CLOTHING_INTEGRITY_AUDIT_2026-10-24.md) - confirmed fixes, verification evidence, all 40 page paths, and remaining review limits.

Dated structural snapshots have been archived under `docs/reports/archive/` to keep this hub focused on living docs:

- [REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md](./reports/archive/REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md)
- [REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md](./reports/archive/REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md)
- [REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md](./reports/archive/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md)

## Historical Refactor And Audit Records

- [HISTORICAL_INDEX.md](./HISTORICAL_INDEX.md) — retained historical refactor and audit references

## Documentation Rules

- Keep README and CONTRIBUTING at the root and required agent instructions under `.github/`. All other project Markdown belongs under `docs/`.
- Keep domain behavior under `docs/business-logic/`, tooling under `docs/tooling/`, plans under `docs/plans/`, and legal templates under `docs/legal/`.
- Prefer direct, descriptive filenames over generic planning names.
- Do not add new “framework”, “implementation complete”, or temporary cleanup reports unless they are truly current and needed.
- Archive superseded evidence through the historical index. Do not delete useful audit trails, legal artifacts or unresolved policy decisions merely because they are old.
