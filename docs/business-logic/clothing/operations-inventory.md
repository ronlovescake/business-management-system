# Clothing — Inventory Business Logic

## Adjustments And Physical Returns

Sellable availability deducts scrap/write-offs as well as sold and reserved
demand. Received quantity is not treated as the current stock count.
A physical return from `sold` restores stock only to its selected bucket:
100 received, 20 sold, and 5 returned to sellable leaves 85 available; a return
to damaged hold or scrap leaves 80 sellable and 5 in that bucket. Monetary-only
refunds do not restock. Returns to reserved or assembly WIP are not sellable.
Manual scrap-to-sellable reversals carry `movementSource: inventory_adjustment`;
unmarked legacy scrap-origin receipts are not assumed to reverse write-offs.

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

| #   | Logic                                                                                                                | Explanation                                                                                        |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | The Inventory page loads products, transactions, bundles, mix-and-match rows, split batches, and inventory movements | Split definitions are now part of the standard inventory data load.                                |
| 2   | The page still has two tabs: Inventory and Adjustments                                                               | Inventory shows current derived stock; Adjustments shows movement history and edit/delete actions. |
| 3   | Search and non-zero sellable filtering operate on the derived inventory dataset                                      | Operators search the computed view, not raw product quantities.                                    |
| 4   | Data load failures still raise a red notification                                                                    | The page does not silently swallow inventory-load failures.                                        |

---

## B — Core Inventory Derivation

| #   | Logic                                                                                            | Explanation                                                                                                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Identified actual sale movements remain sold through later cancellation                          | Structured transaction/source/type metadata or the existing legacy auto-sale marker ties a sale to its order. The same current fulfilled order is not counted twice; status-derived sold demand remains the legacy fallback for orders without an identified sale movement. Composite allocation excludes already-posted orders. |
| 6   | Reserved quantity is derived from active operational demand                                      | Non-cancelled, non-sold transaction demand is committed against sellable availability.                                                                                                                                                                                                                                           |
| 7   | Additionals and transfers are still identified by note prefixes                                  | `additionals` and `transfer` movement notes remain special-case inputs to inventory math.                                                                                                                                                                                                                                        |
| 8   | Actual received quantity is still adjusted by movement buckets before sellable stock is computed | Damaged-hold and supplier-short movements reduce effective on-hand; additionals restore stock.                                                                                                                                                                                                                                   |
| 9   | All displayed inventory bucket values floor at zero                                              | Negative UI inventory is prevented by design.                                                                                                                                                                                                                                                                                    |

### Physical Location And Reservation Split

An explicitly In Transit shipment has zero physically received, on-hand reserved
and on-hand sellable quantity. Its remaining supply is split into in-transit
reserved and unreserved quantities. Received products use the on-hand pair;
reservations shown in either location cannot exceed remaining supply. Existing
sold, scrap, physical-return, supplier-short, additionals, transfer and composite
allocation rules still reduce or restore the appropriate supply. Available Stock
and ending available-inventory value refer to physically available stock, not
goods still travelling. Legacy products without an explicit In Transit status
retain their existing received-supply fallback; the label is not evidence that
historical physical counts have been reconciled.

This projection is read-only. A shipment availability label never creates an
accounting journal, changes a receipt or posts a financial reclassification.
Confirmed actual goods and separately approved accounting events remain required.

The actual table exposes On-Hand Reserved/Sellable and In-Transit
Reserved/Unreserved independently. Desktop/mobile browser regressions verify
10 received with 4 reserved shows 6 on-hand sellable, while the same explicit
In Transit lot shows 4 transit reserved, 6 transit unreserved and zero physical
stock. Identified actual sold movements survive a later order cancellation;
only a real return movement restores the chosen physical bucket.

