# General Merchandise - Accounting Module Overview

This overview indexes the business logic documentation files for the **General Merchandise > Accounting** module.

> **Source root:** `src/app/general-merchandise/accounting/`
> **Docs root:** `docs/business-logic/general-merchandise/`

---

## Module Index

| Module        | Doc File                                                   | Rules | Description                                                                                                                                                |
| ------------- | ---------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expenses      | [accounting-expenses.md](accounting-expenses.md)           | 18    | Shared expense workflow with stats cards, list/analytics tabs, filters, import/export/template actions, modal form, receipt viewer, and GM persistence.    |
| Journal       | [accounting-journal.md](accounting-journal.md)             | 13    | Shared journal workflow with stats cards, account/period filters, import/export/template actions, and manual-entry modal under GM APIs.                    |
| Ledger        | [accounting-ledger.md](accounting-ledger.md)               | 24    | Shared ledger workflow with tabbed panels, opening balances, help, recurring payments, import/export actions, manual-entry modals, and GM recurring logic. |
| Balance Sheet | [accounting-balance-sheet.md](accounting-balance-sheet.md) | 12    | Shared balance-sheet workflow with stats cards, summary/cash/stock/transit tabs, search/as-of controls, and export/template actions.                       |
| Profit & Loss | [accounting-profit-loss.md](accounting-profit-loss.md)     | 11    | Shared P&L workflow with stats cards, summary/details controls, export actions, template download, and GM-only breakdown-tab suppression.                  |

---

## Key Technical Notes

- **Accounting route entry**: `/general-merchandise/accounting` delegates to `AccountingRootRedirectPage` and resolves into the GM accounting experience rather than rendering a standalone page.
- **Shared route UI**: Journal, Ledger, Balance Sheet, Profit & Loss, and Expenses pages are GM wrappers around shared accounting route pages with GM-specific services or API namespace.
- **Recurring payments**: GM ledger behavior includes a dedicated recurring payment service with GM models, draft generation, approval, skip behavior, and journal posting.
- **Expense persistence**: GM expenses use a dedicated repository and service layer built on shared expense base classes with GM Prisma model binding.
- **Product accounting automation**: Some GM accounting behavior is triggered from the GM product service, especially manual transit build-up entries and supplier settlement journal automation.

---

## Soft-delete semantics (added 2026-04-19)

The four accounting persistence models now carry a nullable `deletedAt`
column with an index on the column:

- `ClothingAccountingJournalLine`
- `ClothingAccountingOpeningBalance`
- `GeneralMerchandiseAccountingJournalLine`
- `GeneralMerchandiseAccountingOpeningBalance`

Read paths in the GM accounting domain (ledger view, balance sheet,
manual journal in-place lookup) filter `deletedAt: null`, so a
soft-deleted row is invisible to the running-balance computation, the
opening-balance read used by the balance sheet, and the in-place lookup
used by the manual-journal route adapter.

DELETE handlers now perform a **soft delete** (updated 2026-04-19,
IMPROVEMENTS_CHECKLIST.md §1.2 follow-up). The shared manual-journal
and opening-balance route adapters used by the GM accounting routes
(`src/modules/shared/ledger/manual-journal/api/routeAdapter.ts` and
`src/modules/shared/ledger/opening-balance/api/routeAdapter.ts`) now
tombstone rows by setting `deletedAt = new Date()` via `updateMany` /
`update`, falling back to hard deletes only for Prisma delegates that
do not expose those methods.

Lifecycle: a delete request **tombstones** the row rather than
removing it. Because the read paths listed above already filter
`deletedAt: null`, the row immediately disappears from the GM
running-balance computation, the GM balance-sheet opening totals, and
the in-place manual-journal lookup, while remaining queryable in the
database for audit/restore.

> **Float → Decimal precision**: tracked separately under
> IMPROVEMENTS_CHECKLIST.md §1.1. Until that migration lands, monetary
> values in this module are stored as `Float` and any user-facing
> rounding behavior described in the per-page docs reflects the
> current floating-point representation.
