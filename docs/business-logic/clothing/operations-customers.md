# Clothing — Customers Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/customers/services/CustomerService.ts`
> - `src/modules/clothing/operations/customers/hooks/useCustomerDuplicateCheck.ts`
> - `src/modules/clothing/operations/customers/hooks/useCustomersData.ts`
> - `src/modules/clothing/operations/customers/hooks/useCustomersCSV.ts`
> - `src/modules/clothing/operations/customers/hooks/useCustomerForm.ts`
> - `src/modules/clothing/operations/customers/hooks/useCustomersGrid.ts`
> - `src/modules/clothing/operations/customers/components/AddCustomerModal.tsx`
> - `src/modules/clothing/operations/customers/components/CustomersPage.tsx`
> - `src/modules/clothing/operations/customers/api/schemas.ts`
> - `src/app/clothing/operations/customers/[id]/hooks/useCustomerDetails.ts`
> - `src/app/clothing/operations/customers/[id]/components/EditCustomerModal.tsx`
> - `src/app/clothing/operations/customers/[id]/components/AdditionalCustomerInfoCard.tsx`
> - `src/app/clothing/operations/customers/[id]/components/OrdersAndTransactions.tsx`

---

## A — Validation Rules

| #   | Logic                                             | Explanation                                                                                                                    |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Customer name is required                         | `validateCustomer` rejects any form submission where `customerName` is blank or whitespace-only.                               |
| 2   | Email is validated if provided                    | If an email address is supplied, it must match the standard `user@domain.tld` regex; otherwise the record fails validation.    |
| 3   | Phone number format is validated if provided      | If a phone number is supplied, it must contain only digits, spaces, dashes, plus signs, and parentheses; letters are rejected. |
| 4   | Empty optional fields are trimmed to empty string | All optional string fields are trimmed before saving; a purely whitespace value is treated the same as an empty string.        |

---

## B — Status Options

| #   | Logic                                             | Explanation                                                                                                                       |
| --- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Customer status is an enumerated list             | `getStatusOptions()` returns exactly five options: Active, Inactive, Prospect, VIP, Banned. Free-text statuses are not permitted. |
| 6   | Status defaults to empty on new customer creation | A new customer form is created with an empty `customerStatus` string; operators must explicitly select a status.                  |

---

## C — Business Info Auto-Fill

| #   | Logic                                                    | Explanation                                                                                                                                                                          |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7   | Typing a known customer name auto-fills business details | `autoFillBusinessInfo` performs a case-insensitive name match against existing customers and pre-populates Business Name, Tax Number, Business Address, and Business Contact Number. |
| 8   | Auto-fill is case-insensitive and exact-match            | The name match uses `.toLowerCase()` on both sides; a partial or fuzzy name does not trigger auto-fill.                                                                              |
| 9   | Auto-fill returns empty if no match found                | If no existing customer matches the typed name, `autoFillBusinessInfo` returns an empty object and no fields are touched.                                                            |

---

## D — Duplicate Detection

| #   | Logic                                                           | Explanation                                                                                                                            |
| --- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Duplicate check runs before saving a new customer               | `useCustomerDuplicateCheck` queries `/customers/with-all-addresses` and computes similarity scores before the create API call is made. |
| 11  | Similarity is weighted: 60% address, 25% phone, 15% name        | The composite score formula is `addressScore * 0.6 + phoneScore * 0.25 + nameScore * 0.15`.                                            |
| 12  | Duplicate threshold is 50% composite similarity                 | Customers with an overall similarity ≥ 50% are surfaced as potential duplicates; those below 50% are ignored.                          |
| 13  | Additional addresses are included in the address check          | The hook loads each customer's full list of additional addresses and takes the maximum address similarity score across all addresses.  |
| 14  | Top 5 duplicates are surfaced                                   | Only the five highest-scoring potential duplicates are shown in the dialog, sorted by overall score descending.                        |
| 15  | Operators can proceed despite a duplicate warning               | The duplicate-check dialog provides a "Proceed Anyway" and "Cancel" option; the system does not hard-block the save.                   |
| 16  | Duplicate check uses fuzzy matching for addresses               | Address comparison uses `calculateAddressSimilarity` (Levenshtein-based) rather than exact equality to catch minor typos.              |
| 17  | Name scoring is the least weight because names are often masked | The 15% weight for name reflects that Shopee/online customer names are frequently anonymized or abbreviated.                           |

