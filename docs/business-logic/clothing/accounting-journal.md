# Clothing - Accounting: Journal Business Logic

> **Source files:**
>
> - `src/app/clothing/accounting/journal/hooks/useJournal.ts`
> - `src/app/clothing/accounting/components/ManualJournalEntryModal.tsx`
> - `src/app/clothing/accounting/journal/components/JournalStatsCards.tsx`

---

## A - Page Layout & Stat Cards

| #   | Logic                                                                          | Explanation                                                                                                                                          |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Four stat cards at the top of the page                                         | Total Debits (blue), Total Credits (teal), Net Change (green/red), Entries This Month (violet).                                                      |
| 2   | Net Change: `totalDebits - totalCredits`                                       | Displayed in green when positive, red when negative.                                                                                                 |
| 3   | Entries This Month: count of entries with `date` in the current calendar month | Integer count, not currency.                                                                                                                         |
| 4   | Data fetched via `GET /accounting/journal?period=...`                          | Returns `{ entries: JournalEntry[], stats: JournalStats }`. Stats (totalDebits, totalCredits, netChange, entriesThisMonth) are computed server-side. |

The API stats describe its dated result before client search/account filters.
The UI deliberately totals the visible filtered rows; its matching CSV exports
that subset. A Cash plus Reservation Deposit filter showed debit 200/credit 0,
and a no-match search showed zero cards. Clearing filters restored period
totals. This differs from Ledger closing balances and Balance Sheet statement
cards, which must not be redefined by search. Compare identical scopes.

---

## B - Period Filter

| #   | Logic                                                                                                            | Explanation                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5   | Period options: `All Time`, `This Month`, `Last Month`, `This Year`, `Last Year`, `Last 30 Days`, `Last 90 Days` | Sent as a query parameter to `GET /accounting/journal?period=...`. |
| 6   | Changing the period filter triggers a new API fetch                                                              | Cached per period; `staleTime` applies.                            |

---

## C - Journal Entry Data Model

### Dated Customer Money And CARD Events

The requesting business/project owner approved these rules for new Clothing
events. The owning services are
[customer-money](../../../src/lib/accounting/customer-money.ts),
[keyed financial requests](../../../src/lib/accounting/financial-transactions.ts)
and [dated recognition](../../../src/lib/accounting/transaction-recognition.ts).
They apply to direct/bulk collections, cancellation approval and actual payouts;
generic order edits, imports and deletion cannot replace those event boundaries.

- Real receipts remain on their payment dates after cancellation. Before the
  invoice/shipment recognition date, a Reservation Deposit credits Customer
  Deposits and ordinary installments retain their original revenue treatment.
  A/R recognition applies the deposit once and subtracts already-recognized
  installment revenue; later A/R collections are not additional sales.
- An administrator records paid cancellation or supplier-failure approval as a
  noncash event. The immutable snapshot separately records unpaid A/R credit,
  retained original deposit and approved Refunds Payable. Supplier-failure
  Voided retains zero. Unknown original terms must be confirmed before retention.
- An actual partial payout debits Refunds Payable and credits its money account
  on the actual payment date. It creates an immutable payout/refund link and
  conditionally reduces pending once. Approval, payout and physical goods return
  are separate events; approval never posts Cash or automatically restores stock.
- Incoming CARD debits Card Collections Clearing, an unsettled asset, not Cash
  or outgoing Credit Card Payable. Record actual settlement and fees separately;
  outgoing credit-card supplier/expense behavior is unchanged.
- UUID request keys, payload fingerprints, Serializable execution and bounded
  conflict retry protect new financial operations. An identical replay returns
  the saved result; changed details conflict. An injected failure rolls back
  request, events, journal and pending together. Existing overpayments and legacy
  forfeitures are not erased or guessed into the new workflow.

The actual disposable-DB scenario in
[lifecycle integration tests](../../../tests/integration/clothing-customer-money.integration.test.ts)
reconciles journal, ledger, P&L summary/details and balance sheet at historical
cutoffs. For a 1,000 order with 100 deposit and 300 installment, A/R is 600;
retaining 100 and approving 300 removes the A/R without changing Cash. An actual
100 payout alone reduces Cash and pending by 100. Ordinary goods refunds retain
their separate existing policy; no customer-returned-refund workflow is added.

