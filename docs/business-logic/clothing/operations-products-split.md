# Clothing — Products Split (Break-Pack) Business Logic

> **Status: IMPLEMENTED**
>
> **Primary source files:**
>
> - `prisma/schema.prisma`
> - `src/app/api/split-batches/route.ts`
> - `src/modules/clothing/operations/products/components/SplitTab.tsx`
> - `src/modules/clothing/operations/products/components/ProductsPage.tsx`
> - `src/modules/clothing/operations/products/services/stockCheckService.ts`
> - `src/modules/transactions/api/transactionInventorySync.ts`
> - `src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts`
> - `src/lib/inventory/splitAllocation.ts`
> - `src/lib/inventory/splitLookup.ts`
> - `src/lib/inventory/splitTag.ts`

---

## A — Overview

Split (break-pack) is the clothing-only workflow for turning one delivered set
SKU into multiple sellable child SKUs without maintaining separate child stock
rows. The parent set remains the stock source of truth. Child availability is
derived at runtime from the parent set quantity plus any loose pieces created by
prior sibling sales.

The implemented model follows true break-pack behavior:

- sibling child demand reuses loose pieces before another parent set is opened
- parent consumption is driven by the **highest normalized child demand**, not
	the sum of all child transactions
- child stock is computed dynamically; it is **not** read from a child product
	quantity field

---

## B — Data Model

| # | Rule | Explanation |
| --- | --- | --- |
| 1 | Split definitions live in dedicated `SplitBatch` and `SplitBatchComponent` tables | Split is modeled separately from Bundle and Mix & Match because the parent/child direction is inverted. |
| 2 | `SplitBatch` stores `postingDate`, `splitName`, and `splitSku` | `splitSku` is the parent set product code; `splitName` is stored with the `[SPLIT] ` prefix. |
| 3 | `SplitBatchComponent` stores `componentLabel`, `componentSku`, `componentPrice`, and `includedQuantity` | Child labels, SKUs, pricing, and piece counts are persisted on the split definition itself. |
| 4 | `componentPrice` is part of the authoritative split definition | Prices for split-child SKUs are resolved from split batch data in the Prices workflow. |
| 5 | Component SKUs are definition rows, not inventory rows | The split definition can exist even when no child `Product` row exists. |

---

## C — Split Tab UI

| # | Rule | Explanation |
| --- | --- | --- |
| 6 | Split is the 5th tab on Clothing Products | Tab order is Products, Bundles, Mix & Match, Shipping Fee Calculator, Split. |
| 7 | The split table shows Posting Date, Split Name, Parent SKU, Component Label, Child SKU, Price, and Included Qty | The table exposes the persisted split definition directly. |
| 8 | The modal captures Posting Date, Parent SKU, Label, Child SKU, Price, and Included Qty per component | Price is edited inside the Split modal, not indirectly through auto-created price rows. |
| 9 | Parent SKU options are limited to delivered set products with positive sellable stock | The dropdown is filtered against current inventory, not just raw product presence. |
| 10 | Child SKUs auto-generate from component label + posting date | Operators can overwrite the generated SKU; edits preserve manually-entered SKUs. |
| 11 | At least two components are required | A split definition with fewer than two child pieces is rejected. |

---

## D — Persistence Rules

| # | Rule | Explanation |
| --- | --- | --- |
| 12 | Saving a split batch persists only `SplitBatch` + `SplitBatchComponent` rows | The current implementation does **not** auto-create child product rows. |
| 13 | Saving a split batch does not auto-create `Price` rows | Split-child prices are surfaced virtually through split batch data. |
| 14 | Editing a split batch replaces its component rows in-place | The batch remains the authoritative source for labels, SKUs, prices, and included quantities. |
| 15 | Deleting a split batch removes only the split definition | No product or price cleanup runs as part of split deletion. |

---

## E — Validation Rules

