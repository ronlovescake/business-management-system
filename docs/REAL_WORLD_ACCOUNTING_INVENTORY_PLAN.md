# Real-World Accounting + Inventory Integration Plan (Clothing)

Goal: implement a **perpetual inventory** workflow (always accurate after every sale) that fits your existing business logic:

- Transactions page uses Prices tiers to calculate `Unit Price` and `Line Total`.
- Products represent procurement batches (quantity + landed-cost inputs) and already compute `Actual Price` (unit cost) and `COGS` fields.
- Inventory page currently derives “available stock” from Products − Transactions, but it cannot handle damaged stock, bundles, or reservation/ship timing.

This plan keeps UI clutter low by reusing Operations modules as the “sub-ledger” and letting Accounting pages show **summary** results.

---

## 0) Current System Snapshot (what we must respect)

### Transactions

- Source: `src/modules/clothing/operations/transactions/**`
- Lookups: `/api/prices`, `/api/products`, `/api/shipments`, `/api/customers`.
- Business logic: Unit Price = tier price − discount; Line Total = (qty × unit price) − adjustment.
- Accounting currently treats “paid” via `PAID_STATUSES` in `src/lib/accounting/constants.ts`.

Important note (your workflow): in your Transactions page, the `Adjustment` column is used to log the **customer payment / amount collected** (operationally), not a discount.
For accounting/reporting, we should treat:

- `salesAmount` = payment logged (from `Adjustment`, if that is where the paid amount is recorded)
- and treat `Line Total` as an operational computed value (use as fallback, not as the authoritative paid amount)

### Products

- Source: `src/modules/clothing/operations/products/**`
- `ProductService` computes unit cost (`Actual Price`) from landed cost inputs (forwarder/lalamove/etc).
- Each product record has `Quantity` and a generated `Product Code` (batch-like).

### Inventory (Operations)

- Source: `src/modules/clothing/operations/inventory/**`
- Current calculation: `availableStock = product.Quantity - sum(transaction.Quantity where not Cancelled)`.
- Limitations today:
  - Deducts stock even if not shipped/paid.
  - No damaged bucket; damaged units cause “mystery variance”.
  - Bundles cannot be represented as a single sale without losing SKU-level stock accuracy.
  - Revenue/COGS calculations are not accounting-grade.

### Accounting pages

- Ledger/journal/P&L/balance sheet currently **derive** journal lines from Transactions and Expenses.
- Several endpoints use `tx.adjustment ?? tx.lineTotal` which is not a correct revenue amount.

Clarification: `tx.adjustment ?? tx.lineTotal` is not correct for either meaning.

- If `Adjustment` is payment logged, we should use it intentionally as `paymentReceived` (and stop calling it adjustment internally).
- If `Line Total` is the computed amount, then it must be computed consistently from qty/unit price/discount and stored explicitly.

Plan: introduce an internal normalization step for accounting endpoints:

- `paymentReceived = tx.adjustment` (rename in accounting code only)
- `computedLineTotal = (qty × unitPrice) - discount` (if needed)
- choose `salesAmount` per your policy (usually `paymentReceived` for cash basis, or `computedLineTotal` for accrual basis)

---

## 1) Design Principles (what “real-world perpetual” means here)

1. **Inventory is a sub-ledger**: every stock change is a recorded movement.
2. **Accounting (GL) summarizes**: balance sheet and P&L are aggregations of journal lines.
3. **Cost method must be explicit**. Practical choice given your data:

- Start with **Specific Identification / Batch costing per Product Code** using `Product['Actual Price']` as unit cost.
- FIFO is not required for your business process (new arrivals can sell out first; heavy preorders; clearance leftovers). If you ever need blended costs across multiple purchase lots, we can consider moving-average later.

4. **Damaged stock is not missing stock**: record it as a movement from Sellable → Damaged.
5. **Bundles are normal**: you must record which SKUs left inventory, even if you sold them as a package.

---

