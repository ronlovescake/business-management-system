# Repository Logic and Computation Map (2026-02-20)

## Purpose

This document maps how the repository works end-to-end and lists the active computation/calculation logic used by the application today.

It is intended to replace early scaffold-era understanding with source-backed runtime logic.

---

## 1) System Logic Topology

## 1.1 Runtime layers

- UI routes and pages: `src/app/**`
- API routes (server orchestration): `src/app/api/**`
- Domain services and business logic: `src/modules/**`
- Shared business engines: `src/lib/**`
- Persistence: Prisma models and delegates from `prisma/schema.prisma`

## 1.2 Current side-map scale

- App-router artifacts (`page.tsx`, `layout.tsx`, `route.ts`): 367
- API routes: 235
- Domain-heavy module: `src/modules/clothing/**`

Reference: `docs/REPO_SIDEMAP_DEEP_SCAN_2026-02-20.md`

---

## 2) Domain Flow Logic (High-Level)

## 2.1 Clothing / General Merchandise Operations

1. User actions in operations pages trigger API routes under `src/app/api/**`.
2. Routes call domain services (`src/modules/clothing/**`, `src/modules/general-merchandise/**`).
3. Services normalize/validate data, apply formulas, write to Prisma models.
4. Accounting views consume normalized transaction/payment/expense/journal streams.

## 2.2 Trucking

1. Trip, expense, payroll, and fleet routes run under `src/app/api/trucking/**`.
2. Profitability aggregates revenue from completed trips and grouped expenses.
3. Payroll uses trucking-specific tables but shared deduction rules.

## 2.3 Household / Personal Finance

1. Household recurring templates create monthly expenses.
2. Generated expenses can auto-impact account balances.
3. Household accounts, budgets, expenses, and income stay in dedicated household models.

## 2.4 Cross-cutting

- Status normalization and cancellation filters drive revenue eligibility.
- Inventory movement buckets drive stock, COGS, and shrinkage accounting.
- Payment events are preferred over legacy adjustment fields where available.

---

## 3) Computation and Calculation Catalog

## 3.1 Transactions pricing and line totals

Primary source: `src/modules/clothing/operations/transactions/services/TransactionService.ts`

- Unit price formula:
  - `unitPrice = tierPrice - discount`
- Line total formula:
  - `lineTotal = quantity * unitPrice - adjustment`
- Quantity tier selection:
  - match tier where `Lower Limit <= quantity <= Upper Limit`

Additional harmonized formulas:

- `src/modules/transactions/api/service-calculations.ts`
  - Remaining balance:
    - if persisted `lineTotal` is finite, use it
    - else `quantity * unitPrice - discount - adjustment`
  - Update-time line total:
    - `quantity * unitPrice - adjustment`
- `src/modules/clothing/operations/transactions/hooks/transactionDraftUtils.ts`
  - Remaining balance fallback:
    - `quantity * unitPrice - discount - adjustment`

## 3.2 Payroll totals and deductions

Shared deduction core:

- `src/lib/payroll/deductionsShared.ts`
  - Cent rounding: `round(value * 100) / 100`
  - Deduction sum uses key set:
    - `sss + philHealth + pagIbig + tax + loans + cashAdvance + absentsLates + lwop`

UI/domain derived totals:

- `src/modules/clothing/employees/payroll/hooks/payrollHookUtils.ts`
  - `derivedTotalDeductions = sss + philHealth + pagIbig + tax + loans + cashAdvance + lwop + absentsLates`
  - `derivedNetPay = max(0, grossPay - derivedTotalDeductions)`
  - Uses explicit totals if provided, otherwise derived totals.

Payroll engines per domain:

- Clothing: `src/lib/payroll/deductions.ts`
- General merchandise: `src/lib/payroll/deductionsGeneralMerchandise.ts`
- Trucking: `src/lib/payroll/trucking/deductions.ts`

These engines share the same formula family with domain-specific Prisma models.

## 3.3 Payroll cycle and cash advance schedule computation

Source: `src/lib/payroll/cashAdvanceSchedule.ts`

- Cycle determination:
  - day `<= 15` => `FIRST_HALF`
  - day `> 15` => `SECOND_HALF`
- Payday logic:
  - first-half payday = day 15 of month
  - second-half payday = last day of month
- Next-cycle advance:
  - FIRST_HALF advances to next month day 15
  - SECOND_HALF advances to next month last day

## 3.4 Profit and Loss statement computation

Source: `src/app/api/accounting/profit-loss/route.ts`

Revenue components:

- `salesRevenueTotal = paymentRevenueTotal + legacyRevenueTotal + recognizedDepositRevenueTotal`
- `revenueTotal = salesRevenueTotal + forfeitedDepositsTotal`
- `netRevenueTotal = revenueTotal - refundTotal`

Expense and profit:

- `totalExpenses = expenseTotal + cogsTotal + shrinkageTotal`
- `grossProfit = netRevenueTotal - cogsTotal`
- `netProfit = netRevenueTotal - totalExpenses`

COGS and shrinkage are delegated from inventory accounting engines.

## 3.5 Balance Sheet computation

Source: `src/app/api/accounting/balance-sheet/route.ts`

Balance construction logic:

- Builds signed entries from:
  - opening balances
  - reclass entries
  - transit-build entries
  - transaction-derived entries
  - reservation/deposit entries
  - expense entries
  - manual journal entries
  - COGS + inventory-seed/shrinkage entries
  - refund entries
