# Clothing Integrity Audit And Remediation

Scope: the development checkout, all 40 clothing page paths, and shared services
actually reached by clothing. Deepest implementation/regression work covers
inventory, ledger, transactions, products, shipments, pricing, checkout, sorting,
recurring payments, and the bounded employee/messaging issues listed below.
Inventorying a route does not certify every implementation or business flow.

Initial-batch background: production was not accessed. After that validation, `npm run docker:prod`
was run from the development checkout. Its output shows it selected the
development database container, found no pending migrations, and rebuilt and
restarted the development app and backup scheduler. No production container was
targeted. No schema migration was applied and no historical data repairs were
performed. Those earlier test gates used newly created scratch databases on the
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

## Follow-Up Implementation: F18-F32

These fixes are the subsequent, uncommitted implementation batch. The earlier
development-container restart and local commit do not describe this batch.
No production access, application database migration, historical repair,
build, deployment, commit, or push was performed for the follow-up.

| ID  | Severity | Demonstrated defect                                                                                                                                               | Implemented safeguard / evidence                                                                                                                                   |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F18 | MEDIUM   | Saving sparse sorting rows compressed their positions on reload.                                                                                                  | Preserve zero-based original row indices; return one-based rowNumber to the loader. API sparse-row regression.                                                     |
| F19 | HIGH     | Old sorting loads overwrote a new product; edits could autosave before that product loaded; an old save could cancel a newer debounce. Failed loads looked empty. | Versioned loads, per-product readiness, serialized saves and load-error blocking. Five deferred/timer hook regressions.                                            |
| F20 | HIGH     | Recurring writes captured the environment cutover at module load instead of honoring saved clothing settings.                                                     | Resolve the runtime clothing cutover for create, update, generation and approval; changed-setting regression.                                                      |
| F21 | HIGH     | Catching a duplicate recurring draft insertion left the PostgreSQL transaction aborted before schedule advancement.                                               | Duplicate-safe createMany and actual inserted/skipped counts; real preexisting-draft/schedule-advance regression.                                                  |
| F22 | HIGH     | Concurrent recurring Approve and Skip both read DRAFT and both succeeded.                                                                                         | Conditional DRAFT status updates; losing approval rolls back journal writes. Coordinated real PostgreSQL race and second-line failure rollback.                    |
| F23 | HIGH     | Payroll's 13th-month synchronization caught its own error, allowing both single and bulk paid flows to continue.                                                  | Rethrow to the existing outer failure handler; three hook regressions. This does not make server payroll/deductions/expenses atomic.                               |
| F24 | MEDIUM   | The retained Drive API returned only one page, silently omitting later files; arbitrary folder IDs entered a Drive query.                                         | Follow nextPageToken, validate folder IDs, and fail rather than return partial pages. Mocked API-boundary tests; no Google calls or served sync UI claim.          |
| F25 | MEDIUM   | Operations notification deduplication appended ordinary entries twice in one branch.                                                                              | Exit that branch after adding the group; preserve descriptive/raw preference and unrelated records exactly once.                                                   |
| F26 | MEDIUM   | Dispatch included future ship times, inserted unescaped values into confirmation HTML, and showed green success when every update failed.                         | Closed recent-time window, escaped dialog text, and complete/partial/all-failed result colors/counts. Three hook regressions.                                      |
| F27 | MEDIUM   | Message cursors were not scoped to the visible conversation; timestamp-only pagination omitted equal-timestamp rows and accepted invalid limits.                  | Visible-conversation cursor lookup, bounded integer limits, timestamp-plus-ID keyset ordering. Unit boundaries and real equal-timestamp/foreign-cursor regression. |
| F28 | MEDIUM   | Bounded BI date filters admitted future records.                                                                                                                  | Inclusive start-through-now predicate in the real shared helper; six future-date regressions. All Time semantics unchanged.                                        |
| F29 | HIGH     | Invoice replacement retired the old list before an unprotected insert; malformed rows could fail after that write.                                                | Validate replacement rows before writes; retire, insert and canonical read share a domain-specific Serializable transaction. Real insertion-failure rollback.      |
| F30 | MEDIUM   | Both 13th-month mutation endpoints persisted arbitrary status strings despite the defined four-state enum.                                                        | Reject unsupported values before service calls; retain pending/calculated/approved/paid. Existing API suite plus invalid-input regressions.                        |
| F31 | HIGH     | Applying leave continued after active employee lookup returned null and could create orphan attendance. Future-only requests falsely succeeded too.               | Require an active employee before the future-only no-op or attendance work; clothing and trucking regressions.                                                     |
| F32 | MEDIUM   | All five user-admin handlers returned 500 for the actual Unauthorized/Forbidden guard errors.                                                                     | Shared exact error mapping to 401/403; real session guard tests also preserve super-admin listing and genuine 500 failures. Access policy unchanged.               |

