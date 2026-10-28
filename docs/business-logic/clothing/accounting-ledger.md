# Clothing - Accounting: Ledger Business Logic

## Server Authorization And Posting Integrity

Accounting APIs, clothing expenses, and supplier/transit posting actions require
ADMIN or SUPER_ADMIN. Anonymous requests return 401 and other roles 403 before
business reads/writes. Page access and permission-driven controls agree with
the API; hiding a button is not authorization.

Product payment and required supplier settlement are atomic and retry by stable
keys. Posted transit sources cannot be changed/deleted beneath reclassification
or supplier settlement. Historical journals, logistics costs, and orphan COGS
are not automatically repaired. See [Products](operations-products.md) and
[Shipments](operations-shipments.md).

The runtime cutover reads only the requested module's saved date. Clothing does
not depend on the optional GM settings column. Missing settings still use the
module-specific environment value or the existing default date.

Explicit opening balances belong to Ledger's Opening Balance surface, not
Journal's period-activity rows. A cross-report bridge adds stored openings dated
inside the selected period to Journal activity before comparing Ledger movement;
openings before the period are brought forward, not repeated as current receipts.
X04 verifies an actual pre-cutover deposit200, explicit opening copied from that
verified closing, installment800, approval1000 and payout300: October Cash opens
at200, moves500 and closes700. Later approval/payout/physical return leave all
earlier report cutoffs unchanged, and the downloaded Cash ledger carries the same
true running balances. Only the owned synthetic fixture changes its cutover;
business and General Merchandise settings are not changed by this implementation.

> **Source files:**
>
> - `src/app/clothing/accounting/ledger/hooks/useLedger.ts`
> - `src/app/clothing/accounting/ledger/hooks/ledgerCsvHandlers.ts`
> - `src/app/clothing/accounting/ledger/hooks/ledgerDerivedData.ts`
> - `src/app/clothing/accounting/ledger/hooks/ledgerManualEntryForm.ts`
> - `src/app/clothing/accounting/ledger/hooks/ledgerOpeningEntryForm.ts`
> - `src/app/clothing/accounting/ledger/hooks/ledgerTransitBuildActions.ts`
> - `src/app/clothing/accounting/ledger/components/LedgerStatsCards.tsx`
> - `src/app/clothing/accounting/ledger/components/OpeningBalanceEntryModal.tsx`
> - `src/app/clothing/accounting/ledger/components/RecurringPaymentsPanel.tsx`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                  | Explanation                                                                       |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Four stat cards at the top                                             | Total Debits (blue), Total Credits (teal), Net Change (green), Accounts (violet). |
| 2   | Net Change: `totalDebits - totalCredits`                               | Selected-period movement, not an account closing balance.                         |
| 3   | Accounts: count of unique account names in the filtered ledger entries | Shows how many distinct accounts have activity.                                   |
| 4   | Data fetched via `GET /accounting/ledger?period=...`                   | Returns entries/stats plus authoritative `openingBalances` and `closingBalances`. |

---

## B - Period Filter & Account Filter

| #   | Logic                                                                                                                                                                                                                                                                                                                                                              | Explanation                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 5   | Period options include All Time, month/year-to-date, previous periods, rolling windows and explicit Full Calendar Year                                                                                                                                                                                                                                             | This Year is YTD, not a future December cutoff. Changing period fetches again. |
| 6   | Account filter includes period entries, brought-forward accounts and common accounts                                                                                                                                                                                                                                                                               | An account with only prior-period activity remains selectable.                 |
| 7   | Hardcoded common accounts always available in the filter: Cash, Accounts Receivable, Stock on Hand, Inventory in Transit, Landed Cost Clearing, Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable, Opening Equity, Owner Contribution, Owner Draw, Sales Revenue, Sales Returns, COGS, Inventory Shrinkage, Interest Expense | Ensures standard accounts are always filterable even with no data.             |
| 8   | Search filter: matches `ref`, `account`, or `description` (case-insensitive)                                                                                                                                                                                                                                                                                       | Applied client-side.                                                           |

---

## C - Running Balances

Legacy paid-transaction entries are suppressed only by payment events with a
finite, positive amount, regardless of the selected report period. Non-posting
zero, negative, or non-finite payment rows do not remove the legacy cash/revenue
entry. See the Journal contract for the shared report recognition rule.

| #   | Logic                                                                              | Explanation                                                                                               |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 9   | `buildLedgerPeriod()` computes opening, running and closing balances before search | Earlier eligible history is brought forward; each period line retains its true account balance.           |
| 10  | Client account/search filters preserve server balances and sort for display        | The legacy client fallback calculates before filtering; neither search nor CSV restarts balances at zero. |

