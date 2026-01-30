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

### Accounting pattern (estimate → actual → settlement)

We create an estimated payable while in transit, then adjust to the actual amount once known, then settle when paid.

Example: Forwarder estimate ₱1,000, actual ₱950

1. Estimate payable (while in transit)

- Dr **Inventory in Transit** ₱1,000
- Cr **Forwarder Payable** ₱1,000

2. Adjust estimate down to actual (recommended as an adjustment entry)

- Dr **Forwarder Payable** ₱50
- Cr **Inventory in Transit** ₱50

3. Settlement when paid

- Dr **Forwarder Payable** ₱950
- Cr **Cash** ₱950

Operational note:

- We also update the **Products page COGS** to reflect the final actual landed cost once these actual amounts are known.

### Per-product posting preference

For traceability, entries should be **per product** (not only grouped by shipment code), even if the UI aggregates summaries.

## Guardrails (to prevent costly mistakes)

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

## Appendix: Example shipment scenario

Example shipment code: `KPC 23930A-00222`

- Mixed Shorts (MS-010226)
- Ruffled Frogsuit (RF-010226)
- Milkberry Frogsuit (MF-010226)
- Zippered Frogsuit (ZF-010326)

These may be created early for preorder selling while they are still in transit.
