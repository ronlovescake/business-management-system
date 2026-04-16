# Clothing — Shipments Business Logic

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

---

## A — Page Layout & Tabs

| #   | Logic                                                                         | Explanation                                                                                                                                  |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The page has three main areas: tab navigation, stats cards, and the data grid | The default active tab is `'shipments'` (the main list). Other tabs are `'dashboard'` and logistics costs.                                   |
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

| #   | Logic                                               | Explanation                                                                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 34  | Transit duration is always rounded up to whole days | `calculateDuration` uses `Math.ceil(diffMs / 86_400_000)`. A shipment that takes 1 day and 1 minute counts as 2 days. |
| 35  | Duration requires both dates to be present          | If either `dateCreated` or `dateDelivered` is missing, `calculateDuration` returns `''` — no duration is shown.       |
| 36  | Duration is in calendar days, not business days     | The calculation is a raw millisecond difference with no weekend/holiday exclusion.                                    |

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

| #   | Logic                                                                 | Explanation                                                                                                                                                                                                                                |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 43  | Transit build-up requires a shipment code plus linked valued products | The route refuses to create entries until the shipment has a `shipmentCode` and at least one linked product with usable cost values.                                                                                                       |
| 44  | Posting date must be on or after the accounting cutover date          | The shared route rejects posting dates earlier than `2026-01-01` and directs pre-cutover values to opening balances instead.                                                                                                               |
| 45  | The amount comes from linked product costs, not the shipment fee      | Transit build-up creates Grand Total entries only. Forwarder's Fee and Lalamove entry types are disabled via the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` feature flag. These costs are handled separately via the Logistics Costs tab. |
| 46  | Transit build-up entries are idempotent                               | Soft-deleted rows for the shipment are purged and entries re-created inside a Prisma `$transaction`, ensuring safe re-posting. The legacy single-account vs split-mode distinction has been removed.                                       |

---

## J — Transit Reclass Accounting Entry

| #   | Logic                                                                                            | Explanation                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47  | Transit reclass is only allowed for Delivered shipments on or after the accounting cutover date  | The shared route rejects reclass requests unless the shipment status is `Delivered` and the posting date is on or after `2026-01-01`.                                                                                                                                                                                                    |
| 48  | Reclassing is source-aware and blocks missing, mixed, or duplicate processing                    | The shared route can target a selected subset via `selectedIdempotencyKeys`, but it rejects requests when transit build entries are missing, when selected entries use mixed source flows, or when the selected products were already reclassed.                                                                                         |
| 49  | Product-origin reclass uses the exact posted transit build-up amount instead of full linked COGS | When active entries originate from the product workflow (`PRODUCT_TRANSIT_BUILD:*`), the route maps each selected transit build-up key back to its Product Code and reclasses the same posted amount. This keeps reclass aligned with product Grand Total postings while Forwarder, Courier, and Packaging stay in Landed Cost Clearing. |
| 50  | Clothing operator entrypoint for reclass now lives on the Products page                          | The shared shipment-scoped route still powers the workflow, but the Clothing UI now opens the Reclass to Stock on Hand modal from the Products toolbar instead of the Shipments edit modal. Shipments keeps Transit Build-Up and the Logistics Costs tab.                                                                                |

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
> **API used:** `GET /accounting/journal-lines-by-ref`, `POST /accounting/manual-journal`

