# Clothing — Employees: Dashboard Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/dashboard/page.tsx`
> - `src/app/clothing/employees/dashboard/hooks/useEmployeeDashboard.ts`
> - `src/lib/employees/dashboard/buildEmployeeDashboard.ts` (shared by the Clothing and GM dashboard APIs)
> - `src/lib/employees/dashboard/types.ts`

---

## A — Page Layout & View Modes

| #   | Logic                                        | Explanation                                                                                             |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | Three view modes: day, month (default), year | `viewMode` defaults to `'month'`. Each mode determines the date range sent to the API.                  |
| 2   | Date input changes depend on view mode       | Day mode: shows a single date picker. Month mode: shows a month picker. Year mode: shows a year picker. |
| 3   | Range label is displayed in the UI           | Shows `'MMMM D, YYYY'` for single-day, or `'{start} – {end}'` for multi-day ranges.                     |

---

## B — Date Range Computation

| #   | Logic                                           | Explanation                                    |
| --- | ----------------------------------------------- | ---------------------------------------------- |
| 4   | Day mode: `from` and `to` are the same date     | `{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }`.    |
| 5   | Month mode: range spans the full calendar month | `startOf('month')` to `endOf('month')`.        |
| 6   | Year mode: range spans the full calendar year   | `startOf('year')` to `endOf('year')`.          |
| 7   | Default on load: current month range            | `defaultDay.startOf('month')` to `defaultDay`. |

---

## C — Data Fetching

| #   | Logic                                                                         | Explanation                                                                               |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 8   | Dashboard data is fetched from `GET /employees/dashboard?from={from}&to={to}` | `fetchData` is called whenever `range` changes.                                           |
| 9   | Loading state is managed locally                                              | `loading` is set while the request is in-flight; `error` stores any error message.        |
| 10  | Error state shows the error message                                           | `error` is set from `err.message` or `'Failed to load metrics'` if not an Error instance. |

---

## D — Metrics Displayed

| #   | Logic                                                                                                                                        | Explanation                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Attendance: records, unique employees, status counts, total/average hours, attendance rate, trend                                            | Attendance rate = (present + late) / all records. Trend is per day for ranges up to 31 days, per month otherwise (hidden in Daily view).                                                                                     |
| 12  | Payroll: gross, net, deductions, runs processed, status counts, earnings/deductions breakdown, trend                                         | Includes payrolls whose `periodStart` is in range. Breakdown shows basic, allowance, overtime, bonuses, SSS, PhilHealth, Pag-IBIG, tax, loans, LWOP, absences/lates and cash-advance deductions.                             |
| 13  | Leaves: requests, total days, status counts, breakdown by type, first 10 requests                                                            | Requests overlapping the range; `totalDays` sums each request's `numberOfDays`.                                                                                                                                              |
| 14  | Cash advances: requested in range, request counts/statuses, all open balances                                                                | Requests use `requestDate` (or `createdAt` when no request date). `outstandingBalance` and the open-balances table cover every non-settled, non-rejected advance with a remaining balance, regardless of the selected range. |
| 15  | 13th Month metrics: total records, total accrued, total paid, status counts                                                                  | Records whose `year` falls within the range; the UI also shows unpaid amount and paid %.                                                                                                                                     |
| 16  | Team: active count, headcount on file, new hires, separations, status/employment-type counts, active headcount by department, hires in range | Separations count `employmentEndDate` within the range.                                                                                                                                                                      |
| 17  | No business expenses are shown                                                                                                               | Expenses belong to Accounting; the employee dashboard does not query or display them.                                                                                                                                        |
| 17a | Team members table                                                                                                                           | Active employees plus anyone with attendance, payroll or an open cash advance: present/late/absent/leave days, hours, net pay, cash-advance balance.                                                                         |
| 17b | Soft-deleted records are excluded                                                                                                            | Every dashboard query filters `deletedAt: null` where the model supports it.                                                                                                                                                 |

---

## E — Interactions

| #   | Logic                                                                                    | Explanation                                                                          |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 18  | Changing view mode recalculates the range from the currently selected date for that mode | `handleViewModeChange` calls `computeRange(mode, selectedDate/Month/Year)`.          |
| 19  | Changing the date picker updates both the selection and the range                        | Each date change handler calls `computeRange` and `setRange`, triggering a re-fetch. |
| 20  | Manual refresh button calls `refetch`                                                    | `actions.refetch()` re-fetches data for the current `range`.                         |
