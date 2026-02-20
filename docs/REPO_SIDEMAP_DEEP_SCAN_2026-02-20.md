# Repo-Wide App Side-Map + Latest Logic Deep Scan (2026-02-20)

## 1) Scope and Method

- Full route discovery under `src/app/**` for `page.tsx`, `layout.tsx`, `route.ts`.
- API topology quantification under `src/app/api/**`.
- Logic-surface sizing under `src/modules/**` and `src/**` TypeScript files.
- Recent-change intensity analysis from latest 12 commits.
- Complexity and risk-marker scan for maintainability signals.

## 2) App Side-Map Topology (Current State)

### Global totals

- Total app-router artifacts (`page.tsx`, `layout.tsx`, `route.ts`): **367**
- Pages: **127**
- API routes: **235**
- Layouts: **5**
- Dynamic routes (`[...]`): **60**

### Domain distribution (app-router artifacts)

- `clothing`: **42**
- `general-merchandise`: **41**
- `trucking`: **26**
- `personal` (household UI): **10**
- `admin`: **3**
- `apiRoot`: **236**
- `other` (auth/profile/settings/workspaces/root): **9**

### API topology distribution (`src/app/api/**`)

- Total API routes: **235**
- Base/shared routes: **97**
- General merchandise routes: **74**
- Trucking routes: **30**
- Household routes: **7**
- Auth/admin/security/versioning routes: **17**
- Modules/marketplace routes: **10**

## 3) Cross-Family Parity Signal

- Checked GM API route family against base route counterparts.
- GM routes scanned: **74**
- Counterparts found in base: **72**
- Missing base counterparts: **2**
  - `src/app/api/general-merchandise/operations/products/shipping-fee-calculator/route.ts`
  - `src/app/api/general-merchandise/operations/settings/change-log/route.ts`

Interpretation:

- Parity is high (~97.3% counterpart presence), with 2 GM-specialized routes that currently appear one-sided.

## 4) Latest Logic (Recent Commit Window)

### Most active code zones (last 12 commits)

1. `src/modules/clothing/operations` (71 touches)
2. `src/app/api/general-merchandise` (55)
3. `src/app/clothing/operations` (20)
4. `src/app/general-merchandise/operations` (19)
5. `src/app/clothing/employees` (16)
6. `src/app/general-merchandise/employees` (15)
7. `src/app/clothing/accounting` (14)
8. `src/modules/transactions/api` (9)

### Latest major logic themes

- High-volume decomposition wave focused on large hooks/services and shared route wrappers.
- Significant refactor churn in:
  - inventory operations,
  - transaction operation hooks/services,
  - backup/restore route utilities,
  - payroll/attendance/leave hooks,
  - parity wrappers for clothing vs general-merchandise routes.
- Most recent head commit (`b4af6186`) concentrated on transaction helper extraction + file-read utility consolidation + documentation closure.

## 5) Logic Surface Density (`src/modules/**`)

Top module footprints by file count:

- `src/modules/clothing`: **346 files**
- `src/modules/trucking`: **61**
- `src/modules/general-merchandise`: **36**
- `src/modules/household`: **20**
- `src/modules/auth`: **19**
- `src/modules/shared`: **18**
- Remaining module groups are comparatively small.

Interpretation:

- Clothing remains the dominant maintenance surface and primary refactor ROI target.

## 6) Complexity / Hotspot Metrics

### Large-file distribution (`src/**/*.ts(x)`)

- `>=500` lines: **140 files**
- `>=800` lines: **54**
- `>=1000` lines: **27**
- `>=1200` lines: **15**
- `>=1500` lines: **1**

### Largest current files (top samples)

- `src/app/trucking/employees/payroll/hooks/usePayroll.ts` (1667)
- `src/components/ui/HandsontableGrid.tsx` (1467)
- `src/lib/openapi/spec.ts` (1449)
- `src/lib/payroll/trucking/deductions.ts` (1431)
- `src/lib/payroll/deductions.ts` (1415)
- `src/lib/payroll/deductionsGeneralMerchandise.ts` (1409)
- `src/components/navigation/HeaderQuickActions.tsx` (1406)
- `src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx` (1399)

## 7) Risk Marker Scan (`src/**/*.ts(x)`)

Scanned files: **1531**

Marker counts:

- `as unknown as`: **0**
- `TODO`: **0**
- `FIXME`: **0**
- `eslint-disable @typescript-eslint/no-explicit-any`: **0**

Interpretation:

- Current marker hygiene is strong; technical debt is mostly structural/size and parity depth, not obvious suppression markers.

## 8) Findings Summary

- App side-map is broad and actively maintained across clothing, general merchandise, trucking, and household domains.
- Highest logic churn is concentrated in operations surfaces and parity-adjacent API layers.
- Structural risk remains in very large hooks/components/services despite recent decomposition progress.
- General merchandise/base API parity is mostly aligned with a small tail of route-family asymmetry.

## 9) Recommended Next Scan Follow-Ups

1. Deep parity drill for the 2 unmatched GM routes (validate intentional divergence vs missing base equivalent).
2. Continue decomposition on top-10 largest files, starting with `usePayroll` and `HandsontableGrid` surfaces.
3. Add lightweight automated side-map snapshot generation (counts + parity report) in CI/guardrails for drift detection.
4. Pair side-map scan with backup/restore schema-coverage audit to ensure route completeness aligns with data-protection completeness.
