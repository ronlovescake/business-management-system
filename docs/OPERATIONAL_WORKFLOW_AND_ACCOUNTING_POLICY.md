# Operational Workflow And Accounting Policy

Updated: 2026-10-28. This is the accounting-policy reference, not a second employee
procedure manual. Employees use the [Master SOP Manual](business-logic/clothing/operations-workflow.md).
Developers use the owning [module contracts](BUSINESS_LOGIC_INDEX.md). The
[current reconciliation record](reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)
owns execution evidence and unresolved findings. This update documents existing
approved behavior; it does not authorize new accounting rules or data changes.

---

### Table of Contents

1. [Scope](#scope)
2. [Glossary](#glossary)
3. [Business Workflow (Supplier + Preorders)](#business-workflow-supplier--preorders)
4. [Accounting Policy (Inventory-Focused)](#accounting-policy-inventory-focused)
5. [Logistics Payable Workflow — Pattern B](#logistics-payable-workflow-forwarder--courier--packaging)
6. [Guardrails (Prevent Costly Mistakes)](#guardrails-to-prevent-costly-mistakes)
7. [Handling Rare Exceptions](#handling-rare-exceptions-accounting)
8. [Products vs Ledger as Source of Truth](#notes-on-products-as-source-of-truth-vs-ledger-as-source-of-truth)
9. [Inventory Reporting (4-Number Split)](#operational-inventory-reporting-on-hand-vs-in-transit-4-number-split)
10. [Monthly Reset / Cutover](#monthly-reset--new-cutover-practical)

---

## Scope

| Module type                         | Paths                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| **Supplier-facing** (primary)       | `clothing/operations/products`, `general-merchandise/operations/products`         |
| **Reseller-facing** (contrast only) | `clothing/operations/transactions`, `general-merchandise/operations/transactions` |

## Glossary

| Term                     | Definition                                                                        |
| ------------------------ | --------------------------------------------------------------------------------- |
| **Product**              | An item sourced from a supplier (often created early to accept preorders).        |
| **Shipment Code**        | Operational grouping of products that travel together (e.g., `KPC 23930A-00222`). |
| **COGS / Valuation**     | The cost basis used for inventory accounting and pricing decisions.               |
| **Inventory in Transit** | Asset — supplier goods paid/incurred but not yet physically received.             |
| **Stock on Hand**        | Asset — inventory physically received and available.                              |
| **Supplier Payable**     | Liability — amounts owed to suppliers.                                            |
| **Cash**                 | Combined bucket for cash + bank + e-wallet (current policy).                      |

---

## Business workflow (supplier + preorders)

### Core flow

1. We import products from China; shipping lead time is typically **1–2 months**.
2. While items are still in transit, we **post products on the platform to accept preorders**.
3. Goal: once the shipment arrives, much of the inventory is already sold — fulfillment is mainly packing/dispatch.
4. Therefore it's critical to compute and store **COGS early** to price items correctly.

### Payment dropdown meaning (Products pages)

On `*/operations/products`, the **Payment** dropdown represents **supplier payment status** (not reseller payments).

| Payment value | Meaning                                      | Typical timing                                                                                      |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Paid**      | We have already paid the supplier.           | Supplier ships same day or next day after payment.                                                  |
| **Unpaid**    | Supplier has shipped, but we will pay later. | **2–3+ months** after shipment start, often after delivery and after reseller preorder collections. |

### Rare exceptions

| Scenario                                         | What happens                                                                                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Missing item left behind**                     | Supplier ships the missing item on the next shipment (e.g., move from `00222` → `00223`). We transfer the product to the new shipment code.                                                           |
| **Missing item shipped to a different customer** | For an eligible whole paid product, confirmed future-purchase supplier credit follows the dedicated Clothing resolution. It is not a cash refund. Partial shortages require separate approved policy. |

### Data corrections

- Quantity adjustments are rare and usually due to typos.
- Edits after accounting posting must have guardrails to avoid double-posting or silently rewriting history.

---

## Accounting policy (inventory-focused)

### Accounts

**Core accounts:**

| Account              | Type      | Purpose                                 |
| -------------------- | --------- | --------------------------------------- |
| **Cash**             | Asset     | Combined cash / bank / e-wallet bucket. |
| **Supplier Payable** | Liability | Amounts owed to suppliers.              |

**Additional logistics accounts (as needed):**

| Account                        | Type      | When paid                                                   |
| ------------------------------ | --------- | ----------------------------------------------------------- |
| **Forwarder Payable**          | Liability | When shipment reaches the forwarder warehouse / PH arrival. |
| **Courier Payable (Lalamove)** | Liability | When delivering from forwarder warehouse → our warehouse.   |
| **Packaging Payable**          | Liability | Paid separately.                                            |

### Valuation source (Supplier vs Logistics)

We separate **supplier cost** from **logistics costs** operationally and in accounting:

| Cost type          | Source                       | Basis                                                                                                                                   |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Supplier cost**  | Products automation          | **Grand Total** — forwarder/courier/packaging are excluded to avoid double-counting.                                                    |
| **Logistics cost** | Separate actual-cost entries | Forwarder, Lalamove and packaging: only confirmed actual charges enter clearing/payables. Pricing estimates never create those entries. |

> 💡 The **Products page COGS** is updated later to reflect the **actual landed cost** once actual logistics amounts are known, so P&L uses the real COGS.

### Event-driven posting rules

The system posts accounting based on **real-world events**:

#### Event 1 — Explicit Transit Build-Up (Recognize Supplier Inventory)

Ordinary product creation and its stock-receipt assurance are not proof that
financial Transit Build-Up has been posted. The Clothing Products action posts
eligible linked products for the confirmed shipment. Dedicated credit-funded
creation/resolution can establish its owned source separately; never post a
second full acquisition over that source.

| Condition  | Debit                | Credit           | Amount      |
| ---------- | -------------------- | ---------------- | ----------- |
| **Paid**   | Inventory in Transit | Cash             | Grand Total |
| **Unpaid** | Inventory in Transit | Supplier Payable | Grand Total |

> 💡 We use **Grand Total** (supplier cost) — not the full landed COGS — for this posting.

#### Event 2 — Payment changes: Unpaid → Paid

This represents paying the supplier later. Posting date = **today** (money-out date).

| Debit            | Credit | Amount      |
| ---------------- | ------ | ----------- |
| Supplier Payable | Cash   | Grand Total |

> ⚠️ **This settlement must NOT touch Inventory in Transit** — the inventory was already recognized in Event 1. Touching it again would double-count.

#### Event 3 — Shipment Delivered (inventory received)

Reclass the inventory out of transit:

| Debit         | Credit               | Amount      |
| ------------- | -------------------- | ----------- |
| Stock on Hand | Inventory in Transit | Grand Total |

> This reclass starts from **Reclass to Stock on Hand** on Clothing Products,
> using the existing shipment API and requiring **Delivered**.
> Changing status to Delivered alone does **not** auto-post the reclass — this is intentional to avoid silent failures when transit build-up totals don't match product valuation totals.

---

## Logistics payable workflow (Forwarder / Courier / Packaging)

These costs are paid separately from the supplier items:

| Logistics cost         | When paid                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| **Forwarder**          | Once the shipment arrives in their warehouse / PH arrival process. |
| **Lalamove (courier)** | When it delivers from the forwarder warehouse to our warehouse.    |
| **Packaging**          | Paid separately.                                                   |

### Pricing estimates are not ledger charges

When creating products, forwarder/lalamove/packaging fields are **estimates** (usually within ~1–2%).
We include estimates early so we can compute unit pricing and accept reseller preorders immediately.
These estimates are for pricing only. Do not post or pay them as actual logistics
charges. The Logistics Costs tab is used once the actual KPC/forwarder amount is
known, and again once the actual Lalamove delivery fee is known. This workflow
was confirmed on 2026-10-25; it supersedes the earlier estimated-accrual wording.

### Chosen policy: Pattern B (capitalize logistics only when Delivered)

We intentionally **do not** post pricing estimates or add them into **Inventory in Transit**.
Record confirmed actual logistics charges in a separate temporary asset account,
then capitalize into **Stock on Hand** when the shipment is Delivered.

**Why Pattern B?**

| Benefit                      | Explanation                                                                |
| ---------------------------- | -------------------------------------------------------------------------- |
| Clean transit account        | **Inventory in Transit** represents supplier item cost (Grand Total) only. |
| Costs stay on balance sheet  | Landed costs remain assets (not P&L) while waiting for delivery.           |
| Single capitalization moment | Delivery day is when inventory becomes "all-in landed cost."               |

#### Account needed

| Account                  | Type  | Purpose                                                                                                                                |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Landed Cost Clearing** | Asset | Temporary holding for logistics costs not yet capitalized into inventory. (Also called "Logistics Clearing", "Freight Clearing", etc.) |

### Pattern B — 4-step checklist

> **Example:** Pricing estimate ₱1,000, confirmed actual charge ₱950. Only ₱950 enters the ledger.

#### Step 1 — Record the confirmed actual charge

| Debit                | Credit            | Amount |
| -------------------- | ----------------- | ------ |
| Landed Cost Clearing | Forwarder Payable | ₱950   |

#### Step 2 — Optional correction of an already-recorded actual charge

No adjustment is needed merely because the pricing estimate differs. If a
previously recorded actual charge of ₱1,000 is later corrected to ₱950 before
it has been paid or capitalized, correct the ₱50 difference:

| Debit             | Credit               | Amount |
| ----------------- | -------------------- | ------ |
| Forwarder Payable | Landed Cost Clearing | ₱50    |

#### Step 3 — Settle when paid (money-out date)

| Debit             | Credit | Amount |
| ----------------- | ------ | ------ |
| Forwarder Payable | Cash   | ₱950   |

#### Step 4 — Capitalize at delivery (Delivered / received date)

| Debit         | Credit               | Amount |
| ------------- | -------------------- | ------ |
| Stock on Hand | Landed Cost Clearing | ₱950   |

Courier (Lalamove) and Packaging follow the exact same 4 steps using their respective payable accounts.

> 💡 We still update the **Products page COGS** to reflect the final actual landed cost once actual amounts are known.

> ⚠️ **Don't reclass by crediting the payable again.**
> The delivery capitalization step (Step 4) credits **Landed Cost Clearing**, not the payable.
> The payable is only cleared by: `Dr Payable / Cr Cash` (Step 3).

The guided clothing API is `GET/POST /api/accounting/shipment-logistics`.
It identifies shipment/vendor/action independently of descriptions and refs,
posts balanced pairs in a Serializable transaction, and uses a stable request
key for retries. Partial payments cannot exceed the remaining actual payable;
capitalization cannot exceed uncapitalized actual cost and requires Delivered
with no posting before the known delivery date. Downward corrections cannot
make either payable or clearing negative. It does not alter product COGS.

Existing unstructured manual journals are not inferred, converted or deleted.
Potentially matching history locks guided posting pending review. Existing
manual accounting remains the reviewed exception path; this change does not
certify arbitrary manual entries or repair historical balances.

### Pattern B — Late posting shortcut (already delivered, no entries yet)

These shortcuts are reviewed manual-accounting entries, not actions in the
guided three-step actual-cost workflow.

If the shipment is already delivered and **none of the 4 steps were posted**, skip Landed Cost Clearing and collapse to:

**If not yet paid:**

| Debit         | Credit            | Amount        |
| ------------- | ----------------- | ------------- |
| Stock on Hand | Forwarder Payable | Actual amount |

Then settle later: `Dr Forwarder Payable / Cr Cash`.

**If already paid:**

| Debit         | Credit | Amount        |
| ------------- | ------ | ------------- |
| Stock on Hand | Cash   | Actual amount |

### Special case: opening balances for already-delivered shipments

If a shipment's forwarder/courier payable was introduced via **OPENING** entries (`Dr Opening Equity / Cr Payable`), don't create a second payable.

For those historical shipments, the capitalization step is:

| Debit         | Credit         |
| ------------- | -------------- |
| Stock on Hand | Opening Equity |

This moves the opening-balance debit into inventory so Stock on Hand reflects landed cost.

### Per-product posting preference

For traceability, entries should be **per product** (not only grouped by shipment code), even if the UI aggregates summaries.

---

## Guardrails (to prevent costly mistakes)

### Reseller payments (Transactions module): no legacy adjustments

On `*/operations/transactions`, the **Adjustment** column is treated as a **legacy field**.

| Layer         | Rule                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **UI**        | Adjustment is **read-only** in the transactions grid.                                                                            |
| **API**       | Transaction update endpoints **ignore/deny** writes to the legacy Adjustment field.                                              |
| **Payments**  | Use the "Record Payment" flow (bulk payments endpoint) which writes `transaction_payments` rows and updates totals consistently. |
| **Discounts** | If we need to change unit pricing behavior without touching the Prices module, use the **Discount** column.                      |

### Confirmation on product creation

When the user clicks **Add Product**, show a SweetAlert confirmation:

| Payment selection | Confirmation message                                                 |
| ----------------- | -------------------------------------------------------------------- |
| **Paid**          | "You are adding a new product that is already PAID. Please confirm." |
| **Unpaid**        | "You are adding a new product that is UNPAID. Please confirm."       |

### Prevent accidental reversals

- Only auto-post the settlement when changing **Unpaid → Paid**.
- For **Paid → Unpaid**, require a separate explicit workflow (reversal/refund/correction) — not an automatic silent change.

### Idempotency

Every auto-generated posting must be idempotent:

- Unique key per event + product (and/or shipment) so saving twice does not duplicate entries.

Engineering refactor work is tracked only in the [refactor tracker](plans/REFACTOR_CHECKLIST.md),
not repeated as accounting policy. Active legacy adapters and historical-cost
fallbacks must remain until their consumers and migration/recovery requirements
are explicitly retired.

---

## Handling rare exceptions (accounting)

### A) Missing item moved to next shipment

**Operational action:** for a wholly delayed unreceived product, use the
administrator's dedicated Supplier resolution transfer to an existing shipment.
Do not use an ordinary grid relink or delete the original funding source.

| Posting state                                      | Accounting impact                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Eligible whole unreceived product                  | Transfer preserves original product funding, amount, dates and source keys; no second payment or acquisition.                           |
| Partially received, fulfilled or already reclassed | Dedicated whole-product transfer rejects. Obtain an owner-approved correction; no generic reversal/relink procedure is authorized here. |

### B) Confirmed Future-Purchase Supplier Credit

Only eligible entirely unreceived, funded Clothing purchases support this
workflow. Issuance uses saved Grand Total, preserves original payment/card debt,
and records the confirmed replacement claim:

| Debit            | Credit               |
| ---------------- | -------------------- |
| Supplier Credits | Inventory in Transit |

Applying issued credit preserves the new purchase's gross amount and consumes
only the selected credit, with the rest funded by Cash/card or Supplier Payable.
An unsettled Unpaid original cannot create a funded supplier-credit asset.
Follow-up notes on partial shortages are not usable credits. No automatic cash
refund, partial issuance, reversal, expiry or write-off is approved by this text.
See the [owning Products contract](business-logic/clothing/operations-products.md#supplier-nonfulfillment-and-future-purchase-credit).

### C) Supplier Extras, Physical Returns And Dated Costs

Genuine supplier extras are separate explicit zero-acquisition-cost units, sold
at the ordinary customer price. Keep original paid lot costs; do not redistribute
them or silently confirm a missing cost as zero. Actual source costs follow
transfers, assembly, fulfillment and physical returns. Split components require
explicit acquisition costs conserving the parent; selling prices do not allocate cost.

Cancellation approval, actual money payout and physical return are separate.
Original component/source history stays intact; complete original split pieces
may rebuild a parent once. Approved dated corrections preserve original sale
snapshots while allocating the corrected carrying value as of their actual date.
Ambiguous or transformed histories can require review rather than guessed edits.
See [Inventory](business-logic/clothing/operations-inventory.md) and
[P&L valuation](business-logic/clothing/accounting-profit-loss.md#valuation-completeness-and-dated-corrections).

### D) Open Financial Correction Risks

Expense-payment backdating (EXP-HISTORY-01), paid-expense deletion history
(EXP-HISTORY-02) and Bank Fees label classification remain unresolved. Do not
describe status toggles, deleting paid rows or renaming accounts as a safe
correction. The [follow-up register](reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#follow-up-register)
owns decisions and acceptance evidence. Passing tests or a balanced statement
does not certify those workflows, external cash or physical stock.

---

## Notes on "products as source of truth" vs "ledger as source of truth"

| Layer              | Role                                                         |
| ------------------ | ------------------------------------------------------------ |
| **Products**       | Operational truth — editable for workflow.                   |
| **Ledger entries** | Financial truth — auditability, stable historical reporting. |

If we need edits after posting, prefer **adjustment entries** (delta changes) over rewriting history.

---

## Operational inventory reporting: on-hand vs in-transit (4-number split)

We accept preorders while items are still traveling. We must not report them as **Stock on Hand** until physically received.

The Inventory page/report uses a **4-number split** per product code:

| #   | Category                  | Description                                                       |
| --- | ------------------------- | ----------------------------------------------------------------- |
| 1   | **On-hand sellable**      | Physically received and currently sellable.                       |
| 2   | **On-hand reserved**      | Physically received but reserved for orders.                      |
| 3   | **In-transit unreserved** | Exists in the system but shipment still in transit; not reserved. |
| 4   | **In-transit reserved**   | Reserved for orders, but shipment still in transit.               |

### Source of truth for "on-hand" vs "in-transit"

| Shipment status                                | Treated as                                                                                                                                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit **In Transit**                        | Current Clothing projection shows zero physical stock and separates transit reserved/unreserved.                                                                                                |
| **Delivered**                                  | Received projection; verify actual count and any shortage/damage.                                                                                                                               |
| Other, blank, unmatched or intermediate status | Existing received-supply fallback can apply; this is not proof of actual arrival. Reconcile physical location rather than assuming every non-Delivered status is automatically held in transit. |

Approved physical policy still requires actual arrival; the display's fallback
does not redefine it. The linked shipment overrides stale product status when
available. Display reads do not perform the separate financial reclassification.
See the [Inventory contract](business-logic/clothing/operations-inventory.md#physical-location-and-reservation-split).

> ⚠️ **Reservations can exist while in transit.** Preorder allocations show under "In-transit reserved" until the shipment is Delivered.

**"Available stock"** = On-hand Sellable only. In-transit items are never treated as available/ready to fulfill.

---

## Appendix: Example shipment scenario

**Shipment code:** `KPC 23930A-00222`

| Product            | Code      |
| ------------------ | --------- |
| Mixed Shorts       | MS-010226 |
| Ruffled Frogsuit   | RF-010226 |
| Milkberry Frogsuit | MF-010226 |
| Zippered Frogsuit  | ZF-010326 |

These may be created early for preorder selling while they are still in transit.

---

## Monthly reset / New cutover (practical)

Changing a cutoff is not a routine monthly reset or a remedy for confusing
balances. It hides scope rather than proving the missing events are correct.

1. Obtain explicit owner/accounting approval for the scope, date, evidence and
   recovery plan. Do not copy February example balances or modify another domain.
2. Verify the actual prior closing and all assets, liabilities, deposits and
   refund obligations. New openings must represent documented balances, not
   whichever numbers make the new statement balance.
3. Use reviewed domain-specific runtime settings and supported paired opening
   entries with unique descriptions. Saved runtime settings can override the
   environment/default cutoff; changing an environment variable alone is not proof.
4. Verify prior and new as-of reports, brought-forward amounts, period movements,
   closing balances and exports without rewriting original events. Keep evidence.

X04 provides isolated cross-cutover proof, not authorization to reset business
books. Target operations, migrations and historical recovery require their own
review under [Deployment](DEPLOYMENT.md) and
[migration recovery evidence](reports/DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md).
