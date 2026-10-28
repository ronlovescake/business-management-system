# Clothing Supplier Credit And Reconciliation Checklist

Created: 2026-10-27. Updated: 2026-10-28. Status: 26/26 mandatory scenarios complete with scoped actual workflow evidence. All nine final gates pass in `/tmp/bms-reconciliation-XMrLWS/result.json`: 4,514 unit, 90 integration and 12 hardening tests, enforced coverage and inventory/accounting controls. Current-source I01/I06/I07/I08 regression runs also pass; see Final Completion Evidence below. Completed scenarios were not reopened by those regression checks. Owned databases were removed and verified. Unresolved financial findings remain explicit and separate from scenario completion. No business-data repair, business-database migration or deployment is included.

## Purpose And Tracking

Make supplier selection understandable, fix Manila posting-date validation, and prove that Products, Transactions, Inventory and Accounting describe the same business events. Use plain-English explanations and worked examples throughout the analysis and handoff.

- [x] Create this repository checklist, separate from session memory and existing implementation plans.
- [x] Complete the scoped analysis, approved changes and 26 workflow simulations below with recorded evidence. Separate unresolved policy/findings remain documented, not waived or represented as repaired.

Check an item only when its work and applicable verification are complete. Existing code, earlier reports or a previously green suite are not proof that a new scenario passed. Record failures, unsupported behavior and blocked policy decisions explicitly; never mark them passed. Update this file incrementally after each verified milestone.

Primary routes:

- `/clothing/operations/products`
- `/clothing/operations/transactions`
- `/clothing/operations/inventory`
- `/clothing/accounting/ledger`
- `/clothing/accounting/expenses`
- `/clothing/accounting/profit-loss`
- `/clothing/accounting/balance-sheet`

Also verify Journal, Balance Sheet, P&L, accounting dashboard and BI where they consume the same events. Customers owns actual customer refund execution; Shipments owns actual logistics and delivery capitalization. Include these dependencies without turning the work into unrelated module redesign.

## 1. Baseline And Business Rules

- [x] Inspect the current worktree and preserve unrelated changes, existing plans and prior implementation evidence.
- [x] Re-read the [business-rule standard](../BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md), [workflow](../business-logic/clothing/operations-workflow.md), [accounting policy](../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md) and [timezone rules](../DATE_TIME_TIMEZONE_RULES.md).
- [x] Verify current code against the [Products](../business-logic/clothing/operations-products.md), [Transactions](../business-logic/clothing/operations-transactions.md), [Inventory](../business-logic/clothing/operations-inventory.md) and [Ledger](../business-logic/clothing/accounting-ledger.md) contracts. Separate observed code, intended policy and deployed behavior.
- [x] Name the accountable owner, approved invariants and owning enforcement services. Ask the owner about unresolved rules instead of inferring approval from code.
- [x] Trace create/edit, single/bulk/import, status changes, cancellation, refund, deletion/restoration, jobs and retry paths. Check shared consumers and record intentional general-merchandise differences. The findings and business-rule record distinguish supported boundaries from remaining legacy gaps.
- [x] Establish a verified isolated database and application instance with synthetic fixtures, required migrations and realistic opening balances. Do not query or mutate business/production data for simulations.
- [x] Record the isolated runtime clothing cutoff, application/server/browser timezone assumptions and test version. Earlier runs record the January 17 configured cutoff; X04 explicitly changes only its owned Clothing cutoff to September 30 and preserves GM. Browser dates use Asia/Manila, with UTC/Manila frozen-clock controls. Vitest 1.6.1 and Prisma 5.22 are recorded in execution logs. No target-environment cutoff or deployed version is inferred.

## 2. Supplier Selection Without Guessing

- [x] Replace the Add Product free-text supplier field with an established searchable dropdown/creatable pattern labelled Supplier.
- [x] Reuse authorized existing data queries to list suppliers recorded on active products or issued credits. Deduplicate using existing whitespace/case normalization without rewriting historical identifiers.
- [x] Allow explicit new supplier entry for ordinary purchases. Verify search, keyboard selection and blur do not erase an accepted value or silently create one.
- [x] Keep Supplier distinct from Supplier credit reference. Show credit reference, source product code and available PHP amount on credit choices; never infer supplier identity from a document reference.
- [x] Filter selectable credits to the chosen supplier, PHP currency, positive remaining balance and eligible target. Clear incompatible credit/amount when supplier changes.
- [x] Keep Credit to apply (PHP) as a separate amount field after credit selection. Preserve purchase Grand Total, funding split, amount limits and stable request identity.
- [x] Cover loading, no matches, exhausted credit and fetch failure/retry. Do not expose Inventory follow-up-only amounts as spendable credits.
- [x] Preserve administrator permissions and existing credit-owned product locks. Verify shared Edit Product behavior and general-merchandise isolation.

Example: select Supplier A, choose its issued credit showing a PHP 5,000 balance, then enter PHP 3,000 in Credit to apply. A PHP 10,000 purchase still costs PHP 10,000, needs PHP 7,000 other funding and leaves PHP 2,000 credit. This example requires an actual issued credit, not an Inventory follow-up note.

## 3. Manila Posting Dates

