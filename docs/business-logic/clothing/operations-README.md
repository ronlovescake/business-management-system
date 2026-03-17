# Clothing Business — Business Logic Index

This directory documents the extracted business rules and workflow behaviour for the **Clothing** business unit.
The intent is for this folder to be the authoritative documentation set for current Clothing **Operations**, **Accounting**, and **Employees** workflows, including business rules, buttons, modals, toasts, alerts, redirects, and other operator-facing behaviour.
Each file uses a numbered-table format (`# | Logic | Explanation`) grouped by lettered sections.

---

## Operations

| Module                     | File                                                                         | Rules | Key Topics                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                  | [operations-dashboard.md](./operations-dashboard.md)                         | 41    | Mock/future data, statistics grid (4 cards), sales performance chart (7d/30d/90d), order pipeline funnel, inventory health, shipment timeline, sidebar highlights                                                   |
| Business Intelligence      | [operations-business-intelligence.md](./operations-business-intelligence.md) | 32    | 7 date filters (YTD/MTD/…/All), 3 parallel queries, 6 stat cards, monthly trend charts, top-10 products & customers, shipment metrics chart                                                                         |
| Transactions               | [operations-transactions.md](./operations-transactions.md)                   | 80    | Status machine, payment recording, CSV import, stock-check SweetAlert2 dialogs (SOLD_OUT blocks, INSUFFICIENT_STOCK caps, LOW_STOCK warns), invoice generation, due-date tracking                                   |
| Customers                  | [operations-customers.md](./operations-customers.md)                         | 107   | Validation, duplicate detection (60/25/15 weighting, 50% threshold), auto-fill, add/edit modals, additional info (5 categories × 5 max each), refund recording, transaction tabs, cross-tab sync, CSV notifications |
| Products                   | [operations-products.md](./operations-products.md)                           | 163   | Costing model (CNY→PHP), product code generation, edit mode, inline cell editing, transit build-up, add/edit modal, bundles, mix & match, shipping fee calculator, CSV import                                       |
| Prices                     | [operations-prices.md](./operations-prices.md)                               | 38    | Tier ordering validation, price auto-sync from Actual Price, add/edit modals, CSV full-replace import, increase/decrease stats                                                                                      |
| Inventory                  | [operations-inventory.md](./operations-inventory.md)                         | 45    | 7 movement buckets, actualQtyReceived/directSellableQty formulas, transfer guards, quick-adjustment modals (supplier short, additionals), edit/delete movements                                                     |
| Sorting & Distribution     | [operations-sorting-distribution.md](./operations-sorting-distribution.md)   | 38    | localStorage persistence, quantity pill buttons, SweetAlert2 mismatch alert (Add N / Deduct N), Handsontable inline edit, 1 s auto-save, percentage/distribution/group number formulas                              |
| Shipments                  | [operations-shipments.md](./operations-shipments.md)                         | 58    | Validation, duration (ceil days), 7 status buckets, transit-build journal entries, CRUD modals, search/filter                                                                                                       |
| Dispatch                   | [operations-dispatch.md](./operations-dispatch.md)                           | 53    | 24 h shipped window, 2-step confirm, fuzzy matching (40% threshold, top 10), XLSX import, clipboard copy with fallback, match tab prepared-totals, recently-updated tab                                             |
| Due Dates                  | [operations-due-dates.md](./operations-due-dates.md)                         | 35    | Invoice Date + 72 h rule, Prepared-only filter, grouped-by-customer table, overdue/due-soon/on-track badges (red/orange/green), Facebook link lookup, shared GM support                                             |
| Invoicing (Checkout Links) | [operations-checkout-links.md](./operations-checkout-links.md)               | 73    | Eligible statuses, actual weight formula, fixed tiers ≤3 kg, polynomial >3 kg, Messenger flow, Google Drive sync, local invoicing, CSV import/export, delete with typed confirmation                                |
| Notifications              | [operations-notifications.md](./operations-notifications.md)                 | 16    | 4 entity tabs (transactions/products/prices/shipments), staleTime:0, grouped by transactionId+action+user+date, expand/collapse change-detail rows                                                                  |
| Settings                   | [operations-settings.md](./operations-settings.md)                           | 45    | 5 tabs, accounting cutover dates, transaction field protections (double SweetAlert2), invoice format (PDF/PNG), invoice message template (placeholder validation), double SweetAlert2 reset, backup redirect        |
| Post Template              | [operations-post-template.md](./operations-post-template.md)                 | 15    | Nested under Settings → Message tab, intro paragraphs (min 1), bullet points, upsert by slug, green/red save notifications                                                                                          |
| Message Templates          | [operations-message-templates.md](./operations-message-templates.md)         | 30    | Canonical order display, copy-with-check-icon, SweetAlert2 before edit and save, create modal with validation, badge colour (Reminder=blue/Cancellation=red/other=gray)                                             |
| Dispatching                | [operations-dispatching.md](./operations-dispatching.md)                     | 7     | **Placeholder** — mock data only, no API, import/edit/delete simulated                                                                                                                                              |
| Messaging                  | [operations-messaging.md](./operations-messaging.md)                         | 7     | **Placeholder** — type definitions and mock conversations only, no UI or API implemented                                                                                                                            |

