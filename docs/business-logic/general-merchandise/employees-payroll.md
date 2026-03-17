# General Merchandise — Employees Payroll Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/payroll/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                 | Explanation                                                      |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | The GM payroll page lives at `/general-merchandise/employees/payroll` | The route belongs to the GM employees family.                    |
| 2   | The route reuses the Clothing employees payroll page component        | The page imports `EmployeesPayrollPage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                       | `renderGmEmployeesPage` wraps the payroll page.                  |
| 4   | The payroll workflow uses the GM API namespace                        | The route passes `apiBasePath="/api/general-merchandise"`.       |

---

## B — Workflow Notes

| #   | Logic                                                                                                  | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 5   | GM payroll behavior currently follows the shared payroll workflow                                      | There is no GM-only payroll page logic in this route.              |
| 6   | Shared payroll workflow changes still affect GM operators and must be reflected here                   | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom payroll calculations, approvals, or exports later, document them here explicitly | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM payroll data under GM URLs and GM APIs            | Shared UI does not remove the GM business context.                 |