## 2) Proposed Data Model Additions (minimal, scalable)

### A) Inventory movement table (sub-ledger)

Add a new Prisma model (name illustrative):

- `InventoryMovement`
  - `id`
  - `productCode` (string)
  - `quantity` (number; positive or negative)
  - `bucketFrom` / `bucketTo` (enum: `SELLABLE`, `DAMAGED`, `RESERVED`)
  - `movementType` (enum: `RECEIPT`, `SALE`, `TRANSFER`, `ADJUSTMENT`)
  - `reason` (enum: `DAMAGED_ON_ARRIVAL`, `STOCK_COUNT`, `BUNDLE`, etc.)
  - `unitCost` (number; capture cost at movement time)
  - `refType` + `refId` (e.g., `transaction`, `product`, `manual`)
  - `movedAt` (Date)

This gives you:

- Accurate quantity by bucket (sellable vs damaged).
- Accurate valuation (sum of remaining qty × unitCost).

### B) Accounting journal persistence (optional but recommended)

Two choices:

- **Option 1 (fastest)**: keep “derived journal” endpoints but compute from InventoryMovements + Expenses + OpeningBalances.
- **Option 2 (most real-world)**: persist journal entries/lines so reports are stable and auditable.

If persisting:

- `JournalEntry` (header: date, reference, memo, source)
- `JournalLine` (account, debit, credit)
- plus idempotency keys (so status edits don’t double-post).

---

## 3) Posting Rules (the accounting logic)

### Sale posting (when a transaction becomes “paid/recognized”)

Trigger: status transitions into a fulfilled/shipped status (see Status Mapping below).

- Dr Cash (or Accounts Receivable if you support credit)
- Cr Sales Revenue
- Dr COGS
- Cr Stock on Hand (Inventory)

**Revenue amount** should come from the field that represents the agreed sale amount.
Given your current workflow, that is usually the payment logged in `Adjustment` (we should rename internally to `paymentReceived`).

### Damaged bucket (sellable later)

When you inspect and mark damaged:

- Inventory movement only (no GL entry in v1):
  - Transfer qty from SELLABLE → DAMAGED.
- Selling damaged later is a normal sale; profit is lower because selling price is lower.

(If you later want GAAP-style write-downs, add an optional “write-down” action.)

### Bundles

Inventory must deduct each SKU that left.
Two operational patterns:

- **Recommended v1 (practical + intuitive)**: keep the invoice as **one bundle SKU line**, but attach a **bundle breakdown (BOM / recipe)** so the system can deduct/tag the underlying SKUs automatically.
- Alternative (works, but more manual): create multiple transaction rows (one per SKU in the bundle) and allocate discounts/payments across lines.

Important (based on current code): the Transactions **Product Code dropdown** is sourced from the **Prices** module, not the Products module.
Today, `productCodes` in Transactions is built from `/api/prices` (unique `Product Code` values). This is why creating a “bundle SKU” in Products can lead to confusing/duplicate entries and pricing mismatches unless you also create matching price tiers.

### Bundle policy (single line sale, still deduct original SKUs)

You _can_ create a “bundle SKU”, but it must be treated as a **KIT / ASSEMBLY**, not a second source of supply.

Rules:

- A bundle SKU must exist in **Prices** (so it appears in the Transactions product dropdown).
- A bundle SKU must NOT be treated as procured stock. Do not “receive” bundle quantity from suppliers.
- The bundle SKU’s on-hand should come from either:
  - **Assembly movements** (preferred): when you physically pack bundles, you convert components → bundle quantity, OR
  - **Auto-explode on fulfillment**: when you sell the bundle, the system deducts the component SKUs behind the scenes.

Recommended operational workflow (best for short invoices + accurate inventory):

Your reality: bundle composition varies depending on leftover/unsold items. That means we should treat each bundle run as its own **bundle batch** with its own captured recipe.

1. Create the bundle SKU the way you already do (unique + easy to locate):

