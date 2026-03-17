# General Merchandise — Operations Dispatch Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/dispatch/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/dispatch/module.config.ts`
> - Shared dispatch route/page components under `src/app/operations/dispatch/_shared/`

---

## A — Route & Rendering Behavior

| #   | Logic                                                                    | Explanation                                                                                                                  |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM dispatch page lives at `/general-merchandise/operations/dispatch` | The route path is registered as a GM operations module.                                                                      |
| 2   | The page forces dynamic server rendering and disables caching            | The route exports `dynamic = 'force-dynamic'`, `revalidate = 0`, `fetchCache = 'force-no-store'`, and related runtime flags. |
| 3   | The route renders through the shared GM operations shell                 | The route uses `renderGmOperationsPage` to keep the standard operations shell.                                               |

---

## B — Server-Side Customer Preload

| #   | Logic                                                                                                   | Explanation                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 4   | The route fetches customer data server-side on every page load                                          | The page explicitly loads customer data before rendering to bypass client-side cache concerns.                                     |
| 5   | Customer preload failures do not block page rendering                                                   | The route logs the failure and continues with an empty customer array so the page can still render.                                |
| 6   | Server-side preload normalizes Shopee usernames and additional addresses                                | The route extracts `shopee_username` and `address` values from customer additional info and normalizes them for dispatch matching. |
| 7   | The current preload query reads from the generic `customer` model rather than a GM-named customer model | This is a notable implementation detail of the current GM dispatch route and should be revisited if GM customer sourcing changes.  |

---

## C — Shared Dispatch Workflow Baseline

| #   | Logic                                                                                                                                     | Explanation                                                                                                      |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 8   | After server preload, the GM page follows the same shared dispatch workflow as the shared dispatch route page                             | Matching, dispatch confirmation, tab workflow, and other operator interactions come from the shared dispatch UI. |
| 9   | GM-specific dispatch meaning comes from the GM path and server-preloaded customer data context                                            | The route customizes data sourcing more than interaction structure.                                              |
| 10  | Shared dispatch workflow changes that affect GM should also update this GM doc                                                            | Shared implementation still defines GM operator behavior.                                                        |
| 11  | Any future change to the preload query source or matching inputs is a GM-specific workflow change that must be documented here explicitly | The server preload is the clearest current GM dispatch divergence.                                               |
