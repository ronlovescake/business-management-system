# Clothing — Products Split (Break-Pack) Business Logic

> **Status: PLANNING — not yet implemented**
>
> **Planned source files:**
>
> - `prisma/schema.prisma` — `SplitBatch` + `SplitBatchComponent` models
> - `src/modules/clothing/operations/products/components/SplitTab.tsx`
> - `src/modules/clothing/operations/products/components/ProductsPage.tsx` — 5th tab
> - `src/modules/clothing/operations/products/services/SplitService.ts`
> - `src/modules/clothing/operations/products/services/stockCheckService.ts` — split-child branch
> - `src/modules/transactions/api/transactionInventorySync.ts` — split-child branch
> - `src/lib/inventory/splitTag.ts` — `SPLIT_NAME_PREFIX = '[SPLIT] '`
> - `src/app/api/split-batches/route.ts`

---

## Overview

Split (Break-Pack) is the inverse of Bundle / Mix & Match. A multi-piece set
product (e.g. "Organic Cotton Willow + Whimsy 3-PC Set") is broken into
individual sellable child items (top, bottom, bonnet). Each child sale deducts
from the parent set's on-hand quantity. Loose pieces created when a set is
partially sold are consumed first before opening another set.

**Scope:** Clothing products only (for now).

---

## A — Data Model

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1   | Dedicated `SplitBatch` table (not reusing `BundleBatch`)         | The relationship is inverted (parent → children) vs Bundle/MnM (children → composite), so a separate model.  |
| 2   | `SplitBatch` fields: `id`, `splitName`, `splitSku` (parent SKU), `postingDate`, `createdAt`, `updatedAt` | Core batch record linking to the parent set product.                                                        |
| 3   | `SplitBatchComponent` fields: `id`, `splitBatchId`, `componentLabel`, `componentSku`, `includedQuantity` | Each component row represents one piece type in the set.                                                     |
| 4   | `splitName` is prefixed with `[SPLIT] ` via `SPLIT_NAME_PREFIX`  | Consistent with the `[MIXMATCH] ` naming convention used by Mix & Match.                                     |
| 5   | `splitSku` stores the parent product's `productCode`             | Links the split batch back to the parent set product in the `Product` table.                                 |
| 6   | `componentSku` is a new product code for the child piece         | Auto-generated or user-entered; becomes a real row in the Products grid.                                     |

---

## B — Auto-Create Product & Price Rows

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 7   | On save, create a `Product` row for each component SKU           | Child pieces appear as real products in the Products grid.                                                   |
| 8   | Child product `quantity` is set to `0`                            | Actual stock is derived from the parent; the child row exists only for sellability.                          |
| 9   | On save, create a `Price` row for each component SKU             | Ensures the child SKU appears in the transaction Product Code dropdown.                                      |
| 10  | Child price defaults to `0.00`; user sets the real price in the Products grid | Pricing is managed through the standard Products/Prices workflow, not in the Split modal.                    |
| 11  | Auto-created products inherit `shipmentCode` from the parent     | Links the child to the same shipment batch for traceability.                                                 |

---

## C — Split Tab UI

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 12  | Split is the 5th tab on the Clothing Products page               | Tab order: Products, Bundles, Mix & Match, Shipping Calculator, Split.                                       |
| 13  | Table columns: Split Name, Parent SKU, Components (count), Posting Date, Actions | Mirrors the MixAndMatchTab table layout.                                                                     |
| 14  | Create/Edit modal fields: Posting Date, Parent SKU (dropdown), Component rows (label + SKU) | Minimal modal — pricing is handled in the Products grid after save.                                          |
| 15  | Parent SKU dropdown shows only set products (multi-piece items)  | Filter logic TBD — may use naming convention or a flag on the Product record.                                |
| 16  | Component rows are dynamic — user can add/remove rows            | Each row has: label (e.g. "Top"), SKU (e.g. "OCWW-TOP-030426"), included quantity (defaults to 1).          |
| 17  | Delete uses `confirmTripleDelete` pattern                        | Consistent with Bundle and MnM deletion flow.                                                                |

---

## D — Inventory Model (Break-Pack with Loose Piece Tracking)

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 18  | Parent set has `quantity` = number of complete sets on hand       | E.g. 1000 sets of "3-PC Set".                                                                                |
| 19  | Selling 1 child piece "opens" 1 parent set                       | Parent quantity decreases by 1; remaining pieces from that set become loose.                                 |
| 20  | Loose pieces from opened sets are consumed before opening new sets | FIFO-like: if 1 loose bottom exists, selling a bottom uses the loose piece (no new set opened).              |
| 21  | A set is fully consumed when all its pieces have been sold        | E.g. selling top, bottom, and bonnet from the same opened set = 1 full set consumed.                        |
| 22  | Available stock for a child piece = (parent sets × included qty) + loose pieces | The stock check must compute this dynamically, not read child `quantity` directly.                           |

