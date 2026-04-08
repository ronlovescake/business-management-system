# Trucking — Profitability Analytics

> **Source files:**
>
> - `src/app/trucking/analytics/profitability/page.tsx`
> - `src/app/api/trucking/analytics/profitability/route.ts`

---

## A — Data Inclusion Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Profitability only analyzes completed trips | The API explicitly filters to trips with `status='completed'`. Draft or otherwise incomplete trips do not contribute to profitability totals. |
| 2 | Profitability can be filtered by date range and customer | The analytics route accepts optional `startDate`, `endDate`, and `customerId` filters to narrow the trip set. |
| 3 | Expense aggregation is sourced only from trucking expense rows whose `sourceType='TRIP'` and whose `sourceId` matches the trip | Payroll-generated expense rows such as Driver Pay use `sourceType='PAYROLL'` and are excluded from this report. |
| 4 | Revenue comes from trip `grossRevenue` | Profitability treats the trip record as the revenue source and does not require an invoice to exist first. |

---

## B — Calculation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 5 | Trip-level expense total is the sum of grouped trip-linked expense rows | The report first computes an expense bucket per trip before calculating net profit. |
| 6 | Trip-level net profitability is `grossRevenue - expenseTotal` | This is the core formula the report uses to interpret trip performance. |
| 7 | Summary revenue is the sum of the included trips' `grossRevenue` | The report's revenue total is not derived from invoice totals or payment allocations. |
| 8 | Summary expenses are the sum of the grouped trip-linked expense totals | Only expense rows that satisfy the API grouping logic contribute to the expense total. |
| 9 | Summary net is `summaryRevenue - summaryExpenses` | The page-level summary rolls up the same trip-level math shown in the detailed rows. |

$$
	ext{Trip Net} = \text{grossRevenue} - \text{expenseTotal}
$$

$$
	ext{Summary Net} = \sum \text{grossRevenue} - \sum \text{expenseTotal}
$$

---

## C — Operator-Visible Output

| # | Logic | Explanation |
| --- | --- | --- |
| 10 | The page exposes summary totals and trip-level detail together | Operators see aggregate revenue, expense, and net figures while still being able to inspect individual trip rows. |
| 11 | Each trip row includes the minimum profitability interpretation set | Returned row fields include trip ID, date, destination, customer, gross revenue, and expense total. |
| 12 | Profitability is intended as a per-trip operational analytics surface | The page is built for trip review and margin visibility rather than as a generalized accounting ledger. |

---

## D — Important Caveats

| # | Logic | Explanation |
| --- | --- | --- |
| 13 | Profitability only consumes TRIP-sourced expense rows that exist in the trucking expense ledger | Trip header cost fields matter to profitability once the finalize workflow materializes them into `TruckingExpense` rows with `sourceType='TRIP'`; payroll-derived `PAYROLL` rows are still excluded. |
| 14 | Trips without `customerId` can still appear in the dataset | Customer linkage is optional in the trip model, so some rows may be operationally complete without a customer assignment. |
| 15 | This report is trucking-specific, not a shared multi-domain profitability abstraction | The route, filters, and formulas are tied to trucking trip and expense entities. |