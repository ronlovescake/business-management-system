# General Merchandise Accounting Improvements

## General Merchandise accounting improvements (Balance Sheet / Ledger / P&L)

- **Reservation deposits support (end-to-end)**
  - Added `isReservation` flag for GM transaction payments (GM-only UI checkbox in “Record Payments” modal + API + DB).
  - Accounting treatment: reservation payments post to **Customer Deposits** (liability), not revenue.

- **Deposit reclassification rules**
  - Completion: reclass **Customer Deposits → Sales Revenue**.
  - Cancellation: reclass **Customer Deposits → Forfeited Deposits** (the P&L category chosen).
  - Cancellation recognition date uses cancellation status-change timestamp (fallback `updatedAt`) to avoid cross-month issues.

- **GM Sales Revenue correctness**
  - Fixed GM P&L “Sales Revenue” being understated when payment events existed but were incomplete (cash-basis preference caused revenue < gross sale).
  - Added and ran a dry-run-by-default “top-up” fixer to create missing payment events so payment totals match gross sale for “paid” transactions.

- **Ledger/Journaling reliability**
  - Fixed an issue where some GM reclass journal entries were unreachable in the GM ledger route.
  - Strengthened GM accounting endpoints with extensive unit tests (ledger, journal, profit-loss, profit-loss details, balance sheet).

- **Balance sheet Cash diagnostics (big usability improvement)**
  - Enhanced GM balance sheet response to include a `details` breakdown for the `Cash` row, showing the main drivers (capped list with an “Other (n)” rollup).
  - Cash details capture items like opening balances, inventory reclass/transit build, sales cash received, reservation deposits (open/forfeited), refunds, expenses (with category + payment method), and manual journals.

## GAAP alignment notes

### Closer to GAAP (what improved)

- **Unearned revenue handling:** Reservation/deposit receipts now go to **Customer Deposits** (liability) instead of **Sales Revenue**. This reflects the idea that cash received ≠ revenue until earned.
- **Revenue recognition timing:** Revenue is recognized on **completion/delivery** (when the sale is earned), not automatically when a deposit is taken.
- **Separate treatment for cancellations:** Deposits that become non-refundable are recognized as **Forfeited Deposits** rather than inflating Sales Revenue, which improves statement clarity.
- **Better auditability:** Cash `details` on the balance sheet makes the Cash number traceable back to the major drivers.

### Still not fully GAAP (what remains)

- **Inventory & COGS method** is simplified/operational (lot/batch costing by shipment). This can be GAAP-consistent if applied consistently, but full GAAP would also cover write-downs, shrink, cutoff procedures, etc.
- **AR / partial payments:** This refers to GM Transactions where the payment status is not **Paid** yet (e.g., Pending/Prepared) but a partial customer payment has been recorded. Cash can increase even though the sale may not be recognized as revenue yet; full GAAP would typically book the offset as **Accounts Receivable** (if delivered/earned) or **Customer Deposits** (if not yet earned), depending on whether the performance obligation is satisfied.
- **Period close rigor** (cutoffs, reversals, adjustments, formal journal controls) isn’t the same as a full accounting system—this is an internal operational ledger.
