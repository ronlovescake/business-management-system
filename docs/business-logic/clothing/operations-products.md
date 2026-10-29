# Clothing — Products Business Logic

Employee steps are owned by the [Master SOP Manual](operations-workflow.md).
This file owns the Products enforcement contract and its implementation limits.

## Stable Product Identity

`Product.id` is the unique, permanent database identifier. The generated Product
Code remains editable for unposted products by changing the product name/date and is not a unique
database key. Linked price tiers, transactions, inventory movements, sorting,
batch components, and reclassification entries use nullable `productId` links;
their visible codes follow product-code changes. The previous code is retained
in `product_code_aliases`. No recorded quantities or financial amounts are
changed by a code rename.

Selective backups exclude aliases for soft-deleted products when those products
are omitted; database dumps retain all aliases.

### Accounting Identity And Payment Locks

Active transit builds, reclassifications, or supplier settlement journal lines
block product-code/shipment-code changes and deletion. The same guard applies
to direct-ID edits, imports, bulk updates, and mass deletion. Identity-preserving
cost estimate edits remain supported; reclassification uses posted source costs,
not later estimates.

Where product-origin Supplier Payable exists, changing to Paid requires a
supported payment method and administrator authority for missing journal lines.
Product state and both settlement lines commit together. Retrying Paid reconciles
stable keys without changing completed posting dates. Conflicting payment details,
reverting a settled product to Unpaid, or deleted settlement lines retaining those
keys require accounting resolution and return 409. Ordinary edits to a completely
settled product do not repost it.

