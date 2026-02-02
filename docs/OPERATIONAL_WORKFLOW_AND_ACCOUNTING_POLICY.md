# Operational Workflow & Accounting Policy (Supplier → Inventory)

This document captures how we run **supplier-facing** workflows in the app and the accounting rules we want to follow.

It’s intended to prevent repeating the same Q&A and to act as a living reference as workflows evolve.

## Scope

This applies to:

- **Supplier-facing modules**
  - `clothing/operations/products`
  - `general-merchandise/operations/products`
- **Reseller-facing modules** (mentioned only for contrast)
  - `clothing/operations/transactions`
  - `general-merchandise/operations/transactions`

## Glossary

- **Product**: An item sourced from a supplier (often created early to accept preorders).
- **Shipment Code**: Operational grouping of products that will travel together (e.g., `KPC 23930A-00222`).
- **COGS / Valuation**: The cost basis we use for inventory accounting and pricing decisions.
- **Inventory in Transit**: Asset representing supplier goods paid/incurred but not yet received.
- **Stock on Hand**: Asset representing inventory physically received and available.
- **Supplier Payable**: Liability representing amounts owed to suppliers.
- **Cash**: Combined bucket for cash + bank + e-wallet (current policy).

## Business workflow (supplier + preorders)

### Core flow

- We import products from China; shipping lead time is typically **1–2 months**.
- While items are still in transit, we **post products on the platform to accept preorders**.
- Goal: once the shipment arrives, much of the inventory is already sold, so fulfillment is mainly packing/dispatch.
- Therefore it’s critical to compute and store **COGS early** to price items correctly.

### Payment dropdown meaning (Products pages)

On `*/operations/products`, the **Payment** dropdown represents **supplier payment status** (not reseller payments).

- **Paid**
  - We have already paid the supplier.
  - In practice, supplier typically ships the same day or next day after payment.
- **Unpaid**
  - Supplier has shipped, but we will pay later.
  - Typical timing: **2–3+ months** after shipment start, often after delivery and after reseller preorder collections.

### Rare exceptions

1. **Missing item left behind**

- One or more products under a shipment code may not be included.
- Supplier may ship the missing item on the next shipment (e.g., move from `00222` → `00223`).
- Operationally, we need to transfer the product to the new shipment code.

2. **Missing item shipped to a different customer**

- Supplier cannot practically retrieve and re-ship.
- Supplier provides a **refund for the missing item**.

### Data corrections

- Quantity adjustments are rare and usually due to typos.
- Edits after accounting posting must have guardrails to avoid double-posting or silently rewriting history.

## Accounting policy (inventory-focused)

### Accounts

- **Cash**: combined cash/bank/e-wallet bucket.
- **Supplier Payable**: preferred liability account for supplier amounts owed.

Additional logistics accounts (as needed):

- **Forwarder Payable**: liability for forwarder fees (paid when shipment reaches the forwarder warehouse / PH arrival process).
- **Courier Payable (Lalamove)**: liability for courier fees (paid when delivering from forwarder warehouse → our warehouse).
- **Packaging Payable**: liability for packaging costs (paid separately).

### Valuation source (Supplier vs Logistics)

We separate **supplier cost** from **logistics costs** operationally and in accounting:

- **Supplier cost basis (Products automation)**
  - Use **Grand Total** as the supplier cost basis for product-driven inventory postings.
  - Reason: forwarder/courier/packaging are tracked and settled via separate payable workflows; including them again in product automation would double-count.

- **Logistics cost basis (Forwarder/Lalamove/Packaging)**
  - Forwarder fee, courier (Lalamove), and packaging costs are entered as **estimates** while the shipment is still in transit.
  - Actuals are only known later (PH arrival / delivery / actual packaging invoices).
  - These are posted via separate payable entries (see workflow below).

Important:

- The **Products page COGS** is updated later to reflect the **actual landed cost** once actual logistics amounts are known, so P&L uses the real COGS.

### Event-driven posting rules

The system should post accounting based on **real-world events**:

1. **Product created (or otherwise ready to recognize supplier inventory)**

- If **Paid**:
  - Dr **Inventory in Transit**
  - Cr **Cash**
- If **Unpaid**:
  - Dr **Inventory in Transit**
  - Cr **Supplier Payable**

Valuation note:

- For this supplier posting, we use **Grand Total** (supplier cost) rather than the full landed COGS.

2. **Product payment changes: Unpaid → Paid**

This represents paying the supplier later.

- Posting date: **today** (money-out date).
- Entry:
  - Dr **Supplier Payable**
  - Cr **Cash**

Important: this settlement must **not** touch Inventory in Transit (prevents double-counting).

3. **Shipment Delivered (inventory received)**

Reclass the inventory out of transit:

- Dr **Stock on Hand**
- Cr **Inventory in Transit**

Operational note:

- Today this reclass is performed via the **Transit Reclass** action in the Shipments module (enabled only when the shipment status is **Delivered**).
- Changing Shipment Status to **Delivered** by itself does not currently auto-post the reclass; this is intentional to avoid silent failures when transit build-up totals don’t match product valuation totals.