The unchanged shared GM recurring implementation is not certified by the
clothing-specific recurring fixes. Shared invoice, employee and authorization
changes have corresponding caller/parity checks; no domain tables were merged.

## Deciding Code

- [Inventory transform](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts) and [regressions](../../src/modules/clothing/operations/inventory/lib/__tests__/inventoryTransforms.test.ts).
- [Product service](../../src/modules/products/api/service.ts), [direct route](../../src/app/api/products/[id]/route.ts), and [settlement dependencies](../../src/lib/accounting/supplier-settlement-dependencies.ts).
- [Transit source factory](../../src/modules/shipments/api/transitBuildRouteFactory.ts), [reclass factory](../../src/modules/shipments/api/transitReclassRouteFactory.ts), and [accounting source writes](../../src/app/api/accounting/transit-build/route.ts).
- [Transaction lifecycle](../../src/modules/transactions/api/service.ts), [movement ownership](../../src/modules/transactions/api/transactionInventorySync.ts), and [deletion tests](../../src/modules/transactions/api/__tests__/service.deletion.test.ts).
- [ACL](../../src/core/routePermissions.ts), [API middleware](../../src/core/api/middleware.ts), and [role/conflict tests](../../tests/unit/api/clothing-api-authorization.test.ts).
- [Runtime cutover](../../src/lib/accounting/cutover.ts) and [module-isolation tests](../../tests/unit/accounting/cutover.test.ts).
- [Pricing form](../../src/modules/clothing/operations/prices/components/PricesPage.tsx), [checkout persistence](../../src/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage.ts), and [CSV schema](../../src/modules/clothing/operations/checkout-links/lib/csv.ts).
- [Real PostgreSQL suite](../../tests/integration/transaction-data-integrity.integration.test.ts): second-line rollback, idempotent Paid retry/dates, same-row transit recovery, exclusive concurrent sources, and reclass/source consistency.
- [Sorting persistence](../../src/app/api/sorting-distribution/route.ts), [load/save owner](../../src/modules/clothing/operations/sorting-distribution/hooks/useSortingDistributionData.ts), and [async regressions](../../src/modules/clothing/operations/sorting-distribution/hooks/__tests__/useSortingDistributionData.test.ts).
- [Recurring payment owner](../../src/modules/clothing/ledger/recurringPayments/api/service.ts), [service regressions](../../src/modules/clothing/ledger/recurringPayments/api/__tests__/service.test.ts), and [follow-up PostgreSQL suite](../../tests/integration/clothing-persistence.integration.test.ts): duplicate advancement, approval rollback/race, invoice rollback, message cursors and physical return creation/deletion.
- [Invoice replacement factory](../../src/modules/invoices/api/invoiceRouteFactory.ts) and [message pagination](../../src/app/api/conversations/[id]/messages/route.ts). F24 records the earlier Drive boundary tests; the automatic integration was retired on 2026-10-25. Manual invoicing and `{DRIVE_FILES}` messaging remain supported; see [the current checkout contract](../business-logic/clothing/operations-checkout-links.md).
- [Payroll client guard](../../src/app/clothing/employees/payroll/hooks/usePayroll.ts), [active-employee leave guard](../../src/modules/shared/employees/api/applyLeaveRouteFactory.ts), [13th-month routes](../../src/modules/shared/employees/api/thirteenthMonthPayRouteFactory.ts), and [user-admin regression](../../tests/unit/api/users-admin.api.test.ts).

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

