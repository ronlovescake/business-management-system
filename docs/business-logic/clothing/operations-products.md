# Clothing — Products Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/products/services/ProductService.ts`
> - `src/modules/clothing/operations/products/services/productServiceHelpers.ts`
> - `src/modules/clothing/operations/products/services/BundleService.ts`
> - `src/modules/clothing/operations/products/lib/mixAndMatchAllocation.ts`
> - `src/modules/clothing/operations/products/hooks/useProductsGrid.tsx`
> - `src/modules/clothing/operations/products/hooks/useProductsData.ts`
> - `src/modules/clothing/operations/products/hooks/useProductForm.ts`
> - `src/modules/clothing/operations/products/hooks/useShippingFeeCalculator.ts`
> - `src/modules/clothing/operations/products/components/ProductsPage.tsx`
> - `src/modules/clothing/operations/products/components/ProductsGridControls.tsx`
> - `src/modules/clothing/operations/products/components/AddProductModal.tsx`
> - `src/modules/clothing/operations/products/components/ProductsGridFooter.tsx`
> - `src/modules/clothing/operations/products/components/ProductStatsCards.tsx`
> - `src/modules/clothing/operations/products/components/ShippingFeeCalculator.tsx`
> - `src/modules/clothing/operations/products/components/ShippingCalculatorCard.tsx`
> - `src/modules/clothing/operations/products/components/ShippingCostBreakdown.tsx`
> - `src/modules/clothing/operations/products/components/ShippingResultSummary.tsx`
> - `src/modules/clothing/operations/products/components/BundlesTab.tsx`
> - `src/modules/clothing/operations/products/components/MixAndMatchTab.tsx`
> - `src/lib/productCalculations.ts`

---

## A — Validation Rules

| #   | Logic                                                | Explanation                                                                                                                                                                                   |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Product name is required                             | `validateProduct` rejects with error "Product name is required" when the `product` field is blank or whitespace-only.                                                                         |
| 2   | Unit price cannot be negative                        | Fails validation with "Unit price cannot be negative"; zero is allowed.                                                                                                                       |
| 3   | Quantity cannot be negative                          | Fails validation with "Quantity cannot be negative".                                                                                                                                          |
| 4   | Exchange rate must be greater than zero              | Fails with "Exchange rate must be greater than 0"; zero causes division-by-zero in financial calculations.                                                                                    |
| 5   | Bulk quantity cannot be negative                     | Fails with "Bulk quantity cannot be negative".                                                                                                                                                |
| 6   | Bulk weight cannot be negative                       | Fails with "Bulk weight cannot be negative".                                                                                                                                                  |
| 7   | Weight per piece cannot be negative                  | Fails with "Weight per piece cannot be negative".                                                                                                                                             |
| 8   | Card ID required when payment method is CARD         | Fails with "Select a saved card when payment method is Card" when `paymentMethod === 'CARD'` and `paymentCardId` is blank.                                                                    |
| 9   | Validation errors surface as red toast notifications | `handleSubmitProduct` calls `validate()`; if `!validation.isValid`, a red Mantine notification titled **"Validation Error"** with the first error message is shown and the submit is aborted. |

---

## B — Financial Calculations (Costing Model)

