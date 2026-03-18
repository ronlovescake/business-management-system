# Household Finance: Budgets Business Logic

> **Source files:**
>
> - `src/app/personal/budgets/page.tsx`
> - `src/app/personal/hooks/usePersonalBudgetsView.ts`
> - `src/app/personal/budgets/components/BudgetFiltersPanel.tsx`
> - `src/modules/household/budgets/api/schemas.ts`

---

## A - Page Layout & Stats

| #   | Logic                                                    | Explanation                                                     |
| --- | -------------------------------------------------------- | --------------------------------------------------------------- |
| 1   | The Budgets page has two tabs                            | `Budget List` and `Analytics`.                                  |
| 2   | Four stat cards summarize the filtered budget set        | Total Planned, Total Actual, Remaining, and This Month.         |
| 3   | The `This Month` card prefers actual values when present | Falls back to planned values when current-month actual is zero. |

---

## B - Budget Rules

| #   | Logic                                           | Explanation                                                                            |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| 4   | Budget periods are `monthly` or `annual`        | This is enforced in the schema layer.                                                  |
| 5   | Monthly budgets require both `month` and `year` | Validation rejects monthly records that omit either field.                             |
| 6   | Budget status is derived from actual vs planned | `over` when actual exceeds planned, `under` when below planned, `on-track` when equal. |
| 7   | Remaining is computed as `planned - actual`     | Variance is computed as `actual - planned`.                                            |

---

## C - Filters & Search

| #   | Logic                                                                                         | Explanation                                                           |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 8   | Search matches category, account, notes, period, and month label                              | Matching is normalized client-side.                                   |
| 9   | Filters are available for category, period, and derived status                                | Options include `monthly`, `annual`, `over`, `under`, and `on-track`. |
| 10  | Category filter merges canonical Household categories with any extra stored budget categories | Existing data can extend the option list.                             |

---

## D - Current UI Limits

| #   | Logic                                              | Explanation                             |
| --- | -------------------------------------------------- | --------------------------------------- |
| 11  | `Add Budget` is currently a placeholder alert      | There is no live create modal yet.      |
| 12  | Budget CSV import is currently a placeholder alert | The UI indicates import is coming soon. |
| 13  | Budget CSV export is currently a placeholder alert | The UI indicates export is coming soon. |
