# Clothing — Business Intelligence Business Logic

> **Source files:**
>
> - [Served BI hook](../../../src/app/clothing/operations/business-intelligence/hooks/useBusinessIntelligence.ts)
> - [Date filters and comparison ranges](../../../src/lib/analytics/periodComparison.ts)

---

## A — Date Filter

| #   | Logic                                                                                                    | Explanation                                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Seven date filters are available: YTD, MTD, Last 7 Days, Last 30 Days, Last 3 Months, Last 6 Months, All | `dateFilter` state holds one of: `ytd`, `mtd`, `last7days`, `last30days`, `last3months`, `last6months`, `all`.                                                                                                                                                                         |
| 2   | Changing the date filter recomputes the hook's metrics                                                   | The selected filter and loaded transaction, product and shipment arrays are metric dependencies.                                                                                                                                                                                       |
| 3   | Filter defaults to `ytd` on mount                                                                        | Initial state is year to date.                                                                                                                                                                                                                                                         |
| 4   | All filters exclude invalid and future records through now                                               | YTD starts Jan 1 and MTD the first of this month in Asia/Manila. Rolling day filters retain their elapsed-time windows; shifted-month starts use Manila. All Time removes only the lower bound. Date-only orders mean Manila midnight; timestamped events retain their actual instant. |
| 5   | Date scope depends on the metric                                                                         | Transactions and monthly shipment buckets use the selected filter. Product COGS and headline shipment totals use all loaded records; they are not period-matched ledger metrics.                                                                                                       |

---

## B — Data Fetching

| #   | Logic                                                               | Explanation                                                                                                                                                                              |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | `useQueries` loads transactions, products and shipments in parallel | The normal operational queries use a 30-second stale time.                                                                                                                               |
| 7   | Transactions use the configured `/transactions` API path            | Clothing uses `/api/transactions`, not a separate `/api/bi/transactions` feed.                                                                                                           |
| 8   | Products use the configured `/products` API path                    | The catalogue supplies product-level COGS values.                                                                                                                                        |
| 9   | Shipments use the configured `/shipments` API path                  | Shipment fields include Total CBM, No. Of Sacks and Date Created.                                                                                                                        |
| 10  | Accounting profit is a separate authorized query                    | ADMIN/SUPER_ADMIN can fetch `/accounting/profit-loss`, with a five-minute stale time and no automatic retry. Bounded query parameters run from the current comparison start through now. |

### Refunds And Financial Completeness

Clothing BI mounts the same dated refund-obligation summary as Transactions,
the header and the accounting dashboard. It shows approved pending amount,
order count/oldest age, actual approved refunds paid by month and approved
retained deposits separately. Pending includes older outstanding approvals even
when the activity window starts later; paid/retained activity uses the selected
event-date window. Approval is not cash paid. Customers remains the execution
surface and keeps actual payout history after the obligation is complete.

The authorized accounting profit snapshot additionally shows Forfeited Deposits
from P&L, including preserved dated legacy recognition, separately from operational
lost-order value and new approved retention. Unknown inventory valuation produces
the same Profit Incomplete movement/quantity notice as P&L. Operational Line Total
and catalogue COGS cards remain explicitly operational, not interchangeable with
the accounting profit snapshot. General merchandise retains its separate records
and existing refund workflow and does not query Clothing approval/valuation APIs.

---

## C — Summary Stat Cards

| #   | Logic                                                                     | Explanation                                                                                                                              |
| --- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | The hook exposes operational totals and an independent profit snapshot    | Operational totals are not automatically ledger revenue, realized profit or recognized COGS.                                             |
| 12  | The legacy `ytdTotal` name means revenue within the selected period       | Sum Line Total over period transactions excluding cancelled/forfeited/voided statuses. It is only YTD when YTD is selected.              |
| 13  | `mtdTotal` is the Manila current-month subset of selected transactions    | A narrower selected period can reduce it; it is not an independent pinned MTD query. Future records remain excluded, including All Time. |
| 14  | Total Transactions counts individual line items within the filtered range | `transactionCount` is the length of filtered transaction records.                                                                        |
| 15  | Total COGS sums the COGS fields of all loaded products                    | This is neither a quantity-weighted sales cost nor period-filtered transaction COGS.                                                     |
| 16  | Total CBM and Total Sacks sum all loaded shipments                        | Only the monthly shipment series below applies the selected date filter.                                                                 |

---

## D — Monthly Trend Charts

| #   | Logic                                                                       | Explanation                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | The monthly axis spans the selected window through the current Manila month | YTD starts January, MTD shows this month, rolling windows can include the previous year, and All Time starts at the earliest eligible transaction/shipment month. No future months are added. |
| 18  | Months with no data receive zeros, not nulls                                | The reduce initialises each month to `{ revenue: 0, transactions: 0 }`, ensuring every month is always present on the chart axis.                                                             |
| 19  | Monthly revenue sums eligible Line Total values                             | Cancelled/forfeited/voided rows do not contribute to the normal revenue series.                                                                                                               |
| 20  | Monthly transaction counts are line counts                                  | They are not distinct customer orders or invoices.                                                                                                                                            |

---

## E — Shipment Metrics Chart

| #   | Logic                                                         | Explanation                                                                           |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 21  | Monthly shipment buckets expose count, CBM and sacks          | Each shipment is grouped using Date Created, not delivery or accounting posting date. |
| 22  | Shipment data is grouped by month from the filtered shipments | Each month bucket receives total CBM, sack count, and a shipment record count.        |

---

## F — Top Products Charts & Table

| #   | Logic                                                    | Explanation                                                                                                                      |
| --- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 23  | Top 10 products are ranked by selected-period Line Total | Aggregation uses Product Code, not database product ID; blank codes are skipped.                                                 |
| 24  | Product totals combine value and quantity                | Sorting is by total value descending, then the list is limited to ten.                                                           |
| 25  | Product quantity sums the transaction Quantity field     | This is an operational line measure, not a stock movement reconciliation.                                                        |
| 26  | Period comparison uses the shared comparison ranges      | Prior-period checks retain their existing half-open boundaries; a future-date fix is not a change to that comparison convention. |

---

## G — Top Customers Charts & Table

| #   | Logic                                                               | Explanation                                                                                                                              |
| --- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | Top 10 customers are ranked by selected-period Line Total           | The leaderboard groups by the Customers display string, not customer ID, and skips blank names.                                          |
| 28  | Leaderboard orderCount counts transaction rows                      | This field is not a distinct invoice count.                                                                                              |
| 29  | Extended metrics normalize customer display names                   | New/returning classification uses first-order month from all active transactions. This differs from the raw-string leaderboard grouping. |
| 30  | Extended repeat customers require at least two distinct order dates | The extended metrics also expose quantity, adjustment, cancelled/lost revenue and pipeline stage values.                                 |

---

## H — Shipment Scope

| #   | Logic                                                                      | Explanation                                                                      |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 31  | The hook returns loaded products and shipments as well as computed metrics | Consumers must not assume those raw arrays are already selected-period filtered. |

---

## I — Error Handling

| #   | Logic                                                                            | Explanation                                                                                              |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 32  | Operational query errors are logged; profit exposes separate error/loading flags | These states do not establish completeness of the operational data or independent ledger reconciliation. |

Regression tests exercise the real shared date filter, including future records
for every option, and the actual BI hook's early-Manila-midnight totals, historical
All Time axis and P&L request cutoff. Month/weekday/customer-repeat-day grouping
uses Manila consistently. All Time P&L still sends an explicit `to` through now.
These checks do not certify the browser charts, every
accounting report basis, or consistency of historical business data.
