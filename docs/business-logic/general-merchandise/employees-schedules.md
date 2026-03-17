# General Merchandise — Employees Schedules Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/schedules/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                     | Explanation                                                        |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | The GM schedules page lives at `/general-merchandise/employees/schedules` | The route belongs to the GM employees family.                      |
| 2   | The route reuses the Clothing employees schedules page component          | The page imports `EmployeesSchedulesPage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                           | `renderGmEmployeesPage` wraps the schedules page.                  |
| 4   | The schedules workflow uses the GM API namespace                          | The route passes `apiBasePath="/api/general-merchandise"`.         |

---

## B — Workflow Notes

| #   | Logic                                                                                                               | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | GM schedules behavior currently follows the shared schedules workflow                                               | There is no GM-only schedules page logic in this route.            |
| 6   | Shared schedules workflow changes still affect GM operators and must be reflected here                              | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom scheduling rules, calendar constraints, or shift actions later, document them here explicitly | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM employee schedule data under GM URLs and GM APIs               | Shared UI does not remove the GM business context.                 |