## Logistics payable workflow (Forwarder / Courier / Packaging)

These costs are paid separately from the supplier items:

- We pay the **forwarder** once the shipment arrives in their warehouse / PH arrival process.
- We pay **Lalamove (courier)** when it delivers from the forwarder warehouse to our warehouse.
- **Packaging costs** are paid separately as well.

### Estimates while in transit

When creating products, forwarder/lalamove/packaging fields are **estimates** (usually within ~1–2%). We include estimates early so we can compute unit pricing and accept reseller preorders immediately.

### Chosen policy: Pattern B (capitalize logistics only when Delivered)

We intentionally **do not** add forwarder/courier/packaging estimates into **Inventory in Transit**.

Instead, we track logistics costs in a separate temporary asset account until delivery, then capitalize into **Stock on Hand** when the shipment arrives.

Why:

- Keeps **Inventory in Transit** representing supplier item cost (Grand Total) only.
- Still keeps landed costs **on the balance sheet** (not P&L) while waiting for delivery.
- Makes delivery day the moment inventory becomes “all-in landed cost”.

#### Accounts needed for Pattern B

- **Landed Cost Clearing** (Asset) — temporary holding account for logistics costs not yet capitalized into inventory.
  - Name can be whatever you prefer (e.g., “Logistics Clearing”, “Freight Clearing”, “Landed Cost Holding”).

#### Checklist: Forwarder/Courier/Packaging (Pattern B)

Example: Forwarder estimate ₱1,000, actual ₱950

1. Record estimate (while in transit)

- Dr **Landed Cost Clearing** ₱1,000
- Cr **Forwarder Payable** ₱1,000

2. Adjust estimate to actual (recommended as an adjustment entry)

- If actual is lower (₱950):
  - Dr **Forwarder Payable** ₱50
  - Cr **Landed Cost Clearing** ₱50

3. Settle when paid (money-out date)

- Dr **Forwarder Payable** ₱950
- Cr **Cash** ₱950

4. Capitalize at delivery (Delivered / received date)

- Dr **Stock on Hand** ₱950
- Cr **Landed Cost Clearing** ₱950

Courier (Lalamove) and Packaging follow the exact same pattern, using their respective payable accounts.

Operational note:

- We still update the **Products page COGS** to reflect the final actual landed cost once these actual amounts are known.

#### Important: don’t reclass by crediting the payable again

In Pattern B, the delivery capitalization step credits **Landed Cost Clearing**, not the payable.

- The payable is only cleared by: Dr Payable / Cr Cash.

### Special case: opening balances for already-delivered shipments

If a shipment’s forwarder/courier payable was introduced via **OPENING** entries (Dr Opening Equity / Cr Payable), then you should not create a second payable.

For those historical shipments, the “capitalization” step is:

- Dr **Stock on Hand**
- Cr **Opening Equity**

This moves the opening-balance debit into inventory so Stock on Hand reflects landed cost.

### Per-product posting preference

For traceability, entries should be **per product** (not only grouped by shipment code), even if the UI aggregates summaries.

## Guardrails (to prevent costly mistakes)

### Reseller payments (Transactions module): no legacy adjustments

On `*/operations/transactions`, the **Adjustment** column is treated as a **legacy field**.

Policy:

- All reseller payments must be recorded as payment rows in `transaction_payments` (or the GM equivalent).
- The transactions grid **must not** allow direct editing of the Adjustment column.
  - This prevents accidentally encoding payments as a raw number with no payment date/method/notes.
- If we need to change unit pricing behavior without touching the Prices module, we use the **Discount** column.

Implementation guardrails:

- UI: Adjustment is read-only in the transactions grid.
- API: transaction update endpoints ignore/deny writes to the legacy Adjustment field.
- Payments: use the “Record Payment” flow (bulk payments endpoint) which writes payment rows and updates totals consistently.

### Confirmation on product creation

When the user clicks **Add Product**, show a SweetAlert confirmation based on the Payment selection:

- If Payment = **Paid**: confirm “You are adding a new product that is already PAID. Please confirm.”
- If Payment = **Unpaid**: confirm “You are adding a new product that is UNPAID. Please confirm.”

### Prevent accidental reversals

- Only auto-post the settlement when changing **Unpaid → Paid**.
- For **Paid → Unpaid**, require a separate explicit workflow (reversal/refund/correction), not an automatic silent change.

### Idempotency

Every auto-generated posting must be idempotent:

- Unique key per event + product (and/or shipment) so saving twice does not duplicate entries.

## Handling rare exceptions (accounting)

### A) Missing item moved to next shipment

Operational action:

- Move product from old shipment code to new shipment code.

Accounting impact depends on posting state:

- If not yet delivered/reclassed: usually no accounting impact (still in transit).
- If already reclassed to Stock on Hand: a correction is required to move that product’s value back to Inventory in Transit, then reclass later when the new shipment is delivered.

### B) Supplier refund for missing item

On refund date, reverse the in-transit asset for that product:

- Dr **Cash** (or Bank/E-wallet if tracked separately later)
- Cr **Inventory in Transit**

