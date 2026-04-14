# Clothing — Inventory Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryPage.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSubmit.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryQuickAdjustments.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentEditActions.ts`
> - `src/lib/inventory/splitAllocation.ts`

---

## A — Inventory Page Data Flow

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | The Inventory page loads products, transactions, bundles, mix-and-match rows, split batches, and inventory movements | Split definitions are now part of the standard inventory data load. |
| 2 | The page still has two tabs: Inventory and Adjustments | Inventory shows current derived stock; Adjustments shows movement history and edit/delete actions. |
| 3 | Search and non-zero sellable filtering operate on the derived inventory dataset | Operators search the computed view, not raw product quantities. |
| 4 | Data load failures still raise a red notification | The page does not silently swallow inventory-load failures. |

---

## B — Core Inventory Derivation

| # | Logic | Explanation |
| --- | --- | --- |
| 5 | Sold quantity is derived from order statuses, not from manual adjustment buckets | `ready for dispatch`, `checked out`, and `shipped` count as sold demand. |
| 6 | Reserved quantity is derived from active operational demand | Non-cancelled, non-sold transaction demand is committed against sellable availability. |
| 7 | Additionals and transfers are still identified by note prefixes | `additionals` and `transfer` movement notes remain special-case inputs to inventory math. |
| 8 | Actual received quantity is still adjusted by movement buckets before sellable stock is computed | Damaged-hold and supplier-short movements reduce effective on-hand; additionals restore stock. |
| 9 | All displayed inventory bucket values floor at zero | Negative UI inventory is prevented by design. |

---

## C — Composite Inventory Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 10 | Bundle demand is not surfaced as a separate reserved bucket in the inventory grid | The transform intentionally avoids a confusing bundle-reserved presentation. |
| 11 | Mix-and-match demand is allocated across pooled component availability | Component demand is distributed via `allocateByAvailability`, not one-to-one against the virtual mix SKU. |
| 12 | Split-child demand is excluded from the direct per-product demand maps | Split children are handled in a dedicated allocation pass instead of being treated as normal standalone SKUs. |
| 13 | Split-child demand is rolled up to the parent SKU | Parent reserved and sold quantities reflect opened sets required by split-child transactions. |
| 14 | Split sibling demand reuses loose pieces before opening another parent set | The parent is consumed by the highest normalized sibling demand, not by summing all child quantities. |
| 15 | Split-child revenue is rolled up to the parent inventory row | Parent sales metrics include child transactions. |
| 16 | Split-child availability is derived, not stored | Child availability comes from loose pieces plus remaining complete parent sets. |
| 17 | Inventory rows are no longer purely independent per product | Split allocation is an explicit cross-SKU rollup in the inventory transform. |

---

## D — What the Inventory Grid Shows for Split Items

| # | Logic | Explanation |
| --- | --- | --- |
| 18 | A split parent shows remaining complete sets after child demand | Parent sellable stock reflects break-pack consumption. |
| 19 | A split child is sellable even when it has no independent product quantity | The inventory layer computes child availability from the parent split definition. |
| 20 | The products grid can mark split children with a `[SPLIT]` badge | This is a visual indicator only; inventory still comes from the parent set. |

---

## E — Adjustment Workflow

| # | Logic | Explanation |
| --- | --- | --- |
| 21 | The full Adjust modal still edits inventory through movement rows, not direct quantity mutation | Operators set target changes that become inventory movements. |
| 22 | Transfer destination remains required for any non-zero transfer delta | Source and destination cannot be the same product code. |
| 23 | Reverse-transfer checks destination sellable stock before allowing the edit | The destination must have enough sellable stock to reverse the transfer. |
| 24 | Note-only edits still short-circuit quantity writes | If only notes changed, the system updates the latest movement note without bucket rewrites. |
| 25 | Successful adjustment save, edit, and delete operations still use green notifications; failures use red notifications | The refactor did not change the operator-facing adjustment feedback flow. |

---

## F — Quick Adjustments

| # | Logic | Explanation |
| --- | --- | --- |
| 26 | Supplier Short quick adjustment records `sellable → supplier_short` | Product code and positive quantity are required. |
| 27 | Additionals quick adjustment records `supplier_short → sellable` | Notes are prefixed with the additionals marker. |
| 28 | Both quick-adjust flows still reset the modal state after successful save | Quantity resets and notes clear after success. |

---

## G — CSV Import / Export

| # | Logic | Explanation |
| --- | --- | --- |
| 29 | Inventory CSV import is still simulation-only | No inventory data is persisted through the current import button. |
| 30 | Inventory CSV export is still simulation-only | The export action does not produce a real file yet. |

---

## H — Transfer Validation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 31 | Transfer destination is required whenever transfer quantity is non-zero | Blank destination blocks the adjustment. |
| 32 | A product cannot be its own transfer destination | Same-code transfers are rejected. |