| #   | Logic                                                                 | Explanation                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | PHP = Unit Price × Exchange Rate                                      | CNY-to-PHP conversion: `PHP = unitPrice × exchangeRates`.                                                                                                                         |
| 11  | Sub Total (PHP) = PHP × Quantity                                      | Total cost before logistics: `subTotalPHP = php × quantity`.                                                                                                                      |
| 12  | Transaction fee is conditionally applied                              | If `applyTransactionFee` is true, `TRANSACTION_FEE_RATE` (2.99%) is applied. On the edit form, rate is preserved: if the stored `Transaction Fee` is 0, the fee toggle stays off. |
| 13  | Grand Total = Sub Total + Transaction Fee + Alibaba Shipping Cost     | `grandTotal = subTotalPHP + transactionFee + alibabaShippingCost`.                                                                                                                |
| 14  | Forwarder's fee, Lalamove, and packaging cost are tracked per-product | These three logistics costs feed the Landed Unit Cost.                                                                                                                            |
| 15  | Landed Unit Cost = (Grand Total + Logistics Costs) ÷ Quantity         | `basePrice = (grandTotal + forwardersFee + lalamove + packagingCost) / quantity`. Accounting unit-cost basis for COGS.                                                            |
| 16  | COGS = Landed Unit Cost × Quantity                                    | `cogs = basePrice × quantity`.                                                                                                                                                    |
| 17  | Suggested Price uses a configurable markup                            | `suggestedPrice = landedUnitCost × (1 + SUGGESTED_PRICE_MARKUP)`. The modal displays a note: "Minimum selling price (122% markup)".                                               |
| 18  | Projected Sales = Actual Price × Quantity                             | `projectedSales = actualPrice × quantity`.                                                                                                                                        |
| 19  | Projected Profit = Projected Sales − COGS                             | `projectedProfit = projectedSales − cogs`.                                                                                                                                        |
| 20  | Projected Profit % = (Projected Profit ÷ Projected Sales) × 100       | Returns 0 when Projected Sales is 0.                                                                                                                                              |
| 21  | Total Markup = Actual Price ÷ Landed Unit Cost − 1                    | Returns 0 when Landed Unit Cost is 0.                                                                                                                                             |
| 22  | Weight Per Piece = Bulk Weight ÷ Bulk Quantity                        | Returns 0 when Bulk Quantity is 0. Displayed as a read-only computed field in the modal.                                                                                          |
| 23  | Exchange rate defaults to 1 if zero on load                           | When loading a product whose stored exchange rate is 0, the form initialises it to 1 to prevent cascading zero calculations.                                                      |
| 24  | Financial calculations are live in the modal                          | `useProductForm` calls `calculateProductFinancials` on every form field change via `useMemo`; results update all seven display cards in real time.                                |
| 25  | Profit and margin cards change colour by sign                         | "Projected Profit" card uses `red.6` when negative, `green.6` when positive. "Profit Margin" card applies the same colour rule.                                                   |

---

## C — Product Code Generation

| #   | Logic                                                   | Explanation                                                                                                                                           |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | Product code is always regenerated from name + date     | `generateProductCode` runs on every save; the code is never manually editable by the user.                                                            |
| 27  | Initials are built from product name words              | `buildProductInitials` takes the first letter of each significant word, skipping stop-words like "and", "the", "of".                                  |
| 28  | Special-case strings are expanded                       | "2-PC" → "2S", "3-PC" → "3S", "4-PC" → "4S" per the `PRODUCT_CODE_SPECIAL_CASES` lookup table.                                                        |
| 29  | Words with special characters extract uppercase letters | Words containing `&`, `/`, `.`, `+` extract any uppercase letters present; otherwise use the first letter of each sub-part split by those characters. |
| 30  | Posting date is formatted as MMDDYY in the code         | `formatPostingDateForProductCode` strips the year to two digits: "2025-01-04" → "010425".                                                             |
| 31  | Final format: "Product Name (INITIALS-MMDDYY)"          | Example: "Kids T-Shirt 2-PC" posted 2025-01-04 → "Kids T-Shirt 2-PC (KTS2S-010425)".                                                                  |

---

## D — Age Range

| #   | Logic                                    | Explanation                                                                                                                  |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 32  | Age range is stored as a formatted label | `buildAgeRangeLabel` combines `ageRangeStart`, `ageRangeEnd`, and `ageRangeUnit` into "3-6 months".                          |
| 33  | Age range is parsed back on edit         | `productToForm` reverse-parses the stored label with a regex "number-number unit" to restore the three separate form fields. |
| 34  | Partial age ranges are supported         | Start-only or end-only values produce a label without the missing component.                                                 |

---

## E — Shipment Code Linkage

| #   | Logic                                                               | Explanation                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35  | Shipment fields are only populated when a code is present           | CV Number, No. of Sacks, Total CBM, Weight, and Shipment Status are inherited from the existing product only when a non-blank Shipment Code is set on save.                                                               |
| 36  | Clearing the Shipment Code in the grid blanks all shipment metadata | In `handleAfterChange`, when column 0 (SHIPMENT CODE) is set to blank or empty, the product row's `Shipment Code`, `CV Number`, `No. Of Sacks`, `Total CBM`, `Weight`, and `Shipment Status` are all reset to `''` / `0`. |

---

## F — Page Layout & Tabs

| #   | Logic                               | Explanation                                                                                                                                                                                                                                                        |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 37  | Products page has four tabs         | `ProductsPage` renders four tabs: **Products**, **Bundles**, **Mix & Match**, **Shipping Calculator**. Default active tab is "products".                                                                                                                           |
| 38  | Each tab is lazy-loaded             | All four tab panels use `next/dynamic` with `ssr: false`; a skeleton loader is shown while the panel is loading.                                                                                                                                                   |
| 39  | Statistics cards sit above the tabs | Four `ProductStatsCards` are rendered above the tab bar: **Total Products** (count), **Total Value** (₱ sum of COGS or grand total), **Average Value** (per product), **Total Profit** (projected profit sum). These re-compute whenever the product list changes. |

