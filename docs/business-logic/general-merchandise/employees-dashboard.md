# General Merchandise — Employees Dashboard Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/page.tsx`
> - `src/app/general-merchandise/employees/dashboard/page.tsx`

---

## A — Route Entry

| #   | Logic                                                                                                | Explanation                                                                     |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 1   | `/general-merchandise/employees` immediately redirects to `/general-merchandise/employees/dashboard` | The employees root route is only an entry redirect, not its own dashboard page. |
| 2   | The GM dashboard page lives at `/general-merchandise/employees/dashboard`                            | The dashboard is the first real GM employees route.                             |

---

## B — Shared Workflow Baseline

| #   | Logic                                                                                                                                 | Explanation                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 3   | The GM dashboard reuses the Clothing employees dashboard page component                                                               | The route imports `EmployeesDashboard` from the Clothing employees route.                      |
| 4   | The route renders inside the GM employees shell                                                                                       | `renderGmEmployeesPage` wraps the dashboard so it is presented as a GM employees page.         |
| 5   | The dashboard uses the GM API namespace                                                                                               | The route passes `apiBasePath="/api/general-merchandise"` into the shared dashboard component. |
| 6   | The visible dashboard workflow therefore follows the shared employees dashboard behavior unless GM-specific divergence is added later | The GM route is a shell around the existing dashboard workflow.                                |

---

## C — Documentation Notes

| #   | Logic                                                                                                             | Explanation                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 7   | Shared dashboard behavior changes still affect GM operators and must be reflected here                            | Shared implementation remains the behavioral baseline for GM.            |
| 8   | If the GM dashboard receives custom widgets, metrics, or route-level actions later, document them here explicitly | This doc currently records route-shell parity plus the GM API namespace. |
