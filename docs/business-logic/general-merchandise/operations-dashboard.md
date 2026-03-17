# General Merchandise — Operations Dashboard Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/dashboard/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/dashboard/module.config.ts`
> - Shared dashboard route/page components under `src/app/operations/dashboard/_shared/` and `src/modules/clothing/operations/dashboard/`

---

## A — Route & Shell

| #   | Logic                                                                 | Explanation                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM dashboard lives at `/general-merchandise/operations/dashboard` | The GM route path is declared in the page route and module config.                                                                          |
| 2   | The route renders through the shared GM operations shell              | `renderGmOperationsPage` delegates to the shared operations page wrapper so the page keeps the standard operations layout/navigation shell. |
| 3   | The module is registered as an Operations module                      | The module config registers the GM dashboard with operations metadata, permissions, order, and business scope.                              |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                       | Explanation                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 4   | The GM dashboard uses the same shared dashboard workflow surface as the existing operations dashboard route                 | The route delegates to the shared dashboard route page rather than a GM-only UI implementation. |
| 5   | The documented dashboard behavior should match the shared dashboard implementation unless a GM-specific note says otherwise | The GM route is a business-specific wrapper, not a forked dashboard workflow.                   |
| 6   | GM-specific meaning comes from the business path and data context rather than a separate UI flow                            | The route path, permissions, and business scope distinguish GM from other businesses.           |

---

## C — Documentation Notes

| #   | Logic                                                                                                      | Explanation                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 7   | Changes to shared dashboard workflow that affect GM must also update this GM doc                           | Even when the implementation is shared, the GM route remains a user-visible workflow surface. |
| 8   | If GM later diverges from the shared dashboard behavior, the divergence must be documented here explicitly | This doc treats parity as the baseline, not a permanent assumption.                           |
