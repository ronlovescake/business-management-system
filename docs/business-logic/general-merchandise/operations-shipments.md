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

| #   | Logic                                                                                                                                               | Explanation                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 4   | The GM shipments workflow follows the shared shipment list, filtering, dashboard, and transit-related behavior, but shipment detail is GET/PUT only | The GM wrapper reuses the shared shipments UI, but its `[id]` API route does not export `DELETE`. |
| 5   | GM-specific meaning comes from the GM path and data domain rather than a different shipments interaction model                                      | Workflow parity is the current baseline.                                                          |
| 6   | Shared shipments workflow changes that affect GM should also update this GM doc                                                                     | Shared implementation still defines GM operator behavior.                                         |

---

## C — Recent Shared Workflow Changes

| #   | Logic                                                                                                                  | Explanation                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7   | The Logistics Costs tab was rebuilt with a stepper workflow, smart action buttons, and posting history                  | See Clothing `operations-shipments.md` Section M for full documentation. The same shared tab interface applies to GM shipments.                                                               |
| 8   | The Shipments API now returns per-product cost breakdowns                                                              | `GET /api/shipments` includes `linkedProductForwardersFee`, `linkedProductLalamove`, `linkedProductPackagingCost`, and `linkedProductGrandTotal` fields per shipment.                         |
| 9   | Transit build-up only creates Grand Total entries                                                                      | Forwarder/Lalamove entries are disabled via the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` feature flag. Those costs are handled separately via the Logistics Costs tab.                     |
| 10  | Transit build-up idempotency uses transactional purge-and-recreate                                                     | Soft-deleted rows are purged before `createMany`, wrapped in a Prisma `$transaction`.                                                                                                        |
