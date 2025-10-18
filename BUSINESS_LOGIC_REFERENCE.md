# Czarlie & Ron Business Logic Compendium

_A living handbook that explains how the application enforces core business rules._

---

## Part I · Czarlie & Ron Clothing

### Chapter 1 · Operations → Transactions

- **Customer field guardrails** (`useTransactionOperations.ts` & `TransactionService.validateCustomer`)
  - When a name is selected, the app fetches `/api/customers` and `/api/customers/{id}/transactions` to warn about banned status or ≥50 % cancellation rate before persisting.
  - Dismissing the warning with _Cancel_ (or pressing `Esc`) clears the cell so the transaction is not committed with a risky customer.
- **Order Date auto-population** (`useTransactionOperations.ts`)
  - Selecting a customer writes today’s date into `Order Date` when the cell was empty, keeping timestamping consistent for fresh orders.
- **Product Code workflow** (`useTransactionOperations.ts` & `TransactionService`)
  - Changing `Product Code` performs a lookup against the Products module:
    - `Shipment Code` copies from the mapped product entry when available.
    - `Order Status` recalculates when the existing value is blank/`In Transit`, using shipment status + `TransactionService.getOrderStatusFromShipmentStatus`.
    - `Unit Price` auto-fills when both product and quantity are present by applying the latest tier price minus discount.
  - Clearing a product code prompts for confirmation if the order already moved past basic stages (status not blank/`In Transit`).
- **Quantity/Discount/Adjustment math** (`TransactionService.calculateUnitPrice` & `calculateLineTotal`)
  - Applies the following formulas (recomputed after every change to quantity, price, discount, or adjustment):
    - `Unit Price = Tier Price − Discount` (tier resolved from the Prices table via quantity brackets)
    - `Line Total = (Quantity × Unit Price) − Adjustment`
- **Shipment status synchronization** (`TransactionService.syncTransactionsWithShipmentStatus`)
  - Background sync (triggered by `useTransactionsData`) maps product codes to live shipment statuses, sanitizes numeric fields, and bulk-updates any row still `In Transit`/`Warehouse` so logistics changes propagate automatically.
- **CSV ingestion** (`TransactionService.transformCSVToTransactions`)
  - Imports sanitize numeric fields, guarantee column alignment, generate temporary IDs for immediate persistence, and let the `/api/transactions` POST endpoint reapply the protected Unit Price/Line Total formulas before hitting the database.
- **Batch editing safeguards** (`useTransactionOperations.ts`)
  - Paste operations queue writes, normalize placeholder values such as the literal string `"null"`, and persist once per batch to avoid partial saves.
- **Empty-row provisioning** (`useTransactionOperations.handleAdd10Rows`, `/api/transactions` POST)
  - Adds ten placeholder rows in one click and persists them with the `Shipment Code` sentinel `-`, keeping import spacing while avoiding accidental formula recalculation.
- **Invoice workflow** (`useTransactionModals`, `/api/generate-invoice`)
  - Selecting Warehouse orders groups them per customer, downloads a consolidated PDF, stamps `Invoice Date` if missing, and auto-transitions Warehouse lines to `Prepared` after confirmation.
- **Packing list workflow** (`useTransactionModals`, `/api/generate-packing-list`)
  - Generates A6 slips only for `Prepared` rows with `Line Total ≤ ₱50`, downloads a PDF bundle, and stamps `Packed Date` on the processed transactions.
- **Distribution workflow** (`useTransactionModals`, `/api/generate-distribution`)
  - Filters `Warehouse` orders, sorts by quantity ascending, produces picking slips, and leaves the data untouched besides the downloadable PDF for warehouse staff.
- **Lookup hydration & saved filters** (`useTransactionsData.ts`)
  - Merges customer names from both API and grid data, deduplicates product codes from price tiers, builds product→shipment maps, and persists the status filter (including the `All Status` aggregator) to `localStorage` so operators return to the same view.

### Chapter 2 · Operations → Products

- **Product code generation** (`ProductService.generateProductCode`)
  - Builds initials from meaningful words (skipping stop-words, handling 2-PC/3-PC special cases) and appends the posting date inside parentheses.
