# Clothing - Accounting: Balance Sheet Business Logic

> **Source files:**
>
> - `src/app/api/accounting/balance-sheet/route.ts`
> - `src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts`
> - `src/app/clothing/accounting/balance-sheet/components/BalanceSheetStatsCards.tsx`
> - `src/app/clothing/accounting/balance-sheet/components/BalanceSheetCashTable.tsx`
> - `src/app/clothing/accounting/balance-sheet/components/BalanceSheetStockTable.tsx`
> - `src/app/clothing/accounting/balance-sheet/components/BalanceSheetTransitTable.tsx`
> - `src/app/clothing/accounting/balance-sheet/components/BalanceSheetTable.tsx`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                          | Explanation                                                                                                                 |
| --- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | Five stat cards at the top                                                     | Assets (blue), Liabilities (red), Equity (green), Balance (teal/orange), As Of (violet).                                    |
| 2   | Assets: displayed as-is (positive)                                             | Sum of all asset account balances.                                                                                          |
| 3   | Liabilities: displayed as `formatCurrency(-liabilities)` — negated for display | Accounting stores liabilities as negative; display inverts to show a positive number.                                       |
| 4   | Equity: displayed as `formatCurrency(-equity)` — negated for display           | Same inversion convention as liabilities.                                                                                   |
| 5   | Balance: `assets + liabilities + equity` (the accounting equation result)      | Displayed in teal with a check icon when `balance === 0` (balanced); displayed in orange with a warning icon when non-zero. |
| 6   | As Of: the date the balance sheet snapshot was computed                        | Shown as a formatted date in the violet card.                                                                               |

---

## B - "As Of" Date Parameter

The shared controls retain Manila today after selecting a past date and dedupe
the selected/current options across summary and breakdown tabs. The existing
fixed November/December 2025 choices remain; this is not an arbitrary-date
picker. The API accepts a date-only as-of scope subject to the runtime cutover.

| #   | Logic                                                            | Explanation                                                                                                                       |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Data fetched via `GET /accounting/balance-sheet?asOf=YYYY-MM-DD` | The `asOf` parameter uses date-only format (not a full ISO timestamp).                                                            |
| 8   | Date-only format ensures server-side end-of-day clamping         | Passing a full ISO timestamp would cut off same-day transactions; `YYYY-MM-DD` captures all transactions through end of that day. |
| 9   | Default `asOf` is today's date                                   | User can change it to view a historical snapshot.                                                                                 |

---

## C - Balance Sheet Data Model

### Receipt Dates And Legacy Collections

Approved invariant (requesting Clothing business owner): an active, finite,
positive payment contributes its receipt asset once by its recorded payment
date within cutover through as-of, independently of order status, packing,
checkout, dispatch or release. Cash methods contribute Cash; incoming CARD
contributes Card Collections Clearing, not Cash. Refunds and actual CARD
settlements retain their separate existing report effects.

Any active finite positive payment row, including one before cutover or after
as-of, suppresses inferred legacy cash for that order. Completion cannot move
an earlier receipt into this window or count a future receipt early. Missing
or invalid payment dates do not receive an invented date; their positive rows
still suppress fallback and require source review.

Explicit legacy compatibility: orders without active finite positive payment
rows retain the existing normalized collection amount and existing recognition
date fallback. Zero, negative and non-finite rows are non-posting and do not
suppress it, matching Journal/Ledger. This preserves legacy collections, but
the fallback is an estimate, not evidence of an actual receipt date. Historical
legacy receipt dates require separate evidence and approved reconciliation.

The enforcement boundary is this read-only Clothing report projection. Existing
revenue, receivable, deposit recognition and movement-based COGS calculations
are unchanged. Removing false cash can expose a nonzero statement equation;
do not hide it with Owner Draw, a balancing journal or a new recognition rule.
Fully paid, Prepared, In Transit and On-Hold do not acquire new workflow or
recognition semantics from this cash fix.

Impact: the Clothing balance-sheet UI and its cash breakdown/CSV, plus report
consumers such as the accounting dashboard, receive the corrected projection.
Journal/Ledger already suppress legacy cash across payment dates and are not
changed. Payment/order UI, API, bulk, import, jobs and retry/write services are
unchanged: all existing producers feed the same active-payment read path; no
stored payment, status or history is rewritten. General Merchandise has its own
report route and fetchers and is intentionally unchanged under this Clothing-only
approval; shared normalization/fetchers, trucking and household rules are also
unchanged. No cross-domain recognition policy is inferred.

Regression evidence:
`tests/unit/api/accounting-balance-sheet.api.test.ts` covers the seven-order
PHP 4,331 example with original receipt dates, early/transit/held receipts,
split reporting windows, future receipts, same-window fulfillment, reservation
and CARD assets, repeated reads, preserved source inputs/COGS, and rowless or
non-posting legacy rows. Shared fixtures compare Cash with Journal and Ledger;
unchanged recognition can still differ from their equity projections.

### Customer Money, Refund Obligations And CARD

