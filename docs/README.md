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

## Employee Procedures And Source Ownership

- [Master Business Workflow, SOP Manual and Employee Knowledge Base](./business-logic/clothing/operations-workflow.md) - the single Clothing employee manual, with 12 normal stages, 22 exception procedures, worked examples and FAQ.
- [Business Logic Index](./BUSINESS_LOGIC_INDEX.md) - developer-facing module contracts and separate business-domain rules.
- [Accounting policy](./OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md) - approved accounting interpretation, not a second employee manual.
- [Current reconciliation and follow-up register](./reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md) - implemented changes, 26/26 scoped scenario evidence, open findings and release limits.

The manual owns employee steps; module contracts own technical enforcement;
the policy owns accounting interpretation; the report owns evidence and open
decisions. Do not copy entire procedures between them. General Merchandise,
Trucking and Household retain their separate contracts; Clothing rules do not
automatically apply to them. Development implementation is not proof of deployment.

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

Employee instructions are centralized in the master manual above. The module
contracts describe implemented behavior, intentional compatibility and known
limits; they must not present proposals or dated plans as current instructions.

## Plans And Templates

- [Repo-wide refactor tracker](./plans/REFACTOR_CHECKLIST.md) - long-running backlog and dated audit evidence
- [Refactor execution plan](./plans/REFACTOR_PLAN_CHECKLIST.md) - phased work and recorded validations
- [Improvements checklist](./plans/IMPROVEMENTS_CHECKLIST.md) - improvement decisions and deferred high-risk work
- [Investment agreement template](./legal/INVESTMENT_AGREEMENT_TEMPLATE.md) - retained legal/business artifact, not an application behavior specification

Plan checkboxes and historical metrics are not proof of current behavior. Recheck
the owning source and focused tests before implementing or closing an item.

## Repository Maps And Deep Analysis

- [Development supplier-migration recovery](./reports/DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md) - verified backup, restored-copy rehearsal, development migration, and unresolved historical-file/checksum evidence.

Dated accounting, supplier and structural reviews are linked from the historical
index below. Retain their unique evidence and unresolved findings, not obsolete
instructions or alternative current procedures.

## Historical Refactor And Audit Records

- [HISTORICAL_INDEX.md](./HISTORICAL_INDEX.md) — retained historical refactor and audit references

## Documentation Rules

- Keep README and CONTRIBUTING at the root and required agent instructions under `.github/`. All other project Markdown belongs under `docs/`.
- Keep domain behavior under `docs/business-logic/`, tooling under `docs/tooling/`, plans under `docs/plans/`, and legal templates under `docs/legal/`.
- Prefer direct, descriptive filenames over generic planning names.
- Do not add new “framework”, “implementation complete”, or temporary cleanup reports unless they are truly current and needed.
- Remove genuinely superseded plans and duplicate procedures after preserving required policy/evidence and updating all consumers. Do not keep obsolete alternatives just to avoid deleting a file.
- Retain useful audit trails, legal artifacts, migration provenance and unresolved findings through the historical index. Age alone is not proof they are obsolete.
- The owner-designated root `plan.md` remains a requirements/evidence register; it is not another employee manual or a source of standing operational permission.
