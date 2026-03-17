# Clothing — Dispatch Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/dispatch/components/DispatchComponent.tsx`
> - `src/modules/clothing/operations/dispatch/hooks/useDispatchData.ts`
> - `src/modules/clothing/operations/dispatch/hooks/useDispatchActions.ts`
> - `src/modules/clothing/operations/dispatch/hooks/usePossibleMatches.ts`
> - `src/modules/clothing/operations/dispatch/hooks/useDispatchImport.ts`
> - `src/modules/clothing/operations/dispatch/hooks/useDispatchCustomerLookup.ts`
> - `src/modules/clothing/operations/dispatch/hooks/useClipboard.ts`
> - `src/app/api/dispatch/orders/route.ts`

---

## A — Page Layout & Tabs

| #   | Logic                                                                                   | Explanation                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Five tabs are shown: Match, Possible Match, Checkout Update, Recently Updated, Raw Data | Active tab defaults to `'match'` on load.                                                                                                                  |
| 2   | KPI cards are shown above the tabs                                                      | Four cards: Total Orders, Filtered, Completed, Unmatched.                                                                                                  |
| 3   | Each searchable tab maintains its own search query                                      | `tabSearchQueries` keeps independent search values for `match`, `checkout-update`, and `recently-updated`. Switching tabs restores the query for that tab. |
| 4   | Switching to a non-searchable tab clears the active search                              | `handleTabChange` calls `setSearchQuery('')` when the active tab is `possible-match` or `raw-data`.                                                        |
| 5   | Status filter and date range filter are available                                       | `statusFilter` and `dateRangeFilter` further narrow displayed rows within tabs.                                                                            |

---

## B — Data Loading & Persistence

| #   | Logic                                                                            | Explanation                                                                                                                                    |
| --- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | Dispatch orders are loaded from the database on mount                            | `useQuery(['dispatch-orders'])` fetches `GET /api/dispatch/orders` with `staleTime: 5 * 60 * 1000` (fresh for 5 minutes).                      |
| 7   | Imported XLSX data can be used before a save                                     | `rawData` local state is set immediately after XLSX parsing for local display; the save mutation then persists to the DB.                      |
| 8   | `effectiveRawData` is the merge of saved and unsaved import                      | If `rawData` state is populated it takes precedence; otherwise `savedOrders` from the query is used.                                           |
| 9   | Transactions are loaded in parallel for line-total calculations                  | `useQuery(['transactions', 'dispatch'])` fetches all transactions with `staleTime: 60 * 1000`. Used to compute `preparedLineTotalsByCustomer`. |
| 10  | `preparedLineTotalsByCustomer` maps customer → sum of prepared order line totals | Only transactions with status `prepared` (after normalisation) contribute to this map.                                                         |
| 11  | Customer updates broadcast across the app trigger a customer data refetch        | `BroadcastChannel('customer-updates')` listener calls `refetch()` when `'customer-updated'` message is received.                               |

---

## C — Bulk "Update Shipped Orders" Action

| #   | Logic                                                                     | Explanation                                                                                                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | "Add New" in the Checkout Update tab triggers the bulk update flow        | `handleAddNew` detects `activeTab === 'checkout-update'` and calls `handleUpdateShippedOrders`.                                                     |
| 13  | Only orders shipped within the last 24 hours are targeted                 | `handleUpdateShippedOrders` computes `cutoff = now − 24 × 60 × 60 × 1000`. Shipped orders older than 24 hours are excluded.                         |
| 14  | If no orders shipped in last 24 hours → info SweetAlert, no action        | `Swal.fire({ title: 'No Recent Orders', icon: 'info' })`.                                                                                           |
| 15  | If no customers matched to recent orders → warning SweetAlert, no action  | `Swal.fire({ title: 'No Matched Customers', icon: 'warning' })`.                                                                                    |
| 16  | If no transactions found for those customers → info SweetAlert, no action | `Swal.fire({ title: 'No Transactions Found', icon: 'info' })`.                                                                                      |
| 17  | Eligible transactions must be "Checked Out" or "Ready For Dispatch"       | The update filters to transactions where status ∈ { "Checked Out", "Ready For Dispatch" } AND the customer appears in the recent-shipped name list. |
| 18  | First SweetAlert confirmation shows a styled HTML summary                 | The dialog lists each customer and their eligible product codes with status badges before the operator confirms.                                    |
| 19  | Two SweetAlert2 confirmations are required before bulk update             | First dialog = review list + confirm intent; second dialog = final "Are you sure?" with red confirm button.                                         |
| 20  | All eligible transactions are updated to "Shipped" in one API call        | The bulk endpoint receives an array of transaction IDs and sets all to status "Shipped" atomically.                                                 |

