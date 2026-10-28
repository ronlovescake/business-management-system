# Historical Docs Index

This page keeps the remaining historical refactor and audit records easy to find without mixing them into the main day-to-day docs.

Use current docs first:

- [README.md](../README.md)
- [docs/README.md](./README.md)
- [docs/reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md](./reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md) (archived 2026-04-19)

Use the files below only when you need historical refactor context, dated audit evidence, or old scan outputs.

Current employee procedures are in the [Master SOP Manual](business-logic/clothing/operations-workflow.md).
Current completion and open decisions are in the [reconciliation report](reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md).
Retained records below are needed for audit/recovery or unresolved findings;
they do not authorize obsolete instructions or override the current contracts.

## Clothing Review Evidence

- [Accounting integrity review, October 26](reports/ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md) - original review evidence and scoped follow-up; its dated findings are not a current work queue.
- [Supplier nonfulfillment review, October 26](reports/SUPPLIER_NONFULFILLMENT_REVIEW_2026-10-26.md) - original scenario, recognition/manifest gaps and remaining owner questions; approved implementation is recorded separately in current contracts.
- [Clothing integrity audit, October 24](reports/CLOTHING_INTEGRITY_AUDIT_2026-10-24.md) - dated route/invariant evidence, including separately unresolved findings.
- [Development migration recovery](reports/DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md) - required provenance and unrecovered historical migration evidence; never discard as an obsolete plan.

## Retained Historical Documents

- [Refactor audit cycles and coverage evidence](./reports/archive/REFACTOR_AUDIT_CYCLES_2026-03-17_TO_2026-04-06.md)
  Purpose: dated March-April 2026 audit sections extracted from the canonical tracker without deleting its evidence.
- [Date/time refactor audit](./reports/archive/DATE_TIME_REFACTOR_AUDIT_2026-04-12.md)
  Purpose: retained April 2026 timezone and display-format findings and completion labels.

- [REFACTOR_EXEC_SUMMARY_2026-02-14.md](./reports/REFACTOR_EXEC_SUMMARY_2026-02-14.md)
  Purpose: append-only historical refactor log and execution trail.

- [REFACTOR_CHANGELOG_STREAM.md](./reports/REFACTOR_CHANGELOG_STREAM.md)
  Purpose: compact generated stream summarizing backlog execution addenda and linked artifacts.

- [REFACTOR_AUDIT_REPORT_2026-02-21.md](./reports/REFACTOR_AUDIT_REPORT_2026-02-21.md)
  Purpose: dated audit snapshot with scope and large-file metrics.

## Retained Dated Structural References

Archived to `docs/reports/archive/` on 2026-04-19 to keep `docs/` root focused on current operational documentation.

- [REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md](./reports/archive/REPOSITORY_LOGIC_AND_COMPUTATION_MAP_2026-02-20.md)
- [REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md](./reports/archive/REPOSITORY_SITEMAP_TREE_DIAGRAM_2026-02-20.md)
- [REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md](./reports/archive/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md)
- [REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md](./reports/archive/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md)
- [BUSINESS_LOGIC_COVERAGE_AUDIT_2026-04-08.md](./reports/archive/BUSINESS_LOGIC_COVERAGE_AUDIT_2026-04-08.md)
- [Repo-wide analysis retained from the root scratch archive](./reports/archive/REPO_WIDE_ANALYSIS_ARCHIVED_2026-04-19.md)
- [Root scratch archive provenance](./reports/archive/ROOT_SCRATCH_ARCHIVE_2026-04-19.md)
- `refactor_inventory_scan_2026-02-20*.json` (raw scan data)

These are still useful as reference scans, but they should not override the current codebase or the verified summaries.

## Cleanup Notes

- 2026-10-28: The completed Clothing A/R plan was removed after its still-needed rules were consolidated into the Transactions contract and its sole navigation reference was replaced. Duplicate invoicing calculation sections, outdated refund/deadline instructions and unsafe old accounting reset recipes were removed. The existing operating-workflow file is now the only employee master manual; no parallel SOP file was created. Unique audit, legal and migration evidence remains intentionally retained, not offered as live procedures.
- 2026-10-25: Centralized project Markdown under `docs/`, retaining root README/CONTRIBUTING and required `.github` instructions. Preserved legal wording and dated evidence; non-Markdown scratch artifacts remain under `archives/root-scratch-2026-04-19/`.
- 2026-04-19: Dated reports moved from `docs/` root to `docs/reports/archive/` (see `IMPROVEMENTS_CHECKLIST.md` §8).
- Old cleanup-phase markdown reports were removed.
- Stale framework and missing-guide references were removed from the active docs.
- Historical docs are intentionally indexed here so the main docs remain focused on current usage.
