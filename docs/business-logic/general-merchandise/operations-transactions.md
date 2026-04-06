# General Merchandise — Operations Transactions Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/page.tsx`
> - `src/app/general-merchandise/operations/transactions/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - `src/modules/general-merchandise/operations/transactions/module.config.ts`
> - `src/modules/general-merchandise/operations/transactions/components/TransactionsPage.tsx`
> - `src/modules/general-merchandise/transactions/api/service.ts`

---

## A — Route Entry & Shell

| #   | Logic                                                                                         | Explanation                                                                                   |
| --- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `/general-merchandise/operations` redirects to `/general-merchandise/operations/transactions` | Transactions is the GM Operations root landing page.                                          |
| 2   | The transactions page lives at `/general-merchandise/operations/transactions`                 | The route path is declared in the GM page and module config.                                  |
| 3   | The page renders through the shared GM operations shell                                       | `renderGmOperationsPage` applies the standard operations shell around the route content.      |
| 4   | The GM transactions page is a thin wrapper around the shared transactions page component      | `GeneralMerchandiseTransactionsPage` re-exports the shared `TransactionsPage` implementation. |

---

## B — Shared Workflow Baseline

| #   | Logic                                                                                                             | Explanation                                                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | The GM transactions UI follows the same shared workflow as the existing transactions page                         | Core operator behavior such as line editing, stock checks, invoice generation, batch handling, and payments is driven by the shared page implementation. |
| 6   | GM-specific behavior comes from route path, permissions, and data bindings rather than a separate transactions UI | The business-specific route and service layer change the data domain while preserving the workflow surface.                                              |
| 7   | GM transaction permissions match the operations/finance-oriented permission model defined in the module config    | The module config allows `admin`, `manager`, `operations`, and `finance`.                                                                                |

---

## C — GM Service Behavior

| #   | Logic                                                                                                                                      | Explanation                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 8   | The GM transaction service is bound to GM-specific Prisma models                                                                           | The service resolves transactions, inventory movements, customers, products, shipments, and prices from `generalMerchandise*` models.           |
| 9   | Quantity-based unit price selection uses GM price tiers                                                                                    | The service resolves price tiers by product code and quantity range before deriving transaction financial values.                               |
| 10  | Remaining balance falls back to a computed formula when `lineTotal` is not already finite                                                  | The service computes `quantity * unitPrice - discount - adjustment` when needed.                                                                |
| 11  | Imports fail when referenced customers, products, or shipments do not already exist                                                        | The GM service validates references before insert and returns a suggestion to create missing records first.                                     |
| 12  | Prepared template rows are skipped during import instead of being created as transactions                                                  | The GM import pipeline counts template-prepared rows separately and leaves them out of persisted transaction rows.                              |
| 13  | A `prepared` order with payment adjustment that fully covers the remaining balance is treated as fulfilled for inventory movement purposes | The GM service promotes this edge case into fulfilled movement handling when syncing inventory movements.                                       |
| 14  | Inventory and validation behavior is enforced through the GM transaction service layer                                                     | The GM service imports shared sanitizers, schemas, and validation error types, then applies GM-specific model bindings and movement sync logic. |

---

## D — GM Invoice Route Family

| #   | Logic                                                                                                                                           | Explanation                                                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15  | GM invoice CRUD lives under `/api/general-merchandise/invoices`                                                                                 | The GM namespace uses the same shared invoice route family with GM-specific Prisma bindings.                                                                                                                                                                                                                                    |
| 16  | `GET /api/general-merchandise/invoices` returns live invoices ordered newest first                                                              | The route filters on `deletedAt: null` and orders results by `createdAt` descending.                                                                                                                                                                                                                                            |
| 17  | `POST /api/general-merchandise/invoices` bulk-replaces the live invoice set                                                                     | The route validates an `invoices` array, soft-deletes existing live rows by setting `deletedAt`, then inserts the replacement set via `createMany`.                                                                                                                                                                             |
| 18  | `PUT /api/general-merchandise/invoices` updates one invoice by `id`; `DELETE /api/general-merchandise/invoices?id=...` soft-deletes one invoice | The update route persists a single invoice record, while DELETE marks one GM invoice as deleted without hard-deleting it.                                                                                                                                                                                                       |
| 19  | Related GM invoice subroutes stay in the same family                                                                                            | `GET /api/general-merchandise/invoices/customer-orders`, `GET/POST /api/general-merchandise/invoices/calculate-weights`, and `PUT /api/general-merchandise/invoices/{id}/tickbox` sit beside the base CRUD route; detailed tickbox and calculate-weights operator behavior stays aligned with the checkout-links workflow docs. |
