# General Merchandise — Operations Inventory Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/inventory/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/inventory/module.config.ts`

---

## A — Route & Shell

| #   | Logic                                                                      | Explanation                                                            |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | The GM inventory page lives at `/general-merchandise/operations/inventory` | The route path is declared as part of the GM operations module family. |
| 2   | The page renders through the shared GM operations shell                    | `renderGmOperationsPage` wraps the route content.                      |
| 3   | The page uses the shared inventory route workflow surface                  | There is no GM-only inventory page implementation in this route.       |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                        | Explanation                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 4   | The GM inventory workflow follows the same shared adjustment, movement, and analytics behavior as the shared inventory route | The route delegates to the shared inventory page.                               |
| 5   | GM-specific meaning comes from the GM business path and underlying GM inventory data                                         | The interaction model is shared while data ownership remains business-specific. |
| 6   | Inventory workflow changes in shared code that affect GM must be reflected here                                              | Shared implementation still defines GM operator behavior.                       |

---

## C — Documentation Notes

| #   | Logic                                                                                                                  | Explanation                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 7   | The GM inventory module metadata describes inventory analytics for stock, sales, and profitability                     | The GM module config frames this route as an analytics-oriented inventory page. |
| 8   | If GM introduces inventory logic that diverges from shared inventory behavior, document the divergence here explicitly | This doc currently records shared-workflow parity as the baseline.              |
