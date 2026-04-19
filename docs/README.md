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

## Business Logic

- [BUSINESS_LOGIC_INDEX.md](./BUSINESS_LOGIC_INDEX.md) — flattened index for clothing, general merchandise, and household domain docs

The detailed business-logic documents still live under `docs/business-logic/**`, but this index is the intended shortcut so you do not have to browse deep folder paths to find the right file.

## Repository Maps And Deep Analysis

Dated structural snapshots have been archived under `docs/reports/archive/` to keep this hub focused on living docs:

- [REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md](./reports/archive/REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md)
- [REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md](./reports/archive/REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md)
- [REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md](./reports/archive/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md)

## Historical Refactor And Audit Records

- [HISTORICAL_INDEX.md](./HISTORICAL_INDEX.md) — retained historical refactor and audit references

## Documentation Rules

- Keep navigation docs at the repo root or the top level of `docs/`.
- Prefer direct, descriptive filenames over generic planning names.
- Do not add new “framework”, “implementation complete”, or temporary cleanup reports unless they are truly current and needed.
- If a document becomes obsolete, either remove it or demote it to a clearly historical reference that is no longer linked from the top-level docs.