---

## G — Grid Controls (Toolbar)

| #   | Logic                                                         | Explanation                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 40  | Search field filters products by code, name, or shipment code | `TextInput` placeholder: "Search products by code, name, shipment code…". Bound to `handleSearch`; debounced 300 ms (see Section R). Has `data-ctrlf-target="products-search-input"` for Ctrl+F keyboard shortcut.                                                 |
| 41  | "Transit Build-Up" button triggers the build-up workflow      | Dark-filled button. Disabled when no row is selected or the selected row has no Shipment Code. Tooltip on disabled state: "Select a product row with a Shipment Code first". Tooltip on enabled state: "Post transit build-up for {shipmentCode} ({productCode})". |
| 42  | "Enable Edit Mode" button toggles cell editing                | Blue-filled with pencil icon in normal state. When active: red-filled with lock icon and label changes to **"Disable Edit Mode"**. Clicking either state calls `toggleEditMode`.                                                                                   |
| 43  | "Add Product" button opens the create modal                   | Green-filled with plus icon. Always enabled. Calls `openCreateProductModal`, which resets the form and opens the modal.                                                                                                                                            |

---

## H — Enable / Disable Edit Mode

| #   | Logic                                             | Explanation                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 44  | Edit mode is off by default                       | `isEditMode` state initialises to `false`; all editable columns are read-only until the user explicitly enables it.                                                                                                                                                                         |
| 45  | `toggleEditMode` simply flips the boolean         | `setIsEditMode(prev => !prev)`. No confirmation dialog; toggling off does not undo unsaved in-cell changes.                                                                                                                                                                                 |
| 46  | Six columns become writable in edit mode          | Only these columns use `readOnly: !isEditMode`: **SHIPMENT CODE** (col 0), **PRODUCT** (col 10), **ALIBABA SHIPPING** (col 13), **FORWARDER'S FEE** (col 21), **LALAMOVE** (col 22), **PACKAGING COST** (col 23). All other 30 columns are permanently `readOnly: true`.                    |
| 47  | Cost-trigger columns fire financial recalculation | Editing **ALIBABA SHIPPING COST**, **FORWARDER'S FEE**, **LALAMOVE**, or **PACKAGING COST** in the grid adds the row to `recalcGlobalIndexes`; `calculateProductFinancials` is called for each affected row inside `handleAfterChange`.                                                     |
| 48  | Recalculated fields are patched back onto the row | After recalc, the following fields are updated in the in-memory product list: `PHP`, `Sub Total (PHP)`, `Transaction Fee`, `Grand Total`, `Suggested Price`, `Landed Unit Cost`, `COGS`, `Projected Sales`, `Projected Profit`, `Projected Profit (%)`, `Total Markup`, `Weight Per Piece`. |

---

## I — Inline Cell Editing (handleAfterChange)

| #   | Logic                                                             | Explanation                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 49  | `loadData` source changes are ignored                             | `handleAfterChange` returns immediately when `source === 'loadData'` to avoid processing the initial grid population.                                                                                |
| 50  | Changes apply to the full product list, not the filtered view     | Each changed row is matched from `filteredProducts` back to the global `products` array by `product.id` before patching.                                                                             |
| 51  | Mapping from column index to field key uses `PRODUCT_COLUMN_KEYS` | `PRODUCT_COLUMN_KEYS[col]` converts a column number to the product field name; unrecognised columns are silently skipped.                                                                            |
| 52  | Clearing column 0 (Shipment Code) cascades a full shipment reset  | When the new value is blank/empty, the row's Shipment Code, CV Number, No. Of Sacks, Total CBM, Weight, and Shipment Status are all cleared.                                                         |
| 53  | Non-cost-column edits write the value directly                    | Any column that is not in `COST_RECALC_TRIGGER_KEYS` simply patches `updatedProducts[globalIndex][key] = newValue`.                                                                                  |
| 54  | All changes are committed via `bulkUpdateProducts`                | After processing all changes and recalculations, `bulkUpdateProducts(updatedProducts)` is called once. This calls `ProductService.bulkUpdateProducts` and triggers a React Query cache invalidation. |

---

## J — Double-Click to Edit Product

