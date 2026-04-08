# General Merchandise — Employees Expenses Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/expenses/page.tsx`

---

## A — Redirect Behavior

| #   | Logic                                                                                                                 | Explanation                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | `/general-merchandise/employees/expenses` is not its own employee-management page                                     | The route is implemented as a redirect helper rather than a standalone page. |
| 2   | The route redirects to `/general-merchandise/accounting/journal`                                                      | Employee users are sent to the GM accounting journal surface rather than to a standalone GM expenses page. |
| 3   | The redirect is implemented with `EmployeesExpensesRedirectPage`                                                      | The route is a shell around the shared redirect component.                   |
| 4   | Any future conversion of this route into a real employees-owned expense page must replace this documentation baseline | This doc should remain redirect-only until code proves otherwise.            |
