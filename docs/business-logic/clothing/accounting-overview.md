# Clothing - Accounting Module Overview

This overview indexes the business logic documentation files for the **Clothing > Accounting** module.

Employees use the [Master SOP Manual](operations-workflow.md), accounting
interpretation lives in the [policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md),
and the [current reconciliation report](../../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)
owns execution evidence and open financial findings. A developer contract is not
a second employee procedure or proof of deployed behavior.

> **Source root:** `src/app/clothing/accounting/`
> **Docs root:** `docs/business-logic/clothing/`

---

## Module Index

Investor profiles, agreements, projected returns, and bank closures are documented in [Investors](accounting-investors.md). Confirmed funding, monthly returns, and principal repayment post to the Clothing journal, ledger, and balance sheet. Posted return expenses also appear in P&L totals and details; historical records require reconciliation before posting.

| Module        | Doc File                                                   | Description                                                                                                            |
| ------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Expenses      | [accounting-expenses.md](accounting-expenses.md)           | Expense lifecycle and actual-cost entries; payment-date and paid-deletion findings remain unresolved.                  |
| Journal       | [accounting-journal.md](accounting-journal.md)             | Dated double-entry events, source identity, protected dependencies and exports.                                        |
| Ledger        | [accounting-ledger.md](accounting-ledger.md)               | Brought Forward, Period Movement and Closing Balance, paired openings, protected source events and recurring payments. |
| Balance Sheet | [accounting-balance-sheet.md](accounting-balance-sheet.md) | As-of assets, liabilities, equity, separate supplier credits/refund obligations and comparison limits.                 |
| Profit & Loss | [accounting-profit-loss.md](accounting-profit-loss.md)     | Revenue/COGS/expense windows, actual lot costs, completeness and dated correction rules.                               |

---

## Key Technical Notes

### Reservation Deposit Vocabulary

