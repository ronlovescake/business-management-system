# Refactor Changelog — 2026-02-14

## Scope

This changelog summarizes refactors completed in this session, grouped by module area.  
Each item includes:

- What changed
- Why it is important
- Expected app impact

## 1) Governance & Audit Process

### 1.1 Refactor audit policy hardening

- What changed:
  - Strengthened mandatory scan scope, measurable outputs, parity rules, and required final report format in [development instructions](../.github/instructions/development.instructions.md).
- Why it is important:
  - Prevents partial audits and inconsistent reporting across sessions.
  - Enforces repeatable, measurable quality checks.
- App impact:
  - No runtime behavior change.
  - Improves future refactor safety, coverage, and traceability.

---

## 2) Accounting APIs (Clothing + General Merchandise)

### 2.1 Shared cast utility extraction

- What changed:
  - Added [castUtils](../src/app/api/_shared/castUtils.ts) for optional delegate access, object field reads, and reservation-payment detection.
- Why it is important:
  - Reduces repeated unsafe cast patterns and centralizes guard logic.
- App impact:
  - Lower risk of type-related regressions in API handlers.
  - No intended change to API responses.

### 2.2 Accounting ledger/journal parity updates

- What changed:
  - Replaced repeated inline cast blocks with shared helpers in:
    - [clothing ledger](../src/app/api/accounting/ledger/route.ts)
    - [clothing journal](../src/app/api/accounting/journal/route.ts)
    - [GM ledger](../src/app/api/general-merchandise/accounting/ledger/route.ts)
    - [GM journal](../src/app/api/general-merchandise/accounting/journal/route.ts)
- Why it is important:
  - Keeps equivalent route families aligned (parity) and easier to maintain.
- App impact:
  - Accounting endpoints remain functionally equivalent.
  - Reduced maintenance overhead when logic changes.

---

## 3) Customer Orders APIs

### 3.1 TODO-to-implementation replacement for customer order retrieval

- What changed:
  - Implemented real transaction-backed order mapping in:
    - [clothing customer orders route](../src/app/api/customers/%5Bid%5D/orders/route.ts)
    - [GM customer orders route](../src/app/api/general-merchandise/customers/%5Bid%5D/orders/route.ts)
- Why it is important:
  - Eliminates placeholder behavior and makes endpoints production-meaningful.
- App impact:
  - Customer order endpoints now return mapped order data from transactions.
  - Better feature completeness and downstream UI usefulness.

---

## 4) Employees Module (Shared + Clothing + Trucking)

### 4.1 Shared cash-advance UI primitives

- What changed:
  - Added shared components:
    - [shared cash-advance error boundary](../src/modules/shared/employees/cash-advance/components/CashAdvanceErrorBoundary.tsx)
    - [shared cash-advance stats cards](../src/modules/shared/employees/cash-advance/components/CashAdvanceStatsCards.tsx)
  - Updated wrappers:
    - [clothing error boundary](../src/app/clothing/employees/cash-advance/components/CashAdvanceErrorBoundary.tsx)
    - [trucking error boundary](../src/app/trucking/employees/cash-advance/components/CashAdvanceErrorBoundary.tsx)
    - [clothing stats cards](../src/app/clothing/employees/cash-advance/components/StatsCards.tsx)
    - [trucking stats cards](../src/app/trucking/employees/cash-advance/components/StatsCards.tsx)
- Why it is important:
  - Removes duplicate UI logic and enforces cross-module consistency.
- App impact:
  - Same UI behavior, less duplication.
  - Faster and safer future changes for both clothing and trucking views.

### 4.2 Payroll utility extraction

- What changed:
  - Added [shared payroll form utilities](../src/lib/payroll/form-utils.ts) for period-label parsing and totals calculation.
  - Wired into:
    - [clothing app payroll hook](../src/app/clothing/employees/payroll/hooks/usePayroll.ts)
    - [trucking app payroll hook](../src/app/trucking/employees/payroll/hooks/usePayroll.ts)
    - [modules clothing payroll hook](../src/modules/clothing/employees/payroll/hooks/usePayroll.ts)
- Why it is important:
  - Consolidates repeated payroll math and parsing logic.
- App impact:
  - No intended functional change.
  - Improved consistency of payroll computations across modules.

---

## 5) Operations Module — Checkout Links

### 5.1 Filtering logic extraction

- What changed:
  - Added [checkout links filter helpers](../src/modules/clothing/operations/checkout-links/hooks/checkoutLinksFilters.ts).
  - Replaced inline filtering blocks in [checkout links page hook](../src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts).
- Why it is important:
  - Shrinks hook complexity and makes filtering independently reusable/testable.
- App impact:
  - Search/filter behavior preserved.
  - Better maintainability and readability.

