# General Merchandise — Employees Settings Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/employees/settings/page.tsx`

---

## A — Route & Shared Baseline

| #   | Logic                                                                             | Explanation                                                       |
| --- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | The GM employees settings page lives at `/general-merchandise/employees/settings` | The route belongs to the GM employees family.                     |
| 2   | The route reuses the Clothing employees settings page component                   | The page imports `EmployeesSettingsPage` from Clothing employees. |
| 3   | The route renders inside the GM employees shell                                   | `renderGmEmployeesPage` wraps the settings page.                  |
| 4   | The settings workflow uses the GM API namespace                                   | The route passes `apiBasePath="/api/general-merchandise"`.        |

---

## B — Workflow Notes

| #   | Logic                                                                                                         | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | GM employees settings behavior currently follows the shared employees settings workflow                       | There is no GM-only settings page logic in this route.             |
| 6   | Shared employees settings workflow changes still affect GM operators and must be reflected here               | Shared implementation remains the behavioral baseline for GM.      |
| 7   | If GM receives custom employee settings toggles, defaults, or validation later, document them here explicitly | This doc currently records route-shell parity plus GM API binding. |
| 8   | The route remains GM-specific because it presents GM employee settings under GM URLs and GM APIs              | Shared UI does not remove the GM business context.                 |