---

## D — Customer Name Click (Match Tab)

| #   | Logic                                                                  | Explanation                                                                                                      |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 21  | Clicking a customer name in the Match tab opens their Facebook profile | `handleCustomerNameClick` calls `window.open(normalizedLink, '_blank', 'noopener,noreferrer')`.                  |
| 22  | If no Facebook link is found → yellow notification, no navigation      | `showNotification({ title: 'No Facebook Link', color: 'yellow' })`.                                              |
| 23  | The link is normalised to include `https://` if missing                | `normalizedLink = facebookLink.startsWith('http') ? facebookLink : 'https://' + facebookLink`.                   |
| 24  | Opening the Facebook link marks the order as completed                 | `updateOrderCompletion(item.id, true)` is called after the window opens; the KPI "Completed" counter increments. |

---

## E — Possible Matches (Unmatched Shopee Orders)

| #   | Logic                                                                  | Explanation                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | Unmatched Shopee orders are resolved via fuzzy customer lookup         | `usePossibleMatches` runs a composite similarity check against all known customers to find the most likely match for each unmatched Shopee order.                                                                      |
| 26  | Composite similarity is 60% address + 25% phone + 15% name             | Same weighted formula as the customer duplicate check, but tuned for dispatch matching.                                                                                                                                |
| 27  | The match threshold is 40%                                             | A candidate customer must score ≥ 40% composite similarity to appear as a possible match.                                                                                                                              |
| 28  | Up to 10 possible matches are returned per unmatched order             | Results are sorted by descending similarity score; only the top 10 are surfaced.                                                                                                                                       |
| 29  | All customers with addresses are pre-loaded in a single query          | The hook loads `GET /customers/with-all-addresses` once to avoid N+1 lookups. Customers without addresses are excluded from the candidate pool.                                                                        |
| 30  | Address similarity checks the full `addresses` array                   | For each candidate customer, `usePossibleMatches` iterates all stored addresses and takes the maximum similarity score across them.                                                                                    |
| 31  | "Link Customer" action links a Shopee username to an existing customer | `linkCustomerMutation` calls the link endpoint with `{ customerId, username, deliveryAddress, addressScore }`. If the username already exists or the address already exists, those flags are returned in the response. |

---

## F — Dispatch XLSX Import

| #   | Logic                                                             | Explanation                                                                                                                       |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 32  | Only `.xlsx` and `.xls` file extensions are accepted              | File extension is checked before parsing; other types are rejected with a red notification.                                       |
| 33  | File size is limited to 10 MB                                     | Files exceeding 10,485,760 bytes are rejected before reading begins.                                                              |
| 34  | Worksheets must not be empty                                      | After parsing, the importer validates that the workbook has at least one sheet with at least one data row.                        |
| 35  | The XLSX library is dynamically imported                          | `xlsx` is imported with `await import('xlsx')` to avoid bundling it in the initial client chunk.                                  |
| 36  | Success notification includes row count                           | `showNotification({ title: 'Success', message: 'Successfully imported and saved N rows from filename', color: 'green' })`.        |
| 37  | Failure notification has 7-second auto-close                      | `showNotification({ title: 'Import Failed', message: errorMessage, color: 'red', autoClose: 7000 })`.                             |
| 38  | Imported data is saved to the database (replaces previous import) | `saveOrdersMutation.mutateAsync(data)` calls `POST /api/dispatch/orders` which truncates existing orders and inserts the new set. |