The selected account shows opening balance, closing balance and period movement
separately. A prior-only account can have no visible lines and a nonzero closing
balance. CSV exports the same authoritative Balance as the table. The table has
a stable minimum width and contained horizontal scrolling on mobile, so headings
and monetary values do not overlap. The isolated browser regression checks a
100 opening, 25 receipt, 10 payout and 115 closing; searching for the receipt
still exports its 125 running balance, not a search-derived 25.

The Journal's dated customer-money/CARD contract applies unchanged here. Approval
and actual payouts remain distinct; Card Collections Clearing and Refunds
Payable are not folded into Cash or supplier Credit Card Payable.

Only the latest requested period/refresh may publish ledger rows, authoritative
balances, stats or errors. Late successes and failures from a superseded request
are ignored, including during effect cleanup. A real slow This Month response
previously replaced Last Month's 50 Cash with 550 while the control still said
Last Month. Deterministic regressions cover both response orders/errors in
Clothing and the GM shared consumer; the real period/filter/CSV sequence passes.

---

## D - Manual Journal Entry (via Ledger)

| #   | Logic                                                                                       | Explanation                                                                                                     |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 11  | "Add Entry" on the Ledger page opens `ManualJournalEntryModal`                              | Same component and behavior as the Journal module (see accounting-journal.md sections D–H).                     |
| 12  | Create: `POST /accounting/manual-journal`                                                   | Success: Mantine teal notification `{ title: 'Entry saved', message: '${debitAccount} / ${creditAccount}' }`.   |
| 13  | Update: `PUT /accounting/manual-journal`                                                    | Success: Mantine teal notification `{ title: 'Entry updated', message: '${debitAccount} / ${creditAccount}' }`. |
| 14  | Delete: `window.confirm()` native dialog → `DELETE /accounting/manual-journal?sourceId=...` | Success: Mantine green notification `{ title: 'Entry deleted', message: '${entry.ref}' }`.                      |

### Clothing guided entry and account choices

- The clothing Ledger opens manual entries in guided mode. Choose what happened, enter the transaction details, and review the debit and credit lines before saving. Manual mode remains available for other two-account entries.
- Guided manual recipes cover loan receipt, loan principal, loan interest, owner contributions, and owner withdrawals. Principal and interest are separate entries. Use the lender's breakdown and the same Loan Tag for the loan; do not guess the split.
- Supplier and inventory activity belongs in Products. Transit Build-Up is a separate action; changing an unpaid product to paid may post its Supplier Payable settlement when a matching transit build-up exists. Shipment delivery requires a separate reclassification action.
- Forwarder, courier, and packaging activity belongs in Shipments → Logistics Costs. That workflow tracks estimates, payable settlement, adjustments, and capitalization; do not repeat those entries from the generic Ledger form.
- The clothing manual-entry account selector omits Sales Revenue, Sales Returns, Customer Deposits, Forfeited Deposits, Supplier Payable, Payroll, COGS, and Inventory Shrinkage from new entries because these are derived from operational records or are not the account used by the current derived calculation. Stock on Hand and Inventory in Transit belong to Products and shipment reclassification; Landed Cost Clearing and logistics payables belong to Shipments → Logistics Costs; Opening Equity belongs to the Opening Balance tab. Sales Revenue timing follows transaction-payment and deposit-recognition rules, not a universal order-completion trigger. The Inventory Shrinkage report category is calculated from inventory movements; the current journal calculation posts the shrinkage offset to Retained Earnings and Stock on Hand.
- Hiding an account from new-entry suggestions does not remove it from the ledger, account filters, stored entries, or APIs. When editing an existing manual entry, its current account choices remain available. These selector choices are a workflow aid, not an authorization rule.
- Before recording a transaction manually, check whether its source workflow already generated ledger entries. Manual entries do not update the source transaction, refund, inventory, payroll, or shipment records.
- Cash represents cash, bank, and GCash equivalents in this workflow. Internal movements within that combined Cash account are not entered as Cash-to-Cash journals.

---

## E - Opening Balance Entry Modal

