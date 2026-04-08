# Trucking Business — Business Logic Overview

This directory documents the active business rules and operator workflow for the **Trucking** domain.
It is the trucking counterpart to the existing Clothing, General Merchandise, and Household Finance business-logic docs.

> **UI source root:** `src/app/trucking/`
>
> **API source root:** `src/app/api/trucking/`
>
> **Module source root:** `src/modules/trucking/`
>
> **Shared logic roots:** `src/modules/shared/**`, `src/lib/payroll/trucking/**`
>
> **Docs root:** `docs/business-logic/trucking/`

---

## Domain Notes

- Trucking combines fleet operations, trip execution, invoicing, payment allocation, employee workflows, profitability analytics, and cashflow reporting.
- The core trucking-specific records are fleet vehicles, vehicle assignments, trips, invoices, payments, and trucking expenses.
- Trucking employee pages reuse some shared employee infrastructure, but trucking still owns the operator-visible route structure and domain-specific payroll and expense behavior.
- Trucking reporting should be interpreted as its own operating model, not as a copy of clothing or general-merchandise accounting.

---

## Module Index

| Module | Doc File | Description |
| --- | --- | --- |
| Business overview | [business-overview.md](./business-overview.md) | Domain map, source roots, and documentation coverage. |
| Operations overview | [operations-overview.md](./operations-overview.md) | Fleet registry, vehicle assignment, truck assignment, and trip lifecycle rules. |
| Finance overview | [finance-overview.md](./finance-overview.md) | Invoice generation, payment allocation, trucking expenses, and finance cross-links. |
| Employees overview | [employees-overview.md](./employees-overview.md) | Shared-vs-trucking employee logic, payroll, leave, attendance, and employee trips. |
| Profitability analytics | [analytics-profitability.md](./analytics-profitability.md) | Revenue-versus-expense rules for completed trips and trip-linked expenses. |
| Cashflow report | [reports-cashflow.md](./reports-cashflow.md) | Current trucking cash inflow/outflow reporting behavior and known limits. |

---

## Coverage Notes

- Operations, finance, profitability, and cashflow are now documented at rule level in this folder.
- Trucking employee workflows still need a deeper numbered-rule pass where operator behavior materially diverges from the shared employee engine.
- When a trucking surface is still scaffolded, that caveat is preserved explicitly instead of being documented as a finished workflow.

---

## Maintenance Policy

- Any trucking workflow change should update the affected trucking doc in this folder in the same work item.
- If a trucking workflow delegates to shared services, the trucking doc should still describe the **trucking operator-visible behavior** rather than only the shared implementation detail.
- If a page or route is still partial, the doc should record the current constraint rather than assuming planned behavior.