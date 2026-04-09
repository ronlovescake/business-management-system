# Operational Workflow & Accounting Policy (Supplier → Inventory)

This document captures how we run **supplier-facing** workflows in the app and the accounting rules we want to follow.
It prevents repeating the same Q&A and acts as a living reference as workflows evolve.

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

| Module type | Paths |
|---|---|
| **Supplier-facing** (primary) | `clothing/operations/products`, `general-merchandise/operations/products` |
| **Reseller-facing** (contrast only) | `clothing/operations/transactions`, `general-merchandise/operations/transactions` |

## Glossary

| Term | Definition |
|---|---|
| **Product** | An item sourced from a supplier (often created early to accept preorders). |
| **Shipment Code** | Operational grouping of products that travel together (e.g., `KPC 23930A-00222`). |
| **COGS / Valuation** | The cost basis used for inventory accounting and pricing decisions. |
| **Inventory in Transit** | Asset — supplier goods paid/incurred but not yet physically received. |
| **Stock on Hand** | Asset — inventory physically received and available. |
| **Supplier Payable** | Liability — amounts owed to suppliers. |
| **Cash** | Combined bucket for cash + bank + e-wallet (current policy). |

---

## Business workflow (supplier + preorders)

### Core flow

1. We import products from China; shipping lead time is typically **1–2 months**.
2. While items are still in transit, we **post products on the platform to accept preorders**.
3. Goal: once the shipment arrives, much of the inventory is already sold — fulfillment is mainly packing/dispatch.
4. Therefore it's critical to compute and store **COGS early** to price items correctly.

### Payment dropdown meaning (Products pages)

On `*/operations/products`, the **Payment** dropdown represents **supplier payment status** (not reseller payments).

| Payment value | Meaning | Typical timing |
|---|---|---|
| **Paid** | We have already paid the supplier. | Supplier ships same day or next day after payment. |
| **Unpaid** | Supplier has shipped, but we will pay later. | **2–3+ months** after shipment start, often after delivery and after reseller preorder collections. |

### Rare exceptions

| Scenario | What happens |
|---|---|
| **Missing item left behind** | Supplier ships the missing item on the next shipment (e.g., move from `00222` → `00223`). We transfer the product to the new shipment code. |
| **Missing item shipped to a different customer** | Supplier can't retrieve it. Supplier provides a **refund** for the missing item. |

### Data corrections

- Quantity adjustments are rare and usually due to typos.
- Edits after accounting posting must have guardrails to avoid double-posting or silently rewriting history.

---

## Accounting policy (inventory-focused)

### Accounts

**Core accounts:**

| Account | Type | Purpose |
|---|---|---|
| **Cash** | Asset | Combined cash / bank / e-wallet bucket. |
| **Supplier Payable** | Liability | Amounts owed to suppliers. |

**Additional logistics accounts (as needed):**

| Account | Type | When paid |
|---|---|---|
| **Forwarder Payable** | Liability | When shipment reaches the forwarder warehouse / PH arrival. |
| **Courier Payable (Lalamove)** | Liability | When delivering from forwarder warehouse → our warehouse. |
| **Packaging Payable** | Liability | Paid separately. |

### Valuation source (Supplier vs Logistics)

We separate **supplier cost** from **logistics costs** operationally and in accounting:

| Cost type | Source | Basis |
|---|---|---|
| **Supplier cost** | Products automation | **Grand Total** — forwarder/courier/packaging are excluded to avoid double-counting. |
| **Logistics cost** | Separate payable entries | Forwarder, Lalamove, packaging — entered as **estimates** while in transit; actuals known later. |

> 💡 The **Products page COGS** is updated later to reflect the **actual landed cost** once actual logistics amounts are known, so P&L uses the real COGS.

### Event-driven posting rules

The system posts accounting based on **real-world events**:

#### Event 1 — Product created (recognize supplier inventory)

| Condition | Debit | Credit | Amount |
|---|---|---|---|
| **Paid** | Inventory in Transit | Cash | Grand Total |
| **Unpaid** | Inventory in Transit | Supplier Payable | Grand Total |

> 💡 We use **Grand Total** (supplier cost) — not the full landed COGS — for this posting.

#### Event 2 — Payment changes: Unpaid → Paid

This represents paying the supplier later. Posting date = **today** (money-out date).