First supplier settlement uses the shared Manila current calendar day, stored
as the existing UTC-midnight day bucket. The owner authorized completing I01 on
October 28; the UTC-calendar bug was reproduced at Manila midnight, then repaired
without changing amounts, permissions or completed dates. Frozen before/at/after
midnight regressions and the full Paid/Unpaid real browser lifecycle now pass,
including the two dated lines and unchanged replay. No historical records were
repaired. See the [current findings](../../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#i01-transit-fix-and-remaining-settlement-failure).

### New Receipt Cost And Composite Definitions

New Clothing purchase receipts snapshot their known positive acquisition cost and
`PURCHASE` basis, including create/import/bulk receipt assurance. Existing receipts
are not rewritten and an unknown cost remains null, never silently confirmed zero.
Receipt assurance does not post an operating expense or buy the stock again.
Supplier-free extras instead use the separately approved zero-cost lot workflow.

Bundle creation now atomically records value-conserving assembly from actual
component receipt lots under a stable request UUID. Split definitions persist
nullable explicit component acquisition costs, separate from selling prices;
opening a parent requires a complete cost-conserving definition. Used bundle/mix
and opened split definitions cannot be edited or deleted beneath posted history.
See the [physical inventory contract](operations-inventory.md#approved-original-composite-returns).

### Authoritative Shipment Location

On October 28 the requesting business owner explicitly confirmed that goods
remain in transit until marked on hand. The existing operational transition is
setting the linked shipment to `Delivered`; no new status or automatic receipt
transition is introduced.

Clothing's `productService.findActive` resolves the current status from active
linked shipments in one batch for `GET /api/products`. A nonempty linked
`Shipment.shipmentStatus` overrides an empty or stale product-level status in
the returned DTO. Paid and Unpaid purchases use the same physical-location rule.
Products already enriched their grid from Shipments; Inventory previously read
the raw product status and could falsely show received stock. Both now receive
the linked shipment's status on a refreshed collection read.

This read boundary covers records created by the form, direct API, import and
bulk writers without rewriting their stored status. A failed shipment lookup
fails the read rather than returning stale successful data. Unlinked products,
unmatched codes and blank linked statuses retain the existing legacy fallback;
this is not reconciliation of unknown historical locations. Single-record
mutation responses, movement writers, supplier funding, posting dates, costs
and General Merchandise's separate product service are unchanged.

Example: 100 travelling units with 20 reserved display zero physically received,
20 transit reserved and 80 transit unreserved. The tested transition to Delivered
shows 100 received, 20 on-hand reserved and 80 on-hand sellable. Other/intermediate
or unknown statuses can still use the existing received-supply fallback; this
read repair is not a general all-status physical-arrival guard. This
projection does not itself post Transit Build-Up or financial reclassification.
The [Inventory contract](operations-inventory.md#physical-location-and-reservation-split)
and [I01 evidence](../../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#i01-transit-fix-and-remaining-settlement-failure)
record the focused regressions and actual browser stages. The later authorized
settlement-date repair and complete I01 sequence now pass.

### Supplier Nonfulfillment And Future-Purchase Credit

The requesting business/project owner approved this workflow on 2026-10-26:
an entirely missing paid product receives usable credit equal to its saved
**Grand Total**, for example PHP 19,511.37 for Dreamgrow Tiny Tots Pants
(`DTTP-101626`). It is not a refund to Cash, Bank, GCash, or the original card.
The owner also explicitly excluded the in-app Shipping Fee Calculator: it is
an infrequently used pricing-estimate tool and is unchanged by this workflow.

The owning enforcement boundary is
[supplier-resolution.ts](../../../src/modules/products/api/supplier-resolution.ts).
The Product form exposes administrator-only actions; middleware and the service
both enforce ADMIN/SUPER_ADMIN authority. General merchandise intentionally
does not support this clothing-only credit workflow; its shared form mapper
omits clothing fields and its APIs reject credit requests.

| #   | Rule                                                | Current implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | Delayed goods retain their original payment         | Edit Product can transfer an unreceived whole product to exactly one existing active shipment, with a reason and stable request ID. The product and its product-origin source rows move together; amounts, posting dates, funding accounts and posting keys remain unchanged. An audit row records old/new shipment and actor. No second payment or journal is created.                                                                                                |
| SC2 | Confirmed usable credit replaces the right to goods | Issue Credit derives the amount from the saved product, posts Dr Supplier Credits / Cr Inventory in Transit, and marks the product CREDIT_ISSUED. The original funding/card liability remains. With no source, an already-Paid purchase can materialize its acquisition source once using its valid purchase date; an unsettled Unpaid purchase cannot create funded credit.                                                                                           |
| SC3 | Only verified whole-product resolution is supported | Active reclass, physical sale/assembly/damage history, fulfilled customer history, incompatible/deleted source rows, mixed shipment-origin funding, or source-cost drift block the action. Supplier Payable must have both matching settlement legs no later than the credit date. Partial receipt/partial nonfulfillment requires separate correction.                                                                                                                |
| SC4 | Credits fund the gross replacement purchase         | Add Product can apply a positive PHP amount from one issued credit of the same normalized supplier. The gross Grand Total is unchanged. Product-origin funding splits into Supplier Credits and the remaining payment account or Supplier Payable. A fully credit-funded purchase needs no cash leg. Apply Credit on Edit Product is available only before any target build/reclass has been posted.                                                                   |
| SC5 | Unused credit remains available                     | Decimal cent amounts, conditional balance decrement, unique source/target/request keys and serializable transactions prevent repeated application and overspending. One credit application per target product is supported; one issued credit can fund multiple products partially. Failed creation/application rolls back the product, funding and balance together. Repeated identical creation requests return the same product; changed purchase details conflict. |
| SC6 | Nonfulfilled goods are not physical stock           | Issuance records only the remaining whole-product shortage, protects its movements from generic edits/deletion, and blocks new adjustments that could resurrect the old goods. Inventory presents zero received/sellable quantity for CREDIT_ISSUED products. Open customer reservations and their money are not automatically changed.                                                                                                                                |
| SC7 | Posted funding cannot be silently rewritten         | Credit-owned products cannot be deleted or have their purchase basis changed through direct edits, imports or bulk updates. Paid method/card identity is locked; an Unpaid replacement may select a method when settling only its remaining payable. Generic transit build-up skips credit-owned products instead of recreating full cash/card funding.                                                                                                                |
| SC8 | Resolution uses saved data, not unsaved edits       | Save/discard unrelated form edits before a supplier action. Supplier actions have their own posting date, confirmation and request ID. A committed action whose refresh fails is shown as recorded and cannot be submitted again from the same form.                                                                                                                                                                                                                   |

Supplier is a searchable selection built from active product supplier references
and issued credits. Existing whitespace/case normalization deduplicates choices
without rewriting historical references. An ordinary purchase can explicitly
select `Add supplier` for a new name; typing alone does not accept a new supplier.
Changing supplier clears the selected credit and amount. Supplier identity is
separate from the supplier credit document reference. Available credits show
their reference, source product code and PHP balance; only same-supplier,
positive-balance PHP credits from another product are eligible choices.

Posting dates must be strict `YYYY-MM-DD` calendar dates at/after the saved
runtime clothing accounting cutoff (with the existing environment/default
fallback), and no later than **today in Asia/Manila**. The form default and the
service use the same shared Manila-date helper; UTC-midnight storage does not
change. Invalid dates, dates before cutoff and future dates have distinct errors
with the relevant bounds. Applications cannot predate either the issued credit
or the replacement purchase. Separate forwarder, courier and packaging amounts
are not added to the credit. Calculator inputs/results are neither read nor changed.

Credit applications and issue journals are source dependencies: their underlying
financial sources cannot be independently edited/deleted/restored as a correction.
An unresolved net Supplier Short between zero and the whole product quantity
blocks all whole-product supplier actions. Full shortages remain eligible subject
to the other guards; fully reversed shortages do not block by themselves.
Transfer/additional-goods annotations are not treated as ordinary shortages.

No credit reversal, expiry, dispute write-off, partial-receipt resolution,
customer refund automation or historical repair is introduced. Reconcile those
cases with the accountable owner rather than deleting source history.

The inventory ledger drift control expects zero sellable stock for CREDIT_ISSUED
products while preserving their original ordered quantity. It still fails if
their ledger becomes nonzero; credited products are not skipped by the control.

**Migration prerequisite:** apply the reviewed additive
[supplier-credit migration](../../../prisma/migrations/20261026120000_clothing_supplier_credits/migration.sql)
and regenerate Prisma before running this code against an existing environment.
Do not reset existing data or substitute `db push` for the reviewed migration.
The migration adds defaults and new financial/audit tables; it does not issue
credits or alter historical monetary amounts. All three tables are included in
backup coverage with their product-parent dependencies. Application to an existing
development/production database remains an explicitly authorized operational step.

Regression evidence: the service/unit/UI tests and
[supplier-credit integration tests](../../../tests/integration/clothing-supplier-credits.integration.test.ts)
exercise exact amounts, unchanged card liability, partial balance, rollback,
retry, concurrent overspend rejection, transfers and complete-component reclass.
The database-free `npm run test:browser:supplier-credit` command mounts the real
Product modal with intercepted APIs for repeatable desktop/mobile workflows;
it deliberately does not invoke the default database-reset E2E setup. The
supplier-enabled modal uses full-screen layout on narrow viewports.
See the [dated review](../../reports/ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md#12-approved-supplier-resolution-implementation)
for executed gates and remaining limits; this is not live-balance certification.

New code-only rows are linked only when one active product matches. A missing or
ambiguous code remains unlinked; code-only bulk edits with duplicate matches
are rejected. The additive migration links legacy rows only when their code
matches one product; it cannot recover every historical rename. After applying
the migration in a reviewed environment, run
`npx tsx scripts/audit-clothing-product-identity.ts` to review duplicate codes
and unlinked counts before relying on historical rollups. The audit is read-only.

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
> - `src/modules/clothing/operations/shipments/components/TransitReclassModal.tsx`
> - `src/modules/clothing/operations/shipments/services/ShipmentService.ts`
> - `src/lib/productCalculations.ts`
> - `src/modules/products/api/financials.ts`
> - `src/modules/products/api/service.ts`
> - `src/modules/products/api/routeFactory.ts`
> - `src/app/api/products/[id]/route.ts`

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

| #   | Logic                                                                 | Explanation                                                                                                                                                                               |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | PHP = Unit Price × Exchange Rate                                      | CNY-to-PHP conversion: `PHP = unitPrice × exchangeRates`.                                                                                                                                 |
| 11  | Sub Total (PHP) = PHP × Quantity                                      | Total cost before logistics: `subTotalPHP = php × quantity`.                                                                                                                              |
| 12  | Transaction fee is conditionally applied                              | If `applyTransactionFee` is true, `TRANSACTION_FEE_RATE` (2.99%) is applied. On the edit form, rate is preserved: if the stored `Transaction Fee` is 0, the fee toggle stays off.         |
| 13  | Grand Total = Sub Total + Transaction Fee + Alibaba Shipping Cost     | `grandTotal = subTotalPHP + transactionFee + alibabaShippingCost`.                                                                                                                        |
| 14  | Forwarder's fee, Lalamove, and packaging cost are tracked per-product | These three logistics costs feed the Landed Unit Cost.                                                                                                                                    |
| 15  | Landed Unit Cost = (Grand Total + Logistics Costs) ÷ Quantity         | `basePrice = (grandTotal + forwardersFee + lalamove + packagingCost) / quantity`. Accounting unit-cost basis for COGS.                                                                    |
| 16  | COGS = Landed Unit Cost × Quantity                                    | `cogs = basePrice × quantity`.                                                                                                                                                            |
| 17  | Suggested Price uses a configurable markup                            | `suggestedPrice = landedUnitCost × (1 + SUGGESTED_PRICE_MARKUP)`. The modal displays a note: "Minimum selling price (122% markup)".                                                       |
| 18  | Projected Sales = Actual Price × Quantity                             | `projectedSales = actualPrice × quantity`.                                                                                                                                                |
| 19  | Projected Profit = Projected Sales − COGS                             | `projectedProfit = projectedSales − cogs`.                                                                                                                                                |
| 20  | Projected Profit % = (Projected Profit ÷ Projected Sales) × 100       | Returns 0 when Projected Sales is 0.                                                                                                                                                      |
| 21  | Total Markup = Actual Price ÷ Landed Unit Cost − 1                    | Returns 0 when Landed Unit Cost is 0.                                                                                                                                                     |
| 22  | Weight Per Piece = Bulk Weight ÷ Bulk Quantity                        | Returns 0 when Bulk Quantity is 0. Displayed as a read-only computed field in the modal.                                                                                                  |
| 23  | Exchange rate defaults to 1 if zero on load                           | When loading a product whose stored exchange rate is 0, the form initialises it to 1 to prevent cascading zero calculations.                                                              |
| 24  | Financial calculations are live in the modal                          | `useProductForm` previews the shared formula as fields change; product APIs recalculate derived financial fields on create, bulk import/update, and direct-ID updates before persistence. |
| 25  | Profit and margin cards change colour by sign                         | "Projected Profit" card uses `red.6` when negative, `green.6` when positive. "Profit Margin" card applies the same colour rule.                                                           |

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

| #   | Logic                                        | Explanation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 37  | Products page has five tabs                  | `ProductsPage` renders **Products**, **Bundles**, **Mix & Match**, **Split**, **Shipping Calculator**. Default active tab is "products".                                                                                                                                                                                                                                                                                                                                                                                   |
| 38  | Tab content is lazy-loaded                   | Tab components use `next/dynamic` with `ssr: false`; the configured skeleton appears while loading.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 39  | Filtered statistics cards sit above the tabs | `ProductStatsCards` totals use the same debounced product search as the grid and include unsaved grid drafts. Cards show **Total Products**, **Grand Total**, **Projected Sales** (the former Total Value; sum of Actual Price × Quantity), **Projected Profit**, **COGS**, **Forwarder's Fee**, **Lalamove**, **Packaging Cost**, **Total Quantity**, and **Average Projected Sales**. The COGS card already includes Grand Total and the three listed cost components; do not add them together as separate total costs. |

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

| #   | Logic                                                             | Explanation                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 49  | `loadData` source changes are ignored                             | `handleAfterChange` returns immediately when `source === 'loadData'` to avoid processing the initial grid population.                                                                                                                                                                                                                                                                                       |
| 50  | Changes apply to the full product list, not the filtered view     | Each changed row is matched from `filteredProducts` back to the global `products` array by `product.id` before patching.                                                                                                                                                                                                                                                                                    |
| 51  | Mapping from column index to field key uses `PRODUCT_COLUMN_KEYS` | `PRODUCT_COLUMN_KEYS[col]` converts a column number to the product field name; unrecognised columns are silently skipped.                                                                                                                                                                                                                                                                                   |
| 52  | Clearing column 0 (Shipment Code) cascades a full shipment reset  | When the new value is blank/empty, the row's Shipment Code, CV Number, No. Of Sacks, Total CBM, Weight, and Shipment Status are all cleared.                                                                                                                                                                                                                                                                |
| 53  | Non-cost-column edits write the value directly                    | Any column that is not in `COST_RECALC_TRIGGER_KEYS` simply patches `updatedProducts[globalIndex][key] = newValue`.                                                                                                                                                                                                                                                                                         |
| 54  | Inline saves use a local draft and a serial queue                 | Each event merges into the latest draft by permanent product ID, including events before a React rerender. Only changed rows are submitted as complete DTOs through `bulkUpdateProducts`; at most one request is active. Pending changes coalesce while a request runs.                                                                                                                                     |
| 54a | Acknowledgements are revision-specific                            | A response acknowledges only the submitted revision of each accepted row. Later edits remain pending. Skipped row indices are mapped back to the submitted products and retained with an error.                                                                                                                                                                                                             |
| 54b | Refresh cannot replace pending edits                              | Drafts overlay query data until a successful canonical read started after the queue drains. Edits made during that read trigger another save and reconciliation. Save-status changes alone do not replace table data.                                                                                                                                                                                       |
| 54c | Save errors require explicit recovery                             | Failed requests and incomplete acknowledgements pause automatic saving without rolling back drafts. The alert offers confirmed Refresh and Retry or Discard Drafts. Retry refreshes first and refuses to recreate missing products. Discard reloads server values and does not undo committed writes. Network/5xx failures may have committed; review before retry. No automatic write retries are enabled. |
| 54d | Pending drafts block conflicting local operations                 | Add/edit modal writes, transit build-up, reclassification, and other product tabs are blocked until inline changes reconcile or drafts are discarded. Browser unload and link navigation warn while drafts are pending. Drafts are memory-only, not durable offline storage; programmatic navigation and other tabs/users are not coordinated.                                                              |
| 54e | Costing and accounting enforcement are unchanged                  | Shipment clearing and client cost previews retain their existing behavior. The existing server bulk service still owns validation, identity/payment locks, financial recomputation, and domain-specific posting. Imports, jobs, direct-ID writes, and the shipping calculator's persistence are unchanged.                                                                                                  |

### Autosave Change Record (2026-10-25)

Ctrl/Cmd+arrow now uses the same data-boundary navigation as Transactions:
move to the end of a contiguous nonempty run, or across a gap to the next
nonempty cell; fall back to the row/column edge without wrapping. Zero and false
are nonempty. An open cell editor retains normal cursor behavior. This applies
to the shared clothing/GM Products grid; it changes no save or financial rule.
Regression evidence is in
`src/components/ui/handsontable-grid/__tests__/dataBoundaryNavigation.test.ts`
and `tests/e2e/handsontable-grid.interactions.spec.ts`.

- Request and approval: the requesting project owner approved the queued-save proposal with "Start implementation" in this task. No new accounting policy, permission, migration, or deployment approval is inferred.
- Invariant and boundary: rapid inline edits merge by permanent product ID and revision; only acknowledged revisions may reconcile. `useProductGridSaveQueue` coordinates client writes; existing clothing and GM bulk services remain the enforcement owners for business rules.
- Domains and divergence: clothing and general merchandise share client coordination, with isolated API scopes. Their distinct posting/settlement behavior is intentionally unchanged. Imports, background jobs, direct-ID endpoints, and calculator persistence do not use this queue and are unchanged.
- Regression evidence: `src/modules/clothing/operations/products/hooks/__tests__/useProductGridSaveQueue.test.tsx`, `src/modules/clothing/operations/products/hooks/__tests__/useProductsGrid.test.tsx`, `src/modules/clothing/operations/products/services/__tests__/ProductService.loadProducts.test.ts`, `tests/unit/api/products.api.test.ts`, and `tests/unit/api/general-merchandise.products.api.test.ts`. The focused regression slice passed; guardrails, lint, typecheck, full unit, integration (59 tests), and hardening (12 tests) passed. Lint retains warnings in untouched files.
- Remaining limits: no authenticated browser clipboard check was performed. Drafts do not survive reload, other users/tabs are not serialized, and an ambiguous failed write may already have committed or started accounting follow-up. Explicit retry is not a guarantee of exactly-once posting. No commit, build, or deployment was performed.

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
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------- |
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
| 86  | "Add Product" button is disabled until Product Name has characters | The submit button uses `disabled={!form.product.trim()                                                                                                                                                                                                                                                    |     | isSubmitting}`, so the user cannot submit until Product Name contains non-whitespace characters and a save is not already in progress. |
| 87  | Submit button shows a loading spinner while saving                 | `isSubmitting` prop is forwarded to the button's `loading` state.                                                                                                                                                                                                                                         |
| 88  | Successful add — toast: "🎉 Product Added Successfully!"           | Green notification with check icon; message: "{product} has been added". Form is reset and modal is closed.                                                                                                                                                                                               |
| 89  | Failed add — toast: "❌ Failed to Add Product"                     | Red notification; message: API error string or "An error occurred". Modal stays open.                                                                                                                                                                                                                     |
| 90  | Successful update — toast: "✅ Product Updated Successfully!"      | Green notification; message: "{product} has been updated". Form is reset and modal is closed.                                                                                                                                                                                                             |
| 91  | Failed update — toast: "❌ Failed to Update Product"               | Red notification; message: API error or "An error occurred". Modal stays open.                                                                                                                                                                                                                            |
| 92  | Cancel button closes modal and resets form                         | Calls `closeProductModal` which calls `productForm.resetForm()` (clears all fields, sets `isEditMode = false`, `editingProductId = null`) then closes the modal.                                                                                                                                          |

---

## L — Transit Build-Up Workflow

| #   | Logic                                                                     | Explanation                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 93  | Transit Build-Up requires a selected row with a Shipment Code             | Clicking the "Transit Build-Up" toolbar button while no Shipment Code is selected shows a red notification: title **"Select a Shipment Code"**, message: "Click a product row with a Shipment Code first." Workflow aborts.                                                                                                                                                                                           |
| 94  | `selectedShipmentCode` is derived from the clicked row                    | When the user clicks any grid row, `handleCellClick` sets `selectedRow`; `selectedShipmentCode` is `filteredProducts[selectedRow]?.['Shipment Code']`, normalised (trimmed, lowercased internally, null if blank).                                                                                                                                                                                                    |
| 95  | Products with no Shipment Code match show a red error toast               | If no products in the full product list share the same shipment code as the selected row, a red notification is shown: title **"No Products Found"**, message: "No products are linked to shipment {code}." Workflow aborts.                                                                                                                                                                                          |
| 96  | Preview dialog is rendered as an HTML table inside SweetAlert2            | `showCustomAlert` is called with `title: "Post Transit Build-Up • {selectedShipmentCode}"`, `icon: 'question'`, `width: '54vw'`.                                                                                                                                                                                                                                                                                      |
| 97  | Preview table columns                                                     | The preview table shows 8 columns: **Product Code**, **Payment**, **Posting Date**, **Grand Total** (₱), **Forwarder's Fee** (₱), **Lalamove** (₱), **Total** (Grand Total + Forwarder's Fee + Lalamove), **Packaging (excluded)** (₱). Forwarder's Fee and Lalamove columns are displayed for reference only; with `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` set to `false`, only Grand Total entries are created. |
| 98  | Posting Date uses Order Date as fallback                                  | In each preview row, `postingDate` = `product['Posting Date'] ?? product['Order Date'] ?? '—'`.                                                                                                                                                                                                                                                                                                                       |
| 99  | "Total" column excludes Packaging                                         | `sum = grandTotal + forwardersFee + lalamove`. Packaging is shown separately but excluded from the sum column. Note: The accounting entry amount is only the Grand Total value; forwarder and lalamove costs are handled via the Logistics Costs tab.                                                                                                                                                                 |
| 100 | All cell values are HTML-escaped                                          | `escapeHtml` escapes `&`, `<`, `>`, `'`, `"` in every cell value before inserting into the HTML string, preventing XSS.                                                                                                                                                                                                                                                                                               |
| 101 | Preview scrolls vertically with max height 360 px                         | The inner table wrapper has `overflow: auto; max-height: 360px`. Minimum table width is 980 px with horizontal scroll.                                                                                                                                                                                                                                                                                                |
| 102 | Preview dialog has two buttons                                            | **"Post Transit Build-Up"** (confirm) and **"Cancel"** (cancel). Default focus is on Cancel to prevent accidental posting.                                                                                                                                                                                                                                                                                            |
| 103 | Cancelled dialog exits silently                                           | `modalResult.isConfirmed` is false; workflow returns without any API call.                                                                                                                                                                                                                                                                                                                                            |
| 104 | Confirmed posting calls `ProductService.postTransitBuildUpByShipmentCode` | Passed the `selectedShipmentCode` and `apiBasePath`.                                                                                                                                                                                                                                                                                                                                                                  |
| 105 | Success toast: "✅ Transit Build-Up Posted"                               | Green notification with check icon; message: "Created {N} entries (skipped {N}) across {N} products." With the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` flag disabled, one entry (Grand Total) is created per product instead of three. Then `refreshProducts()` is called to reload data.                                                                                                                         |
| 106 | Failure toast: "❌ Transit Build-Up Failed"                               | Red notification; message: `result.error` from the API.                                                                                                                                                                                                                                                                                                                                                               |
| 107 | Already-posted entries are idempotent                                     | The API uses a transactional approach: soft-deleted rows for the shipment are purged before `createMany`, wrapped in a Prisma `$transaction`, ensuring safe re-posting. Previously posted and then deleted entries can be re-created.                                                                                                                                                                                 |
| 108 | Missing payment/date products are not posted                              | Products with no payment or date set, or whose date precedes the cutover threshold, are excluded from posting by the API.                                                                                                                                                                                                                                                                                             |

---

## M — Reclass to Stock on Hand Workflow

| #   | Logic                                                                                        | Explanation                                                                                                                                                                                                                                                                                                  |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 109 | Reclass to Stock on Hand is initiated from the Products toolbar                              | The toolbar includes a grape-filled **"Reclass to Stock on Hand"** button. It is disabled unless the selected row has a Shipment Code and the selected row's Shipment Status is `Delivered`. Disabled-state message: "Shipment must be Delivered before reclassing."                                         |
| 110 | Reclass resolves the shipment from the selected product row                                  | Clicking the button uses the selected row's Shipment Code and `ProductService.lookupShipment()` to load the full shipment record, including `id`. If the shipment cannot be resolved, a red notification is shown: title **"Shipment Not Found"**, message: "Unable to find shipment {code} for reclassing." |
| 111 | The Products page reuses the shared Transit Reclass modal                                    | The shared `TransitReclassModal` is mounted from the Products page and opened with the resolved shipment record. The modal no longer launches from the Shipments page edit workflow.                                                                                                                         |
| 112 | Expected reclass totals follow the active transit build-up source                            | When the shipment's active build-up entries originate from the product workflow (`PRODUCT_TRANSIT_BUILD:*` keys), the modal's expected total matches the exact selected build-up total instead of linked Product COGS. This keeps the reclass basis aligned with product Grand Total postings.               |
| 113 | Product-origin reclass posts the exact transit build-up amount to Stock on Hand              | For product-origin build-up entries, the reclass route maps each selected transit build-up line back to its Product Code and creates **Dr Stock on Hand / Cr Inventory in Transit** using the same posted amount. Forwarder's Fee, Lalamove, and Packaging remain separate in Landed Cost Clearing.          |
| 114 | Reclass submit now has a SweetAlert2 confirmation prompt                                     | Clicking **"Create Reclass Entry"** in the modal opens a SweetAlert2 confirmation showing Posting Date, Selected Entries count, Expected Reclass Total, and Selected Build-Up Total. The reclass API call only runs when the user confirms.                                                                  |
| 115 | Reclass success and duplicate handling surface as Mantine notifications and refresh products | Success: green notification **"✅ Success"** with message "Reclass entries created successfully!". Duplicate/no-op: blue notification **"ℹ️ Already reclassed"**. After a successful post, `refreshProducts()` is called so the Products page reflects the updated state.                                    |

---

## N — Data Layer (useProductsData)

| #   | Logic                                          | Explanation                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 116 | Product list is fetched via React Query        | `useQuery` with `queryKey = [...queryKeys.products.lists(), apiBasePath]`. Fetches via `ProductService.loadProducts`.                                                                                                                                                                                              |
| 117 | Stale time is 30 seconds                       | `staleTime: 30 * 1000`. Data is considered fresh for 30 s before a background refetch is triggered.                                                                                                                                                                                                                |
| 118 | Search is debounced 300 ms                     | `useDebouncedValue(searchQuery, 300)` delays filtering; `ProductService.searchProducts` is called only after the user stops typing.                                                                                                                                                                                |
| 119 | Add uses optimistic update                     | `addProductMutation` optimistically prepends the new product to the list before the API call resolves. On error the rollback context restores the previous list. Cache is always invalidated on settle.                                                                                                            |
| 120 | Update uses optimistic update                  | `updateProductMutation` optimistically replaces the matching product (by `id`) in the list. Rollback on error. Cache invalidated on settle.                                                                                                                                                                        |
| 121 | Bulk grid mutation does not replace query data | `useProductGridSaveQueue` owns drafts. The bulk mutation neither replaces/rolls back the full cache nor invalidates after every request; reconciliation runs after queued writes drain. Grid filtering, footer totals and page statistic cards use the filtered draft-aware grid projection.                       |
| 122 | Query read failures propagate                  | `useProductsData` uses strict product loading so failed reconciliation retains drafts and reports an error rather than treating an empty array as a successful read. Direct service callers retain the legacy empty-array fallback unless strict loading is requested; shipment-lookup fallback remains supported. |

---

## O — Grid Footer

| #   | Logic                                                      | Explanation                                                                                                                           |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 123 | Footer shows filtered vs total count                       | "Showing {filteredCount} of {totalCount} products" — `filteredCount` is `filteredProducts.length`, `totalCount` is `products.length`. |
| 124 | Footer shows filtered Projected Sales and Projected Profit | "Projected Sales: ₱{N}; Projected Profit: ₱{N}" — computed from the same search-filtered grid statistics using `formatNumber`.        |

---

## P — Product Code Generation (grid inline editing)

| #   | Logic                                                                         | Explanation                                                                                                        |
| --- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 125 | Editing the PRODUCT column (col 10) does not auto-regenerate the product code | Inline cell edits write the raw value directly; code regeneration only happens when saving via the Add/Edit modal. |

---

## Q — Product Code Generation

| #   | Logic                                                        | Explanation                                                                                                                                                                                            |
| --- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 126 | Bundle SKU is auto-generated from Bundle Name + Posting Date | `ProductService.generateProductCode(bundleName, postingDate)` is called whenever Bundle Name or Posting Date changes; the result is written to `bundleSku` unless the user has manually overridden it. |
| 127 | Bundle SKU manual override is tracked by `isBundleSkuManual` | If the displayed SKU differs from the auto-generated SKU, `isBundleSkuManual` is set to `true` and auto-generation is suppressed for that session.                                                     |
| 128 | Mix & Match SKU is auto-generated similarly                  | `ProductService.generateProductCode(mixAndMatchName, postingDate)` generates the SKU; user can override manually.                                                                                      |

---

## R — Bundles Tab

| #   | Logic                                                     | Explanation                                                                                                                                                                                                                                                               |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 129 | Bundles are created via "Create Bundle Batch" button      | Always-enabled button at the top of the Bundles tab. Opens the Bundle modal in create mode with an empty form (Posting Date defaults to today).                                                                                                                           |
| 130 | Bundle modal fields                                       | **Posting Date** (required), **Bundle Name** (required), **Bundle SKU** (auto-generated, editable), **Quantity** (required, > 0), **Price** (≥ 0), **Components** list (Product Code + Included Quantity per row).                                                        |
| 131 | Bundle must have at least one valid component             | `canSubmit` requires `components.some(c => c.productCode.trim() && c.includedQuantity > 0)`. Submit button is disabled until this is satisfied.                                                                                                                           |
| 132 | "Add SKU" adds a new blank component row                  | Each component row has Product Code (text) and Included Quantity (number). Any component with a blank product code or zero quantity is stripped from the payload on save.                                                                                                 |
| 133 | Component rows can be removed                             | Each component row has a remove button that splices out that index from the `components` array.                                                                                                                                                                           |
| 134 | Bundle save closes modal and resets form on success       | On `createMutation.onSuccess` or `updateMutation.onSuccess`: form resets to empty, modal closes, `editingBundleId` clears, error message clears, React Query cache invalidates.                                                                                           |
| 135 | Bundle create error shown inline in modal                 | On `createMutation.onError` or `updateMutation.onError`: `errorMessage` state is set to the error string; a Mantine `Alert` component with title "Error" is rendered in the modal. No toast is used.                                                                      |
| 136 | Modal is locked during saving                             | `handleCloseModal` returns early if `isSaving` (either mutation is pending). The user cannot close the modal mid-save.                                                                                                                                                    |
| 137 | Editing a bundle opens the modal with pre-filled data     | `handleEditBundle` populates the form, sets `editingBundleId`, detects whether the existing SKU is manual, and opens the modal.                                                                                                                                           |
| 138 | Delete bundle uses triple-confirm                         | `handleDeleteBundle` calls `confirmTripleDeleteBundle` which shows a SweetAlert2 dialog: title **"Delete bundle batch?"**, warning: "This will permanently delete {label}.", final prompt: "Type DELETE to confirm." Deletion proceeds only when the user types "DELETE". |
| 139 | Bundle delete success closes modal if editing that bundle | On `deleteMutation.onSuccess`, if `editingBundleId` matches the deleted bundle's ID, the modal is closed and the form is reset. Cache is invalidated.                                                                                                                     |
| 140 | Bundle delete error shown inline                          | `deleteMutation.onError` sets `errorMessage` in the modal.                                                                                                                                                                                                                |
| 141 | Bundle list supports search                               | A search input filters the displayed bundle list by bundle name, SKU, posting date, or component product codes (case-insensitive, trimmed).                                                                                                                               |

---

## S — Mix & Match Tab

| #   | Logic                                                 | Explanation                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 142 | Mix & Match batches are created via "Add New" button  | Opens the MnM modal in create mode with an empty form (Posting Date defaults to today).                                                                                                                                                                                      |
| 143 | Mix & Match modal fields                              | **Posting Date** (required), **Mix & Match Name** (required), **Mix & Match SKU** (auto-generated, editable), **Price** (≥ 0), **Components** list (Product Code + Included Quantity per row). No Quantity field — unlike Bundles, this is quantity-less at the batch level. |
| 144 | At least one valid component required                 | `canSubmit` requires `components.some(c => c.productCode.trim().length > 0 && c.includedQuantity > 0)`. Submit button is disabled otherwise.                                                                                                                                 |
| 145 | Product code options in component rows                | The dropdown shows available product codes (filtered from `products`) plus any currently selected codes, sorted alphabetically.                                                                                                                                              |
| 146 | Save calls upsert                                     | `saveMixAndMatchMutation` determines create vs update based on `editingMixAndMatchId`. On success: cache invalidated, form reset, modal closed. On error: throws "Failed to save mix & match" (no inline error message — the mutation throws).                               |
| 147 | Delete uses triple-confirm                            | `confirmTripleDeleteMixAndMatch` shows SweetAlert2: title "Delete mix & match batch?", warning listing the batch label, final prompt "Type DELETE to confirm."                                                                                                               |
| 148 | Deleted batch closes edit modal if it is being edited | On `deleteMixAndMatchMutation.onSuccess`, if the deleted ID matches `editingMixAndMatchId`, the modal is closed and form is reset.                                                                                                                                           |
| 149 | Mix & Match list supports search                      | Filters by posting date, name, SKU, or product codes (case-insensitive).                                                                                                                                                                                                     |
| 150 | MnM allocation is proportional by availability        | `allocateByAvailability` weights allocation by each component's available stock; floor division first, then remainder goes to the highest fractional parts, alphabetical tie-break.                                                                                          |
| 151 | Zero-availability components get zero allocation      | If a component has no stock, it receives zero regardless of demand.                                                                                                                                                                                                          |

---

## T — Shipping Fee Calculator Tab

| #   | Logic                                                          | Explanation                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 152 | Calculator has three input fields under "ACTUAL SHIPPING FEES" | **Alibaba Shipping Cost** (₱), **Forwarder's Fee (KPC)** (₱), **Lalamove** (₱). All are `NumberInput` with comma thousand separator and 2 dp.                                                                                                                                   |
| 153 | Shipment Code is selected via a searchable dropdown            | "Select Shipment Code" dropdown under "SHIPMENT CODE DETAILS". Only shipments whose `Shipment Status !== 'Delivered'` appear. Dropdown is clearable and searchable.                                                                                                             |
| 154 | Selected shipment code is persisted in `localStorage`          | Key: `shippingFeeCalculator:selectedShipmentCode`. On page reload the stored code is automatically restored if it still appears in the active shipment list; otherwise it is cleared.                                                                                           |
| 155 | Selecting a shipment code pre-populates the grid               | Products belonging to that shipment code are loaded into the Handsontable breakdown grid with their Product Code and Actual Quantity. Saved state (multipliers, actual fee amounts) are also restored from the server if available.                                             |
| 156 | Only the MULTIPLIER column is editable                         | All other columns (Product Code, Actual Quantity, Approx Quantity, Percentage, Alibaba, Forwarder's Fee, Lalamove, Packaging) are read-only.                                                                                                                                    |
| 157 | Allocation algorithm per row                                   | `aproxQuantity = actualQuantity × multiplier`. `percentage = aproxQuantity / totalAproxQuantity`. Allocated cost = `percentage × actual fee`.                                                                                                                                   |
| 158 | Packaging receives the same allocation as Lalamove             | `packaging = lalamove cost allocation`. They share the same last-mile cost bucket.                                                                                                                                                                                              |
| 159 | Recalculation fires on every actual-fee or multiplier change   | Changes to Alibaba, Forwarder's Fee, or Lalamove inputs trigger a full `calculateShippingRows` recalculation; editing a MULTIPLIER cell also triggers it via `handleAfterChange`.                                                                                               |
| 160 | State is auto-saved to the server on every change              | After recalculation, `saveData` POST request is made with `{ shipmentCode, actualInputs, multipliers }`. Success shows Mantine notification: title **"Saved"**, message "Data saved successfully", green. Failure shows: title **"Error"**, message "Failed to save data", red. |
| 161 | Clearing shipment code resets all inputs                       | Setting the shipment dropdown to null clears `actualAlibabaShipping`, `actualForwardersFee`, `actualLalamove`, and resets the grid to a single blank row.                                                                                                                       |
| 162 | Load state failure shows red notification                      | If `loadSavedState` fetch fails: title **"Error"**, message "Failed to load saved data", red.                                                                                                                                                                                   |
| 163 | Result Summary shows 6 aggregate cards                         | **Products** (count), **Actual Qty** (sum), **Approx Qty** (multiplier-adjusted sum), **Alibaba Shipping** (₱ sum of allocated costs), **Forwarder's Fee** (₱ sum), **Lalamove / Packaging** (₱ sum).                                                                           |

---

## U — Product Code Generation (CSV Import)

| #   | Logic                                            | Explanation                                                                                                     |
| --- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 164 | CSV expects exactly 36 columns                   | The import parser processes 36 fixed-position columns; missing columns are padded with empty strings.           |
| 165 | Date format supports MM-DD-YYYY, MMDDYY, and ISO | `parseCSVDate` handles three formats; unrecognised formats produce an empty string.                             |
| 166 | Numeric CSV fields use safe parsing              | `toSafeNumber` strips commas, handles null/undefined/empty, and returns 0 for unparsable values.                |
| 167 | Financial calculations run on each imported row  | `ProductService.calculateFinancials` runs on every row to populate derived fields (PHP, COGS, etc.).            |
| 168 | CSV with no data rows is rejected                | Returns error "CSV file is empty or contains no data rows".                                                     |
| 169 | CSV with all invalid rows is rejected            | Returns error "No valid product data found in the CSV file".                                                    |
| 170 | Per-row parse errors are collected and returned  | Each invalid row appends "Error parsing row N: {message}" to the `errors` array; valid rows are still imported. |
