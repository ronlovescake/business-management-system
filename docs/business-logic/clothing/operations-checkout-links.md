# Clothing — Invoicing (Checkout Links) Business Logic

> **Note:** In the navigation sidebar this module is labelled **"Invoicing"**. The underlying route is `/checkout-links`.

> **Source files:**
>
> - `src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts`
> - `src/modules/clothing/operations/checkout-links/utils/checkoutLinkMatcher.ts`
> - `src/modules/clothing/operations/checkout-links/utils/finalWeightCalculator.ts`
> - `src/modules/clothing/operations/checkout-links/utils/invoiceWeight.ts`
> - `src/modules/clothing/operations/checkout-links/utils/generateInvoiceMessage.ts`

---

## A — Eligible Order Statuses

| #   | Logic                                                      | Explanation                                                                                                                                                  |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Only certain order statuses qualify for weight calculation | `CUSTOMER_ORDER_ELIGIBLE_STATUSES = ['prepared', 'on-hold', 'ready for dispatch']`. Transactions in any other status are excluded from the weight summation. |
| 2   | Status filter is global for the checkout-links page        | The same constant is used for both the customer weight lookup and the product-weight map build — no per-product override.                                    |

---

## B — Customer Actual Weight Calculation

| #   | Logic                                                                                      | Explanation                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3   | Actual weight is the sum of (quantity × per-piece weight) across all eligible transactions | `calculateCustomerActualWeight` collects all transactions for the customer whose status is in `CUSTOMER_ORDER_ELIGIBLE_STATUSES`, then for each line item multiplies `qty × perPieceWeight`.                            |
| 4   | Product weight is sourced from the product code embedded in the item name                  | `buildProductWeightMap` extracts the product code from parentheses in the line-item name, e.g. `"Kids Dress (KD-010425)"` → code `"KD-010425"`. If no parenthetical code exists, the full item name is used as the key. |
| 5   | Duplicate product codes use the first occurrence                                           | When building the weight map, if two items share a product code, the first encountered weight is used; subsequent entries are ignored.                                                                                  |
| 6   | Items with no matching product code produce zero weight                                    | If the weight map has no entry for a line item's code, the item contributes 0 to the total.                                                                                                                             |

---

## C — Final Weight (Shipping Volume Weight) Calculation

| #   | Logic                                                     | Explanation                                                                                                                                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7   | Weights ≤ 3 kg use fixed half-kilogram tiers              | The fixed tiers are: **0.5, 1.0, 1.5, 2.0, 2.5, 3.0 kg**. For a customer actual weight within this range, the nearest tier ≥ actual weight is used.                      |
| 8   | Weights > 3 kg use a polynomial formula                   | Dimensional adjustment `poly = 0.0012w² + 0.0075w + 0.198` is computed, then the final weight = `CEIL((w + poly + 0.25) × 2) / 2`. This rounds up to the nearest 0.5 kg. |
| 9   | The 0.25 offset in the >3 kg formula is a shipping buffer | It provides a consistent upward bump before rounding, ensuring the billed weight is never below the actual dimensional weight.                                           |
| 10  | The result is always a multiple of 0.5                    | Both the fixed-tier lookup and the ceiling-over-2 formula guarantee the shipping weight is always a half-kilogram multiple.                                              |

---

## D — Checkout Link Matching

| #   | Logic                                                            | Explanation                                                                                                                                                                    |
| --- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11  | Checkout links are matched to customers by exact shipping weight | `findCheckoutLinkByWeight` searches the pre-loaded checkout link list for an entry whose `weight` equals the customer's final shipping weight.                                 |
| 12  | Weight comparison uses a 0.001 tolerance                         | `Math.abs(link.weight − targetWeight) < 0.001` — this is effectively an exact floating-point match, guarding against IEEE 754 rounding noise.                                  |
| 13  | Batch matching deduplicates by weight                            | `batchFindCheckoutLinks` builds a `Map<weight, CheckoutLink>` from the full list and then resolves each customer's weight in O(1) — no duplicate link entries per weight tier. |
| 14  | No fuzzy or range-based matching exists                          | If a checkout link for a calculated weight tier does not exist, the customer shows as "no link found". Operators must create a link for that exact weight to resolve it.       |

