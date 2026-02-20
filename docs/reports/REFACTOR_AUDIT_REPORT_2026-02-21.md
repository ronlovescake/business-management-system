# Repo-Wide Refactor Audit — 2026-02-21

## 1. Scope coverage checklist (covered / N/A)

- [x] src/modules/clothing/operations/\*\* — covered (302 files)
- [x] src/modules/clothing/ledger/\*\* — covered (13 files)
- [x] src/modules/clothing/employees/\*\* — covered (33 files)
- [x] src/modules/general-merchandise/operations/\*\* — covered (24 files)
- [x] src/modules/general-merchandise/ledger/\*\* — covered (7 files)
- [x] src/modules/general-merchandise/employees/\*\* — covered (1 files)
- [x] src/modules/trucking/\*\* — covered (61 files)
- [x] src/modules/household/\*\* — covered (20 files)
- [x] src/modules/\*\* — covered (569 files)
- [x] src/app/clothing/\*\* — covered (194 files)
- [x] src/app/general-merchandise/\*\* — covered (43 files)
- [x] src/app/trucking/\*\* — covered (114 files)
- [x] src/app/personal/\*\* — covered (35 files)
- [x] src/app/api/\*\* — covered (262 files)
- [x] src/app/\*\* — covered (692 files)
- [x] src/lib/\*\* — covered (123 files)
- [x] src/components/\*\* — covered (96 files)
- [x] src/core/\*\* — covered (24 files)
- [x] src/shared/\*\* — covered (2 files)
- [x] src/services/\*\* — covered (19 files)
- [x] src/hooks/\*\* — covered (10 files)
- [x] src/utils/\*\* — covered (5 files)
- [x] src/constants/\*\* — covered (6 files)
- [x] src/types/\*\* — covered (7 files)
- [x] src/pages/\*\* — covered (1 files)
- [x] tests/\*\* — covered (89 files)
- [x] src/styles/\*\* — covered (3 files)
- [x] src/middleware.ts — covered (1 files)

## 2. Large-file metrics

