# Clothing — Prices Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/prices/services/PriceService.ts`
> - `src/modules/clothing/operations/prices/components/PricesPage.tsx`
> - `src/modules/clothing/operations/prices/components/AddPriceModal.tsx`
> - `src/modules/clothing/operations/prices/components/EditPriceModal.tsx`
> - `src/modules/clothing/operations/prices/hooks/usePricesData.ts`
> - `src/modules/clothing/operations/prices/hooks/usePriceForm.ts`

---

## A — Page Layout & Grid

| #   | Logic                                                                                       | Explanation                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The Prices page renders a Glide Data Grid (high-performance spreadsheet) for the price list | Columns: Product Code (grow), Lower Limit, Upper Limit, Prices, Price Adjustment. Grid height = 85% of window height; resizes on window resize with 150 ms throttle.              |
| 2   | A search input (Ctrl+F focus) filters the grid in real time                                 | `handleSearch` from `usePricesData` updates the search query; `debouncedFilteredPrices` is used for rendering to avoid per-keystroke redraws.                                     |
| 3   | Three action buttons sit above the grid                                                     | **Add Price** (opens AddPriceModal), **Import CSV** (FileButton — accepts a file then shows Import button), **Import** (triggers `handleCSVImport` only when a file is selected). |
| 4   | Statistics cards are rendered above the grid via `PriceStatsCards`                          | Cards show aggregate stats derived from `usePricesData.stats`.                                                                                                                    |

---

## B — Double-Click to Edit

| #   | Logic                                                                | Explanation                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Double-clicking a Product Code cell opens the Edit Price modal       | `onCellClicked` tracks `lastClickRef` (last clicked cell + timestamp). If the same cell is clicked again within 500 ms, it is treated as a double-click and `openEditModal` is invoked. `lastClickRef` is reset after handling. |
| 6   | Only the Product Code column triggers the edit modal on double-click | Clicks on Lower Limit, Upper Limit, Prices, and Price Adjustment columns have no double-click action.                                                                                                                           |
| 7   | Opening the Edit modal pre-fills tiers from the existing price data  | `openEditModal` calls `PriceService.priceDataToForm` on all price rows matching the clicked product code, then calls `syncEditFormWithProductPrice` to auto-fill prices from the product's Actual Price.                        |

---

## C — Add Price Modal

| #   | Logic                                                                                    | Explanation                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------ | --- | ----------------- |
| 8   | Opening the Add Price modal requires selecting a product code from a searchable dropdown | The dropdown is populated from `productCodeOptions` (loaded via `fetchProductCodes`). Field is required with asterisk.                                                                                                  |
| 9   | Up to 4 pricing tiers are supported                                                      | Each tier has Lower Limit (editable), Upper Limit (read-only, auto-filled), and Price (read-only, auto-filled from product Actual Price).                                                                               |
| 10  | Tier fields are disabled until the previous tier is fully filled                         | Tier N is only enabled when product code is selected AND tiers 1…N-1 each have non-zero lower limit, upper limit, and price.                                                                                            |
| 11  | Each tier's lower limit must be strictly greater than the previous tier's lower limit    | If `tier[i].lowerLimit ≤ tier[i-1].lowerLimit` (and both are > 0), an inline error is shown: "Must be greater than X". Submit is blocked while any tier has a validation error.                                         |
| 12  | Submit is disabled while there are validation errors or no data is entered               | `isSubmitDisabled = hasValidationErrors                                                                                                                                                                                 |     | !productCode |     | !anyTierHasData`. |
| 13  | Successful add shows a green notification; failure shows a red notification              | Success: title "🎉 Price Added Successfully!", message "[Product Code] has been added to your pricing database", color green, autoClose 4000 ms. Failure: title "❌ Failed to Add Price", color red, autoClose 4000 ms. |
| 14  | Cancel and modal close both reset the form                                               | `handleClose` calls `onReset()` then `onClose()`.                                                                                                                                                                       |

---

## D — Edit Price Modal