---

## E — Page Tabs

| #   | Logic                                                                                             | Explanation                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 15  | The page has five tabs: Invoicing, Local Invoicing, Customer Orders, Item Weights, Checkout Links | The active tab is stored in `activeTab` state, defaulting to `'invoicing'`. Each tab renders its own data view and controls. |

---

## F — Invoicing Tab (Google Drive Sync)

| #   | Logic                                                           | Explanation                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | "Sync Google Drive" button triggers a two-step server operation | `handleSyncGoogleDrive` first calls `GET /api/google-drive/sync-files` to pull Drive file links, then POSTs the resulting customer invoice data to `/api/clothing/invoices`, then calls `handleCalculateWeights`. |
| 17  | Google Drive not configured → yellow notification               | If the Drive integration is not set up, `showNotification({ title: 'Google Drive Not Configured', color: 'yellow', autoClose: 10000 })` is shown.                                                                 |
| 18  | Package not installed → yellow notification                     | If the required integration package is missing, `showNotification({ title: 'Package Not Installed', color: 'yellow', autoClose: 10000 })` is shown.                                                               |
| 19  | Sync success → green notification                               | `showNotification({ title: 'Google Drive Synced', color: 'green' })` after the full three-step flow completes.                                                                                                    |
| 20  | Sync failure → red notification                                 | `showNotification({ title: 'Sync Failed', color: 'red' })` on any exception during the flow.                                                                                                                      |
| 21  | "Calculate Weights" can also be triggered independently         | `handleCalculateWeights` posts to `POST /api/clothing/invoices/calculate-weights`; on success shows green notification with the count of matched customers; on failure shows red notification.                    |
| 22  | Unmatched products are noted in the success notification        | If `unmatchedProducts.length > 0`, the green notification message appends "Note: N product(s) have no weight data."                                                                                               |
| 23  | Shipping weight column reflects calculated values               | After `handleCalculateWeights` resolves, each customer row in the invoicing table updates to show the computed shipping weight.                                                                                   |

---

## G — Invoicing Tab — Customer Name Click & Messenger Flow

| #   | Logic                                                                 | Explanation                                                                                                                                                                      |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Clicking a customer name triggers the Messenger flow                  | `handleCustomerNameClick(customer)` runs a multi-step sequence: lookup Facebook link → load settings → generate message → copy to clipboard → open Messenger → tick the tickbox. |
| 25  | Facebook link lookup: no link found → yellow notification             | If `lookupFacebookLink(customer)` returns null, `showNotification({ title: 'No Facebook Link', color: 'yellow' })` is shown and the flow stops.                                  |
| 26  | Settings not loaded yet → yellow notification                         | If invoice settings have not resolved, `showNotification({ title: 'Settings Not Loaded', color: 'yellow' })` is shown and the flow stops.                                        |
| 27  | Message is generated via `generateInvoiceMessage`                     | `generateInvoiceMessage(template, { driveFilesUrl, shopeeCheckoutLink, paymentChannelsUrl })` substitutes all placeholders in the saved message template.                        |
| 28  | Generated message is written to the clipboard                         | `navigator.clipboard.writeText(message)` is called. On failure: `showNotification({ title: 'Copy Failed', color: 'red' })`.                                                      |
| 29  | On successful copy, a green notification is shown                     | `showNotification({ title: 'Message Copied! Opening Facebook Messenger...', color: 'green' })`.                                                                                  |
| 30  | Facebook Messenger opens in a new tab                                 | `window.open(messengerUrl, '_blank')` is called immediately after the copy confirmation.                                                                                         |
| 31  | The customer's tickbox is automatically checked after Messenger opens | A `PUT /api/clothing/invoices/{id}/tickbox` request sets the tickbox to `true`.                                                                                                  |
| 32  | Tickbox can also be toggled manually                                  | Clicking the tickbox checkbox directly calls the same `PUT /api/clothing/invoices/{id}/tickbox` endpoint to toggle the persisted state. Failure shows red notification.          |

---

## H — Local Invoicing Tab