| #   | Logic                                                                                                                                       | Explanation                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 15  | Opening balance entries are fetched via `GET /accounting/opening-balance`                                                                   | Returns `{ entries: OpeningBalanceEntry[], cutoverDate?: string }`.                                                        |
| 16  | "Add Opening Entry" opens `OpeningBalanceEntryModal` in create mode                                                                         | Modal title: `'ADD OPENING ENTRY'`.                                                                                        |
| 17  | "Edit" on an opening entry opens the modal in edit mode                                                                                     | Modal title: `'EDIT OPENING ENTRY'`.                                                                                       |
| 18  | Date field is **disabled** and shows the server's configured `cutoverDate`                                                                  | All opening entries are posted on the cutover date; the user cannot change it.                                             |
| 19  | Reference (optional): TextInput; defaults to `'OPENING'`                                                                                    | Identifies the entry in the ledger.                                                                                        |
| 20  | Debit Account (required): Select; searchable, clearable                                                                                     | Must differ from Credit Account.                                                                                           |
| 21  | Credit Account (required): Select; searchable, clearable                                                                                    | Must differ from Debit Account.                                                                                            |
| 22  | Debit Tag / Credit Tag (conditional): shown when the selected account is a taggable parent                                                  | Same taggable parents as Journal: Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable. |
| 23  | Amount (required): NumberInput with ₱ prefix, minimum 0, no stepper controls                                                                | Must be > 0.                                                                                                               |
| 24  | Description (optional): Textarea, minimum 2 rows, autosize                                                                                  | Free-form.                                                                                                                 |
| 25  | Informational text on create: `'This creates two opening balance lines on {date} (one debit, one credit).'`                                 | Explains the double-entry nature.                                                                                          |
| 26  | Informational text on edit: `'This updates a balanced opening entry on {date} (one debit line, one credit line).'`                          |                                                                                                                            |
| 27  | Warning shown if editing a single-line entry: `'This looks like a single opening line. The editor expects a matching debit/credit pair...'` | Warns about potential imbalance.                                                                                           |
| 28  | Buttons: Cancel, `'Save Opening Entry'` (create) or `'Update Opening Entry'` (edit); with loading state                                     |                                                                                                                            |
| 29  | Validation: both accounts required, accounts must differ, amount > 0                                                                        | Errors shown as red Mantine notifications.                                                                                 |
| 30  | Create: `POST /accounting/opening-balance`                                                                                                  |                                                                                                                            |
| 31  | Update: `PUT /accounting/opening-balance`                                                                                                   |                                                                                                                            |
| 32  | Delete: `DELETE /accounting/opening-balance?id=...`                                                                                         |                                                                                                                            |

---

## F - Transit Build Actions

| #   | Logic                                                                                                                                                                                                                                             | Explanation                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 33  | Transit build-up entries originate from the inventory/shipment workflow and appear in the ledger                                                                                                                                                  | Identified by non-null `transitBuildShipmentId`.                                                    |
| 34  | **Edit Transit Build-Up**: SweetAlert2 dialog with an embedded HTML form                                                                                                                                                                          | Title: `'Edit transit build-up'`.                                                                   |
| 35  | Edit form fields: Posting date (required, date input), Amount (required, number step=0.01), Credit account (required, select)                                                                                                                     | Credit account options: Cash, Bank, E-Wallet, Accounts Payable, Forwarder Payable, Courier Payable. |
| 36  | Edit validation via `Swal.showValidationMessage()`: posting date required; amount must be >= 0 and finite; credit account required                                                                                                                | Shown inline in the SweetAlert2 dialog.                                                             |
| 37  | Edit save: `PATCH /accounting/transit-build` (or `PATCH /shipments/{shipmentId}/transit-build`) with `{ entryId, postingDate, amount, creditAccount }`                                                                                            |                                                                                                     |
| 38  | Edit success: Mantine green notification `{ title: 'Saved', message: 'Transit build-up entry updated.' }`                                                                                                                                         |                                                                                                     |
| 39  | Edit error: Mantine red notification `{ title: 'Save failed', message: 'Unable to update transit build-up entry.' }`                                                                                                                              |                                                                                                     |
| 40  | **Delete Transit Build-Up** (single entry): SweetAlert2 dialog — Title: `'Delete transit build-up?'`; Text: `'This will remove the transit build-up entry from the ledger.'`; icon: warning; confirm button: `'Delete'` (red); cancel: `'Cancel'` |                                                                                                     |
| 41  | **Delete Transit Build-Up** (grouped entries): SweetAlert2 dialog — same title; Text: `'This will remove all grouped transit build-up entries from the ledger.'`                                                                                  |                                                                                                     |
| 42  | Delete: `DELETE /accounting/transit-build?entryId=...`                                                                                                                                                                                            |                                                                                                     |
| 43  | Delete success: Mantine green notification `{ title: 'Deleted', message: 'Transit build-up entry deleted.' }`                                                                                                                                     |                                                                                                     |
| 44  | Delete error: Mantine red notification `{ title: 'Delete failed', message: 'Unable to delete transit build-up entry.' }`                                                                                                                          |                                                                                                     |

---

## G - Recurring Payments Panel