| #   | Logic                                                  | Explanation                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 55  | Double-clicking column 10 opens the Edit Product modal | In `handleCellClick`, a double-click is detected when the same row and column are clicked within 300 ms. When the column is 10 (PRODUCT), the selected product's data is passed to `productForm.populateForm` and the modal opens. |
| 56  | `populateForm` enters form edit mode                   | Sets `isEditMode = true` on the form, `editingProductId = product.id`, and populates all form fields from the existing product record.                                                                                             |
| 57  | Single-click just tracks the selected row              | `handleCellClick` always calls `setSelectedRow(coords.row)` on single click regardless of column, which updates `selectedShipmentCode` and `selectedProductCode` derived values.                                                   |

---

## K — Add / Edit Product Modal

| #   | Logic                                                              | Explanation                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------- |
| 58  | Modal title changes based on mode                                  | "Add New Product" in create mode; "Edit Product" in edit mode.                                                                                                                                                                                                                                            |
| 59  | Subtitle line reflects mode                                        | "Fill in the product information below" vs "Update the product information below".                                                                                                                                                                                                                        |
| 60  | Basic Information section: Shipment Code                           | Optional text field. Does not auto-generate the product code.                                                                                                                                                                                                                                             |
| 61  | Basic Information section: Product Name                            | Required (withAsterisk). Drives product code generation.                                                                                                                                                                                                                                                  |
| 62  | Basic Information section: Age Range                               | Two `NumberInput` fields (Start, End; integers, non-negative) plus a `Select` for unit (from `AGE_RANGE_UNIT_OPTIONS`). Combined into a label on save.                                                                                                                                                    |
| 63  | Basic Information section: Unit                                    | `Select` from `UNIT_OPTIONS`. Optional.                                                                                                                                                                                                                                                                   |
| 64  | Date & Payment section: Posting Date                               | `DateInput`, clearable. Used in product code generation.                                                                                                                                                                                                                                                  |
| 65  | Date & Payment section: Order Date                                 | `DateInput`, clearable. Used as fallback date in Transit Build-Up preview.                                                                                                                                                                                                                                |
| 66  | Date & Payment section: Payment                                    | `Select` from `PAYMENT_STATUS_OPTIONS` (Paid / Unpaid). Required by guardrail before save in create mode.                                                                                                                                                                                                 |
| 67  | Date & Payment section: Payment Method                             | `Select` from `PAYMENT_METHOD_OPTIONS`. When changed away from "CARD", clears `paymentCardId`.                                                                                                                                                                                                            |
| 68  | Date & Payment section: Payment Card                               | `Select` from saved cards (loaded via `paymentCardService.list()`, stale 5 min). Disabled unless `paymentMethod === 'CARD'`. Shows a loading spinner while cards are fetching.                                                                                                                            |
| 69  | Pricing section: Unit Price                                        | `NumberInput`, ₱ prefix, 2 decimal places, comma thousands separator.                                                                                                                                                                                                                                     |
| 70  | Pricing section: Quantity                                          | `NumberInput`, integer, non-negative.                                                                                                                                                                                                                                                                     |
| 71  | Pricing section: Exchange Rate                                     | `NumberInput`, 2 decimal places, step 0.01.                                                                                                                                                                                                                                                               |
| 72  | Pricing section: Transaction Fee                                   | `Select` (YES / NO). Description: "Applies 2.99% when enabled". Defaults to NO for new products.                                                                                                                                                                                                          |
| 73  | Shipping section: Alibaba Shipping Cost                            | `NumberInput`, ₱, 2 dp.                                                                                                                                                                                                                                                                                   |
| 74  | Shipping section: Forwarder's Fee                                  | `NumberInput`, ₱, 2 dp.                                                                                                                                                                                                                                                                                   |
| 75  | Shipping section: Lalamove                                         | `NumberInput`, ₱, 2 dp.                                                                                                                                                                                                                                                                                   |
| 76  | Shipping section: Packaging Cost                                   | `NumberInput`, ₱, 2 dp.                                                                                                                                                                                                                                                                                   |
| 77  | Shipping section: Actual Price                                     | `NumberInput`, ₱, 2 dp. Drives Projected Sales and Profit.                                                                                                                                                                                                                                                |
| 78  | Bulk & Posting Details section: Link to Post                       | Text field. URL to the listing post.                                                                                                                                                                                                                                                                      |
| 79  | Bulk & Posting Details section: Bulk Quantity                      | `NumberInput`, integer, non-negative.                                                                                                                                                                                                                                                                     |
| 80  | Bulk & Posting Details section: Bulk Weight                        | `NumberInput`, 2 dp, non-negative.                                                                                                                                                                                                                                                                        |
| 81  | Bulk & Posting Details section: Weight Per Piece                   | Computed read-only display (`Bulk Weight ÷ Bulk Quantity`). Greyed out with `#f8f9fa` background.                                                                                                                                                                                                         |
| 82  | Financial Calculations section: 7 real-time stat cards             | Cards displayed: **Suggested Price**, **Projected Sales Total**, **Projected Profit**, **Profit Margin**, **Landed Unit Cost**, **COGS**, **Total Markup**. All update live as the user types.                                                                                                            |
| 83  | Payment guardrail on create — must pick Paid or Unpaid             | When `isEditMode === false`, clicking "Add Product" first checks `form.payment`; if not "Paid" or "Unpaid", a `showAlert` warning ("Payment required") blocks the submit.                                                                                                                                 |
| 84  | Payment guardrail — confirmation dialog                            | After the payment status is confirmed to be Paid or Unpaid, a `showConfirm` dialog appears: "You are adding a new product that is already PAID to the supplier." / "…is UNPAID…". User must click "Yes, save product" to proceed. Clicking "Cancel" aborts without saving.                                |
| 85  | Duplicate product code check blocks save                           | Before calling the API, `handleSubmitProduct` checks whether any existing product (excluding the one being edited) shares the same normalized Product Code. If a duplicate is found, a red toast **"Duplicate Product Code"** is shown with a message asking the user to adjust the name or posting date. |
| 86  | "Add Product" button is disabled until Product Name has characters | The submit button has `disabled={!form.product.trim()                                                                                                                                                                                                                                                     |     | isSubmitting}`. |
| 87  | Submit button shows a loading spinner while saving                 | `isSubmitting` prop is forwarded to the button's `loading` state.                                                                                                                                                                                                                                         |
| 88  | Successful add — toast: "🎉 Product Added Successfully!"           | Green notification with check icon; message: "{product} has been added". Form is reset and modal is closed.                                                                                                                                                                                               |
| 89  | Failed add — toast: "❌ Failed to Add Product"                     | Red notification; message: API error string or "An error occurred". Modal stays open.                                                                                                                                                                                                                     |
| 90  | Successful update — toast: "✅ Product Updated Successfully!"      | Green notification; message: "{product} has been updated". Form is reset and modal is closed.                                                                                                                                                                                                             |
| 91  | Failed update — toast: "❌ Failed to Update Product"               | Red notification; message: API error or "An error occurred". Modal stays open.                                                                                                                                                                                                                            |
| 92  | Cancel button closes modal and resets form                         | Calls `closeProductModal` which calls `productForm.resetForm()` (clears all fields, sets `isEditMode = false`, `editingProductId = null`) then closes the modal.                                                                                                                                          |

