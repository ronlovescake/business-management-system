# General Merchandise — Accounting Balance Sheet Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/accounting/balance-sheet/page.tsx`
> - Shared balance-sheet route/page components under `src/app/accounting/_shared/`

---

## A — Route & API Context

| #   | Logic                                                                              | Explanation                                                                                   |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | The GM balance-sheet page lives at `/general-merchandise/accounting/balance-sheet` | The route is part of the GM accounting route family.                                          |
| 2   | The page uses the shared balance-sheet route page                                  | There is no GM-only balance-sheet UI implementation in this route.                            |
| 3   | The shared balance-sheet route page uses the GM API namespace                      | The route passes `apiBasePath="/api/general-merchandise"` into the shared balance-sheet page. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                                    | Explanation                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 4   | The shared balance-sheet page shows summary stats cards before the working area                                                          | Operators see assets, liabilities, equity, and balance cards with the current `as of` context. |
| 5   | The shared controls include tab switching, search, `as of` date filtering, export, and template download actions                         | `BalanceSheetControls` drives the main filter and utility workflow.                            |
| 6   | The shared page supports summary and breakdown tabs rather than a single table                                                           | The route can switch among the main table plus `cash`, `stock`, and `transit` breakdown views. |
| 7   | Each breakdown tab renders a dedicated table with totals and summary data                                                                | Cash, stock, and transit each have a separate breakdown component.                             |
| 8   | The GM balance-sheet workflow follows the same shared snapshot, totals, and display behavior as the shared route page                    | Operator interactions come from the shared balance-sheet UI.                                   |
| 9   | GM-specific meaning comes from the GM API namespace and GM accounting data domain rather than a separate balance-sheet interaction model | Workflow parity is the current baseline.                                                       |
| 10  | Shared balance-sheet workflow changes that affect GM should also update this GM doc                                                      | Shared implementation still defines GM operator behavior.                                      |

---

## C — Documentation Notes

| #   | Logic                                                                                                                   | Explanation                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 11  | The GM balance sheet is still a GM-specific business workflow even though the implementation is shared                  | The route is user-visible and tied to GM accounting records. |
| 12  | If GM receives balance-sheet behavior that diverges from the shared route page, document the divergence here explicitly | This doc currently records parity as the baseline.           |