- Example naming/code pattern:
  - `BUNDLE A (BA-011326)`
  - `BUNDLE B (BB-011326)`
  - `BUNDLE A (BA-110125)`
- This aligns with your “Posting Date + Product Name” convention (newest bundle is obvious).

2. When you pack bundles, run an **ASSEMBLY** action for that specific bundle batch:

- You enter the actual components used for this batch (5–10 SKUs, whatever is left)
- System posts InventoryMovements:
  - Decrease each component SKU (SELLABLE)
  - Increase the bundle SKU (SELLABLE)
- System stores the captured “recipe” for audit (bundle batch → component SKUs + quantities).

3. On sale, you sell the bundle SKU only (one invoice line) and just deduct the bundle SKU quantity.

This achieves what you want:

- The invoice stays short and practical.
- Inventory remains SKU-accurate (components are tagged/consumed at assembly time).
- COGS for bundles becomes the sum of component costs consumed.

### Discounts and payments in bundles (works with your current fulfillment logic)

Because your workflow uses `Adjustment` as the payment logged and `Line Total` behaves like the remaining balance (computed as `(qty × unit price) - adjustment`), bundles should be handled by **allocating**:

- Any discount (via `Discount` per row, reducing unit price)
- Any payment received (via `Adjustment` per row, reducing remaining balance)

Operationally, the simplest v1 rule is:

- Allocate the total bundle payment across rows proportionally to each row’s pre-discount amount.

Later (optional), we can add a “Bundle helper” that:

- Creates the rows for selected SKUs
- Lets you enter one bundle price/payment
- Auto-splits discount/payment across the generated rows

If you use the **bundle SKU + assembly** approach, you usually _do not need_ to allocate bundle price across component SKUs for accounting-grade GL.
If you want “profit by SKU” analytics later, we can add an optional attribution layer that splits bundle revenue across components (e.g., proportional to component list price).

---

## 4) Implementation Roadmap (phased, safe)

### Phase 1 — Understand + lock down transaction semantics

Deliverables:

- Confirm which statuses mean “inventory should deduct” and “revenue recognized”.
  - Align `PAID_STATUSES` with real workflow.
- Fix revenue amount derivation in accounting endpoints (stop using `adjustment ?? lineTotal`).
- Decide: deduct inventory at `Shipped` or at `Ready For Dispatch`.

### Phase 2 — Create InventoryMovements + backfill

Deliverables:

- Create Prisma model + migrations.
- Backfill “RECEIPT” movements from Products:
  - For each Product Code, add +Quantity into SELLABLE at product Posting Date.
- Create movement generator for sales:
  - When a transaction becomes paid, create SALE movement (SELLABLE → SOLD/none) at unit cost.
- Add idempotency so edits don’t re-post.
- Receipt backfill helper is available now:
  - Run `npx ts-node --transpile-only scripts/backfill-receipt-movements.ts` once per environment to seed SELLABLE on-hand from existing Products (idempotent via notes).
  - Inventory UI and stock checks now read sellable on-hand from movements first, with Products.Quantity used only as a temporary fallback when no movement exists.

### Phase 3 — Upgrade Operations/Inventory UI (minimal clutter)

Deliverables:

- Inventory page reads from InventoryMovements to compute:
  - Sellable on-hand
  - Damaged on-hand
  - Reserved on-hand (optional)
  - Ending inventory value = remaining qty × unitCost
- Add one action: **“Mark Damaged Quantity”**
  - Moves qty SELLABLE → DAMAGED
  - Reason captured

### Phase 4 — Bundles support without changing your sales workflow

Deliverables:

- Document the operational rule: bundles can be sold as **one bundle SKU line** while still deducting/tagging component SKUs.
- Add minimal data support:
  - Bundle batch + captured recipe:
    - bundle batch SKU (your dated naming) → component SKUs + quantities (captured at packing time)
  - Preferred: Assembly action that converts components → bundle on-hand
  - Fallback: Auto-explode at fulfillment to create component SALE movements (no packing step)
