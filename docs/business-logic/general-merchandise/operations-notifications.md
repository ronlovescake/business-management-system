# General Merchandise — Operations Notifications Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/notifications/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - Shared notifications route/page components under `src/app/operations/notifications/_shared/`

---

## A — Route & API Context

| #   | Logic                                                                              | Explanation                                                                                   |
| --- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | The GM notifications page lives at `/general-merchandise/operations/notifications` | The route path is GM-specific.                                                                |
| 2   | The route renders through the shared GM operations shell                           | The route uses `renderGmOperationsPage`.                                                      |
| 3   | The shared notifications route page uses the GM API namespace                      | The route passes `apiBasePath="/api/general-merchandise"` into the shared notifications page. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                               | Explanation                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 4   | The shared notifications page is organized into four tabs                                                           | Operators can switch among `Transactions`, `Products`, `Prices`, and `Shipments` notification categories.   |
| 5   | Each tab fetches category-specific notification data and shows loading, error, and empty states                     | The shared page renders a loader, red alert, or empty-state text before showing the table.                  |
| 6   | Multi-change notifications are grouped and can be expanded inline                                                   | The shared panel groups records by transaction, action, user, and day, then expands with a chevron control. |
| 7   | Single-change notifications are rendered as inline alert summaries                                                  | Standalone changes are shown as alert cards with old/new values and timestamps.                             |
| 8   | The GM notifications workflow therefore follows a grouped audit-trail model rather than a flat list                 | There is no GM-only notifications UI implementation in this route.                                          |
| 9   | GM-specific meaning comes from the GM path and API namespace rather than a separate notifications interaction model | Workflow parity is the current baseline.                                                                    |
| 10  | Shared notifications workflow changes that affect GM should also update this GM doc                                 | Shared implementation still defines GM operator behavior.                                                   |

---

## C — Documentation Notes

| #   | Logic                                                                                                                  | Explanation                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 11  | GM notifications are a business-specific operator workflow surface even though the implementation is shared            | The route is user-visible and business-specific.   |
| 12  | If GM receives notifications behavior that differs from the shared route page, document the divergence here explicitly | This doc currently records parity as the baseline. |