### 5.2 Invoicing tab TODO closure + CSV export implementation

- What changed:
  - Added optional import/export handlers in [invoicing tab](../src/modules/clothing/operations/checkout-links/components/tabs/InvoicingTab.tsx).
  - Implemented actual CSV export in [checkout links page hook](../src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts).
- Why it is important:
  - Removes placeholder UX and completes expected user action paths.
- App impact:
  - Users can export checkout-links data directly.
  - Clearer behavior in controls when handlers are absent.

### 5.3 Service layer replacement from placeholder to repository-backed

- What changed:
  - Refactored [checkout links service](../src/modules/clothing/operations/checkout-links/services/index.ts) to a real repository-backed service.
  - Added practical unit coverage in [checkout links service tests](../src/modules/clothing/operations/checkout-links/__tests__/service.test.ts).
- Why it is important:
  - Moves core behavior from stub to actual business logic layer.
- App impact:
  - More reliable data operations and safer evolution via tests.

---

## 6) Operations Module — Transactions

### 6.1 Draft and operation utility decomposition

- What changed:
  - Added [transaction draft utilities](../src/modules/clothing/operations/transactions/hooks/transactionDraftUtils.ts).
  - Added [transaction operation utilities](../src/modules/clothing/operations/transactions/hooks/transactionOperationUtils.ts).
  - Reduced size/duplication in [useTransactionOperations hook](../src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts).
- Why it is important:
  - Breaks a very large hook into focused, reusable logic units.
- App impact:
  - No intended behavior change.
  - Lower complexity and easier debugging of transaction editing flows.

---

## 7) Operations Module — Backup/Restore

### 7.1 Backup/restore helper extraction and export flow deduplication

- What changed:
  - Added [backup/restore tab utilities](../src/modules/clothing/operations/settings/components/backup-restore/backupRestoreTabUtils.ts).
  - Refactored [backup restore tab](../src/modules/clothing/operations/settings/components/BackupRestoreTab.tsx) to use shared option/selection/export helpers.
- Why it is important:
  - Eliminates repeated export-resolution logic and option-building code.
- App impact:
  - Export and preview behavior remains consistent.
  - Cleaner code path for future backup/restore enhancements.

---

## 8) Typing & Technical Debt Cleanup

### 8.1 Explicit-any suppression cleanup

- What changed:
  - Removed obsolete `no-explicit-any` suppression headers and aligned typed adapters in shared and module-level files, including:
    - [shared leave-request repository base](../src/modules/shared/employees/leave-requests/api/repositoryBase.ts)
    - [shared thirteenth-month repository base](../src/modules/shared/employees/thirteenth-month-pay/api/repositoryBase.ts)
    - [shared thirteenth-month service base](../src/modules/shared/employees/thirteenth-month-pay/api/serviceBase.ts)
    - [shared ledger expenses repository base](../src/modules/shared/ledger/expenses/api/repositoryBase.ts)
    - [client sanitize utility](../src/lib/security/client-sanitize.ts)
    - [clothing leave-request repository](../src/modules/clothing/employees/leave-requests/api/repository.ts)
    - [clothing thirteenth-month repository](../src/modules/clothing/employees/thirteenth-month-pay/api/repository.ts)
    - [clothing thirteenth-month service](../src/modules/clothing/employees/thirteenth-month-pay/api/service.ts)
    - [trucking leave-request repository](../src/modules/trucking/employees/leave-requests/api/repository.ts)
    - [trucking thirteenth-month repository](../src/modules/trucking/employees/thirteenth-month-pay/api/repository.ts)
    - [trucking thirteenth-month service](../src/modules/trucking/employees/thirteenth-month-pay/api/service.ts)
- Why it is important:
  - Reduces hidden type-risk and improves static analysis value.
- App impact:
  - No user-facing behavior change intended.
  - Better compile-time safety and maintainability.

### 8.2 Typed Handsontable renderer access

- What changed:
  - Replaced `window as any` renderer access with typed window shape in [sorting distribution page](../src/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage.tsx).
- Why it is important:
  - Removes unsafe global access while preserving behavior.
- App impact:
  - Same rendering behavior.
  - Fewer lint/type-safety exceptions.

### 8.3 Typecheck scope hygiene

- What changed:
  - Excluded temporary scripts path in [typecheck config](../tsconfig.typecheck.json).
- Why it is important:
  - Keeps CI/typecheck focused on production code paths.
- App impact:
  - Faster/cleaner typecheck runs with less noise.

---

## Validation Summary

- Quality gates executed and passing in this session:
  - lint
  - typecheck
  - unit tests
  - integration tests
  - hardening tests
  - coverage run

Net effect: refactor quality improved, technical debt reduced, parity increased across duplicated module families, and behavior validated through full test coverage gates.
