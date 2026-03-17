# General Merchandise — Accounting Expenses Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/accounting/expenses/page.tsx`
> - `src/modules/general-merchandise/ledger/api/repository.ts`
> - `src/modules/general-merchandise/ledger/api/service.ts`
> - `src/modules/general-merchandise/ledger/api/schemas.ts`

---

## A — Route & Shared UI Baseline

| #   | Logic                                                                                                        | Explanation                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | The GM expenses page lives at `/general-merchandise/accounting/expenses`                                     | The route is a GM accounting surface, not an operations-owned page.                            |
| 2   | The page uses the shared accounting expenses route page                                                      | `ExpensesRoutePage` drives the UI workflow rather than a GM-only expenses page implementation. |
| 3   | The page uses the GM sheet-data hook for expense data                                                        | The route injects `useGeneralMerchandiseExpenseData` into the shared route page.               |
| 4   | Add/edit dialog titles and subtitles are GM-specific strings                                                 | The GM route customizes add/edit labels to make the business context explicit to operators.    |
| 5   | The shared expenses page shows summary stats cards before the working area                                   | Operators see total, pending, approved, and this-month expense cards at the top of the page.   |
| 6   | The shared controls include tab switching, search, category/status/source filters, and import/export actions | `ExpenseControls` manages list-vs-analytics tabs plus search and filter controls.              |
| 7   | Operators can download a template and open an add-expense dialog from the controls area                      | The shared controls wire download-template and add-expense actions.                            |

---

## B — Shared Dialog & Receipt Workflow

| #   | Logic                                                                      | Explanation                                                                                   |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 8   | The main working area switches between a list table and an analytics table | The route renders `ExpenseListTable` on the `list` tab and `AnalyticsTable` otherwise.        |
| 9   | Receipt viewing uses a dedicated modal with zoom and download actions      | `ReceiptViewerModal` supports zoom in, zoom out, zoom reset, and file download.               |
| 10  | Add and edit expense flows use a shared modal form                         | `ExpenseFormDialog` is used for both create and edit flows with GM-specific titles/subtitles. |

---

## C — GM Expense Persistence & Validation

| #   | Logic                                                                                        | Explanation                                                                                                               |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 11  | GM expenses are stored through a dedicated repository bound to `generalMerchandiseExpense`   | The repository extends the shared expense base class but keeps GM data in a GM-specific Prisma model.                     |
| 12  | GM expense status is limited to `pending`, `approved`, `rejected`, and `paid`                | The GM expense schemas enforce the same four-state lifecycle.                                                             |
| 13  | GM expense creation requires a real date, positive amount, description, category, and status | The GM schemas validate the minimum required accounting fields for expense creation.                                      |
| 14  | Expense source metadata is normalized before persistence                                     | The GM expense service uppercases `sourceType` and normalizes blank `sourceId`/`sourceLineKey` values to nullable fields. |
| 15  | Payment metadata is normalized so blank values do not persist as misleading strings          | Blank payment method or card values are normalized to optional/null forms in the GM service.                              |
| 16  | Expense dates are normalized to `YYYY-MM-DD` string storage                                  | The GM service converts `Date` inputs to ISO date strings before persistence.                                             |

---

## D — Workflow Notes

| #   | Logic                                                                                                                | Explanation                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 17  | The operator-facing add/edit workflow is shared, but the persistence rules are GM-specific                           | Shared UI does not remove GM-specific accounting rules in the service layer. |
| 18  | Any change to GM expense normalization, status rules, or source metadata handling must be documented here explicitly | These are GM-specific accounting behaviors.                                  |