- **Financial model** (`ProductService.calculateFinancials` + `lib/productCalculations`)
  - Auto-computed amounts:
    - `PHP = Unit Price × Exchange Rates`
    - `Sub Total (PHP) = (Unit Price × Quantity + Alibaba Shipping Cost) × Exchange Rates`
    - `Transaction Fee = Sub Total × 0.0299` (`TRANSACTION_FEE_RATE`)
    - `Grand Total = Sub Total + Transaction Fee`
  - Cost stack:
    - `COGS = Grand Total + Forwarder's Fee + Lalamove + Packaging Cost`
    - `Base Price = Quantity > 0 ? COGS ÷ Quantity : 0`
    - `Suggested Price = ceil(Base Price × 1.22)` (`SUGGESTED_PRICE_MARKUP`)
  - Profit metrics:
    - `Projected Sales = Actual Price × Quantity`
    - `Projected Profit = Projected Sales − COGS`
    - `Projected Profit (%) = COGS > 0 ? (Projected Profit ÷ COGS) × 100 : 0`
    - `Total Markup = PHP > 0 ? (Actual Price ÷ PHP) × 100 : 0`
- **Form-to-record translation** (`ProductService.formToProductData`)
  - Reuses existing codes on edit, otherwise regenerates; carries shipment metadata through to keep logistics and product catalogs aligned.
- **CSV import rules** (`ProductService.importFromCSV`)
  - Accepts 32-column exports, pads missing fields, converts currency strings, and back-fills calculated columns (PHP totals, markup, etc.) so downstream grids remain consistent.
- **Shipment enrichment & formatting** (`ProductService.loadProducts`, `getColumnAlignment`, `usesTwoDecimalPlaces`)
  - Merges live shipment data into grid rows (CV number, sacks, CBM, weight, status) whenever a matching `Shipment Code` exists, while also standardizing per-column alignment and decimal precision so logistics values stay authoritative.
- **Search & KPI pipelines** (`ProductService.searchProducts`, `calculateStatistics`, `ProductStatsCards.tsx`)
  - Lowercases all searchable fields into a single index for instant filtering and recomputes total value, average value, and cumulative profit for the dashboard cards after every query or data refresh.
- **Grid editing safeguards** (`ProductsPage.tsx` paste/delete handlers)
  - Paste mode batches edits then persists via `bulkUpdateProducts`, caches rendered cells for performance, and limits destructive deletes to the `Shipment Code` column to avoid accidental data wipes.
- **API contract** (`app/api/products/route.ts`, `[id]/route.ts`)
  - `POST` with N>1 rows replaces the table (CSV import), `POST` with a single row appends a product, `PUT` performs full-table replacement, and `/api/products/{id}` supports targeted `GET`/`PUT`/`DELETE` with numeric coercion of financial fields.
- **Validation** (`ProductService.validateProduct`)
  - Rejects blank product names, negative amounts, and non-positive exchange rates before persisting any row.

### Chapter 3 · Operations → Prices

- **Tier guardrails** (`AddPriceModal.tsx`, `usePriceForm.ts`, `PriceService.validatePrice`)
  - Product code is mandatory, at least one tier must have all three fields, and every populated tier enforces `lower < upper` while requiring its lower bound to exceed the previous tier’s lower bound.
  - The modal enables Tier 2–4 only after the preceding tier is fully populated, preventing gaps when encoding bracketed pricing.
- **Auto-filled ranges** (`usePriceForm.updateTier`)
  - Filling Tier 1’s lower limit sets its upper limit to `10 000` by default.
  - Entering Tier 2–4 lower limits also sets their upper limits to `10 000` and automatically backfills the previous tier’s upper limit to be one less than the new lower limit, keeping quantity brackets contiguous without manual math.
- **Legacy compatibility payload** (`PriceService.formToPriceData`)
  - The add modal still writes only the first tier into the persisted record (`Lower Limit`, `Upper Limit`, `Prices`, `Price Adjustment`) so older grid consumers continue to function while multi-tier UI rolls out.
- **Price adjustment semantics** (`AddPriceModal.tsx`, `PriceService.applyBulkAdjustment`)
  - Operators can encode a per-product adjustment (positive = surcharge, negative = discount); bulk adjustments either apply a rounded peso delta or compute `round(Base Price × percentage)`, storing the result in `Price Adjustment` for downstream consumers.
