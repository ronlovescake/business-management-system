# Clothing — Business Intelligence Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/bi/hooks/useBusinessIntelligence.ts`
> - `src/modules/clothing/operations/bi/components/BiDashboard.tsx`
> - `src/modules/clothing/operations/bi/constants/constants.ts`
> - `src/modules/clothing/operations/bi/types/types.ts`

---

## A — Date Filter

| #   | Logic                                                                                                    | Explanation                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Seven date filters are available: YTD, MTD, Last 7 Days, Last 30 Days, Last 3 Months, Last 6 Months, All | `dateFilter` state holds one of: `ytd`, `mtd`, `last7days`, `last30days`, `last3months`, `last6months`, `all`.                                                                 |
| 2   | The date filter is a Mantine `Select` with a fixed width of 220px                                        | The select is rendered in the `BiDashboard` header. Changing the value immediately re-derives all computed metrics.                                                            |
| 3   | Filter defaults to `mtd` on mount                                                                        | Initial state is `'mtd'` (current month to date).                                                                                                                              |
| 4   | `getDateRange` converts the filter key to a `{ start, end }` range                                       | For `ytd`: Jan 1 of current year → today. `mtd`: 1st of current month → today. `last7days`: today minus 7 days. `all`: no date constraint (start/end are far-past/far-future). |
| 5   | All metric computations filter raw data through `getDateRange`                                           | When the filter changes, all `useMemo` metric values recompute automatically because they depend on `dateFilter` + raw query data.                                             |

---

## B — Data Fetching

| #   | Logic                                                                     | Explanation                                                                                                                               |
| --- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Three `useQuery` calls run in parallel: transactions, products, shipments | Each query has `staleTime: 30 * 1000` (30 seconds) and `refetchOnWindowFocus: true`.                                                      |
| 7   | Transactions are fetched from `/api/bi/transactions`                      | Returns all transaction line items with date, revenue, COGS, customer, and product info.                                                  |
| 8   | Products are fetched from `/api/bi/products`                              | Returns product catalogue entries for cross-referencing in leaderboards.                                                                  |
| 9   | Shipments are fetched from `/api/bi/shipments`                            | Returns shipment records with CBM and sack counts used in logistic metrics.                                                               |
| 10  | Loading state shows a centred large `Loader`                              | While any of the three queries is loading, `BiDashboard` renders `<Center h={400}><Loader size="lg" /></Center>` in place of all content. |

---

## C — Summary Stat Cards

| #   | Logic                                                                                         | Explanation                                                                                         |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 11  | Six stat cards are displayed at the top of the page                                           | Cards (in order): YTD Revenue, MTD Revenue, Total Transactions, Total COGS, Total CBM, Total Sacks. |
| 12  | YTD Revenue is always computed using the full year to date, regardless of the selected filter | `ytdTotal` uses a hard-coded `ytd` range even when a different filter is selected.                  |
| 13  | MTD Revenue is always computed using the current month to date                                | Same pattern as YTD — pinned to `mtd` range independent of the filter.                              |
| 14  | Total Transactions counts individual line items within the filtered range                     | `transactionCount` is the length of filtered transaction records.                                   |
| 15  | Total COGS sums `cogs` fields across all filtered transaction lines                           | `totalCOGS` accumulates COGS from each filtered transaction.                                        |
| 16  | Total CBM and Total Sacks sum shipment-level values for the filtered range                    | `totalCBM` and `totalSacks` are derived from filtered shipments.                                    |

---

## D — Monthly Trend Charts

| #   | Logic                                                     | Explanation                                                                                                                                                             |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Monthly Trends data always covers all 12 months (Jan–Dec) | `monthlyTrends` iterates `MONTH_NAMES` (all 12) and for each month sums revenue and counts transactions from the raw data, using the full dataset regardless of filter. |
| 18  | Months with no data receive zeros, not nulls              | The reduce initialises each month to `{ revenue: 0, transactions: 0 }`, ensuring every month is always present on the chart axis.                                       |
| 19  | Monthly Revenue chart is a Recharts `LineChart`           | X-axis = month abbreviation; Y-axis = revenue. A single `Line` traces revenue across the year, with `Tooltip` and `CartesianGrid`.                                      |
| 20  | Monthly Transaction Count chart is a Recharts `AreaChart` | Same 12-month series, with a shaded `Area` for transaction count.                                                                                                       |

---

## E — Shipment Metrics Chart

| #   | Logic                                                                | Explanation                                                                                 |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 21  | Shipment chart is a Recharts `ComposedChart` with bars and two lines | The chart shows: `Bar` for CBM per month, `Line` for sack count, `Line` for shipment count. |
| 22  | Shipment data is grouped by month from the filtered shipments        | Each month bucket receives total CBM, sack count, and a shipment record count.              |

---

## F — Top Products Charts & Table

| #   | Logic                                                                       | Explanation                                                                                                |
| --- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 23  | Top 10 products are ranked by total `lineTotal` value in the filtered range | `topProducts` uses `Array.reduce` to aggregate by product ID, then sorts descending and slices the top 10. |
| 24  | Top Products bar chart is a Recharts `BarChart`                             | Horizontal bars ordered from highest to lowest value; each bar is labelled with the product name.          |
| 25  | Product Quantity chart is a Recharts `AreaChart`                            | An area trace for total units sold per product across the top 10.                                          |
| 26  | Products overview table lists all products by revenue                       | Columns: Product Name, Total Revenue, Qty Sold, COGS. Sorted by revenue descending.                        |

---

## G — Top Customers Charts & Table

| #   | Logic                                                              | Explanation                                                                                                  |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 27  | Top 10 customers are ranked by total revenue in the filtered range | `topCustomers` aggregates transaction revenue by customer ID, sorts descending, and slices top 10.           |
| 28  | Top Customers chart is a horizontal Recharts `BarChart`            | Customer names on the Y-axis; revenue on the X-axis.                                                         |
| 29  | Customer share chart is a Recharts `PieChart`                      | Shows the top 5 customers as pie slices with percentage labels; remaining customers are grouped as "Others". |
| 30  | Customers overview table lists all customers by revenue            | Columns: Customer Name, Total Revenue, Order Count. Sorted by revenue descending.                            |

---

## H — Shipments Table

| #   | Logic                                               | Explanation                                       |
| --- | --------------------------------------------------- | ------------------------------------------------- |
| 31  | Shipments table lists individual filtered shipments | Columns: Shipment Code, Date, CBM, Sacks, Status. |

---

## I — Error Handling

| #   | Logic                                  | Explanation                                                                                                                                                                  |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 32  | Query errors are logged to the console | Each query's `onError` callback calls `console.error` with the query name and error object. UI remains visible; no in-page error component is shown for data fetch failures. |