---

## L — Transit Build-Up Workflow

| #   | Logic                                                                     | Explanation                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 93  | Transit Build-Up requires a selected row with a Shipment Code             | Clicking the "Transit Build-Up" toolbar button while no Shipment Code is selected shows a red notification: title **"Select a Shipment Code"**, message: "Click a product row with a Shipment Code first." Workflow aborts.             |
| 94  | `selectedShipmentCode` is derived from the clicked row                    | When the user clicks any grid row, `handleCellClick` sets `selectedRow`; `selectedShipmentCode` is `filteredProducts[selectedRow]?.['Shipment Code']`, normalised (trimmed, lowercased internally, null if blank).                      |
| 95  | Products with no Shipment Code match show a red error toast               | If no products in the full product list share the same shipment code as the selected row, a red notification is shown: title **"No Products Found"**, message: "No products are linked to shipment {code}." Workflow aborts.            |
| 96  | Preview dialog is rendered as an HTML table inside SweetAlert2            | `showCustomAlert` is called with `title: "Post Transit Build-Up • {selectedShipmentCode}"`, `icon: 'question'`, `width: '54vw'`.                                                                                                        |
| 97  | Preview table columns                                                     | The preview table shows 8 columns: **Product Code**, **Payment**, **Posting Date**, **Grand Total** (₱), **Forwarder's Fee** (₱), **Lalamove** (₱), **Total** (Grand Total + Forwarder's Fee + Lalamove), **Packaging (excluded)** (₱). |
| 98  | Posting Date uses Order Date as fallback                                  | In each preview row, `postingDate` = `product['Posting Date'] ?? product['Order Date'] ?? '—'`.                                                                                                                                         |
| 99  | "Total" column excludes Packaging                                         | `sum = grandTotal + forwardersFee + lalamove`. Packaging is shown separately but excluded from the sum column.                                                                                                                          |
| 100 | All cell values are HTML-escaped                                          | `escapeHtml` escapes `&`, `<`, `>`, `'`, `"` in every cell value before inserting into the HTML string, preventing XSS.                                                                                                                 |
| 101 | Preview scrolls vertically with max height 360 px                         | The inner table wrapper has `overflow: auto; max-height: 360px`. Minimum table width is 980 px with horizontal scroll.                                                                                                                  |
| 102 | Preview dialog has two buttons                                            | **"Post Transit Build-Up"** (confirm) and **"Cancel"** (cancel). Default focus is on Cancel to prevent accidental posting.                                                                                                              |
| 103 | Cancelled dialog exits silently                                           | `modalResult.isConfirmed` is false; workflow returns without any API call.                                                                                                                                                              |
| 104 | Confirmed posting calls `ProductService.postTransitBuildUpByShipmentCode` | Passed the `selectedShipmentCode` and `apiBasePath`.                                                                                                                                                                                    |
| 105 | Success toast: "✅ Transit Build-Up Posted"                               | Green notification with check icon; message: "Created {N} entries (skipped {N}) across {N} products." Then `refreshProducts()` is called to reload data.                                                                                |
| 106 | Failure toast: "❌ Transit Build-Up Failed"                               | Red notification; message: `result.error` from the API.                                                                                                                                                                                 |
| 107 | Already-posted entries are idempotent                                     | The API skips products that were already posted (idempotent design); the "skipped" count in the success message reflects these.                                                                                                         |
| 108 | Missing payment/date products are not posted                              | Products with no payment or date set, or whose date precedes the cutover threshold, are excluded from posting by the API.                                                                                                               |

