# Clothing — Inventory Business Logic

Employee steps are owned by the [Master SOP Manual](operations-workflow.md).
This file owns quantity/cost enforcement, supported corrections and compatibility.

## Adjustments And Physical Returns

Sellable availability deducts scrap/write-offs as well as sold and reserved
demand. Received quantity is not treated as the current stock count.
A physical return from `sold` restores stock only to its selected bucket:
100 received, 20 sold, and 5 returned to sellable leaves 85 available; a return
to damaged hold or scrap leaves 80 sellable and 5 in that bucket. Monetary-only
refunds do not restock. Returns to reserved or assembly WIP are not sellable.
Manual scrap-to-sellable reversals carry `movementSource: inventory_adjustment`;
unmarked legacy scrap-origin receipts are not assumed to reverse write-offs.

### Approved Free Goods And Transfers

The requesting business owner approved separate, explicitly zero-acquisition-cost
supplier extras on October28. They are not customer giveaways:1,000 units bought
at PHP20 plus100 free units may all sell at PHP50, producing PHP55,000 revenue
and PHP20,000 total COGS. Paid carrying cost is not redistributed and prior sales
are not rewritten. A genuine Additionals receipt records `costBasis: FREE_GOODS`
and `unitCost: 0`; an unmarked zero or absent cost is still incomplete valuation.
Stock checks count the extra quantity once, not again as negative Supplier Short.

`src/lib/inventory/cost-lots.ts` preserves actual receipt allocation and costs
through sellable/held/reserved locations. Clothing fulfillment snapshots those
allocations; returns preserve the original sale cost and source link. The owning
`POST /api/inventory/movements` transfer operation writes both product sides in
one keyed serializable transaction, validates the Manila date/runtime cutoff and
authenticated operational role, rejects oversubscription and carries source cost
rather than destination catalog cost. A reverse transfer uses only remaining
original transfer receipts and appends dated opposite movements. Posted transfer
and free-cost provenance cannot be edited or deleted through adjustment APIs.
One-sided transfer requests are rejected. The existing Adjust form uses this
operation; identical-key retries reuse the server result and changed details
conflict. There is no persisting CSV import or background transfer job.

The additive `20261028000001_inventory_movement_cost_provenance` migration adds
nullable cost-basis/source links only; legacy records are not rewritten. Deployment
and business-database migration remain separate, unauthorized operations. These
Clothing changes do not replace General Merchandise's independent inventory API
or approve its free-goods/return allocation policy. I06's real isolated browser
sequence and failure/race evidence are recorded in the reconciliation report.

Recorded future receipts are known but unavailable for an earlier posting date;
they do not enable the legacy no-receipt catalog fallback. The latter remains
only for histories with no recorded receipt evidence at all.

### Approved Original Composite Returns

On October28 the requesting business owner approved restoring exact original
components and recorded costs, then explicitly required operator-recorded split
component acquisition costs. Selling prices do not allocate acquisition cost.
Included piece costs must exactly conserve the recorded parent receipt cost;
missing legacy costs remain null and physical opening rejects unresolved values.
`20261028000002_split_acquisition_cost` is additive and has no historical backfill.
An explicitly entered zero component cost is valid only when all included costs
still conserve the parent. It records `SPLIT_ALLOCATION`, not supplier-free status.
Conserved `ASSEMBLY` zero lots are also known cost; unmarked zeros remain unknown.

The transaction writer snapshots actual sale lots and preserves them after later
status, stock or definition changes. Mix fulfillment excludes its own reservation
and must allocate the full quantity. The keyed physical-only Customers action
loads all original sale/return movements, requires the actual component for a
multi-SKU sale, caps each original lot independently and carries its source/cost.
Monetary refunds remain separate; this approval does not invent a payout policy.

`bundle-stock.ts` converts original component lots into value-conserving assembled
lots. `split-stock.ts` opens only enough parent sets, stores exact included pieces
and reuses loose stock for sibling orders. A partial return remains a loose piece.
Only all pieces from the same original opening, at its conserved value, may rebuild
that parent set; repeated or competing final-piece returns cannot rebuild twice.
Used bundle/mix definitions and opened split definitions cannot be edited or
deleted to erase allocations. Generic movement PATCH/DELETE also reject source-owned
supplier-credit, transfer, split and bundle events. These operations use existing serialized transaction
boundaries; no independent stock job or persisting inventory import is introduced.

Inventory transforms and stock checks honor recorded physical split conversions;
the older virtual rollup remains only for legacy definitions without physical
conversion evidence. Split-piece returns do not also restore a parent quantity.
Clothing owns these routes, schema additions and UI; General Merchandise keeps
its independent APIs. I07's actual lifecycle, five-report, rollback and concurrency
evidence is recorded in the reconciliation report. No business DB was migrated.
Both exact additive SQL files were replayed against prior-shaped owned tables:
legacy values and null new fields were preserved, zero costs round-tripped, and
source-link restriction/cascade/index checks passed. This is scoped DDL evidence,
not verification or execution of the target business database's migration history.