The [operating workflow](operations-workflow.md#31-reservation-deposit-terminology-and-allocation)
records the user-confirmed deposit rules (2026-10-26). **Reservation Deposit** is
the customer-facing payment; **Customer Deposits** is the accounting account
holding those same funds before recognition, refund, or forfeiture. They are not
two receipts. No separate **Reservation Fee** is collected. Deposits reduce the
remaining balance per transaction/product code, rather than being an unallocated
customer-wide deduction. Use the workflow's completion-deadline and refund-
exception rules. The implemented deadline is the end of the third Manila
calendar day after the invoice date; fully paid orders are excluded and
cancellation remains manual. Historical dates and late/revised invoices still
need review, not an automatic new deadline or cancellation.

### Existing Technical Behavior

Confirmed whole-product supplier credit is an asset, not Cash or a refund of the
original card payment. The
[supplier-resolution workflow](operations-products.md#supplier-nonfulfillment-and-future-purchase-credit)
posts Dr Supplier Credits / Cr Inventory in Transit; application funds a new
purchase at gross cost, split between the credit and remaining actual funding or
Supplier Payable. These system journals/product sources feed the existing journal,
ledger and balance sheet; unused credit stays in Supplier Credits. No sale or
expense is invented by issuance/application. This clothing-only workflow does
not use the Shipping Fee Calculator and does not certify historical balances.

- **Accounting route entry**: `/clothing/accounting` renders the Accounting overview dashboard (`AccountingDashboardRoutePage` in `src/app/accounting/_shared/`). It defaults to Year to date and shows KPI cards (revenue, gross profit, net profit and operating expenses with change vs the previous comparable period, gross/net margin, Cash balance), a 12-month P&L trend, operating expenses by category (COGS excluded), a profit snapshot, balance sheet totals with a balanced/out-of-balance badge, top asset accounts, a monthly summary table and quick links. It is read-only and reuses the existing `/api/accounting/profit-loss`, `/profit-loss/details` (last 12 months only) and `/balance-sheet` endpoints, so figures match the P&L and Balance Sheet pages. "Operating expenses" = P&L `expenseTotal - cogsTotal` (includes inventory shrinkage). "Cash" is the `Cash` account only, not payment-method accounts.
- **Legacy ledger route**: `/clothing/ledger` now redirects to `/clothing/accounting`; route-level navigation changes should be reflected in the accounting docs when this behaviour changes.
- **Double-entry accounting**: All journal and ledger entries are balanced debit/credit pairs. Manual entries always create two lines.
- **Account tagging**: Five accounts support sub-tags: Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable. Tagged accounts post as `"{Account} – {Tag}"` in the ledger.
- **Opening balance cutover date**: All opening entries are posted on a server-configured cutover date; users cannot change the date.
- **Balance sheet sign convention**: Liabilities and Equity are stored as negative values internally; the UI negates them for display so they appear as positive numbers.
- **Ledger running balance**: The API computes actual per-account balances from accounting inception, returning selected-period rows plus opening/closing balances. Period activity totals exclude prior history; search/account filtering and CSV retain the authoritative row balance. The UI distinguishes Brought Forward, Period Movement and Closing Balance.
- **Transit build-up entries**: Created through explicit source-owned workflows. Active reclass, supplier settlement and credit/application dependencies block incompatible edit/delete/restore; a Ledger dialog is not authority to bypass those guards.
- **Recurring payments**: Templates define recurring expense or loan payment schedules; drafts are generated and individually approved (posting to ledger) or skipped.
- **P&L formulas**: `Gross Profit = Revenue - COGS`; `Net Profit = Revenue - All Expenses (including COGS)`.
- **Expense source filtering**: Expenses with `sourceType === 'PRODUCT'` or `'SHIPMENT'` are excluded from operational expense views (shown only in source-specific contexts).
- **Shared accounting period options**: All Time, This Month (month to date), Last Month (complete), Last 30 Days, This Year (year to date) and explicit Full Calendar Year. The dashboard labels This Year as Year to date and compares it with the same Manila dates last year. Full Calendar Year deliberately spans January through December with a full prior-year comparison; balance-sheet/refund snapshots still stop at today, not a projected future year-end. BI's separate filters are documented in its own contract.

### Approved Customer Money And CARD Recognition

Clothing cancellation approval creates a noncash Refunds Payable obligation,
releasing Customer Deposits/receivables and separately recognizing any approved
retained original deposit. Actual partial/full payouts debit that liability and
credit Cash. Immutable pre-cancellation status snapshots preserve original
receipt/invoice sources. Reports use event dates, not merely current status;
before-invoice non-reservation receipts already recognized as revenue are not
recognized a second time by the invoice. Reservation deposits apply to A/R on
recognition without leaving a duplicate deposit liability.

Incoming CARD debits Card Collections Clearing (an Asset), not Cash or outgoing
Credit Card Payable. The manual ledger has actual card-settlement and processing-
fee presets; settlement transfers the amount to Cash and actual fees are separate
dated expenses. These presets do not create another customer receipt or an
automatic processor integration. Historical CARD receipts retain their asset
classification through cancellation/forfeiture.

Both refund reminders, Customers, accounting dashboard and BI share dated
approval/payout totals. Pending liability and paid refunds remain distinct from
Cash. BI's approved-retention total is explicitly labelled and is not a claim
that all legacy forfeitures are reconciled. See the current
[implementation evidence](../../../plan.md#current-lifecycle-and-reporting-implementation-evidence)
for actual tests, rollout prerequisites and remaining cross-report proof.

---

## Soft-delete semantics (added 2026-04-19)

The four accounting persistence models now carry a nullable `deletedAt`
column with an index on the column:

- `ClothingAccountingJournalLine`
- `ClothingAccountingOpeningBalance`
- `GeneralMerchandiseAccountingJournalLine`
- `GeneralMerchandiseAccountingOpeningBalance`

Read paths in this domain (ledger view, balance sheet, manual journal
in-place lookup, recurring-payments existing-line guard) filter
`deletedAt: null`, so a soft-deleted row is invisible to:

- the running-balance computation,
- the opening-balance read used by the balance sheet, and
- the "do we already have a posting for this period?" guard used by
  recurring payments.

DELETE handlers now perform a **soft delete** (updated 2026-04-19,
IMPROVEMENTS_CHECKLIST.md §1.2 follow-up). Specifically:

- The manual-journal DELETE route adapter
  (`src/modules/shared/ledger/manual-journal/api/routeAdapter.ts`) calls
  `updateMany({ where, data: { deletedAt: new Date() } })` when the
  Prisma delegate exposes `updateMany`, falling back to `deleteMany`
  only for delegates that do not.
- The opening-balance DELETE route adapter
  (`src/modules/shared/ledger/opening-balance/api/routeAdapter.ts`)
  calls `update({ where: { id }, data: { deletedAt: new Date() } })`
  when the delegate exposes `update`, falling back to `delete`
  otherwise.

Lifecycle: a delete request **tombstones** the row (sets `deletedAt`)
rather than removing it. All read paths listed above filter
`deletedAt: null`, so the row immediately disappears from the running
balance, balance-sheet opening totals, manual-journal lookups, and the
recurring-payments existing-line guard — but the underlying record
remains queryable for audit/restore. Hard deletion is no longer the
default behavior on these four accounting models.

> **Float → Decimal precision**: tracked separately under
> IMPROVEMENTS_CHECKLIST.md §1.1. Until that migration lands, monetary
> values in this module are stored as `Float` and any user-facing
> rounding behavior described in the per-page docs (e.g. 2-decimal
> display, balance-sheet sign convention) reflects the current
> floating-point representation.