| Debit | Credit | Amount |
|---|---|---|
| Supplier Payable | Cash | Grand Total |

> ⚠️ **This settlement must NOT touch Inventory in Transit** — the inventory was already recognized in Event 1. Touching it again would double-count.

#### Event 3 — Shipment Delivered (inventory received)

Reclass the inventory out of transit:

| Debit | Credit | Amount |
|---|---|---|
| Stock on Hand | Inventory in Transit | Grand Total |

> 💡 This reclass is performed via the **Transit Reclass** action in the Shipments module (enabled only when shipment status = **Delivered**).
> Changing status to Delivered alone does **not** auto-post the reclass — this is intentional to avoid silent failures when transit build-up totals don't match product valuation totals.

---

## Logistics payable workflow (Forwarder / Courier / Packaging)

These costs are paid separately from the supplier items:

| Logistics cost | When paid |
|---|---|
| **Forwarder** | Once the shipment arrives in their warehouse / PH arrival process. |
| **Lalamove (courier)** | When it delivers from the forwarder warehouse to our warehouse. |
| **Packaging** | Paid separately. |

### Estimates while in transit

When creating products, forwarder/lalamove/packaging fields are **estimates** (usually within ~1–2%).
We include estimates early so we can compute unit pricing and accept reseller preorders immediately.

### Chosen policy: Pattern B (capitalize logistics only when Delivered)

We intentionally **do not** add forwarder/courier/packaging estimates into **Inventory in Transit**.
Instead, we track logistics costs in a separate temporary asset account until delivery, then capitalize into **Stock on Hand** when the shipment arrives.

**Why Pattern B?**

| Benefit | Explanation |
|---|---|
| Clean transit account | **Inventory in Transit** represents supplier item cost (Grand Total) only. |
| Costs stay on balance sheet | Landed costs remain assets (not P&L) while waiting for delivery. |
| Single capitalization moment | Delivery day is when inventory becomes "all-in landed cost." |

#### Account needed

| Account | Type | Purpose |
|---|---|---|
| **Landed Cost Clearing** | Asset | Temporary holding for logistics costs not yet capitalized into inventory. (Also called "Logistics Clearing", "Freight Clearing", etc.) |

### Pattern B — 4-step checklist

> **Example:** Forwarder estimate ₱1,000, actual ₱950

#### Step 1 — Record estimate (while in transit)

| Debit | Credit | Amount |
|---|---|---|
| Landed Cost Clearing | Forwarder Payable | ₱1,000 |

#### Step 2 — Adjust estimate to actual (adjustment entry)

If actual is lower (₱950):

| Debit | Credit | Amount |
|---|---|---|
| Forwarder Payable | Landed Cost Clearing | ₱50 |

#### Step 3 — Settle when paid (money-out date)

| Debit | Credit | Amount |
|---|---|---|
| Forwarder Payable | Cash | ₱950 |

#### Step 4 — Capitalize at delivery (Delivered / received date)

| Debit | Credit | Amount |
|---|---|---|
| Stock on Hand | Landed Cost Clearing | ₱950 |

Courier (Lalamove) and Packaging follow the exact same 4 steps using their respective payable accounts.

> 💡 We still update the **Products page COGS** to reflect the final actual landed cost once actual amounts are known.

> ⚠️ **Don't reclass by crediting the payable again.**
> The delivery capitalization step (Step 4) credits **Landed Cost Clearing**, not the payable.
> The payable is only cleared by: `Dr Payable / Cr Cash` (Step 3).

### Pattern B — Late posting shortcut (already delivered, no entries yet)

If the shipment is already delivered and **none of the 4 steps were posted**, skip Landed Cost Clearing and collapse to:

**If not yet paid:**

| Debit | Credit | Amount |
|---|---|---|
| Stock on Hand | Forwarder Payable | Actual amount |

Then settle later: `Dr Forwarder Payable / Cr Cash`.

**If already paid:**

| Debit | Credit | Amount |
|---|---|---|
| Stock on Hand | Cash | Actual amount |

### Special case: opening balances for already-delivered shipments

If a shipment's forwarder/courier payable was introduced via **OPENING** entries (`Dr Opening Equity / Cr Payable`), don't create a second payable.

For those historical shipments, the capitalization step is:

| Debit | Credit |
|---|---|
| Stock on Hand | Opening Equity |

This moves the opening-balance debit into inventory so Stock on Hand reflects landed cost.

