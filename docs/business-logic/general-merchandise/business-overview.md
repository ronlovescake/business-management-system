# General Merchandise Business — Business Logic Overview

This directory documents the extracted business rules and workflow behavior for the **General Merchandise** business unit.
The intent is for this folder to be the authoritative documentation set for current General Merchandise **Operations**, **Accounting**, and **Employees** workflows, including business rules, buttons, modals, toasts, alerts, redirects, and other operator-facing behavior.
Each file uses a numbered-table format (`# | Logic | Explanation`) grouped by lettered sections.

---

## Operations

| Module                     | File                                                                         | Rules | Key Topics                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                  | [operations-dashboard.md](./operations-dashboard.md)                         | 8     | Shared dashboard wrapper, GM route shell, GM business context, wrapper parity notes                                             |
| Business Intelligence      | [operations-business-intelligence.md](./operations-business-intelligence.md) | 8     | Shared BI workflow, GM API namespace, route wrapper, parity with Clothing                                                       |
| Transactions               | [operations-transactions.md](./operations-transactions.md)                   | 14    | Shared transaction workflow, GM route/module wiring, GM transaction service, inventory/customer/product/shipment/price bindings |
| Customers                  | [operations-customers.md](./operations-customers.md)                         | 10    | Shared customers workflow, GM route/detail pages, GM customer service, CSV/customer-management parity                           |
| Products                   | [operations-products.md](./operations-products.md)                           | 14    | Shared products UI workflow, GM product service, manual transit build-up, supplier settlement automation                        |
| Prices                     | [operations-prices.md](./operations-prices.md)                               | 8     | Shared prices workflow, GM route shell, parity notes                                                                            |
| Inventory                  | [operations-inventory.md](./operations-inventory.md)                         | 8     | Shared inventory workflow, GM route shell, analytics/movement parity                                                            |
| Sorting & Distribution     | [operations-sorting-distribution.md](./operations-sorting-distribution.md)   | 8     | Shared sorting/distribution workflow, GM route shell, local persistence parity                                                  |
| Shipments                  | [operations-shipments.md](./operations-shipments.md)                         | 9     | Shared shipments workflow, GM route shell, CRUD/transit-build parity                                                            |
| Dispatch                   | [operations-dispatch.md](./operations-dispatch.md)                           | 11    | Shared dispatch workflow plus GM-specific server-side customer preload and no-cache route behavior                              |
| Due Dates                  | [operations-due-dates.md](./operations-due-dates.md)                         | 8     | Shared due-dates workflow, GM route shell, parity notes                                                                         |
| Invoicing (Checkout Links) | [operations-checkout-links.md](./operations-checkout-links.md)               | 14    | Shared tabbed invoicing workflow with GM business APIs, shared checkout-link endpoints, import/export actions, and edit modal   |
| Notifications              | [operations-notifications.md](./operations-notifications.md)                 | 12    | Shared tabbed audit trail workflow with grouped changes, expand/collapse details, and loading/error/empty states                |
| Settings                   | [operations-settings.md](./operations-settings.md)                           | 11    | Shared settings workflow, backup redirect, GM route shell, settings-page parity and metadata drift note                         |
| Post Template              | [operations-post-template.md](./operations-post-template.md)                 | 8     | Shared post-template workflow, GM API namespace                                                                                 |
| Message Templates          | [operations-message-templates.md](./operations-message-templates.md)         | 13    | Shared template board workflow with copy actions, hidden header/hints, GM default-template seeding, and GM persistence          |
| Dispatching                | [operations-dispatching.md](./operations-dispatching.md)                     | 7     | Placeholder/scaffold workflow                                                                                                   |
| Messaging                  | [operations-messaging.md](./operations-messaging.md)                         | 11    | Shared real-time messaging workflow with polling, search, send flow, sound toggle, and new-conversation modal                   |

---

## Coverage Notes

- Most General Merchandise Operations pages are route wrappers around the same shared route pages or Clothing-backed pages used elsewhere in the repository.
- Where the GM route delegates to shared UI, the intended workflow remains the same unless a GM-specific note in the module doc says otherwise.
- GM-specific differences currently matter most in route entry behavior, API namespace, server-side customer preload in Dispatch, product accounting automation, and message-template persistence/seeding.
- Placeholder modules such as Dispatching should be documented explicitly as placeholders until real workflow is implemented.
- `/general-merchandise/operations` redirects to `/general-merchandise/operations/transactions` and that route-entry behavior is part of the documented workflow surface.

---

## Documentation Maintenance Policy

- This folder is intended to be the authoritative General Merchandise workflow and business-logic documentation set.
- Any change to General Merchandise Operations, Accounting, or Employees business logic must update every affected doc file in the same work item.
- Workflow changes include formulas, validations, statuses, filters, buttons, tabs, modals, toasts, notifications, alerts, confirms, prompts, redirects, route-entry behavior, and background posting/automation behavior.
- If a workflow is shared with Clothing or another domain, the GM doc must still state the GM route path, API namespace, and any GM-specific deviations.
- If a module is only a placeholder or redirect shell, the doc must say so explicitly instead of implying a fuller workflow.
