# Trucking — Employees Overview

This file maps the **Trucking Employees** workflow surface and how it overlaps with shared employee logic.

> **Primary route roots:** `src/app/trucking/employees/**`
>
> **Primary module roots:** `src/modules/trucking/employees/**`, `src/modules/shared/employees/**`
>
> **Supporting payroll root:** `src/lib/payroll/trucking/**`

---

## Current Employees Surface

| Area | Current Routes | Notes |
| --- | --- | --- |
| Dashboard | `src/app/trucking/employees/dashboard/page.tsx` | Trucking employee summary and KPI surface. |
| Team | `src/app/trucking/employees/team/**` | Employee directory and detail workflow for trucking. |
| Attendance | `src/app/trucking/employees/attendance/page.tsx` | Attendance tracking with trucking-specific route surface. |
| Schedules | `src/app/trucking/employees/schedules/page.tsx` | Scheduling workflow backed by shared employee logic. |
| Payroll | `src/app/trucking/employees/payroll/page.tsx` | Trucking payroll flow using trucking deduction logic and shared patterns. |
| Leave tracker | `src/app/trucking/employees/leave-tracker/page.tsx` | Leave tracking and balance workflow. |
| Cash advance | `src/app/trucking/employees/cash-advance/page.tsx` | Cash-advance workflow with shared service-base behavior. |
| 13th month pay | `src/app/trucking/employees/thirteenth-month-pay/page.tsx` | Aggregation and payout workflow for trucking employees. |
| Expenses | `src/app/trucking/employees/expenses/page.tsx` | Employee-linked trucking expenses workflow. |
| Employee loans | `src/app/trucking/employees/employee-loans/page.tsx` | Trucking employee loans route surface. |
| Notifications | `src/app/trucking/employees/notifications/page.tsx` | Route exists and should be documented for actual current behavior or scaffold status. |
| Calendar | `src/app/trucking/employees/calendar/page.tsx` | Route exists and should be documented for actual current behavior or scaffold status. |
| Employee trips | `src/app/trucking/employees/trips/page.tsx` | Trucking-specific employee trip surface not present in the other employee domains. |
| Settings | `src/app/trucking/employees/settings/page.tsx` | Trucking stay-in / automation settings route. |

---

## Shared Logic Notes

1. Trucking employees reuse shared employee route factories and service bases in `src/modules/shared/employees/**` for several workflows.
2. Trucking payroll still has its own deduction engine and domain-specific payroll logic even when UI patterns are shared.
3. This folder should document the **trucking route behavior** first, then cite shared implementation roots where they materially explain the behavior.

---

## Documentation Expansion Targets

- `employees-attendance.md`
- `employees-schedules.md`
- `employees-payroll.md`
- `employees-leave-tracker.md`
- `employees-cash-advance.md`
- `employees-team.md`
- `employees-expenses.md`
- `employees-trips.md`
- `employees-settings.md`