---

## M — Data Layer (useProductsData)

| #   | Logic                                        | Explanation                                                                                                                                                                                             |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 109 | Product list is fetched via React Query      | `useQuery` with `queryKey = [...queryKeys.products.lists(), apiBasePath]`. Fetches via `ProductService.loadProducts`.                                                                                   |
| 110 | Stale time is 30 seconds                     | `staleTime: 30 * 1000`. Data is considered fresh for 30 s before a background refetch is triggered.                                                                                                     |
| 111 | Search is debounced 300 ms                   | `useDebouncedValue(searchQuery, 300)` delays filtering; `ProductService.searchProducts` is called only after the user stops typing.                                                                     |
| 112 | Add uses optimistic update                   | `addProductMutation` optimistically prepends the new product to the list before the API call resolves. On error the rollback context restores the previous list. Cache is always invalidated on settle. |
| 113 | Update uses optimistic update                | `updateProductMutation` optimistically replaces the matching product (by `id`) in the list. Rollback on error. Cache invalidated on settle.                                                             |
| 114 | Bulk update uses optimistic replace          | `bulkUpdateProductsMutation` replaces the entire in-memory product list optimistically. Used by `handleAfterChange` to reflect inline cell edits immediately.                                           |
| 115 | Load failures return an empty array silently | `useQuery`'s `queryFn` catches errors and returns `[]`; no error state is surfaced to the UI for load failures.                                                                                         |

---

## N — Grid Footer

| #   | Logic                                     | Explanation                                                                                                                           |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 116 | Footer shows filtered vs total count      | "Showing {filteredCount} of {totalCount} products" — `filteredCount` is `filteredProducts.length`, `totalCount` is `products.length`. |
| 117 | Footer shows Total Value and Total Profit | "Total Value: ₱{N}                                                                                                                    | Total Profit: ₱{N}" — computed from `statistics.totalValue` and `statistics.totalProfit` using `formatNumber`. |

---

## O — Product Code Generation (grid inline editing)

| #   | Logic                                                                         | Explanation                                                                                                        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 118 | Editing the PRODUCT column (col 10) does not auto-regenerate the product code | Inline cell edits write the raw value directly; code regeneration only happens when saving via the Add/Edit modal. |

---

## P — Product Code Generation

| #   | Logic                                                        | Explanation                                                                                                                                                                                            |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 119 | Bundle SKU is auto-generated from Bundle Name + Posting Date | `ProductService.generateProductCode(bundleName, postingDate)` is called whenever Bundle Name or Posting Date changes; the result is written to `bundleSku` unless the user has manually overridden it. |
| 120 | Bundle SKU manual override is tracked by `isBundleSkuManual` | If the displayed SKU differs from the auto-generated SKU, `isBundleSkuManual` is set to `true` and auto-generation is suppressed for that session.                                                     |
| 121 | Mix & Match SKU is auto-generated similarly                  | `ProductService.generateProductCode(mixAndMatchName, postingDate)` generates the SKU; user can override manually.                                                                                      |

---

## Q — Bundles Tab