- Aggregates by normalized account and classified account type.

Final equation exposed in API stats:

- `balance = assets + liabilities + equity`
- Signed-balance convention is used (debit positive, credit negative), so balanced result trends to 0.

## 3.6 Inventory and COGS computation

Clothing source:

- `src/lib/accounting/inventory-cogs.ts`

General merchandise source:

- `src/lib/accounting/general-merchandise/inventory-cogs.ts`

Core formulas:

- Unit cost resolution:
  - prefer `landedUnitCost`
  - fallback `cogs / quantity`
- Movement value:
  - `value = quantity * unitCost`
- Inventory seed (scrap -> asset bucket): increases inventory asset (or in-transit asset by shipment status)
- Inventory shrinkage (asset bucket -> scrap): expense-side shrinkage impact

Inventory movement double-entry style generation:

- asset bucket entry into inventory account on inbound asset movement
- offset credit/debit on outbound asset movement

## 3.7 Stock availability and sellable quantity

Sources:

- `src/lib/inventory/movements.ts`
- `src/app/api/inventory/check-stock/route.ts`

Core formulas:

- Bucket delta per product:
  - `delta += toBucketQty - fromBucketQty`
- Sellable on hand:
  - if explicit sellable receipt ledger exists: `sellable = sellableDelta`
  - else: `sellable = fallbackQuantity + sellableDelta`
- Actual quantity in stock map:
  - `actual = max(base + additionals - supplierShort - damaged, 0)`

Status thresholds:

- sold out: `available <= 0`
- insufficient: `available < requested`
- low stock: `available <= 20`

## 3.8 Trucking profitability computation

Source: `src/app/api/trucking/analytics/profitability/route.ts`

Trip-level measures:

- gross revenue from completed trips
- expense totals grouped by trip (`groupBy _sum(amount)`)

Summary formulas:

- `summary.revenue = Σ trip.grossRevenue`
- `summary.expenses = Σ trip.expenseTotal`
- `summary.net = summary.revenue - summary.expenses`

## 3.9 Invoice actual weight computation

Sources:

- API route: `src/app/api/invoices/calculate-weights/route.ts`
- engine: `src/app/api/invoices/_lib/weightCalculation.ts`

Weight-per-piece resolution:

- prefer `weightPerPiece` when `> 0`
- fallback `bulkWeight / bulkQuantity` when both are positive

Invoice total weight:

- per transaction line:
  - `itemTotalWeight = weightPerPiece * quantity`
- invoice:
  - `totalWeight = Σ itemTotalWeight`
- persisted display:
  - `actualWeight = totalWeight.toFixed(2)`

## 3.10 Household recurring payments and balance effects

Source: `src/modules/household/recurringPayments/api/service.ts`

Scheduling rules:

- month offset:
  - `monthIndex = diffMonths(templateStartMonth, targetMonth)`
- inclusion gates:
  - skip if `monthIndex < 0`
  - skip if bounded and `monthIndex >= monthsCount`
- day-of-month clamp:
  - `day = min(templateStartDay, lastDayOfTargetMonth)`

Balance effect:

- when generated expense status is `approved` or `paid`, account balance is decremented by amount.

---

## 4) Data-Recognition and Eligibility Rules (Computation Adjacent)

## 4.1 Status filtering

- Explicit cancelled-status checks are centralized in transaction status helpers.
- Revenue calculations exclude cancelled orders from non-reservation payment recognition.

## 4.2 Payment-event precedence

- Accounting fetchers prefer payment-event evidence for cash/recognition where available.
- Legacy adjustment fields remain as fallback compatibility paths.

## 4.3 Date window logic

- P&L and balance sheet clamp using accounting cutover dates and explicit range filtering.

---

## 5) Where to Extend Logic Safely

When adding or changing computation logic:

1. Preserve the existing formula contracts in transaction pricing and payroll totals.
2. Keep shared helpers (`src/lib/**`) as first-class compute engines to avoid drift.
3. Update both clothing and general-merchandise parity paths when formulas are shared.
4. Add/extend tests in unit and integration suites before shipping formula changes.

---

## 6) Fast Navigation Index

- Transaction formulas: `src/modules/clothing/operations/transactions/services/TransactionService.ts`
- API transaction math helpers: `src/modules/transactions/api/service-calculations.ts`
- Draft transaction math: `src/modules/clothing/operations/transactions/hooks/transactionDraftUtils.ts`
- Payroll shared math: `src/lib/payroll/deductionsShared.ts`
- Payroll domain engines: `src/lib/payroll/deductions.ts`, `src/lib/payroll/deductionsGeneralMerchandise.ts`, `src/lib/payroll/trucking/deductions.ts`
- Cash advance cycle math: `src/lib/payroll/cashAdvanceSchedule.ts`
- P&L engine: `src/app/api/accounting/profit-loss/route.ts`
- Balance sheet engine: `src/app/api/accounting/balance-sheet/route.ts`
- Inventory/COGS engines: `src/lib/accounting/inventory-cogs.ts`, `src/lib/accounting/general-merchandise/inventory-cogs.ts`
- Stock availability math: `src/lib/inventory/movements.ts`, `src/app/api/inventory/check-stock/route.ts`
- Trucking profitability: `src/app/api/trucking/analytics/profitability/route.ts`
- Invoice weight engine: `src/app/api/invoices/_lib/weightCalculation.ts`
- Household recurring generator: `src/modules/household/recurringPayments/api/service.ts`
