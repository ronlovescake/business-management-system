# Clothing - Accounting: Ledger Business Logic

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
| 2   | Net Change: `totalDebits - totalCredits`                               | Shown as currency; represents net position over the selected period.              |
| 3   | Accounts: count of unique account names in the filtered ledger entries | Shows how many distinct accounts have activity.                                   |
| 4   | Data fetched via `GET /accounting/ledger?period=...`                   | Returns `{ entries: LedgerEntry[], stats: LedgerStats }`.                         |

---

## B - Period Filter & Account Filter

| #   | Logic                                                                                                                                                                                                                                                                                                                                                              | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 5   | Period options: `All Time`, `This Month`, `Last Month`, `This Year`, `Last Year`, `Last 30 Days`, `Last 90 Days`                                                                                                                                                                                                                                                   | Changing period triggers a new fetch.                              |
| 6   | Account filter: dropdown of all unique accounts from entries plus a hardcoded common account list                                                                                                                                                                                                                                                                  | Shows `all` or filters to a single account.                        |
| 7   | Hardcoded common accounts always available in the filter: Cash, Accounts Receivable, Stock on Hand, Inventory in Transit, Landed Cost Clearing, Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable, Opening Equity, Owner Contribution, Owner Draw, Sales Revenue, Sales Returns, COGS, Inventory Shrinkage, Interest Expense | Ensures standard accounts are always filterable even with no data. |
| 8   | Search filter: matches `ref`, `account`, or `description` (case-insensitive)                                                                                                                                                                                                                                                                                       | Applied client-side.                                               |

---

## C - Running Balances

| #   | Logic                                                                                                                   | Explanation                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 9   | `computeRunningBalances()` adds a `balance` field to each entry                                                         | Entries sorted by date ascending; running cumulative sum per account.      |
| 10  | `filterAndSortLedgerEntries()` applies account/search filters, computes running balances, then sorts descending by date | The displayed table shows newest entries first with their running balance. |

---

## D - Manual Journal Entry (via Ledger)

| #   | Logic                                                                                       | Explanation                                                                                                     |
| --- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 11  | "Add Entry" on the Ledger page opens `ManualJournalEntryModal`                              | Same component and behavior as the Journal module (see accounting-journal.md sections D–H).                     |
| 12  | Create: `POST /accounting/manual-journal`                                                   | Success: Mantine teal notification `{ title: 'Entry saved', message: '${debitAccount} / ${creditAccount}' }`.   |
| 13  | Update: `PUT /accounting/manual-journal`                                                    | Success: Mantine teal notification `{ title: 'Entry updated', message: '${debitAccount} / ${creditAccount}' }`. |
| 14  | Delete: `window.confirm()` native dialog → `DELETE /accounting/manual-journal?sourceId=...` | Success: Mantine green notification `{ title: 'Entry deleted', message: '${entry.ref}' }`.                      |

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