- Optional later helper UI (if you want faster packing/assembly): select bundle, enter qty to assemble, system checks component availability and posts assembly movements.

### Phase 5 — Accounting reporting correctness

Deliverables:

- Ledger: include COGS + Inventory lines from movements.
- Profit & Loss:
  - Revenue
  - COGS
  - Gross profit
  - Operating expenses
  - Net profit
- Balance sheet:
  - Assets: Cash + Stock on Hand
  - Equity: Opening Equity + Current Period Earnings
  - (This removes residual balances like -₱108 when you exclude P&L accounts.)

### Phase 6 — Controls + reconciliation (what keeps this accurate long term)

Deliverables:

- “Negative stock” and “bucket mismatch” warnings.
- Stock count adjustment tool (manual correction with reason).
- Audit trail: each movement points to the transaction/product that caused it.

---

## 5) Section-by-Section Improvements (your requested breakdown)

### LEDGER

- Stop deriving from raw transaction fields directly.
- Show journal lines for:
  - Sales (Cash/Sales)
  - COGS + Inventory reduction
  - Expenses (and optionally A/P)
  - Inventory adjustments (damaged/stock count)

### PROFIT & LOSS

- Must include: Revenue, COGS, Gross Profit, Expenses, Net Profit.
- For bundles/discounts: profit is naturally lower; still correct.

### BALANCE SHEET

- Must include: Cash, Inventory (sellable + damaged as you choose), Liabilities, Equity.
- Include “Current Period Earnings” to absorb net income and reconcile.

### INVENTORY (Operations)

- Move from derived math (Products − Transactions) → movement-based on-hand.
- Add buckets (Sellable/Damaged; optional Reserved).

### PRODUCTS

- Keep as procurement batches.
- Ensure unit cost is clearly defined (`Actual Price`) and used by inventory movements.
- Optional: add receiving/inspection fields (received qty, damaged qty) but movements already cover this.

---

## 6) Open Questions (we should answer before coding)

1. Exactly which statuses indicate:
   - stock should be **reserved**? -
   - stock is **physically shipped**?
   - cash is **received**?

2. Do you ever split one customer order into multiple shipments/statuses?

3. For damaged units: do you want to allow selling them from a separate “Damaged” bucket (recommended), or just mark them damaged for reporting while still selling as normal?

---

## 6A) Proposed Status Mapping (based on your actual workflow)

Your statuses contain **three different concepts** mixed together:

- Reservation/commitment (customer has a claim on units)
- Fulfillment (physically packed/shipped/picked up)
- Payment (cash received vs receivable)

To make perpetual inventory + accounting accurate, we map each status to explicit rules.

### Recommended rules (v1)

**Reserve stock (commit units to buyer)**

- `In Transit` → Reserve against _in-transit_ supply (preorder), not against on-hand.
- `Warehouse` → Reserve against on-hand (items arrived / being sorted).
- `Prepared` → Still reserved; no accounting posting yet.
- `On-Hold` → Still reserved; no accounting posting yet.

**Physically shipped / handed off**

- `Ready For Dispatch` → Fulfilled via pickup/courier booking.
- `Checked Out` → Fulfilled via Shopee checkout.
- `Shipped` → Fulfilled (explicit shipping status).

**Cash received / Accounts Receivable**

- `Ready For Dispatch` → treated as paid (Cash received).
- `Checked Out` → treated as paid (Cash received).
- `Pending Payment` → treated as **A/R** (shipped but unpaid).

### Accounting posting trigger (sale + COGS)

Post **sale + COGS + inventory reduction** when the transaction enters a fulfilled status:

- Paid fulfillment: `Ready For Dispatch`, `Checked Out`, `Shipped`
  - Dr Cash
  - Cr Sales Revenue
  - Dr COGS
  - Cr Stock on Hand

- Unpaid fulfillment: `Pending Payment`
  - Dr Accounts Receivable
  - Cr Sales Revenue
  - Dr COGS
  - Cr Stock on Hand