- [x] Use the shared Manila calendar-date helper for both the form default and the supplier service's latest permitted day.
- [x] Compare calendar dates consistently while preserving date-only storage. Do not compare UTC-midnight day buckets against a Manila end-of-day instant or add manual eight-hour offsets.
- [x] Preserve strict invalid-date rejection, authoritative cutoff and purchase/credit/application chronology across all callers.
- [x] Give distinct invalid-date, before-cutoff and future-date errors, showing applicable bounds. Keep backend validation authoritative and align the picker where bounds are available.
- [x] Freeze time at `2026-10-27T15:59:59Z`: October 27 is Manila today; October 28 is future.
- [x] Freeze time at `2026-10-27T16:00:00Z` and `2026-10-27T16:30:00Z`: October 28 is Manila today and accepted when other prerequisites hold; October 29 is future.
- [x] Test cutoff October 27: reject October 26 and allow October 27 subject to source dates. Cover impossible dates, leap days, a cutoff later than today and UTC/Manila environments; restore clocks/settings after tests.

## 4. In-Depth Reconciliation Analysis

- [x] Map each scoped event from UI action to API/service, database writes, inventory projection and every affected accounting report. Record identity, date, quantity, cost, amount, actor and source keys.
- [x] Define a shared comparison scope: product identity, shipment/lot, as-of time, Manila calendar boundaries, accounting cutoff, opening balances and valuation basis.
- [x] Reconcile scoped quantities through ordered, travelling, received, reserved, sold, returned, damaged, scrapped, transferred, assembled and missing states. Distinguish received quantity from current stock and prevent double allocation.
- [x] Bridge accounting stock cost: opening balance plus eligible capitalized purchases/logistics, less sold cost and write-offs, plus valid returns and approved dated corrections. Explain any unposted or unsupported event.
- [x] Include reserved, damaged-hold and work-in-progress ownership where policy requires it; available-for-sale quantity alone is not the whole accounting asset.
- [x] Reconcile supplier payment/debt, Inventory in Transit, Stock on Hand, issued credits, applications and remaining credit. Delivery status alone must not imply financial capitalization.
- [x] Reconcile customer receipts, outstanding receivables, deposit retention, refund approval, payouts and remaining refund obligation. No approval-only cash outflow or duplicated receipt/revenue.
- [x] Verify sold/returned cost snapshots, actual logistics, dated cost correction, missing valuation and approved zero-cost goods. Do not silently guess or rewrite historical cost.
- [x] Compare Ledger, Journal, Balance Sheet, P&L totals/details, dashboards and applicable exports at the same cutoff. Search must not redefine account balances.
- [x] Review existing quantity controls and accounting sanity checks for coverage gaps; they are not by themselves a financial stock reconciliation.
- [x] Identify legacy code-only/ambiguous product links, manual duplicates, soft-deleted events, cutover gaps and concurrent-read inconsistencies. Specify detection and recovery needs, not automatic data repair. This is scoped analysis, not a live-data impact count or repair approval.
- [x] Produce a plain-English findings record: expected rule, observed behavior, scenario, owning code, discrepancy, financial/quantity effect, proposed correction and required owner decision.

Important distinctions: Inventory selling-price value is not Ledger stock cost; reservations do not by themselves sell goods; supplier credit is not Cash; refund approval is not payment; cancellation is not a physical return. Internal agreement is not a bank reconciliation or physical stock count. The goal is explained agreement at a defined scope, not an unsupported promise that all screen numbers will always be identical.

Worked baseline: 100 units purchased for PHP 10,000 plus PHP 2,000 eligible capitalized logistics gives PHP 120 per unit. Sell 20: stock cost PHP 9,600, sold cost PHP 2,400. Reserve 10 of the remaining 80: 70 available for another buyer but PHP 9,600 remains owned stock cost. Physically return five sold units to sellable: 85 units and PHP 10,200 stock cost, with net sold cost PHP 1,800, assuming no other movements or cost changes.

## 5. Real Workflow Simulation Protocol

- [x] Extend existing tests/helpers and browser infrastructure where suitable. Inspect reset/setup scripts before execution; do not point them at an existing business database.
- [x] Use authenticated real browser actions against the isolated application/database for complete workflows. Mocked/intercepted APIs and unit tests are supplementary, not completion evidence for these simulations.
- [x] Start each scenario with documented opening quantities, funding, costs, payments and report balances. Use stable fixture identities and owned-record cleanup.
- [x] After each business event, assert its persisted records, status/history, inventory buckets, credit balance, customer debt, refund obligation and relevant financial entries. Check amounts, dates and source ownership, not just success notifications.
- [x] Reload/reopen screens to verify persistence. Exercise critical desktop/mobile flows and inspect screenshots, traces, console errors and exports where relevant. Recorded mobile collection/payout/supplier flows supplement the full desktop cost/conversion runs; this does not certify every screen at every viewport.
- [x] Save expected-versus-actual results and evidence paths in section 8. On failure, identify the owning boundary and add a focused regression before the smallest approved correction.
- [x] Verify cleanup of only owned fixtures. Preserve unrelated records and failure evidence; an unsupported or blocked scenario is not a passing scenario.

## 6. Mandatory End-To-End Scenarios

Each checkbox requires the complete action sequence and cross-module assertions, not a standalone API/function test. Do not interpret these planned cases as claims that every workflow is currently supported.

### Customer Cancellation, Voiding And Refunds