This is a shipment/lot-level projection. There is no new partial-receipt or
unknown-location inference: mixed/legacy physical locations require explicit
operational review and a real count. The display is not evidence that historical
inventory has been counted or reconciled. Dated cost correction and missing-cost
controls are documented in [P&L](accounting-profit-loss.md#valuation-completeness-and-dated-corrections).

---

## C — Composite Inventory Rules

| #   | Logic                                                                             | Explanation                                                                                                   |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 10  | Bundle demand is not surfaced as a separate reserved bucket in the inventory grid | The transform intentionally avoids a confusing bundle-reserved presentation.                                  |
| 11  | Mix-and-match demand is allocated across pooled component availability            | Component demand is distributed via `allocateByAvailability`, not one-to-one against the virtual mix SKU.     |
| 12  | Split-child demand is excluded from the direct per-product demand maps            | Split children are handled in a dedicated allocation pass instead of being treated as normal standalone SKUs. |
| 13  | Split-child demand is rolled up to the parent SKU                                 | Parent reserved and sold quantities reflect opened sets required by split-child transactions.                 |
| 14  | Split sibling demand reuses loose pieces before opening another parent set        | The parent is consumed by the highest normalized sibling demand, not by summing all child quantities.         |
| 15  | Split-child revenue is rolled up to the parent inventory row                      | Parent sales metrics include child transactions.                                                              |
| 16  | Split-child availability is derived, not stored                                   | Child availability comes from loose pieces plus remaining complete parent sets.                               |
| 17  | Inventory rows are no longer purely independent per product                       | Split allocation is an explicit cross-SKU rollup in the inventory transform.                                  |

---

## D — What the Inventory Grid Shows for Split Items

| #   | Logic                                                                      | Explanation                                                                       |
| --- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 18  | A split parent shows remaining complete sets after child demand            | Parent sellable stock reflects break-pack consumption.                            |
| 19  | A split child is sellable even when it has no independent product quantity | The inventory layer computes child availability from the parent split definition. |
| 20  | The products grid can mark split children with a `[SPLIT]` badge           | This is a visual indicator only; inventory still comes from the parent set.       |

---

## E — Adjustment Workflow

| #   | Logic                                                                                                                 | Explanation                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 21  | The full Adjust modal still edits inventory through movement rows, not direct quantity mutation                       | Operators set target changes that become inventory movements.                               |
| 22  | Transfer destination remains required for any non-zero transfer delta                                                 | Source and destination cannot be the same product code.                                     |
| 23  | Reverse-transfer checks destination sellable stock before allowing the edit                                           | The destination must have enough sellable stock to reverse the transfer.                    |
| 24  | Note-only edits still short-circuit quantity writes                                                                   | If only notes changed, the system updates the latest movement note without bucket rewrites. |
| 25  | Successful adjustment save, edit, and delete operations still use green notifications; failures use red notifications | The refactor did not change the operator-facing adjustment feedback flow.                   |

---

## F — Quick Adjustments

| #   | Logic                                                                     | Explanation                                      |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------ |
| 26  | Supplier Short quick adjustment records `sellable → supplier_short`       | Product code and positive quantity are required. |
| 27  | Additionals quick adjustment records `supplier_short → sellable`          | Notes are prefixed with the additionals marker.  |
| 28  | Both quick-adjust flows still reset the modal state after successful save | Quantity resets and notes clear after success.   |

---

## G — CSV Import / Export

| #   | Logic                                         | Explanation                                                       |
| --- | --------------------------------------------- | ----------------------------------------------------------------- |
| 29  | Inventory CSV import is still simulation-only | No inventory data is persisted through the current import button. |
| 30  | Inventory CSV export is still simulation-only | The export action does not produce a real file yet.               |

---

## H — Transfer Validation Rules

| #   | Logic                                                                   | Explanation                              |
| --- | ----------------------------------------------------------------------- | ---------------------------------------- |
| 31  | Transfer destination is required whenever transfer quantity is non-zero | Blank destination blocks the adjustment. |
| 32  | A product cannot be its own transfer destination                        | Same-code transfers are rejected.        |
