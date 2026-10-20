# Household Finance: Dashboard Business Logic

> **Source files:**
>
> - `src/app/personal/page.tsx`
> - `src/app/personal/dashboard/page.tsx`
> - `src/modules/household/dashboard/api/aggregations.ts`
> - `src/modules/household/dashboard/api/service.ts`
> - `src/app/api/household/dashboard/route.ts`

---

## A - Route Entry

| #   | Logic                                                                                        | Explanation                                                                            |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | `/personal` redirects to `/personal/dashboard`                                               | The root Household route is an entry route, not a standalone page.                     |
| 2   | Dashboard title is `Personal Dashboard`                                                      | The UI still uses `personal` naming, but this page is the Household dashboard surface. |
| 3   | Dashboard description states it is an overview of household finances, cash flow, and budgets | The page contract is overview-first rather than transaction entry.                     |

---

## B - Date Range And Summary

| #   | Logic                                                                                            | Explanation                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 4   | The date selector supports YTD, MTD, the last 7 or 30 days, the last 3 or 6 months, and all time | The selected range is sent to `/api/household/dashboard`; all-time deltas are unavailable.                                   |
| 5   | Summary values are aggregated server-side from narrow Prisma selects                             | Household dates are stored as strings, so date-range filtering and chart buckets are computed in Node.                       |
| 6   | Business dates use Asia/Manila                                                                   | The server clock is normalized through the shared Manila-aware date utility before range calculation.                        |
| 7   | Rejected expenses do not count toward spending or budget totals                                  | The service separately loads rejected recurring-generated rows so a rejected generated bill is not shown as still scheduled. |

## C - KPIs And Charts

| #   | Logic                                                                                            | Explanation                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 8   | The dashboard shows net worth, income, expenses, net cash flow, savings rate, and bills due soon | Period totals include comparison deltas when a previous period exists. Savings rate is null when income is zero.               |
| 9   | Net worth sums active asset balances and subtracts credit-card and loan balances                 | Liability balances are treated as negative regardless of their stored sign. Inactive accounts are excluded.                    |
| 10  | Income and expenses are charted over the selected period                                         | 7-day and 30-day ranges use daily points; other ranges use monthly points. All-time trends are capped to the latest 24 months. |
| 11  | Category spending shows totals and share for the selected period                                 | Rejected expenses are excluded; blank categories are grouped as `Uncategorized`.                                               |
| 12  | Budget comparison uses average YTD spending through the prior month as planned                   | Actual is current-month spending. A new year-to-date period has no prior-month average, so planned values are zero.            |
| 13  | Weekday spending groups selected-period expense amounts and counts                               | The chart always includes all seven weekdays, including days with no expenses.                                                 |

## D - Upcoming Bills

| #   | Logic                                                                              | Explanation                                                                                                                 |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 14  | Active recurring payments due from today through 30 days ahead are listed          | Monthly dates preserve the start day and clamp to the last valid day in short months; plans past `monthsCount` are omitted. |
| 15  | Generated pending, approved, and paid expenses determine a recurring bill's status | Without a generated expense, the status is `scheduled`; a rejected generated bill is omitted from the list.                 |
| 16  | Bills due soon totals/counts exclude paid bills                                    | The upcoming-bills table may still display a paid bill for visibility.                                                      |
| 17  | The dashboard is informational                                                     | It links to household pages but does not create, edit, or delete records.                                                   |
