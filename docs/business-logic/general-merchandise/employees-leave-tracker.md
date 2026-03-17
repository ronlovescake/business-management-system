# General Merchandise — Employees Leave Tracker Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/leave-tracker/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                             | Explanation                                                           |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1   | The GM leave-tracker page lives at `/general-merchandise/employees/leave-tracker` | The route belongs to the GM employees family.                         |
| 2   | The route reuses the Clothing employees leave-tracker page component              | The page imports `EmployeesLeaveTrackerPage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                                   | `renderGmEmployeesPage` wraps the leave-tracker page.                 |
| 4   | The leave-tracker workflow uses the GM API namespace                              | The route passes `apiBasePath="/api/general-merchandise"`.            |

---

## B — Workflow Notes

| #   | Logic                                                                                                 | Explanation                                                        |
| --- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | GM leave-tracker behavior currently follows the shared leave workflow                                 | There is no GM-only leave-tracker page logic in this route.        |
| 6   | Shared leave workflow changes still affect GM operators and must be reflected here                    | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom leave balances, approvals, or restrictions later, document them here explicitly | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM employee leave data under GM URLs and GM APIs    | Shared UI does not remove the GM business context.                 |