- Distribution: >=500=172, >=800=60, >=1000=27, >=1200=13, >=1500=0
- Top 100 largest files:
  1. src/components/ui/HandsontableGrid.tsx (1408)
  2. src/components/navigation/HeaderQuickActions.tsx (1325)
  3. src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx (1318)
  4. src/app/clothing/employees/payroll/hooks/usePayroll.ts (1315)
  5. src/app/trucking/employees/payroll/hooks/usePayroll.ts (1299)
  6. src/app/trucking/employees/leave-tracker/hooks/useLeaveTracker.ts (1289)
  7. src/app/clothing/employees/leave-tracker/hooks/useLeaveTracker.ts (1285)
  8. src/app/trucking/employees/schedules/hooks/useSchedules.ts (1252)
  9. src/lib/payroll/trucking/deductions.ts (1234)
  10. src/lib/payroll/deductionsGeneralMerchandise.ts (1220)
  11. src/lib/payroll/deductions.ts (1220)
  12. src/lib/openapi/spec.ts (1209)
  13. src/app/trucking/employees/attendance/hooks/useAttendance.ts (1205)
  14. src/modules/clothing/employees/payroll/hooks/usePayroll.ts (1187)
  15. src/app/api/backup/route.ts (1184)
  16. src/app/clothing/employees/attendance/hooks/useAttendance.ts (1184)
  17. src/app/clothing/employees/schedules/hooks/useSchedules.ts (1181)
  18. src/lib/accounting/general-merchandise/inventory-cogs.ts (1179)
  19. src/modules/transactions/api/service.ts (1128)
  20. src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts (1128)
  21. src/modules/clothing/operations/transactions/components/TransactionPaymentsModal.tsx (1073)
  22. src/app/trucking/employees/team/hooks/useEmployeeDetail.ts (1071)
  23. src/app/clothing/employees/team/hooks/useEmployeeDetail.ts (1059)
  24. src/app/api/restore/route.ts (1052)
  25. src/app/trucking/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts (1021)
  26. src/app/api/inventory/check-stock/route.ts (1019)
  27. src/app/clothing/users/page.tsx (1002)
  28. src/app/api/general-merchandise/accounting/balance-sheet/route.ts (997)
  29. src/components/settings/UserManagementSection.tsx (995)
  30. scripts/tmp/root-archive/tmp-qa-journal-integrity.ts (988)
  31. src/modules/clothing/operations/shipments/services/**tests**/ShipmentService.test.ts (987)
  32. src/app/clothing/accounting/ledger/hooks/useLedger.ts (981)
  33. src/modules/clothing/operations/inventory/components/InventoryPage.tsx (972)
  34. tests/unit/api/employees.api.test.ts (965)
  35. src/app/api/accounting/balance-sheet/route.ts (947)
  36. src/app/clothing/employees/thirteenth-month-pay/hooks/useThirteenthMonthPay.ts (947)
  37. src/modules/clothing/operations/products/services/ProductService.ts (946)
  38. scripts/tmp/root-archive/tmp-qa-clothing-post-cutover-sales-stock-and-accounting.ts (928)
  39. src/modules/products/api/service.ts (905)
  40. src/modules/clothing/operations/transactions/hooks/useInvoiceGeneration.ts (902)
  41. tests/unit/api/cash-advances.api.test.ts (895)
  42. src/app/clothing/employees/team/components/EmployeeFormDialog.tsx (894)
  43. src/modules/clothing/operations/settings/change-log/components/ChangeLogPage.tsx (888)
  44. src/modules/clothing/operations/customers/services/CustomerService.ts (884)
  45. src/modules/trucking/operations/trips/hooks/useTripsDashboard.ts (882)
  46. src/app/api/general-merchandise/accounting/ledger/route.ts (880)
  47. src/types/module-system.ts (876)
  48. src/app/trucking/employees/team/components/EmployeeFormDialog.tsx (871)
  49. src/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage.tsx (850)
  50. src/app/api/accounting/ledger/route.ts (840)
  51. src/app/clothing/operations/messaging/MessagingClientPage.tsx (840)
  52. src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts (836)
  53. src/modules/clothing/operations/transactions/components/TransactionsPage.tsx (834)
  54. src/app/clothing/accounting/ledger/components/RecurringPaymentsPanel.tsx (827)
  55. src/app/clothing/employees/leave-tracker/hooks/**tests**/useLeaveTracker.test.ts (827)
  56. tests/unit/api/schedules.api.test.ts (826)
  57. src/app/trucking/employees/schedules/hooks/**tests**/useSchedules.test.ts (820)
  58. src/app/clothing/employees/schedules/hooks/**tests**/useSchedules.test.ts (820)
  59. tests/unit/api/leave-requests.api.test.ts (818)
  60. src/modules/clothing/operations/prices/components/PricesPage.tsx (810)
  61. src/modules/clothing/operations/products/hooks/useProductsGrid.tsx (795)
  62. src/app/trucking/employees/leave-tracker/hooks/**tests**/useLeaveTracker.test.ts (795)
  63. src/app/trucking/employees/cash-advance/hooks/useCashAdvance.ts (790)
  64. src/app/clothing/employees/team/hooks/useTeam.ts (789)
  65. src/modules/clothing/operations/shipments/services/ShipmentService.ts (788)
  66. src/app/clothing/accounting/hooks/useExpenses.ts (787)
  67. src/app/trucking/expenses/hooks/useExpenses.ts (777)
  68. src/components/features/expenses/ExpensesLayout.tsx (775)
  69. tests/unit/api/shipments.api.test.ts (775)
  70. tests/unit/api/payroll.api.test.ts (775)
  71. src/modules/clothing/operations/products/components/AddProductModal.tsx (773)
  72. src/app/trucking/employees/team/hooks/useTeam.ts (773)
  73. src/app/clothing/employees/cash-advance/hooks/useCashAdvance.ts (768)
  74. src/app/api/accounting/journal/route.ts (760)
  75. src/app/api/general-merchandise/payroll/route.ts (757)
  76. src/app/api/general-merchandise/accounting/journal/route.ts (757)
  77. src/modules/clothing/operations/shipments/components/ShipmentsDashboard.tsx (755)
  78. src/app/clothing/employees/team/[id]/page.tsx (745)
  79. src/app/clothing/employees/dashboard/page.tsx (744)
  80. src/lib/accounting/inventory-cogs.ts (742)
  81. src/modules/clothing/employees/dashboard/components/EmployeeDashboardPage.tsx (740)
  82. src/lib/utils/fuzzyMatch.ts (739)
  83. tests/unit/api/expenses.api.test.ts (739)
  84. src/app/api/shipments/[id]/transit-build/route.ts (728)
  85. src/app/trucking/employees/team/[id]/page.tsx (719)
  86. src/app/personal/hooks/useHouseholdExpenses.ts (718)
  87. src/app/trucking/employees/employee-loans/hooks/**tests**/useEmployeeLoans.test.ts (710)
  88. src/app/clothing/employees/employee-loans/hooks/**tests**/useEmployeeLoans.test.ts (710)
  89. src/modules/clothing/operations/transactions/hooks/useTransactionsData.ts (705)
  90. src/modules/clothing/operations/sorting-distribution/services/**tests**/SortingDistributionService.test.ts (700)
  91. src/modules/clothing/operations/products/components/MixAndMatchTab.tsx (699)
  92. src/app/api/modules/route.ts (699)
  93. src/app/api/trucking/schedules/route.ts (699)
  94. src/app/api/schedules/route.ts (696)
  95. src/modules/clothing/operations/products/hooks/useShippingFeeCalculator.ts (687)
  96. src/modules/trucking/operations/trips/components/LogTripModal.tsx (685)
  97. src/hooks/useVersionHistory.ts (684)
  98. src/app/clothing/operations/message-templates/MessageTemplatesBoard.tsx (682)
  99. src/modules/general-merchandise/transactions/api/service.ts (674)
  100. src/app/clothing/operations/business-intelligence/components/BiDashboard.tsx (674)