| Page                             | Depth / result                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| accounting                       | Overview/routing reviewed; no full authenticated browser run.                                                                                                                                       |
| accounting/ledger                | Projection/API/role trace and accounting tests; source guards changed.                                                                                                                              |
| accounting/journal               | API/role trace and journal API/business tests.                                                                                                                                                      |
| accounting/expenses              | Root/shared service and schema trace; recurring cutover/duplicate/race fixes with PostgreSQL rollback evidence. Manual bulk-update atomicity not certified.                                         |
| accounting/investors             | Authorization, agreement locks, balanced posting, payout/term guards, schedule and statement helper trace; existing investor integration. No external PDF/browser certification.                    |
| accounting/profit-loss           | API/business regressions; not every report basis/date reconciled live.                                                                                                                              |
| accounting/balance-sheet         | API/business regressions; not every historical period reconciled live.                                                                                                                              |
| ledger                           | Alias accounted for; ledger permissions shared.                                                                                                                                                     |
| operations/products              | All mutation entry points traced; accounting tests and PostgreSQL rollback/retry/recovery.                                                                                                          |
| operations/shipments             | Source/reclass/write endpoints traced; structured actual-logistics bounds, rollback, retry and payment-race checks added on 2026-10-25. Ambiguous legacy journals require review.                   |
| operations/inventory             | Projection/adjustment, return/scrap and split/mix regressions; real return creation/deletion for sellable, damaged and scrap preserves original sale/cost. Full browser projection not certified.   |
| operations/transactions          | Net-price/refund-cap/deletion regressions; existing payment/status tests; not every concurrent lifecycle interleaving.                                                                              |
| operations/prices                | Real-envelope component tests: tier clearing, out-of-order selection, edits while pending.                                                                                                          |
| operations/checkout-links        | CSV/import and invoice rollback regressions. Automatic Drive retired; existing port5002 manual copy/link handoff verified with synthetic fixtures on desktop/mobile. No real external delivery.     |
| operations/dispatch              | Import transaction/source trace; future-date, safe confirmation text and failure-result regressions. Per-transaction updates are not one atomic bulk action.                                        |
| operations/dispatching           | Redirect/module metadata regression; sample UI retired for clothing.                                                                                                                                |
| operations/sorting-distribution  | Calculation/API/hook trace; sparse positions, served input validation, stale load and serialized autosave regressions. Full stock-conversion/browser matrix remains.                                |
| operations/customers             | Shared directory/payment/refund boundaries considered; full invoice browser matrix not repeated.                                                                                                    |
| operations/customers/[id]        | Refund ownership/cap/sale-cost trace; real create/delete movement reversals in three buckets. No refund edit endpoint found in the traced API; full browser/payment matrix remains.                 |
| operations/business-intelligence | Served hook, source/status/metric scopes and date helper traced; real-helper future-date/KPI regressions. Not independent ledger reconciliation.                                                    |
| operations/messaging             | Participant/visibility/POST transaction and delete rules traced; scoped cursor/limit tests and real equal-timestamp paging. Polling, attachments and browser delivery remain unverified.            |
| operations/message-templates     | Service/route trace, duplicate-safe initialization and CRUD/parity tests.                                                                                                                           |
| operations/post-template         | Singleton/route trace, atomic initialization and edit/parity tests.                                                                                                                                 |
| operations/notifications         | API deduplication fix/regressions; display-name origin traced, not trusted audit identity. Separate entity feeds retain existing tests.                                                             |
| operations/settings              | Invoice/template/cutover/module-operation source trace and backup hardening. Simulated enable/disable hooks are not wired to installed-module controls. No package install or real-data restore.    |
| employees/dashboard              | Role denial before reads; correct domain endpoint retained.                                                                                                                                         |
| employees/team                   | Root fields/roles and existing business tests.                                                                                                                                                      |
| employees/team/[id]              | Salary/detail/restore root API coverage; complete lifecycle not certified.                                                                                                                          |
| employees/attendance             | Shared validation/employee lookup and apply-leave trace; missing/deleted-employee regressions with trucking compatibility. Payroll reconciliation remains.                                          |
| employees/schedules              | User confirmed one active record per employee/date. Serializable clothing create/move boundary passes both coordinated PostgreSQL races; no schema/history rewrite.                                 |
| employees/payroll                | Clothing paid transitions now atomically synchronize deductions, expenses and linked13th-month state; seven PostgreSQL rollback/retry/race/paid-lock scenarios. Historical repairs remain separate. |
| employees/cash-advance           | Shared CRUD and deduction/schedule/log ownership traced; API/business tests retained. End-to-end balance/replay/settlement not certified.                                                           |
| employees/thirteenth-month-pay   | Shared calculation/persistence/status owner traced; invalid statuses rejected before writes. Valid transition and statutory policy unchanged.                                                       |
| employees/leave-tracker          | Shared CRUD/overlap helper/date schema and attendance application traced. No new leave-day/accrual policy; full history/overlap concurrency remains.                                                |
| employees/employee-loans         | Confirmed local React state only, lost on refresh; existing docs disclose it. No backend invented.                                                                                                  |
| employees/expenses               | Redirect stub; actual expenses owned by accounting/root API.                                                                                                                                        |
| employees/settings               | Automation roles/API tests; no live automation run.                                                                                                                                                 |
| employees/calendar               | Empty shell confirmed; not completed scheduling.                                                                                                                                                    |
| employees/notifications          | Shared-page inventory; domain completeness not certified.                                                                                                                                           |
| users                            | All five admin handlers use tested 401/403 mapping with the real session guard; super-admin read and genuine error tests. Full lifecycle/browser matrix remains.                                    |