| #   | Logic                                                                                               | Explanation                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | The Edit modal shows the product code as a read-only TextInput                                      | Product code cannot be changed during an edit; only tier values can be modified.                                                                                                                                              |
| 16  | Price auto-sync: when the modal opens, tier prices are recalculated from the product's Actual Price | `syncEditFormWithProductPrice` fetches `/products`, finds the product, then calls `applyActualPriceToTiers`. The highest filled tier gets `actualPrice`; each lower tier gets `actualPrice + 5 × (highestIndex − i)`.         |
| 17  | Clearing a tier's lower limit cascades to zero its upper limit and price                            | When `lowerLimit` is set to 0, the corresponding tier's upper limit and price are also zeroed. If a product code is set, a `setTimeout(0)` then recalculates prices for remaining tiers from `/products`.                     |
| 18  | Submit is disabled while there are validation errors or all tiers are empty                         | Same `isSubmitDisabled` logic as Add modal (without the product-code check).                                                                                                                                                  |
| 19  | Successful edit shows a blue notification; failure shows a red notification                         | Success: title "🎉 Price Updated Successfully!", message "[Product Code] has been updated in your pricing database", color blue, autoClose 4000 ms. Failure: title "❌ Failed to Update Price", color red, autoClose 4000 ms. |
| 20  | Cancel and close both reset the edit form                                                           | `handleClose` calls `onReset()` then `onClose()`.                                                                                                                                                                             |

---

## E — CSV Import

| #   | Logic                                                                                    | Explanation                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 21  | A FileButton lets the user pick a CSV file; a separate Import button triggers the import | The file state is held locally. The Import button only activates once a file is selected.                                                                        |
| 22  | If the CSV has no valid price data, a yellow warning notification is shown               | Title "⚠️ Import Warning", message from `result.error` or "No valid price data found in the CSV file", color yellow, autoClose 4000 ms.                          |
| 23  | A successful CSV import shows a green notification with the import count                 | Title "🎉 Import Successful!", message "Successfully imported N price records to database", color green, autoClose 4000 ms. File input is cleared after success. |
| 24  | A failed CSV parse shows a red error notification                                        | Title "❌ Import Failed", message "Failed to parse CSV file. Please check the file format.", color red, autoClose 4000 ms.                                       |
| 25  | CSV import calls `replaceAllPrices` which replaces the entire price database             | `PriceService.importFromCSV` parses the file; on success the data is POSTed via `replaceAllPrices` which performs a full replace (not a merge).                  |

---

## F — Tier Validation Rules (Service Layer)

| #   | Logic                                                                                      | Explanation                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | At least one price tier is required                                                        | `validatePrice` rejects a submission where no tiers are defined.                                                                                                |
| 27  | Each tier's lower limit must be greater than zero                                          | A tier with `lowerLimit ≤ 0` fails validation.                                                                                                                  |
| 28  | Each tier's upper limit must be greater than zero                                          | A tier with `upperLimit ≤ 0` fails validation.                                                                                                                  |
| 29  | Each tier's price must be greater than zero                                                | A tier with `price ≤ 0` fails validation.                                                                                                                       |
| 30  | Lower limit must be less than upper limit within a tier                                    | `lowerLimit < upperLimit` is required for each individual tier.                                                                                                 |
| 31  | Tiers must be ordered: each tier's lower limit must exceed the previous tier's lower limit | Across adjacent tiers, `tier[i].lowerLimit > tier[i-1].lowerLimit`. Overlapping or out-of-order tiers fail validation.                                          |
| 32  | Only tiers with a positive lower limit are exported                                        | `formToMultiplePriceData` filters out any tier row where `lowerLimit ≤ 0` before constructing the database records, ensuring no placeholder rows reach storage. |

---

## G — Bulk Price Adjustments

| #   | Logic                                                      | Explanation                                                                                                                                              |
| --- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 33  | Bulk adjustments are applied as a delta, not a replacement | The price adjustment form captures a signed delta amount; each tier's price is incremented/decremented by the adjustment value.                          |
| 34  | One PriceData record is created per tier per adjustment    | `formToMultiplePriceData` returns an array — one element per tier whose `lowerLimit > 0`. All elements share the same adjustment metadata (date, notes). |

---

## H — Price Statistics

| #   | Logic                                                              | Explanation                                                                                                            |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 35  | Average price is computed across all active price tiers            | `calculateStats` returns `avgPrice = Σ(price) / count`.                                                                |
| 36  | Total adjustment count tracks all historical adjustments           | `totalAdjustments` is the count of all price records, including both increases and decreases.                          |
| 37  | Increases and decreases are tracked separately                     | `priceIncreases` = count of records where `adjustment > 0`; `priceDecreases` = count where `adjustment < 0`.           |
| 38  | Zero-adjustment records are excluded from increase/decrease counts | A record where `adjustment === 0` contributes to `totalAdjustments` but not to either the increase or decrease bucket. |