---

## E — Statistics & Aggregation

| #   | Logic                                                           | Explanation                                                                                                                       |
| --- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 18  | Stats are computed from all customers vs. the active filter set | `calculateStats` takes both the full list and the filtered list, so the stats cards show both total and currently-visible counts. |
| 19  | Unique businesses count ignores blank business names            | The `uniqueBusinesses` stat counts only non-empty, trimmed Business Name values.                                                  |
| 20  | Contactable percentage counts email OR phone                    | A customer is "contactable" if they have either a non-blank email address or a non-blank phone number.                            |
| 21  | Contactable percentage is rounded to nearest integer            | The percentage is computed as `Math.round((contactable / total) * 100)` before display.                                           |

---

## F — Search & Filtering

| #   | Logic                                           | Explanation                                                                                                                                                                                |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 22  | Customer search index spans 11 fields           | The search column builder indexes: Customer Name, Phone Number, Address, Facebook, Email, Business Name, Tax Number, Business Address, Business Contact Number, Date, and Customer Status. |
| 23  | Search normalizes to lowercase                  | `normalizeSearchValue` lowercases both the query and each indexed column before comparing.                                                                                                 |
| 24  | Search is substring-match across all 11 columns | Any partial match in any indexed column will return the row; columns are ORed together.                                                                                                    |

---

## G — CSV Import / Export

| #   | Logic                                                                                   | Explanation                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 25  | CSV export uses a quoted-field format                                                   | Fields containing commas, quotes, or newlines are wrapped in double quotes and internal quotes are escaped as `""`.                                                                                                              |
| 26  | Detailed export supports numbered multi-value columns                                   | `exportToCSVDetailed` produces columns like "Shopee Username 1, Shopee Username 2, …" up to a configurable `maxColumns` (default 5).                                                                                             |
| 27  | Overflow warning is included if max columns exceeded                                    | If any customer has more items than `maxColumns`, the export returns a `warning` flag in the result and truncates extra values silently.                                                                                         |
| 28  | Detailed export fetches from `/customers/export` API                                    | The export API endpoint joins additional addresses, phones, names, and Facebook accounts in a single query and returns them pre-joined.                                                                                          |
| 29  | CSV import uses the server-side import endpoint                                         | CSV rows are posted to `POST /customers/import`; the server handles parsing, dedup-checking, and batch creation.                                                                                                                 |
| 30  | A blue loading notification (autoClose: false) is shown during import                   | Title "Importing…", message "Processing CSV file, please wait…", color blue, `loading: true`, persists until dismissed by the import result.                                                                                     |
| 31  | Successful import shows a green (or yellow-if-errors) notification with row counts      | Title "Import Successful", message "Processed N rows. Created X new customers, updated Y customers, added Z additional info records [+ M errors]". Color is yellow if `errors.length > 0`, green otherwise; autoClose 10 000 ms. |
| 32  | Import failure from API shows a red notification                                        | Title "Import Failed", message from `result.error` or "Error importing CSV file.", color red.                                                                                                                                    |
| 33  | Import failure from exception shows a red notification                                  | Title "Import Failed", message "Error importing CSV file. Please check the file format.", color red.                                                                                                                             |
| 34  | Standard export success shows a green notification                                      | Title "Export Successful", message "Exported N customers to [filename]", color green.                                                                                                                                            |
| 35  | Standard export failure shows a red notification                                        | Title "Export Failed", message "Error exporting CSV file.", color red.                                                                                                                                                           |
| 36  | Detailed export with overflow shows a yellow warning notification (autoClose 10 000 ms) | Title "⚠️ Export Successful (with warnings)", message from `result.warning`, color yellow.                                                                                                                                       |
| 37  | Detailed export without overflow shows a green notification                             | Title "Export Successful", message "Exported customers with all additional info (Shopee usernames, addresses, phones, alternate names, Facebook)", color green.                                                                  |
| 38  | Detailed export failure shows a red notification                                        | Title "Export Failed", message "Error exporting detailed CSV file.", color red.                                                                                                                                                  |
| 39  | Analysis export (duplicate rows format) success shows a green notification              | Title "Export Successful", message "Exported customers in duplicate rows format for analysis", color green.                                                                                                                      |
| 40  | Analysis export failure shows a red notification                                        | Title "Export Failed", message "Error exporting analysis CSV file.", color red.                                                                                                                                                  |

