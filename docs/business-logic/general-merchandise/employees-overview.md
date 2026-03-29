# General Merchandise - Employees Module Overview

This overview indexes the business logic documentation files for the **General Merchandise > Employees** module.

> **Source root:** `src/app/general-merchandise/employees/`
> **Docs root:** `docs/business-logic/general-merchandise/`

---

## Module Index

| Module         | Doc File                                                   | Rules | Description                                                                                                                  |
| -------------- | ---------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------- |
| Dashboard      | [employees-dashboard.md](employees-dashboard.md)           | 8     | Shared dashboard workflow rendered under the GM employees route shell with GM API namespace.                                 |
| Team           | [employees-team.md](employees-team.md)                     | 10    | Shared team directory and employee detail workflow under GM routes, including profile photo upload and related-history tabs. |
| Attendance     | [employees-attendance.md](employees-attendance.md)         | 8     | Shared attendance workflow using GM API namespace.                                                                           |
| Schedules      | [employees-schedules.md](employees-schedules.md)           | 8     | Shared schedules workflow using GM API namespace.                                                                            |
| Leave Tracker  | [employees-leave-tracker.md](employees-leave-tracker.md)   | 8     | Shared leave-tracker workflow using GM API namespace.                                                                        |
| Payroll        | [employees-payroll.md](employees-payroll.md)               | 8     | Shared payroll workflow using GM API namespace and shared payroll logic.                                                     |
| Cash Advance   | [employees-cash-advance.md](employees-cash-advance.md)     | 8     | Shared cash-advance workflow using GM API namespace.                                                                         |
| Employee Loans | [employees-employee-loans.md](employees-employee-loans.md) | 8     | Shared local-state-only employee-loans workflow rendered under GM routes.                                                    |
| 13th Month Pay | [employees-13th-month-pay.md](employees-13th-month-pay.md) | 8     | Shared 13th month pay workflow using GM API namespace.                                                                       |
| Settings       | [employees-settings.md](employees-settings.md)             | 8     | Shared employees settings workflow using GM API namespace.                                                                   |
| Expenses       | [employees-expenses.md](employees-expenses.md)             | 4     | Redirect-only page from GM Employees to GM Accounting expenses.                                                              |
| Notifications  | [employees-notifications.md](employees-notifications.md)   | 7     | Empty-shell notifications placeholder rendered under the GM employees shell.                                                 |
| Calendar       | [employees-calendar.md](employees-calendar.md)             | 7     | Empty-shell calendar placeholder rendered under the GM employees shell.                                                      |

---

## Key Technical Notes

- `/general-merchandise/employees` redirects to `/general-merchandise/employees/dashboard`.
- Most GM Employees pages render the same shared or Clothing-backed page components used by Clothing, but with GM route paths and `apiBasePath="/api/general-merchandise"` where applicable.
- `/general-merchandise/employees/team/[id]` uses the same shared employee detail workflow as Clothing but within the GM employees route shell.
- GM employee loans remain a local-state-only workflow because the route imports the same page used by Clothing and does not inject a GM API namespace.
- `/general-merchandise/employees/expenses` is a redirect shell and should stay documented as redirect-only unless it becomes a real employees-owned page.
