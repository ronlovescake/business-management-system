# Clothing - Accounting: Balance Sheet Business Logic

> **Source files:**
>
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

| #   | Logic                                                            | Explanation                                                                                                                       |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 7   | Data fetched via `GET /accounting/balance-sheet?asOf=YYYY-MM-DD` | The `asOf` parameter uses date-only format (not a full ISO timestamp).                                                            |
| 8   | Date-only format ensures server-side end-of-day clamping         | Passing a full ISO timestamp would cut off same-day transactions; `YYYY-MM-DD` captures all transactions through end of that day. |
| 9   | Default `asOf` is today's date                                   | User can change it to view a historical snapshot.                                                                                 |

---

## C - Balance Sheet Data Model

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

The balance-sheet API applies signed net movement-based COGS from cutover through
the as-of date. Positive COGS reduces Stock on Hand and equity; negative net COGS
(for example, a return of goods sold before cutover) restores Stock on Hand and
reverses the corresponding equity reduction. The stock breakdown includes the
same signed adjustment. Zero net COGS adds no adjustment. This preserves the
existing inventory movement return treatment; it does not revalue historical
cost snapshots or change scrap accounting.

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

| #   | Logic                                            | Explanation                                                                                                   |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| 24  | Export CSV exports all balance sheet rows        | Calls `handleExportCSV`.                                                                                      |
| 25  | Exported headers: Account, Type, Amount, Details | `Details` column formatted as `${label}: ${amount}                                                            | ${label}: ${amount} | ...`; empty string if no details. |
| 26  | Filename: `balance-sheet-${sanitizedAsOf}.csv`   | `sanitizedAsOf` is the `asOf` date converted to lowercase with hyphens replacing non-alphanumeric characters. |

---

## G - CSV Template Download

| #   | Logic                                              | Explanation                                                                                           |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 27  | "Download Template" generates a blank CSV template | Filename: `balance-sheet_template_${YYYY-MM-DD}.csv`. Fields: `Account`, `Type`, `Amount`, `Details`. |
