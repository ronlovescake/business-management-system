# Clothing — Due Dates Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/due-dates/hooks/useDueDatesPage.ts`
> - `src/modules/clothing/operations/due-dates/hooks/useDueDateData.ts`
> - `src/modules/clothing/operations/due-dates/services/DueDateService.ts`
> - `src/modules/clothing/operations/due-dates/components/DueDatesPage.tsx`
> - `src/modules/clothing/operations/due-dates/components/DueDatesTable.tsx`
> - `src/modules/clothing/operations/due-dates/components/DueDateOrderRow.tsx`
> - `src/modules/clothing/operations/due-dates/components/DueDatesSummary.tsx`
> - `src/modules/clothing/operations/due-dates/components/DueDatesToolbar.tsx`
> - `src/modules/clothing/operations/due-dates/components/DueDateStatsBadges.tsx`

---

## A — Page Layout

| #   | Logic                                                                                                                                          | Explanation                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The Due Dates page consists of a toolbar at the top and a full-height data table below                                                         | No tabs — one continuous layout. The `DueDatesPage` wraps `DueDatesToolbar` and a `StandardTableContainer` in a `Stack`.                                                     |
| 2   | Loading state renders the toolbar and an empty table body with "Loading due dates…"                                                            | While `isLoading` is `true`, `DueDatesPage` renders the full toolbar (with search and stats badges) but passes an empty rows list to the table with the loading placeholder. |
| 3   | The table has 10 fixed columns: CUSTOMER, PRODUCT CODE, QUANTITY, UNIT PRICE, LINE TOTAL, INVOICE DATE, DUE DATE, DUE IN, NOTES, CONTACT BUYER | Defined as `HEADERS` constant in `useDueDatesPage`.                                                                                                                          |
| 4   | The summary bar shows the filtered-to-total count                                                                                              | `DueDatesSummary` renders: "Showing {filteredCount} of {totalCount} due dates" in dimmed text at the bottom of the container.                                                |

---

## B — Data Loading

| #   | Logic                                                                         | Explanation                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 5   | Transactions are loaded via the shared `useTransactionData` abstraction       | `useDueDateData` delegates to `useTransactionData` using the default Clothing transaction query key. No separate API endpoint — due dates are derived from the existing transactions feed.                                                     |
| 6   | Only "Prepared" transactions qualify for the due dates list                   | `DueDateService.processDueDateItems` filters to transactions where `Order Status === 'Prepared'` AND `Invoice Date` is non-blank AND `Line Total > 0`.                                                                                         |
| 7   | Transactions are grouped by customer name                                     | Within `processDueDateItems`, a `Map<customerName, { lineTotal, invoiceDate, count }>` aggregates all qualifying lines per customer. `lineTotal` values are summed; the earliest invoice date is kept if the same customer has multiple lines. |
| 8   | Customer Facebook links are loaded in a parallel query                        | `useDueDatesPage` runs a second `useQuery` against `GET /customers` with `staleTime: 10 * 60 * 1000` (10 minutes). The response is used to build a case-insensitive map of customer names → Facebook URLs.                                     |
| 9   | Facebook map handles both plain name and "Name \| Business Name" combined key | For each customer that has a Business Name, `customerFacebookMap` stores a second entry keyed as `"customerName                                                                                                                                | businessName"` (lowercased), so both lookup patterns resolve correctly. |

---

## C — Due Date Calculation

| #   | Logic                                                     | Explanation                                                                                                                                                                     |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Due date = Invoice Date + exactly 72 hours                | `DueDateService.calculateDueDate` parses the invoice date string into a `Date` object and adds `72 × 60 × 60 × 1000` milliseconds. Returns ISO string.                          |
| 11  | Both ISO timestamps and legacy date strings are supported | `new Date(invoiceDate)` handles ISO format (`2025-11-07T00:00:00.000Z`) and the legacy human format ("November 7, 2025") because the browser's `Date` constructor accepts both. |
| 12  | Invalid or blank invoice date returns an empty string     | `calculateDueDate` catches parsing errors and returns `''`; such items display a blank Due Date and a 0 "Due In" value.                                                         |
| 13  | "Due In" is expressed in whole hours                      | `calculateHoursUntilDue` computes `(dueDate − now) / (1000 × 60 × 60)` and rounds to the nearest whole number. Negative values mean the due date is in the past (overdue).      |

---

## D — Stats Badges