| #   | Logic                                                                                      | Explanation                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 61  | The Logistics Costs tab implements **Pattern B**: capitalize logistics only when Delivered | An `Alert` banner explains the flow: (1) accrue to clearing, (2) pay payable, (3) capitalize at delivery. Transit build-up handles supplier costs; this tab handles forwarder, courier, and packaging costs separately.                                                              |
| 62  | Account names are configurable and persisted to `localStorage`                             | Four account name fields: **Clearing account**, **Forwarder payable**, **Courier payable**, **Packaging payable**. Defaults: `Landed Cost Clearing`, `Forwarder Payable`, `Courier Payable`, `Packaging Payable`. Storage key: `clothing.shipments.logisticsCosts.accountConfig.v1`. |
| 63  | Account names card is always visible (no accordion or toggle)                              | The card with account name inputs is permanently visible at the top of the tab.                                                                                                                                                                                                      |
| 64  | Three vendor types: Forwarder, Courier, Packaging                                          | Selected via a `Select` dropdown. Changing vendor resets the amount to 0 and re-evaluates the recommended action.                                                                                                                                                                    |
| 65  | Four action types: Accrue to Clearing, Pay Payable, Capitalize (Delivered), Adjust Down    | Displayed as styled `UnstyledButton` cards in a horizontal row. The recommended next action gets a blue "next" badge. Disabled actions show tooltip explanations.                                                                                                                    |
| 66  | Action buttons are smart-disabled based on posting history                                 | **Accrue**: disabled if already accrued. **Pay**: disabled if nothing accrued yet, or if already paid. **Capitalize**: disabled if shipment not Delivered, or if already capitalized. **Adjust Down**: disabled if nothing accrued.                                                  |
| 67  | Capitalize on a non-Delivered shipment shows a confirmation dialog                         | `window.confirm` with the current shipment status. If cancelled, posting is aborted.                                                                                                                                                                                                 |
| 68  | Each action maps to a specific debit/credit account pair                                   | **Accrue**: DR Clearing / CR Payable. **Pay**: DR Payable / CR Cash. **Capitalize**: DR Stock on Hand / CR Clearing. **Adjust Down**: DR Payable / CR Clearing.                                                                                                                      |
| 69  | Entry preview card shows debit/credit accounts and amount in real time                     | A blue tinted `Card` below the action buttons shows the computed debit, credit, and amount. Shows an orange warning if capitalizing a non-Delivered shipment.                                                                                                                        |
| 70  | Shipment summary card shows cost estimates from linked products                            | Displays the selected shipment's status, delivery date, product count, supplier total, and per-vendor cost estimates (Forwarder, Courier, Packaging). The active vendor's estimate is highlighted in blue/bold.                                                                      |
| 71  | Shipment cost estimates come from the expanded Shipments API                               | `ShipmentData` includes `linkedProductForwardersFee`, `linkedProductLalamove`, `linkedProductPackagingCost`, `linkedProductGrandTotal` — populated by the GET `/api/shipments` endpoint from cost-breakdown Maps.                                                                    |
| 72  | Amount auto-populates from the vendor's cost estimate                                      | On **Accrue**: uses the linked product estimate. On **Pay** or **Capitalize**: uses the net accrued amount (accrued − adjusted), falling back to the estimate if no accrual exists. Auto-populate only fires when amount is 0.                                                       |
| 73  | Stepper progress indicator tracks the 3-step flow                                          | A 3-step `Stepper` (Accrued → Paid → Capitalized) shows completed steps with green check marks and `₱{amount} on {date}`. Incomplete steps show a dashed circle icon.                                                                                                                |
| 74  | Steps are auto-detected from existing journal entries                                      | `detectCompletedSteps` inspects journal lines fetched via `GET /accounting/journal-lines-by-ref?ref={shipmentCode}`, matching description keywords (e.g. "accrued", "payable paid", "capitalized", "adjusted down") plus vendor keywords ("forwarder", "courier", "packaging").      |
| 75  | The recommended action is auto-selected when switching shipments or vendors                | `getNextRecommendedAction` returns the first incomplete step: accrue → pay → capitalize (if delivered). The form's action field is set to this value after history loads.                                                                                                            |
| 76  | Ref field auto-fills with the shipment code                                                | When switching shipments, if the current ref is empty or matches the previous shipment code, it updates to the new code.                                                                                                                                                             |
| 77  | Description is optional; auto-generated if blank                                           | Format: `{shipmentCode} • {vendor} • {actionLabel}`. Example: `KPC 23930A-00222 • Forwarder • Logistics cost accrued`.                                                                                                                                                               |
| 78  | Posting calls `POST /accounting/manual-journal`                                            | Payload: `{ date, ref, debitAccount, creditAccount, amount, description }`.                                                                                                                                                                                                          |
| 79  | Success notification: teal, "Logistics entry saved"                                        | Message shows `{debitAccount} / {creditAccount} • ₱{amount}`. Amount resets to 0 and description clears. History is refreshed.                                                                                                                                                       |
| 80  | Error notification: red, "Could not save entry"                                            | Shows the API error message.                                                                                                                                                                                                                                                         |
| 81  | Posting history table shows all journal entries matching the shipment code                 | A `Table` below the form with columns: Date, Account, Debit, Credit, Description. Data fetched via `GET /accounting/journal-lines-by-ref?ref={shipmentCode}`. Refreshed after each successful posting.                                                                               |
| 82  | Reset button restores the form to initial values                                           | Clears shipment code, amount, ref, description. Posting date resets to today.                                                                                                                                                                                                        |
