# Clothing Business — Business Logic Index

This directory documents the extracted business rules for every module in the **Clothing** business unit.
Each file uses a numbered-table format (`# | Logic | Explanation`) grouped by lettered sections.

---

## Operations

| Module                     | File                                                                         | Rules | Key Topics                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                  | [operations-dashboard.md](./operations-dashboard.md)                         | 41    | Mock/future data, statistics grid (4 cards), sales performance chart (7d/30d/90d), order pipeline funnel, inventory health, shipment timeline, sidebar highlights                                                            |
| Business Intelligence      | [operations-business-intelligence.md](./operations-business-intelligence.md) | 32    | 7 date filters (YTD/MTD/…/All), 3 parallel queries, 6 stat cards, monthly trend charts, top-10 products & customers, shipment metrics chart                                                                                  |
| Transactions               | [operations-transactions.md](./operations-transactions.md)                   | 80    | Status machine, payment recording, CSV import, stock-check SweetAlert2 dialogs (SOLD_OUT blocks, INSUFFICIENT_STOCK caps, LOW_STOCK warns), invoice generation, due-date tracking                                            |
| Customers                  | [operations-customers.md](./operations-customers.md)                         | 107   | Validation, duplicate detection (60/25/15 weighting, 50% threshold), auto-fill, add/edit modals, additional info (5 categories × 5 max each), refund recording, transaction tabs, cross-tab sync, CSV notifications          |
| Products                   | [operations-products.md](./operations-products.md)                           | 163   | Costing model (CNY→PHP), product code generation, edit mode, inline cell editing, transit build-up, add/edit modal, bundles, mix & match, shipping fee calculator, CSV import                                                |
| Prices                     | [operations-prices.md](./operations-prices.md)                               | 38    | Tier ordering validation, price auto-sync from Actual Price, add/edit modals, CSV full-replace import, increase/decrease stats                                                                                               |
| Inventory                  | [operations-inventory.md](./operations-inventory.md)                         | 45    | 7 movement buckets, actualQtyReceived/directSellableQty formulas, transfer guards, quick-adjustment modals (supplier short, additionals), edit/delete movements                                                              |
| Sorting & Distribution     | [operations-sorting-distribution.md](./operations-sorting-distribution.md)   | 38    | localStorage persistence, quantity pill buttons, SweetAlert2 mismatch alert (Add N / Deduct N), Handsontable inline edit, 1 s auto-save, percentage/distribution/group number formulas                                       |
| Shipments                  | [operations-shipments.md](./operations-shipments.md)                         | 58    | Validation, duration (ceil days), 7 status buckets, transit-build journal entries, CRUD modals, search/filter                                                                                                                |
| Dispatch                   | [operations-dispatch.md](./operations-dispatch.md)                           | 53    | 24 h shipped window, 2-step confirm, fuzzy matching (40% threshold, top 10), XLSX import, clipboard copy with fallback, match tab prepared-totals, recently-updated tab                                                      |
| Due Dates                  | [operations-due-dates.md](./operations-due-dates.md)                         | 35    | Invoice Date + 72 h rule, Prepared-only filter, grouped-by-customer table, overdue/due-soon/on-track badges (red/orange/green), Facebook link lookup, shared GM support                                                      |
| Invoicing (Checkout Links) | [operations-checkout-links.md](./operations-checkout-links.md)               | 73    | Eligible statuses, actual weight formula, fixed tiers ≤3 kg, polynomial >3 kg, Messenger flow, Google Drive sync, local invoicing, CSV import/export, delete with typed confirmation                                         |
| Notifications              | [operations-notifications.md](./operations-notifications.md)                 | 16    | 4 entity tabs (transactions/products/prices/shipments), staleTime:0, grouped by transactionId+action+user+date, expand/collapse change-detail rows                                                                           |
| Settings                   | [operations-settings.md](./operations-settings.md)                           | 45    | 5 tabs, accounting cutover dates, transaction field protections (double SweetAlert2), invoice format (PDF/PNG), invoice message template (placeholder validation), double SweetAlert2 reset, module install/uninstall/update |
| Post Template              | [operations-post-template.md](./operations-post-template.md)                 | 15    | Nested under Settings → Message tab, intro paragraphs (min 1), bullet points, upsert by slug, green/red save notifications                                                                                                   |
| Message Templates          | [operations-message-templates.md](./operations-message-templates.md)         | 30    | Canonical order display, copy-with-check-icon, SweetAlert2 before edit and save, create modal with validation, badge colour (Reminder=blue/Cancellation=red/other=gray)                                                      |
| Dispatching                | [operations-dispatching.md](./operations-dispatching.md)                     | 7     | **Placeholder** — mock data only, no API, import/edit/delete simulated                                                                                                                                                       |
| Messaging                  | [operations-messaging.md](./operations-messaging.md)                         | 7     | **Placeholder** — type definitions and mock conversations only, no UI or API implemented                                                                                                                                     |

---

## Employees

| Module         | File                                                         | Rules | Key Topics                                                                                             |
| -------------- | ------------------------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| Payroll        | [employees-payroll.md](./employees-payroll.md)               | 15    | Approver resolution, 8-component deductions, net pay floor at 0, filter AND logic, payslip dedup guard |
| Cash Advance   | [employees-cash-advance.md](./employees-cash-advance.md)     | 4     | findById-before-update guard, sequential deleteAll, shared base pattern                                |
| Leave Requests | [employees-leave-requests.md](./employees-leave-requests.md) | 8     | All-or-nothing employee pre-validation, overlap detection with excludeId, shared base                  |
| 13th Month Pay | [employees-13th-month-pay.md](./employees-13th-month-pay.md) | 5     | Basic salary components only, Jan–Dec calendar year ÷ 12, shared base                                  |

---

## Ledger

| Module             | File                                                                   | Rules | Key Topics                                                                                                               |
| ------------------ | ---------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| Expenses           | [accounting-expenses.md](./accounting-expenses.md)                     | 6     | sourceType uppercase normalisation, null coercion for blank string foreign keys, payment method omit-if-blank            |
| Recurring Payments | [operations-recurring-payments.md](./operations-recurring-payments.md) | 11    | Cutover guard, month-by-month loop, day-of-month preservation, idempotent drafts, double-post prevention, skip semantics |

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

- All rules are derived from the TypeScript source code in `src/modules/clothing/`.
- Employee modules (cash advance, leave requests, 13th month pay) delegate to shared service bases in `src/shared/employees/`. Rules documented here reflect the shared-base behaviour; Clothing-specific overrides (none currently) would be documented in the module file.
- **Dispatching** and **Messaging** are placeholder modules with no real API or UI yet. Their docs reflect the current scaffold state.
- The Products module is the largest single module (163 rules across 20 sections).
- The Transactions module covers 80 rules; stock-check dialogs are SweetAlert2-based and can block saves (SOLD_OUT, INSUFFICIENT_STOCK with zero available).
