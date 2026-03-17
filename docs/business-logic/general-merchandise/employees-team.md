# General Merchandise — Employees Team Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/team/page.tsx`
> - `src/app/general-merchandise/employees/team/[id]/page.tsx`

---

## A — Route Surface

| #   | Logic                                                                               | Explanation                                               |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | The GM team directory lives at `/general-merchandise/employees/team`                | This is the main employee-list route for GM employees.    |
| 2   | The employee detail workflow lives under `/general-merchandise/employees/team/[id]` | Employee detail is part of the same team workflow family. |

---

## B — Shared Directory Workflow Baseline

| #   | Logic                                                                   | Explanation                                                                                             |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 3   | The GM team directory reuses the Clothing employees team page component | The route imports `EmployeesTeamPage` from the Clothing employees area.                                 |
| 4   | The route renders inside the GM employees shell                         | `renderGmEmployeesPage` wraps the team page.                                                            |
| 5   | The shared team page uses the GM API namespace                          | The route passes `apiBasePath="/api/general-merchandise"`.                                              |
| 6   | The shared team page also uses the GM business path                     | The route passes `businessPath="/general-merchandise"` so downstream links stay in the GM route family. |

---

## C — Shared Employee Detail Workflow Baseline

| #   | Logic                                                                                                                               | Explanation                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 7   | The GM employee detail page reuses the Clothing employee-detail component                                                           | The route imports `EmployeeDetailPage` from the Clothing team detail route.                               |
| 8   | The detail page runs inside the GM employees shell                                                                                  | The detail route also uses `renderGmEmployeesPage`.                                                       |
| 9   | The detail page uses the GM API namespace and GM business path                                                                      | The route passes both `apiBasePath="/api/general-merchandise"` and `businessPath="/general-merchandise"`. |
| 10  | Team list and employee detail therefore follow the shared employee-management workflow unless GM-specific divergence is added later | Current GM behavior is route-shell parity with GM path/API binding.                                       |

---

## D — Documentation Notes

| #   | Logic                                                                                                      | Explanation                                                          |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| 11  | Shared employee-team behavior changes still affect GM and must be reflected here                           | Shared implementation remains the behavioral baseline for GM.        |
| 12  | If GM gets unique employee fields, approvals, tabs, or detail actions later, document them here explicitly | This doc currently records route-shell parity plus GM route binding. |