Payment events replace the legacy paid-transaction cash/revenue fallback only
when at least one payment has a finite, positive amount. Zero, negative, and
non-finite payment amounts produce no payment posting and do not suppress that
fallback. Positive payments outside the selected date range still suppress the
fallback, so changing the period does not count the same receipt twice. The same
rule applies to the Ledger and P&L summary/details APIs.

Reservation-deposit application compares payment calendar dates through the
recognition day's Manila end-of-day, using the existing shared date helper.
It must not compare a UTC-midnight payment bucket directly with an earlier UTC
instant on the same Manila day. A 200 deposit dated October 28 applies to
fulfillment at October 27 18:56 UTC (October 28 Manila); a deposit dated October
29 does not. Ledger, Journal and P&L summary/details share this boundary. Stored
receipt/fulfillment dates and amounts are unchanged.

| #   | Logic                                                                                                                                                  | Explanation                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 7   | Each journal entry has: `id`, `date`, `ref`, `account`, `debit`, `credit`, `description`, `sourceType`, `sourceId`, `sourceLineKey`, `systemGenerated` | `sourceType` indicates the origin: MANUAL, PAYROLL, SHIPMENT, etc. |
| 8   | `systemGenerated = true` marks entries auto-created by other modules (e.g. payroll, inventory)                                                         | These entries cannot be edited or deleted by users.                |

---

## D - Add / Edit Manual Journal Entry

| #   | Logic                                                                                                        | Explanation                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 9   | "Add Entry" button opens `ManualJournalEntryModal` in create mode                                            | Modal title: `'Add Entry'`.                                                                                |
| 10  | Clicking an editable entry opens the modal pre-filled                                                        | Modal title: `'Add Entry'` (same; edit mode detected by `sourceId` presence).                              |
| 11  | Date (required): DateInput with `minDate = 2026-01-01`                                                       | Entries before this date are rejected.                                                                     |
| 12  | Reference (required): TextInput; placeholder `'e.g., PAYMENT • Jeh Aguisanda'`                               | Used in the ledger `ref` column.                                                                           |
| 13  | Debit Account (required): Select from account options list; searchable                                       | See account list in section E.                                                                             |
| 14  | Credit Account (required): Select from account options list; searchable                                      | Must differ from Debit Account.                                                                            |
| 15  | Debit Tag (conditional): TextInput shown only when Debit Account is a taggable parent                        | Taggable parents: Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable. |
| 16  | Credit Tag (conditional): TextInput shown only when Credit Account is a taggable parent                      | Same taggable parent list.                                                                                 |
| 17  | Tag helper text for Loan Payable: `'This will post to "Loan Payable – <Loan>" on the ledger.'`               | Shown beneath the tag input.                                                                               |
| 18  | Tag helper text for other taggable accounts: `'This will post to "{parent} – <Vendor / AP>" on the ledger.'` | `{parent}` is the selected account name.                                                                   |
| 19  | Amount (required): NumberInput with thousand separators, 2 decimal places, hides stepper controls            | Must be > 0.                                                                                               |
| 20  | Description (optional): Textarea, minimum 2 rows, autosize                                                   | Free-form note.                                                                                            |
| 21  | "Save Entry" / "Update Entry" button with loading state during submission                                    | Disabled while saving.                                                                                     |

---

## E - Account Options List

| #   | Logic                                                                                                                                                                                                                                                                                                                            | Explanation                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 22  | Hardcoded account options (always available): Cash, Accounts Receivable, Stock on Hand, Inventory in Transit, Accounts Payable, Forwarder Payable, Courier Payable, Credit Card Payable, Loan Payable, Opening Equity, Owner Contribution, Owner Draw, Sales Revenue, Sales Returns, COGS, Inventory Shrinkage, Interest Expense | Standard chart of accounts.                                         |
| 23  | Dynamic accounts: all unique `account` values from existing journal entries are added to the list                                                                                                                                                                                                                                | Allows entry of custom/additional accounts that appear in the data. |

---

## F - Validation & Error Handling

| #   | Logic                                                                    | Explanation                                                                                                        |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 24  | Debit Account and Credit Account are both required                       | Mantine notification `{ color: 'red', title: '<error title>', message: '<error message>' }` on validation failure. |
| 25  | Debit Account must differ from Credit Account                            | Validation error shown via red Mantine notification.                                                               |
| 26  | Amount must be > 0                                                       | Validation error shown via red Mantine notification.                                                               |
| 27  | API error responses use the `response.error` field for the error message | Generic fallback: `'Unexpected error occurred'`.                                                                   |

