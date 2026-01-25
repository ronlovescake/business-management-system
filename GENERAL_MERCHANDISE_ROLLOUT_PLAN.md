# General Merchandise (GM) — Implementation Plan (Checklist)

> **Status:** In progress (partial implementation)
>
> **Goal:** Add **General Merchandise** as a fully separate business (like Trucking) with the same workspace model (Operations / Employees / Accounting), a clearly identifiable database footprint (`general_merchandise.*`), and an optional cross-business transfer feature.
>
> **Key constraint:** Businesses remain **isolated** by default. No cross-business data visibility, **except** shared customers between Clothing and GM (Phase 1 decision).

---

## Phase 1 Scope (Ship First)

Phase 1 is the “GM exists and is usable” milestone. Keep it boring and reliable.

**In scope (Phase 1):**

- [ ] GM selectable in UI alongside Clothing / Trucking / Personal
- [ ] GM route skeletons exist and load: `/general-merchandise/operations`, `/general-merchandise/employees`, `/general-merchandise/accounting`
- [x] GM reuses the same shared UI components as Clothing (tables, action bars, stats cards, modals) so look & feel is consistent
- [ ] GM access control mirrors the existing role model (USER/ADMIN/SUPER_ADMIN)
- [x] Database foundation exists: Postgres schema `general_merchandise` + minimum required GM tables
- [ ] GM Operations “Transactions” workflows work end-to-end (create invoice, record payments, create distributions) using GM-owned tables
- [x] Migrations run **non-destructively** (no drops/deletes, no prompts that could remove existing data)
- [ ] Hardcoded `/clothing/...` navigation issues addressed where they break GM (so GM doesn’t redirect into Clothing)
- [ ] Data isolation verified with smoke tests (GM data never appears in Clothing/Trucking and vice versa)

**Out of scope (defer to Phase 2+):**

- [ ] Cross-business transfers (“Business Draw”) automation
- [ ] Full parity of every Clothing module and report in GM (only implement what’s needed to run GM safely)
- [ ] Data import/migration from Clothing into GM (GM starts empty unless you explicitly decide otherwise)
- [ ] GM Operations Settings isolation (transactions settings + invoice settings)
- [ ] GM Operations Dashboard GM-scoped data

---

## 1) Decisions (locked in)

- [x] GM is a **separate business** (not an alias of Clothing).
- [x] GM is selectable alongside Clothing / Trucking / Personal.
- [x] GM uses the same workspace model: `operations`, `employees`, `accounting`.
- [x] GM database objects must be **easy to identify**.
- [x] Use a dedicated Postgres schema: `general_merchandise`.
- [x] Plan for cross-business transfers (implement later).
- [x] UI parity with Clothing is achieved by **reusing shared components** (no copy/paste pages solely for styling parity).
- [x] Customers are shared between Clothing + GM (shared API for `/operations/customers` and GM transactions dropdown).

---

## 2) Naming + Database Organization

### 2.1 Postgres schema naming

- [x] Schema name: `general_merchandise`
- [x] Table naming convention inside schema: lowercase `snake_case`

Examples:

- `general_merchandise.employees`
- `general_merchandise.employee_attendance`
- `general_merchandise.employee_loans`
- `general_merchandise.products`
- `general_merchandise.customers`
- `general_merchandise.transactions`
- `general_merchandise.shipments`
- `general_merchandise.ledger_entries`

### 2.2 “Everything GM-owned lives in GM schema”

Define the rule clearly:

- [ ] Create a written list of “GM-owned data” vs “global/shared data”.
- [ ] Confirm where **audit logs** live (global vs per-business schema).
- [ ] Confirm where **templates/settings** live (global vs per-business schema).

Suggested default:

- GM-owned: employees, customers, products, operational records, accounting/ledger records.
- Global/shared: auth/users/roles, maybe shared UI settings.

### 2.3 First-pass data inventory (GM-owned vs global/shared)

This is a **planning inventory** to lock scope and table ownership. It’s based on what already exists in Prisma today.

**GM-owned (lives in `general_merchandise.*`)**

Operations (Phase 1 minimum — explicitly required for “Transactions” workflows):

- customers (shared with Clothing in Phase 1; GM table exists but not used yet)
- additional_customer_info (if the UI/workflow expects it; otherwise Phase 1.5)
- products
- prices
- transactions
- transaction_payments ("record payments")
- invoices ("create invoice")
- sorting_distributions ("create distributions")

Operations (Phase 1.5 / later — needed for broader Operations parity):

- shipments
- shipping_fee_calculator_states
- inventory_movements
- dispatch_orders
- operations_notifications

Operations (Phase 1.5 / later — transaction lifecycle completeness):

- transaction_refunds
- transaction_status_changes

Operations (Phase 2+ / later — optional modules depending on GM needs):

