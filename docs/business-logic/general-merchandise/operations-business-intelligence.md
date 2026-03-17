# General Merchandise — Operations Business Intelligence Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/business-intelligence/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - Shared BI route/page components under `src/app/operations/business-intelligence/_shared/`

---

## A — Route & API Context

| #   | Logic                                                                           | Explanation                                                                                 |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | The GM BI page lives at `/general-merchandise/operations/business-intelligence` | The route path is GM-specific even though the page delegates to a shared BI route page.     |
| 2   | The page renders through the shared GM operations shell                         | `renderGmOperationsPage` wraps the route in the standard operations layout.                 |
| 3   | The shared BI page uses the GM API namespace                                    | The GM route passes `apiBasePath="/api/general-merchandise"` into the shared BI route page. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                       | Explanation                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 4   | The GM BI workflow follows the same shared filters, metrics, and chart behavior as the shared route page    | There is no GM-only BI UI implementation in this route.                                      |
| 5   | GM-specific behavior is primarily a data-domain switch, not a different BI interaction model                | The route changes which business data is queried, while keeping the shared interaction flow. |
| 6   | Any BI workflow change in the shared route that affects GM should be documented here as part of GM behavior | Shared implementation still produces a GM user-visible workflow.                             |

---

## C — Documentation Notes

| #   | Logic                                                                                       | Explanation                                                                   |
| --- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 7   | This doc assumes parity with the shared BI route until GM-specific divergence is introduced | The implementation is wrapper-based today.                                    |
| 8   | If GM receives custom BI filters, cards, or charts, they must be documented here explicitly | A future GM-only analytics fork would break parity and require doc expansion. |
