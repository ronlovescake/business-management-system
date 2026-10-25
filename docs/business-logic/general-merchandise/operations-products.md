# General Merchandise — Operations Products Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/products/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/products/module.config.ts`
> - `src/modules/general-merchandise/products/api/service.ts`
> - `src/modules/general-merchandise/products/api/__tests__/service.transit-build.test.ts`
> - `src/modules/general-merchandise/products/api/__tests__/service.accounting.test.ts`
> - `src/modules/products/api/financials.ts`
> - `src/modules/products/api/routeFactory.ts`
> - `src/app/api/general-merchandise/products/[id]/route.ts`

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

| #   | Logic                                                                            | Explanation                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | GM product persistence is backed by `generalMerchandiseProduct` records          | The product service binds directly to GM Prisma product models.                                                                                                                                                                 |
| 6   | GM manual transit build-up posts accounting entries by shipment code             | The service exposes `postManualTransitBuildUpByShipmentCode` as a GM-specific product accounting workflow.                                                                                                                      |
| 7   | Manual transit build-up debits `Inventory in Transit` for product grand total    | Test coverage confirms the grand total posts to `Inventory in Transit`.                                                                                                                                                         |
| 8   | Manual transit build-up does not post separate forwarder or courier entries      | Forwarder's Fee and Lalamove entry creation is disabled via the `ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS` feature flag. Only the Grand Total entry is posted. These costs are handled separately via the Logistics Costs tab. |
| 9   | Paid products credit `Cash` during manual transit build-up posting               | For paid products, the Grand Total transit build-up line credits `Cash`.                                                                                                                                                        |
| 10  | Unpaid products credit `Supplier Payable` during manual transit build-up posting | Only the Grand Total entry is created, crediting `Supplier Payable`. Forwarder Payable and Courier Payable entries are disabled.                                                                                                |

---

## C — Payment-Triggered Accounting Automation

| #   | Logic                                                                                     | Explanation                                                                                              |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 11  | Creating a paid or unpaid GM product does not auto-post transit build-up entries          | Tests explicitly verify no automatic transit build-up posting occurs on create.                          |
| 12  | Changing payment from Unpaid to Paid triggers a supplier settlement journal automation    | `postGmSupplierSettlementForProductPaymentChange` posts settlement only on the Unpaid → Paid transition. |
| 13  | Supplier settlement debits `Supplier Payable` and credits `Cash`                          | The supplier settlement automation writes a balanced two-line journal pair for the settlement amount.    |
| 14  | Supplier settlement automation depends on existing transit build-up supplier-payable rows | If transit build-up source rows are missing or amount is non-positive, settlement posting is skipped.    |

## D — Product Identity and Price Tiers

- `GeneralMerchandiseProduct.id` is the stable identity for a GM product. Product codes are editable labels; linked prices, transactions, movements, sorting distributions, bundle components, and inventory reclass entries retain their product link when the code changes.
- When a product code changes, the previous code is retained in the GM product-code alias table for history, and the new code is propagated to linked records. Aliases are not accepted as lookup keys for new writes.
- Writes containing a current product code resolve to its active product when that code identifies exactly one product. Ambiguous codes are rejected rather than guessed. Historical records with blank, unmatched, or ambiguous codes remain unlinked until deliberately resolved.
- A product shipment-code change updates the shipment code on linked transactions. It does not rewrite transaction prices or financial totals.
- Changing `Actual Price` recalculates active linked price tiers. The highest-quantity tier uses `Actual Price`; each preceding lower-quantity tier is increased by 5 currency units. Archived tiers are left unchanged.
- Run `npx tsx scripts/audit-general-merchandise-product-identity.ts` to report duplicate active codes, link totals, and unique, ambiguous, unmatched, or blank-code records before or after migration.

## E — Product Financial Persistence

The shared product form keeps its live financial cards as a browser preview.
GM product writes use the shared financial calculation helper to recompute
derived metrics before persistence, including direct-ID updates. The formulas
are unchanged; this does not change GM's separate transit build-up accounting
workflow described above.

## F - Inline Grid Save Reliability

| #   | Logic                                 | Explanation                                                                                                                                                                                                                                                              |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 15  | GM shares the local-draft save queue  | The shared `useProductGridSaveQueue` merges rapid edits by permanent product ID and submits complete DTOs for changed rows only, with one request active at a time. Later revisions cannot be cleared by older responses. API scope isolates clothing and GM drafts.     |
| 16  | Reconciliation preserves pending work | Drafts overlay query data until the queue drains and a fresh read succeeds. Failed/skipped rows remain visible; incomplete acknowledgements are errors. Bulk saves no longer replace the whole query cache or refresh after every request.                               |
| 17  | Recovery is explicit                  | Refresh and Retry first refreshes server state and refuses to recreate missing products. Discard Drafts reloads server values without undoing committed writes. No automatic write replay occurs after errors; a timeout/5xx may have committed, so review before retry. |
| 18  | Conflicting local actions wait        | Add/edit modal writes, transit actions, and other product tabs are blocked while drafts remain unresolved. Unload and link navigation warn. Drafts are memory-only; other clients/programmatic navigation are not coordinated.                                           |
| 19  | GM accounting rules remain separate   | GM bulk service, payment/identity guards, financial formulas, imports, jobs, and direct-ID enforcement are unchanged. This is client save coordination, not new accounting policy or cross-user concurrency protection.                                                  |