| #   | Logic                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Explanation                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 45  | Recurring Payments Panel has two sub-sections: Templates table and Drafts table                                                                                                                                                                                                                                                                                                                                                                              | Switch between views via tab.                                                                          |
| 46  | Templates table columns: Name, Kind (LOAN or EXPENSE badge), Amount, Accounts (`${debitLabel} → ${creditLabel}`), Ref preview (`RECURRING:${name}`), Description, Next Due, End, Payments Left, Status (active/inactive Switch)                                                                                                                                                                                                                              |                                                                                                        |
| 47  | Drafts table columns: Due date, Template name, Amount, Debit account, Credit account, Ref, Description, Status badge (Draft/Approved/Skipped), Approve button (green), Skip button (gray)                                                                                                                                                                                                                                                                    |                                                                                                        |
| 48  | Date filter on Drafts: DateInput `'Show drafts due on or before'`                                                                                                                                                                                                                                                                                                                                                                                            | Filters the drafts to a specific due-date cutoff.                                                      |
| 49  | **"Generate drafts"** button (with refresh icon, loading state): calls `generate({ upToDate })`                                                                                                                                                                                                                                                                                                                                                              | Sends `POST /accounting/recurring-payments/generate` (or similar).                                     |
| 50  | Generate success: Mantine notification `'Generated {count} drafts ({skipped} skipped)'` — green if no errors, yellow if partial errors                                                                                                                                                                                                                                                                                                                       |                                                                                                        |
| 51  | **"New template"** button (green, + icon): opens Create Template modal                                                                                                                                                                                                                                                                                                                                                                                       |                                                                                                        |
| 52  | Create Template form fields: Name (required), Kind (required — `'Loan (principal only)'` or `'Expense / Subscription'`), Amount (required, min=0), Day of Month (required, 1–31), Next Due Date (required), End Date (optional, clearable), Debit Account (required), Debit Tag (optional, disabled if not taggable), Credit Account (required), Credit Tag (optional, disabled if not taggable), Description (optional), Active (Switch toggle, default on) |                                                                                                        |
| 53  | Day of Month field description: `'Used to compute the next due date after generation'`                                                                                                                                                                                                                                                                                                                                                                       |                                                                                                        |
| 54  | Create Template save: calls `createTemplate(payload)`                                                                                                                                                                                                                                                                                                                                                                                                        | Notification on success/error.                                                                         |
| 55  | Edit Template: clicking a template row opens edit modal pre-filled                                                                                                                                                                                                                                                                                                                                                                                           | Calls `updateTemplate(id, payload)`.                                                                   |
| 56  | Delete Template: calls `deleteTemplateById(id)`                                                                                                                                                                                                                                                                                                                                                                                                              | Notification on success/error.                                                                         |
| 57  | Toggle template Active status via the row Switch                                                                                                                                                                                                                                                                                                                                                                                                             | Calls `updateTemplate(id, { active: newValue })`; error notification if fails.                         |
| 58  | **Approve draft**: clicking Approve calls `approveDraft(draftId)`                                                                                                                                                                                                                                                                                                                                                                                            | Success: Mantine green notification `'Draft approved and posted to ledger'`. Ledger data is refreshed. |
| 59  | **Skip draft**: clicking Skip calls `skipDraft(draftId)`                                                                                                                                                                                                                                                                                                                                                                                                     | Success: Mantine gray notification `'Draft skipped'`.                                                  |

---

## H - CSV Export

| #   | Logic                                                                                                                   | Explanation                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 60  | Export CSV exports the current filtered ledger entries                                                                  | Called via `exportLedgerCsv`.                 |
| 61  | Exported headers: Date, Ref, Account, Debit, Credit, Description, Source Type, Source Id, Source Line, System Generated | `systemGenerated` shown as `'yes'` or `'no'`. |
| 62  | Filename: `ledger_${YYYY-MM-DD}.csv`                                                                                    | Uses `getCurrentDateISO()`.                   |

---

## I - CSV Import

| #   | Logic                                                                                       | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 63  | Import CSV parsed via `parseManualEntryCsv(text)` (same as Journal import)                  | Each row posted individually to `POST /accounting/manual-journal`. |
| 64  | Maximum file size: 5 MB; maximum rows: 1,000                                                | Skipped rows tracked.                                              |
| 65  | On completion: Mantine notification `'Ledger import complete'` with counts and skipped rows |                                                                    |
| 66  | On error: Mantine notification `'Import failed'`                                            |                                                                    |

---

## J - CSV Template Download

| #   | Logic                                              | Explanation                                                                                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 67  | "Download Template" generates a blank CSV template | Filename: `ledger_template_${YYYY-MM-DD}.csv`. Fields: `date`, `amount`, `ref`, `debitAccount`, `creditAccount`, `description`. |