- [x] C01: Create unpaid reserved order -> cancel -> verify reservation release, preserved history, no refund obligation and no cash/revenue invention.
- [x] C02: Create PHP 1,000 order -> collect agreed PHP 200 original 20% deposit -> collect PHP 300 installment -> cancel retaining only PHP 200 -> verify PHP 300 refund obligation and unchanged Cash on approval.
- [x] C03: Continue C02 -> pay PHP 100 through Customers -> verify PHP 200 pending -> pay PHP 200 -> verify zero pending, two payout records and exactly PHP 300 total cash outflow.
- [x] C04: Collect deposit/installments -> approve emergency full-refund cancellation -> pay refund -> verify all eligible remaining collections refunded and nothing also forfeited. Repeat with an original 10% deposit.
- [x] C05: Fully pay an order awaiting pickup/checkout -> verify no payment-overdue cancellation -> approve a discretionary cancellation -> execute refund separately and preserve original receipt history.
- [x] C06: Collect deposit and installments -> supplier-failure Voided -> approve full remaining refund -> pay in stages through Customers -> verify zero retention, correct pending balances and no invented delivery/return. Reject an attempt to retain the deposit on Voided.
- [x] C07: Void an unpaid order -> verify no refundable money or cash movement and correct reservation treatment.
- [x] C08: Record fulfilled/sold goods, including Prepared plus fully paid behavior -> cancel -> verify stock is not automatically restored -> record actual physical return separately. Do not assume a generic closed-order edit can reopen history. Both Prepared/fully-paid and Shipped real UI variants pass in `/tmp/bms-reconciliation-XuyGJY`; zero-money return preserves payout/sale history and original cost, with replay/conflict/excess-return controls.
- [x] C09: Ship a PHP 1,000 A/R sale with PHP 200 collected -> approve cancellation -> verify PHP 800 debt credit separate from PHP 200 refund obligation -> pay PHP 200 and verify no PHP 1,000 cash refund.
- [x] C10: Exercise earlier partial refunds, unknown legacy deposit agreement, unexplained legacy paid balance and insufficient remaining refundable money -> verify explicit review/rejection without losing history.
- [x] C11: Refund without goods returned -> verify cash/refund changes but no restock. Return goods to sellable, damaged hold and scrap in separate fixtures -> verify the correct quantity and cost treatment for each.
- [x] C12: Attempt excess/duplicate payout, new collection on closed order, financial identity edits, deletion/restoration and unsupported reopening -> verify server enforcement, auditability and unchanged completed events. Corrections must follow an approved path, not erase executed payouts.

### Inventory, Purchases And Supplier Credit

- [x] I01: Buy Paid and Unpaid products -> confirm shipment -> Transit Build-Up -> reserve reseller orders -> receive -> reclass/capitalize -> fulfill -> verify quantity and financial bridges at every step. Settle the Unpaid purchase once, without buying the stock twice.
- [x] I02: Order 1,000 -> receive 880 -> record 120 Supplier Short -> record PHP 5,000 follow-up credit -> attempt next-purchase selection. Verify the unsupported partial-credit connection is explicit; never issue the full product Grand Total as a workaround. Full real purchase/shortage sequence passes in `/tmp/bms-reconciliation-cD4S5n`; the API rejects whole-product issuance with 409 and unchanged credits/reports.
- [x] I03: Eligible entirely unreceived funded product -> issue full saved Grand Total credit -> verify zero physical stock and preserved original cash/card funding -> partially apply to next purchase -> apply remaining balance to another eligible purchase. Verify totals and no cash refund.
- [x] I04: Apply credit when creating a purchase and to an eligible saved unposted purchase -> verify gross cost unchanged, correct remaining payment/payable and no duplicate Transit Build-Up. Reject wrong supplier/currency, insufficient balance, self-funding and conflicting requests.
- [x] I05: Entire delayed product -> transfer to an existing shipment -> verify source linkage/audit updated, original amounts/dates/funding preserved and no second payment. Verify partial/fulfilled/posted restrictions.
- [x] I06: Receive additional free goods, transfer stock and reverse eligible adjustments -> verify quantity conservation, no invented supplier charge and explicit approved valuation. Owner-approved separate zero-acquisition-cost units retain the ordinary customer selling price. `/tmp/bms-reconciliation-9BffNQ/result.json` passes actual1,000 at PHP20 plus100 free, atomic1,100-unit transfer, eligible reversal, rollback/race/replay/history checks and sales of all1,100 at PHP50: PHP55,000 revenue/PHP20,000 COGS; owned database removed and verified.
- [x] I07: Reserve/fulfill/return bundle, mix-and-match and split-child orders -> verify component/parent quantities and costs are neither omitted nor counted twice. Owner approved exact original components/costs and explicit split-piece acquisition costs. `/tmp/bms-reconciliation-sGLyp9/result.json` passes actual purchases, UI definitions/assembly, reservations, fulfillment, component-selecting physical returns, immutable histories, partial loose pieces, complete original-set rebuild once, finalization rollback, bounded last-piece race and five-report conservation; owned database removed and verified.
- [x] I08: Apply actual logistics and dated sold/unsold cost corrections -> return previously sold goods -> verify corrected carrying cost, preserved earlier reports, no duplicate capitalization/payment and visible missing/invalid-cost exceptions. Actual UI/API lifecycle passes in `/tmp/bms-reconciliation-PwnTp1/result.json`: PHP200 actual freight accrued/paid/capitalized once, PHP20-to22 correction allocates PHP8 sold/PHP192 unsold, later original-sale return restores PHP22, all five earlier reports and stored sale snapshots unchanged, missing/invalid costs visibly incomplete, owned database removed and verified.

### Failure, Concurrency And Historical Reporting