---

## H — Add Customer Modal

| #   | Logic                                                                | Explanation                                                                                                                                                                      |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30  | "Add Customer" button is disabled until customer name is non-blank   | The submit button in `AddCustomerModal` has `disabled={!formData.customerName.trim()}`. Clicking with an empty name is not possible.                                             |
| 31  | Form validation runs before duplicate check                          | `getValidatedCustomerData` is called first; if validation fails a **red** toast "Validation Error" is shown and the duplicate check never runs.                                  |
| 32  | Duplicate check runs after validation passes                         | `checkForDuplicates` is called with the new customer's name, phone, and address. If duplicates are found, a dialog is shown before proceeding.                                   |
| 33  | Save only proceeds if operator confirms (or no duplicates found)     | If `checkForDuplicates` returns `false` (operator chose "Cancel" on the duplicate warning), the save is aborted and the modal stays open.                                        |
| 34  | Successful add shows a green toast "🎉 Customer Added Successfully!" | Toast includes the new customer's name, auto-closes after 4 seconds.                                                                                                             |
| 35  | Network failure shows a yellow toast "Saved locally only"            | If the API throws, the yellow warning toast "Database not reachable" is shown instead of a red error, because the optimistic update has already applied locally.                 |
| 36  | Modal closes and form resets after a successful add                  | `closeModal` is called, which also calls `resetForm` to clear all fields.                                                                                                        |
| 37  | A successful add broadcasts a cross-tab update                       | After the mutation settles (success or error), a `BroadcastChannel('customer-updates')` message is posted so the dispatch page and other tabs receive the updated customer list. |
| 38  | Add also invalidates the dispatch page customer cache                | `queryKeys.customers.withShopee()` is invalidated in addition to the main customers list, ensuring the dispatch Shopee-matching pool is refreshed.                               |

---

## I — Edit Customer (Detail Page)

| #   | Logic                                                                                                                                                                                       | Explanation                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 39  | The Edit Customer modal does not close on outside click or Escape                                                                                                                           | `closeOnClickOutside={false}` and `closeOnEscape={false}` prevent accidental dismissal of unsaved edits.                                                |
| 40  | Edit form is pre-populated from the loaded customer record                                                                                                                                  | When the customer query resolves and the edit modal is closed, `setEditForm(customer)` initializes all fields from the database record.                 |
| 41  | Edit uses optimistic update — UI reflects changes immediately                                                                                                                               | `updateCustomerMutation.onMutate` snapshots the previous value and writes the new value to the query cache. If the API fails, the snapshot is restored. |
| 42  | Successful edit shows a green toast "✅ Customer Updated Successfully!"                                                                                                                     | Toast includes the customer's name, auto-closes after 4 seconds.                                                                                        |
| 43  | A failed edit shows a red toast "Failed to update customer" and rolls back                                                                                                                  | The mutation's `onError` restores the optimistic snapshot and shows a red toast.                                                                        |
| 44  | Successful edit broadcasts a cross-tab update                                                                                                                                               | Same `BroadcastChannel('customer-updates')` mechanism as Add, keeping the dispatch page and other tabs in sync.                                         |
| 45  | Editable fields: Customer Name, Phone Number, Email Address, Customer Status, Address (textarea), Facebook, Business Name, Tax Number, Business Address (textarea), Business Contact Number | All 10 core customer fields are editable in the Edit modal.                                                                                             |
| 46  | Double-clicking a customer name in the grid navigates to the detail page                                                                                                                    | `handleCellClick` in the grid hook detects two clicks on the same `customerName` cell within 500 ms and calls `router.push` to `/customers/[id]`.       |

---

## J — Additional Customer Information (Detail Page)

