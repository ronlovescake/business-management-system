# Clothing — Employees: Dashboard Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/dashboard/hooks/useEmployeeDashboard.ts`
> - `src/app/clothing/employees/dashboard/types.ts`

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

| #   | Logic                                                                                   | Explanation                                                                            |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 11  | Attendance metrics: total records, unique employees, status counts                      | `data.attendance.statusCounts` is a map of status → count.                             |
| 12  | Payroll metrics: total gross, total net, total deductions, total records, status counts | `data.payroll` includes aggregated financial totals for the period.                    |
| 13  | Leave metrics: total requests, status counts                                            | `data.leaves.statusCounts` maps `pending/approved/rejected` to counts.                 |
| 14  | Cash Advance metrics: total requested, outstanding balance, active count, status counts | `data.cashAdvance.outstandingBalance` is the sum of all non-settled approved advances. |
| 15  | 13th Month metrics: total records, total accrued, total paid, status counts             | `data.thirteenthMonth` shows progress across `pending/calculated/approved/paid`.       |
| 16  | Team metrics: headcount (active), new hires, department breakdown, status counts        | `data.team.newHires` counts employees hired within the date range.                     |
| 17  | Expenses metrics: total amount, category breakdown                                      | `data.expenses.categories` is an array of `{ category, amount }`.                      |

---

## E — Interactions

| #   | Logic                                                                                    | Explanation                                                                          |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 18  | Changing view mode recalculates the range from the currently selected date for that mode | `handleViewModeChange` calls `computeRange(mode, selectedDate/Month/Year)`.          |
| 19  | Changing the date picker updates both the selection and the range                        | Each date change handler calls `computeRange` and `setRange`, triggering a re-fetch. |
| 20  | Manual refresh button calls `refetch`                                                    | `actions.refetch()` re-fetches data for the current `range`.                         |