Important: we must make this **idempotent** (status edits must not double-post).

### Inventory timing (what changes when)

- Reservation starts at `In Transit` / `Warehouse` / `Prepared` / `On-Hold`.
- Inventory deduction happens at fulfillment (`Ready For Dispatch` / `Checked Out` / `Shipped` / `Pending Payment`).
- Payment recognition happens at:
  - `Ready For Dispatch` / `Checked Out` = Cash
  - `Pending Payment` = A/R

### Notes about your current "On-Hold" paid detection

You mentioned a heuristic: if Line Total is ₱50 and below, treat as paid.
For a real-world system, we should replace that with an explicit field later (e.g., `paidAt`, `paymentStatus`).
For v1, keep the heuristic if you must, but treat it as a temporary bridge.

---

## 6C) Operations Stock Check (keep your Transactions warning)

You confirmed that inventory (COGS + stock reduction) should happen only when a transaction is **fulfilled/shipped**:

- `Ready For Dispatch`, `Checked Out`, `Shipped`, `Pending Payment`

But your Transactions page needs a separate operational control to prevent overselling _before_ fulfillment.
So we split quantities into:

### Definitions

- **Supply**: total units you sourced for a Product Code (from Products quantity).
- **Reserved**: units committed to customers but not yet fulfilled.
- **Fulfilled**: units already shipped/handed off (should reduce inventory + post COGS).
- **Damaged adjustments** (future): units moved out of sellable stock (DAMAGED_HOLD/SCRAP).

### Status sets (v1)

- Reserved statuses: `In Transit`, `Warehouse`, `Prepared`, `On-Hold`
- Fulfilled statuses: `Ready For Dispatch`, `Checked Out`, `Shipped`, `Pending Payment`

### Available-to-reserve calculation (what the warning should use)

Once damaged buckets exist, the most practical v1 formula is:

- `sellableSupply = Products.quantity - damagedHold - scrap`
- `availableToReserve = sellableSupply - reserved - fulfilled`

This keeps your current workflow:

- Preorders (`In Transit`) still reserve against supply.
- On-hand orders (`Warehouse/Prepared/On-Hold`) still reserve.
- Fulfilled orders reduce remaining availability.

### Low stock threshold (agreed)

Instead of a fixed “<= 20 units”, use a percentage of supply:

- Low stock when `availableToReserve <= ceil(Products.quantity × 0.01)` (1% of supply)

This scales properly for both small and large purchase quantities.

---

## 6B) Damaged Stock Policy (fits your process)

You described:

- Damaged units are set aside for 1–2 months until there are enough to sell.
- Some damaged units are sellable (minor defects), others are scrap (torn/ripped/major stains).
- You don’t want to sell immediately due to fairness/price wars.

### Recommended v1: three buckets (minimal, realistic)

1. **SELLABLE** (normal stock)
2. **DAMAGED_HOLD** (not for sale yet; waiting until you have enough)
3. **SCRAP** (unsellable; permanently removed)

Operationally:

- On arrival/inspection: move damaged qty from SELLABLE → DAMAGED_HOLD.
- Later when you decide to sell: move DAMAGED_HOLD → SELLABLE (or a DAMAGED_FOR_SALE bucket if we want it separate).
- For unsellable: move DAMAGED_HOLD → SCRAP.

Accounting impact (recommended):

- Moves between SELLABLE and DAMAGED_HOLD are inventory-only (no P&L impact).
- Move to SCRAP should create an expense (inventory shrinkage/write-off) if you want strict reporting.
  - Dr Inventory Shrinkage (Expense)
  - Cr Stock on Hand (Inventory)

This matches your workflow while keeping your main sales prices protected.

---

## 7) Recommended starting point

Start with Transactions → Inventory Movements because everything depends on reliable “what left stock and when”.
Once movements exist, Ledger/P&L/Balance Sheet become straightforward aggregations.
