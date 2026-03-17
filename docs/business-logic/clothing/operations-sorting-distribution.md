# Clothing — Sorting & Distribution Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/sorting-distribution/services/SortingDistributionService.ts`
> - `src/modules/clothing/operations/sorting-distribution/components/SortingDistributionPage.tsx`
> - `src/modules/clothing/operations/sorting-distribution/components/InfoSection.tsx`
> - `src/modules/clothing/operations/sorting-distribution/components/DistributionSummaryBar.tsx`
> - `src/modules/clothing/operations/sorting-distribution/components/QuantityPillButtons.tsx`
> - `src/modules/clothing/operations/sorting-distribution/hooks/useSortingDistributionData.ts`
> - `src/modules/clothing/operations/sorting-distribution/hooks/useSortingDistributionForm.ts`

---

## A — Page Layout & Product Selection

| #   | Logic                                                                                                                       | Explanation                                                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The page consists of: Info Section (top), a Handsontable spreadsheet grid (middle), and a Distribution Summary Bar (bottom) | No tabs — one continuous vertical layout. PageLayout is `fluid` with padding.                                                                                                                                   |
| 2   | Product code is selected from a searchable 500 px-wide Select dropdown                                                      | The dropdown is focused with Ctrl+F (or Cmd+F on Mac). The selected cell in the table is deselected before the dropdown opens (to prevent arrow-key conflicts).                                                 |
| 3   | The selected product code is persisted to `localStorage` under `sorting-distribution-product-code`                          | On mount, if products have loaded and `form.item` is empty, the saved code is restored from localStorage if it still exists in the product list. Clearing the product removes the localStorage entry.           |
| 4   | An "Include All Products" toggle shows or hides products with zero sellable on-hand                                         | When off (default), only products with stock appear in the dropdown. When on, all products are listed.                                                                                                          |
| 5   | Stats displayed in the Info Section header                                                                                  | Ordered, Movement Sellable On Hand, Total Distribution, and Available Stock are shown as fixed-width stat chips aligned to the right of the product selector.                                                   |
| 6   | Customer notes popover shows order-level notes for the selected product                                                     | All transactions for the selected product that have a non-blank `Notes`/`Note`/`Requests`/`Request`/`Remarks` field are de-duplicated and displayed in a popover. Each entry shows Customer name and note text. |
| 7   | Product photo is shown in a popover if the product has a `Link To Post` value                                               | If the link is a Google Drive URL, it is converted to a Drive preview embed URL. The photo popover is accessible via a camera icon.                                                                             |

---

## B — Quantity Pill Buttons

| #   | Logic                                                               | Explanation                                                                                                                   |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 8   | Unique quantities from existing transactions appear as pill buttons | `uniqueQuantities` is derived from the loaded transactions for the selected product. Clicking a pill sets `selectedQuantity`. |
| 9   | Clicking the active pill deselects it                               | If the already-selected quantity pill is clicked again, `selectedQuantity` is set to null.                                    |
| 10  | `selectedQuantity` drives the Distribution column                   | `calculateDistribution` uses `selectedQuantity` as the target total to be distributed proportionally.                         |

---

## C — Quantity Mismatch Alert (SweetAlert2)

| #   | Logic                                                                                | Explanation                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------- |
| 11  | A floating SweetAlert2 alert appears when `totalDistribution ≠ selectedQuantity`     | When `selectedQuantity !== null && selectedQuantity − totalDistribution !== 0`, the alert is shown at the top of the screen. The alert is non-blocking (backdrop: false, allowOutsideClick: false but allowEscapeKey: true). |
| 12  | Alert shows "Add N" when totalDistribution < selectedQuantity (info icon, blue)      | `quantityDifference > 0` → icon = `info`, iconColor `#228be6`. Message: `Add [N]` in 24 px bold.                                                                                                                             |
| 13  | Alert shows "Deduct N" when totalDistribution > selectedQuantity (warning icon, red) | `quantityDifference < 0` → icon = `warning`, iconColor `#fa5252`. Message: `Deduct [                                                                                                                                         | N   | ]` in 24 px bold. |
| 14  | The alert closes automatically when the mismatch is resolved                         | When `showQuantityAdjustment` transitions to false, `Swal.close()` is called if the alert is still visible.                                                                                                                  |
| 15  | Alert uses a rotating icon animation                                                 | CSS is injected once (with id `rotating-icon-animation`) for `rotateY` infinite 2 s linear animation on the SweetAlert icon.                                                                                                 |
| 16  | Alert position is `top`; no confirm button; custom box shadow and compact padding    | `didOpen` adjusts the popup's box-shadow, padding, icon size, and html-container margin for a compact appearance.                                                                                                            |

---

## D — Handsontable Grid

