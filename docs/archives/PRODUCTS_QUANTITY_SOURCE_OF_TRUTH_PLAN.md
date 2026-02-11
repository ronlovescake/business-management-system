# Products Quantity as Source of Truth — Plan (No Code Changes Yet)

## Plan (No code changes yet)

- **Decision:** The `Products.Quantity` value is the authoritative “source quantity” for each product code (what we ordered / expect to receive).
- **Expectation rule:** If we ordered 350, we expect 350 on-hand by default. Any variance must be explicitly recorded (supplier short, damage, freebies), not implied by scripts.

## Why we’re not changing anything today

- You’ve already made many sales; touching the ledger logic now risks shifting on-hand and downstream accounting reports.
- We’ll treat the current state as **“frozen”** until we implement the plan carefully with an auditable migration strategy.

## Target model (how inventory should behave)

- **Baseline:** `Products.Quantity` = baseline expected stock for that product.
- **Adjustments (must be explicit movements):**
  - **Supplier short** → movement that reduces expected/available stock and tags it as `supplier_short`.
  - **Damage** → movement that moves stock out of `sellable` into `damaged_hold` / `scrap` (depending on process).
  - **Freebies / extra units received** → movement that increases stock with a clear note (auditable reason).
- **Sales:** still reduce stock via `sellable -> sold` (and `sellable -> reserved` where applicable).

## Implementation approach (next session)

1. **Lock in “source of truth.”** Decide that on-hand for UI/availability will be derived from `Products.Quantity` ± explicit movements (short/damage/freebies/sales/reservations), not from historical backfill baselines.
2. **Reconcile existing products safely.**
   - For each product, compute delta between `Products.Quantity` and the ledger’s current “receipt baseline.”
   - Create **one auditable adjustment movement** per product (or per `productCode`) to align the ledger, dated appropriately and with a standardized note (so it can be traced and reversed).
3. **Prevent silent drift going forward.**
   - When `Products.Quantity` changes (usually via import), log the change and either:
     - block it unless it’s intended, or
     - automatically generate a matching adjustment movement (with a clear note and “who/when” metadata if available).
4. **Validate accounting before rollout.**
   - Verify that inventory on-hand and sales/COGS reporting remain consistent for a few key SKUs (including ZF-010326) before applying broadly.

## Open questions to answer next time (important for accounting safety)

- Does `Products.Quantity` represent **ordered**, **received**, or **received-into-sellable**? (Policy: ordered = expected received, unless explicitly adjusted.)
- Should supplier short/damage affect accounting immediately at “receipt time,” or only when discovered/recorded?

## Next-time suggestion

Next time, start by generating a read-only “reconciliation report” (per product: product quantity, current sellable, sold, reserved, and the delta we’d need) so it can be reviewed before applying anything.