---

## G — CSV Export

| #   | Logic                                         | Explanation                                                                                                                                 |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | Exporting orders opens a simulated info alert | `handleExportCSV` calls `showInfo('Would export CSV file', 'Export Simulation')`. Full CSV export is a planned feature not yet implemented. |

---

## H — Clipboard Integration

| #   | Logic                                                                                    | Explanation                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40  | Copy-to-clipboard is available on multiple fields in the Match and Recently Updated tabs | `useClipboard()` exposes a `copyToClipboard(text, label)` function that is passed down to `MatchingTab` and `RecentlyUpdatedTab` as a prop.                           |
| 41  | Copy uses `navigator.clipboard.writeText` when available                                 | The hook first checks `typeof navigator.clipboard?.writeText === 'function'`. If the Clipboard API is present, it uses the async secure-context write.                |
| 42  | Legacy fallback uses `document.execCommand('copy')`                                      | When `navigator.clipboard` is unavailable (e.g., non-HTTPS context), the hook creates a hidden `textarea`, selects its content, and calls `execCommand('copy')`.      |
| 43  | Successful copy shows a green notification (top-right, 2 s)                              | `showNotification({ title: 'Copied!', message: '{label} copied to clipboard', color: 'green', position: 'top-right', autoClose: 2000 })`.                             |
| 44  | Both copy paths failing shows a red notification (top-right, 2 s)                        | `showNotification({ title: 'Failed to copy', message: 'Clipboard access is blocked. Please copy manually.', color: 'red', position: 'top-right', autoClose: 2000 })`. |

---

## I — Match Tab Additional Features

| #   | Logic                                                                                                                                                     | Explanation                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | Match tab columns: ORDER STATUS, SHIPPING OPTIONS, USERNAME (BUYER), CUSTOMER NAMES, CUSTOMER MESSAGE, TRACKING NUMBER, SHIP TIME, ADDRESS, PHONE, ACTION | These are the exact headers rendered in `MatchingTab`.                                                                                                              |
| 46  | Action links toggle controls whether clickable name links are enabled                                                                                     | `actionLinksEnabled` / `toggleActionLinks` let the operator switch link behaviour on and off without refreshing the page.                                           |
| 47  | Hovering a row highlights it                                                                                                                              | `hoveredCustomerId` state drives per-row hover styling; set via `setHoveredCustomerId` on mouse enter/leave.                                                        |
| 48  | A "Navigate to Possible Match" button appears for unmatched orders                                                                                        | When an order has no confirmed customer match, a button navigates to the Possible Match tab (`navigateToPossibleMatchTab`).                                         |
| 49  | Prepared line totals are shown per customer                                                                                                               | `preparedLineTotalsByCustomer` is a map of customer name → total line value of "Prepared" transactions, displayed in each customer row to show pending order value. |
| 50  | Possible match badges show best-match count                                                                                                               | `getMatchesForOrder(orderId)` returns the top-scored candidate customers for that Shopee order; the count badge is shown in the row.                                |

---

## J — Recently Updated Tab

| #   | Logic                                                                             | Explanation                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 51  | Recently Updated tab columns: DATE UPDATED, CUSTOMER NAME, PRODUCT CODE, QUANTITY | Four-column layout; rows are sourced from `filteredData` (same search-filtered dispatch items as Match tab).                                                  |
| 52  | Ship time is formatted as "MMMM D, YYYY h:mm A"                                   | `formatShipTime` in `RecentlyUpdatedTab` parses the raw ship time value; if parsing fails, the raw string is shown as-is. A blank/null ship time returns "–". |
| 53  | Clipboard copy is available on the Recently Updated tab                           | The same `copyToClipboard` prop is passed to `RecentlyUpdatedTab` allowing operators to copy customer names or order identifiers.                             |