- **Search, stats, and optimistic updates** (`usePricesData.ts`, `PriceStatsCards.tsx`)
  - React Query caches `/api/prices`, debounces search to 300 ms, and tags each row with a lowercased `_searchIndex` to keep filtering instant.
  - Mutations (`addPrice`, `bulkUpdatePrices`, `replaceAllPrices`) optimistically update cached rows and roll back on error before invalidating; stats cards recompute total rows, filtered rows, average price, and counts of positive/negative adjustments after every query.
- **CSV import pipeline** (`PricesPage.tsx`, `PriceService.importFromCSV`)
  - Imports skip empty or malformed rows, coerce numeric fields, strip quotes/commas, round values, and post the sanitized array to `/api/prices` where the server replaces the table; the UI announces success/failure and clears the staged file after saving.
- **Read-only grid rendering** (`PricesPage.tsx`)
  - Glide Data Grid displays localized number formats, prefixes peso symbols, and prevents inline editing; double-click detection is reserved for future edit workflows, while `Ctrl+F` focuses the search bar.

### Chapter 4 · Operations → Sorting Distribution

- **Product filtering & prefill** (`SortingDistributionService.loadProducts`, `useSortingDistributionForm.ts`, `InfoSection.tsx`)
  - The product selector only lists codes whose shipments are currently at the `Sorting` status, keeping the worksheet focused on active batches.
  - Choosing a code auto-fills the `Ordered` field with the summed product quantity across all shipments and resets prior pill selections, while validation blocks saves when the product code is blank.
- **Reservation-aware quantity pills** (`SortingDistributionService.getUniqueQuantities`, `QuantityPillButtons.tsx`)
  - Builds unique order quantities from the transactions table; clicking a pill toggles that quantity as the distribution target and drives downstream math.
- **Grid validation & derived fields** (`SortingDistributionService.validateDistribution`, `calculateDerivedFields`, `useSortingDistributionData.ts`)
  - The 100-row grid rejects negative inputs, enforces percentages between `0–100`, and requires the correct row count before saving.
  - Auto computations fire on every change:
    - `Percentage = (Row Quantity ÷ Σ Quantities) × 100`
    - `Group Number = "Number N" (assigned sequentially for non-empty rows)`
    - `Distribution = round((Row Quantity ÷ Est. Qty Received) × Selected Quantity)`
- **Inventory + customer stats** (`SortingDistributionService.calculateStatistics`, `InfoSection.tsx`)
  - Continuously recomputes:
    - `Est. Qty. Received = Sum of inbound quantities from matching shipments`
    - `Total Reservation = Sum of matching transaction quantities`
    - `Available Stock = Est. Qty. Received − Total Reservation`
    - `Total Customers = Count of unique buyers tied to the selected batch`
    - `Customer w/ Order Qty = Count of buyers matching the active quantity pill`
- **Persistence & debounced auto-save** (`useSortingDistributionData.ts`, `/api/sorting-distribution` route)
  - Every edit schedules a 1 s debounce that POSTs only non-empty rows; saves run after clearing existing records so the server always reflects the latest snapshot.
  - Loading rehydrates saved rows in sequence (padding empty slots back to defaults) and restores the last selected quantity.
- **Editing ergonomics** (`SortingDistributionPage.tsx`, `SortingDistributionService.handlePaste`)
  - Only the `Quantity` column and checkbox column accept input; other columns stay read-only because they are derived.
  - Header context menu clears all quantities with user confirmation, `Ctrl+V` pastes numbers into consecutive rows, and pressing Space toggles every checkbox at once.

### Chapter 5 · Operations → Shipments

- **Form validation** (`ShipmentService.validateShipment`)
  - Enforces required fields for shipment code/status/dates and rejects negative sacks, CBM, weight, and fee values.
- **Duration tracking** (`ShipmentService.calculateDuration*`)
  - Calculates duration in days between `Date Created` and `Date Delivered`, both for live forms and CSV imports.
- **Fee/Sacks aggregation** (`ShipmentService.calculateStatistics`)
  - Produces totals and per-status counts (In Transit, Manila Port, With Pier Gatepass, etc.) for dashboards.
- **API contract** (`ShipmentService.addShipment` / `updateShipment`)
  - Normalizes dates to "MMM d, yyyy" for display, recomputes duration on every edit, and pushes updates through `/api/shipments` with success notifications.

### Chapter 6 · Operations → Customers