---

## Accounting

| Module        | File                                                         | Rules | Key Topics                                                                                               |
| ------------- | ------------------------------------------------------------ | ----- | -------------------------------------------------------------------------------------------------------- |
| Expenses      | [accounting-expenses.md](./accounting-expenses.md)           | 50    | Expense tracking, status lifecycle, category mapping, receipt viewing, filters, CSV import/export        |
| Journal       | [accounting-journal.md](./accounting-journal.md)             | 45    | Double-entry journal, manual entry modal, tagged accounts, CSV import/export, delete confirmation        |
| Ledger        | [accounting-ledger.md](./accounting-ledger.md)               | 67    | Running balances, opening balance modal, transit build-up actions, recurring payments, CSV import/export |
| Balance Sheet | [accounting-balance-sheet.md](./accounting-balance-sheet.md) | 27    | Assets/liabilities/equity snapshot, sign inversion, cash/stock/transit subtables, balancing checks       |
| Profit & Loss | [accounting-profit-loss.md](./accounting-profit-loss.md)     | 29    | Revenue/COGS/expense summaries, comparison overlays, breakdown charts, detail drill-down, CSV export     |

---

## Employees

| Module         | File                                                         | Rules | Key Topics                                                                                                       |
| -------------- | ------------------------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------- |
| Team           | [employees-team.md](./employees-team.md)                     | 48    | Employee directory, employee ID generation, create/edit/delete, detail page, related history tabs, avatar upload |
| Attendance     | [employees-attendance.md](./employees-attendance.md)         | 56    | Check-in/out, status modes, overtime, LWOP, bulk actions, auto-record                                            |
| Schedules      | [employees-schedules.md](./employees-schedules.md)           | 40    | Two tabs, shift/status colors, modal workflow, recurrence, CSV import/export                                     |
| Leave Tracker  | [employees-leave-tracker.md](./employees-leave-tracker.md)   | 42    | Leave lifecycle, balances, overlap handling, analytics, calendar impacts                                         |
| Dashboard      | [employees-dashboard.md](./employees-dashboard.md)           | 20    | Cross-module employee KPIs and summaries                                                                         |
| Payroll        | [employees-payroll.md](./employees-payroll.md)               | 83    | Generation flow, formulas, approvals, mark-as-paid, payslip ZIP download, CSV import/export                      |
| Cash Advance   | [employees-cash-advance.md](./employees-cash-advance.md)     | 43    | Request lifecycle, monthly payment math, optimistic updates, prompt/reject flow                                  |
| Employee Loans | [employees-employee-loans.md](./employees-employee-loans.md) | 43    | **Local-state-only** loan workflow, approval/activation/completion, CSV import/export                            |
| Leave Requests | [employees-leave-requests.md](./employees-leave-requests.md) | 8     | Request validation, overlap detection with `excludeId`, shared service-base behaviour                            |
| 13th Month Pay | [employees-13th-month-pay.md](./employees-13th-month-pay.md) | 44    | Multi-source aggregation, `monthsWorked` set semantics, approve/mark-paid locking                                |
| Settings       | [employees-settings.md](./employees-settings.md)             | 20    | Stay-in automation settings, delta save, run-now action                                                          |
| Expenses       | [employees-expenses.md](./employees-expenses.md)             | 2     | Redirect stub to Clothing Accounting                                                                             |
| Notifications  | [employees-notifications.md](./employees-notifications.md)   | —     | **Placeholder** — empty shell, not implemented                                                                   |
| Calendar       | [employees-calendar.md](./employees-calendar.md)             | —     | **Placeholder** — empty shell, not implemented                                                                   |

---

## Format Legend

Each rule file shares a common structure:

```
## SECTION (A, B, C …) — Section Title

| #  | Logic                          | Explanation                        |
|----|--------------------------------|------------------------------------|
| 1  | Short rule statement           | Detailed rationale / source detail |
```

- **#** — Sequential number within the file (not unique across files).
- **Logic** — The rule stated concisely, often including the exact formula or allowed values.
- **Explanation** — Where the rule comes from, why it exists, and any important edge cases.

---

## Coverage Notes

- Rules are derived from the current Clothing codebase in both `src/app/clothing/` and `src/modules/clothing/`, including route-level workflow where it affects operator behaviour.
- Employee modules such as cash advance, leave requests, and 13th month pay may delegate to shared service bases in `src/shared/employees/`; the Clothing docs should still reflect the user-visible behaviour in the Clothing routes.
- **Dispatching**, **Messaging**, **Employees Calendar**, and **Employees Notifications** are placeholder or shell modules. Their docs should continue to describe the current scaffold state until real workflow is implemented.
- The Products module remains the largest documented single module.
- The Transactions module contains the densest operator decision logic, including blocking stock-check dialogs.
- Route-level behaviour also matters: `/clothing/accounting` is a root redirect entry point, and `/clothing/ledger` is a legacy redirect to `/clothing/accounting`.