- [x] X01: Replay collection, cancellation approval, payout, credit issue and application after uncertain responses -> each event occurs once; changed details under the same request identity conflict.
- [x] X02: Use independent database connections for competing collections, payouts and credit applications -> limits hold, safe retries preserve amounts and no partial writes remain.
- [x] X03: Inject failures after financial insertion/balance reservation and before final persistence -> verify complete rollback of requests, payments/refunds, obligations, credits, journal and relevant inventory writes.
- [x] X04: Run receipt -> cancellation approval -> partial payout -> physical return across different days/months and accounting cutover -> verify historical as-of output, brought-forward balances and exports without silently rewriting earlier events. `/tmp/bms-reconciliation-LjoQBc/result.json` passes actual September29 deposit200, September30 explicit opening copied from verified prior closing, October2 installment800, October3 fulfillment, current server-dated approval1000, actual partial payout300 and separate half-unit physical return. Cash opening200 + movement500 = closing700; stock995, COGS5 and payable700. All five earlier/cutover reports and original receipts/sale remain unchanged; downloaded Cash CSV matches true running balances; GM cutoff unchanged and owned database removed and verified.
- [x] X05: Change date/account/search filters and compare all report surfaces at the same scope -> balances remain authoritative; incomplete valuations/postings are visible rather than falsely reconciled.
- [x] X06: Verify anonymous/nonadministrator/administrator permissions in UI and API, including bulk/import/manual entry paths; do not weaken authorization to run fixtures.

## 7. Implementation, Gates And Completion

- [x] Complete supplier/date fixes with focused tests immediately after each first substantive edit.
- [x] Classify reconciliation findings as defect, intentional difference, unsupported workflow, missing data or unresolved policy. Obtain approval before broadening behavior, schema or financial policy.
- [x] Implement only approved corrections at their owning boundaries and rerun their failing scenarios. Analysis/testing scope does not authorize every possible remediation.
- [x] Fix premature received-stock display using the active linked shipment at the Clothing products read boundary. Both Paid/Unpaid stock sequences retain zero received until explicit delivery; no data or financial postings are rewritten. Nine new regressions plus surrounding suites pass 59 tests. I01's later settlement-date repair and complete final-source replay are recorded separately below.
- [x] Run all nine required final gates: `/tmp/bms-reconciliation-XMrLWS/result.json`; 364 unit files / 4,514 tests, 12 integration files / 90 tests, 4 hardening files / 12 tests, enforced coverage, guardrails, lint, typecheck, inventory controls and accounting sanity. All pass, with verified owned-database removal. Existing warnings remain visible. These are synthetic checks, not real-book certification.
- [x] Record current blockers honestly; do not assume historical guardrail failures remain present, bypass safeguards, disable tests or lower coverage.
- [x] Update affected contracts and the required business-rule change record with owner, invariant, entry points, sibling-domain differences, actual results and remaining risks.
- [x] Provide concise operator examples, explicit unsupported workflows and deployment prerequisites in the notes below. No deployment or live-reconciliation claim is made.
- [x] Close the 26-scenario implementation/analysis plan with actual scoped evidence and final gates. Independent expense-history, account-classification and unresolved policy findings remain open in the report; their remediation is not claimed or waived. Internal tests do not certify real-world funds or stock.

## 8. Evidence And Open Decisions

Add rows as work proceeds. Record exact test/scenario IDs, commands, results, environment and evidence files; distinguish executed checks from historical evidence.

The table below retains the initial October 27 milestones. The fresh October
28 gate counts and expanded accounting evidence are recorded afterward; the
initial 44 supplier tests and 4,403 unit tests are historical, not current totals.

| Item/Scenario                    | Status                                                   | Expected And Actual Result                                                                                                                                                                                                        | Test/Trace/Report Path                                                                                                                | Environment/Date                                                                                                    | Remaining Risk Or Decision                                                                                |
| -------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Supplier date service            | Pass                                                     | 44 tests under both UTC and Asia/Manila; midnight, invalid/leap dates, saved cutoff, chronology                                                                                                                                   | `src/modules/products/api/__tests__/supplier-resolution.test.ts`                                                                      | Development, 2026-10-27                                                                                             | No deployment claim                                                                                       |
| Supplier dropdown                | Focused pass                                             | 11 component tests and 12 intercepted desktop/mobile checks; loading/retry, eligibility and readable selected credit                                                                                                              | `npm run test:browser:supplier-credit`; `/tmp/bms-supplier-browser-artifacts`                                                         | Synthetic API fixture                                                                                               | Supplementary, not financial E2E evidence                                                                 |
| Real customer/supplier workflows | Passing executed slices                                  | Nine UI-created orders; 10%/20% refunds, A/R debt separation, mobile payouts, closed-order guards; posted build/transfer; 5,000 credit applied 2,000 + 3,000 to new/saved gross 3,000 purchases; zero-stock and permission checks | `node tests/e2e/clothing-reconciliation.browser.cjs`; `/tmp/bms-reconciliation-13yk1M/result.json`, traces/screenshots/per-stage JSON | Unique scratch DB localhost:5433; real credentials; no bypass; browser Manila; configured cutoff Jan 17; 2026-10-27 | Remaining branches, full delivery/valuation, dashboard/export checks still open                           |
| Integration races/rollback       | Pass                                                     | 30 tests in customer-money, supplier-credit and transaction-save suites, including new deletion rollback and movement ownership                                                                                                   | `node tests/e2e/clothing-reconciliation.browser.cjs --integration-only`; `/tmp/bms-reconciliation-QckCtJ`                             | Unique scratch DB                                                                                                   | Supplementary to X01-X06 browser requirements                                                             |
| Required quality gates           | Pass after deletion repair                               | Guardrails/lint/typecheck; 4,403 unit, 89 integration, 12 hardening; enforced coverage; inventory controls; accounting sanity                                                                                                     | `node tests/e2e/clothing-reconciliation.browser.cjs --gates`; `/tmp/bms-reconciliation-RRthXz/result.json` and logs                   | Unique scratch DB; 2026-10-27                                                                                       | Existing lint and test-file size warnings; synthetic controls are not real stock/books certification      |
| Cross-module analysis            | In progress                                              | Verified money/credit report bridges and documented distinctions/gaps                                                                                                                                                             | [Findings record](../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)                                                          | Source plus isolated executions                                                                                     | Remaining quantity/cost/entry-point/report branches still required                                        |
| Partial-shortage usable credit   | Unsupported connection verified; owner decision required | Actual Inventory 120-short/880-stock and 5,000 follow-up persisted; no issued credit or ledger asset created                                                                                                                      | I02 evidence in `/tmp/bms-reconciliation-13yk1M`; findings record                                                                     | Seeded original purchase/receipt; real adjustment/follow-up UI; no live data touched                                | Approve allocation, funding, valuation, limits and correction design before implementing partial issuance |