| #   | Logic                                                                        | Explanation                                                                                                                                       |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | Local Invoicing shows transactions with an invoice date in eligible statuses | Eligible statuses: `prepared`, `on-hold`, `ready for dispatch`. Transactions must have a non-null `invoiceDate`.                                  |
| 34  | An invoice date filter narrows the list                                      | A `Select` populated from distinct invoice dates defaults to the most recent date. Changing the filter immediately re-filters the displayed rows. |
| 35  | Clicking a customer name runs the same Messenger flow                        | Same sequence as the Invoicing tab, except `driveFilesUrl` is passed as an empty string (no Google Drive link).                                   |
| 36  | Tickboxes in Local Invoicing are local state only                            | Unlike the Invoicing tab, local invoicing tickboxes are NOT persisted to the database — they are session state only and reset on page refresh.    |
| 37  | Auto-tick after Messenger flow is local state only                           | After clicking the customer name, the local tickbox is set to `true` in state; no API call is made.                                               |

---

## I — Customer Orders Tab

| #   | Logic                                               | Explanation                                                                                                    |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 38  | Customer Orders tab loads via React Query           | `refetchInterval: 60 * 1000` (auto-refreshes every 60 s); `staleTime: 30 * 1000`.                              |
| 39  | Table shows calculated shipping weight per customer | Each customer row displays the computed final weight using the polynomial/tier formula.                        |
| 40  | Weight is computed from eligible transactions       | Same `CUSTOMER_ORDER_ELIGIBLE_STATUSES` filter applies — only prepared/on-hold/ready-for-dispatch lines count. |

---

## J — Item Weights Tab

| #   | Logic                                                              | Explanation                                                                                                    |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 41  | Item Weights tab lists products that have weight data entered      | Products are filtered by `hasWeightData === true` from the products API.                                       |
| 42  | "Open Products Module" button opens the Products page in a new tab | `window.open(productsPath, '_blank')` is called; `productsPath` is the same-origin URL to the Products module. |
| 43  | Fetch error is displayed inline                                    | If the products fetch fails, an error state is shown inside the tab panel content area.                        |

---

## K — Checkout Links Tab — CSV Import

| #   | Logic                                                                                                                                           | Explanation                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 44  | Only `.csv` files are accepted                                                                                                                  | File picker `accept=".csv"`. If a non-.csv file is selected, a `showNotification({ color: 'red' })` error is shown immediately.                                           |
| 45  | The CSV must have exactly these seven headers (case-insensitive): WEIGHT, WIDTH, LENGTH, HEIGHT, CHECKOUT LINKS, PRODUCT PORTALS, PRODUCT NAMES | The parser checks the header row against all seven required column names. If any are missing, the import is rejected with a red notification listing the missing headers. |
| 46  | Quoted CSV fields are correctly parsed                                                                                                          | The parser handles double-quoted fields and embedded commas within quotes.                                                                                                |
| 47  | Parsed rows are batch-posted to the database                                                                                                    | `POST /api/clothing/checkout-links/batch` sends all valid rows.                                                                                                           |
| 48  | Partial DB failure shows an orange notification                                                                                                 | If the batch write reports some rows failed, `showNotification({ title: 'Partial Import', color: 'orange' })` lists the count of failures.                                |
| 49  | Full success shows a green notification                                                                                                         | `showNotification({ title: 'Import Complete', message: 'N rows imported.', color: 'green' })`.                                                                            |

---

## L — Checkout Links Tab — CSV Export

| #   | Logic                                                 | Explanation                                                                                                                 |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 50  | Export is skipped if the checkout links list is empty | If no records exist, `showNotification({ title: 'Nothing to Export', color: 'yellow' })` is shown and no file is generated. |
| 51  | Export generates a blob download in the browser       | A `Blob` with `type: 'text/csv'` is created from the serialised data; a temporary `<a>` tag triggers the download.          |
| 52  | Success notification shows the row count              | `showNotification({ title: 'Export Complete', message: 'N rows exported.', color: 'green' })`.                              |

---

## M — Checkout Links Tab — Edit Record

