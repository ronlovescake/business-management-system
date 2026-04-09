# General Merchandise — Operations Products Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/products/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/products/module.config.ts`
> - `src/modules/general-merchandise/products/api/service.ts`
> - `src/modules/general-merchandise/products/api/__tests__/service.transit-build.test.ts`
> - `src/modules/general-merchandise/products/api/__tests__/service.accounting.test.ts`

---

## A — Route & Shared UI Baseline

| #   | Logic                                                                                                                | Explanation                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The GM products page lives at `/general-merchandise/operations/products`                                             | The route path is GM-specific and is registered in the GM module config.                                                              |
| 2   | The page renders through the shared GM operations shell                                                              | `renderGmOperationsPage` wraps the route in the operations shell.                                                                     |
| 3   | The GM products UI uses the shared products route page behavior                                                      | The GM route delegates to the shared products route page rather than a GM-only page implementation.                                   |
| 4   | GM-specific products behavior should be assumed to match the shared products workflow unless this doc says otherwise | Product form behavior, grid workflow, bundles, mix-and-match, and calculator interactions inherit the shared implementation baseline. |

---

## B — GM Product Service Behavior

| #   | Logic                                                                                    | Explanation                                                                                                                |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 5   | GM product persistence is backed by `generalMerchandiseProduct` records                  | The product service binds directly to GM Prisma product models.                                                            |
| 6   | GM manual transit build-up posts accounting entries by shipment code                     | The service exposes `postManualTransitBuildUpByShipmentCode` as a GM-specific product accounting workflow.                 |
| 7   | Manual transit build-up debits `Inventory in Transit` for product grand total            | Test coverage confirms the grand total posts to `Inventory in Transit`.                                                    |
| 8   | Manual transit build-up does not post separate forwarder or courier entries               | Forwarder's Fee and Lalamove entry creation is disabled via the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` feature flag. Only the Grand Total entry is posted. These costs are handled separately via the Logistics Costs tab. |
| 9   | Paid products credit `Cash` during manual transit build-up posting                       | For paid products, the Grand Total transit build-up line credits `Cash`.                                                   |
| 10  | Unpaid products credit `Supplier Payable` during manual transit build-up posting         | Only the Grand Total entry is created, crediting `Supplier Payable`. Forwarder Payable and Courier Payable entries are disabled. |

---

## C — Payment-Triggered Accounting Automation

| #   | Logic                                                                                     | Explanation                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 11  | Creating a paid or unpaid GM product does not auto-post transit build-up entries          | Tests explicitly verify no automatic transit build-up posting occurs on create.                          |
| 12  | Changing payment from Unpaid to Paid triggers a supplier settlement journal automation    | `postGmSupplierSettlementForProductPaymentChange` posts settlement only on the Unpaid → Paid transition. |
| 13  | Supplier settlement debits `Supplier Payable` and credits `Cash`                          | The supplier settlement automation writes a balanced two-line journal pair for the settlement amount.    |
| 14  | Supplier settlement automation depends on existing transit build-up supplier-payable rows | If transit build-up source rows are missing or amount is non-positive, settlement posting is skipped.    |
