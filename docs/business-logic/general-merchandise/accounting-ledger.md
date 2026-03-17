# General Merchandise — Accounting Ledger Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/accounting/ledger/page.tsx`
> - `src/modules/general-merchandise/ledger/recurringPayments/api/service.ts`
> - `src/modules/general-merchandise/ledger/recurringPayments/api/schemas.ts`
> - Shared ledger route/page components under `src/app/accounting/_shared/`

---

## A — Route & Shared UI Baseline

| #   | Logic                                                                                                                                    | Explanation                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | The GM ledger page lives at `/general-merchandise/accounting/ledger`                                                                     | The route is part of the GM accounting route family.                                                       |
| 2   | The page uses the shared ledger route page                                                                                               | There is no GM-only ledger UI implementation in this route.                                                |
| 3   | The shared ledger route page uses the GM API namespace                                                                                   | The route passes `apiBasePath="/api/general-merchandise"` into the shared ledger page.                     |
| 4   | The route injects a GM-specific recurring payment service into the shared ledger page                                                    | `LedgerRoutePage` receives `GeneralMerchandiseRecurringPaymentService` as the recurring-payment backend.   |
| 5   | The shared ledger page is tab-driven                                                                                                     | The route can switch among the main ledger, opening balance, help, and recurring-payments workflow panels. |
| 6   | Summary stats cards are shown only on the main ledger view                                                                               | Stats are hidden when the opening-balance, help, or recurring-payments tab is active.                      |
| 7   | The shared controls include search, account filter, period controls, opening-balance period controls, and import/export/template actions | `LedgerControls` manages the main filter and utility workflow.                                             |
| 8   | Operators can open both a manual ledger-entry modal and an opening-balance-entry modal from the shared controls                          | The route wires separate actions for normal entries and opening-balance entries.                           |

---

## B — Shared Panel Behavior

| #   | Logic                                                                                            | Explanation                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| 9   | The main ledger tab renders a list table with manual-entry and transit-build edit/delete actions | `LedgerListTable` exposes separate handlers for manual entries and transit build entries.                          |
| 10  | The opening-balance tab renders a dedicated opening-balance panel                                | The panel shows the cutover date, filtered entries, loading state, and opening-entry CRUD actions.                 |
| 11  | The help tab renders a dedicated help panel instead of ledger rows                               | `LedgerHelpPanel` is a first-class tab in the shared route.                                                        |
| 12  | The recurring-payments tab renders a dedicated recurring-payments panel                          | The panel receives accounts, the GM recurring-payment service, and a callback to refresh the ledger after updates. |
| 13  | Shared ledger dialogs use separate modal flows for opening balances and manual journal entries   | `OpeningBalanceEntryModal` and `ManualJournalEntryModal` are both part of the route workflow.                      |

---

## C — GM Recurring Payment Templates & Drafts

| #   | Logic                                                                                            | Explanation                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 14  | GM recurring payment templates are stored in GM-specific recurring-payment models                | The service resolves GM template and draft models from GM-specific Prisma bindings.                            |
| 15  | Template `nextDueDate` must be on or after the accounting cutover date                           | Template creation and updates reject due dates before cutover.                                                 |
| 16  | Template `endDate` cannot be before `nextDueDate`                                                | The service enforces chronological validity for recurring-payment templates.                                   |
| 17  | GM recurring payment kinds are limited to `LOAN` and `EXPENSE`                                   | The GM recurring-payment schema constrains template kind values.                                               |
| 18  | Draft status is limited to `DRAFT`, `APPROVED`, and `SKIPPED`                                    | The GM recurring-payment schema defines the draft lifecycle states.                                            |
| 19  | Draft generation creates monthly drafts up to a requested date and skips duplicates idempotently | `generateDueDrafts` loops by month, creates drafts, and treats unique conflicts as skips rather than failures. |

---

## D — GM Recurring Payment Approval Behavior

| #   | Logic                                                                             | Explanation                                                                                    |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 20  | Approving a GM recurring-payment draft posts a balanced two-line GM journal entry | Approval writes debit and credit journal lines into `generalMerchandiseAccountingJournalLine`. |
| 21  | Tagged accounts are resolved before journal posting                               | The service uses the shared tagged-account resolver before creating journal entries.           |
| 22  | Approved drafts are marked `APPROVED` and store an approval timestamp             | Draft approval is both an accounting post and a state transition.                              |

---

## E — Workflow Notes

| #   | Logic                                                                                                                                           | Explanation                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 23  | The visible ledger UI is shared, but recurring-payment behavior is materially GM-specific because it uses GM data models and GM journal posting | Shared UI does not remove GM-specific accounting automation rules. |
| 24  | Changes to GM recurring-payment validation, generation, approval, or skip behavior must be documented here explicitly                           | These are core GM accounting workflow rules.                       |