Earlier nine-case full real run: `/tmp/bms-reconciliation-cN7UnP/result.json` and `trace.zip`.
Subsequent focused customer evidence: `--returns-only` passed in
`/tmp/bms-reconciliation-Ysp78F` (four UI-created/paid/shipped orders; real Refund
modal, money-only/sellable/damaged/scrap). Each paid 100; only sellable restored
availability. Sellable/damaged returns preserved the 10/unit original cost;
scrap was not recapitalized. Coherent funded/reclassified opening stock was
seeded explicitly, not represented as a completed purchase flow. Prepared alone
does not release the original deposit under current recognition policy; ordinary
return fixtures correctly use actual Shipped status.

C10 `--review-only` passed in `/tmp/bms-reconciliation-j73fud`: unknown agreement
and unexplained legacy adjustment reject with review; a real prior refund of
900 from 1,000 collections leaves 100. Retaining the original 200 rejects; actual
UI emergency approval/payout pays only 100, preserving both refund records and
the sold-stock history. Scratch databases were removed and verified absent.

C05 `--paid-overdue-only`: `/tmp/bms-reconciliation-UJ59nB`. Old invoice history
was seeded on the owned order; actual UI collections fully paid it and Prepared
persisted. The actual Transactions Due Dates tab showed a seeded unpaid overdue
positive control but excluded the paid order. Its subsequent discretionary
cancellation and separate 1,000 payout preserved original receipts/sold stock.

X02: `/tmp/bms-reconciliation-vLSged` (collection/payout) and
`/tmp/bms-reconciliation-Dxu5fy` (supplier). Temporary database barriers proved
two independently blocked application connections before release. One of two
600 collections against 800 remaining succeeded; one of two 400 payouts against
600 pending succeeded; one of two 600 applications against 1,000 credit succeeded.
No losing request/funding survived. Remaining amounts, retries and reports passed.
Only owned supplier race fixtures were removed, restoring exact prior reports.

X03: `/tmp/bms-reconciliation-1NJ3vY` and `/tmp/bms-reconciliation-Dxu5fy`.
Temporary database triggers failed collection/cancellation/payout at final
request persistence and supplier application after insertion. Entire financial,
parent balance, liability, stock, credit and funding snapshots plus all five
reports were unchanged. Normal UI operations completed after trigger removal.

Earlier partial X05 evidence: `/tmp/bms-reconciliation-1NJ3vY`. Real Transactions card and
header lists, Accounting and BI agreed at pending/paid 300/0, 200/100 and 0/300.
BI paid trends/counts passed. Actual Ledger date/account/search filters and CSV
retained 50 brought-forward, 550 full Cash closing and 250 filtered receipt balance;
prior-only Equity remained selectable. Owned prior-period entries were removed,
restoring exact report payloads. Expanded report/valuation evidence below now
completes the stated filter/visibility scopes, not all historical accounting.
Nine UI-created order sequences passed, including both 10% and 20% emergency
refunds, A/R debt credit of 800 versus payout of 200, and Prepared-paid sold-stock
preservation. C06 payouts passed at 390px mobile width after closing the navigation
panel using its normal toggle. Authenticated HTTP payout replay, conflicting
payload, extra payout and closed-order deletion checks preserved all five reports.
The earlier deletion regression failed at `/tmp/bms-reconciliation-F6mJFh` before
the owning-service repair; 35 focused deletion/API/audit tests now pass. Actual
HTTP checks also reject new collection, single/bulk financial edits, reopening,
paid closed-status import and restore of a nondeleted closed order. Historical
deleted-row restoration was unverified in that earlier run; the later C12 probe
below now proves fail-closed preservation, not a recovery workflow. Captured real UI collection and
cancellation requests now replay successfully; changed amount/reason under the
same key returns 409. Counts, saved events and all five reports remain unchanged.
Together with payout, issue and application replays, this closes X01.

I05's sold and reclassified rejection fixtures also pass with HTTP 409 and
unchanged product/audit/report state, alongside the repaired partial-shortage
case. Positive transfer uses the actual UI; only the negative guard fixtures
were seeded, then removed by owned ID. Supplier-only evidence:
`/tmp/bms-reconciliation-WqjcuO`; the full run repeats the same matrix.

I01 was explicitly resumed on October 28; the owner then authorized fixing the
false received-stock result. The root cause was blank/stale product-level status
in the raw products collection while the real linked shipment was In Transit.
Clothing's owning collection reader now batches active shipments and returns
their nonempty status. Both Paid and Unpaid purchases show zero received / 20
transit reserved / 80 transit unreserved, then 100 received / 20 reserved / 80
sellable only after explicit Delivered, then 20 sold / 80 available. Cost 10,000
becomes stock 8,000 plus COGS 2,000, with revenue/A/R 4,000 and profit 2,000 per
purchase. No automatic financial reclassification or stored status rewrite occurs.

