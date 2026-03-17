# General Merchandise — Operations Dispatching Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/dispatching/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - Shared dispatching route/page components under `src/app/operations/dispatching/_shared/`

---

## A — Route & Shell

| #   | Logic                                                                          | Explanation                                                   |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 1   | The GM dispatching page lives at `/general-merchandise/operations/dispatching` | The route path is GM-specific.                                |
| 2   | The route renders through the shared GM operations shell                       | The route uses `renderGmOperationsPage`.                      |
| 3   | The route delegates to the shared dispatching route page                       | There is no GM-only dispatching implementation in this route. |

---

## B — Current Workflow State

| #   | Logic                                                                                                                                        | Explanation                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 4   | The current GM dispatching workflow should be treated as the same scaffold/placeholder behavior exposed by the shared dispatching route page | GM does not currently introduce a separate dispatching workflow.                                                         |
| 5   | The route metadata labels dispatching as an operations tracking surface                                                                      | The page metadata presents Dispatching as a track/manage route even though behavior is currently shared/scaffold-driven. |
| 6   | Any future real dispatching persistence, edit flows, or posting actions must be documented here explicitly                                   | This doc currently records the scaffold baseline.                                                                        |
| 7   | Shared dispatching workflow changes that affect GM should also update this GM doc                                                            | Shared implementation still defines GM operator behavior.                                                                |
