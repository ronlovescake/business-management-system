# Household Finance: Expenses Business Logic

> **Source files:**
>
> - `src/app/personal/expenses/page.tsx`
> - `src/app/personal/hooks/useHouseholdExpenses.ts`
> - `src/app/personal/hooks/usePersonalExpensesView.ts`
> - `src/app/clothing/accounting/components/ExpenseControls.tsx`
> - `src/modules/household/expenses/api/schemas.ts`
> - `src/modules/household/expenses/api/service.ts`

---

## A - Page Layout & Tabs

| #   | Logic                                                        | Explanation                                                             |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| 1   | The Expenses page reuses the shared accounting expense shell | Household-specific copy is injected into the shared controls and modal. |
| 2   | Three tabs are available                                     | `list`, `analytics`, and `recurring`.                                   |
| 3   | Four summary cards are rendered                              | Total Expenses, Pending, Approved, and This Month.                      |

---

## B - Expense Status & Balance Impact

| #   | Logic                                                                | Explanation                                                                                     |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 4   | New Household expenses created from the current UI save flow default to `paid` | `useHouseholdExpenses.ts` explicitly submits `status: 'paid'` on create and save-and-add-new. |
| 5   | Supported statuses are `pending`, `approved`, `rejected`, and `paid` | Status is enum-validated in the module schema.                                                  |
| 6   | The broader Household expense model still supports the full status workflow and balance rules | Even though the current create UI seeds `paid`, the schema and service layer still recognize `pending`, `approved`, `rejected`, and `paid`, and linked balance impact still depends on the service-layer status rules. |
| 7   | Expense source tracking is preserved                                 | `sourceType`, `sourceId`, `sourceLineKey`, and `systemGenerated` are part of the stored record. |

---

## C - Add / Edit Expense Form

| #   | Logic                                                                 | Explanation                                              |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------- |
| 8   | `Add Expense` opens Household create mode                             | Modal title: `Add New Household Expense`.                |
| 9   | Edit opens Household update mode                                      | Modal title: `Edit Household Expense`.                   |
| 10  | Save-and-add-new keeps the modal open and preserves the selected date | This supports rapid entry of multiple same-day expenses. |
| 11  | Household expense form includes account selection                     | Household expenses can be linked to a Household account. |

---

## D - Filters & Export

| #   | Logic                                                                  | Explanation                                                                                               |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 12  | Search, date, category, status, source, and year filters are available | The page supports both financial and source-based filtering.                                              |
| 13  | `Export` writes Household expenses to CSV                              | Exported columns are Date, Amount, Description, Category, Account, Status, Source, and Notes.             |
| 14  | Export with no data shows a warning notification                       | The message is `No household expenses found to export.`                                                   |
| 15  | `Download Template` creates a Household expense CSV template           | Template columns are `date`, `amount`, `description`, `category`, `account`, `status`, `source`, `notes`. |

---

## E - Import Caveat

| #   | Logic                                                         | Explanation                                                                             |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 16  | Expense CSV import is not yet implemented in the Household UI | The page currently shows a `Coming soon` notification instead of posting imported rows. |

---

## F - Recurring Payments Entry Point

| #   | Logic                                                                          | Explanation                                                                                        |
| --- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 17  | The Expenses page contains the Household recurring-payments workflow           | The recurring workflow is not a separate page; it lives in the recurring tab on the Expenses page. |
| 18  | The recurring tab exposes search, monthly generation, and add-template actions | Controls: `Search recurring payments...`, `Generate This Month`, and `Add Recurring Payment`.      |
