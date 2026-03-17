# General Merchandise — Employees Employee Loans Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/employee-loans/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                               | Explanation                                                       |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | The GM employee-loans page lives at `/general-merchandise/employees/employee-loans` | The route belongs to the GM employees family.                     |
| 2   | The route reuses the Clothing employee-loans page component                         | The page imports `EmployeeLoans` from Clothing employees.         |
| 3   | The route renders inside the GM employees shell                                     | `renderGmEmployeesPage` wraps the employee-loans page.            |
| 4   | The route does not inject a GM API namespace prop                                   | This route currently uses the imported employee-loans page as-is. |

---

## B — Workflow Notes

| #   | Logic                                                                                                                                 | Explanation                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 5   | GM employee-loans behavior currently follows the shared/clothing employee-loans workflow exactly                                      | The route is a shell around the reused page without extra GM props. |
| 6   | The route should be treated as local-state-only or shared-state-only until code proves a GM-specific API-backed implementation exists | There is no GM route-level API binding in this file.                |
| 7   | Shared employee-loans workflow changes still affect GM operators and must be reflected here                                           | Reused implementation remains the behavioral baseline for GM.       |
| 8   | If GM later receives dedicated employee-loans APIs or route-level configuration, document the change here explicitly                  | This doc currently records a plain shell reuse pattern.             |