| #   | Logic                                                     | Explanation                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 122 | Bundles are created via "Create Bundle Batch" button      | Always-enabled button at the top of the Bundles tab. Opens the Bundle modal in create mode with an empty form (Posting Date defaults to today).                                                                                                                           |
| 123 | Bundle modal fields                                       | **Posting Date** (required), **Bundle Name** (required), **Bundle SKU** (auto-generated, editable), **Quantity** (required, > 0), **Price** (≥ 0), **Components** list (Product Code + Included Quantity per row).                                                        |
| 124 | Bundle must have at least one valid component             | `canSubmit` requires `components.some(c => c.productCode.trim() && c.includedQuantity > 0)`. Submit button is disabled until this is satisfied.                                                                                                                           |
| 125 | "Add SKU" adds a new blank component row                  | Each component row has Product Code (text) and Included Quantity (number). Any component with a blank product code or zero quantity is stripped from the payload on save.                                                                                                 |
| 126 | Component rows can be removed                             | Each component row has a remove button that splices out that index from the `components` array.                                                                                                                                                                           |
| 127 | Bundle save closes modal and resets form on success       | On `createMutation.onSuccess` or `updateMutation.onSuccess`: form resets to empty, modal closes, `editingBundleId` clears, error message clears, React Query cache invalidates.                                                                                           |
| 128 | Bundle create error shown inline in modal                 | On `createMutation.onError` or `updateMutation.onError`: `errorMessage` state is set to the error string; a Mantine `Alert` component with title "Error" is rendered in the modal. No toast is used.                                                                      |
| 129 | Modal is locked during saving                             | `handleCloseModal` returns early if `isSaving` (either mutation is pending). The user cannot close the modal mid-save.                                                                                                                                                    |
| 130 | Editing a bundle opens the modal with pre-filled data     | `handleEditBundle` populates the form, sets `editingBundleId`, detects whether the existing SKU is manual, and opens the modal.                                                                                                                                           |
| 131 | Delete bundle uses triple-confirm                         | `handleDeleteBundle` calls `confirmTripleDeleteBundle` which shows a SweetAlert2 dialog: title **"Delete bundle batch?"**, warning: "This will permanently delete {label}.", final prompt: "Type DELETE to confirm." Deletion proceeds only when the user types "DELETE". |
| 132 | Bundle delete success closes modal if editing that bundle | On `deleteMutation.onSuccess`, if `editingBundleId` matches the deleted bundle's ID, the modal is closed and the form is reset. Cache is invalidated.                                                                                                                     |
| 133 | Bundle delete error shown inline                          | `deleteMutation.onError` sets `errorMessage` in the modal.                                                                                                                                                                                                                |
| 134 | Bundle list supports search                               | A search input filters the displayed bundle list by bundle name, SKU, posting date, or component product codes (case-insensitive, trimmed).                                                                                                                               |

---

## R — Mix & Match Tab

| #   | Logic                                                 | Explanation                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 135 | Mix & Match batches are created via "Add New" button  | Opens the MnM modal in create mode with an empty form (Posting Date defaults to today).                                                                                                                                                                                      |
| 136 | Mix & Match modal fields                              | **Posting Date** (required), **Mix & Match Name** (required), **Mix & Match SKU** (auto-generated, editable), **Price** (≥ 0), **Components** list (Product Code + Included Quantity per row). No Quantity field — unlike Bundles, this is quantity-less at the batch level. |
| 137 | At least one valid component required                 | `canSubmit` requires `components.some(c => c.productCode.trim().length > 0 && c.includedQuantity > 0)`. Submit button is disabled otherwise.                                                                                                                                 |
| 138 | Product code options in component rows                | The dropdown shows available product codes (filtered from `products`) plus any currently selected codes, sorted alphabetically.                                                                                                                                              |
| 139 | Save calls upsert                                     | `saveMixAndMatchMutation` determines create vs update based on `editingMixAndMatchId`. On success: cache invalidated, form reset, modal closed. On error: throws "Failed to save mix & match" (no inline error message — the mutation throws).                               |
| 140 | Delete uses triple-confirm                            | `confirmTripleDeleteMixAndMatch` shows SweetAlert2: title "Delete mix & match batch?", warning listing the batch label, final prompt "Type DELETE to confirm."                                                                                                               |
| 141 | Deleted batch closes edit modal if it is being edited | On `deleteMixAndMatchMutation.onSuccess`, if the deleted ID matches `editingMixAndMatchId`, the modal is closed and form is reset.                                                                                                                                           |
| 142 | Mix & Match list supports search                      | Filters by posting date, name, SKU, or product codes (case-insensitive).                                                                                                                                                                                                     |
| 143 | MnM allocation is proportional by availability        | `allocateByAvailability` weights allocation by each component's available stock; floor division first, then remainder goes to the highest fractional parts, alphabetical tie-break.                                                                                          |
| 144 | Zero-availability components get zero allocation      | If a component has no stock, it receives zero regardless of demand.                                                                                                                                                                                                          |