## Initial F1-F17 Verification

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

## F18-F32 Verification (Prior Baseline)

These results describe the earlier F18-F32 work, not the 2026-10-25 changes below.
Initial fixture/lint failures were repaired without weakening assertions or
adding authentication bypasses. The integration split preserves every scenario.

| Gate                                          | Current result                                                                                                                                                                                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                | Passed with the existing accounting-data-fetcher and SplitTab warnings. New auth braces fixed; changed integration suites also pass scoped ESLint without warnings.                                                                                 |
| `npm run typecheck`                           | Passed after invoice-fixture compatibility, auth braces and the integration split. Editor checks on the final touched slice found no errors.                                                                                                        |
| `npm run test:unit`                           | 335 files, 3,919 tests passed. Subsequent auth/formatting checks: 4 files, 33 tests passed.                                                                                                                                                         |
| `COVERAGE_ENFORCE=true npm run test:coverage` | 335 files, 3,919 tests passed; statements/lines 28.98%, branches 63.02%, functions 46.12%. Existing floors enforced unchanged.                                                                                                                      |
| `npm run test:integration`                    | 6 files, 45 tests passed on a newly created scratch database. Includes all 13 original integrity tests and 8 follow-up persistence tests; real middleware/identity triggers enabled.                                                                |
| `npm run test:hardening`                      | 4 files, 12 tests passed. This suite covers backup/restore boundaries, not every app security case.                                                                                                                                                 |
| `npm run inventory:ledger:controls`           | Passed on a separate seeded scratch: one SKU, receipt 100, sale 20, physical return 5, write-off 3, sellable/product quantity 82; four movements. Not historical-data reconciliation.                                                               |
| `npm run accounting:transactions:sanitycheck` | Passed with failOnIssues enabled: one seeded transaction scanned, zero issues.                                                                                                                                                                      |
| `npm run guardrails:check`                    | BLOCKED by two earlier-commit checks detailed below. No override, lowered threshold or history change was used.                                                                                                                                     |
| Remaining guardrail components                | Independently passed: documentation command drift, generated permissions, active-module ACL coverage, all 94 script manifest entries, backup coverage for 126 Prisma models. Status sync and legacy-browser guard passed before the guardrail stop. |
| Documentation / diff                          | Updated affected workflow docs and the 40-page depth register; local source/test links and documented commands checked. Whitespace check passed.                                                                                                    |
| Browser / external / existing business data   | Not runtime-certified. No production request, default Playwright reset, existing-database reset, build or deployment in this follow-up.                                                                                                             |

### Guardrail Blockers

The default guardrail script compares HEAD~1...HEAD for files/added risk markers,
but reads current worktree file sizes. It therefore also evaluates the earlier
local audit commit, not only this uncommitted follow-up:

