# General Merchandise — Operations Dashboard Business Logic

> **Retired:** The general-merchandise operations dashboard route has been removed. Use the Business Intelligence module for business insights. The notes below document the former route and shared implementation.

> **Former source files (now removed):**
>
> - `src/app/general-merchandise/operations/dashboard/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/dashboard/module.config.ts`
> - Shared dashboard route/page components under `src/app/operations/dashboard/_shared/` and `src/modules/clothing/operations/dashboard/`

---

## A — Route & Shell

| #   | Logic                                                                         | Explanation                                                                                                                   |
| --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1   | The former GM dashboard route was `/general-merchandise/operations/dashboard` | Its route page and module registration have been removed.                                                                     |
| 2   | The former route rendered through the shared GM operations shell              | `renderGmOperationsPage` delegated to the shared operations page wrapper for the standard operations layout/navigation shell. |
| 3   | The former dashboard was registered as an Operations module                   | Its module configuration and registration have been removed.                                                                  |

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