---

## S — Shipping Fee Calculator Tab

| #   | Logic                                                          | Explanation                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 145 | Calculator has three input fields under "ACTUAL SHIPPING FEES" | **Alibaba Shipping Cost** (₱), **Forwarder's Fee (KPC)** (₱), **Lalamove** (₱). All are `NumberInput` with comma thousand separator and 2 dp.                                                                                                                                   |
| 146 | Shipment Code is selected via a searchable dropdown            | "Select Shipment Code" dropdown under "SHIPMENT CODE DETAILS". Only shipments whose `Shipment Status !== 'Delivered'` appear. Dropdown is clearable and searchable.                                                                                                             |
| 147 | Selected shipment code is persisted in `localStorage`          | Key: `shippingFeeCalculator:selectedShipmentCode`. On page reload the stored code is automatically restored if it still appears in the active shipment list; otherwise it is cleared.                                                                                           |
| 148 | Selecting a shipment code pre-populates the grid               | Products belonging to that shipment code are loaded into the Handsontable breakdown grid with their Product Code and Actual Quantity. Saved state (multipliers, actual fee amounts) are also restored from the server if available.                                             |
| 149 | Only the MULTIPLIER column is editable                         | All other columns (Product Code, Actual Quantity, Approx Quantity, Percentage, Alibaba, Forwarder's Fee, Lalamove, Packaging) are read-only.                                                                                                                                    |
| 150 | Allocation algorithm per row                                   | `aproxQuantity = actualQuantity × multiplier`. `percentage = aproxQuantity / totalAproxQuantity`. Allocated cost = `percentage × actual fee`.                                                                                                                                   |
| 151 | Packaging receives the same allocation as Lalamove             | `packaging = lalamove cost allocation`. They share the same last-mile cost bucket.                                                                                                                                                                                              |
| 152 | Recalculation fires on every actual-fee or multiplier change   | Changes to Alibaba, Forwarder's Fee, or Lalamove inputs trigger a full `calculateShippingRows` recalculation; editing a MULTIPLIER cell also triggers it via `handleAfterChange`.                                                                                               |
| 153 | State is auto-saved to the server on every change              | After recalculation, `saveData` POST request is made with `{ shipmentCode, actualInputs, multipliers }`. Success shows Mantine notification: title **"Saved"**, message "Data saved successfully", green. Failure shows: title **"Error"**, message "Failed to save data", red. |
| 154 | Clearing shipment code resets all inputs                       | Setting the shipment dropdown to null clears `actualAlibabaShipping`, `actualForwardersFee`, `actualLalamove`, and resets the grid to a single blank row.                                                                                                                       |
| 155 | Load state failure shows red notification                      | If `loadSavedState` fetch fails: title **"Error"**, message "Failed to load saved data", red.                                                                                                                                                                                   |
| 156 | Result Summary shows 6 aggregate cards                         | **Products** (count), **Actual Qty** (sum), **Approx Qty** (multiplier-adjusted sum), **Alibaba Shipping** (₱ sum of allocated costs), **Forwarder's Fee** (₱ sum), **Lalamove / Packaging** (₱ sum).                                                                           |

---

## T — Product Code Generation (CSV Import)

| #   | Logic                                            | Explanation                                                                                                     |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 157 | CSV expects exactly 36 columns                   | The import parser processes 36 fixed-position columns; missing columns are padded with empty strings.           |
| 158 | Date format supports MM-DD-YYYY, MMDDYY, and ISO | `parseCSVDate` handles three formats; unrecognised formats produce an empty string.                             |
| 159 | Numeric CSV fields use safe parsing              | `toSafeNumber` strips commas, handles null/undefined/empty, and returns 0 for unparsable values.                |
| 160 | Financial calculations run on each imported row  | `ProductService.calculateFinancials` runs on every row to populate derived fields (PHP, COGS, etc.).            |
| 161 | CSV with no data rows is rejected                | Returns error "CSV file is empty or contains no data rows".                                                     |
| 162 | CSV with all invalid rows is rejected            | Returns error "No valid product data found in the CSV file".                                                    |
| 163 | Per-row parse errors are collected and returned  | Each invalid row appends "Error parsing row N: {message}" to the `errors` array; valid rows are still imported. |
