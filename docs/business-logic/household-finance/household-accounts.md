# Household Finance: Accounts Business Logic

> **Source files:**
>
> - `src/app/personal/accounts/page.tsx`
> - `src/app/personal/accounts/components/AccountsControls.tsx`
> - `src/app/personal/hooks/usePersonalAccountsView.ts`
> - `src/modules/household/accounts/api/schemas.ts`
> - `src/modules/household/accounts/api/service.ts`

---

## A - Page Layout & Stats

| #   | Logic                                              | Explanation                                                            |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | The Accounts page has two tabs                     | `Account List` and `Analytics`.                                        |
| 2   | Four stat cards summarize the filtered account set | Total Accounts, Active Accounts, Total Balance, and This Month Change. |
| 3   | Total Balance is displayed as PHP currency         | Formatting uses `en-PH` currency formatting.                           |

---

## B - Filters & Search

| #   | Logic                                                             | Explanation                                                           |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| 4   | Search matches account name, type, institution, and last-4 digits | Matching is normalized client-side.                                   |
| 5   | Type filter narrows by Household account type                     | Valid types are `CASH`, `BANK`, `EWALLET`, `CREDIT_CARD`, and `LOAN`. |
| 6   | Status filter narrows to `active` or `inactive`                   | Active state comes from `isActive`.                                   |
| 7   | Institution filter matches normalized institution names           | Empty institution values are excluded from filter option generation.  |

---

## C - Add / Edit / Delete

| #   | Logic                                               | Explanation                                                          |
| --- | --------------------------------------------------- | -------------------------------------------------------------------- |
| 8   | `Add Account` opens create mode                     | Modal title: `ADD PERSONAL ACCOUNT`.                                 |
| 9   | Edit action opens update mode with prefilled values | Modal title: `EDIT PERSONAL ACCOUNT`.                                |
| 10  | Account name is required before save                | Empty names are blocked in the view layer.                           |
| 11  | Delete uses a triple-confirm flow                   | The warning explains that linked income/expenses may block deletion. |

---

## D - CSV Import / Export

| #   | Logic                                                  | Explanation                                                                    |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 12  | Import accepts CSV files only                          | The control accepts `.csv,text/csv`.                                           |
| 13  | CSV file size limit is 5 MB                            | Larger files are rejected before parsing.                                      |
| 14  | CSV row limit is 1,000 rows                            | Files above the limit are rejected.                                            |
| 15  | Account type values are normalized                     | Variants like `CREDITCARD` and `EWALLETACCOUNT` are mapped to canonical types. |
| 16  | `Download Template` generates the CSV template         | Used to match the import contract.                                             |
| 17  | `Export` exports the current Household account dataset | Export is wired through the account data hook.                                 |
