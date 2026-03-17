# General Merchandise — Operations Sorting & Distribution Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/sorting-distribution/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/sorting-distribution/module.config.ts`

---

## A — Route & Shell

| #   | Logic                                                                                            | Explanation                                                            |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | The GM sorting/distribution page lives at `/general-merchandise/operations/sorting-distribution` | The route path is GM-specific and registered in the module config.     |
| 2   | The page renders through the shared GM operations shell                                          | The route uses `renderGmOperationsPage`.                               |
| 3   | The page uses the shared sorting/distribution workflow surface                                   | There is no GM-only sorting/distribution implementation in this route. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                                                     | Explanation                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 4   | The GM sorting/distribution workflow follows the same shared quantity, distribution, local-persistence, and inline-edit behavior as the shared route page | The route delegates to the shared sorting/distribution page. |
| 5   | GM-specific meaning comes from the GM path and data context rather than a different interaction model                                                     | The route is a wrapper over shared behavior.                 |
| 6   | Shared sorting/distribution workflow changes that affect GM should also update this GM doc                                                                | Shared code still defines GM operator behavior.              |

---

## C — Documentation Notes

| #   | Logic                                                                                                           | Explanation                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 7   | The GM module remains an Operations module with the same general workflow surface as its shared counterpart     | The module config keeps the route inside the GM operations family. |
| 8   | If GM receives custom distribution rules or persistence behavior later, document the divergence here explicitly | This doc currently records shared-workflow parity as the baseline. |