| #   | Logic                                                                                                                          | Explanation                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47  | Five categories of additional info are managed: Addresses, Phone Numbers, Shopee Usernames, Alternate Names, Facebook Accounts | Each category is a separate list, stored and saved together in one API call to `PUT /customers/[id]/additional-info`.                                                                 |
| 48  | Each category is capped at 5 items                                                                                             | Adding a 6th entry to any of the five categories is blocked; a **red** toast "Maximum of 5 [type] allowed" is shown instead.                                                          |
| 49  | Removing any item requires a SweetAlert2 confirmation dialog                                                                   | Each `remove*` function calls `showConfirm` (type: `"warning"`) with a category-specific title ("Delete Address?", "Delete Phone Number?", etc.) before removing the item from state. |
| 50  | All five lists are saved atomically in a single PUT call                                                                       | "Save Changes" sends all five arrays together; there is no per-category partial save.                                                                                                 |
| 51  | Successful save shows a green toast "Additional customer information saved successfully"                                       | Toast confirms all five categories were persisted.                                                                                                                                    |
| 52  | Failed load shows a red toast "Failed to load additional customer information"                                                 | Both the initial fetch and any re-fetch failure surface this notification.                                                                                                            |
| 53  | Failed save shows a red toast "Failed to save additional customer information"                                                 | Any API or network error during the PUT call triggers this toast.                                                                                                                     |
| 54  | New items are added with a client-generated ID using `Date.now()`                                                              | Locally-created items use `Date.now().toString()` as a temporary ID until the server responds with real IDs.                                                                          |
| 55  | Additional addresses feed the duplicate detection algorithm                                                                    | The `useCustomerDuplicateCheck` hook loads `/customers/with-all-addresses` which includes these additional addresses, so they participate in the 60% address-similarity component.    |

---

## K — Customer Detail — Transaction Tabs

| #   | Logic                                                                                    | Explanation                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 56  | Transactions are split across four tabs: Transactions, Return/Refund, Shipped, Cancelled | The detail page `OrdersAndTransactions` component partitions transactions client-side into these four views.                                    |
| 57  | "Shipped" tab shows orders with status "shipped" or "delivered"                          | `shippedTransactions` filters by `normalizeOrderStatus(status) === 'shipped'` OR `=== 'delivered'`.                                             |
| 58  | "Cancelled" tab uses `isCancelledOrderStatus` helper                                     | The helper detects all cancellation status variants (e.g. "cancelled", "cancel requested", etc.).                                               |
| 59  | "Transactions" tab shows everything that is neither shipped/delivered nor cancelled      | `otherTransactions` is the residual set — all active, pending, processing, and warehouse transactions appear here.                              |
| 60  | "Transactions" tab footer shows the running total of `lineTotal` across visible rows     | `otherTransactionsTotal` sums `lineTotal` for the "other" bucket only.                                                                          |
| 61  | Transaction lookup for the refund modal uses a Map keyed by transaction ID               | `transactionById = new Map(transactions.map(t => [t.id, t]))` for O(1) lookup when displaying the linked transaction label in the refund table. |

---

## L — Record Refund

| #   | Logic                                                                                                 | Explanation                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 62  | "Record Refund" button opens a modal on the Return/Refund tab                                         | Clicking the button sets `refundModalOpen = true`.                                                                                                                |
| 63  | Transaction is required (linked to a specific transaction)                                            | The "Transaction" Select field is `withAsterisk`; the mutation throws "You must select a transaction" if `refundTransactionId` is null or not a valid number.     |
| 64  | Refund date is required                                                                               | The mutation throws "Please provide a refund date." if `refundDate` is blank. Default value is today's date in `YYYY-MM-DD` format.                               |
| 65  | Refund amount must be > 0                                                                             | The mutation throws "Refund amount must be greater than 0." if `refundAmount` is not a positive finite number.                                                    |
| 66  | Returned Quantity is optional and supports up to 3 decimal places                                     | `returnedQuantity` is tracked separately from the monetary `amount`; it may be left blank.                                                                        |
| 67  | Restock Bucket is optional with six choices                                                           | Drop-down allows selecting the inventory bucket the returned item should be placed into: `sellable`, `damaged_hold`, `reserved`, `assembly_wip`, `scrap`, `sold`. |
| 68  | Reason is optional free text                                                                          | Trimmed before saving; sent as `undefined` (omitted) if blank.                                                                                                    |
| 69  | Notes is optional textarea                                                                            | Trimmed before saving; sent as `undefined` (omitted) if blank.                                                                                                    |
| 70  | Successful refund shows a green toast "✅ Refund recorded"                                            | Toast confirms the save and the modal closes automatically.                                                                                                       |
| 71  | Failed refund shows a red toast with the extracted error message                                      | `getRefundErrorMessage` extracts the human-readable message from the API error payload, falling back to a generic string.                                         |
| 72  | After save, the refund form is completely reset                                                       | `refundTransactionId` is cleared, `refundDate` resets to today, `refundAmount` resets to 0, and reason/notes are cleared.                                         |
| 73  | Refund list shows: Date, Amount (red), Transaction label, Returned Qty, Restock Bucket, Reason, Notes | Transaction label is formatted as `"PRODUCT_CODE • #id"` if the linked transaction is found.                                                                      |
| 74  | Total refunded amount is shown on the "Return/Refund" tab badge                                       | `totalRefunded = Σ refunds[i].amount` displayed next to the tab label.                                                                                            |

