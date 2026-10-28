# Clothing — Shipments Business Logic

## Shipment Code Changes

Editing an existing shipment's code also updates products assigned to its old
code. Linked transactions follow the product's current shipment code. A code
rename is rejected when the old code identifies multiple shipments or the new
code is already used; this avoids moving products to an unrelated shipment.
Existing transaction prices and accounting amounts are unchanged.

## Accounting Source Lifecycle

Clothing transit builds/reclassifications and Logistics Costs are administrator
tools; normal shipment operations remain available to operational users. A
shipment has one active transit source flow: product-origin, legacy single,
or legacy split. Mixing flows, duplicating the full amount under another funding
account, or silently omitting an existing split component is rejected.

Once reclassified or supplier-settled, source amounts, accounts, dates, and
deletion are locked across both the shipment and accounting edit endpoints.
Notes-only edits remain allowed. Corrections require approved reversal/resolution.
Product-origin soft-delete recovery reuses the original row/key without purging
history; recovery cannot overwrite downstream postings. New product-origin
reclassifications use stable product IDs and actual inserted counts, retaining
historical code-only compatibility. Competing serializable writes return a
retryable HTTP 409 rather than committing incompatible postings.

### Delayed Products And Supplier Credits

The [product supplier-resolution contract](operations-products.md#supplier-nonfulfillment-and-future-purchase-credit)
owns the approved whole-product workflow. Use the dedicated Edit Product transfer
for delayed, unreceived goods with product-origin funding; do not delete the old
source to exclude it from arrival processing. The audited transfer moves source
rows and product linkage together without changing payment, amount, date or keys.
Legacy shipment-origin funding and already received/reclassed/fulfilled goods are
rejected rather than silently rewritten.

The reclass selector identifies product name/code and groups all funding
components of each product. Unchecking excludes a product; **Delete Source**
instead removes its original asset/funding source and is not an exclusion tool.
Credit-issued nonfulfilled products are not eligible for stock reclass, and a
replacement's supplier-credit and remaining-payment components must be selected
together. This does not introduce a general quantity-level receipt-confirmation
engine. The Shipping Fee Calculator is unchanged and is not used by resolution.

> **Source files:**
>
> - `src/modules/clothing/operations/shipments/components/ShipmentsPage.tsx`
> - `src/modules/clothing/operations/shipments/components/ShipmentsDashboard.tsx`
> - `src/modules/clothing/operations/shipments/hooks/useShipmentsData.ts`
> - `src/modules/clothing/operations/shipments/hooks/useShipmentForm.ts`
> - `src/modules/clothing/operations/shipments/services/ShipmentService.ts`
> - `src/modules/clothing/operations/shipments/types/shipment.types.ts`
> - `src/app/api/shipments/route.ts`
> - `src/app/api/shipments/[id]/route.ts`
> - `src/app/api/shipments/[id]/transit-build/route.ts`
> - `src/app/api/shipments/[id]/transit-reclass/route.ts`
> - `src/modules/shipments/api/transitBuildRouteFactory.ts`
> - `src/modules/shipments/api/transitReclassRouteFactory.ts`
> - `src/modules/shipments/api/shipmentUtils.ts`

---

## A — Page Layout & Tabs

| #   | Logic                                                                         | Explanation                                                                                                                                  |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The page has three main areas: tab navigation, stats cards, and the data grid | The default active tab is `'shipments'` (the main list). Other tabs are `'dashboard'`, `'pickup'`, and logistics costs.                      |
| 2   | An error boundary wraps the whole shipments page                              | `ShipmentsErrorBoundary` catches rendering errors and shows a Reload + Home recovery UI. In development mode the raw error message is shown. |
| 3   | Data is sorted by Shipment Code descending on load                            | `sortedShipments` uses `localeCompare` with `{ numeric: true }` so numeric codes sort correctly (e.g. SC-100 before SC-99).                  |
| 4   | `staleTime: 30 * 1000` keeps data fresh for 30 seconds                        | React Query avoids redundant refetches within the same session.                                                                              |

---

## B — Statistics Cards (11 total)

| #   | Logic                                                                                                                                                                                  | Explanation                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Eleven statistics cards are shown: Total Shipments, Total Fees, Total Sacks, Total CBM, Total Weight, In Transit, Manila Port, With Pier Gatepass, PH Warehouse, For Pickup, Delivered | `calculateStatistics` from `ShipmentService` derives all values from the currently **filtered** data (not the full list), so the cards respond to search. |
| 6   | Total Fees is formatted with ₱ prefix                                                                                                                                                  | `₱{statistics.totalFees.toLocaleString()}`.                                                                                                               |
| 7   | Total CBM shows `m³` unit suffix                                                                                                                                                       | `{statistics.totalCBM.toLocaleString()} m³`.                                                                                                              |
| 8   | Total Weight shows `kg` unit suffix                                                                                                                                                    | `{statistics.totalWeight.toLocaleString()} kg`.                                                                                                           |

---

## C — Add Shipment

| #   | Logic                                                                                                                                                                                                                                                    | Explanation                                                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 9   | "Add Shipment" button opens `AddShipmentModal`                                                                                                                                                                                                           | The modal is controlled by `addModalOpened` from `useShipmentForm`.                                            |
| 10  | Add form fields: Shipment Code (required), CV Number, No. of Sacks (required ≥ 0), Total CBM (required ≥ 0), Weight (required ≥ 0), Fee (required ≥ 0), Shipment Status (required), Date Created (required), Date Delivered (optional), Notes (optional) | Mantine `useForm` with inline `validate` per field.                                                            |
| 11  | Inline error messages are shown per field if validation fails                                                                                                                                                                                            | The form uses Mantine's standard form error display below each input.                                          |
| 12  | Optimistic update inserts a temporary record immediately on submit                                                                                                                                                                                       | A `tempShipment` with `id: Date.now()` is added to the query cache before the API call.                        |
| 13  | On API success the query is invalidated                                                                                                                                                                                                                  | `queryClient.invalidateQueries` triggers a refetch replacing the temp record with the real server record.      |
| 14  | On API failure the optimistic update is rolled back                                                                                                                                                                                                      | The context's `previousShipments` snapshot is restored via `queryClient.setQueryData`.                         |
| 15  | Failure notification: red                                                                                                                                                                                                                                | `showNotification({ title: '❌ Error', message: 'Failed to add shipment. Please try again.', color: 'red' })`. |

---

## D — Edit Shipment (Double-Click)

| #   | Logic                                                                | Explanation                                                                                                                              |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | Double-clicking a grid cell opens `EditShipmentModal`                | `handleCellClick` in `useShipmentForm` tracks the last click with `lastClickRef` and compares timestamps using `DOUBLE_CLICK_WINDOW_MS`. |
| 17  | Edit form is pre-populated with all fields from the clicked row      | `editShipmentForm.setValues(editingShipment)` is called when the modal opens.                                                            |
| 18  | Edit form uses the same validation rules as the add form             | Same required/non-negative checks for all numeric and code fields.                                                                       |
| 19  | Date strings from the grid are parsed to `Date` objects for the form | `parseDateString` handles `"MMM d, yyyy"` format (e.g. "Oct 10, 2025") without timezone conversion.                                      |
| 20  | Saving an edit calls `PUT /api/shipments/{id}`                       | `updateShipment` in `useShipmentsData` handles the mutation.                                                                             |

---

## E — Shipment Status & Flow

| #   | Logic                                                                                                           | Explanation                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 21  | Seven valid statuses: In Transit, Manila Port, With Pier Gatepass, PH Warehouse, For Pickup, Sorting, Delivered | `SHIPMENT_STATUS_OPTIONS` is the source of truth for all dropdowns.                                                            |
| 22  | Status drives the transaction "Order Status" mapping                                                            | When a shipment status is saved, the API maps it to either `'In Transit'` or `'Warehouse'` for all linked transaction records. |
| 23  | For Pickup, Sorting, and Delivered → `'Warehouse'`                                                              | These three statuses push linked transactions to `'Warehouse'` order status.                                                   |
| 24  | In Transit, Manila Port, With Pier Gatepass, PH Warehouse → `'In Transit'`                                      | These four map to `'In Transit'` for linked transactions.                                                                      |
| 25  | Unknown shipment status defaults to `'In Transit'`                                                              | A warning is logged and the in-transit mapping is used to preserve existing behaviour.                                         |

---

## F — Validation Rules

| #   | Logic                                   | Explanation                                                                                                                     |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 26  | Shipment Code is required               | `validateShipment` rejects any record with a blank `shipmentCode`.                                                              |
| 27  | Shipment Status is required             | A submission without `shipmentStatus` is rejected.                                                                              |
| 28  | Number of Sacks cannot be negative      | `noOfSacks` must be ≥ 0; zero is acceptable for placeholder records.                                                            |
| 29  | Total CBM cannot be negative            | `totalCBM` must be ≥ 0.                                                                                                         |
| 30  | Weight cannot be negative               | `weight` must be ≥ 0.                                                                                                           |
| 31  | Shipment Fee cannot be negative         | `fee` must be ≥ 0.                                                                                                              |
| 32  | Date Created is required                | A shipment without a creation date is rejected — it anchors all duration calculations.                                          |
| 33  | Arrival Date must be after Date Created | `validateShipment` checks `arrivalDate ≥ dateCreated`; if the arrival is set earlier than creation, the submission is rejected. |

---

## G — Duration Calculation

| #   | Logic                                                  | Explanation                                                                                                                             |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 34  | Persisted transit duration is rounded up to whole days | The shared API derives it with `Math.ceil(abs(delivered - created) / 86_400_000)`. A difference of 1 day and 1 minute counts as 2 days. |
| 35  | Duration is derived when both dates are valid          | If either date is missing or invalid, the API retains the sanitized supplied duration, or stores `null` when none is supplied.          |
| 36  | Duration is elapsed time, not business days            | The calculation uses the absolute millisecond difference; weekends and holidays are not excluded.                                       |

---

## H — Shipments Dashboard Tab

| #   | Logic                                                                                                    | Explanation                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 37  | Dashboard tab shows yearly shipment analytics                                                            | `ShipmentsDashboard` renders a year selector and monthly breakdown table.                                                                       |
| 38  | Year selector defaults to the current year                                                               | A Mantine `Select` is populated with the current year and the past 9 years (10 options total).                                                  |
| 39  | Monthly analytics include: total shipments, sacks, CBM, fees, longest/shortest/average delivery duration | For each of the 12 months, these seven values are calculated from the filtered year's shipment data.                                            |
| 40  | Delivery duration is only computed for Delivered shipments                                               | Only rows where `Shipment Status === 'Delivered'` with both `Date Created` and `Date Delivered` contribute to the min/max/avg duration columns. |
| 41  | Yearly totals are shown as a summary row                                                                 | `yearlyTotals` sums totalShipments, totalSacks, totalCBM, and totalFees across all 12 months.                                                   |
| 42  | Year-over-year comparison data is available                                                              | `comparisonData` computes the same monthly analytics for the previous year, enabling % change display.                                          |

---

## I — Transit Build Accounting Entry

| #   | Logic                                                                                        | Explanation                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | The shared transit build-up route still requires a shipment code plus linked valued products | The shipment-scoped route refuses to create entries until the shipment has a `shipmentCode` and at least one linked product with usable cost values. Clothing now triggers this workflow from the Products page instead of the Shipments edit modal.                                          |
| 44  | Posting date must be on or after the accounting cutover date                                 | The shared route rejects posting dates earlier than `2026-01-01` and directs pre-cutover values to opening balances instead.                                                                                                                                                                  |
| 45  | The amount comes from linked product costs, not the shipment fee                             | Transit build-up creates Grand Total entries only. Forwarder's Fee and Lalamove entry types are disabled via the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` feature flag. These costs are handled separately via the Logistics Costs tab.                                                    |
| 46  | Stable keys and source-flow guards remain active                                             | The shared route retains single-account and split-mode handling and rejects incompatible existing flows. Clothing wraps writes in a serializable transaction and enforces exclusive sources. It does not generically purge soft-deleted history or authorize delete/recreate as a correction. |

---

## J — Transit Reclass Accounting Entry

| #   | Logic                                                                                             | Explanation                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47  | Transit reclass is only allowed for Delivered shipments on or after the accounting cutover date   | The shared route rejects reclass requests unless the shipment status is `Delivered` and the posting date is on or after `2026-01-01`.                                                                                                                                                                                                    |
| 48  | Reclassing is source-aware and blocks missing, mixed, or duplicate processing                     | The shared route can target a selected subset via `selectedIdempotencyKeys`, but it rejects requests when transit build entries are missing, when selected entries use mixed source flows, or when the selected products were already reclassed.                                                                                         |
| 49  | Product-origin reclass uses the exact posted transit build-up amount instead of full linked COGS  | When active entries originate from the product workflow (`PRODUCT_TRANSIT_BUILD:*`), the route maps each selected transit build-up key back to its Product Code and reclasses the same posted amount. This keeps reclass aligned with product Grand Total postings while Forwarder, Courier, and Packaging stay in Landed Cost Clearing. |
| 50  | Clothing operator entrypoints for both transit build-up and reclass now live on the Products page | The shared shipment-scoped routes still power both workflows, but the Clothing UI now starts transit build-up and Reclass to Stock on Hand from the Products toolbar instead of the Shipments edit modal. Shipments now keeps the Logistics Costs tab plus shipment CRUD/dashboard tools.                                                |

---

## K — Statistics Aggregation

| #   | Logic                                                           | Explanation                                                                                                                     |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 51  | All statistics are derived from the currently **filtered** data | `calculateStatistics` operates on `filteredData`, not the full `shipments` array. Searching by shipment code narrows the stats. |
| 52  | Fee total is the sum across all filtered shipments              | `totalFees` = Σ `fee`.                                                                                                          |
| 53  | Sack count total is the sum across all filtered shipments       | `totalSacks` = Σ `noOfSacks`.                                                                                                   |
| 54  | CBM total is the sum across all filtered shipments              | `totalCBM` = Σ `totalCBM`.                                                                                                      |
| 55  | Weight total is the sum across all filtered shipments           | `totalWeight` = Σ `weight`.                                                                                                     |
| 56  | Status counts are a simple count of matching rows               | `inTransitShipments`, `deliveredShipments`, etc. each count rows where `Shipment Status === 'Status Name'`.                     |

---

## L — CSV Import

| #   | Logic                                         | Explanation                                                                                                                            |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 57  | CSV import is triggered via a `FileButton`    | Selecting a file calls `handleCSVImport(file)`.                                                                                        |
| 58  | CSV import parses multiple date formats       | Shipment dates accept `YYYY-MM-DD`, `MM-DD-YYYY`, and `MMDDYY` (legacy).                                                               |
| 59  | Numeric import fields use safe parsing        | All numeric columns (sacks, CBM, weight, fee) go through `toSafeNumber` which strips commas and returns 0 for blank/unparsable values. |
| 60  | Import rows with no Shipment Code are skipped | A row that produces a blank `shipmentCode` after parsing is silently skipped.                                                          |

---

## M — Logistics Costs Tab

> **Source file:** `src/modules/clothing/operations/shipments/components/LogisticsCostsTab.tsx`
>
> **API used:** `GET/POST /api/accounting/shipment-logistics` (administrator-only)

Confirmed on 2026-10-25: product forwarder/courier/packaging estimates are for
pricing and reseller preorders only. This tab records known actual KPC and
Lalamove charges, not estimated liabilities. See the
[accounting policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md#logistics-payable-workflow-forwarder--courier--packaging).

| #   | Logic                   | Explanation                                                                                                                                                                                                |
| --- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 61  | Actual costs only       | Pricing estimates remain visible but never prefill Actual Amount. The user enters the confirmed charge.                                                                                                    |
| 62  | Account configuration   | Clearing and per-vendor payable names remain in localStorage. The server rejects conflicting or changed account mappings for existing actual-cost entries.                                                 |
| 63  | Vendor separation       | Forwarder, Courier and Packaging have independent actual, unpaid and uncapitalized balances.                                                                                                               |
| 64  | Four actions            | Record Actual Cost: Dr Clearing / Cr Payable. Pay: Dr Payable / Cr Cash. Capitalize: Dr Stock on Hand / Cr Clearing. Adjust Down: Dr Payable / Cr Clearing.                                                |
| 65  | Partial payments        | Multiple payments are summed; the first partial payment does not mark the whole payable settled. Amounts cannot exceed the remaining payable.                                                              |
| 66  | Delivery safeguard      | Capitalization requires Delivered, cannot predate a known delivery date, and cannot exceed remaining clearing. There is no confirmation override.                                                          |
| 67  | Actual-cost corrections | Downward corrections are capped by both unpaid and uncapitalized balances. Overpayment/refund policy is not invented.                                                                                      |
| 68  | Stable journal identity | Source type SHIPMENT_LOGISTICS and structured shipment/vendor/action line keys replace description-based classification. Reference and description remain editable labels, not identity.                   |
| 69  | Retry and concurrency   | A UUID identifies one posting pair. Identical retries reuse it; changed payloads conflict. Serializable transactions arbitrate racing payments and roll back a failed second line.                         |
| 70  | Client submission guard | In-flight requests block repeated clicks. The pending key is retained in sessionStorage for an identical uncertain retry; changing the payload is a new intent and needs review after an uncertain result. |
| 71  | History readiness       | Loads are versioned by shipment; stale responses are ignored. Failed loads and ambiguous legacy manual history lock posting rather than appearing as an empty ledger.                                      |
| 72  | Legacy review           | Existing manual journals are displayed and preserved. Matching history requires review before guided posting; nothing is converted or repaired automatically.                                              |
| 73  | Success and failure     | Success clears amount/description and refreshes history. Errors are shown; the pending retry key is retained. Reset restores form defaults.                                                                |

Verification: four pure balance tests, thirteen API tests, authorization checks,
six component regressions and five real scratch-PostgreSQL scenarios cover the
new contract. This does not certify arbitrary manual accounting entries,
historical reconciliation, product COGS updates or real external delivery.

The later I08 actual UI/API sequence separately verifies one PHP200 actual charge,
one payment and one capitalization, followed by the administrator's dated
PHP20-to22 product-cost allocation: PHP8 sold COGS and PHP192 unsold carrying cost.
A later original-sale physical return restores corrected PHP22 value while all
five earlier reports and stored sale snapshots remain unchanged. Logistics replay
does not create another journal pair; allocation does not repay the vendor or
capitalize the same freight again. See the current reconciliation report for
the isolated result and verified cleanup; this is not a real-vendor audit.