- bundle_batches
- bundle_batch_components

Employees (Phase 1 minimum):

- employees

Employees (Phase 1.5 / later):

- attendance
- schedules
- payrolls
- leave_requests
- cash_advances
- cash_advance_deductions
- thirteenth_month_pay_records
- salary_history
- employee_automation_settings

Accounting (Phase 1 minimum):

- expenses (GM equivalent of Clothing `expenses` and Trucking `trucking_expenses`, but isolated)

Accounting (Phase 1.5 / later):

- accounting_opening_balance (GM equivalent of Clothing opening balance)
- accounting_journal_lines (GM equivalent of Clothing journal lines)
- recurring_payment_templates / recurring_payment_drafts (if GM needs recurring payments)
- inventory_reclass_entries / inventory_transit_build_entries (if GM needs these inventory/accounting automations)

**Global/shared (NOT in `general_merchandise.*`)**

Auth / permissions:

- users / roles (Prisma: `User`, `UserPermission`, `Module`, `PasswordResetToken`)

App platform / system-wide:

- audit_logs, change_log
- installed_modules, module_marketplace

Messaging & templates (system-wide unless we decide otherwise):

- conversations, conversation_participants, messages
- invoice_settings, transactions_settings
- message_templates, post_template_notice

**Legacy shared business data (exists today; not GM)**

Today, some Clothing/Trucking operational data appears to be in shared tables (example: `Customer` links to Trucking invoices/trips). GM should NOT write into these shared tables.

- Existing shared tables (examples): customers, products, prices, shipments, transactions, invoices, dispatch_orders, expenses
- Plan: GM uses **new tables in `general_merchandise` schema** even if names match, to keep isolation.

---

## 3) Data Isolation Model (separate per business)

### 3.1 Scope boundaries

GM has its own independent datasets:

- [ ] Employees + related HR subsystems (attendance, schedules, payroll, loans, leave tracker, etc.)
- [ ] Operations (products, customers, inventory, shipments, transactions, dispatch, templates, etc.)
- [ ] Accounting (expenses, journal, ledger, reports)

Shared across all businesses:

- [ ] Users/auth/session
- [ ] Roles/permissions
- [ ] Workspace selection state
- [x] Customers (shared between Clothing + GM in Phase 1)

### 3.2 Enforced isolation (acceptance criteria)

- [ ] GM records never appear in Clothing/Trucking views (except shared customers).
- [ ] Clothing/Trucking records never appear in GM views (except shared customers).
- [ ] API routes reject cross-business access even if a user can access multiple businesses.

---

## 4) Prisma + Migration Strategy (planning)

### 4.0 UI component strategy (locked)

We want Clothing and GM to have the **same UI look & feel** by reusing shared components.

- [x] Reuse shared components so GM and Clothing have identical styling for:
  - tables (including fixed headers)
  - action bars
  - stats cards
  - modals
- [ ] Add explicit UI acceptance criteria for “fixed headers / stable viewport / consistent spacing” (see Routing + Navigation section).

### 4.1 Prisma schema approach

Pick one implementation approach (plan now, implement later):

**Option A: Parallel Prisma models per business (fastest, consistent with split-business pattern)**

- [ ] Create GM models mapped to `general_merchandise.*` tables.
- [ ] Keep Clothing/Trucking models as-is (for now).

**Option B: Shared domain types + per-business repositories (less duplication long-term)**

- [ ] Create shared TS domain types (Employee/Product/etc.).
- [ ] Create adapters/repositories for each business schema.

Decision:

- [ ] Choose Option A or B.

### 4.2 Migration mechanics

- [ ] Add migration to create schema `general_merchandise`.
- [ ] Add migrations to create GM tables (employees/ops/accounting).
- [ ] Decide whether GM starts empty (recommended) or needs data import.
- [ ] Create required indexes/constraints per table.
- [ ] Use **safe, additive migrations only** (no destructive DDL; no prompts that ask to drop/delete existing tables).

**Acceptance criteria:** DB browser clearly shows `general_merchandise` schema with GM tables.

---

## 5) App Routing + Navigation

### 5.1 Routes

- [ ] Add top-level entry route: `/general-merchandise`
- [ ] Add workspace base routes:
  - [ ] `/general-merchandise/operations`
  - [ ] `/general-merchandise/employees`
  - [ ] `/general-merchandise/accounting`

- [ ] Add the major subroutes mirroring Clothing (exact list to be confirmed):
  - [ ] Operations pages: dashboard, transactions, customers, prices, products, inventory, sorting/distribution, shipments, dispatch, templates, invoicing, settings
  - [ ] Employees pages: dashboard, attendance, schedules, calendar, payroll, leave tracker, cash advance, loans, 13th month, team, settings
  - [ ] Accounting pages: expenses, journal, ledger, profit/loss, balance sheet

