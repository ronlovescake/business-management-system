# Household Finance: Recurring Payments Business Logic

> **Source files:**
>
> - `src/app/personal/expenses/components/RecurringPaymentsPanel.tsx`
> - `src/app/personal/hooks/usePersonalExpensesView.ts`
> - `src/modules/household/recurringPayments/api/service.ts`
> - `src/modules/household/recurringPayments/api/schemas.ts`
> - `src/app/api/household/recurring-payments/generate/route.ts`

---

## A - Template Management

| #   | Logic                                                                                   | Explanation                                                                                                                   |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | Recurring payments are stored as templates                                              | Templates include name, amount, category, account, start date, months count, notes, active flag, and deduct-on-generate flag. |
| 2   | Creating or editing a template requires name, amount, category, start date, and account | The panel validates these fields before create/update.                                                                        |
| 3   | A template can be active or paused                                                      | The UI shows `Active` or `Paused` badge state.                                                                                |
| 4   | `monthsCount = null` means indefinite recurrence                                        | Positive values limit the number of generated months.                                                                         |

---

## B - Monthly Generation

| #   | Logic                                                                        | Explanation                                                                                                                 |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 5   | Monthly generation is triggered manually                                     | The UI button is `Generate This Month`; the API route is `POST /api/household/recurring-payments/generate`.                 |
| 6   | Generation can target the current month or an explicit `YYYY-MM` month       | The API schema accepts an optional `month`.                                                                                 |
| 7   | Day values are clamped to the last valid day in the target month             | Example: a start date on the 31st becomes the 28th or 30th when needed.                                                     |
| 8   | Templates are skipped if the target month is before the template start month | Future templates do not backfill into earlier months.                                                                       |
| 9   | Templates are skipped once `monthsCount` is exhausted                        | The service uses month-difference comparison to enforce duration.                                                           |
| 10  | Generation deduplicates per month                                            | Existing Household expenses with `sourceType = 'RECURRING'`, the same `sourceId`, and the same `sourceLineKey` are skipped. |

---

## C - Status & Balance Impact

| #   | Logic                                                               | Explanation                                                                                                                               |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | `deductOnGenerate = true` creates the expense as `paid`             | This also decrements the linked account balance.                                                                                          |
| 12  | `deductOnGenerate = false` creates the expense as `pending`         | Pending generated expenses do not decrement the balance.                                                                                  |
| 13  | Template account is preferred                                       | If the template has no account, the service falls back to the first active account.                                                       |
| 14  | Generated expenses are marked as system-generated recurring entries | `sourceType = 'RECURRING'`, `sourceId = template id`, `sourceLineKey = target month`, `systemGenerated = true`, `loggedBy = 'Recurring'`. |
