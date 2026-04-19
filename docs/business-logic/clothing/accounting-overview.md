# Clothing - Accounting Module Overview

This overview indexes the business logic documentation files for the **Clothing > Accounting** module.

> **Source root:** `src/app/clothing/accounting/`
> **Docs root:** `docs/business-logic/clothing/`

---

## Module Index

| Module        | Doc File                                                   | Rules | Description                                                                                                                                                                                                                        |
| ------------- | ---------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expenses      | [accounting-expenses.md](accounting-expenses.md)           | 50    | Expense tracking: add/edit/approve/reject/delete, status lifecycle (pending/approved/rejected/paid), receipt upload, category color mapping, CSV import/export with validation.                                                    |
| Journal       | [accounting-journal.md](accounting-journal.md)             | 45    | Double-entry journal: manual entry modal, taggable accounts (Accounts Payable, Loan Payable, etc.), period filter, delete via native `window.confirm()`, CSV import/export.                                                        |
| Ledger        | [accounting-ledger.md](accounting-ledger.md)               | 67    | Full general ledger: running balances, manual entries, opening balance entry modal (cutover date), transit build-up edit/delete (SweetAlert2), recurring payments panel (templates + drafts with approve/skip), CSV import/export. |
| Balance Sheet | [accounting-balance-sheet.md](accounting-balance-sheet.md) | 27    | Snapshot balance sheet at any date: Assets/Liabilities/Equity display with sign inversion, Cash/Stock/Transit breakdown sub-tables with unclassified delta tracking, balance checks.                                               |
| Profit & Loss | [accounting-profit-loss.md](accounting-profit-loss.md)     | 29    | P&L summary and details: Revenue/COGS/Expense/Net Profit stat cards, breakdowns chart (daily/weekly/monthly/quarterly/yearly), previous period compare overlay, bucket drill-down table, CSV export.                               |

---

## Key Technical Notes

- **Accounting route entry**: `/clothing/accounting` is a root entry route that resolves into the Clothing accounting experience rather than being a self-contained page implementation.
- **Legacy ledger route**: `/clothing/ledger` now redirects to `/clothing/accounting`; route-level navigation changes should be reflected in the accounting docs when this behaviour changes.
- **Double-entry accounting**: All journal and ledger entries are balanced debit/credit pairs. Manual entries always create two lines.
- **Account tagging**: Five accounts support sub-tags: Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable. Tagged accounts post as `"{Account} – {Tag}"` in the ledger.
- **Opening balance cutover date**: All opening entries are posted on a server-configured cutover date; users cannot change the date.
- **Balance sheet sign convention**: Liabilities and Equity are stored as negative values internally; the UI negates them for display so they appear as positive numbers.
- **Ledger running balance**: Computed client-side by sorting entries ascending by date and maintaining a cumulative per-account sum.
- **Transit build-up entries**: Created by the inventory/shipment workflow; editable/deletable via SweetAlert2 dialogs in the Ledger page.
- **Recurring payments**: Templates define recurring expense or loan payment schedules; drafts are generated and individually approved (posting to ledger) or skipped.
- **P&L formulas**: `Gross Profit = Revenue - COGS`; `Net Profit = Revenue - All Expenses (including COGS)`.
- **Expense source filtering**: Expenses with `sourceType === 'PRODUCT'` or `'SHIPMENT'` are excluded from operational expense views (shown only in source-specific contexts).
- **Period options (all modules)**: All Time, This Month, Last Month, This Year, Last Year, Last 30 Days, Last 90 Days.

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
