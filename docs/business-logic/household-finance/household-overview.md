# Household Finance Overview

This overview indexes the business logic documentation for the unified **Household Finance** domain.

> **UI source root:** `src/app/personal/`
>
> **API source root:** `src/app/api/household/`
>
> **Module source root:** `src/modules/household/`
>
> **Docs root:** `docs/business-logic/household-finance/`

---

## Domain Notes

- The repo uses `src/app/personal/**` as the Household Finance UI surface.
- The backend, schemas, and business logic are implemented under `src/modules/household/**` and `src/app/api/household/**`.
- Treat these as one Household domain, not as separate product areas.
- `/personal` is a route entry that redirects to `/personal/dashboard`.
- Pages fall into two groups:
  - Implemented workflows: Dashboard, Accounts, Expenses, Income, Budgets, Recurring Payments.
  - Scaffolded pages: Reports, Categories, Settings.

---

## Module Index

| Module             | Doc File                                                           | Description                                                                                          |
| ------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Dashboard          | [household-dashboard.md](household-dashboard.md)                   | Redirect entry and overview cards for net worth, cash flow, budget status, and upcoming bills.       |
| Accounts           | [household-accounts.md](household-accounts.md)                     | Account CRUD, filters, CSV import/export, analytics tab, and account-type rules.                     |
| Expenses           | [household-expenses.md](household-expenses.md)                     | Household expense tracking, status lifecycle, CSV export/template, and recurring-payments tab entry. |
| Recurring Payments | [household-recurring-payments.md](household-recurring-payments.md) | Recurring payment templates and monthly generation rules.                                            |
| Income             | [household-income.md](household-income.md)                         | Income CRUD, search/filter flow, CSV import/export, and account linkage.                             |
| Budgets            | [household-budgets.md](household-budgets.md)                       | Budget list/analytics views, period/status logic, and placeholder import/export actions.             |
| Reports            | [household-reports.md](household-reports.md)                       | Scaffolded reports roadmap and current page contract.                                                |
| Categories         | [household-categories.md](household-categories.md)                 | Scaffolded category-management roadmap and current page contract.                                    |
| Settings           | [household-settings.md](household-settings.md)                     | Scaffolded settings roadmap and current page contract.                                               |

---

## Key Technical Notes

- Household expenses and recurring payments can affect account balances.
- Expense balance impact is status-driven: only `approved` and `paid` affect balances.
- Recurring payment generation writes Household expenses with `sourceType = 'RECURRING'` and deduplicates by `(sourceId, sourceLineKey)`.
- Budget pages are connected to Household budget data, but budget add/import/export actions are currently placeholder alerts in the UI layer.
- Reports, Categories, and Settings pages are scaffolded shells with planned capability lists rather than live data workflows.
