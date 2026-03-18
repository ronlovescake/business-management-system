# Household Finance: Dashboard Business Logic

> **Source files:**
>
> - `src/app/personal/page.tsx`
> - `src/app/personal/dashboard/page.tsx`

---

## A - Route Entry

| #   | Logic                                                                                        | Explanation                                                                            |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `/personal` redirects to `/personal/dashboard`                                               | The root Household route is an entry route, not a standalone page.                     |
| 2   | Dashboard title is `Personal Dashboard`                                                      | The UI still uses `personal` naming, but this page is the Household dashboard surface. |
| 3   | Dashboard description states it is an overview of household finances, cash flow, and budgets | The page contract is overview-first rather than transaction entry.                     |

---

## B - Overview Cards

| #   | Logic                                             | Explanation                                                                                      |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 4   | Four overview cards are rendered                  | `Net worth`, `Monthly cash flow`, `Budget status`, and `Upcoming bills`.                         |
| 5   | Current card values are placeholder guidance text | Examples: `Add accounts to calculate`, `Track income and expenses`, `Create budgets to monitor`. |
| 6   | The page is informational only                    | No create/edit/delete actions are currently wired from the dashboard page.                       |
