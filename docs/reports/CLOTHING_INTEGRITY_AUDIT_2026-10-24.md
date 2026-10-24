# Clothing Integrity Audit And Remediation

Scope: the development checkout, all 40 clothing page paths, and shared services
actually reached by clothing. Deepest implementation/regression work covers
inventory, ledger, transactions, products, shipments, pricing, and checkout.
Inventorying a route does not certify every implementation or business flow.

Production was not accessed. After the audit validation, `npm run docker:prod`
was run from the development checkout. Its output shows it selected the
development database container, found no pending migrations, and rebuilt and
restarted the development app and backup scheduler. No production container was
targeted. No schema migration was applied and no historical data repairs were
performed. The earlier test gates used newly created scratch databases on the
dedicated localhost:5433 test service and removed them afterward; the existing
development/test database was not reset. No production build, commit, or push
was performed before this handoff.

## Confirmed Findings

HIGH denotes business-data/authorization integrity; MEDIUM denotes bounded
workflow integrity. No finding establishes that production data was affected.

| ID  | Severity | Reproduction / risk                                                                                                                                 | Implemented safeguard                                                                                                                                   |
| --- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | HIGH     | USER blocked from accounting/staff pages could call insufficiently restricted APIs.                                                                 | 401/403 API authorization, segment-bounded ACLs, matching UI controls, actual root staff/payroll/expense API coverage. Normal USER operations retained. |
| F2  | HIGH     | Receive 10, scrap 3, inventory incorrectly showed 10 available.                                                                                     | Deduct scrap; distinguish explicit manual reversals from legacy receipts. Regression expects 7.                                                         |
| F3  | HIGH     | Receive 100, sell 20, return 5: sellable returns were ignored and damaged returns could be double-deducted.                                         | Physical returns restore the selected bucket once: 85 sellable, or 80 sellable plus 5 damaged/scrap.                                                    |
| F4  | HIGH     | Direct-ID/import/deletion paths bypassed accounting identity checks.                                                                                | Shared guard across all writes/deletion, including journal-only supplier dependencies.                                                                  |
| F5  | HIGH     | Rename after reclass could produce a second code-derived accounting key.                                                                            | Posted identity edits blocked; new reclass rows use stable productId/keys, retaining legacy code-only history.                                          |
| F6  | HIGH     | Mass-deleted transactions left active sales/reservations and orphan COGS.                                                                           | Reject financial/fulfillment history; atomically clean owned automatic movements for permitted drafts. No historical rewrite.                           |
| F7  | HIGH     | Paid could commit without settlement; same-Paid retry did nothing.                                                                                  | Product plus journal pair atomic; supported method/role required; stable retry and conflicting/deleted-key rejection.                                   |
| F8  | MEDIUM   | Clearing tiers treated an API envelope as an array; stale responses overwrote edits.                                                                | Common envelope/composite lookup, versioned current-edit guard, logical cancellation and stale-submit protection.                                       |
| F9  | MEDIUM   | Clothing Dispatching presented sample rows and simulated actions.                                                                                   | Clothing alias redirects to actual Dispatch; metadata updated. Shared GM consumer retained.                                                             |
| F10 | MEDIUM   | Checkout import showed temporary IDs and replaced the list before saving.                                                                           | Await persistence/canonical reload; preserve prior list on failure, correctly report saved-but-refresh-failed.                                          |
| F11 | HIGH     | Transit purge/repost was defeated by soft-delete middleware and retained unique keys.                                                               | Restore the exact row/key; real PostgreSQL/middleware regression preserves identity.                                                                    |
| F12 | HIGH     | Source amount/account/date/delete or split resubmission invalidated downstream postings.                                                            | Both editing APIs and recovery check reclassification/settlement dependencies; notes remain editable.                                                   |
| F13 | HIGH     | Product+shipment, split+single, or funding-account changes could post full cost twice.                                                              | Exclusive flows/omitted-split checks in serializable transactions; real concurrent-source regression.                                                   |
| F14 | MEDIUM   | CSV export/import headers differed and manual splitting corrupted quoted fields.                                                                    | Shared PapaParse contract; round-trip and malformed-input regressions.                                                                                  |
| F15 | HIGH     | Missing-total fallback subtracted an already embedded item discount again.                                                                          | Quantity times net Unit Price less adjustment; absent differs from explicit finite zero. Matching UI/service/refund tests.                              |
| F16 | MEDIUM   | Concurrent first template loads inserted the same default/singleton keys.                                                                           | Duplicate-safe defaults and singleton upsert with empty update; existing clothing/GM parity tests.                                                      |
| F17 | HIGH     | Clothing cutover lookup selected an optional GM column absent from the Prisma schema and silently fell back instead of using a saved clothing date. | Separate module-specific reads; clothing settings no longer depend on GM schema extensions. No schema change.                                           |

## Deciding Code

