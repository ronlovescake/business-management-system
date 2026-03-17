# General Merchandise — Employees 13th Month Pay Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/thirteenth-month-pay/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                                     | Explanation                                                                 |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | The GM 13th-month-pay page lives at `/general-merchandise/employees/thirteenth-month-pay` | The route belongs to the GM employees family.                               |
| 2   | The route reuses the Clothing 13th-month-pay page component                               | The page imports `EmployeesThirteenthMonthPayPage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                                           | `renderGmEmployeesPage` wraps the 13th-month-pay page.                      |
| 4   | The 13th-month-pay workflow uses the GM API namespace                                     | The route passes `apiBasePath="/api/general-merchandise"`.                  |

---

## B — Workflow Notes

| #   | Logic                                                                                                     | Explanation                                                        |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | GM 13th-month-pay behavior currently follows the shared workflow                                          | There is no GM-only 13th-month-pay page logic in this route.       |
| 6   | Shared 13th-month-pay workflow changes still affect GM operators and must be reflected here               | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom eligibility, computation, or approval rules later, document them here explicitly    | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM employee compensation data under GM URLs and GM APIs | Shared UI does not remove the GM business context.                 |
