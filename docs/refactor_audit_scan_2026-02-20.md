# Refactor Audit & ROI Scan — 2026-02-20

## 1. Scope coverage checklist (covered / N/A)

Covered:

- src/modules/clothing/operations/\*\* (301 files)
- src/modules/clothing/ledger/\*\* (13 files)
- src/modules/clothing/employees/\*\* (33 files)
- src/modules/general-merchandise/operations/\*\* (24 files)
- src/modules/general-merchandise/ledger/\*\* (7 files)
- src/modules/trucking/\*\* (62 files)
- src/modules/household/\*\* (20 files)
- src/modules/\*\* (563 files)
- src/app/clothing/\*\* (194 files)
- src/app/general-merchandise/\*\* (43 files)
- src/app/trucking/\*\* (110 files)
- src/app/personal/\*\* (35 files)
- src/app/api/\*\* (261 files)
- src/app/\*\* (687 files)
- Shared surfaces: src/lib/** (117), src/components/** (99), src/core/** (25), src/shared/** (2), src/services/** (19), src/hooks/** (10), src/utils/** (5), src/constants/** (6), src/types/** (7), src/pages/** (1), tests/\*\* (84)
- Repository-level surfaces: src/styles/\*\* (3), src/middleware.ts

N/A:

- src/modules/general-merchandise/employees/\*\* (missing path; expected as optional per mapping note)

## 2. Large-file metrics

Distribution:

- > =500 lines: 157 files
- > =800 lines: 59 files
- > =1000 lines: 27 files
- > =1200 lines: 16 files
- > =1500 lines: 2 files

Top 20 largest files:

1. 1666 — src/app/trucking/employees/payroll/hooks/usePayroll.ts
2. 1570 — src/modules/transactions/api/service.ts
3. 1466 — src/components/ui/HandsontableGrid.tsx
4. 1448 — src/lib/openapi/spec.ts
5. 1430 — src/lib/payroll/trucking/deductions.ts
6. 1414 — src/lib/payroll/deductions.ts
7. 1408 — src/lib/payroll/deductionsGeneralMerchandise.ts
8. 1405 — src/components/navigation/HeaderQuickActions.tsx
9. 1398 — src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx
10. 1323 — src/app/trucking/employees/leave-tracker/hooks/useLeaveTracker.ts
11. 1319 — src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts
12. 1317 — src/app/clothing/employees/payroll/hooks/usePayroll.ts
13. 1285 — src/modules/clothing/employees/payroll/hooks/usePayroll.ts
14. 1279 — src/app/trucking/employees/schedules/hooks/useSchedules.ts
15. 1239 — src/app/trucking/employees/attendance/hooks/useAttendance.ts
16. 1237 — src/app/api/backup/route.ts
17. 1183 — src/app/clothing/employees/attendance/hooks/useAttendance.ts
18. 1180 — src/app/clothing/employees/schedules/hooks/useSchedules.ts
19. 1178 — src/lib/accounting/general-merchandise/inventory-cogs.ts
20. 1127 — src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts

## 3. Duplication metrics

All-family intersections (strict 4-way):

- src/app (clothing, general-merchandise, trucking, personal):
  - shared relative paths: 0
  - exact clone count: 0
  - clone ratio: 0.00%
- src/modules (clothing, general-merchandise, trucking, household):
  - shared relative paths: 0
  - exact clone count: 0
  - clone ratio: 0.00%

Pairwise route-family duplication (actionable):

- src/app clothing vs trucking:
  - shared relative paths: 81
  - exact clones: 30
  - clone ratio: 37.04%
- src/app clothing vs general-merchandise:
  - shared relative paths: 38
  - exact clones: 1
  - clone ratio: 2.63%
- src/modules clothing vs trucking:
  - shared relative paths: 18
  - exact clones: 9
  - clone ratio: 50.00%
- src/modules clothing vs general-merchandise:
  - shared relative paths: 28
  - exact clones: 0
  - clone ratio: 0.00%
- Remaining pairs involving personal/household:
  - near-zero shared relative paths and 0 exact clones (indicates domain-specific architecture)

## 4. Risk markers

Totals (repo scan over src + tests):

- `as unknown as`: 2
- `TODO` / `FIXME`: 0
- `eslint-disable @typescript-eslint/no-explicit-any`: 0

Files with markers:

- src/modules/clothing/operations/shipments/services/ShipmentService.ts (1)
- src/app/api/customers/import/route.ts (1)

## 5. Prioritized backlog (P1/P2/P3)

P1:

1. Decompose large payroll/attendance/schedules hooks in clothing + trucking families
   - Blast radius: High (employee/payroll flows across multiple routes)
   - Signals: Multiple files >1200 lines; high pairwise duplication with trucking
   - Expected ROI: High (reduced regression risk + easier parity changes)

2. Extract shared employee-domain hook primitives for clothing/trucking
   - Blast radius: High
   - Signals: src/app clothing↔trucking has 81 shared relative paths and 30 exact clones; src/modules has 18 shared and 9 exact clones
   - Expected ROI: High (remove repeated logic, consistent fixes)

3. Split large API surface file src/modules/transactions/api/service.ts (1570 lines)
   - Blast radius: High
   - Signals: Very large service entrypoint likely mixing transport/business concerns
   - Expected ROI: High (faster reviews, targeted tests, lower coupling)

P2: 4. Refactor heavy UI containers

- Targets: src/components/ui/HandsontableGrid.tsx, src/components/navigation/HeaderQuickActions.tsx
- Blast radius: Medium (shared UX surfaces)
- Expected ROI: Medium-high (render stability + maintainability)

5. Normalize payroll deduction engines
   - Targets: src/lib/payroll/deductions.ts, src/lib/payroll/trucking/deductions.ts, src/lib/payroll/deductionsGeneralMerchandise.ts
   - Blast radius: Medium-high
   - Expected ROI: Medium-high (reduce rule drift across domains)

P3: 6. Remove remaining `as unknown as` markers with typed adapter boundaries

- Targets: ShipmentService + customers/import route
- Blast radius: Low-medium
- Expected ROI: Medium (strict typing hygiene)

7. Segment generated/static heavyweight surfaces if touched frequently
   - Targets: src/lib/openapi/spec.ts, src/app/api/backup/route.ts
   - Blast radius: Medium
   - Expected ROI: Medium (developer velocity)

## 6. Cross-family parity actions

- Clothing ↔ Trucking: Apply identical refactor template first (hook decomposition + shared service extraction) because clone ratio is highest.
- Clothing ↔ General-merchandise: Use contract-first parity (shared interfaces/tests), then selective extraction where path overlap exists.
- Household/Personal: Keep domain-specific implementation but enforce same architecture boundaries and guardrails.
- For every P1 item, execute as paired changes across matching families in the same cycle unless explicitly marked out of scope.

---

Scan method notes:

- Large-file metrics from wc-based repo scan over source/test code files.
- Duplication metrics from relative-path intersections + SHA-256 exact hash matching.
- Risk markers from grep-based fallback (ripgrep unavailable in this environment).
