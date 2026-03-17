# Clothing - Employees: Expenses Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/expenses/page.tsx`
> - `src/app/employees/_shared/EmployeesExpensesRedirectPage.tsx`

---

## A - Redirect Behaviour

| #   | Logic                                                                                     | Explanation                                                                                               |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | The Expenses page is a redirect stub — it immediately redirects to `/clothing/accounting` | Rendered via `EmployeesExpensesRedirectPage` shared component with `redirectPath="/clothing/accounting"`. |
| 2   | No expenses data is fetched or displayed within the Employees module                      | All expense tracking for Clothing resides in the Accounting module.                                       |