- [Inventory transform](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts) and [regressions](../../src/modules/clothing/operations/inventory/lib/__tests__/inventoryTransforms.test.ts).
- [Product service](../../src/modules/products/api/service.ts), [direct route](../../src/app/api/products/[id]/route.ts), and [settlement dependencies](../../src/lib/accounting/supplier-settlement-dependencies.ts).
- [Transit source factory](../../src/modules/shipments/api/transitBuildRouteFactory.ts), [reclass factory](../../src/modules/shipments/api/transitReclassRouteFactory.ts), and [accounting source writes](../../src/app/api/accounting/transit-build/route.ts).
- [Transaction lifecycle](../../src/modules/transactions/api/service.ts), [movement ownership](../../src/modules/transactions/api/transactionInventorySync.ts), and [deletion tests](../../src/modules/transactions/api/__tests__/service.deletion.test.ts).
- [ACL](../../src/core/routePermissions.ts), [API middleware](../../src/core/api/middleware.ts), and [role/conflict tests](../../tests/unit/api/clothing-api-authorization.test.ts).
- [Runtime cutover](../../src/lib/accounting/cutover.ts) and [module-isolation tests](../../tests/unit/accounting/cutover.test.ts).
- [Pricing form](../../src/modules/clothing/operations/prices/components/PricesPage.tsx), [checkout persistence](../../src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts), and [CSV schema](../../src/modules/clothing/operations/checkout-links/lib/csv.ts).
- [Real PostgreSQL suite](../../tests/integration/transaction-data-integrity.integration.test.ts): second-line rollback, idempotent Paid retry/dates, same-row transit recovery, exclusive concurrent sources, and reclass/source consistency.

## Preserved Policy

- Discounts are per item and already in Unit Price; never subtract twice.
- Monetary refunds alone do not restock. Physical returns identify a destination bucket.
- Received supply, available sellable, reserved, sold, damaged, and scrap are distinct.
- Product-origin reclass uses posted source amounts, not later COGS estimates.
- Grand Total posting does not also auto-post logistics; that is a separate workflow.
- Shorts/free additionals do not invent supplier credits/charges.
- Deletion remains soft deletion. Journal/movement history is not purged to bypass idempotency.
- No global soft-delete rewrite, timestamped keys, or schema-wide Decimal migration.

## All 40 Pages

Paths are relative to `/clothing/`. Depth describes this work, not all historical
test coverage. Regression coverage is not full browser certification.

| Page                             | Depth / result                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| accounting                       | Overview/routing reviewed; no full authenticated browser run.                                                          |
| accounting/ledger                | Projection/API/role trace and accounting tests; source guards changed.                                                 |
| accounting/journal               | API/role trace and journal API/business tests.                                                                         |
| accounting/expenses              | Root ownership/role tests; shared GM/trucking tests preserved.                                                         |
| accounting/investors             | Authorization, Decimal/string boundary and existing integration reviewed; complete payout lifecycle not certified.     |
| accounting/profit-loss           | API/business regressions; not every report basis/date reconciled live.                                                 |
| accounting/balance-sheet         | API/business regressions; not every historical period reconciled live.                                                 |
| ledger                           | Alias accounted for; ledger permissions shared.                                                                        |
| operations/products              | All mutation entry points traced; accounting tests and PostgreSQL rollback/retry/recovery.                             |
| operations/shipments             | Source/reclass/write endpoints traced; regressions and PostgreSQL races; logistics residual below.                     |
| operations/inventory             | Projection/adjustment metadata, return/scrap and split/mix demand regressions; refund edit/delete fixture remains.     |
| operations/transactions          | Net-price/refund-cap/deletion regressions; existing payment/status tests; not every concurrent lifecycle interleaving. |
| operations/prices                | Real-envelope component tests: tier clearing, out-of-order selection, edits while pending.                             |
| operations/checkout-links        | CSV round-trip/rejection and canonical import/edit/delete tests; external Drive not certified.                         |
| operations/dispatch              | Existing actual workflow retained; no full fulfillment browser test.                                                   |
| operations/dispatching           | Redirect/module metadata regression; sample UI retired for clothing.                                                   |
| operations/sorting-distribution  | Composite ownership/existing tests considered; full stock-conversion integration matrix remains.                       |
| operations/customers             | Shared directory/payment/refund boundaries considered; full invoice browser matrix not repeated.                       |
| operations/customers/[id]        | Refund ownership/cap/sale-cost review and existing tests; return edit/delete fixture remains.                          |
| operations/business-intelligence | Hook/status/date filters partially reviewed; KPI tests, not independent ledger reconciliation.                         |
| operations/messaging             | Route/shared API inventory; complete delivery/isolation/failure review remains.                                        |
| operations/message-templates     | Service/route trace, duplicate-safe initialization and CRUD/parity tests.                                              |
| operations/post-template         | Singleton/route trace, atomic initialization and edit/parity tests.                                                    |
| operations/notifications         | Service/API/actor-name origin reviewed; selected display names are not trusted audit identity.                         |
| operations/settings              | Invoice/template/accounting/marketplace boundaries partially reviewed; backup hardening, no real-data restore.         |
| employees/dashboard              | Role denial before reads; correct domain endpoint retained.                                                            |
| employees/team                   | Root fields/roles and existing business tests.                                                                         |
| employees/team/[id]              | Salary/detail/restore root API coverage; complete lifecycle not certified.                                             |
| employees/attendance             | Clothing adapter/roles and existing API tests; no payroll-period reconciliation.                                       |
| employees/schedules              | Root roles and existing API/business tests.                                                                            |
| employees/payroll                | Adapter/model/expense-sync ownership and role tests; deduction/period database reconciliation remains.                 |
| employees/cash-advance           | Root roles and API/business tests; full deduction settlement not certified.                                            |
| employees/thirteenth-month-pay   | Server calculation/status tests and roles; no new statutory-policy claim.                                              |
| employees/leave-tracker          | Leave/attendance API roles and tests; accrual/history matrix remains.                                                  |
| employees/employee-loans         | Confirmed local React state only, lost on refresh; existing docs disclose it. No backend invented.                     |
| employees/expenses               | Redirect stub; actual expenses owned by accounting/root API.                                                           |
| employees/settings               | Automation roles/API tests; no live automation run.                                                                    |
| employees/calendar               | Empty shell confirmed; not completed scheduling.                                                                       |
| employees/notifications          | Shared-page inventory; domain completeness not certified.                                                              |
| users                            | SUPER_ADMIN handler reviewed; full user/auth browser matrix not repeated.                                              |

