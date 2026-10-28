# Clothing Business — Business Logic Overview

This directory documents the extracted business rules and workflow behaviour for the **Clothing** business unit.
Employee procedures are owned by the [Master SOP Manual](operations-workflow.md),
updated 2026-10-28 with normal work, exceptions, examples and FAQ. The module
files below own technical enforcement and known limits, not competing SOPs.
Accounting interpretation lives in the [policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md);
the [current reconciliation report](../../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)
owns actual execution evidence and open financial decisions. Development behavior
does not imply deployment or certification of historical records.

---

## Operations

| Module                     | File                                                                         | Key Topics                                                                                                                     |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard                  | [operations-dashboard.md](./operations-dashboard.md)                         | Dashboard data and explicit mock/future limitations.                                                                           |
| Business Intelligence      | [operations-business-intelligence.md](./operations-business-intelligence.md) | Manila report windows, customer/refund metrics and report limitations.                                                         |
| Transactions               | [operations-transactions.md](./operations-transactions.md)                   | Real collections, cancellation approvals, A/R, atomic Clothing imports, conflicts and stock status.                            |
| Customers                  | [operations-customers.md](./operations-customers.md)                         | Saved identity, actual payout history, ordinary goods refunds and keyed physical-only returns.                                 |
| Products                   | [operations-products.md](./operations-products.md)                           | Supplier selection, future-purchase credit, explicit posting, five tabs, source-cost composite definitions and identity locks. |
| Prices                     | [operations-prices.md](./operations-prices.md)                               | Saved tiers, selling prices versus acquisition costs and destructive full-replace CSV scope.                                   |
| Inventory                  | [operations-inventory.md](./operations-inventory.md)                         | Physical/transit limits, free goods, cost-preserving transfers, original-component returns and protected source history.       |
| Sorting & Distribution     | [operations-sorting-distribution.md](./operations-sorting-distribution.md)   | Autosave, rounded allocation suggestions and actual physical count.                                                            |
| Shipments                  | [operations-shipments.md](./operations-shipments.md)                         | Status propagation, actual logistics, separate payment/capitalization and retained source-flow guards.                         |
| Dispatch                   | [operations-dispatch.md](./operations-dispatch.md)                           | Last-24-hour shipped window, fuzzy-match review, replace import and partial-success bulk updates.                              |
| Due Dates                  | [operations-due-dates.md](./operations-due-dates.md)                         | Prepared unpaid orders; invoice date plus three Manila calendar days at end-of-day, not a 72-hour timer.                       |
| Invoicing (Checkout Links) | [operations-checkout-links.md](./operations-checkout-links.md)               | Saved invoice/weight/link calculations, manual message handoff and local-only tickboxes; Drive sync is retired.                |
| Notifications              | [operations-notifications.md](./operations-notifications.md)                 | Grouped transaction/product/price/shipment changes.                                                                            |
| Settings                   | [operations-settings.md](./operations-settings.md)                           | Runtime cutoff, field protections, invoice defaults and backup navigation.                                                     |
| Post Template              | [operations-post-template.md](./operations-post-template.md)                 | Saved post-template text and validation.                                                                                       |
| Message Templates          | [operations-message-templates.md](./operations-message-templates.md)         | Deposit terminology, saved defaults and actual send responsibility.                                                            |
| Dispatching                | [operations-dispatching.md](./operations-dispatching.md)                     | Placeholder/mock surface, separate from the implemented Dispatch page.                                                         |
| Messaging                  | [operations-messaging.md](./operations-messaging.md)                         | Implemented persisted conversations/messages, user-visible deletion, unread state and pagination.                              |

---

## Accounting

Use the [Accounting Overview](accounting-overview.md) for current technical
notes and the source-specific report contracts:

| Module        | File                                                         | Key Topics                                                                                             |
| ------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Expenses      | [accounting-expenses.md](./accounting-expenses.md)           | Actual events, pending/approved/paid distinctions and unresolved historical settlement/deletion risks. |
| Journal       | [accounting-journal.md](./accounting-journal.md)             | Dated double-entry events and protected source identity.                                               |
| Ledger        | [accounting-ledger.md](./accounting-ledger.md)               | Brought Forward, Period Movement, Closing Balance, openings and authoritative exports.                 |
| Balance Sheet | [accounting-balance-sheet.md](./accounting-balance-sheet.md) | As-of assets, liabilities, equity, supplier credits, refund obligations and limits.                    |
| Profit & Loss | [accounting-profit-loss.md](./accounting-profit-loss.md)     | Revenue/COGS/expense windows, lot valuation completeness and dated corrections.                        |