### 5.5 Clothing → GM parity checklist (do not miss workflows)

Goal: **Everything that exists under Clothing (Ops / Employees / Accounting) has a GM equivalent** with the _same workflow and UI_, but writes to GM-owned tables (`general_merchandise.*`) and never leaks across businesses.

This checklist is grounded in the current route structure under `src/app/clothing/*`.

**Operations parity (routes to mirror)**

- [x] `/clothing/operations/dashboard`
- [x] `/clothing/operations/transactions`
- [x] `/clothing/operations/products`
- [x] `/clothing/operations/prices`
- [x] `/clothing/operations/customers`
- [x] `/clothing/operations/inventory`
- [x] `/clothing/operations/shipments`
- [x] `/clothing/operations/sorting-distribution`
- [x] `/clothing/operations/dispatch`
- [x] `/clothing/operations/dispatching`
- [x] `/clothing/operations/checkout-links`
- [x] `/clothing/operations/due-dates`
- [x] `/clothing/operations/notifications`
- [x] `/clothing/operations/messaging`
- [x] `/clothing/operations/message-templates`
- [x] `/clothing/operations/post-template`
- [x] `/clothing/operations/business-intelligence`
- [x] `/clothing/operations/settings`

**Operations parity (workflows/actions to mirror)**

- [ ] Transactions: create invoice, record payments, refunds, status changes
- [ ] Transactions: **generate packing list** (currently uses `/api/generate-packing-list`)
- [ ] Products: full products workflow (create/edit/list/search + any import/export logic used today)
- [ ] Prices: manage prices (same rules/inputs)
- [ ] Customers: manage customers + additional info
- [ ] Inventory: movements + views (same buckets/logic as Clothing)
- [ ] Shipments: create/edit + status flows
- [ ] Sorting/Distribution: create/edit distributions + auto-calcs
- [ ] Dispatch/Dispatching: whatever Clothing uses here (confirm exact responsibilities per page)
- [ ] Messaging + templates + post-template: maintain same composition workflows

**Employees parity (routes to mirror)**

- [ ] `/clothing/employees/dashboard`
- [ ] `/clothing/employees/attendance`
- [ ] `/clothing/employees/schedules`
- [ ] `/clothing/employees/calendar`
- [ ] `/clothing/employees/payroll`
- [ ] `/clothing/employees/leave-tracker`
- [ ] `/clothing/employees/cash-advance`
- [ ] `/clothing/employees/employee-loans`
- [ ] `/clothing/employees/thirteenth-month-pay`
- [ ] `/clothing/employees/team`
- [ ] `/clothing/employees/notifications`
- [ ] `/clothing/employees/settings`

**Accounting parity (routes to mirror)**

- [ ] `/clothing/accounting/expenses`
- [ ] `/clothing/accounting/journal`
- [ ] `/clothing/accounting/ledger`
- [ ] `/clothing/accounting/profit-loss`
- [ ] `/clothing/accounting/balance-sheet`

**Also note (Clothing has an additional ledger area outside accounting)**

- [ ] `/clothing/ledger` (confirm what this is used for and whether GM needs an equivalent)

**API parity (workflows must have GM equivalents)**

- [ ] Packing list generation (currently `/api/generate-packing-list`, uses template `templates/packinglist.hbs`)
- [ ] Any invoice generation endpoints used by Clothing workflows (to be enumerated)
- [ ] Any distribution generation endpoints used by Clothing workflows (to be enumerated)

Acceptance criteria: for every Clothing route above there is either (a) a GM route with same behavior/UI, or (b) an explicit decision recorded here to defer it.

### 5.6 Clothing Operations deep parity matrix (code-backed, planning-only)

This section records **exact module entry points, UI behaviors (actions/modals/tabs), and API dependencies** for Clothing Operations routes so the GM equivalents can match behavior while writing to `general_merchandise.*`.

> Status note: The goal is completeness; anything not yet mapped stays explicitly “TODO” so it can’t be forgotten.