## 3. Duplication metrics

- app-pages: shared relative paths=38, exact clone count=1, clone ratio=2.63%
- api-routes: shared relative paths=72, exact clone count=0, clone ratio=0.0%
- module-ops: shared relative paths=21, exact clone count=0, clone ratio=0.0%
- module-ledger: shared relative paths=7, exact clone count=0, clone ratio=0.0%

## 4. Risk markers

- Totals: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/clothing/operations/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/clothing/ledger/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/clothing/employees/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/general-merchandise/operations/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/general-merchandise/ledger/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/general-merchandise/employees/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/trucking/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/household/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/modules/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/clothing/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/general-merchandise/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/trucking/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/personal/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/api/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/app/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/lib/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/components/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/core/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/shared/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/services/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/hooks/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/utils/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/constants/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/types/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/pages/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- tests/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/styles/\*\*: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0
- src/middleware.ts: as unknown as=0, TODO/FIXME=0, eslint-disable @typescript-eslint/no-explicit-any=0

## 5. Prioritized backlog (P1/P2/P3)

- P1: Decompose remaining >=1200 LOC hotspots | blast radius: Cross-domain app/modules/shared services | expected ROI: High | targets=12
- P1: Reduce clone ratio in app-pages shared set | blast radius: clothing + general-merchandise route families | expected ROI: High
- P2: Codify parity checks for all duplicated families in CI gate | blast radius: API/app/module parity regressions | expected ROI: Medium-High
- P2: Decompose 1000-1199 LOC files incrementally | blast radius: High-change hooks/routes/components | expected ROI: Medium
- P3: Documentation normalization and audit stream hygiene | blast radius: Process/docs only | expected ROI: Medium-Low
- P3: Naming/readability consistency in low-churn modules | blast radius: Low-risk scattered files | expected ROI: Low-Medium

## 6. Cross-family parity actions

- app-pages: status=aligned | checked=38 | gaps=0
- api-routes: status=aligned | checked=18 | gaps=0
- module-ops: status=aligned | checked=10 | gaps=0
- module-ledger: status=aligned | checked=7 | gaps=0