---

## Employees

These are separate HR/payroll contracts, not employee retail SOPs:

| Module         | File                                                         | Key Topics                                            |
| -------------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| Team           | [employees-team.md](./employees-team.md)                     | Employee identity, detail/history and directory.      |
| Attendance     | [employees-attendance.md](./employees-attendance.md)         | Check-in/out, overtime, LWOP and bulk actions.        |
| Schedules      | [employees-schedules.md](./employees-schedules.md)           | Schedule views, shifts and recurrence.                |
| Leave Tracker  | [employees-leave-tracker.md](./employees-leave-tracker.md)   | Leave balances, overlap, calendar and lifecycle.      |
| Dashboard      | [employees-dashboard.md](./employees-dashboard.md)           | Employee KPIs and summaries.                          |
| Payroll        | [employees-payroll.md](./employees-payroll.md)               | Generation, approval, paid locks and payslips.        |
| Cash Advance   | [employees-cash-advance.md](./employees-cash-advance.md)     | Requests, approval and monthly payment math.          |
| Employee Loans | [employees-employee-loans.md](./employees-employee-loans.md) | Local-state-only workflow, not financial persistence. |
| Leave Requests | [employees-leave-requests.md](./employees-leave-requests.md) | Validation, overlap and shared service boundaries.    |
| 13th Month Pay | [employees-13th-month-pay.md](./employees-13th-month-pay.md) | Aggregation and approval/paid locks.                  |
| Settings       | [employees-settings.md](./employees-settings.md)             | Stay-in automation settings and execution.            |
| Expenses       | [employees-expenses.md](./employees-expenses.md)             | Redirect to Clothing Accounting.                      |
| Notifications  | [employees-notifications.md](./employees-notifications.md)   | Placeholder shell.                                    |
| Calendar       | [employees-calendar.md](./employees-calendar.md)             | Placeholder shell.                                    |

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
- **Dispatching**, **Employees Calendar**, and **Employees Notifications** retain explicit placeholder/shell caveats. **Messaging** is implemented; its own contract describes persistence and limits.
- The Products module remains the largest documented single module.
- The Transactions module contains the densest operator decision logic, including blocking stock-check dialogs.
- Route-level behaviour also matters: `/clothing/accounting` is the Accounting overview dashboard, and `/clothing/ledger` is a legacy redirect to `/clothing/accounting`.

---

## Coverage Matrix

| Domain     | Module                 | Status                 | Notes                                                                                                                    |
| ---------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Operations | Dashboard              | Documented             | Module doc exists and covers current dashboard workflow.                                                                 |
| Operations | Business Intelligence  | Documented             | Filters, stats, and chart behaviour are documented.                                                                      |
| Operations | Transactions           | Documented             | Core transaction workflows, stock dialogs, and status logic are documented.                                              |
| Operations | Customers              | Documented             | Includes detail-page workflow, refund flow, and cross-tab sync notes.                                                    |
| Operations | Products               | Documented             | Large workflow surface is documented, including product-owned transit build-up and reclass-to-stock workflows.           |
| Operations | Prices                 | Documented             | Modal and CSV workflows are documented.                                                                                  |
| Operations | Inventory              | Documented             | Adjustment flows, movement buckets, and guards are documented.                                                           |
| Operations | Sorting & Distribution | Documented             | Local persistence and inline-edit behaviour are documented.                                                              |
| Operations | Shipments              | Documented             | CRUD, shipment-scoped transit route behavior, and landed-cost clearing workflow are documented.                          |
| Operations | Dispatch               | Documented             | Multi-tab dispatch behaviour, fuzzy matching, and bulk-update flow are documented.                                       |
| Operations | Due Dates              | Documented             | Derived due-date workflow and status badges are documented.                                                              |
| Operations | Checkout Links         | Documented             | Invoicing and weight workflows are documented.                                                                           |
| Operations | Notifications          | Documented             | Notification grouping and tab behaviour are documented.                                                                  |
| Operations | Settings               | Documented             | Current 5-tab settings workflow is documented; obsolete marketplace/module-operation flow was removed.                   |
| Operations | Post Template          | Documented             | Template editing workflow is documented.                                                                                 |
| Operations | Message Templates      | Documented             | Create/edit/copy workflows are documented.                                                                               |
| Operations | Dispatching            | Placeholder documented | Current scaffold state is intentionally documented as placeholder-only.                                                  |
| Operations | Messaging              | Documented             | Persisted conversations/messages and pagination are implemented; the old placeholder summary was superseded.             |
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