---

## G - Create Journal Entry

| #   | Logic                                                                                                                                          | Explanation                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 28  | Create: `POST /accounting/manual-journal` with full payload (date, ref, debitAccount, creditAccount, debitTag, creditTag, amount, description) | Creates a balanced double-entry journal pair. |
| 29  | On success: Mantine teal notification `{ title: 'Entry saved', message: '${debitAccount} / ${creditAccount}' }`                                | Modal closes and journal list is refreshed.   |

---

## H - Update Journal Entry

| #   | Logic                                                                                                             | Explanation                                 |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 30  | Update: `PUT /accounting/manual-journal` with `sourceId` in payload                                               | Replaces the existing manual entry lines.   |
| 31  | On success: Mantine teal notification `{ title: 'Entry updated', message: '${debitAccount} / ${creditAccount}' }` | Modal closes and journal list is refreshed. |

---

## I - Delete Journal Entry

| #   | Logic                                                                                                               | Explanation                                               |
| --- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 32  | Delete: native `window.confirm()` dialog with text: `'Delete this manual entry?\n\n${entry.ref}\n${entry.account}'` | Browser-native confirm, not SweetAlert2.                  |
| 33  | If user clicks Cancel, no deletion occurs                                                                           | Guard: `if (!confirmed) return`.                          |
| 34  | Delete: `DELETE /accounting/manual-journal?sourceId=...`                                                            | Removes the journal entry lines identified by `sourceId`. |
| 35  | On success: Mantine green notification `{ title: 'Entry deleted', message: '${entry.ref}' }`                        | Journal list is refreshed.                                |
| 36  | Only `systemGenerated = false` entries show an edit/delete action                                                   | System-generated entries are read-only.                   |

---

## J - CSV Export

| #   | Logic                                                                                    | Explanation                     |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------- |
| 37  | Export CSV exports all journal entries in the current filtered view                      | Calls `handleExportCSV`.        |
| 38  | Exported headers: Date, Ref, Account, Debit, Credit, Description, Source Type, Source Id | Standard journal export format. |
| 39  | Filename: `journal_${YYYY-MM-DD}.csv`                                                    | Uses `getCurrentDateISO()`.     |

---

## K - CSV Import

| #   | Logic                                                                                                         | Explanation                                                           |
| --- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 40  | Import CSV parsed via `parseManualEntryCsv(text)`                                                             | Each row is POSTed individually to `POST /accounting/manual-journal`. |
| 41  | Maximum file size: 5 MB                                                                                       | Error shown if exceeded.                                              |
| 42  | Maximum rows: 1,000                                                                                           | Rows beyond 1,000 are skipped.                                        |
| 43  | On completion: Mantine notification `'Imported ${successCount} entries'` with failure count and skipped count | First 5 errors displayed if any failures occurred.                    |
| 44  | Template columns: `date`, `amount`, `ref`, `debitAccount`, `creditAccount`, `description`                     | Matches the import parser expectations.                               |

---

## L - CSV Template Download

| #   | Logic                                              | Explanation                                     |
| --- | -------------------------------------------------- | ----------------------------------------------- |
| 45  | "Download Template" generates a blank CSV template | Filename: `journal_template_${YYYY-MM-DD}.csv`. |

---

## M — Journal Lines by Ref API

> **Source file:** `src/app/api/accounting/journal-lines-by-ref/route.ts`

| #   | Logic                                                                                                                       | Explanation                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 46  | `GET /accounting/journal-lines-by-ref?ref={ref}` returns journal lines matching a ref string                                | Used by the Logistics Costs tab to fetch posting history for a shipment code. Returns `{ data: JournalLine[] }`.                         |
| 47  | The `ref` query parameter is required                                                                                       | Returns an error if the `ref` parameter is missing or empty.                                                                             |
| 48  | Each returned line includes `id`, `date`, `ref`, `account`, `debit`, `credit`, `description`, `sourceType`, `sourceLineKey` | The Logistics Costs tab uses `description` keywords and account names to detect which posting steps have been completed for each vendor. |
