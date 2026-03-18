# Household Finance: Income Business Logic

> **Source files:**
>
> - `src/app/personal/income/page.tsx`
> - `src/app/personal/income/components/IncomeControls.tsx`
> - `src/app/personal/hooks/usePersonalIncomeView.ts`
> - `src/modules/household/income/api/schemas.ts`

---

## A - Page Layout & Stats

| #   | Logic                                        | Explanation                                                             |
| --- | -------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | The Income page has two tabs                 | `Income List` and `Analytics`.                                          |
| 2   | Four stats summarize the filtered income set | Total Income, Income Count, This Month Income, and Last 30 Days Income. |
| 3   | Income values are formatted as PHP currency  | The page uses `en-PH` currency formatting.                              |

---

## B - Filters & Search

| #   | Logic                                                 | Explanation                                                                                                |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 4   | Search matches date, type, account, amount, and notes | Matching is normalized client-side.                                                                        |
| 5   | Type filter narrows by Household income type          | Supported types include `BUSINESS_DRAW`, `SALARY`, `FREELANCE`, `GIFT`, `CASHBACK`, `REFUND`, and `OTHER`. |
| 6   | Account filter narrows by account label               | Household income can be linked to an account.                                                              |
| 7   | Month and year filters are always present             | Month is a fixed list from January to December.                                                            |

---

## C - Add / Edit / Delete

| #   | Logic                                        | Explanation                                                  |
| --- | -------------------------------------------- | ------------------------------------------------------------ |
| 8   | `Add Income` opens create mode               | Modal title: `ADD PERSONAL INCOME`.                          |
| 9   | Edit opens update mode with prefilled values | Modal title: `EDIT PERSONAL INCOME`.                         |
| 10  | Amount must be positive before save          | Non-positive amounts are blocked in the view layer.          |
| 11  | Delete uses a triple-confirm flow            | The warning notes that linked account balances are affected. |

---

## D - CSV Import / Export

| #   | Logic                                                  | Explanation                                                            |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| 12  | Income CSV import validates required columns           | Required columns are `date`, `type`, `amount`, `account`, and `notes`. |
| 13  | CSV import rejects files with missing required headers | The page shows an `Invalid CSV` error.                                 |
| 14  | `Export` writes the current Household income dataset   | Export is wired through the Household income data hook.                |
