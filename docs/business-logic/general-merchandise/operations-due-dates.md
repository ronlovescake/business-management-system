# General Merchandise — Operations Due Dates Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/due-dates/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - Shared due-dates components imported from Clothing/shared routes

---

## A — Route & Shell

| #   | Logic                                                                                                       | Explanation                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM due-dates page lives at `/general-merchandise/operations/due-dates`                                  | The route path is GM-specific even though the page uses shared/Clothing-backed due-dates components.                  |
| 2   | The route renders through the shared GM operations shell                                                    | The route uses `renderGmOperationsPage`.                                                                              |
| 3   | The route imports the same due-dates page and error-boundary components used by the existing implementation | GM due dates currently relies on shared/Clothing-backed due-dates UI components rather than a GM-only implementation. |

---

## B — Workflow Baseline

Current shared calculation: an invoice dated October 26 is due October 29 at
11:59 PM Asia/Manila (the stored cutoff includes the final millisecond), not a
fixed 72-hour timer. The source is Clothing's shared `DueDateService` used by
the GM wrapper. This observed shared date behavior does not import Clothing's
supplier-credit, cancellation-approval, refund or valuation policies into GM.
Those remain in GM's own contracts and data namespace.

| #   | Logic                                                                                                                 | Explanation                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 4   | The GM due-dates workflow follows the same shared due-date computation and status-display behavior as the shared page | Operator workflow is inherited from the shared due-dates implementation. |
| 5   | GM-specific meaning comes from the GM route path and data context rather than a forked due-dates UI                   | The route is a wrapper over shared behavior.                             |
| 6   | Shared due-dates workflow changes that affect GM should also update this GM doc                                       | Shared implementation still defines GM operator behavior.                |

---

## C — Documentation Notes

| #   | Logic                                                                                                                      | Explanation                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 7   | The current GM due-dates route is effectively a shared-workflow reuse surface                                              | There is no GM-only due-dates page implementation at this route. |
| 8   | If GM receives custom due-date calculations, status rules, or route-only controls, document the divergence here explicitly | This doc currently records parity as the baseline.               |