---

## M — Delete Refund

| #   | Logic                                                            | Explanation                                                                                                                                                 |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 75  | Deleting a refund requires SweetAlert2 confirmation              | `showConfirm({ title: 'Delete refund?', message: 'This will hide the refund record (soft delete).' })` must return `true` before the delete mutation fires. |
| 76  | Delete is a soft delete                                          | The API hides the refund record rather than permanently removing it — the message in the confirmation dialog explicitly states "soft delete".               |
| 77  | Successful delete shows a green toast "Refund deleted"           | Confirms the record was hidden.                                                                                                                             |
| 78  | Failed delete shows a red toast with the extracted error message | Same `getRefundErrorMessage` helper as the create flow.                                                                                                     |

---

## N — Customer Detail Statistics

| #   | Logic                                                                                     | Explanation                                                         |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 79  | Total Transactions = count of all transaction rows                                        | All rows from `/customers/[id]/transactions` are counted.           |
| 80  | Total Spent = sum of `lineTotal` across all transactions                                  | Includes all statuses — not limited to completed/shipped.           |
| 81  | Recent Transactions = count from the last 30 days                                         | Filters transactions where `orderDate > now − 30 days`.             |
| 82  | Completed Transactions = shipped OR delivered status                                      | Used for completion rate and average transaction value.             |
| 83  | Cancelled Transactions = any status containing "cancel" (case-insensitive)                | Used for cancellation rate.                                         |
| 84  | Completion Rate = round(completed ÷ total × 100)                                          | Returns 0 if there are no transactions.                             |
| 85  | Cancellation Rate = round(cancelled ÷ total × 100)                                        | Returns 0 if there are no transactions.                             |
| 86  | Average Transaction Value = sum of completed lineTotals ÷ count of completed transactions | Returns 0 if no completed transactions. Rounded to nearest integer. |

---

## O — Data Loading & Freshness

| #   | Logic                                                                  | Explanation                                                                                                                                                           |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 87  | Customer list has a 30-second stale time                               | React Query will not re-fetch in the background within 30 seconds, preventing unnecessary traffic during fast navigation.                                             |
| 88  | Customer detail, orders, and transactions all use 30-second stale time | All three detail-page queries share the same stale window.                                                                                                            |
| 89  | Import CSV shows a persistent loading notification during processing   | `showNotification({ id: 'import-progress', loading: true, autoClose: false })` is shown, then hidden via `hideNotification('import-progress')` when the API responds. |
| 90  | Import success toast shows a detailed breakdown                        | "Processed X rows. Created Y new customers, updated Z customers, added W additional info records" — with `autoClose: 10000` (10 seconds).                             |
| 91  | Import with partial errors shows a yellow warning toast                | If `errors.length > 0`, the import success message is coloured yellow and includes the error count.                                                                   |
| 92  | Customers list is re-fetched after import using query invalidation     | `queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() })` forces a fresh fetch after import.                                                         |
| 93  | Page shows a `TableSkeleton` (15 rows × 11 columns) while loading      | `isLoading` from the React Query result controls this loading state.                                                                                                  |

---

## P — Grid Search Debouncing

| #   | Logic                                                        | Explanation                                                                                                                                                    |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 94  | Search results are debounced 300 ms before updating the grid | A `useEffect` with a 300 ms `setTimeout` drives `debouncedFilteredCustomers` separately from `filteredCustomers`, preventing layout thrashing on fast typists. |
| 95  | Statistics are computed from the debounced filtered list     | `calculateStats` uses `debouncedFilteredCustomers` so stat cards do not flicker on each keystroke.                                                             |
| 96  | Ctrl+F focuses the search input                              | `useCtrlFFocus` attaches a keyboard shortcut that moves focus to the element with `data-ctrlf-target="customers-search-input"`.                                |
