# Refactor Changelog Stream

Generated: 2026-02-20T17:38:19.470Z

This compact stream summarizes backlog execution addenda and active report artifacts.

## Backlog Execution Stream

### Addendum — UX Consistency + Sorting Options Update (Feb 23, 2026)

- Standardized dropdown viewport behavior globally by setting Mantine defaults to `maxDropdownHeight=556` (about 15 visible rows) for `Select`, `MultiSelect`, `Autocomplete`, and `TagsInput`.
- Applied the same dropdown default policy in both app-level and modal-level theme providers to keep behavior consistent across regular pages and universal modals.
- Updated sorting-distribution product option loading to combine `/products` codes and `/mix-and-match` SKUs with deduplication and stable sort ordering.
- Kept local sorting-distribution dropdown behavior aligned with global policy by removing local override logic in the info section.
- Validation run passed: `npm run lint && npm run typecheck && npm run test:unit && npm run test:integration && npm run test:hardening && npm run test:coverage`.
- Commit reference: `e38d8a27` (pushed to `main`).

### Addendum — Backlog Execution Update (Feb 21, 2026)

- Decomposed `src/app/trucking/employees/payroll/hooks/usePayroll.ts` by extracting large inline workflows into dedicated helper modules:
- Rewired `usePayroll.ts` to consume the helper modules with no intended behavior changes.
- `usePayroll.ts` reduced from `1667` lines to `1298` lines (`-369` lines in main hook).
- `npm run lint`: passed
- `npm run typecheck`: passed (`TYPECHECK_EXIT:0`)

### Addendum — Backlog Execution Update (LIV-3, Feb 21, 2026)

- Decomposed `src/components/ui/HandsontableGrid.tsx` by extracting selection-summary computation and comparison logic into:
- Rewired `HandsontableGrid.tsx` to consume extracted helper functions for bounds, summary aggregation, and summary change detection.
- `HandsontableGrid.tsx` reduced from `1467` lines to `1407` lines (`-60` lines in main component file).
- `npm run lint`: passed
- `npm run typecheck`: passed (`TYPECHECK_EXIT:0`)

### Addendum — Backlog Execution Update (LIV-4, Feb 21, 2026)

- Decomposed `src/lib/openapi/spec.ts` by extracting the OpenAPI `components.schemas` block into:
- Rewired `openApiSpec` to consume `OPENAPI_COMPONENTS` from the extracted module with no intended schema changes.
- `src/lib/openapi/spec.ts` reduced from `1449` lines to `1208` lines (`-241` lines in main spec file).
- `npm run lint`: passed
- `npm run typecheck`: passed (`TYPECHECK_EXIT:0`)

### Addendum — Backlog Execution Update (LIV-5, Feb 21, 2026)

- Decomposed `src/lib/payroll/trucking/deductions.ts` by extracting shared update/selection helpers into:
- Rewired trucking deductions to consume extracted helpers:
- `src/lib/payroll/trucking/deductions.ts` reduced from `1431` lines to `1393` lines (`-38` lines in main file).
- `npm run lint`: passed
- `npm run typecheck`: passed (`TYPECHECK_EXIT:0`)

### Addendum — Backlog Execution Update (LIV-6 to LIV-16, Feb 21, 2026)

- Decomposed and rewired all remaining P1 large-file targets from `LIV-6` through `LIV-16` using behavior-preserving helper extraction and shared utility reuse.
- Added helper modules:
- Reused existing shared CSV helpers in large hooks (`@/components/expenses`) to remove repeated parser/escaping logic.
- `src/lib/payroll/deductions.ts`: `1415` → `1377` (`-38`)
- `src/lib/payroll/deductionsGeneralMerchandise.ts`: `1409` → `1373` (`-36`)

### Addendum — Backlog Execution Update (LIV-17 to LIV-19, Feb 21, 2026)

- `LIV-17` complete: extracted shared payroll deduction engines used by clothing, general-merchandise, and trucking payroll domains:
- `LIV-18` complete: split tables-actions panel out of largest operations page component:
- `LIV-19` complete: added weekly CI snapshot artifact flow:
- `src/lib/payroll/deductions.ts`: `1377` → `1219` (`-158`)
- `src/lib/payroll/deductionsGeneralMerchandise.ts`: `1373` → `1219` (`-154`)

### Addendum — Backlog Execution Update (LIV-20 to LIV-21, Feb 21, 2026)

- `LIV-20` complete: normalized refactor reporting into one compact generated changelog stream:
- `LIV-21` complete: executed incremental naming/readability consistency pass on low-churn utility modules:
- `npm run lint`: passed
- `npm run typecheck`: passed (`VALIDATION_EXIT:0`)
- Live checklist items `LIV-20` and `LIV-21` are complete.

### Addendum — Backlog Execution Update (LIV-22 to LIV-25, Feb 21, 2026)

- `LIV-22` complete: added app-pages parity checks for shared clothing/GM page paths:
- `LIV-23` complete: added API parity checks for shared base/GM accounting+payroll route contracts:
- `LIV-24` complete: added module-operations parity contract checks for shared helper usage:
- `LIV-25` complete: added module-ledger regression checks for recurring-payments/opening-balance/manual-journal parity:
- Added shared parity test utilities:

### Addendum — Backlog Execution Update (LIV-1 Closure, Feb 21, 2026)

- Introduced tracked path for previously N/A scope:
- Updated coverage metadata for the new scope:
- Triggered live checklist synchronization through guardrails chain.
- `npm run guardrails:check`: passed (`LIV-1` auto-updated to completed)
- `npm run lint`: passed

## Active Report Artifacts

- docs/REPO_VERIFIED_EXEC_SUMMARY_2026-03-29.md
- docs/reports/REFACTOR_AUDIT_REPORT_2026-02-21.md
- docs/reports/REFACTOR_ANALYSIS_DATA_2026-02-21.json
- docs/reports/REFACTOR_AUDIT_DATA_2026-02-20.json

## Source of Truth

- docs/reports/REFACTOR_EXEC_SUMMARY_2026-02-14.md
