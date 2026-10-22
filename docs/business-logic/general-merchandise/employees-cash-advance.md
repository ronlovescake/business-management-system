# General Merchandise — Employees Cash Advance Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/cash-advance/page.tsx`
> - `src/app/api/general-merchandise/cash-advances/route.ts`
> - `src/modules/employees/cash-advance/api/routeFactory.ts`
> - `src/modules/shared/employees/cash-advance/api/calculations.ts`

---

## A — Route & Shared Baseline

| #   | Logic                                                                           | Explanation                                                          |
| --- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 1   | The GM cash-advance page lives at `/general-merchandise/employees/cash-advance` | The route belongs to the GM employees family.                        |
| 2   | The route reuses the Clothing employees cash-advance page component             | The page imports `EmployeesCashAdvancePage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                                 | `renderGmEmployeesPage` wraps the cash-advance page.                 |
| 4   | The cash-advance workflow uses the GM API namespace                             | The route passes `apiBasePath="/api/general-merchandise"`.           |

---

## B — Workflow Notes

| #   | Logic                                                                                                     | Explanation                                                        |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | GM cash-advance behavior currently follows the shared cash-advance workflow                               | There is no GM-only cash-advance page logic in this route.         |
| 6   | Shared cash-advance workflow changes still affect GM operators and must be reflected here                 | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom approval, repayment, or settlement rules later, document them here explicitly       | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM employee cash-advance data under GM URLs and GM APIs | Shared UI does not remove the GM business context.                 |

## C — Server-Owned Repayment Values

The GM API calculates and persists the monthly payment from amount and terms
using equal instalments rounded to two decimal places. It recomputes that value
when amount or terms change, derives remaining balance from amount minus settled
amount, and marks an approved request paid when the remaining balance is at most
`0.01`. Any browser calculation is a preview; these persisted values are
server-derived.