| #   | Logic                                                              | Explanation                                                                                                                                        |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 53  | Clicking the edit icon opens the edit modal                        | The modal is pre-populated with the record's current `weight`, `width`, `length`, `height`, `checkoutLinks`, `productPortals`, and `productNames`. |
| 54  | Weight, width, length, and height are required                     | Mantine form validation rejects empty or zero values for all four dimension fields.                                                                |
| 55  | `checkoutLinks`, `productPortals`, and `productNames` are optional | These text fields may be left blank without blocking the save.                                                                                     |
| 56  | Save calls `PUT /api/clothing/checkout-links/{id}`                 | On success: green notification. On failure: red notification. The list refreshes on success.                                                       |

---

## N — Checkout Links Tab — Delete Record

| #   | Logic                                                                 | Explanation                                                                                                                                                                 |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 57  | Deleting a checkout link requires **double SweetAlert2 confirmation** | **First dialog**: `Swal.fire({ title: 'Delete Checkout Link?', text: 'This action cannot be undone.', icon: 'warning', showCancelButton: true })`.                          |
| 58  | Second confirmation requires typing "DELETE"                          | **Second dialog**: `Swal.fire({ title: 'Type DELETE to confirm', input: 'text', inputValidator })`. The `inputValidator` rejects any string that is not exactly `"DELETE"`. |
| 59  | Delete calls `DELETE /api/clothing/checkout-links/{id}`               | On success: `showNotification({ title: 'Deleted', color: 'green' })`. The record is removed from local state immediately.                                                   |
| 60  | Delete failure shows a red notification                               | `showNotification({ title: 'Delete Failed', color: 'red' })`.                                                                                                               |

---

## O — Eligible Order Statuses (Weight Calculation)

| #   | Logic                                                          | Explanation                                                                                                                        |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 61  | Only three order statuses qualify for weight calculation       | `CUSTOMER_ORDER_ELIGIBLE_STATUSES = ['prepared', 'on-hold', 'ready for dispatch']`. Transactions in any other status are excluded. |
| 62  | The same status filter applies to all weight-related functions | Used in `calculateCustomerActualWeight`, the Customer Orders tab query, and the Local Invoicing tab row filter.                    |

---

## P — Actual Weight Calculation Logic

| #   | Logic                                                                          | Explanation                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 63  | Actual weight = sum of (qty × per-piece weight) across all eligible line items | `calculateCustomerActualWeight` iterates the filtered transactions and multiplies each line item's `qty` by its `perPieceWeight`.                                        |
| 64  | Product weight is sourced from the product code in the item name               | `buildProductWeightMap` extracts the code from parentheses: `"Kids Dress (KD-010425)"` → `"KD-010425"`. Full name is used as fallback when no parenthetical code exists. |
| 65  | Duplicate product codes use the first occurrence                               | Subsequent entries with the same code are skipped in the weight map.                                                                                                     |
| 66  | Items with no matching product code contribute zero weight                     | If the code is absent from the weight map, the line item adds 0 to the total.                                                                                            |

---

## Q — Final Shipping Weight Formula

| #   | Logic                                      | Explanation                                                                                                                           |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| 67  | Weights ≤ 3 kg snap to half-kilogram tiers | Fixed tiers: 0.5, 1.0, 1.5, 2.0, 2.5, 3.0 kg. The nearest tier ≥ actual weight is selected.                                           |
| 68  | Weights > 3 kg use a polynomial formula    | `poly = 0.0012w² + 0.0075w + 0.198`. Final weight = `CEIL((w + poly + 0.25) × 2) / 2`.                                                |
| 69  | The 0.25 buffer prevents under-billing     | The constant upward offset ensures the billed weight is always at least slightly above the actual dimensional weight before rounding. |
| 70  | Result is always a multiple of 0.5 kg      | Both methods guarantee half-kilogram increments.                                                                                      |

---

## R — Checkout Link Matching

| #   | Logic                                           | Explanation                                                                                              |
| --- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 71  | Links are matched by exact shipping weight      | `findCheckoutLinkByWeight` searches for an entry where `Math.abs(link.weight − targetWeight) < 0.001`.   |
| 72  | Batch matching is O(1) per customer             | `batchFindCheckoutLinks` builds a `Map<weight, CheckoutLink>`, resolving each customer in constant time. |
| 73  | No match found → customer shows "no link found" | Operators must add a checkout link record for the exact computed weight tier to resolve the gap.         |