- **Status catalog** (`CustomerService.getStatusOptions` & `customer.types.ts`)
  - Unified dropdown supports `Active`, `Inactive`, `Prospect`, `VIP`, and `Banned`, keeping UI and validation layers in sync.
- **Form validation** (`customer.validation.ts`)
  - Uses Zod schemas to enforce name length, phone format, URL/email validity, and accepted statuses before records hit the API.
- **CSV sanitation pipeline** (`app/api/customers/route.ts`)
  - Normalizes dates, trims fields, validates emails/URLs, and maps fuzzy statuses (e.g., "🚫 banned") to canonical labels before schema validation.
- **Bulk upsert semantics** (`PUT /api/customers`)
  - Processes uploads inside a database transaction: existing customers update by `id` or `customerName`, new ones insert, and invalid rows are reported with index + error map without halting the whole batch.
- **Customer stats helpers** (`CustomerService.calculateStats`)
  - Counts unique businesses, reachable contacts, and filtered totals to support the summary widgets on the grid view.

### Chapter 7 · Employees → Attendance

- **Record orchestration** (`useAttendance.ts`, `attendance/page.tsx`)
  - Records sort newest-first by date with a secondary employee-name tiebreaker, while search spans IDs, departments, positions, free-text details, and notes; the status filter gates the grid to `present`, `late`, `absent`, or `on-leave` entries.
- **Time & hours formatting** (`useAttendance.ts`)
  - Formatting helpers:
    - `formatTime` defends against blank/invalid inputs and renders localized 12-hour strings
    - `formatTimeRange` collapses `00:00` placeholders to em-dashes
    - `formatHours` rounds totals to two decimals for summary tiles
- **Status transitions & guardrails** (`useAttendance.ts`)
  - Inline actions mutate a record’s status without reordering, while deletions prompt for confirmation before purging the row from state.
- **CSV import pipeline** (`useAttendance.ts`)
  - Requires `employeeId`, `employeeName`, and `date`, gracefully skips blank rows, computes `totalHours` from `timeIn/timeOut` when present (falling back to a provided `totalHours` column), normalizes status to the allowed set, and accumulates per-row error messages for malformed data.
- **CSV export** (`useAttendance.ts`)
  - Emits filtered rows with defensive CSV escaping and a date-stamped filename so HR can reconcile timesheets offline.

### Chapter 8 · Employees → Expenses

- **Database-backed data flow** (`useExpenses.ts`, `useExpenseData`)
  - Hydrates the grid from `/api/expenses`, coercing nullable fields, and routes create/update/delete/bulk-create mutations through Prisma-powered helpers so UI state stays in sync with the sheet store.
- **Filtering & analytics** (`useExpenses.ts`, `components/AnalyticsTable.tsx`)
  - Search spans description, category, and employee submitter, category/status filters layer on top, and monthly breakdowns aggregate peso totals plus percentage share per expense bucket for dashboards.
- **Form handling & receipts** (`useExpenses.ts`, `ExpenseFormDialog.tsx`, `ReceiptViewerModal.tsx`)
  - Editing pre-populates modal state, new uploads convert to data URLs before persistence, and the receipt viewer reuses cached blobs (fallbacks alert when legacy files are missing).
- **Approval workflow** (`useExpenses.ts`, `ExpenseListTable.tsx` actions)
  - Approve/Reject buttons patch only the status column, issuing Mantine notifications for success; deletions confirm and cascade the change to the database.
- **CSV import safeguards** (`useExpenses.ts`, `modules/.../ExpensesCSV.ts`)
  - Both the legacy module helpers and the page hook enforce the same rules: required columns (`date`, `amount`, `description`, `category`), peso string sanitation, category whitelist validation, ISO date normalization, and per-row error tracking before bulk inserting via `bulkCreateExpenses`.
- **CSV export** (`useExpenses.ts`, `modules/.../ExpensesCSV.ts`)
  - Exports respect localized currency formatting, escapes commas/quotes, and stamps filenames with the current date for audit trails.

### Chapter 9 · Employees → Payroll

- **Roster filtering & KPIs** (`usePayroll.ts`, `payroll/page.tsx`)
  - Search spans employee names, pay periods, and bank tags; filter chips gate by status and pay period while stat cards surface total records, pending/approved counts, and cumulative net pay for settled rows.