| #   | Logic                                                                      | Explanation                                                                                                                                              |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Three stats badges are shown in the toolbar: Overdue, Due Soon, On Track   | `DueDateStatsBadges` renders three Mantine light-variant `Badge` components side by side.                                                                |
| 15  | Overdue badge (red) counts items where dueIn < 0                           | `stats.overdue` = number of customers whose due date has already passed.                                                                                 |
| 16  | Due Soon badge (orange) counts items where dueIn is 0–168 hours (0–7 days) | `stats.dueSoon` = customers with 0 ≤ dueIn ≤ 168.                                                                                                        |
| 17  | On Track badge (green) counts items where dueIn > 168 hours                | `stats.onTrack` = customers more than 7 days from their due date.                                                                                        |
| 18  | Stats are computed via `DueDateService.calculateStats`                     | The method iterates all `dueDateItems` (pre-filter) to count each bucket. Stats always reflect the full unfiltered list, not the search-filtered subset. |

---

## E — Search & Filtering

| #   | Logic                                                                  | Explanation                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 19  | A search input in the toolbar filters by customer name or product code | `DueDatesToolbar` embeds `StandardTableControls` with `searchPlaceholder="Search by customer or product code…"`. The toolbar hides Import, Export, and Add New buttons (`hideImport`, `hideExport`, `hideAddNew` all `true`). |
| 20  | Search is case-insensitive substring match                             | `DueDateService.filterDueDateItems` lowercases both the query and `item.customer`/`item.productCode` before comparing.                                                                                                        |
| 21  | Empty search returns all items                                         | When `searchQuery === ''`, no filtering is applied and all `dueDateItems` are returned.                                                                                                                                       |
| 22  | Empty state message is context-aware                                   | If a search is active: "No due dates match '{query}'." Otherwise: "No due dates found matching your criteria".                                                                                                                |

---

## F — Table Row Rendering (Grouped by Customer)

| #   | Logic                                                                                                                                             | Explanation                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23  | Each customer group spans multiple rows via `rowSpan`                                                                                             | `DueDatesTable` iterates `filteredItems` and calls `getCustomerOrders(item.customer)` to get the individual transaction rows for that customer. The CUSTOMER column cell uses `rowSpan={customerOrders.length}` so it merges all the customer's rows. |
| 24  | Customer groups are visually separated by a spacer row                                                                                            | Between each customer group, a `Table.Tr` with height `20px` and no visible borders is inserted. This is not inserted after the last group.                                                                                                           |
| 25  | Individual order rows show: Product Code, Quantity (formatted), Unit Price (currency), Line Total (bold, currency), Invoice Date, Due Date, Notes | All formatting uses `DueDateService.formatCurrency` and `DueDateService.formatDate`.                                                                                                                                                                  |
| 26  | The Due In cell shows a color-coded Mantine `Badge`                                                                                               | Red ("variant=light", color "red") if `dueInHours < 0`; orange if `0 ≤ dueInHours ≤ 168`; green if `dueInHours > 168`. The badge label is: "Due now" when `dueInHours === 0`, otherwise "{N} hour(s)" using the absolute value.                       |
| 27  | Notes cell shows the raw notes text or "–" if empty                                                                                               | Long notes are clamped to 1 line (`lineClamp={1}`).                                                                                                                                                                                                   |

---

## G — Contact Buyer Column

| #   | Logic                                                                                               | Explanation                                                                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 28  | The CONTACT BUYER cell merges across all rows of the customer group (rowSpan)                       | Same `isFirstInGroup` guard as the CUSTOMER column, so the buttons appear once per customer.                                                                |
| 29  | "Send Message" button (blue `IconMessage`) is always shown                                          | Clicking the `ActionIcon` is currently wired but has no active handler — the tooltip reads "Send Message".                                                  |
| 30  | "View Facebook Profile" button (blue `IconBrandFacebook`) is only shown when a Facebook link exists | `facebookLink` is looked up via `getFacebookLink(customerName)`. If blank, the Facebook icon is not rendered at all.                                        |
| 31  | Facebook link opens in a new tab with `noopener noreferrer`                                         | The `ActionIcon` uses `component="a"`, `href={facebookLink}`, `target="_blank"`, `rel="noopener noreferrer"` — no JavaScript navigation, pure browser link. |
| 32  | Row derivation is memoized                                                                          | `DueDatesTable` is a `memo` component; the row array is computed inside a `useMemo` keyed on `filteredItems`, `getCustomerOrders`, and `getFacebookLink`.   |

---

## H — Shared Module Support (General Merchandise)

| #   | Logic                                                                                       | Explanation                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | The Due Dates module is shared between Clothing and General Merchandise                     | `DueDatesPage` accepts an optional `apiBasePath` prop. When `apiBasePath === '/api/general-merchandise'`, `useDueDatesPage` switches to `GeneralMerchandiseTransactionService` and uses a GM-specific query key. |
| 34  | Customer Facebook lookup path also switches per business                                    | The `customerLookupKey` used to fetch `/customers` is derived from `apiBasePath`. For GM, no base path is used; for Clothing, the Clothing base path is used.                                                    |
| 35  | All due date business logic (calculation, grouping, display) is identical across businesses | The service layer, bucket thresholds, and column definitions are the same regardless of the `apiBasePath` — only the data source changes.                                                                        |
