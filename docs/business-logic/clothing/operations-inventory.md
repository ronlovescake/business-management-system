# Clothing — Inventory Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSubmit.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryQuickAdjustments.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentEditActions.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryPage.ts`
> - `src/modules/clothing/operations/inventory/components/InventoryPage.tsx`

---

## A — Page Layout & Tabs

| #   | Logic                                                         | Explanation                                                                                                                                                                     |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The Inventory page has two tabs: Inventory and Adjustments    | Default tab is `inventory`. The `InventorySummary` and `InventoryTable` render under the Inventory tab; the adjustment movement history renders under Adjustments.              |
| 2   | A search input filters the inventory table                    | `searchQuery` state is updated live; `filteredData` applies the query. A sellable filter dropdown further narrows to non-zero-sellable products (default: `non_zero_sellable`). |
| 3   | Inventory tablecontrols include Import and Export CSV buttons | `onImport` = `handleImportCSV`; `onExport` = `handleExportCSV`. Both are currently simulation-only (see E below).                                                               |
| 4   | If data load fails, a red notification is shown               | Title "Error", message "Failed to load inventory data", color red.                                                                                                              |

---

## B — Inventory Quantity Buckets

| #   | Logic                                                                 | Explanation                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Seven adjustment bucket types feed every product's inventory position | The buckets are: `damaged_hold`, `supplier_short`, `sold` (via order status), `mix_reserved`, `mix_sold`, `scrap`, `additionals`, and `transfer_sellable`.                                  |
| 6   | "Sold" is derived from order statuses, not a manual bucket            | `soldOrderStatuses = { 'ready for dispatch', 'checked out', 'shipped' }`. Any transaction in one of these statuses contributes its quantity to `soldQty`.                                   |
| 7   | Mix-and-match demand is split into reserved vs. sold                  | `mixReservedQty` = MnM orders in non-completed statuses; `mixSoldQty` = MnM orders in `soldOrderStatuses`. They are tracked separately to distinguish unfulfilled vs. fulfilled MnM demand. |
| 8   | Additionals are identified by note prefix                             | A movement row whose note starts with `"additionals"` (case-insensitive) is classified into the `additionalsQty` bucket.                                                                    |
| 9   | Transfers are identified by note prefix                               | A movement row whose note starts with `"transfer"` (case-insensitive) contributes to `transferSellableDelta`.                                                                               |
| 10  | Damaged and Supplier Short have their own buckets                     | `damagedDelta` sums `damaged_hold` movement records; `supplierShortDelta` sums `supplier_short` records.                                                                                    |
| 11  | Scrap has its own bucket                                              | `scrapQty` aggregates `scrap` movement records.                                                                                                                                             |

---

## C — Derived Quantity Formulas

| #   | Logic                                                   | Explanation                                                                                                                                                       |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12  | Actual Quantity Received floors at zero                 | `actualQuantityReceived = max(0, qty + additionalsQty − supplierShortDelta − damagedDelta)`.                                                                      |
| 13  | Committed Quantity = Mix Reserved quantity              | `committedQty = mixReservedQty` — these are units earmarked for MnM orders not yet fulfilled.                                                                     |
| 14  | Direct Sellable Quantity floors at zero                 | `directSellableQty = max(0, actualQuantityReceived − committedQty − soldQty − scrapQty + transferSellableDelta)`.                                                 |
| 15  | All bucket and derived values have a floor of zero      | Every bucket and derived field uses `Math.max(0, …)` to prevent negative inventory from appearing in the UI.                                                      |
| 16  | Bundle committed quantities are excluded from inventory | The inventory transform intentionally ignores bundle-level reserved quantities to avoid confusing operators with "locked" stock still available for direct sales. |
| 17  | Each product row is independently computed              | `buildInventoryItems` maps over each product independently; there are no cross-product rollup calculations on the client.                                         |

---

## D — Adjustment Modal (Full Adjustment)

