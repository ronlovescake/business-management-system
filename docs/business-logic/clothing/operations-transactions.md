# Clothing — Transactions Business Logic

> **Source files:**
>
> - `src/modules/transactions/api/service.ts`
> - `src/modules/transactions/api/referenceValidation.ts`
> - `src/modules/transactions/api/transactionInventorySync.ts`
> - `src/modules/transactions/api/service-calculations.ts`
> - `src/modules/clothing/operations/transactions/hooks/useTransactionsData.ts`

---

## A — Validation & Lookup Rules

| #   | Logic                                                                                            | Explanation                                                                                          |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Customer name, product code, and positive quantity are still required for valid transaction rows | Import and create validation still reject missing essentials.                                        |
| 2   | Product code validation now accepts split-child SKUs even if no child product row exists         | `referenceValidation` treats `SplitBatchComponent.componentSku` as a valid transaction product code. |
| 3   | Bundle and mix-and-match composite SKUs remain valid transaction targets                         | Composite SKU validation still happens before persistence.                                           |
| 4   | Split-child shipment code and shipment status inherit from the parent split SKU                  | Transaction lookup data maps parent shipment metadata onto split-child codes.                        |

---

## B — Pricing & Payment Rules

| #   | Logic                                                                                               | Explanation                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 5   | Unit price can still auto-fill from pricing data when the imported value is zero                    | Transaction creation still resolves pricing through the existing tier flow. |
| 6   | Prepared + fully paid transactions are treated as fulfilled for movement sync                       | This affects both standard SKUs and split-child movement behavior.          |
| 7   | Remaining balance is still computed from line total, quantity, unit price, discount, and adjustment | The paid-status guard remains unchanged.                                    |

---

## C — Order Status Rules

| #   | Logic                                                                                                          | Explanation                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 8   | Status cannot regress back to `In Transit` once linked shipment state has advanced to warehouse-stage statuses | `For Pickup`, `Sorting`, and `Delivered` still block backward movement. |
| 9   | Paid-status guards still run before persistence                                                                | Invalid paid transitions are rejected before DB writes occur.           |

---

## D — Inventory Movement Sync

| #   | Logic                                                                                                                    | Explanation                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Every transaction save still re-syncs its auto-created inventory movements                                               | The sync remains the post-save source of inventory movement updates.                                                                                                            |
| 11  | Blank product codes, zero quantity rows, and inactive scenarios deactivate both standard and mix-prefixed auto movements | Cleanup happens before early return.                                                                                                                                            |
| 12  | Standard SKUs use a simple reserve/sale movement pattern                                                                 | Reserve = `sellable → reserved`; sale = `reserved → sold` or `sellable → sold` depending on existing reserve state.                                                             |
| 13  | Mix-and-match SKUs deactivate standard auto movements and create per-component auto movements instead                    | Allocation is derived from current component availability via `allocateByAvailability`.                                                                                         |
| 14  | Mix-and-match movement notes use component-specific note variants                                                        | Notes are `auto-reserve txn {id} mix {component}` and `auto-sale txn {id} mix {component}`.                                                                                     |
| 15  | Split-child SKUs keep the standard reserve/sale note pattern but target the parent split SKU                             | The child code is resolved to the parent before standard movement sync runs.                                                                                                    |
| 16  | Split-child movement quantity currently matches the transaction quantity, not a separate loose-piece bucket adjustment   | Loose-piece reuse is modeled in read-time allocation, not as a dedicated inventory movement type.                                                                               |
| 17  | Auto-created reserve and sale movements store explicit transaction source metadata                                       | New movement writes populate `sourceTransactionId`, `movementSource = transaction`, and `movementType = reserve/sale`; notes remain human-readable and support legacy fallback. |

---

## E — Bulk Update & Soft Delete

| #   | Logic                                                     | Explanation                                     |
| --- | --------------------------------------------------------- | ----------------------------------------------- |
| 17  | Bulk update still validates and syncs row-by-row          | One failing row does not block successful rows. |
| 18  | Transactions remain soft-deleted rather than hard-deleted | Live queries still filter `deletedAt: null`.    |

---

## F — UI Stock Check Behavior

| #   | Logic                                                                     | Explanation                                                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 19  | Stock check still runs when product code changes or quantity increases    | The UI continues to POST `{ productCode, requestedQuantity }` to the clothing stock-check endpoint. |
| 20  | `SOLD_OUT` blocks save with a red SweetAlert2 error                       | The operator cannot proceed.                                                                        |
| 21  | `INSUFFICIENT_STOCK` with some stock available offers to cap the quantity | Confirming uses the maximum available quantity; cancelling blocks the save.                         |
| 22  | `LOW_STOCK` warns but does not block save                                 | The operator can continue after acknowledging the warning.                                          |
| 23  | Stock-check request failures still fail open                              | Errors are logged but do not block transaction entry.                                               |

---

## G — Stock Check Semantics by SKU Type

| #   | Logic                                                                                      | Explanation                                                                     |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 24  | Standard product stock check uses direct on-hand minus active demand                       | This remains the default fallback path.                                         |
| 25  | Bundle stock check reports `assembled bundle stock + component-constrained build capacity` | The limiting component is surfaced in the message when relevant.                |
| 26  | Mix-and-match stock check reports pooled component availability                            | Availability is based on component pool capacity, not virtual mix SKU quantity. |
| 27  | Split parent stock check returns remaining complete sets                                   | The message explicitly references remaining sets after split-child demand.      |
| 28  | Split-child stock check returns loose-piece-aware availability                             | The message reports loose pieces plus remaining complete parent sets.           |
| 29  | Split sibling demand reuses loose pieces before opening another set                        | Break-pack logic is now encoded in stock-check reads, not left as a TBD.        |

---

## H — Operational Note

The transaction workflow now supports split-child selling without requiring child
product rows or child price rows to exist first. The authoritative split
definition is the split batch, while inventory movement sync and stock checks
translate that definition into transaction-time behavior.