| # | Rule | Explanation |
| --- | --- | --- |
| 16 | Parent SKU must exist in Clothing Products | The API rejects split definitions for missing parents. |
| 17 | A parent SKU can only have one active split definition | Duplicate split parents are blocked. |
| 18 | Parent SKU cannot already be used as a Bundle or Mix & Match SKU | Nested composite definitions are not allowed. |
| 19 | Component SKUs must be unique across split batches | A child SKU cannot belong to multiple split definitions. |
| 20 | Component prices must be finite and non-negative | Split child pricing is validated at save time. |

---

## F — Inventory & Availability Model

| # | Rule | Explanation |
| --- | --- | --- |
| 21 | Parent set quantity remains the physical stock baseline | The parent product is the only physical set inventory source. |
| 22 | Split-child availability is derived from parent stock plus loose pieces | Child rows do not own independent on-hand inventory. |
| 23 | Opened parent sets are determined by the highest sibling demand ratio | For a 2-piece set, 300 tops + 300 bottoms consumes 300 sets, not 600. |
| 24 | Loose sibling pieces are reused before opening more sets | This is the core break-pack rule implemented by `summarizeSplitChildAllocations`. |
| 25 | Parent availability is reported as remaining complete sets | Inventory and stock checks expose parent stock in whole-set terms. |
| 26 | Child availability is reported as `loose pieces + (remaining sets × included qty)` | The UI can show both child stock and parent remainder without duplicating stock rows. |
| 27 | Child transaction revenue rolls up to the parent in inventory reporting | Split-child sales contribute to parent sales metrics in the inventory view. |

---

## G — Stock Check & Transaction Integration

| # | Rule | Explanation |
| --- | --- | --- |
| 28 | `checkClothingStock()` resolves split parents and split children before normal product fallback | Split stock checks are branch-specific, not inferred from zero child quantity. |
| 29 | Split parents return remaining complete sets | The stock-check message explicitly references remaining set count. |
| 30 | Split children return loose-piece-aware availability | The stock-check message shows loose pieces plus remaining complete sets. |
| 31 | Transaction reference validation accepts split-child SKUs even without child product rows | Split-child sales can be saved without creating product-table placeholders. |
| 32 | Split-child shipment code and shipment status inherit from the parent SKU | Transaction UI autofill uses the parent product metadata for split children. |

---

## H — Inventory Movement Sync

| # | Rule | Explanation |
| --- | --- | --- |
| 33 | Split-child transactions sync inventory movements against the parent SKU | Reserve/sale movements are posted to the parent set code, not the child code. |
| 34 | Split-child movement sync reuses the standard reserve/sale note pattern | Notes stay `auto-reserve txn {id}` and `auto-sale txn {id}` even when the target product is the parent SKU. |
| 35 | Prepared + fully paid split-child transactions are treated as fulfilled | The same paid-and-prepared rule used for standard SKUs applies to split children. |
| 36 | Loose-piece math is not stored as a separate inventory movement bucket | Loose-piece reuse is computed by the allocation layer during stock and inventory reads. |

---

## I — Pricing & Product Grid Integration

| # | Rule | Explanation |
| --- | --- | --- |
| 37 | Split-child SKUs appear in the Prices workflow without requiring price-table seed rows | `usePriceForm` includes split component SKUs in product-code options. |
| 38 | The effective price for a split-child SKU comes from `componentPrice` first | Price resolution order is split component price, then product actual price, then bundle/mix sources. |
| 39 | Products grid marks split-child SKUs with a `[SPLIT]` badge | The badge is visual-only; it does not imply the child has its own stock quantity. |
| 40 | Editing a child product row must not rewrite the split-defined child SKU | The products API preserves split-child product codes during product edits. |

---

## J — Current Implementation Note

The split workflow is now implemented and production-shaped, but the source of
truth is intentionally split across two layers:

- persistence layer: `SplitBatch` and `SplitBatchComponent`
- runtime allocation layer: `summarizeSplitChildAllocations`

That means split behavior is correct for availability, stock checks, inventory
reporting, and transaction movement targeting, but it does **not** use a
dedicated loose-piece inventory bucket.
