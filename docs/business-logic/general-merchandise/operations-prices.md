# General Merchandise — Operations Prices Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/prices/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/prices/module.config.ts`

---

## A — Route & Shell

| #   | Logic                                                                | Explanation                                                                 |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1   | The GM prices page lives at `/general-merchandise/operations/prices` | The route path and module config register Prices as a GM operations module. |
| 2   | The page renders through the shared GM operations shell              | The route uses `renderGmOperationsPage`.                                    |
| 3   | The page uses the shared prices route workflow surface               | There is no GM-only prices page implementation at this route.               |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                       | Explanation                                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 4   | The GM prices workflow follows the same shared add/edit/import/export and tier-management behavior as the shared route page | The route delegates to the shared prices workflow for user interaction. |
| 5   | GM-specific meaning comes from the GM route path and data domain rather than a forked UI                                    | The route changes the business context, not the interaction model.      |
| 6   | Any shared prices workflow change that affects GM should also update this GM doc                                            | Shared implementation still defines GM user-visible behavior.           |

---

## C — Documentation Notes

| #   | Logic                                                                                                              | Explanation                                         |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| 7   | Prices remain part of the GM Operations module family                                                              | The module config declares GM operations ownership. |
| 8   | If GM later introduces price-tier differences that do not match the shared workflow, document them explicitly here | This doc currently assumes workflow parity.         |