| #   | Logic                                                                 | Explanation                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | The Adjust button opens the adjustment modal for the selected product | The modal shows current on-hand quantities per bucket and allows entering new target quantities.                                                                                                                                                                                       |
| 19  | Transfer destination is required when any transferDelta is non-zero   | If the operator fills in a transfer amount but leaves the "Transfer To" product blank, a red notification blocks submission: title "Transfer destination required", message "Select Transfer To product code when transfer quantity is set."                                           |
| 20  | Transferring to the same product is blocked                           | If destination = source product code (normalized), a red notification is shown: title "Invalid transfer destination", message "Transfer To must be a different product code from the source product."                                                                                  |
| 21  | Out-of-stock sellable check blocks negative inventory                 | If total planned sellable-out exceeds `selectedOnHand + plannedSellableIn + plannedTransferIn`, a red notification is shown: title "Quantity exceeds sellable on-hand", message "Available sellable units for [Product]: N".                                                           |
| 22  | Reverse-transfer checks destination product's on-hand                 | If `transferDelta < 0`, the reverse transfer quantity is checked against the destination product's `getSellableOnHand`. If it exceeds it, a red notification is shown: title "Transfer exceeds destination sellable on-hand", message "Available sellable units for [destination]: N". |
| 23  | Note-only updates skip quantity bucket writes                         | If no bucket delta and no transfer delta exist, but notes changed, the system performs a lightweight `updateMovement` on the latest movement row. Success: title "Saved", message "Adjustment note updated", color green. Failure: red error notification.                             |
| 24  | Zero-delta with no note change shows a blue info notification         | Title "No changes", message "All adjustment targets and transfer values already match current values.", color blue. Modal closes.                                                                                                                                                      |
| 25  | Successful full adjustment shows a green notification                 | Title "Saved", message "Adjustment recorded", color green. Bucket quantities, transfer fields, and notes are reset.                                                                                                                                                                    |
| 26  | Failed full adjustment shows a red error notification                 | Title "Error", message from the thrown Error or "Failed to record movement", color red.                                                                                                                                                                                                |
| 27  | Transfer movements use a structured note format                       | Outbound transfer note: `[transferNoteMarker] from:[sourceCode]; to:[destCode]; note:[notes]` (note part omitted if empty). The same note is applied to the matching inbound movement on the destination product.                                                                      |
| 28  | Additionals movements prefix their notes                              | Outbound/inbound additionals notes are prefixed with `additionalsNoteMarker`. If the user provides extra notes, they are appended: `[additionalsNoteMarker] [userNotes]`.                                                                                                              |

---

## E — Quick Adjustment Modals (Supplier Short & Additionals)

| #   | Logic                                                               | Explanation                                                                                                                                 |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 29  | Supplier Short modal records a `sellable → supplier_short` movement | Requires a product code, a positive quantity, and optional posting date and notes. Submit is blocked if product or quantity is absent/zero. |
| 30  | Successful Supplier Short save shows a green notification           | Title "Saved", message "Supplier short recorded", color green. Quantity resets to 1, notes clear, modal closes.                             |
| 31  | Failed Supplier Short save shows a red notification                 | Title "Error", message from thrown Error or "Failed to record supplier short", color red.                                                   |
| 32  | Additionals modal records a `supplier_short → sellable` movement    | Requires a product code and positive quantity. Notes are automatically prefixed with `additionalsNoteMarker`.                               |
| 33  | Successful Additionals save shows a green notification              | Title "Saved", message "Additionals recorded", color green. Quantity resets to 1, notes clear, modal closes.                                |
| 34  | Failed Additionals save shows a red notification                    | Title "Error", message from thrown Error or "Failed to record additionals", color red.                                                      |

---

## F — Edit & Delete Adjustment Movements

| #   | Logic                                                                | Explanation                                                                                                                                                                                                                                                        |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 35  | Clicking "Edit" on an adjustment row opens the Edit modal pre-filled | `openEditMovement` finds the matching movement by ID, pre-fills productCode, quantity, and toBucket, then opens the edit modal.                                                                                                                                    |
| 36  | Edit modal validates quantity does not exceed available sellable     | If the movement is `sellable → damaged_hold` or `sellable → scrap` and the new quantity exceeds `currentSellable + originalQuantity`, a red notification is shown: title "Quantity exceeds sellable on-hand", message "Available sellable units for [Product]: N". |
| 37  | Successful edit shows a green notification                           | Title "Updated", message "Adjustment updated", color green. Modal closes and editing state resets.                                                                                                                                                                 |
| 38  | Failed edit shows a red notification                                 | Title "Error", message from thrown Error or "Failed to update movement", color red.                                                                                                                                                                                |
| 39  | Deleting an adjustment movement requires native `window.confirm`     | Prompt: "Delete this adjustment?\n\n[Product Code]: [Qty] -> [toBucket]". Only proceeds if confirmed.                                                                                                                                                              |
| 40  | Successful delete shows a green notification                         | Title "Deleted", message "Adjustment deleted", color green.                                                                                                                                                                                                        |
| 41  | Failed delete shows a red notification                               | Title "Error", message from thrown Error or "Failed to delete movement", color red.                                                                                                                                                                                |

---

## G — CSV Import & Export (Simulation)

| #   | Logic                                                        | Explanation                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 42  | CSV import is currently a simulation — no data is written    | `handleImportCSV` checks for `.csv` extension (else shows `showInfo` "Invalid File" alert), then after 800 ms shows a `showInfo` "Import Simulation" alert: "Would import inventory records from '[filename]'". `isImporting` flag is set during the delay. |
| 43  | CSV export is currently a simulation — no file is downloaded | `handleExportCSV` calls `showInfo` "Export Simulation": "Would export the filtered inventory dataset to CSV." No file is generated.                                                                                                                         |

---

## H — Transfer Validation Rules

| #   | Logic                                                               | Explanation                                                                                                                                      |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 44  | Transfer destination is required when any transferDelta is non-zero | If the operator fills in a transfer amount but leaves the destination product blank, the adjustment is blocked with an error.                    |
| 45  | Transferring to the same product is blocked                         | If the destination product code matches the source product code, the system rejects the adjustment. A product cannot be its own transfer target. |