> **Source files:**
>
> - `src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryPage.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSubmit.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryQuickAdjustments.ts`
> - `src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentEditActions.ts`
> - `src/modules/products/api/service.ts`
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

The requesting owner confirmed on October 28 that travelling goods must stay
in transit until explicitly marked on hand. The refreshed Clothing products
collection now resolves each active linked shipment's nonempty status at the
API read boundary, overriding empty or stale product-level status. This fixes
Inventory's earlier false receipt while the Products grid already showed the
linked shipment correctly. Payment is not proof of arrival. The existing
`Delivered` shipment action is the explicit arrival transition tested here.
Unlinked/unmatched products and blank linked statuses retain the legacy behavior
below; no historical locations are inferred or rewritten.

An explicitly In Transit shipment has zero physically received, on-hand reserved
and on-hand sellable quantity. Its remaining supply is split into in-transit
reserved and unreserved quantities. Received products use the on-hand pair;
reservations shown in either location cannot exceed remaining supply. Existing
sold, scrap, physical-return, supplier-short, additionals, transfer and composite
allocation rules still reduce or restore the appropriate supply. Available Stock
and ending available-inventory value refer to physically available stock, not
goods still travelling. Legacy products without an explicit In Transit status
retain their existing received-supply fallback; the label is not evidence that
historical physical counts have been reconciled. The current predicate tests
only normalized `In Transit`: other intermediate shipment statuses can also
use the received-supply branch. Do not equate that branch with confirmed arrival
or claim I01 verified every shipment status. A real location/count discrepancy
requires operational review; this documentation does not introduce another
quantity/status repair.

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

| #   | Logic                                                                                      | Explanation                                                                                               |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 10  | Bundle demand is not surfaced as a separate reserved bucket in the inventory grid          | The transform intentionally avoids a confusing bundle-reserved presentation.                              |
| 11  | Mix-and-match demand is allocated across pooled component availability                     | Component demand is distributed via `allocateByAvailability`, not one-to-one against the virtual mix SKU. |
| 12  | Physical split-child demand uses actual child stock; legacy demand uses virtual allocation | Recorded conversions exclude that demand from the legacy parent rollup.                                   |
| 13  | Recorded openings reduce the parent once; legacy split demand is rolled up virtually       | Sibling orders reuse actual loose pieces instead of charging another parent for each child quantity.      |
| 14  | Split sibling demand reuses loose pieces before opening another parent set                 | The parent is consumed by the highest normalized sibling demand, not by summing all child quantities.     |
| 15  | Actual child sales retain their own revenue and costs; legacy rollup remains compatible    | Physical child and parent movement quantities are not both treated as the same sale.                      |
| 16  | Split-child availability is derived, not stored                                            | Child availability comes from loose pieces plus remaining complete parent sets.                           |
| 17  | Inventory rows are no longer purely independent per product                                | Split allocation is an explicit cross-SKU rollup in the inventory transform.                              |

---

## D — What the Inventory Grid Shows for Split Items

| #   | Logic                                                                      | Explanation                                                                            |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 18  | A split parent shows remaining complete sets after child demand            | Parent sellable stock reflects break-pack consumption.                                 |
| 19  | A split child is sellable even when it has no independent product quantity | The inventory layer computes child availability from the parent split definition.      |
| 20  | The products grid can mark split children with a `[SPLIT]` badge           | Recorded child receipts come from an exact parent opening, with no second acquisition. |

---

## E — Adjustment Workflow

| #   | Logic                                                                                                                 | Explanation                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 21  | The full Adjust modal still edits inventory through movement rows, not direct quantity mutation                       | Operators set target changes that become inventory movements.                               |
| 22  | Transfer destination remains required for any non-zero transfer delta                                                 | Source and destination cannot be the same product code.                                     |
| 23  | Reverse-transfer checks destination sellable stock before allowing the edit                                           | The destination must have enough sellable stock to reverse the transfer.                    |
| 24  | Note-only edits still short-circuit quantity writes                                                                   | If only notes changed, the system updates the latest movement note without bucket rewrites. |
| 25  | Successful adjustment save, edit, and delete operations still use green notifications; failures use red notifications | The refactor did not change the operator-facing adjustment feedback flow.                   |

Adjustment bucket targets load from current movements when the operator opens
the form or explicitly changes its product. Background data-reader refreshes
must not replace values being entered. Reopening reloads current quantities;
clearing the product resets the targets. The requesting owner's October 28
completion authorization covers this input-preservation fix; movement creation,
stock limits and financial policy are unchanged. The selection-hook regression
and actual I02 purchase/shortage browser sequence verify this boundary.

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