- **Compensation math** (`usePayroll.ts`, `PayrollFormDialog.tsx`)
  - `calculateTotals` derives:
    - `Gross = Basic + Allowance + Overtime + Bonuses`
    - `Total Deductions = SSS + PhilHealth + Pag-IBIG + Tax + Loans + Others`
    - `Net = max(0, Gross − Total Deductions)`
  - The dialog validates mandatory fields before enabling Save.
- **Lifecycle transitions** (`usePayroll.ts`, `payroll/page.tsx` table actions)
  - Approve stamps `approvedBy`/`approvedDate` for pending rows, Mark as Paid sets the status to `paid` and logs the payout date, leaving historical amounts untouched.
- **CSV import/export** (`usePayroll.ts`)
  - Imports relaxed CSVs (header-skip, comma split) and recomputes gross/deductions/net for each row before merging; exports pipe filtered rows with peso formatting for finance reconciliation.

### Chapter 10 · Employees → Schedules

- **Employee hydration & stay-in logic** (`useSchedules.ts`)
  - Loads active employees from `/api/employees`, memoizes stay-in IDs, and forces their shifts to the `full-day` template regardless of manual times to honor dorm assignments.
- **Shift templates & duration helpers** (`useSchedules.ts`, `components/ScheduleListTable.tsx`)
  - `SHIFT_CONFIG` centralizes default start/end windows, `calculateDuration` reports hours, and UI badges color-code shift types for quick scanning.
- **Recurring engine with overrides** (`useSchedules.ts`, `components/CalendarBulkActions.tsx`)
  - Recurring rules generate forward schedules, skip explicit overrides, and persist manual edits with `isOverride` when a recurrence instance diverges.
- **CRUD & status workflow** (`useSchedules.ts`, `components/ScheduleControls.tsx`)
  - Save guards require core fields, auto-assign IDs, reuse existing status on edit, and offer inline actions to mark `completed` or `cancelled`.
- **CSV import/export** (`useSchedules.ts`)
  - Imports enforce a strict header contract (employee, date, shift, times, position, department), skip blanks, and append valid rows; exports emit the full roster with CSV-safe quoting and a datestamped filename.

### Chapter 11 · Employees → Leave Tracker

- **Request filtering & metrics** (`useLeaveTracker.ts`, `leave-tracker/page.tsx`)
  - Search spans employee metadata plus reasons/notes, while type/status filters narrow results; stat tiles tally total/pending/approved counts and cumulative days requested.
- **Date math & validation** (`useLeaveTracker.ts`, `LeaveFormDialog.tsx`)
  - Request validation rules:
    - `calculateDays = ((End Date − Start Date) ÷ 86 400 000) + 1`, guaranteeing inclusive date ranges
    - Form saves enforce required fields before submission
    - Editing an existing request recomputes day counts when ranges shift
- **Approval lifecycle** (`useLeaveTracker.ts`, `LeaveListTable.tsx` actions)
  - Approve stamps `approvedBy` and sets status, Reject flips to `rejected`; deletions confirm before removing from state.
- **CSV import/export** (`useLeaveTracker.ts`)
  - Imports demand canonical headers, normalize statuses, and calculate days per row before merging; exports escape CSV edge cases for external HR sharing.

### Chapter 12 · Employees → Cash Advance

- **Pipeline metrics** (`useCashAdvance.ts`, `cash-advance/page.tsx`)
  - Derives totals for pending/approved counts and the peso volume of approved/paid requests, backing stat cards and analytics widgets.
- **Workflow transitions** (`useCashAdvance.ts`, `RequestListTable.tsx` actions)
  - Approve stamps approver metadata and today’s date, Reject prompts for a reason and records it, and Mark as Paid flags fulfilled advances while leaving historical amounts intact.
- **Form CRUD & validation** (`useCashAdvance.ts`, `RequestFormDialog.tsx`)
  - Dialogs reuse state for edit vs. create, parse numeric amounts, and persist to local state pending API integration.
- **CSV import/export** (`useCashAdvance.ts`)
  - Simple comma-split import populates core fields with default `pending` status when omitted; exports filtered rows to `cash-advances-YYYY-MM-DD.csv` for finance tracking.

### Chapter 13 · Employees → Employee Loans

- **Loan portfolio analytics** (`useEmployeeLoans.ts`, `employee-loans/page.tsx`)
  - Search/filter combos cover employee name, purpose, status, and loan type; aggregate cards report total/pending/active counts plus disbursed and outstanding balances.
