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

| #   | Logic                                                                                                          | Explanation                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 43  | Transit build-up requires a shipment code plus linked valued products                                          | The route refuses to create entries until the shipment has a `shipmentCode` and at least one linked product with usable cost values.                                                    |
| 44  | Posting date must be on or after the accounting cutover date                                                   | The shared route rejects posting dates earlier than `2026-01-01` and directs pre-cutover values to opening balances instead.                                                            |
| 45  | The amount comes from linked product costs, not the shipment fee, and can post in single-account or split mode | Single-account mode credits one allowed account; split mode allocates paid, supplier, forwarder, and courier amounts whose cent-precision total must match the computed shipment total. |
| 46  | Transit build-up entries are idempotent and block unsafe mode mixing                                           | Idempotency keys prevent duplicates, and shipments that already have legacy single-account entries cannot be mixed with the newer split-mode entry pattern.                             |

---

## J — Transit Reclass Accounting Entry

| #   | Logic                                                                                            | Explanation                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 47  | Transit reclass is only allowed for Delivered shipments on or after the accounting cutover date  | The shared route rejects reclass requests unless the shipment status is `Delivered` and the posting date is on or after `2026-01-01`.                                                     |
| 48  | Reclassing requires matching transit build-up entries and blocks missing or duplicate processing | The route can target a selected subset via `selectedIdempotencyKeys`, but it rejects requests when transit build entries are missing or when the selected entries were already reclassed. |

---

## K — Statistics Aggregation

| #   | Logic                                                           | Explanation                                                                                                                     |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 49  | All statistics are derived from the currently **filtered** data | `calculateStatistics` operates on `filteredData`, not the full `shipments` array. Searching by shipment code narrows the stats. |
| 50  | Fee total is the sum across all filtered shipments              | `totalFees` = Σ `fee`.                                                                                                          |
| 51  | Sack count total is the sum across all filtered shipments       | `totalSacks` = Σ `noOfSacks`.                                                                                                   |
| 52  | CBM total is the sum across all filtered shipments              | `totalCBM` = Σ `totalCBM`.                                                                                                      |
| 53  | Weight total is the sum across all filtered shipments           | `totalWeight` = Σ `weight`.                                                                                                     |
| 54  | Status counts are a simple count of matching rows               | `inTransitShipments`, `deliveredShipments`, etc. each count rows where `Shipment Status === 'Status Name'`.                     |

---

## L — CSV Import

| #   | Logic                                         | Explanation                                                                                                                            |
| --- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 55  | CSV import is triggered via a `FileButton`    | Selecting a file calls `handleCSVImport(file)`.                                                                                        |
| 56  | CSV import parses multiple date formats       | Shipment dates accept `YYYY-MM-DD`, `MM-DD-YYYY`, and `MMDDYY` (legacy).                                                               |
| 57  | Numeric import fields use safe parsing        | All numeric columns (sacks, CBM, weight, fee) go through `toSafeNumber` which strips commas and returns 0 for blank/unparsable values. |
| 58  | Import rows with no Shipment Code are skipped | A row that produces a blank `shipmentCode` after parsing is silently skipped.                                                          |