`/tmp/bms-reconciliation-VsjNgV/result.json`, stage JSON, stock screenshots and
failure trace prove these scoped results. Paid completes; Unpaid then creates
two settlement lines but fails because the first inspected date is October 27,
not Manila October 28. The writer uses UTC calendar parts for today's posting.
At that historical failed attempt the financial-date defect was unchanged and
later settlement/replay checks had not run. Its success is false with verified
owned DB removal. Its 19/26 status is superseded by the later settlement repair
and actual completed I01 runs; it is not the current checklist status.
See [root cause and evidence](../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#i01-transit-fix-and-remaining-settlement-failure).

The helper now checks actual save confirmation/POST, real auto-receipt metadata
and virtualized grid navigation. Its fulfillment assertion preserves the reserve
row plus `reserved -> sold` history and checks zero net reserved quantity instead
of incorrectly requiring reserve-row deletion. Nine new source regressions and
surrounding inventory tests pass 59 total; the initial failing cases reproduced
100 received before the fix. Unlinked/unmatched/blank-linked-status legacy rows,
GM, write paths, financial dates and amounts are intentionally unchanged.

Earlier deletion-repair gates: `/tmp/bms-reconciliation-RRthXz/result.json` and logs.
Guardrails, lint, typecheck, 4,403 unit tests, 89 integration, 12 hardening,
enforced coverage, inventory controls and accounting sanity all passed after the
deletion repair. The integration suite includes scoped draft deletion, owned
movement preservation and rollback after movement deactivation. Existing lint
warnings and a 527-line integration-test size warning remain. Control commands
checked the synthetic baseline, not real stock/books. Earlier failed/rerun
artifacts are retained separately; the table uses the final passing counts.

Latest supplier rerun: `/tmp/bms-reconciliation-CX4Bot/result.json`, trace and
per-stage reports; unique localhost:5433 scratch database removed and verified.
I04's real create/saved application paths plus wrong-supplier, foreign-currency,
insufficient-balance, self-funding, posted-target and conflicting-request
rejections passed. Gross cost, credit balance and reports stayed authoritative.
The partial-shortage whole-transfer check first failed with HTTP 200 in
`/tmp/bms-reconciliation-CblrEu`; the shared unreceived-product guard now rejects
that action with HTTP 409 and no shipment/audit/report change. All 48 focused
supplier tests pass, preserving full-shortage and completely reversed-shortage
behavior. Its sold/reclassified branches subsequently passed in the full run;
the later fresh nine-gate pass is recorded below.

The supplier sequence now posts the original Transit Build-Up through Products,
transfers the whole delayed product with one audit and unchanged funding, issues
5,000 credit, verifies zero actual stock in Inventory using All Product Codes,
applies 2,000 during new-purchase creation, then applies 3,000 to a saved unposted
purchase through Edit Product at mobile width. Both gross purchases remain
3,000; five reports agree. Issue/application replay and conflict checks pass.
Real anonymous/USER supplier APIs return 401/403; USER sees Access Restricted
with no Add Product control. The expanded role matrix below closes X06.

The earlier seeded I02 proof is superseded by `/tmp/bms-reconciliation-cD4S5n`:
real shipment/product creation, 1,000-unit purchase and build, delivery, 120 short,
880 remaining units, persisted 5,000 follow-up and next-purchase supplier selection.
Whole-product credit issuance returns the explicit partial-shortage 409; no credit
is created and all five reports remain unchanged. The new form regression first
failed because refreshing a quantity-reader callback erased typed targets; explicit
open/product selection now initializes targets without overwriting active input.
The earlier C08 physical-return gap is superseded by `/tmp/bms-reconciliation-XuyGJY`:
Prepared/fully-paid and Shipped real orders retain sold stock through cancellation
and actual payout, then the separate Customers action restores one unit at its
original PHP10 cost. Cash, approval, payouts and sale history are unchanged;
stock carrying cost increases10 and COGS decreases10 only on physical return.
Same-key replay adds no return, changed details conflict and over-return rejects.

The audit suite now distinguishes corrected A02/A03/A04/A05/A07 invariants from
unresolved A01/A06/A08 probes. Actual allocation preservation, atomic import
rollback, immutable fulfilled movements and recorded-stock limits have focused
and real-workflow evidence. Generic paid-amount edits, shipment deletion and
historical import totals remain review findings; passing their defect probes is
not certification. Legacy no-receipt fallback, unpaid closed-status import and
allowed status metadata changes are not represented as a new universal policy.

### Expanded Accounting Evidence (2026-10-28)

Details and owning-code references:
[Expenses/P&L/Balance Sheet analysis](../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#expanded-accounting-analysis-2026-10-28).

| Scope                                     | Expected = Actual / Finding                                                                                                                                                                                                                                         | Evidence / Remaining Limit                                                                                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expenses lifecycle                        | Pending 100 posts nothing; approval accrues payable 100, no Cash; paid Cash reduces Cash 100 with expense still 100; paid CARD 40 gives total expense 140/card payable 40.                                                                                          | Real UI plus PATCH/batch POST; `/tmp/bms-reconciliation-NAAGaT`. Original rows/reports restored after owned cleanup.                                                                                                                                            |
| Expenses operational CSV                  | Four matching statuses total 250; pending/rejected 110 are not financial expense.                                                                                                                                                                                   | Actual downloaded CSV; financial expense is 140. Product/Shipment costs are not a second manual expense.                                                                                                                                                        |
| P&L summary/details                       | Cards and downloaded summary/detail CSV agree with corresponding APIs; Fuel search profit -140; complete/unknown valuation represented correctly.                                                                                                                   | Current summary export deliberately still uses complete period rows despite search; compare unfiltered scopes. No export policy silently changed.                                                                                                               |
| Investor funding/return bridge            | Real profile/agreement posts nothing; funding 1,000 creates Cash/principal liability without profit; actual full return 50 leaves net Cash 950, principal liability 1,000 and exactly one P&L expense/detail 50. Partial 49 and duplicate actions reject unchanged. | Fixed overlap between dedicated investor fetcher and generic journal projection. 16 focused P&L tests; `/tmp/bms-reconciliation-2PU6ww` includes real report UI/CSV/BS parity and exact owned cleanup. Principal repayment/legacy recovery not newly certified. |
| Balance Sheet                             | Cards agree with signed server stats, not searched rows; Cash CSV matches; historical/current navigation works.                                                                                                                                                     | Fixed old false imbalance 800 vs API 0 and lost-today option; 49 rules/control tests pass. Fixed historical presets are not an arbitrary-date picker.                                                                                                           |
| Ledger/Journal                            | Latest period wins; prior-only account, brought-forward 50, closing Cash 550 and searched receipt balance 250 agree. Journal filtered debit 200/credit 0 and CSV agree.                                                                                             | Fixed Ledger stale-response race; 10 focused tests pass including GM. Journal cards intentionally describe visible rows, unlike statement/account balances.                                                                                                     |
| Expense refresh                           | Slow initial response cannot hide a saved mutation or replace fresh state.                                                                                                                                                                                          | Three initially failing domain cases; shared repair passes 15 create/update/delete/bulk cases plus 13 existing calculations. Clothing, GM and Trucking services/query keys/policies stay separate.                                                              |
| C12                                       | Repeated restore of owned historically deleted paid/cancelled row returns 404; all completed event/report snapshots unchanged.                                                                                                                                      | `/tmp/bms-reconciliation-NAAGaT`; unsupported historical recovery remains unsupported.                                                                                                                                                                          |
| X05                                       | Actual report filters/CSV, both refund reminders, Accounting/BI and missing-cost warnings agree at their stated scopes.                                                                                                                                             | Same focused run. Does not close cross-date physical return or the historical defects below.                                                                                                                                                                    |
| X06                                       | Anonymous all Expenses methods/reports/financial writes return 401; USER Expenses/reports/manual/supplier return 403. USER allowed collection and approved payout succeed; money approval and closed financial bulk/import bypasses reject.                         | `/tmp/bms-reconciliation-Gv2pSk`; real credentials. Admin manual entry create/edit/delete checked in report run; no authorization changed.                                                                                                                      |
| EXP-HISTORY-01 / high / unresolved        | Paying an approved September 30 expense 25 today changes September Cash -25/payable +25, not today's settlement date.                                                                                                                                               | `expense-historical-settlement-finding.json`; owner-approved actual settlement event/date design required. Balance remains zero despite wrong timing.                                                                                                           |
| EXP-HISTORY-02 / high / unresolved        | DELETE accepts that paid row and removes the historical Cash/equity effect without a dated reversal.                                                                                                                                                                | `expense-paid-deletion-finding.json`; owner must approve correction/reversal and single/bulk/import guards. No business records repaired.                                                                                                                       |
| Account-label classification / unresolved | Source/unit counterexample classifies `Bank Fees` as Asset via broad `bank` token and omits a 25 journal expense from P&L.                                                                                                                                          | Not newly real-browser proven; shared chart/account ownership review required. No arbitrary inference/policy change made.                                                                                                                                       |

Both historical findings are real reproduced defects, not successful controls.
The harness records them separately from execution checks and explicitly reports
`reconciliationComplete: false`. All scratch databases were removed and verified
absent. The historical gate pass is recorded below. The earlier combined result
remains unverified and is not used as a substitute for the completed scoped runs.
Latest expanded expense/investor/report pass: `/tmp/bms-reconciliation-2PU6ww`;
all 48 supplier tests also pass explicitly in UTC and Asia/Manila. An attempted
combined run at `/tmp/bms-reconciliation-27Jh4E` was interrupted, not passed;
`interrupted-cleanup.json` verifies only its owned scratch resources were removed.
The later combined run `/tmp/bms-reconciliation-NVffB0` failed C09 with Ledger
A/R 1,000 instead of 800: a date-only 200 deposit and the fulfillment timestamp
were on the same Manila day but different UTC dates. The regression reproduced
that failure; using shared Manila end-of-day in Ledger/Journal/P&L passes both
same-day/next-day controls under UTC and Manila plus 56 surrounding tests. Its
scratch database was removed. Fresh gates and the later combined C09 milestone pass;
the complete combined result remains unverified.

Historical required gates passed after the transit repair and target-compatibility
fix: `/tmp/bms-reconciliation-QM3LAp/result.json` and per-command logs. Guardrails,
lint, typecheck, 358 unit files / 4,444 tests, 12 integration files / 89 tests,
4 hardening files / 12 tests, enforced coverage and inventory controls pass.
Accounting sanity scanned one synthetic baseline transaction with zero issues.
The owned gate database was removed and verified absent. Existing lint and
527-line integration-file warnings remain; nothing was bypassed. The fresh
combined driver `/tmp/bms-final-validation-N2eKyx` exited zero but its inspected
log contains only 11 milestones and no final harness result. Its exact artifacts
were identified at `/tmp/bms-reconciliation-09wK3r`; independent guarded cleanup
verified the owned localhost:5433 database, temporary environment and cache absent,
with no active harness/server. See `independent-cleanup.json`. Cleanup does not
prove complete execution; the run is not a complete pass. The earlier 4,435-unit gate pass predates
the nine new transit regressions; the initial transit Set-spread typecheck failure
was corrected using `Array.from` and immediately revalidated before the full pass.

Mandatory scenario count: **26 complete / 26 total**. The latest actual I06, I07,
I08 and X04 evidence is recorded in the checked scenario rows above. The owner's
completion authorization does not invent unresolved financial rules.
I01 now passes in `/tmp/bms-reconciliation-aGE70b`: both Paid/Unpaid full UI paths,
Manila-dated settlement, once-only payment/replay and five-report parity. The three
new midnight regressions first reproduced the UTC bug; all 37 product tests pass
after using shared Manila today. Final current-source gates now pass as recorded below.
Actual additive migration replay passes in `/tmp/bms-reconciliation-7Gb690`,
including legacy preservation and source-link checks, with verified cleanup.
Bulk import's newly reproduced two-orphan-order stock failure is fixed atomically;
31 neighboring real database integration tests pass in `/tmp/bms-reconciliation-1qgxw0`.
Beyond the
investor funding/return bridge above, principal repayment, payroll, tax and loan
owner lifecycles have not all been newly browser-certified.
Internal report agreement is not a real-world bank/cash/physical-stock audit.

- [x] Prepare the owner-requested [expense remediation proposal](../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#expense-remediation-proposal) for review: separate dated accrual/payment events, protect posted history, cover every writer/report, and define legacy evidence, integrity and acceptance requirements. This is design only; no implementation, migration, business-data review or historical repair is approved, and both findings remain unresolved.

All fixtures remain synthetic and isolated. The completed I01/I02/I06/I07/I08/X04
purchase, stock, collection, correction and return sequences now use actual
authenticated workflows; X04 openings are explicitly posted from verified actual
prior closing, not seeded end-state evidence. Earlier seeded/failing evidence is
historical only. Artifacts under `/tmp` are ephemeral; the findings record retains
the expected-versus-actual summary. Final current-batch gates and the selected
current-source workflow regressions have passed.

### Final Completion Evidence (2026-10-28)

- All 26 mandatory scenario boxes remain checked. The final validation task did
  not reopen completed scenarios; subsequent I01/I06/I07/I08 executions are
  current-source regression checks after shared stock/cost changes.
- All nine final gates pass: `/tmp/bms-reconciliation-XMrLWS/result.json`;
  4,514 unit, 90 integration and 12 hardening tests, enforced coverage, inventory
  controls and accounting sanity (one synthetic baseline transaction, zero issues).
  Driver: `/tmp/bms-complete-26-gates-k2Tp6Q/execution.json`.
- Final-source actual browser regressions pass: I01
  `/tmp/bms-reconciliation-6DcCaH/result.json`; I06
  `/tmp/bms-reconciliation-pcZb0A/result.json`; I07
  `/tmp/bms-reconciliation-oZpIxp/result.json`; I08
  `/tmp/bms-reconciliation-vdi9Cb/result.json`. Each reports success and verified
  owned-database removal. Earlier C08 and X04 evidence remains completed, not reset.
- Both exact additive migration SQL files passed owned prior-shaped-table replay
  in `/tmp/bms-reconciliation-7Gb690/result.json`. Exact Git-ignore exceptions
  expose only these migrations; backup/data SQL remains ignored. No business
  database has been migrated.
- Final local repairs have regression evidence: transformed split/bundle history
  rejects dated correction before writes (31 neighboring valuation tests);
  audit/A/R mock and corrected-invariant suites pass 26 tests. No compiler setting,
  guardrail, assertion, coverage threshold or test was disabled to obtain a pass.

## Operator Notes And Release Prerequisites

- Employee procedures live only in the [Master SOP Manual](../business-logic/clothing/operations-workflow.md), including supplier credit, partial-shortage limits, expenses, retries and escalation. This checklist owns scenario/test completion, not a second set of operating steps.
- The [owner handoff and follow-up register](../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#owner-handoff-and-follow-up-2026-10-28)
  summarizes the expected improvements, unresolved expense/classification and
  partial-credit findings, accountable owner, and evidence needed for closure.
  These independent follow-ups do not reopen the completed 26 mandatory scenarios.
- These are development changes validated with synthetic isolated databases.
  Two nullable additive migrations introduce Clothing movement provenance and
  split-component acquisition costs. Their isolated DDL replay is not proof
  that any target environment has a compatible full migration history. Release
  authorization, reviewed environment-specific migrations, backup/recovery and
  deployment remain separate prerequisites. Implementation was separately
  committed as `ce3f8f5d` with owner approval; nothing was pushed or deployed.
  This follow-up documentation update is not included in that commit. Unresolved
  policy and external funds/stock checks remain open.

## Scope And Safety

This is the completed 26-scenario execution/evidence register. Its initial
creation was documentation-only; subsequent implementation followed separately
recorded owner approvals. Open findings and release prerequisites remain open,
not unfinished mandatory scenarios. Documentation consolidation changes no
business rule and grants no operational or git permission.

Do not issue/retry real supplier credits, modify cutoff settings, alter historical financial records, access production, apply business-database migrations, run production builds, commit, push or deploy without separate explicit authorization. Partial-shortage credit issuance, supplier-credit reversal/expiry and any unresolved money/valuation semantics require a separately approved design; include their gaps in the analysis and simulations rather than pretending they work.