| Clothing route                               | Page entry                                                                           | Primary component/module                                                                                                 | Key UI behaviors (actions/modals/tabs)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | API dependencies                                                                                                                                                                                                                                                                                                                                                                                                             | Notes / GM implications                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/clothing/operations/transactions`          | `src/app/clothing/operations/transactions/page.tsx`                                  | `src/modules/clothing/operations/transactions/components/TransactionsPage.tsx`                                           | Handsontable grid with per-tab search. Tabs: **Main Transactions**, **Invoicing**, **Warehouse + Prepared**, **Packing List**, **Packed**, **Due Dates**, **Recently Updated**. Actions: **Generate Invoice** (SweetAlert workflow incl. Onhand / In Transit / Reservation 10% / Reservation 20%), **Generate Packing List** (SweetAlert workflow + eligibility rules + post-generation updates), **Generate Distribution**, **Record Payment** (bulk payments modal). Inline edits run finalized calculations (unit price/line total/status) + draft-row create-on-edit. Customer warning modal (banned/high-cancel customers). | `/api/transactions` (create/patch), `/api/transactions/[id]` (soft delete/restore), `/api/transactions/payments/bulk`, `/api/settings/transactions` (read-only flags), `/api/inventory/check-stock`, `/api/customers/with-shopee`, `/api/dispatch/orders`, `/api/generate-invoice`, `/api/generate-in-transit-invoice`, `/api/generate-packing-list`, `/api/generate-distribution`, change log query via `useChangeLogQuery` | GM Phase 1 depends on this route. This page is a high-risk workflow hub: GM must preserve invoice/packing list/distribution/payment semantics while ensuring every read/write is scoped to `general_merchandise.*` (and PDF templates remain identical). |
| `/clothing/operations/dispatch`              | `src/app/clothing/operations/dispatch/page.tsx`                                      | `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx`                                              | Tabs: **To Ship**, **Possible Match**, **Shipped**, **Recently Updated Orders**, **Raw Data**. SweetAlert2 confirmations for high-impact actions (customer linking / shipped updates). Import/replace semantics.                                                                                                                                                                                                                                                                                                                                                                                                                 | `/api/dispatch/orders` (GET/POST/DELETE)                                                                                                                                                                                                                                                                                                                                                                                     | GM needs its own dispatch persistence in `general_merchandise.dispatch_orders` (or equivalent) and must preserve import/replace + clear-all semantics.                                                                                                   |
| `/clothing/operations/dispatching`           | `src/app/clothing/operations/dispatching/page.tsx`                                   | `src/modules/clothing/operations/dispatching/components/DispatchingComponent.tsx`                                        | Currently a **simulation/mock** UI: Standard table controls; handlers show info alerts for Import/Export/Add/Edit/Delete (not wired to DB).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | None (as implemented)                                                                                                                                                                                                                                                                                                                                                                                                        | Risk: if you expect real dispatching features, this will need real API + tables when GM is implemented. For now, GM can mirror “mock page” parity if desired.                                                                                            |
| `/clothing/operations/checkout-links`        | `src/app/clothing/operations/checkout-links/page.tsx`                                | `src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx` + `hooks/useCheckoutLinksPage.ts` | Multi-tab orchestration: **Invoicing**, **Local Invoicing**, **Customer Orders**, **Item Weight**, **Checkout Links**. Modal editor: `CheckoutLinkEditorModal`. CSV import posting mapped payloads.                                                                                                                                                                                                                                                                                                                                                                                                                              | `/api/checkout-links` (GET/POST/PUT/DELETE soft delete)                                                                                                                                                                                                                                                                                                                                                                      | GM likely needs separate `general_merchandise.checkout_links` (or equivalent) and identical soft-delete behavior; keep payload mapping parity.                                                                                                           |
| `/clothing/operations/settings`              | `src/app/clothing/operations/settings/page.tsx` (via module)                         | `src/modules/clothing/operations/settings/components/SettingsPage.tsx`                                                   | Tabs include **Invoice Settings**, **Templates**, **Transactions**, **Change Log**. Invoice message editing is gated by SweetAlert2 “enable editing” confirmations; reset confirmations exist.                                                                                                                                                                                                                                                                                                                                                                                                                                   | `/api/invoice-settings` (GET/PUT), `/api/invoice-settings/reset` (POST), `/api/message-templates` (GET/PUT/POST)                                                                                                                                                                                                                                                                                                             | Decide whether settings/templates remain global/shared vs per-business. If per-business, GM needs business-scoped equivalents; if global, GM must still render same UI without leaking business-specific values.                                         |
| `/clothing/operations/post-template`         | `src/app/clothing/operations/post-template/page.tsx`                                 | `src/modules/clothing/operations/post-template/components/PostTemplateComponent.tsx`                                     | Loads products/prices + editable “notice”; uses notice save flow (PUT).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `/api/products`, `/api/prices`, `/api/post-template-notice` (GET/PUT)                                                                                                                                                                                                                                                                                                                                                        | Strong coupling to products/prices. For GM parity, products/prices endpoints must become GM-scoped (or GM-specific endpoints) to avoid cross-business leakage.                                                                                           |
| `/clothing/operations/prices`                | `src/app/clothing/operations/prices/page.tsx` (via module)                           | `src/modules/clothing/operations/prices/components/PricesPage.tsx` + `services/PriceService.ts`                          | Uses **glide-data-grid**; supports CSV import; **Add New Price** modal; **Edit Price** modal; search targeting (Ctrl+F-like flow).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `/api/prices` (GET/POST/PUT)                                                                                                                                                                                                                                                                                                                                                                                                 | POST has bulk import semantics and “CSV import mode” may clear existing prices; GM parity must preserve this behavior but only within GM schema.                                                                                                         |
| `/clothing/operations/messaging`             | `src/app/clothing/operations/messaging/page.tsx` + `MessagingClientPage.tsx`         | `src/services/messaging.service.ts`                                                                                      | Conversation list + message pane; **New Message** modal; send message; mark-as-read flow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `/api/conversations`, `/api/conversations/[id]/messages`, `/api/conversations/[id]/read`                                                                                                                                                                                                                                                                                                                                     | Likely global/shared messaging tables; decide whether GM has separate conversations or shares. If shared, ensure business context is represented (tagging/filtering) to prevent cross-business confusion.                                                |
| `/clothing/operations/notifications`         | `src/app/clothing/operations/notifications/page.tsx` + `NotificationsClientPage.tsx` | `src/modules/clothing/operations/notifications/services/OperationsNotificationsService.ts`                               | Tabs/categories: transactions/products/prices/shipments/general; grouping + status/filters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `/api/operations/notifications`                                                                                                                                                                                                                                                                                                                                                                                              | GM should have business-scoped notifications (recommended: `general_merchandise.operations_notifications`) or a shared table with strict business scoping.                                                                                               |
| `/clothing/operations/business-intelligence` | `src/app/clothing/operations/business-intelligence/page.tsx`                         | `src/app/clothing/operations/business-intelligence/components/BiDashboard.tsx` + `hooks/useBusinessIntelligence.ts`      | KPI cards + charts + tables (Recharts). Data computed from queries (YTD/MTD, monthly trends, top customers/products, shipment metrics).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | `/api/transactions`, `/api/products`, `/api/shipments`                                                                                                                                                                                                                                                                                                                                                                       | BI is an integration point across multiple datasets; GM parity requires GM-scoped equivalents of those APIs or explicit business scoping in shared endpoints.                                                                                            |

**Related implementation docs discovered (useful for GM parity planning):**

- `docs/implementations/DISPATCH_DATABASE_PERSISTENCE.md`
- `docs/implementations/DISPATCH_CUSTOMER_LOOKUP.md`

**Remaining deep-mapping TODO (Operations):**

- [ ] `/clothing/operations/products` (include: imports/exports, Handsontable/grids, bulk-edit flows)
- [ ] `/clothing/operations/customers` (include: additional info, linking/merge, any import/export)
- [ ] `/clothing/operations/inventory` (include: movements, stock buckets, any adjustment modals)
- [ ] `/clothing/operations/shipments` (include: create/edit/status flows)
- [ ] `/clothing/operations/sorting-distribution` (include: create/edit, auto-calcs)
- [ ] `/clothing/operations/due-dates` (confirm page behaviors + API)
- [ ] `/clothing/operations/message-templates` (confirm how it differs from settings/templates)

### 5.7 Clothing Employees deep parity matrix (code-backed, planning-only)

| Clothing route                             | Page entry                                                 | Primary hook/component                                   | Key UI behaviors (actions/modals/tabs)                                                                                                                                                                                                                                                       | API dependencies                                                                                                                                                             | Notes / GM implications                                                                                                                                    |
| ------------------------------------------ | ---------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/clothing/employees/dashboard`            | `src/app/clothing/employees/dashboard/page.tsx`            | `useEmployeeDashboard`                                   | Dashboard with **Daily/Monthly/Yearly** view modes (date/month/year pickers), KPI cards + charts (attendance statuses, expenses categories, payroll vs expenses vs cash advance vs 13th month, team/department counts, loan/leave statuses, etc.).                                           | `/api/clothing/employees/dashboard`                                                                                                                                          | Recommend a GM-scoped dashboard endpoint (or shared endpoint with strict business scoping) to prevent cross-business rollups.                              |
| `/clothing/employees/attendance`           | `src/app/clothing/employees/attendance/page.tsx`           | `useAttendance` + `AttendanceFormDialog`                 | DataTable with search + status filter + KPI cards. Actions: **Mark Present/Late/Absent**, **Delete**, Add/Edit modal. CSV import/export. Tracks breaks (break1/lunch/break2) + total hours.                                                                                                  | `/api/attendance` (+ `/api/schedules`, `/api/leave-requests` used during some workflows/import)                                                                              | GM needs its own attendance persistence (schema-scoped). Confirm whether “stay-in auto presence” affects this dataset (see settings).                      |
| `/clothing/employees/schedules`            | `src/app/clothing/employees/schedules/page.tsx`            | `useSchedules`                                           | Tabs: **list** vs **calendar**. CRUD + status actions (**Mark Completed/Cancelled**). CSV import/export. Includes recurring/bulk scheduling rules. Calendar view exists (not empty) and supports bulk actions UI.                                                                            | `/api/schedules`, `/api/employees?status=active`, `/api/leave-requests`                                                                                                      | GM needs schedules + recurring rule storage decisions (table(s) in `general_merchandise`).                                                                 |
| `/clothing/employees/leave-tracker`        | `src/app/clothing/employees/leave-tracker/page.tsx`        | `useLeaveTracker` + `LeaveFormDialog`                    | Tabs: **list**, **analytics**, **calendar**. CRUD (add/edit/delete), **Approve/Reject**, CSV import/export. Can apply approved leave to attendance via “apply leave” workflow.                                                                                                               | `/api/leave-requests` (GET/POST/PATCH/DELETE), `/api/attendance/apply-leave`, plus schedule/employee lookups (`/api/schedules`, `/api/employees`)                            | GM needs leave allocations + enforcement rules to match (calendar highlighting depends on schedules).                                                      |
| `/clothing/employees/payroll`              | `src/app/clothing/employees/payroll/page.tsx`              | `usePayroll` + `PayrollFormDialog`                       | DataTable with search/status/pay-period filters. Actions: **Add/Manual Payroll**, **Generate Payroll (bulk)**, **Generate Payslips**, **Approve**, **Approve All**, **Mark as Paid**, **Mark All as Paid**, Edit/Delete. CSV import/export. Includes “sync LWOP” and cleanup/retry behavior. | `/api/payroll`, `/api/payroll/generate`, `/api/payroll/generate-payslips`, `/api/payroll/sync-lwop`, `/api/payroll/cleanup`, `/api/employees`, `/api/thirteenth-month-pay/*` | GM payroll is a large subsystem; plan Phase 1/1.5 explicitly. If deferred, document “GM payroll is not available yet” rather than shipping a partial page. |
| `/clothing/employees/cash-advance`         | `src/app/clothing/employees/cash-advance/page.tsx`         | `useCashAdvance` + `RequestFormDialog`                   | DataTable with KPI cards + filters. Actions: **Approve/Reject/Edit/Delete** (delete disabled if settled>0). CSV import/export. Computes settled/remaining balance display.                                                                                                                   | `/api/cash-advances`, `/api/employees`                                                                                                                                       | GM needs cash advance + deduction integration with payroll (if payroll exists).                                                                            |
| `/clothing/employees/employee-loans`       | `src/app/clothing/employees/employee-loans/page.tsx`       | `useEmployeeLoans`                                       | UI looks real (stats + actions), but current implementation is **local-only state** (no DB/API). Actions: approve/reject/activate/mark completed/edit/delete; CSV export.                                                                                                                    | None (as implemented)                                                                                                                                                        | Important parity note: GM can mirror “mock” parity, or you can decide to implement real loans later (recommended if loans matter).                         |
| `/clothing/employees/thirteenth-month-pay` | `src/app/clothing/employees/thirteenth-month-pay/page.tsx` | `useThirteenthMonthPay` + `ThirteenthMonthPayFormDialog` | DataTable with filters (status + year) and actions: **Approve**, **Mark as Paid**, add/edit via dialog, CSV import/export.                                                                                                                                                                   | `/api/thirteenth-month-pay`, `/api/thirteenth-month-pay/[id]/status`, plus data sources (`/api/employees?status=active`, `/api/payroll`)                                     | GM needs cross-link rules between payroll and 13th month calculations (ensure schema-scoped).                                                              |
| `/clothing/employees/team`                 | `src/app/clothing/employees/team/page.tsx`                 | `useTeam` + `EmployeeFormDialog`                         | Employee master list with KPI cards + filters. Double-click row navigates to detail page. CRUD, CSV import/export.                                                                                                                                                                           | `/api/employees` (GET/POST/PUT/DELETE)                                                                                                                                       | GM needs a full employees table in `general_merchandise.employees` (or equivalent) and a GM-scoped `/api/employees` strategy.                              |
| `/clothing/employees/team/[id]`            | `src/app/clothing/employees/team/[id]/page.tsx`            | `useEmployeeDetail` + shared `DetailsPageTemplate`       | Employee detail with header + tabs: Profile Overview, Payroll History, 13th Month, Schedules, Attendance, Leave Requests, Cash Advance, Statutory Details. Supports profile photo upload (base64), salary timeline, edit modal.                                                              | `/api/employees/[id]` + related datasets (payroll, attendance, schedules, leave, cash advances, 13th month, salary history, etc.)                                            | GM must ensure the detail page pulls only GM-owned related records; cross-business joins here would be very visible.                                       |
| `/clothing/employees/settings`             | `src/app/clothing/employees/settings/page.tsx`             | inline settings form                                     | Employee automation settings for “stay-in auto presence” (enable + time + timezone + grace minutes). Has save/reset + test/run UX.                                                                                                                                                           | `/api/employee-automation-settings`                                                                                                                                          | Decide whether settings are global or per-business; for GM isolation, per-business settings are safer.                                                     |
| `/clothing/employees/calendar`             | `src/app/clothing/employees/calendar/page.tsx`             | shell                                                    | Empty shell page.                                                                                                                                                                                                                                                                            | None (as implemented)                                                                                                                                                        | Parity note: this exists but has no functionality; GM can mirror as shell if desired.                                                                      |
| `/clothing/employees/notifications`        | `src/app/clothing/employees/notifications/page.tsx`        | shell                                                    | Empty shell page.                                                                                                                                                                                                                                                                            | None (as implemented)                                                                                                                                                        | Parity note: this exists but has no functionality; GM can mirror as shell if desired.                                                                      |
| `/clothing/employees/expenses`             | `src/app/clothing/employees/expenses/page.tsx`             | redirect                                                 | Redirects to `/clothing/accounting` (which redirects to expenses).                                                                                                                                                                                                                           | N/A                                                                                                                                                                          | For GM, make sure any equivalent link redirects to GM accounting, not Clothing.                                                                            |

