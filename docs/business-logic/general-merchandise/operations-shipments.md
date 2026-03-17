# General Merchandise — Operations Shipments Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/shipments/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/shipments/module.config.ts`

---

## A — Route & Shell

| #   | Logic                                                                      | Explanation                                                      |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | The GM shipments page lives at `/general-merchandise/operations/shipments` | The route path is registered as a GM operations module.          |
| 2   | The route renders through the shared GM operations shell                   | The GM route uses `renderGmOperationsPage`.                      |
| 3   | The route uses the shared shipments workflow surface                       | There is no GM-only shipments page implementation in this route. |

---

## B — Workflow Baseline

| #   | Logic                                                                                                                                  | Explanation                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 4   | The GM shipments workflow follows the same shared shipment CRUD, filtering, and transit-related behavior as the shared shipments route | The route is a thin business wrapper over shared shipment UI. |
| 5   | GM-specific meaning comes from the GM path and data domain rather than a different shipments interaction model                         | Workflow parity is the current baseline.                      |
| 6   | Shared shipments workflow changes that affect GM should also update this GM doc                                                        | Shared implementation still defines GM operator behavior.     |

---

## C — Documentation Notes

| #   | Logic                                                                                                                         | Explanation                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 7   | The module remains part of the GM Operations family                                                                           | The module config assigns the route to GM operations with a shipment-specific icon and order. |
| 8   | If GM later diverges in shipment posting, duration, or modal behavior, document that divergence here explicitly               | This doc currently records parity as the baseline.                                            |
| 9   | Shipment changes that affect GM product/accounting automation should be cross-checked against GM products and accounting docs | Shipments influence other GM business workflows through shared route behavior.                |