### Per-product posting preference

For traceability, entries should be **per product** (not only grouped by shipment code), even if the UI aggregates summaries.

---

## Guardrails (to prevent costly mistakes)

### Reseller payments (Transactions module): no legacy adjustments

On `*/operations/transactions`, the **Adjustment** column is treated as a **legacy field**.

| Layer | Rule |
|---|---|
| **UI** | Adjustment is **read-only** in the transactions grid. |
| **API** | Transaction update endpoints **ignore/deny** writes to the legacy Adjustment field. |
| **Payments** | Use the "Record Payment" flow (bulk payments endpoint) which writes `transaction_payments` rows and updates totals consistently. |
| **Discounts** | If we need to change unit pricing behavior without touching the Prices module, use the **Discount** column. |

### Confirmation on product creation

When the user clicks **Add Product**, show a SweetAlert confirmation:

| Payment selection | Confirmation message |
|---|---|
| **Paid** | "You are adding a new product that is already PAID. Please confirm." |
| **Unpaid** | "You are adding a new product that is UNPAID. Please confirm." |

### Prevent accidental reversals

- Only auto-post the settlement when changing **Unpaid → Paid**.
- For **Paid → Unpaid**, require a separate explicit workflow (reversal/refund/correction) — not an automatic silent change.

### Idempotency

Every auto-generated posting must be idempotent:
- Unique key per event + product (and/or shipment) so saving twice does not duplicate entries.

<details>
<summary><strong>Refactor rationale (engineering summary — click to expand)</strong></summary>

**P1: Shared employee core** (remove clothing/trucking duplication)
- Single source of truth for business rules; fewer "fixed in one module, broken in another" regressions.
- Faster delivery: implement once, expose via thin wrappers for each domain.
- Lower test cost: one core test suite covers most behavior; wrappers only need light smoke tests.
- Better policy consistency (especially payroll/employee/accounting side effects) across modules.

**P1: Split God hooks into focused hooks**
- Smaller units are easier to reason about, review, and safely modify.
- Lower bug risk from unrelated side effects.
- Better performance opportunities (more targeted memoization/state updates).
- Higher confidence for future changes to payment workflows and accounting guardrails.

**P2: Compose oversized API routes + domain adapters**
- Clear separation of concerns improves maintainability.
- Reduced duplication between clothing and GM accounting endpoints.
- Safer accounting evolution: one place to enforce rules.
- Better observability and incident debugging.

**P2: Remove dead/legacy state and backward-compat shims**
- Less cognitive load and fewer misleading code paths.
- Reduced accidental reactivation of deprecated behavior.
- Smaller surface area for defects and security issues.

**P3: Move root tmp scripts + enforce retention policy**
- Cleaner repository root; fewer accidental script runs.
- Clear boundary between permanent tooling and temporary maintenance scripts.

**Overall business impact:** Faster feature throughput, fewer regressions, lower maintenance cost, more reliable accounting behavior.

</details>

---

## Handling rare exceptions (accounting)

### A) Missing item moved to next shipment

**Operational action:** Move product from old shipment code to new shipment code.

| Posting state | Accounting impact |
|---|---|
| Not yet delivered/reclassed | Usually **no accounting impact** (still in transit). |
| Already reclassed to Stock on Hand | Correction required — move product's value **back** to Inventory in Transit, then reclass later when the new shipment is delivered. |

### B) Supplier refund for missing item

On refund date, reverse the in-transit asset for that product:

| Debit | Credit |
|---|---|
| Cash | Inventory in Transit |

> 💡 If the amount was still in Supplier Payable (not yet paid), reduce the payable accordingly instead of crediting Cash.

---

## Notes on "products as source of truth" vs "ledger as source of truth"

| Layer | Role |
|---|---|
| **Products** | Operational truth — editable for workflow. |
| **Ledger entries** | Financial truth — auditability, stable historical reporting. |

If we need edits after posting, prefer **adjustment entries** (delta changes) over rewriting history.

---

## Operational inventory reporting: on-hand vs in-transit (4-number split)

We accept preorders while items are still traveling. We must not report them as **Stock on Hand** until physically received.

The Inventory page/report uses a **4-number split** per product code:

| # | Category | Description |
|---|---|---|
| 1 | **On-hand sellable** | Physically received and currently sellable. |
| 2 | **On-hand reserved** | Physically received but reserved for orders. |
| 3 | **In-transit unreserved** | Exists in the system but shipment still in transit; not reserved. |
| 4 | **In-transit reserved** | Reserved for orders, but shipment still in transit. |

### Source of truth for "on-hand" vs "in-transit"

| Shipment status | Treated as |
|---|---|
| **Delivered** | On-hand |
| Any other status (incl. blank/unknown) | In-transit |

This matches the accounting reclass: `Dr Stock on Hand / Cr Inventory in Transit` at delivery.

> ⚠️ **Reservations can exist while in transit.** Preorder allocations show under "In-transit reserved" until the shipment is Delivered.

**"Available stock"** = On-hand Sellable only. In-transit items are never treated as available/ready to fulfill.

---

## Appendix: Example shipment scenario

**Shipment code:** `KPC 23930A-00222`

| Product | Code |
|---|---|
| Mixed Shorts | MS-010226 |
| Ruffled Frogsuit | RF-010226 |
| Milkberry Frogsuit | MF-010226 |
| Zippered Frogsuit | ZF-010326 |

These may be created early for preorder selling while they are still in transit.

---

## Monthly reset / New cutover (practical)

If you want to start fresh for a new month (e.g., Feb 1) because the prior month is confusing or mismatched, **do not rewrite history**. Instead:

### Step 1 — Set a new accounting cutover date

| Env variable | Value | Notes |
|---|---|---|
| `ACCOUNTING_CUTOVER_DATE_CLOTHING` | `"2026-02-01"` (UTC midnight) | Sets the clothing module cutover. |
| `ACCOUNTING_CUTOVER_DATE_GM` | _(leave empty)_ | GM stays on the original default cutover (2026-01-17). |
| `ACCOUNTING_CUTOVER_DATE` | _(leave empty)_ | Avoids changing both modules accidentally. |

### Step 2 — Enter a clean Opening Balance snapshot (full Balance Sheet)

Add balances you want the books to start with: `Cash`, `Stock on Hand`, `Inventory in Transit`, and any non-zero liabilities.
If a liability account is 0, omit it (no entry = 0 balance).

#### Editing opening balances

> ⚠️ The Ledger UI "Edit Opening Entry" modal treats an opening entry as a **two-line pair** (one debit, one credit).
> It finds the counterpart line by matching: **Date**, **Ref**, **Description**, **Amount**.
>
> For anything you may want to edit later (especially loans), create **explicit debit/credit pairs** with a **unique Description per pair** (critical when two loans share the same amount).

**Tips:**
- The bulk opening-balance script auto-adds a balancing **Opening Equity** line — correct accounting-wise, but bulk-loading many liabilities under one ref may cause lines to appear "unpaired" in the editor.
- To keep things editable, either enter pairs via the UI, or apply openings in separate batches with unique descriptions.

#### Scripted approach (with dry-run preview)

Create `tmp/opening-balances-2026-02-01.json`:

```json
{
  "Cash": 80990,
  "Stock on Hand": 0,
  "Inventory in Transit": 0,
  "Customer Deposits": 0,
  "Loan Payable – Interest-free borrowing": 0,
  "Loan Payable – Unionbank Personal Loan": 0,
  "Loan Payable – BPI Business Loan 1": 0
}
```

Dry run:

```bash
npx tsx scripts/set-opening-balances.ts \
  --module clothing --date 2026-02-01 \
  --ref OPENING-2026-02-01 \
  --input tmp/opening-balances-2026-02-01.json
```

Apply:

```bash
npx tsx scripts/set-opening-balances.ts \
  --module clothing --date 2026-02-01 \
  --ref OPENING-2026-02-01 \
  --input tmp/opening-balances-2026-02-01.json --apply
```

The script:
- Skips 0-balance lines automatically
- Auto-adds a balancing `Opening Equity` line so debits = credits

#### Practical approach we used (Feb 1, 2026 Clothing)

Instead of one giant opening import, we applied separate refs for clarity and safer editing:

| Ref | Entry |
|---|---|
| `OPENING-STOCK` | Dr Stock on Hand / Cr Opening Equity |
| `OPENING-LOANS` | Per-loan paired entries for editability |
| `OPENING-CASH` | Dr Cash / Cr Opening Equity |

### Step 3 — Verify

Re-check Balance Sheet and Ledger as-of the cutover date.