| #   | Logic                                                                                                                                   | Explanation                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17  | Grid columns: Quantity (editable), Percentage (read-only), Group Number (read-only), Distribution (read-only), Checkbox (checkbox type) | Quantity is the only directly editable column. Distribution, Percentage, and Group Number are derived and read-only.                                                                                                               |
| 18  | Zeroes are hidden in the grid to keep it visually clean                                                                                 | The custom `greyedOutRenderer` suppresses display of `0` in all non-checkbox, non-percentage columns. The underlying data value is preserved.                                                                                      |
| 19  | Checked rows are greyed out                                                                                                             | `greyedOutRenderer` sets `backgroundColor: #f0f0f0` and `color: #999` for rows where `row.checked === true`.                                                                                                                       |
| 20  | Cut (Ctrl+X) is disabled in the grid                                                                                                    | `beforeCut` hook returns `false`, preventing clipboard removal of grid data.                                                                                                                                                       |
| 21  | Context menu is disabled                                                                                                                | `contextMenu={false}` — right-click produces no grid context menu.                                                                                                                                                                 |
| 22  | Row/column insertion and removal are disabled                                                                                           | `allowInsertRow`, `allowInsertColumn`, `allowRemoveRow`, `allowRemoveColumn` are all false.                                                                                                                                        |
| 23  | Ctrl/Cmd+Arrow smart navigation skips empty cells                                                                                       | A global `keydown` listener (capture phase) intercepts Ctrl+Arrow keys and jumps to the next/previous non-empty cell in the direction pressed, or to the edge if none exists. Checkbox columns are skipped during this navigation. |

---

## E — Auto-Save

| #   | Logic                                                                              | Explanation                                                                                                                                                       |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | Changes are auto-saved after a 1-second debounce (AUTO_SAVE_DELAY = 1000 ms)       | Whenever `rows` or `selectedQuantity` changes and differs from the last-saved snapshot, a 1 s timeout is set. Any new change within that window resets the timer. |
| 25  | The Distribution Summary Bar shows "Saving…" (blue) or "All changes saved" (green) | `isSaving` state (true during the API call) drives the text and color in `DistributionSummaryBar`.                                                                |
| 26  | Auto-save calls `SortingDistributionService.saveDistributionData`                  | Saves the product code, selected quantity, and all rows. On success, `lastSavedRowsRef` and `lastSavedSelectedQuantityRef` are updated to the current snapshot.   |
| 27  | Auto-save failures are logged only — no user-facing error notification             | `logger.error('❌ AUTO-SAVE failed:', error)` is called; no `showNotification` is triggered.                                                                      |
| 28  | Switching product code cancels any pending auto-save                               | When `productCode` changes, `clearTimeout(saveTimeoutRef.current)` is called, refs are reset, and previously loaded rows are replaced with an empty set.          |

---

## F — Percentage Calculation

| #   | Logic                                              | Explanation                                                                                                                           |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 29  | Percentage = (Row Quantity ÷ Total Quantity) × 100 | `calculatePercentage(qty, total)` produces the share of a row's quantity relative to the full group total. Returns 0 when total is 0. |
| 30  | Percentages are not rounded at the service layer   | The raw floating-point result is returned; rounding/display is handled by the UI column formatter.                                    |

---

## G — Distribution Calculation

| #   | Logic                                                    | Explanation                                                                                                                                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 31  | Distribution = round(qty ÷ estQtyReceived × selectedQty) | `calculateDistribution(qty, estQtyReceived, selectedQty)` allocates a pro-rata share of the operator-selected total quantity to each row using `Math.round`. |
| 32  | Returns 0 when estimated quantity received is zero       | Division-by-zero is guarded: if `estQtyReceived` is 0, distribution returns 0.                                                                               |
| 33  | Distribution is independent per row                      | Each row's distribution is calculated individually; there is no re-balancing step to ensure the column sums to exactly `selectedQty`.                        |

---

## H — Group Number Auto-Assignment

| #   | Logic                                                   | Explanation                                                                                                                   |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 34  | Group numbers are auto-assigned sequentially            | `assignGroupNumbers` iterates all rows in order; rows with `qty > 0` receive "Number 1", "Number 2", etc.                     |
| 35  | Rows with zero quantity are skipped                     | A row whose quantity is 0 or falsy receives no group number — the group label is left blank for that row.                     |
| 36  | Group numbering restarts from 1 on every re-calculation | There is no persistence of previous group numbers; every call to `assignGroupNumbers` produces a fresh sequential assignment. |

---

## I — Derived Fields Recalculation

| #   | Logic                                                     | Explanation                                                                                                                                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 37  | All three derived columns are recomputed in a single pass | `calculateDerivedFields(rows, totalQty, selectedQty)` recomputes percentage, distribution, and group number for every row in one iteration — there is no partial update. |
| 38  | Grid row count is fixed                                   | `GRID_ROW_COUNT` is a module constant that determines how many rows the grid always renders, even if some are empty.                                                     |