---

## E — Stock Check Integration

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 23  | Add split-child detection branch in `checkClothingStock()`       | Must come before the regular product fallthrough path.                                                       |
| 24  | Detect split-child SKU by looking up `SplitBatchComponent` by `componentSku` | If found, the SKU is a split-child; redirect to parent stock calculation.                                    |
| 25  | Compute effective on-hand: `(parentOnHand × childIncludedQty) + looseCount` | `parentOnHand` from `actualQuantityMap`, `looseCount` from tracking (TBD: inventory movements or counter).   |
| 26  | Pass computed on-hand to `summarizeStatus()` as normal            | Reuses existing LOW_STOCK / IN_STOCK / SOLD_OUT classification.                                              |
| 27  | Without this fix, child products return SOLD_OUT (quantity = 0)   | The regular product path reads `product.quantity` which is 0 for split-children.                             |

---

## F — Inventory Sync (Transaction Side)

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 28  | Add split-child detection in `syncInventoryMovementsForTransaction()` | After the existing MnM check, before regular product handling.                                               |
| 29  | Detect split-child by looking up `SplitBatchComponent` by product code | Same lookup as stock check.                                                                                  |
| 30  | Create inventory movement targeting the parent SKU               | Movement `productCode` = parent set's SKU, not the child SKU.                                                |
| 31  | Movement quantity = child's `includedQuantity` × transaction quantity | If selling 2 tops from a 3-PC set, 2 sets are opened (assuming no loose).                                    |
| 32  | Track loose pieces via inventory movements or dedicated counter   | TBD: may use `InventoryMovement` entries with a `split_loose` bucket or a counter field on `SplitBatch`.    |

---

## G — Inventory Page Integration

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 33  | `buildInventoryItems()` in `inventoryTransforms.ts` needs split awareness | Split-child items should show derived stock, not `quantity: 0`.                                              |
| 34  | Inventory grid should display parent set reference for split-children | Visual indicator that the item's stock comes from a parent set.                                              |

---

## H — Validation Constraints

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 35  | A product can only be the parent of one active SplitBatch         | Prevents conflicting split definitions for the same set.                                                     |
| 36  | Component SKUs must be unique across all SplitBatches             | A child SKU cannot belong to multiple split definitions.                                                     |
| 37  | Component SKUs must not collide with existing product codes       | Unless the product was auto-created by a previous save of the same SplitBatch.                               |
| 38  | At least 2 components are required per SplitBatch                 | A "split" of 1 item is meaningless.                                                                          |
| 39  | Parent SKU must exist in the Products table                       | Cannot split a non-existent product.                                                                         |
| 40  | Parent SKU must not be a MnM SKU or Bundle SKU                   | Cannot split a composite product (no nesting).                                                               |

---

## I — Visual Indicators (Polish)

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 41  | Split-child products show a `[SPLIT]` badge in the Products grid | Helps users distinguish auto-created split-children from normal products.                                    |
| 42  | Products grid shows parent set name/SKU for split-children       | Quick reference without opening the Split tab.                                                               |

---

## J — Edge Cases

| #   | Rule                                                              | Explanation                                                                                                  |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 43  | Deleting a SplitBatch does NOT delete auto-created child Products | Child products may already have transaction history; deletion would break references.                        |
| 44  | Editing a SplitBatch allows adding/removing components            | Adding a new component auto-creates its Product + Price row; removing does NOT delete the child product.     |
| 45  | If parent product is deleted, SplitBatch becomes orphaned         | UI should warn or prevent deleting a product that is a split parent.                                         |
| 46  | Restocking the parent resets loose piece tracking                 | When new sets arrive, loose counts may need manual adjustment or zeroing.                                    |

---

## K — Implementation Phases

| Phase | Scope                                                            |
| ----- | ---------------------------------------------------------------- |
| 1     | Schema migration, API route, SplitTab UI, auto-create Product + Price rows, `splitTag.ts`, 5th tab on ProductsPage |
| 2     | Split-child branch in `checkClothingStock()`, split-child branch in `syncInventoryMovementsForTransaction()`, split-aware `buildInventoryItems()` |
| 3     | Visual indicators, loose piece tracking refinement, validation constraints (rules 35–40), edge case handling |