(Or, if the amount was still in Supplier Payable, reduce the payable accordingly.)

## Notes on “products as source of truth” vs “ledger as source of truth”

- Products are operational truth (editable for workflow).
- Ledger entries are financial truth (auditability, stable historical reporting).
- If we need edits after posting, we should prefer **adjustment entries** (delta changes) over rewriting history.

## Operational inventory reporting: on-hand vs in-transit (4-number split)

We accept preorders while items are still traveling.
Operationally, we still want to allocate/reserve those items, but we must not report them as **Stock on Hand** until they are physically received.

To make this explicit, the Inventory page/report uses a **4-number split** per product code:

1. **On-hand sellable**

- Quantity that is physically received and currently sellable.

2. **On-hand reserved**

- Quantity that is physically received but currently reserved for orders.

3. **In-transit unreserved**

- Quantity that exists in the system (often from product quantity / receipts) but the shipment is still in transit and not reserved.

4. **In-transit reserved**

- Quantity reserved for orders, but the shipment is still in transit.

### Source of truth for “on-hand” vs “in-transit”

- We treat **Shipment Status = Delivered** as _on-hand_.
- Any other status (including blank/unknown) is treated as _in-transit_ for reporting.

This matches the accounting policy:

- **Delivered / received** is when we can reclass inventory:
  - Dr **Stock on Hand**
  - Cr **Inventory in Transit**

### Important: reservations can exist while in transit

- Reservations may be created before delivery (preorder allocation).
- Reporting will show those reservations under **In-transit reserved** until the shipment is Delivered.

### “Available stock” meaning

- **Available (On-hand Sellable)** is derived from _on-hand sellable only_.
- This avoids treating in-transit items as available/ready to fulfill.

## Appendix: Example shipment scenario

Example shipment code: `KPC 23930A-00222`

- Mixed Shorts (MS-010226)
- Ruffled Frogsuit (RF-010226)
- Milkberry Frogsuit (MF-010226)
- Zippered Frogsuit (ZF-010326)

These may be created early for preorder selling while they are still in transit.

## Monthly reset / New cutover (practical)

If you want to start fresh for a new month (e.g., Feb 1) because the prior month is confusing or mismatched, do not rewrite history.
Instead:

1. Set a new accounting cutover date

- Set `ACCOUNTING_CUTOVER_DATE_CLOTHING` (UTC midnight).
- Example: `ACCOUNTING_CUTOVER_DATE_CLOTHING="2026-02-01"`
- Leave `ACCOUNTING_CUTOVER_DATE_GM` empty so GM stays on the original default cutover (2026-01-17).
- Leave `ACCOUNTING_CUTOVER_DATE` empty to avoid changing both modules accidentally.

2. Enter a clean Opening Balance snapshot (full Balance Sheet)

- Add balances you want the books to start with: `Cash`, `Stock on Hand`, `Inventory in Transit`, and any non-zero liabilities.
- If a liability account is 0, omit it (no entry = 0 balance). This is how we exclude zero-balance loan payables.

### Editing opening balances (important)

In the Ledger UI, the “Edit Opening Entry” modal treats an opening entry as a **two-line pair** (one debit, one credit).
It finds the counterpart line by matching:

- **Date**
- **Ref**
- **Description**
- **Amount**

So, for anything you may want to edit later (especially loans), prefer creating **explicit debit/credit pairs** with a
**unique Description per pair** (critical when two loans share the same amount).

Notes:

- The bulk opening-balance script auto-adds a balancing **Opening Equity** line. That’s correct accounting-wise, but if you bulk-load many liabilities under one ref/description, each line may appear “unpaired” in the editor.
- To keep things editable, either enter pairs via the UI, or apply openings in separate batches where each pair has its own description (e.g., per loan).

Recommended (scripted, with dry-run preview):

- Create `tmp/opening-balances-2026-02-01.json`:

  {
  "Cash": 80990,
  "Stock on Hand": 0,
  "Inventory in Transit": 0,
  "Customer Deposits": 0,
  "Loan Payable – Interest-free borrowing": 0,
  "Loan Payable – Unionbank Personal Loan": 0,
  "Loan Payable – BPI Business Loan 1": 0
  }

- Dry run:

  npx tsx scripts/set-opening-balances.ts --module clothing --date 2026-02-01 --ref OPENING-2026-02-01 --input tmp/opening-balances-2026-02-01.json

- Apply:

  npx tsx scripts/set-opening-balances.ts --module clothing --date 2026-02-01 --ref OPENING-2026-02-01 --input tmp/opening-balances-2026-02-01.json --apply

The script:

- Skips 0-balance lines automatically
- Auto-adds a balancing `Opening Equity` line so debits = credits

### Practical approach we used (Feb 1, 2026 Clothing)

Instead of one giant opening import, we applied separate refs for clarity and safer editing:

- `OPENING-STOCK` (Dr Stock on Hand / Cr Opening Equity)
- `OPENING-LOANS` (per-loan paired entries for editability)
- `OPENING-CASH` (Dr Cash / Cr Opening Equity)

3. Verify

- Re-check Balance Sheet and Ledger as-of the cutover date.