- [Prior product accounting test](../../src/modules/products/api/__tests__/service.accounting.test.ts)
  contains the committed `as unknown as` marker in that comparison.
- [Prior transit factory](../../src/modules/shipments/api/transitBuildRouteFactory.ts)
  is 841 lines, above the 800-line decomposition threshold.

The follow-up initially grew the existing integrity test over the 1,000-line
hard stop. That new violation was resolved by moving eight related tests to the
follow-up suite and sharing the [existing fixture](../../tests/integration/clothing-accounting-fixture.ts).
All 45 integration tests passed for that earlier work. These were the recorded
blockers for that comparison, not the current follow-on gate result below. A
history rewrite/commit is not an authorized means of clearing a comparison-based check.

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

## Approved Follow-On (2026-10-25)

The user approved Drive retirement, payroll/scheduling/logistics safeguards,
safe manual-message verification on port5002, then documentation centralization.
Policy decisions: payroll remains editable pending/approved and locks once paid;
one active schedule per employee/date; logistics posts confirmed actual KPC and
Lalamove charges, never pricing estimates; preserve ambiguous historical journals.

- Automatic Drive endpoint, service-account example/Compose forwards, dependency
  and smoke script retired. Manual invoices, configured URLs and `{DRIVE_FILES}`
  settings/template support remain; no real private environment files were edited.
- [Clothing payroll](../../src/app/api/payroll/route.ts) binds the shared mutation
  store, deductions, expense writes and linked 13th-month state to one Serializable
  transaction. Unchanged paid retries do not replay deductions; changed paid
  records and paid deletion return 409. Cleanup/LWOP writes exclude paid records.
  Other domains keep their own stores; shared expense failures now surface.
- Clothing schedules share a Serializable conflict-check/write boundary. The
  two coordinated PostgreSQL tests arbitrate both create and date-move races.
- [Actual logistics endpoint](../../src/app/api/accounting/shipment-logistics/route.ts)
  posts balanced structured pairs with UUID retry identity, unpaid/clearing
  limits, Delivered/date guards and legacy review locks. UI history fails closed,
  ignores stale responses, sums partial payments and blocks concurrent clicks.
- [Standalone browser check](../../tests/e2e/manual-invoice-message.safe.ts)
  passed on the existing port-5002 bundle with a normally authenticated, explicitly
  approved temporary test user, synthetic APIs and intercepted external actions.
  Clipboard failure/missing links, placeholder expansion, checkout/payment URLs,
  local ticks and desktop/mobile visibility were checked. Every created account
  was removed; no external message, data reset, rebuild or deployment occurred.
- All 147 tracked Markdown documents are retained. Eight files moved under docs;
  root README/CONTRIBUTING and required instructions remain. Local links pass,
  the legal template is unchanged, and dated plans/audits are labeled as evidence.
  The unrelated user-edited refactor execution report was not moved or rewritten.

Focused evidence includes 45 logistics unit/component/authorization checks,
41 cross-domain payroll checks, and 7 payroll + 2 scheduling + 5 logistics
scratch-PostgreSQL scenarios. These are also included in the complete gates below.

### Final Follow-On Verification