---

## Coverage Matrix

| Domain     | Module                 | Status                 | Notes                                                                                                                    |
| ---------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Operations | Dashboard              | Documented             | Module doc exists and covers current dashboard workflow.                                                                 |
| Operations | Business Intelligence  | Documented             | Filters, stats, and chart behaviour are documented.                                                                      |
| Operations | Transactions           | Documented             | Core transaction workflows, stock dialogs, and status logic are documented.                                              |
| Operations | Customers              | Documented             | Includes detail-page workflow, refund flow, and cross-tab sync notes.                                                    |
| Operations | Products               | Documented             | Large workflow surface is documented; keep markdown formatting in sync when editing.                                     |
| Operations | Prices                 | Documented             | Modal and CSV workflows are documented.                                                                                  |
| Operations | Inventory              | Documented             | Adjustment flows, movement buckets, and guards are documented.                                                           |
| Operations | Sorting & Distribution | Documented             | Local persistence and inline-edit behaviour are documented.                                                              |
| Operations | Shipments              | Documented             | CRUD and transit-build interactions are documented.                                                                      |
| Operations | Dispatch               | Documented             | Multi-tab dispatch behaviour, fuzzy matching, and bulk-update flow are documented.                                       |
| Operations | Due Dates              | Documented             | Derived due-date workflow and status badges are documented.                                                              |
| Operations | Checkout Links         | Documented             | Invoicing and weight workflows are documented.                                                                           |
| Operations | Notifications          | Documented             | Notification grouping and tab behaviour are documented.                                                                  |
| Operations | Settings               | Documented             | Current 5-tab settings workflow is documented; obsolete marketplace/module-operation flow was removed.                   |
| Operations | Post Template          | Documented             | Template editing workflow is documented.                                                                                 |
| Operations | Message Templates      | Documented             | Create/edit/copy workflows are documented.                                                                               |
| Operations | Dispatching            | Placeholder documented | Current scaffold state is intentionally documented as placeholder-only.                                                  |
| Operations | Messaging              | Placeholder documented | Current scaffold state is intentionally documented as placeholder-only.                                                  |
| Accounting | Expenses               | Documented             | Current expense tracking behaviour is documented.                                                                        |
| Accounting | Journal                | Documented             | Current journal workflow is documented.                                                                                  |
| Accounting | Ledger                 | Documented             | Current ledger workflow is documented.                                                                                   |
| Accounting | Balance Sheet          | Documented             | Snapshot and sign-convention behaviour are documented.                                                                   |
| Accounting | Profit & Loss          | Documented             | Reporting workflow is documented.                                                                                        |
| Accounting | Accounting root route  | Documented             | Route-entry behaviour is noted in the Accounting README and should stay aligned with the module docs.                    |
| Accounting | Legacy ledger route    | Documented             | `/clothing/ledger` redirect behaviour is noted in the Accounting README and should stay aligned with current navigation. |
| Employees  | Team                   | Documented             | List and detail-page workflows, related-history tabs, and avatar upload rules are documented.                            |
| Employees  | Attendance             | Documented             | Status, modal, auto-record, and bulk workflows are documented.                                                           |
| Employees  | Schedules              | Documented             | Filters, tabs, modal, recurrence, and CSV behaviour are documented.                                                      |
| Employees  | Leave Tracker          | Documented             | Leave lifecycle, analytics, and calendar-impact logic are documented.                                                    |
| Employees  | Dashboard              | Documented             | Summary module workflow is documented.                                                                                   |
| Employees  | Payroll                | Documented             | Generation, approval, payout, and CSV/payslip workflows are documented.                                                  |
| Employees  | Cash Advance           | Documented             | Status lifecycle and payment behaviours are documented.                                                                  |
| Employees  | Employee Loans         | Documented with caveat | Workflow is documented and explicitly flagged as local-state-only, not persisted.                                        |
| Employees  | Leave Requests         | Documented             | Shared-base request validation workflow is documented.                                                                   |
| Employees  | 13th Month Pay         | Documented             | Aggregation, locking, and status transitions are documented.                                                             |
| Employees  | Settings               | Documented             | Stay-in automation workflow is documented.                                                                               |
| Employees  | Expenses               | Redirect documented    | Redirect-only behaviour to Clothing Accounting is documented.                                                            |
| Employees  | Notifications          | Placeholder documented | Current empty-shell state is intentionally documented.                                                                   |
| Employees  | Calendar               | Placeholder documented | Current empty-shell state is intentionally documented.                                                                   |

---

## Documentation Maintenance Policy

- This folder is intended to be the authoritative Clothing workflow and business-logic documentation set.
- Any change to Clothing Operations, Accounting, or Employees business logic must update every affected doc file in the same work item.
- Workflow changes include formulas, validations, statuses, filters, buttons, tabs, modals, toasts, notifications, alerts, confirms, prompts, redirects, and route-entry behaviour.
- If a workflow spans multiple modules, all affected module docs and any affected index entries must be updated together.
- If a module is only a placeholder or redirect shell, the doc must say so explicitly instead of implying a fuller workflow.
