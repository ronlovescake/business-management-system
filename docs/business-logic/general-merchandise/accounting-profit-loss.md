# General Merchandise — Accounting Profit & Loss Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/accounting/profit-loss/page.tsx`
> - Shared profit-loss route/page components under `src/app/accounting/_shared/`

---

## A — Route & API Context

| #   | Logic                                                                              | Explanation                                                                         |
| --- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | The GM profit-and-loss page lives at `/general-merchandise/accounting/profit-loss` | The route is part of the GM accounting route family.                                |
| 2   | The page uses the shared profit-loss route page                                    | There is no GM-only P&L UI implementation in this route.                            |
| 3   | The shared profit-loss route page uses the GM API namespace                        | The route passes `apiBasePath="/api/general-merchandise"` into the shared P&L page. |

---

## B — GM-Specific Route Flags

| #   | Logic                                                                                                      | Explanation                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 4   | The GM P&L page disables the breakdowns tab                                                                | The route passes `showBreakdownsTab={false}` into the shared P&L route page.                 |
| 5   | The shared P&L page shows summary stats cards before the working area                                      | Operators see revenue, COGS, gross profit, expense total, and net profit cards.              |
| 6   | The shared controls include tab switching, search, period filtering, export actions, and template download | `ProfitLossControls` drives the main filter and utility workflow.                            |
| 7   | The shared page can switch between summary and detail tables                                               | The route renders `ProfitLossTable` or `ProfitLossDetailsTable` depending on the active tab. |
| 8   | Aside from the hidden breakdowns tab, the GM P&L workflow follows the shared P&L behavior                  | The route uses the shared page for the rest of the operator workflow.                        |

---

## C — Workflow Baseline

| #   | Logic                                                                                                                                    | Explanation                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 9   | GM-specific meaning comes from the GM API namespace and the hidden breakdowns-tab choice rather than a different P&L page implementation | The route customizes one visible behavior while reusing the shared P&L page. |
| 10  | Shared P&L workflow changes that affect GM should also update this GM doc                                                                | Shared implementation still defines GM operator behavior.                    |
| 11  | If GM later re-enables breakdowns or adds other route-level P&L differences, document them here explicitly                               | This doc currently records one explicit GM-specific route deviation.         |