## Verification

Focused checks followed substantive edits. Initial full-unit failures in newly
protected staff tests were repaired using explicit admin fixtures, not a bypass
or a global administrator default.

| Gate                                          | Recorded result                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run guardrails:check`                    | Passed, including generated ACL, documentation commands, and backup schema coverage checks.                                                               |
| `npm run lint`                                | Passed with existing data-fetcher/SplitTab warnings.                                                                                                      |
| `npm run typecheck`                           | Passed after the final cutover and test-fixture changes.                                                                                                  |
| `npm run test:unit`                           | 328 files, 3,857 tests passed. Role fixtures explicitly use authorized users.                                                                             |
| `COVERAGE_ENFORCE=true npm run test:coverage` | 3,857 tests passed; lines/statements 28.26%, functions 45.70%, branches 62.72%. Existing floors enforced unchanged. This is not exhaustive code coverage. |
| `npm run test:hardening`                      | 4 files, 12 tests passed; suite covers backup/restore, not every app security scenario.                                                                   |
| `npm run test:integration`                    | All 5 files, 37 tests passed on isolated PostgreSQL with real middleware and identity triggers; includes the 13-test integrity suite.                     |
| `npm run inventory:ledger:controls`           | Passed on the seeded scratch fixture, not an empty schema or existing business database.                                                                  |
| `npm run accounting:transactions:sanitycheck` | Passed on the scratch fixture: 1 transaction scanned, 0 issues. This does not certify historical business data.                                           |
| Browser/external integrations                 | Not certified; no production URL requested.                                                                                                               |

### Isolated PostgreSQL Setup

Default fresh reset fails P1014: a schema default references external sequence
`public."ClothingInvestorCodeSequence"`. Prisma schema DDL also omits existing
customer/product identity triggers needed by integration. These are test-bootstrap
limitations, not demonstrated new application regressions.

Each run created `clothing_audit_test_<unique>` only on localhost:5433, created
that external sequence, installed DDL from `prisma migrate diff --from-empty
--to-schema-datamodel`, then existing customer definitions and function/trigger
sections of both product identity scripts (columns already existed), and seeded
the standard baseline. DATABASE_URL targeted only the new database. Both
INTEGRATION_ENV_FILE and TEST_ENV_FILE were `/dev/null`, preventing env-file
redirection. A finally block removed only that database. No migration targeted an
existing application database. Default-bootstrap repair is a separate shared
test-infrastructure change.

## Remaining Risks

1. Global soft-delete reads overwrite explicit deletedAt filters. Deleted counts
   and restore reporting outside bounded transit recovery can be misleading.
   Changing all domains' query semantics needs separate shared regression work.
2. Logistics uses generic manual journals with reference/description history.
   Server action idempotency, amount bounds, delivery constraints, and stale
   history need a dedicated accounting fixture. No accounting policy was guessed.
3. Guarded deletion prevents new orphan movements but does not rewrite existing
   orphan COGS/source mismatches. Historical repair needs approval/recovery plan.
4. Return projection is tested, but edit/delete returns and complete stock/COGS/
   refund browser journeys still need explicit fixtures.
5. Local loans, incomplete employee views, payroll period/deduction reconciliation,
   messaging delivery/isolation, and Drive flows are not certified by this work.
6. Some legacy authorization helpers throw plain errors mapped to generic500
   instead of precise401/403. Reviewed user handlers deny before business work;
   their error contract still needs consistency work.
7. PostgreSQL races cover specific interleavings, not every possible race. Clients
   must refresh/retry409; financial writes are not automatically retried.

Review shared ACL/middleware and transaction boundaries first, followed by product/
shipment posting and inventory/net-price formulas. Clothing transit controls stay
opt-in on shared factories; template initialization is intentionally shared and
parity-tested. See the [business logic index](../BUSINESS_LOGIC_INDEX.md).
