# General Merchandise — Operations Post Template Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/post-template/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/post-template/module.config.ts`

---

## A — Route & API Context

| #   | Logic                                                                              | Explanation                                                                                   |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | The GM post-template page lives at `/general-merchandise/operations/post-template` | The route path is GM-specific and registered as a GM operations module.                       |
| 2   | The route renders through the shared GM operations shell                           | The route uses `renderGmOperationsPage`.                                                      |
| 3   | The shared post-template route page uses the GM API namespace                      | The route passes `apiBasePath="/api/general-merchandise"` into the shared post-template page. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                  | Explanation                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 4   | The GM post-template workflow follows the same shared template-editing behavior as the shared post-template route page | There is no GM-only post-template UI implementation in this route. |
| 5   | GM-specific meaning comes from the GM path and API namespace rather than a separate post-template interaction model    | Workflow parity is the current baseline.                           |
| 6   | Shared post-template workflow changes that affect GM should also update this GM doc                                    | Shared implementation still defines GM operator behavior.          |

---

## C — Documentation Notes

| #   | Logic                                                                                                              | Explanation                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 7   | The module remains part of the GM operations family                                                                | The module config registers Post Template as a GM operations surface. |
| 8   | If GM receives custom post-template content rules or persistence behavior, document the divergence here explicitly | This doc currently records parity as the baseline.                    |
