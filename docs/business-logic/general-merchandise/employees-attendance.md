# General Merchandise — Employees Attendance Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/attendance/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                       | Explanation                                                         |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | The GM attendance page lives at `/general-merchandise/employees/attendance` | The route belongs to the GM employees family.                       |
| 2   | The route reuses the Clothing employees attendance page component           | The page imports `EmployeesAttendancePage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                             | `renderGmEmployeesPage` wraps the attendance page.                  |
| 4   | The attendance workflow uses the GM API namespace                           | The route passes `apiBasePath="/api/general-merchandise"`.          |

---

## B — Workflow Notes

| #   | Logic                                                                                                     | Explanation                                                                 |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 5   | GM attendance behavior currently follows the shared attendance workflow                                   | There is no GM-only attendance page logic in this route.                    |
| 6   | Shared attendance workflow changes still affect GM operators and must be reflected here                   | Shared implementation remains the behavioral baseline for GM.               |
| 7   | If GM receives custom attendance validation, summaries, or approvals later, document them here explicitly | This doc currently records route-shell parity plus GM API binding.          |
| 8   | The route remains GM-specific because it presents GM employee attendance data under GM URLs and GM APIs   | Shared UI does not make the workflow generic from the operator perspective. |