- **Amortization math** (`useEmployeeLoans.ts`, `LoanFormDialog.tsx`)
  - `calculateMonthlyPayment` applies the standard annuity formula:
    - `Monthly Payment = (Principal × r × (1 + r)^n) ÷ ((1 + r)^n − 1)` where `r = Annual Interest Rate ÷ 12`
    - `Monthly Payment (zero interest) = Principal ÷ n`
  - Updates monthly payments and remaining balances while preserving prior balances for non-pending edits.
- **Lifecycle actions** (`useEmployeeLoans.ts`)
  - Approve/Activate advance loans through the funnel, Mark Completed zeroes the balance, and Rejects demand a typed reason captured alongside timestamped metadata.
- **CSV import/export** (`useEmployeeLoans.ts`)
  - Imports generate pending applications with recomputed amortization figures; exports include payment metrics so accounting can audit schedules offline.

### Chapter 14 · Employees → Thirteenth Month Pay

- **Computation formula** (`useThirteenthMonthPay.ts`, `types.ts`)
  - Uses mock data seeded for demos and computes:
    - `Eligible Earnings = (Total Earnings ÷ 12) × (Eligibility Months ÷ 12)`
    - `13th Month Pay = max(0, Eligible Earnings − Deductions)`
  - Eligibility defaults to zero-safe math to avoid negative payouts.
- **Status pipeline & timestamps** (`useThirteenthMonthPay.ts`, `ThirteenthMonthPayFormDialog.tsx`)
  - Actions progress records from `pending` → `calculated` → `approved` → `paid`, stamping calculated/approved/paid dates at each hop.
- **Filtering & stats** (`useThirteenthMonthPay.ts`, `components/StatsCards.tsx`)
  - Year/status filters narrow the grid, while aggregate stats highlight counts per stage plus total vs. paid peso amounts.
- **CSV export & import hook** (`useThirteenthMonthPay.ts`)
  - Exports include detailed amounts and timestamps for compliance archives; the import entry point currently logs uploads, ready for future parsing logic.

### Chapter 15 · Employees → Team

- **API-driven roster** (`useTeam.ts`, `/api/employees` routes)
  - Fetches employees with query-parameter filters (department, status, search), normalizes numeric IDs to strings, and derives department options + aggregate salary metrics for dashboards.
- **Employee ID generation with retries** (`useTeam.ts`)
  - New hires receive sequential `EMP-XXXX` codes based on existing records; duplicate constraint errors trigger up to five regen attempts before surfacing a failure.
- **Form normalization & persistence** (`useTeam.ts`, `EmployeeFormDialog.tsx`)
  - Save handlers map comprehensive form fields (employment status, allowances, government IDs, emergency contacts) into API payloads, coalescing blanks to `null` to keep Prisma schema clean.
- **Deletion & CSV handling** (`useTeam.ts`)
  - Deletes call `/api/employees/{id}` then prune local state; import scaffolds minimal profiles from CSV headers, while export streams canonical roster details for bulk edits.
- **Detail page parity** (`useEmployeeDetail.ts`)
  - Single-employee view refetches `/api/employees/{id}`, reuses the same formatter utilities, and supports profile-photo uploads by sending base64 payloads back through the API.

### Appendix A · Shared Validation Infrastructure

- **`ValidationService.validateCustomer`** protects transactions globally by warning on missing, banned, or high-cancellation customers (≥50 % of historical orders cancelled).
- **Additional helpers** (`validateEmail`, `validatePhoneNumber`, `validateRequired`, `validateNumberRange`) provide reusable guardrails for forms across the suite.

---

## Part II · Czarlie & Ron Trucking

Modules for the trucking business are scaffolded (`src/app/trucking/**`) but do not yet ship dedicated business logic in `src/modules/trucking`. As those features are implemented—such as attendance, scheduling, and trip expenses—document their validation and automation rules here to keep the playbook complete.

---

## Part III · Living Document Roadmap

- Flesh out **Employees → Attendance & Schedules** once the modules graduate from legacy pages.
- Add **Trucking operations chapters** when fleet, dispatch, and financial components come online.
- Track changes by referencing commit hashes next to major rule updates for quick audits.

> _Next steps_: collaborate with feature owners to append new rules immediately after shipping functionality so this compendium remains a dependable source of truth.
