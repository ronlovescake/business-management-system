# Repo-Wide Analysis — Business Management System

**Stack:** Next.js 14 (App Router) · TypeScript (strict) · Prisma 5 + PostgreSQL (multi-schema) · React Query v5 · Mantine 7 · Zustand · Vitest · Playwright · Zod · Sentry · Docker

**Verification note (2026-03-29):** This report has been rechecked against the current repository. Earlier stale or overstated claims have been corrected below. Where clone ratios are cited, they are explicitly sourced from `CHECKLIST.md` rather than presented as freshly recomputed metrics.

---

## Pass 1 — Full Stack & Directory Map

### Runtime / Infra

- **Next.js 14** App Router, Node.js runtime, deployed via Docker (docker-compose.yml + Dockerfile).
- **Timezone** locked to `Asia/Manila` in next.config.js.
- **Database:** PostgreSQL with two schemas: public (clothing, trucking, employees, shared) and `general_merchandise` (GM-specific tables). Prisma `multiSchema` preview feature enabled.
- `env.ts` centrally validates core DB/auth/app/email/Sentry variables via Zod (`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SMTP_*`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`). Google Drive variables, `BACKUP_DIR`, and `BYPASS_AUTH_FOR_TESTS` are used elsewhere in the repo but are not validated through that central schema.
- **Connection pool** configured via Prisma with development/production tuning guidance inline in db.ts. Slow query detection at >100ms threshold.
- **Prisma middleware** adds soft-delete and audit-log hooks via middleware.

### Auth & Permissions (3-tier)

- **NextAuth v4** credentials provider (email + bcryptjs password). JWT strategy, role injected into token.
- Roles: `USER`, `ADMIN`, `SUPER_ADMIN`.
- **Route-level middleware** (middleware.ts) enforces role checks on all front-end paths before page render.
- **Module-level permissions** (permissions.ts) check `UserPermission` + `Module` tables for granular per-user, per-module access — applied to `USER` role only; `ADMIN/SUPER_ADMIN` bypass.
- **Password reset** tokens with hash, expiry, IP, user-agent stored in `password_reset_tokens`.
- `BYPASS_AUTH_FOR_TESTS` is honored in middleware and module-permission helpers for test flows; it is not a universal bypass inside every auth helper.

### Business Domains

Four fully separate business domains, each with its own API namespace, Prisma models, and UI routes:

| Domain                       | App Route               | API Namespace                      | Notes                                          |
| ---------------------------- | ----------------------- | ---------------------------------- | ---------------------------------------------- |
| **Clothing**                 | `/clothing/`            | `/api/clothing/`, `/api/` (shared) | Primary/largest domain                         |
| **General Merchandise (GM)** | `/general-merchandise/` | `/api/general-merchandise/`        | Separate `general_merchandise` Postgres schema |
| **Trucking**                 | `/trucking/`            | `/api/trucking/`                   | Fleet + trip management                        |
| **Personal / Household**     | `/personal/`            | `/api/household/`                  | Personal finance tracker                       |

---

## Pass 2 — Module-by-Module Logic Map

### Clothing Domain

**Operations** (operations, operations):

- **Transactions** — Full CRUD through the shared transactions API layer (`src/modules/transactions/api/service.ts` ~622 lines plus `routeFactory.ts` ~169 lines; GM has its own ~671-line service). Handles order status lifecycle, line totals, refunds, payments, inventory movement sync, and audit log. `transactionInventorySync.ts` auto-creates `InventoryMovement` records when status changes.
- **Products** — Shipment-linked product records with full costing fields: `unitPrice`, `alibabaShippingCost`, `exchangeRates`, `landedUnitCost`, `cogs`, `projectedProfit`.
- **Prices** — Range-based pricing (lower/upper quantity limits map to a `currentPrice`). Per-business copies (public vs. general_merchandise schemas).
- **Shipments** — Track import shipments through status lifecycle (`in-transit`, `delivered`, etc.). Trigger inventory reclassification journal entries on status change.
- **Customers** — Full CRM with `AdditionalCustomerInfo` (flexible key-value). Separate GM model in `general_merchandise` schema.
- **Inventory** — Bucket-based system: `sellable`, `reserved`, `damaged_hold`, `assembly_wip`. `InventoryMovement` ledger records every transition. `/api/inventory/check-stock` and `/api/inventory/movements` endpoints. Inventory drift detection via `npm run inventory:ledger:drift`.
- **Dispatch** — Shopee `DispatchOrder` import + linking to customers.
- **Sorting/Distribution** — Per product-code row-based distribution percentages.
- **Checkout Links** — Weight/dimension → checkout link mapping for Shopee.
- **Mix & Match** — Bundle batch system with components (`BundleBatch`, `BundleBatchComponent`).
- **Bundles** — `BundleBatch` + `BundleBatchComponent` for GM similarly.
- **Dashboard / Business Intelligence** — Aggregated views.
- **Messaging** — In-app `Conversation` + `Message` system. `OperationsNotification` for system events. Email via Nodemailer (mailer.ts).
- **Invoice Generation** — PDF via `pdf-lib`, templates from templates. Packing lists, in-transit invoices.
- **Checkout Links, Post Template, Message Templates** — Content management for customer communication.

**Accounting / Ledger** (accounting, accounting):

- **Balance Sheet** — Classifies accounts (Asset/Liability/Equity) via fuzzy keyword matching in account-classification.ts. Aggregates journal lines, opening balances, inventory COGS, and recurring payments.
- **Journal** — Double-entry journal. Lines sourced from: manual entries, system-generated transaction/payroll/expense sync, COGS reclassification, transit build entries. Source types tracked on each line (`sourceType`, `sourceId`, `sourceLineKey`) with unique constraint for idempotency.
- **Ledger** — Account-level running balance view.
- **P&L (Profit & Loss)** — Revenue (transactions) vs. COGS (inventory) vs. expenses.
- **Opening Balance** — `ClothingAccountingOpeningBalance` table for cutover entries.
- **COGS Engine** — inventory-cogs.ts (~741 lines) computes cost of goods sold from `InventoryMovement` records and `Product` cost fields. Cutover date aware.
- **Recurring Payments** — Template + draft system. Templates generate drafts on schedule. Approve/skip workflow.
- **Manual Journal** — User-entered journal entries.
- **Transit Build** — `ClothingInventoryTransitBuildEntry` records the landed cost build-up for in-transit shipments.
- **CSV Import** — Import accounting data from spreadsheets.

Both Clothing and GM share the same accounting API structure but are served by separate accounting routes under `/api/accounting/` (clothing) and `/api/general-merchandise/accounting/` (GM). The COGS engine has a full separate copy for GM in `inventory-cogs.ts` (~1178 lines) — `CHECKLIST.md` reports that pair as a 60% clone/divergence hotspot.

**Employees** (employees, employees):

- **Team** — `Employee` model. Full profile, statutory numbers (SSS, PhilHealth, HDMF, TIN), salary history, final pay.
- **Attendance** — Time-in/time-out with breaks, lunch. Status: `present`, `absent`, `late`, `half-day`. Soft-deleted.
- **Schedules** — Shift planning (shiftType, start/end, breaks). Template + recurrence IDs.
- **Payroll** — Core model fields: basic salary, overtime, bonuses, all deductions (SSS, PhilHealth, PagIbig, tax, LWOP, loans, cash advance, 13th month), net pay, status (`pending` → `approved` → `paid`).
- **Deductions Engine** — `deductions.ts` is currently ~848 lines in the clothing implementation. It computes statutory contributions, attendance-based deductions, cash advance repayment, and LWOP. Shared orchestration helpers are extracted to `deductionsShared.ts`. `CHECKLIST.md` still reports the cross-business copies as 90-94% similar, so the duplication risk remains even though some checklist line counts are stale.
- **Cash Advances** — `CashAdvanceRecord` with repayment schedules (`CashAdvanceDeduction`), cycle management, balance tracking.
- **Leave Requests** — `LeaveRequest` with approval workflow and `paymentStatus` for LWOP payroll sync.
- **13th Month Pay** — `ThirteenthMonthPayRecord`. Computed from full-year basic salary minus LWOP/absences, divided by 12.
- **Employee Loans** — Tracked as part of the deduction structure.
- **Employee Automation** — `EmployeeAutomationSetting` for auto-presence feature (scheduled auto-clock-in via `stayInAutoPresence`).

**Clothing-specific settings:**

- settings — Backup/restore tab split into `BackupSection`, `RestoreSection`, `TablePreviewSection`.
- `AccountingSettings` model stores the clothing cutover date.
- `TransactionsSettings` model controls spreadsheet read-only columns.

### General Merchandise Domain

Mirrors Clothing almost exactly:

- Own Postgres schema (`general_merchandise`) for operations, employees, payroll, accounting, and related GM tables.
- GM employee/HR data is modeled separately in that schema as `GeneralMerchandiseEmployee`, `GeneralMerchandiseLeaveRequest`, `GeneralMerchandisePayroll`, and related tables.
- GM accounting routes under `/api/general-merchandise/accounting/` are separate copies of the clothing accounting routes.

### Trucking Domain

**Operations:**

- **Fleet Registry** — `TruckingFleetRegistry` with full vehicle details (plate, chassis, engine, LTO, GPS, insurance, ownership, acquisition cost).
- **Vehicle Assignments** — `TruckingVehicleAssignment` links driver/helper to vehicle for a date range.
- **Trips** — `TruckingTrip` records each trip: date, truck, driver, helper, gross revenue, fuel, maintenance, misc expenses. Linked to customer and invoice. Status: `draft` → `completed`.
- **Invoices** — `TruckingInvoice` aggregates trips per customer per cutoff period. Status: `DRAFT` → `SENT` → `PAID`.
- **Payments** — `TruckingPayment` with `TruckingPaymentAllocation` for partial payment across invoices.
- **Analytics / Profitability** — Route at `/api/trucking/analytics/profitability/`.

**Employees:** Separate mirror of Clothing employees with `TruckingEmployee`, `TruckingAttendance`, `TruckingSchedule`, `TruckingPayroll`, `TruckingLeaveRequest`, `TruckingCashAdvanceRecord`, `TruckingThirteenthMonthPayRecord`, `TruckingSalaryHistory`. All delegate to shared hooks/logic where possible (thin wrapper pattern).

### Household / Personal Finance Domain

- **Accounts** — `HouseholdAccount` (checking, savings, cards, etc.)
- **Expenses** — `HouseholdExpense` linked to accounts. Source tracking.
- **Income** — `HouseholdIncome` (salary, freelance, etc.)
- **Budgets** — `HouseholdBudget` with monthly/annual targets vs. actuals.
- **Recurring Payments** — `HouseholdRecurringPayment` for subscriptions/loans.

### Cross-Cutting Shared Infrastructure

| Layer        | What lives here                                                                                                                                                                    |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shared       | Shared employee sub-modules (leave, cash-advance, 13th month), shared ledger adapters (payroll route adapter, manual journal, recurring payments, expenses), user management panel |
| accounting   | Account classification, COGS engine (clothing), data-fetchers (clothing), journal utilities, CSV import, cutover logic                                                             |
| payroll      | Deductions engine (clothing), `deductionsShared.ts`, deduction adjustments, payroll generation/paid actions, cash advance scheduler                                                |
| inventory    | Movement logic, receipt adjustments, shipment status, mix-and-match tagging                                                                                                        |
| security     | sanitize.ts (XSS/injection prevention), `validate.ts`, `client-sanitize.ts`                                                                                                        |
| validations  | Zod schemas for all entity inputs                                                                                                                                                  |
| transactions | Order status helpers, normalizers, filters, formatters                                                                                                                             |
| api          | API client, path builder, response normalizer                                                                                                                                      |
| queryKeys.ts | Centralized React Query key registry                                                                                                                                               |
| routes.ts    | Business/workspace segment resolvers                                                                                                                                               |
| automation   | `stayInAutoPresence` (auto clock-in) for Clothing and GM                                                                                                                           |
| core         | ModuleRegistry, ModuleLoader, PluginManager, EventBus, database middleware (soft-delete + audit log), BaseRepository                                                               |
| services     | Service layer: CustomerService, TransactionService, PayrollService, ExpenseService, ShipmentService, etc.                                                                          |
| spec.ts      | OpenAPI 3 spec (~1208 lines), auto-generated API docs at `/api/docs`                                                                                                               |

### Module / Plugin System

A full dynamic module system (ModuleRegistry.ts) allows: registering module configs, installing/uninstalling modules (persisted in `InstalledModule`), marketplace discovery (`ModuleMarketplace`), sandbox loading, HMR, and plugin management. API routes under `/api/modules/` for install/uninstall/reload/config/performance.

### Backup / Restore System

- `/api/backup` — Exports all tables to per-timestamp folders (JSON, CSV, XLSX) with checksums. Supports `pg_dump` native backup option. Strict mode validates all required tables are present.
- `/api/restore` — Reads backup manifest, previews table contents, restores rows in dependency order (`restoreModelMap.ts`, `restore-order.ts`). Atomic write via `writeFileAtomic`.

### Security Measures

- HTTP security headers (HSTS, X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, CSP) in next.config.js.
- `isomorphic-dompurify` for HTML sanitization.
- `bcryptjs` for password hashing.
- Input sanitization via `sanitizeString()` for all user text.
- SQL injection: Prisma ORM parameterizes all queries — no raw SQL (except optional `pg_dump` subprocess launch).
- SSRF: No user-controllable URL fetching observed (Google Drive API uses OAuth, no proxy endpoints).
- Audit log on all write operations via Prisma middleware.
- `ChangeLog` table tracks field-level changes with actor, before/after values.

---

## Pass 3 — Tests, Types & Gaps

### Test Architecture

**Unit tests** (Vitest + jsdom): unit

- There are 120 current unit test files, including broad API route coverage for Clothing, GM, and Trucking.
- Business logic tests: attendance, payroll, leave, cash-advance, schedules, team.
- Library tests: accounting COGS, deductions, transactions, prices, products, inventory, validations.

**Integration tests** (Vitest + real DB, sequential workers, `forks` pool):

- `health.integration.test.ts`, `transaction-data-integrity.integration.test.ts`, `household-finance.integration.test.ts`.
- Only 3 files — the integration layer is thin relative to the unit layer.

**Hardening tests** (Vitest):

- `backup-restore.atomic.test.ts`, `.integrity.test.ts`, `.security.test.ts`, `.workflow.test.ts` — focused on backup/restore correctness and security.

**E2E tests** (Playwright, port 3100):

- Smoke: clothing operations, GM, employees, household, accounting, trucking trips.
- Interaction: Handsontable grid, transactions, invoices, customers.
- Config defines Chromium, Firefox, and WebKit projects. Local runs are pinned to 1 worker for DB stability, keep a 30s test timeout, store auth state under `tests/e2e/.auth/`, and default `BYPASS_AUTH_FOR_TESTS` to `true` in the Playwright web-server env.

### Type System

- api.ts — `AsyncData<T>`, `FormState<T>`, `ApiResponse<T>`, `PaginatedResponse<T>`, `ApiErrorResponse`, `BatchOperationResponse`.
- branded.ts — Branded types for IDs.
- prisma.ts — Prisma type re-exports.
- `next-auth.d.ts` — Augments NextAuth session to include `role`, `id`, `photoUrl`.
- module-system.ts — Plugin system types.

### Known Gaps (from CHECKLIST.md, current state)

| Area                      | Gap                                                                                                                                                                      | Severity  |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| Trucking Operations       | `analytics/profitability`, `payments`, and `employee-automation-settings` appear uncovered by current unit tests; `employees/[id]` does have route tests now             | P1        |
| Trucking                  | No integration tests, no hardening tests, and only limited E2E depth beyond the trucking trips flow                                                                      | P1        |
| Trucking Docs             | No `docs/business-logic/trucking/` baseline docs                                                                                                                         | P1        |
| Clothing Accounting       | Route-family test parity is uneven (ledger, journal routes less covered)                                                                                                 | P2        |
| GM Accounting             | Same parity gaps as Clothing accounting                                                                                                                                  | P2        |
| COGS divergence           | `CHECKLIST.md` reports GM `inventory-cogs.ts` as a 60% clone/divergence hotspot versus Clothing; the files are still materially different in size and remain unextracted | Open risk |
| Balance sheet routes      | `CHECKLIST.md` reports Clothing and GM balance-sheet routes as 86% clone copies, indicating a remaining consolidation target                                             | Open risk |
| deductions.ts             | `CHECKLIST.md` reports 90-94% similarity across the 3 business copies; shared utils exist, but the full engine is still not consolidated                                 | Open risk |
| Integration depth         | Only 3 integration test files for the whole repo                                                                                                                         | P2        |
| Production-shape fixtures | Messy/real-world fixture coverage is `◐` across most domains                                                                                                             | P3        |

### Data Integrity Controls

- `npm run inventory:ledger:controls` — runs healthcheck (no negative sellable) + drift report (movement != computed ledger).
- `npm run accounting:transactions:sanitycheck` — cross-checks accounting vs. transactions DB.
- `npm run accounting:transactions:sanitycheck` runs against live data only — no automated CI gate on these scripts.

---

## Summary: What The Codebase Does

This is a **multi-business operations and accounting platform** for a Philippines-based business group running three entities: a clothing import/retail operation, a general merchandise import/retail operation, and a trucking company. It also has a personal household finance tracker for the owners.

Each business has a full management suite:

1. **Operations** — buy/sell lifecycle: products → shipments → inventory → transactions → customer receipts.
2. **Accounting** — double-entry journal auto-populated from operations data, with manual adjustments. Balance sheet, P&L, ledger.
3. **Employees** — full HR + payroll: schedule → attendance → deductions → payroll run → approval → payment. Statutory PH contributions (SSS, PhilHealth, PagIbig, tax). Leave, cash advances, 13th month.

The businesses share infrastructure (auth, deployments, navigation, shared hooks) but keep all data-layer models and API namespaces cleanly separated per domain. The refactor work over Audit Cycles 1–2 has driven most high-risk hooks and route handlers toward shared implementations, with the main remaining divergence in the accounting COGS engines and some route-level clones.
