# Clothing - Employees Module Overview

This overview indexes the business logic documentation files for the **Clothing > Employees** module.

> **Source root:** `src/app/clothing/employees/`
> **Docs root:** `docs/business-logic/clothing/`

---

## Module Index

| Module         | Doc File                                                   | Rules | Description                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team           | [employees-team.md](employees-team.md)                     | 48    | Employee directory plus employee detail workflow: add/edit/delete, server-side filters, detail categories, related-history tabs, salary timeline, and profile photo upload.                                                     |
| Attendance     | [employees-attendance.md](employees-attendance.md)         | 56    | Daily attendance tracking: check-in/out, status modes (Present, Absent, Leave, Holiday, Overtime), LWOP calculation, bulk actions, overtime processing.                                                                         |
| Schedules      | [employees-schedules.md](employees-schedules.md)           | 40    | Work schedule management: assign schedules to employees, shift definitions, rest days, schedule conflict detection.                                                                                                             |
| Leave Tracker  | [employees-leave-tracker.md](employees-leave-tracker.md)   | 42    | Leave request lifecycle: submit, approve, reject, cancel; leave type balances; attendance impact.                                                                                                                               |
| Dashboard      | [employees-dashboard.md](employees-dashboard.md)           | 20    | Summary metrics across all employee sub-modules: attendance, payroll, leaves, cash advances, 13th month pay, team, expenses; view modes (day/month/year).                                                                       |
| Payroll        | [employees-payroll.md](employees-payroll.md)               | 83    | Full payroll lifecycle: generation (period picker), formulas (grossPay/deductions/netPay), approval, payslip ZIP download, bulk approve, mark as paid, LWOP sync, CSV import/export; all SweetAlert2 dialogs documented.        |
| Cash Advance   | [employees-cash-advance.md](employees-cash-advance.md)     | 43    | Cash advance requests: pending/approved/rejected/paid lifecycle, auto-paid on zero balance, monthly payment formula, optimistic updates, reject via native `prompt()`, delete via SweetAlert2.                                  |
| Employee Loans | [employees-employee-loans.md](employees-employee-loans.md) | 43    | **LOCAL STATE ONLY (no persistence).** Loan lifecycle: pending/approved/active/completed/rejected; amortisation formula; approve/reject/activate/complete/delete; native `confirm()` and `prompt()` dialogs; CSV import/export. |
| 13th Month Pay | [employees-13th-month-pay.md](employees-13th-month-pay.md) | 44    | Multi-source aggregation from payroll records; `monthsWorked` as a `Set<number>`; locking on approve/paid; SweetAlert2 confirm for approve and mark-as-paid; payroll-driven auto-sync.                                          |
| Settings       | [employees-settings.md](employees-settings.md)             | 20    | Stay-in attendance automation: enable/disable toggle, scheduled time, timezone, grace minutes; delta `PUT` save; "Run Now" `POST` with result summary; inline Mantine Alert feedback.                                           |
| Notifications  | [employees-notifications.md](employees-notifications.md)   | —     | **Empty shell.** Not yet implemented.                                                                                                                                                                                           |
| Calendar       | [employees-calendar.md](employees-calendar.md)             | —     | **Empty shell.** Not yet implemented.                                                                                                                                                                                           |
| Expenses       | [employees-expenses.md](employees-expenses.md)             | 2     | Redirect stub — immediately redirects to `/clothing/accounting`. No expense data is managed within this module.                                                                                                                 |

---

## Key Technical Notes

- **Payroll formulas:** `grossPay = basicSalary + allowance + overtime + bonuses + thirteenthMonth`; `totalDeductions = sss + philHealth + pagIbig + tax + loans + cashAdvance + lwop + absentsLates`; `netPay = max(0, grossPay - totalDeductions)`
- **13th month formula:** `netBasicSalary / monthsWorked` where `monthsWorked = Set<number>.size` (clamped 1–12); records lock on approval
- **Cash advance auto-paid:** `useEffect` marks `status = 'paid'` when `remainingBalance <= 0.01`
- **Employee loans:** `useState([])` — data is NOT persisted; lost on page refresh
- **Payroll–13th month sync:** marking payroll as paid auto-syncs the linked 13th month record via PATCH to `/thirteenth-month-pay/{employeeId}-{year}/status`
- **Settings delta update:** `PUT /employee-automation-settings` sends only changed fields