Apply the [Journal event contract](accounting-journal.md#dated-customer-money-and-card-events)
at each as-of cutoff. Cancellation snapshots preserve the earlier invoice/A/R
recognition history and actual receipts. Approval removes the unpaid receivable,
releases/applies the relevant deposit and creates Refunds Payable without
changing Cash. The original deposit is not left duplicated as both Customer
Deposits and Refunds Payable. Actual partial payouts alone reduce the approved
liability and Cash. Pending is computed from approved amount minus actual
payouts through the cutoff, not today's mutable pending balance.

Incoming CARD remains a Card Collections Clearing asset until actual settlement.
Cash and its breakdown exclude that unsettled amount; outgoing Credit Card
Payable retains its existing liability meaning. The shared real-data five-report
regression verifies the equation and Cash/clearing amounts before invoice,
after invoice, after noncash approval and after partial payout.

Persisted dated cost corrections contribute their sold-cost journal delta once.
Original movement snapshots and projected receipt basis preserve old as-of
reports; logistics capitalization is not booked a second time. See
[P&L valuation/correction policy](accounting-profit-loss.md#valuation-completeness-and-dated-corrections).

| #   | Logic                                                                                                                                | Explanation                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 10  | Each balance sheet row has: `id`, `account`, `type` (`'Asset'` or `'Liability'` or `'Equity'`), `amount`, `details` (optional array) | `details` is an array of `{ label, amount }` sub-items for accounts with breakdowns. |
| 11  | Stats returned by the API: `assets`, `liabilities`, `equity`, `balance`, `asOf`                                                      | All are pre-computed server-side.                                                    |

Cards use those authoritative whole-statement stats, including the server's
signed equation result. Search filters rows/CSV, not assets/liabilities/equity
or the equation. Do not subtract already-negative liabilities/equity again, or
replace a genuine nonzero server balance with a recomputed search result. Both
Clothing and GM shared-hook regressions cover balanced and imbalanced responses.

Real as-of testing also reproduced two unresolved Expenses history defects:
later settlement backdates Cash to the original expense date, and paid-expense
soft deletion removes that earlier statement effect. See the
[expense limits](accounting-expenses.md#reconciliation-and-historical-limits).
The equation remaining zero does not establish correct dates or completeness.

The balance-sheet API applies signed net movement-based COGS from cutover through
the as-of date. Positive COGS reduces Stock on Hand and equity; negative net COGS
(for example, a return of goods sold before cutover) restores Stock on Hand and
reverses the corresponding equity reduction. The stock breakdown includes the
same signed adjustment. Zero net COGS adds no adjustment. This preserves the
existing inventory movement return treatment; it does not revalue historical
cost snapshots or change scrap accounting.

Derived scrap-return descriptions show the actual movement buckets, such as
`scrap→sellable`, not `opening→sellable`. This is a label-only correction:
existing entry IDs, references, amounts, asset accounts and Opening Equity
offsets are unchanged. It does not certify opening inventory or resolve any
historical quantity, cost or adjustment discrepancy.

---

## D - Asset Breakdown Tables

| #   | Logic                                                                                                                                                        | Explanation                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 12  | **Cash Breakdown Table** shown when the `Cash` account has a `details` array                                                                                 | Finds the Cash account by exact match or by account name containing `'cash'` (case-insensitive). |
| 13  | Cash breakdown rows: `id`, `tag`, `amount`                                                                                                                   | Each row represents a sub-account or tagged cash bucket (e.g. "Cash - Main Vault", "GCash").     |
| 14  | `cashBreakdownSummary`: `cashAccountBalance` (total Cash balance), `detailSum` (sum of breakdown rows), `unclassifiedDelta` (cashAccountBalance - detailSum) | `unclassifiedDelta` represents cash not yet classified into a named bucket.                      |
| 15  | **Stock Breakdown Table** shown when the `Stock on Hand` account has a `details` array                                                                       | Finds account by exact match `'Stock on Hand'`.                                                  |
| 16  | Stock breakdown rows: `id`, `tag`, `amount`                                                                                                                  | Each row represents a product group or category.                                                 |
| 17  | `stockBreakdownSummary`: same structure as cash — `stockOnHandBalance`, `detailSum`, `unclassifiedDelta`                                                     | `unclassifiedDelta` is untagged stock value.                                                     |
| 18  | **Transit Breakdown Table** shown when the `Inventory in Transit` account has a `details` array                                                              | Finds account by exact match `'Inventory in Transit'`.                                           |
| 19  | Transit breakdown rows: `id`, `tag`, `amount`                                                                                                                | Each row represents an in-transit shipment or transit group.                                     |
| 20  | `transitBreakdownSummary`: `inventoryInTransitBalance`, `detailSum`, `unclassifiedDelta`                                                                     | Same pattern as cash and stock breakdowns.                                                       |

---

## E - Main Balance Sheet Table

| #   | Logic                                                                           | Explanation                                                             |
| --- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 21  | Main table groups rows by type: Assets first, then Liabilities, then Equity     | Standard balance sheet presentation.                                    |
| 22  | Asset amounts displayed as-is; Liability and Equity amounts negated for display | Display inversion consistent with stat card logic (rule 3–4).           |
| 23  | Rows with a non-empty `details` array are expandable to show sub-items          | Sub-items show `label` and `amount` (also negated if liability/equity). |

---

## F - CSV Export

| #   | Logic                                                  | Explanation                                                                                                   |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| 24  | Export CSV exports the currently filtered account rows | Calls `handleExportCSV`; whole-statement stat cards remain unchanged by that filter.                          |
| 25  | Exported headers: Account, Type, Amount, Details       | `Details` column formatted as `${label}: ${amount}                                                            | ${label}: ${amount} | ...`; empty string if no details. |
| 26  | Filename: `balance-sheet-${sanitizedAsOf}.csv`         | `sanitizedAsOf` is the `asOf` date converted to lowercase with hyphens replacing non-alphanumeric characters. |

---

## G - CSV Template Download

| #   | Logic                                              | Explanation                                                                                           |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 27  | "Download Template" generates a blank CSV template | Filename: `balance-sheet_template_${YYYY-MM-DD}.csv`. Fields: `Account`, `Type`, `Amount`, `Details`. |