| Gate                                                                      | Result                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run guardrails:check`                                                | Passed the default chain, without overrides. Includes command drift, generated permissions, ACL coverage, all 93 script entries and backup coverage for 126 Prisma models.                                                                                      |
| `npm run lint`                                                            | Passed with only pre-existing accounting data-fetcher and SplitTab warnings. Explicit lint on the touched logistics/new regression files passed with zero warnings.                                                                                             |
| `npm run typecheck`                                                       | Passed after the payroll type-contract extraction and test/runtime compatibility fixes.                                                                                                                                                                         |
| `npm run test:unit`                                                       | 337 files, 3,947 tests passed. Two earlier obsolete deduction-update assertions were strengthened to require the paid-record predicate.                                                                                                                         |
| `COVERAGE_ENFORCE=true npm run test:coverage`                             | 337 files, 3,947 tests passed. Lines/statements 29.26%, branches 63.31%, functions 46.30%; original thresholds unchanged.                                                                                                                                       |
| Full integration config                                                   | All 9 files / 59 tests passed on a newly created scratch PostgreSQL database; real middleware and customer/product identity triggers enabled. Only that database was dropped.                                                                                   |
| `npm run test:hardening`                                                  | 4 files / 12 tests passed. This is the repository's backup/restore boundary suite, not every application security scenario.                                                                                                                                     |
| `npm run inventory:ledger:controls`                                       | Passed on a separate seeded scratch: receipt100, sale20, return5, write-off3, sellable/product quantity82; one SKU and four movements.                                                                                                                          |
| `npm run accounting:transactions:sanitycheck -- --scanAll --failOnIssues` | One synthetic paid transaction scanned, zero issues; only the controls scratch database was removed afterward.                                                                                                                                                  |
| Manual browser workflow                                                   | Port5002 normal temporary login and synthetic APIs; clipboard failure/missing link, placeholder/checkout/payment URL, intercepted Messenger handoff, local tick and desktop/mobile visibility checks passed. Temporary accounts removed; no real customer send. |
| Documentation integrity                                                   | All147 Markdown retained; only root README/CONTRIBUTING and required instructions outside docs. Local link and command checks pass; legal-template hash unchanged.                                                                                              |

The default guardrail compares committed paths/added lines, not all uncommitted
files. A separate worktree size/risk-marker check identified the new payroll
adapter crossing; its types were extracted with public exports preserved and
41 cross-domain regressions passing. The already-oversized logistics component
was reduced from its 1,106-line baseline, not certified as fully decomposed.
Existing large tests and historical technical debt remain visible rather than
being hidden with threshold/base overrides.

Overlapping terminal unit/coverage attempts were interrupted and were not counted
as passes. The reported totals come from a complete serial rerun with exit0 for
both gates. No commit, push, production request, application rebuild/deployment,
existing-database reset or historical financial repair occurred in this follow-on.

## Remaining Risks

1. Global soft-delete reads overwrite explicit deletedAt filters. Deleted counts
   and restore reporting outside bounded transit recovery can be misleading.
   Changing all domains' query semantics needs separate shared regression work.
2. Guided logistics now has structured identity and tested financial guards.
   Legacy manual history is preserved and locks guided posting for review; no
   historical mapping/unlock, refund/credit/reversal policy or COGS rewrite was
   implemented. Arbitrary manual journal entry remains a separate accounting path.
3. Guarded deletion prevents new orphan movements but does not rewrite existing
   orphan COGS/source mismatches. Historical repair needs approval/recovery plan.
4. Real PostgreSQL return creation/deletion now covers sellable/damaged/scrap
   movements and unchanged original sale/cost. No edit endpoint was found in the
   traced clothing refund API; full stock/COGS/refund browser journeys remain.
5. New clothing payroll transitions are atomic and paid records are locked.
   Previously inconsistent paid records are not repaired by unchanged retries;
   blindly replaying deductions remains unsafe. Historical reconciliation,
   paid reversal policy and atomicity across other domains need separate review.
6. Clothing schedule races are guarded by Serializable route transactions, not
   a new schema constraint. Historical duplicates and direct database writes
   outside that route are not repaired; other domain factories retain their own
   stores and have not been certified for this concurrency contract.
7. PostgreSQL races cover specific interleavings, not every possible race. Clients
   must refresh/retry409; financial writes are not automatically retried.
8. Local-only loans and the empty employee calendar were not invented into
   complete features. The shared employee notification feed's domain completeness
   remains unverified. Messaging polling/attachments/recipient
   delivery, real external invoice sending/PDF generation, user
   photo/restore and every employee lifecycle are not certified by source and
   mocked checks. Selected notification display names remain non-authoritative.
   The retired Drive API is not an external integration to certify. The safe
   manual browser check does not prove recipient delivery or popup behavior
   across every browser, nor certify a fresh runtime bundle of these edits.
9. Inventory and financial controls on scratch fixtures do not reconcile existing
   development or historical business data. No repair/backfill was authorized.

Review shared ACL/middleware and transaction boundaries first, followed by product/
shipment posting and inventory/net-price formulas. Clothing transit controls stay
opt-in on shared factories; template initialization is intentionally shared and
parity-tested. See the [business logic index](../BUSINESS_LOGIC_INDEX.md).