**Remaining deep-mapping TODO (Employees):**

- [ ] Confirm whether any employee pages are also referenced from Operations (cross-navigation) and must preserve deep links in GM.
- [ ] Confirm which employees subsystems are Phase 1 vs Phase 1.5 (attendance/schedules/payroll/leave/cash advance/13th month) based on GM needs.

### 5.8 Clothing Accounting deep parity matrix (code-backed, planning-only)

| Clothing route                       | Page entry                                           | Primary hook/component                   | Key UI behaviors (actions/modals/tabs)                                                                                                                                                                                                                                      | API dependencies                                                                                                                                           | Notes / GM implications                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/clothing/accounting`               | `src/app/clothing/accounting/page.tsx`               | redirect                                 | Redirects to `/clothing/accounting/expenses`.                                                                                                                                                                                                                               | N/A                                                                                                                                                        | GM root should redirect to GM expenses page (avoid hardcoded Clothing paths).                                                            |
| `/clothing/accounting/expenses`      | `src/app/clothing/accounting/expenses/page.tsx`      | `useExpenses` + component suite          | KPI cards + tabbed controls (list/analytics), search + category/status/source filters. CRUD add/edit modal, approve/reject, receipt viewer modal. CSV import/export + template download. Explicitly filters out non-operational costs (e.g. PRODUCT/SHIPMENT source types). | Expenses data hook uses sheet data (`useExpenseData` / backing API) and accounting utilities; operational expense categories use `expenseCategoryOptions`. | GM must decide whether expenses are GM-owned (recommended) and keep the operational vs COGS split consistent (COGS in ledger, not here). |
| `/clothing/accounting/journal`       | `src/app/clothing/accounting/journal/page.tsx`       | `useJournal` + `ManualJournalEntryModal` | Journal listing with filters + period selector. CSV import/export + template download. Manual journal entries via modal (add/edit/delete).                                                                                                                                  | `/api/accounting/journal`, `/api/accounting/manual-journal`                                                                                                | Manual journal needs GM-scoped persistence and consistent account list semantics.                                                        |
| `/clothing/accounting/ledger`        | `src/app/clothing/accounting/ledger/page.tsx`        | `useLedger` + panels                     | Tabbed: main ledger vs **Opening Balance** vs **Recurring Payments** vs **Help**. Period/account filters. Manual journal modal (shared). Opening balance CRUD modal. Recurring payments panel can mutate ledger and triggers refresh.                                       | `/api/accounting/ledger`, `/api/accounting/opening-balance`, `/api/accounting/manual-journal` (+ recurring payments endpoints used by panel)               | Ledger is the accounting system-of-record. GM should never write into Clothing ledger tables; create schema-scoped ledger equivalents.   |
| `/clothing/accounting/profit-loss`   | `src/app/clothing/accounting/profit-loss/page.tsx`   | `useProfitLoss`                          | Tabs: summary vs **details**. Period selector + search. Exports: summary CSV + details CSV + template download.                                                                                                                                                             | `/api/accounting/profit-loss`, `/api/accounting/profit-loss/details`                                                                                       | GM P&L depends on ledger classification rules; ensure the same account categorization works in GM schema.                                |
| `/clothing/accounting/balance-sheet` | `src/app/clothing/accounting/balance-sheet/page.tsx` | `useBalanceSheet`                        | “As of” date selector + search + export CSV + template download. Table of assets/liabilities/equity rows + stats cards for totals/balance.                                                                                                                                  | `/api/accounting/balance-sheet`                                                                                                                            | GM needs independent statement generation (schema-scoped) and the same formatting/row group rules.                                       |

**Remaining deep-mapping TODO (Accounting):**

- [ ] Enumerate recurring payments endpoints used by `RecurringPaymentsPanel` and decide if GM needs it in Phase 1.5.
- [ ] Confirm whether `/clothing/ledger` (outside accounting) needs a GM equivalent or can be consolidated under GM accounting/ledger.

### 5.2 Business selector + sidebar

- [ ] Add `general-merchandise` as a selectable business in the business selector.
- [ ] Ensure the workspace selector works with GM.
- [ ] Ensure sidebar navigation items render for GM + chosen workspace.

### 5.3 Remove hardcoded business paths (required for cleanliness)

There are currently hardcoded paths like `/clothing/...` in some shared areas.

- [ ] Create a single path-builder utility for `/{business}/{workspace}/...`
- [ ] Replace hardcoded `/clothing/...` routes in shared UI where appropriate

**Acceptance criteria:** When using GM, navigation never forces you into Clothing URLs.

### 5.4 UI consistency acceptance criteria (required)

The goal is that the GM equivalents of Clothing pages (e.g. transactions → create invoice / record payment / create distribution) are visually identical by reusing the same shared components.

- [ ] Tables: table header stays fixed (does not scroll with the data body).
- [ ] Layout: page viewport height/scroll behavior matches Clothing (no unexpected double-scroll or container height drift).
- [ ] Stats cards: same sizes, spacing, typography, and responsive behavior as Clothing.
- [ ] Action bars: same layout and button sizing as Clothing.
- [ ] Modals: reuse the current modal component so sizing/spacing/close behavior matches Clothing.

---

## 6) Middleware / Access Control

- [ ] Add GM route protections mirroring the business/workspace rules used for Clothing/Trucking.
- [ ] Ensure role rules match expectations:
  - [ ] USER: operations only
  - [ ] ADMIN: operations + employees + accounting (confirm)
  - [ ] SUPER_ADMIN: everything

**Acceptance criteria:** GM pages enforce same access rules as the other businesses.

---

## 7) API Layer + Service Design

### 7.1 API URL scheme

- [ ] Confirm API path strategy:
  - [ ] `/api/general-merchandise/...` (recommended for symmetry with existing patterns)
  - [ ] or shared `/api/...` with business inferred from route/session

### 7.2 Query scoping

- [ ] For GM routes, all DB queries must read/write only `general_merchandise.*` tables.
- [ ] Ensure no accidental cross-schema joins without explicit reason.

---

## 8) Cross-Business Transfer (Phase 2)

> Objective: Avoid manual double-entry while keeping business ledgers isolated.
>
> The correct approach is **one transfer action** that writes **two linked ledger postings** (one in each business).

### 8.1 Feature scope

- [ ] Add a new concept: `intercompany_transfer` (naming TBD).
- [ ] Transfer form inputs:
  - [ ] fromBusiness
  - [ ] fromAccount
  - [ ] toBusiness
  - [ ] toAccount
  - [ ] amount
  - [ ] date
  - [ ] memo

### 8.2 Data model

- [ ] Define where transfer records live:
  - [ ] Global schema (recommended) so it can reference both businesses
  - [ ] OR separate schema + cross-schema refs (more complex)

- [ ] Each transfer generates:
  - [ ] One ledger entry in “from” business ledger tables
  - [ ] One ledger entry in “to” business ledger tables
  - [ ] Both linked by a `transfer_id`

### 8.3 Guardrails

- [ ] Only allowed roles can create transfers (ADMIN/SUPER_ADMIN).
- [ ] Enforce that user has access to both businesses.
- [ ] Add reversal support (void/reverse transfer) to keep auditability.

### 8.4 Optional fallback

- [ ] If transfers add too much risk initially, defer to manual entries (Phase 2 can be postponed).

---

## 9) QA / Validation / Rollout

- [ ] Typecheck (project-wide)
- [ ] Smoke test GM route entry:
  - [ ] GM operations page loads
  - [ ] GM employees page loads
  - [ ] GM accounting page loads

- [ ] Data isolation smoke tests:
  - [ ] Create GM product/customer and confirm not visible in Clothing
  - [ ] Create Clothing product/customer and confirm not visible in GM

- [ ] Access control smoke tests:
  - [ ] USER cannot access GM employees/accounting
  - [ ] ADMIN can access GM employees/accounting

- [ ] (Phase 2) Transfer tests:
  - [ ] Transfer creates two linked ledger postings
  - [ ] Reversal works
  - [ ] Permissions enforced

---

## 10) Open Questions (answer as we go)

- [ ] Do we also want separate schemas for Clothing/Trucking long-term (consistency), or only GM for now?
- [ ] Which Prisma strategy: parallel models (A) vs repository abstraction (B)?
- [ ] Which GM modules must ship in Phase 1 vs Phase 1.5?
- [ ] Should transfer support “personal” business or only business-to-business?
