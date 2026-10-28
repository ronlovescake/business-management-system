# Clothing Supplier And Customer Reconciliation

Updated 2026-10-28. Status: 26/26 mandatory scenarios have passing scoped evidence.
The latest owner direction authorizes completing the remaining scenarios and
necessary implementations. I01 now fully passes after the Manila settlement-date
repair, with all 37 product-service tests and real Paid/Unpaid payment/replay:
`/tmp/bms-reconciliation-aGE70b/result.json`, owned database removed and verified.
I02 also passes in `/tmp/bms-reconciliation-cD4S5n/result.json`, with verified
owned-database removal: actual purchase/build of 1,000 units, 120-unit shortage,
880 remaining units, persisted PHP5,000 follow-up, no selectable issued credit,
and explicit 409 rejection of the full-purchase credit workaround with unchanged
credits and five reports. A newly reproduced form bug erased typed bucket targets
on reader refresh; initialization now occurs on explicit open/product selection.
The new hook regression and five neighboring Inventory component tests pass.
C08 now passes both Prepared/fully-paid and Shipped real cancellation/payout/
physical-return sequences in `/tmp/bms-reconciliation-SMuyQS/result.json`, with
verified owned-database removal. A separate keyed zero-money Customers action
restores one actual unit at its original PHP10 sale cost: Cash, approval, payout
and sale history stay unchanged; Stock on Hand increases10 and COGS decreases10.
Replay is once-only, changed details conflict and excess returns reject. All17
refund-route tests and current typecheck pass. GM's refund behavior is unchanged.
All nine final gates now pass; current results are recorded under Fresh Required Gates.
I08 passes in `/tmp/bms-reconciliation-PwnTp1/result.json`, with verified owned
database removal. A real PHP20 purchase and four-unit sale precede actual
Logistics Costs accrual, PHP200 payment and PHP200 capitalization. The dated
PHP20-to22 allocation charges only PHP8 to sold COGS and leaves PHP192 in unsold
stock. A later real physical return restores PHP22 of corrected carrying value
without changing its immutable PHP20 original-sale snapshot. Identical replay,
changed-key conflict, unchanged five-report earlier cutoffs, and visibly incomplete
missing/invalid-cost states pass. Both exact-source mixed paid/free return and
known-zero scrap/reversal regressions pass with all 48 neighboring accounting
tests. Unresolved expense-history findings remain separate from this scenario
count and are not represented as repaired by these passes.
I06 passes in `/tmp/bms-reconciliation-9BffNQ/result.json`, with verified owned
database removal. The owner explicitly approved separate zero-acquisition-cost
additional units, sold at the same ordinary customer price. Actual1,000 units
at PHP20 plus100 supplier-free units sell at PHP50 each: revenue PHP55,000,
COGS PHP20,000. A real1,100-unit atomic transfer and eligible1,099-unit form
reversal plus a bounded last-unit race preserve exact paid/free receipt costs,
despite the destination's different catalog cost. Identical replay, changed-key
conflict, excess reversal, protected history and injected finalization rollback
pass; all five financial reports remain unchanged by receipt/transfer/reversal.
The stock-check regression first reproduced1,200 instead of1,100 units; the
owning projection now counts Additionals once. An additive Clothing movement
provenance migration is present; no business database has been migrated.
I07 passes in `/tmp/bms-reconciliation-sGLyp9/result.json`, with verified owned
database removal. Real purchases feed UI bundle assembly, mix definitions and
explicit-cost split definitions, then authenticated reservation, full fulfillment
and Customers physical returns. New purchase receipts snapshot acquisition cost.
Assembled lots conserve actual component source costs, not their selling prices.
Mix returns select the actual originally sold component; each return copies its
original sale link and cost. Used definitions and actual sales cannot be rewritten
or deleted. A PHP20 set yields two PHP5 tops and one PHP10 bottom: partial returns
remain loose, and only the complete original pieces rebuild one PHP20 set. An
injected finalization failure rolls back every return/rebuild write; competing
last-piece returns yield one winner and one rejection. All five report bridges
conserve value without another acquisition, expense or supplier payment. The owner
approved explicit component acquisition costs; missing or nonconserving costs
reject physical opening. The second additive migration leaves legacy costs null.
X04 passes in `/tmp/bms-reconciliation-LjoQBc/result.json`, with verified owned
database removal. An actual September29 deposit200 precedes the September30
cutover. Explicit opening balances copy the verified actual prior closing; no
receipt is manufactured or rewritten. An October2 installment800 and October3
fulfillment precede today's real server-dated cancellation approval1000, partial
payout300 and separate physical half-return. Cash brought-forward200 plus October
movement500 equals closing700, with stock995, COGS5 and refund payable700. All
five earlier/cutover/precutover reports remain unchanged after later events, and
the actual downloaded Cash CSV matches authoritative running balances. GM's
cutover is unchanged. Journal activity excludes explicit opening rows; the bridge
adds those stored period openings when comparing to Ledger, rather than assuming
their intentionally different scopes are identical. All26 mandatory scenarios
now have actual scoped evidence, and fresh final gates pass.
Earlier I01/seeded-I02 failure descriptions below are historical evidence.
The premature received-stock defect is fixed in the Clothing products read path.
The previous nine-gate pass recorded 4,444 unit, 89 integration and 12 hardening
tests, enforced coverage and both inventory/accounting controls. Those totals do
not certify the new settlement/form changes; the current pass below does. The earlier combined driver lacks a verified final result and
is not counted as a complete pass; its owned resources were independently
removed and verified absent. Two high-severity
historical expense defects remain unresolved independently of scenario completion.
This is development evidence,
not a deployment certification or a reconciliation of real bank balances/stock.
The [implementation checklist](../plans/SUPPLIER_CREDIT_AND_RECONCILIATION_CHECKLIST.md)
records all 26 mandatory cases as complete; unexecuted unrelated workflows are not passes.

## Authorized Change

The requesting business/project owner authorized supplier discovery, Manila
date validation, and reconciliation analysis/simulations. The approved existing
policy is whole-unreceived-purchase credit at saved Grand Total, not arbitrary
partial-shortage credit. Policy ownership remains with that business owner;
this implementation does not invent a partial-credit or return-allocation rule.

On October 28 the owner explicitly resumed isolated I01 investigation and
requested the expense remediation proposal below. The latter is design for
review only, not approval to implement financial behavior, migrate or repair data.

The owner subsequently explicitly authorized fixing goods showing as received
before marking them on hand. This approval covers the Clothing authoritative
shipment-status read described below, not new settlement policy or historical
financial repair. The linked shipment's existing `Delivered` action is the
explicit arrival transition; supplier payment alone is not delivery.

The latest controlling direction explicitly authorizes completion of all26
mandatory scenarios and necessary implementations. The owner additionally
approved exact original component/cost restoration, separate known-zero supplier
extras sold at ordinary customer prices, and explicit cost-conserving split-piece
acquisition costs. This supersedes older investigation-only pauses for those
changes, not undefined expense-correction policy, historical repairs, production
operations or git history writes. The expense proposal remains unimplemented and
its two historical findings remain open.

Owning enforcement: [supplier resolution](../../src/modules/products/api/supplier-resolution.ts).
The [Products contract](../business-logic/clothing/operations-products.md)
defines the whole-product invariant. The shared date helper provides Manila today;
the existing runtime cutoff loader supplies saved clothing settings, falling back
to configured/default dates. All four supplier date call sites use the same check:
issuance, materialized original acquisition, application, and replacement purchase.

Affected UI: administrator Add/Edit Product supplier controls. Existing authorized
product/credit queries provide choices; the initial selector introduced no supplier-master table.
The subsequent approved completion batch adds the cost/source and split-cost
nullable schema fields, keyed transfer/bundle operations and physical-return
allocation UI/API described in the canonical contracts. Existing create,
direct supplier-resolution and idempotent retry paths retain their owning service.
Supplier bulk/import guards remain unchanged. Single transaction deletion now
uses the serializable draft-cleanup boundary already used by bulk deletion;
both reject current/historical closure and cancellation records. General merchandise intentionally has no
clothing supplier-credit flow; its form/API behavior is unchanged. No background
job issues credits or applies this selector.

The requested deeper Expenses/P&L/Balance Sheet review also repaired shared
display/cache behavior. Ledger and Balance Sheet changes affect Clothing and GM;
the expense cache change also affects Trucking. Domain models, authorization and
recognition policies remain separate. Shared-consumer tests do not certify
complete GM/Trucking accounting. The investor return deduplication repairs only
the Clothing P&L consumers; its already-posted expense must be reported once.

## Findings

| Classification                      | Expected Rule / Observed Behavior                                                                                                          | Effect And Action                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed date defect                   | Manila's default date was compared with UTC today. Between 00:00 and 07:59 Manila, a valid default could be rejected.                      | Supplier service now compares strict date-only input with shared Manila today; storage stays UTC date-only. Regression clocks cover both sides of Manila midnight and UTC/Manila process timezones.                                     |
| Fixed cutoff inconsistency          | Supplier validation read the environment/default cutoff while accounting reports read the saved runtime clothing cutoff.                   | Supplier validation now uses the existing runtime loader. Invalid/before-cutoff/future messages are distinct. No cutoff setting was changed.                                                                                            |
| Fixed discovery gap                 | A supplier text field required operators to remember the matching reference. The available-credit Select was mistaken for an amount field. | Supplier choices come from recorded products and issued credits. Explicit new-supplier selection remains possible; credit identity and credit amount remain separate. Full selected-credit details wrap below the Select on mobile.     |
| Fixed deletion bypass               | Single-ID DELETE accepted an order with completed cancellation and payouts, bypassing the bulk draft-cleanup guard.                        | Reproduced in the real app, then routed through shared serializable draft deletion. Single/bulk paths reject closure history; payout/report history stays unchanged. No historical records repaired.                                    |
| Fixed P&L source overlap            | Both the dedicated investor-return fetcher and generic journal projector included the same paid return.                                    | A 50,000 unit fixture reported 100,000 before repair. The projector now excludes only the exact already-owned investor return line; real funding/return/report/CSV evidence passes.                                                     |
| Fixed whole-product guard gap       | A 120/1,000 partial shortage still allowed transfer of the entire purchase and funding linkage.                                            | Real HTTP 200 reproduced the violation. The shared unreceived guard now rejects partial unresolved shortages for transfer, issue and application; full and fully reversed shortages retain existing behavior.                           |
| Unsupported workflow                | Inventory Supplier Short follow-up fields can record a PHP 5,000 credit note, but do not create an issued supplier-credit asset.           | Do not issue an entire PHP 99,253.52 purchase as a substitute for a 120-unit partial shortage. Partial issuance needs approved amount allocation, funding, valuation, limits, correction and audit rules. No live credit was issued.    |
| Intentional valuation difference    | Inventory's available-stock selling-price estimate is not accounting stock cost. Reserved goods remain owned inventory.                    | Compare quantities and cost bridges at a common identity/date/cutoff, not headline screen totals. A price estimate is not a ledger asset.                                                                                               |
| Intentional posting boundary        | Delivery status and ordinary Product creation do not alone prove completed financial build/reclass.                                        | Reconcile source rows, funded acquisition and actual logistics capitalization. An automatic receipt projection is not independent proof of physical arrival.                                                                            |
| Verified customer money distinction | Cancellation/void approval is not payment. Original deposit is not every later installment.                                                | Nine real browser sequences preserved original collection identity, separated retained money from payable refunds, and moved Cash only on actual payout.                                                                                |
| Approved physical-return correction | Cancellation preserves the actual sold allocation; physical stock restoration is a separate event at exact original component/source cost. | Owner-approved C08/I07 now pass actual Customers physical-return workflows, per-original-sale component caps, partial-piece reconstruction, rollback and concurrency. The legacy monetary refund branch remains intentionally separate. |
| Control coverage limitation         | Inventory drift compares quantity projections; transaction sanity checks amounts/statuses with their own date scope.                       | These are useful controls, not a financial stock-cost reconciliation. Passing an empty fixture control cannot certify the purchase/fulfillment bridge.                                                                                  |

## Event Ownership And Bridges

| Event                             | Authoritative Boundary / Persisted Evidence                                                                                | Reconciliation                                                                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Purchase / supplier settlement    | Product service, product-origin Transit Build-Up, settlement journal; shipment reclass owns delivery capitalization        | Gross acquisition equals credit applied plus remaining Cash/card/payable funding. Settlement reduces debt, not a second acquisition. Product ID, source keys, shipment and posting dates matter. |
| Whole-purchase credit             | Supplier-resolution service, credit record, owned shortage movements, journal lines                                        | Dr Supplier Credits / Cr Inventory in Transit. Original Cash/card payment remains. Credit is not a customer refund or cash receipt.                                                              |
| Credit application                | Supplier-resolution service, application record, conditional available-balance decrement, target build entries             | Gross cost unchanged; used plus available equals issued. Failed/racing requests cannot spend the same balance twice.                                                                             |
| Reservation / fulfillment         | Transaction inventory synchronization, source transaction/product identity, reserve/sale movements                         | Reservation reduces availability, not owned value. Fulfillment consumes stock once with cost snapshots; cancelling a sale is not a physical return.                                              |
| Collection                        | Customer payment and bulk-payment APIs, financial request, payment history, order paid balance and original-deposit fields | Positive bounded collection, closed-order protection, original deposit kept separate from installments. Cash/card-clearing is recognized once.                                                   |
| Cancellation / supplier void      | [Customer money service](../../src/lib/accounting/customer-money.ts), decision, status history and noncash journal         | Collected minus prior refunds minus retained amount equals approved refund. A/R debt credit is separate. Void retains zero. Unfulfilled reservations are released; sale history is preserved.    |
| Actual refund payout              | Customer payout API through the same money service, payout and transaction-refund records                                  | Pending decreases only with actual payout; Cash and Refunds Payable decrease together. Payout does not repeat the cancellation expense.                                                          |
| Physical return / cost correction | Refund/return boundary, inventory movements, valuation service and sold-cost snapshots                                     | Returned goods and monetary refund are distinct. Dated cost allocations preserve earlier as-of evidence; missing costs must be visible, not guessed.                                             |
| Reporting                         | Shared recognition, COGS and cutoff helpers; ledger period builder                                                         | Journal/ledger compare debits minus credits; P&L summary/detail compare revenue; balance-sheet totals must balance at identical scope. Search must not redefine an account's closing balance.    |

Worked stock bridge: buy 100 for PHP 10,000 and capitalize PHP 2,000 logistics:
PHP 120/unit. Sell 20: PHP 9,600 owned stock and PHP 2,400 sold cost. Reserve 10:
70 available, but still PHP 9,600 owned stock. Return five sold units to sellable:
85 owned units, PHP 10,200 stock, PHP 1,800 net sold cost, absent other events.
This example explains the invariant; its complete UI sequence is not yet executed.

## Executed Evidence

All browser actions below used real credentials, real Next development routes,
real PostgreSQL writes, and no intercepted API or auth bypass. Each invocation
created a unique `bms_reconciliation_test_*` database on localhost:5433, installed
the test schema/constraints, used an isolated Next cache, and verified database
removal. Development/production databases and their app containers were not used.
Initial customers/products/stock were synthetic database fixtures. Orders and
replacement purchases were created through the actual UI. Report comparisons used October 1 through Manila today, with
cutoff configuration recorded by the harness. Evidence under `/tmp` is ephemeral.

Command: `node tests/e2e/clothing-reconciliation.browser.cjs`.
Nine-case passing evidence: `/tmp/bms-reconciliation-cN7UnP/result.json`,
`trace.zip`, per-stage report JSON, and per-customer completion screenshots.

| Scenario Slice | Real Action Sequence / Expected = Actual                                                                                                                                                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C02/C03        | Gross 1,000; original 20% deposit 200; installment 300; retain 200; refund approved 300. Cash unchanged on approval. Payout 100 leaves 200; payout 200 leaves zero; two payout/refund records total 300.                                                              |
| C06            | Same collections; Voided offers no retain-deposit option. Retained zero; approved 500; payouts 100 and 400 leave 400 then zero. No sale/return invented.                                                                                                              |
| C04            | Original 10% deposit 100 plus installment 300; emergency full refund approves/pays 400. Separate 20% original deposit 200 plus 300 approves/pays 500. Both retain zero.                                                                                               |
| C05            | Original 20% deposit 200 plus 800 pays gross 1,000; discretionary cancellation approves/pays 1,000 separately. A later real Due Dates check excludes the paid old invoice and includes an unpaid overdue positive control.                                            |
| C01/C07        | UI-created unpaid reserved order cancelled/voided; no refund or cash created; reservation released; saved status history retained.                                                                                                                                    |
| C09            | UI-created gross 1,000 order, collect 200, move to Accounts Receivable, cancel and pay 200. Debt credit is 800, refund is 200, and the sold unit remains sold.                                                                                                        |
| C08 slice      | UI-created order paid 200 + 800 and marked Prepared creates a sale. Cancellation/payout of 1,000 preserves the sale and 99 remaining units. Generic post-cancellation physical-return/refund request rejects; no supported physical return was completed.             |
| C12/X01 slices | Real authenticated HTTP payout replay succeeds without duplicates; changed amount under the same key and an extra payout conflict; closed-order deletion rejects after repair. Five report payloads remain unchanged. Other entry points and event types remain open. |

For each collection, approval and payout, Journal and Ledger agree on Cash,
Customer Deposits, Refunds Payable, A/R, Sales Revenue/Returns and Forfeited
Deposits. P&L revenue summary/details agree; the balance sheet balances. Approval
does not move Cash; payouts reduce cash/liability without a second P&L expense.
Each unfulfilled case retains 100 stock units after closing; fulfilled cases
retain 99, without an invented physical return. C06's two actual payouts also
passed on a 390px mobile viewport with the navigation panel closed. These assertions
predate the expanded report UI/export/dashboard evidence below. They still do not
prove every payment method, full cross-month returns or every required scenario.

Supplier command: `node tests/e2e/clothing-reconciliation.browser.cjs --supplier-only`.
Passing evidence: `/tmp/bms-reconciliation-13yk1M/result.json`, `trace.zip`,
`I03-*.json`, `supplier-credit-exhausted.png`.

- Seed a wholly unreceived Paid purchase with saved gross 5,000; post Transit
  Build-Up through Products, then transfer the delayed product through Edit
  Product. Funding ID, source key, amount, date and account stay unchanged;
  shipment linkage and one transfer audit update. Issue through Edit Product:
  credit is 5,000, Inventory (All Product Codes) shows zero actual stock, and
  original Cash-funded acquisition remains. Credit journal does not refund Cash.
- Create replacement purchases through Add Product with recorded Supplier
  selection: first gross 3,000 uses 2,000, leaves 3,000 credit, needs 1,000 Cash;
  second gross 3,000 uses 3,000, leaves zero, needs no additional Cash.
- The second purchase is saved without credit, reopened in Edit Product, and
  receives the final 3,000 through the real application modal at mobile width.
  Its gross cost stays 3,000; no prior/duplicate build exists.
- Five reports agree; original source funding rows stay unchanged after issuance
  and applications. Issue and saved-application replays create no duplicate;
  conflicting details reject. Real invalid-target tests reject wrong supplier,
  foreign currency, insufficient balance, self-funding and already-posted targets
  without consuming credit or changing any of the five report payloads. I04 is
  complete. Sold/reclassified fixtures now reject whole transfer with HTTP 409,
  unchanged product/audit and identical reports; the partial-shortage guard also
  passes. Positive transfer remains an actual UI action. I05 is complete.
- Anonymous issue returns 401. A real USER login receives 403 on issue/list APIs
  and the Products Access Restricted guard exposes no Add Product control.
  Administrator paths are exercised by the main browser session.

For all seven paid cancellation variants, real HTTP checks reject an extra
collection, single/bulk financial edits, reopening, deletion/restoration, and
paid closed-status imports. Payout replay is idempotent; changed payload under the same key and
excess payout reject. Reports and recorded receipts remain unchanged. Restoration
initially used a current nondeleted closed order. The later C12 probe below also
proves historically deleted paid-row restore fails closed without changing any
financial history; it does not certify a historical recovery workflow.

Voided retention is also rejected by an actual authenticated API request before
the valid UI approval. The page offers no retain option, and both actual payouts
complete at mobile width. This is separate from simulated/mocked authorization.

I02's actual Inventory adjustment recorded 120 Supplier Short from 1,000 and
displayed 880 actual quantity. The real follow-up modal saved reference
`PARTIAL-CREDIT-5000`, amount 5,000, and `CREDIT_RECEIVED`. Issued-credit count did
not increase, Supplier Credits ledger balance did not increase, and Add Product
offered no usable credit for that supplier. The original purchase/receipt was
seeded; this is shortage/follow-up evidence, not the complete I01 purchase flow.

Latest supplier evidence: `/tmp/bms-reconciliation-CX4Bot/result.json`, trace,
screenshots and per-stage reports. Its isolated database was removed and proved
absent. Subsequent full evidence is `/tmp/bms-reconciliation-cN7UnP`. Captured
real collection and cancellation UI requests now replay without duplicate events;
changed amount/reason conflicts under the same key, with unchanged report
payloads. With payout/issue/application replays this completes X01.
A partial-shortage transfer initially succeeded incorrectly in
`/tmp/bms-reconciliation-CblrEu`; after the shared guard repair it returns 409,
with unchanged shipment, zero transfer audits and identical reports. All 48
focused supplier service tests pass. That result preceded the fresh post-guard
gate pass recorded below; sold/reclassified variants subsequently passed.

### I01 Transit Fix And Remaining Settlement Failure

I01's earlier pause concerned the investigation, not an application setting that
disables purchasing. The owner explicitly resumed it on October 28 and later
authorized the premature-receipt repair. The separate `--lifecycle-only` branch
now creates both Paid and Unpaid purchases through the real UI. The original
`/tmp/bms-reconciliation-acIukf/failure.png` showed an unconfirmed save, not an
application purchase-save failure. The helper now confirms "Yes, save product"
and checks the actual POST and persisted data. It also checks actual auto-receipt
metadata and uses the grid's normal keyboard navigation to open offscreen cells.

Root cause: Inventory loaded `GET /api/products`, whose raw stored product
status could be blank or stale while the active linked shipment was `In Transit`.
The existing transform treated that missing explicit transit status as received.
The Products grid independently loaded Shipments and could already show the
correct status, masking the disagreement. Payment did not cause an arrival write.

The owning Clothing `productService.findActive` now batches active linked
shipments and supplies their nonempty authoritative status in the collection DTO.
This covers refreshed reads of form/API/import/bulk-created products without
changing their stored fields. Failed lookups propagate instead of returning
stale success. Unlinked/unmatched products and blank linked statuses preserve
legacy fallback; no unknown historical locations are repaired. GM's separate
service, single-record mutation responses, inventory writers, financial sources,
costs, dates and schema are unchanged. No receipt or journal is posted by the read.

Nine new service regressions cover Paid/Unpaid with stored null/blank/Delivered
status, explicit In Transit-to-Delivered change, legacy fallback and lookup
failure. The original failing cases showed 100 received instead of zero before
the fix. All 33 product-service and 26 inventory-transform tests pass afterward,
including after replacing Set spread with target-compatible `Array.from`.

Latest actual browser evidence: `/tmp/bms-reconciliation-VsjNgV/result.json`,
`I01-paid-*` / `I01-unpaid-*` reports, stock screenshots and failure trace.
Both purchases prove 100 ordered / zero received / 20 transit reserved / 80
transit unreserved before delivery; explicit delivery gives 100 received / 20
on-hand reserved / 80 sellable. Reclassification and fulfillment give 20 sold /
80 available, stock cost 8,000 plus COGS 2,000, A/R and revenue 4,000, and profit
2,000 per purchase. Creation, reservation and delivery do not independently post
acquisition/reclassification. The Paid branch completes. Fulfillment correctly
preserves the original `sellable -> reserved` movement and consumes it with
`reserved -> sold`; the helper now asserts net reserved zero, not history deletion.

The Unpaid branch creates two supplier-settlement lines through real Edit Product
but fails the first posting-date assertion: expected Manila October 28, actual
October 27. `postSupplierSettlementForProduct` uses UTC calendar parts of the
current instant. This is a separate unresolved financial-date defect, not a
weakened test or a delivery-status problem. Later settlement balance/replay checks
have not run and are not passed. The assertion remains intact; no financial dates
or history were changed under the transit repair. Overall `success` and
`reconciliationComplete` are false, owned scratch database removal is verified,
and I01 remains unchecked. Real business data and production were not accessed.

Latest I01 completion: the owner authorized the repair and all remaining work.
The first settlement now uses shared `getCurrentDateISO()` with unchanged
UTC-midnight day storage. The new frozen Manila-midnight regression failed
before repair; all 36 product-service tests pass after it. The complete isolated
`--lifecycle-only` run `/tmp/bms-reconciliation-aGE70b` passes both Paid and Unpaid
purchase/build/reservation/delivery/reclass/fulfillment, correct settlement date,
Cash/payable bridge, unchanged cost/profit and same-request replay across five
reports. `success: true`, owned database removed/verified; this earns I01, not
full reconciliation certification. No stored historical journal was rewritten.

Supplementary verification, not full UI workflow completion:

- Supplier service: all 48 current tests pass under both `TZ=UTC` and `TZ=Asia/Manila`, including the later partial-shortage guard.
- Supplier component: 11 tests pass, including loading, retry, deduplication,
  explicit new supplier, credit-only supplier and invalid-credit filtering.
- `npm run test:browser:supplier-credit`: 12 intercepted desktop/mobile checks
  pass; selected-credit screenshot inspected. This fixture does not access a DB.
- `node tests/e2e/clothing-reconciliation.browser.cjs --integration-only`:
  30 real-database tests pass in three suites, including races/rollback,
  historical report/cost behavior and the new deletion rollback/ownership test;
  `/tmp/bms-reconciliation-QckCtJ`.
- Guardrails and lint passed; lint reports existing warnings. Typecheck passed
  after removing unsupported Testing Library query options. The guardrail's
  incidental historical-report date change was restored and byte-checked.
- Full gates passed before the subsequent deletion repair: 4,396 unit tests,
  88 integration, 12 hardening, enforced coverage, inventory controls and
  accounting sanity (one baseline transaction, zero issues), with guardrails,
  lint and typecheck. Evidence: `/tmp/bms-reconciliation-WnGz2E`.
- The deletion repair has 35 passing focused deletion/API/audit tests and a
  passing full real browser run. Final gates passed after aligning API mocks and
  converting only the preexisting A02 defect probe to the repaired invariant:
  guardrails, lint, typecheck, 4,403 unit, 89 integration, 12 hardening, enforced
  coverage, inventory controls and accounting sanity. Evidence:
  `/tmp/bms-reconciliation-RRthXz/result.json` and per-command logs. Existing lint
  warnings and the 527-line integration-file warning remain; none were bypassed.

## Unresolved Audit Findings

Additional independent customer scenarios passed after the I01 pause:

- C11: `--returns-only`, `/tmp/bms-reconciliation-Ysp78F`. Four real UI-created,
  paid and Shipped orders; Customers recorded actual 100 refunds. Monetary-only
  did not restock; sellable returned one available unit, damaged hold retained
  original carrying cost without sellable availability, and scrap was not
  recapitalized. Original sale/receipts and 10/unit cost snapshots persisted.
  Opening funded/reclassified stock was synthetic and explicit. The initial
  Prepared-based revenue expectation was disproved by the documented
  invoice/shipment deposit-release rule; no accounting policy was changed.
- C10: `--review-only`, `/tmp/bms-reconciliation-j73fud`. Unknown deposit and
  unexplained legacy paid balance reject with review. A real earlier 900 refund
  leaves 100 from 1,000 collected; retaining the original 200 rejects. Actual
  cancellation approval and Customers payout complete only the remaining 100;
  receipt/refund/sold-stock history and report bridges are preserved.

Both invocations removed and verified their owned scratch databases. These
complete C10/C11, not post-cancellation physical returns or the incomplete purchase
branch. Artifacts remain ephemeral under `/tmp`.

Further independent passes:

- C05 `/tmp/bms-reconciliation-UJ59nB`: actual fully paid Prepared order with
  owned old-invoice history was absent from the real Transactions Due Dates tab;
  an unpaid overdue positive control was present. Discretionary cancellation and
  actual 1,000 payout remained separate; original receipts/sold stock persisted.
- X02 `/tmp/bms-reconciliation-vLSged` and `/tmp/bms-reconciliation-Dxu5fy`:
  database barriers observed two independent blocked application connections in
  each collection, payout and supplier-credit race. Exactly one winner; no losing
  request or funding, no overspend. Winner replay and losing retry preserved
  reports and remaining amounts. Separate supplier race fixtures were removed.
- X03 `/tmp/bms-reconciliation-1NJ3vY` and `/tmp/bms-reconciliation-Dxu5fy`:
  real database trigger failures after event/balance writes rolled back financial
  requests, collections, cancellation/payout/refund, journal, inventory, reserved
  credit and acquisition funding completely. Full table snapshots and five
  report payloads matched; normal UI flows passed after trigger removal.
- X05 partial `/tmp/bms-reconciliation-1NJ3vY`: Transactions card/header lists,
  Accounting and BI agree at pending/paid 300/0, 200/100 and 0/300. Actual ledger
  filters/CSV preserve opening/closing balances under search and prior-only
  accounts; a filtered receipt balance of 250 does not replace full Cash closing
  550, including prior-period 50. Cleanup restores exact original reports.

The audit suite in
`tests/unit/audit/clothing-integrity-audit.test.ts` distinguishes corrected
invariants from remaining defect probes. A01/A06/A08 still intentionally reproduce
gaps; their passes are not successful controls. A02/A03/A04/A05/A07 now assert
the repaired owning-boundary behavior. These unit checks supplement, rather than
replace, the actual workflow and database evidence:

| Probe | Observed Gap                                                                                               | Next Decision Or Verification                                                                                                            |
| ----- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A01   | Generic edits can set Adjustment without corresponding payment records and satisfy paid fulfillment rules. | Define legacy correction versus new collection permissions; verify actual financial and inventory effects before tightening all writers. |
| A03   | Corrected: mix re-sync excludes its own reservation and preserves the complete allocation.                 | Focused writer regression and actual I07 reservation/fulfillment/component-return lifecycle pass.                                        |
| A04   | Corrected: exact imported orders and movement synchronization share one Serializable transaction.          | Real PostgreSQL stock rejection first left two orders; the regression now proves full rollback with the original receipt unchanged.      |
| A05   | Corrected: generic status metadata changes do not erase an actual fulfilled movement.                      | The audit now supplies original-sale evidence and asserts no stock mutation. This does not approve every metadata transition.            |
| A06   | Shipment DELETE does not consult the existing accounting-entry guard.                                      | Verify dependent product/posting/linkage behavior and the approved deletion/recovery contract.                                           |
| A07   | Corrected: simple fulfillment consumes recorded physical lots and rejects insufficient recorded stock.     | Exact paid/free sales, serializable stock races and bulk rollback pass. Legacy no-receipt compatibility remains explicit, not certified. |
| A08   | Import accepts a nonzero line total inconsistent with quantity and unit price.                             | Confirm historical adjustment compatibility and authoritative amount representation before rewriting or rejecting historical totals.     |

The real import probe also accepted an unpaid closed-status row (no Adjustment).
`buildCreateInput` explicitly rejects paid closed imports but permits unpaid
ones. This observed compatibility difference was preserved, not certified as an
approved substitute for cancellation snapshots. Resolve that policy before
claiming all entry points implement one closure lifecycle.

## Expanded Accounting Analysis (2026-10-28)

Scope: `/clothing/accounting/expenses`, `/clothing/accounting/profit-loss` and
`/clothing/accounting/balance-sheet`, connected to the operational sequence and
all five report APIs, not just Ledger. Latest focused accounting evidence:
`/tmp/bms-reconciliation-2PU6ww` (superseding `/tmp/bms-reconciliation-NAAGaT`); command
`node tests/e2e/clothing-reconciliation.browser.cjs --reminders-only`.
Real credentials, Manila browser, configured Clothing cutoff 2026-01-17 and an owned
localhost:5433 scratch database; database removal verified. October reports use
October 1 through the explicitly selected Manila date; the historical expense
probe separately requests September 30. No live books or statements were used.

### Expenses: Accrual, Funding And Operational Totals

Ownership: [expense routes](../../src/modules/shared/ledger/expenses/api/routeFactory.ts),
[service](../../src/modules/shared/ledger/expenses/api/serviceBase.ts),
[approved/paid fetcher](../../src/lib/accounting/data-fetchers.ts) and
[funding classification](../../src/lib/accounting/payment-accounts.ts).
The UI creates a pending Fuel expense and approves it; real PATCH/batch POST
requests exercise paid Cash, outgoing CARD and nonposting statuses.

| Stage                          | Expected = Actual Financial Change From Opening                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Pending Fuel 100               | No Journal/Ledger/P&L/Balance Sheet change.                                                                                            |
| Approve 100                    | Expense +100; Accounts Payable credit 100; no Cash change.                                                                             |
| Pay that 100 in Cash           | Cash -100; payable cleared; expense remains 100, not 200.                                                                              |
| Add paid CARD 40               | Total financial expense 140; Cash remains -100; Credit Card Payable credit 40; profit -140; Balance Sheet assets -100/liabilities -40. |
| Add pending 50 and rejected 60 | Financial amounts unchanged; four matching list/CSV rows total 250 because operational CSV also includes nonposting 110.               |
| Remove only owned fixtures     | Existing expense rows and all five report payloads exactly match opening.                                                              |

Journal/Ledger agree on Fuel, Cash, Accounts Payable and Credit Card Payable.
P&L summary expense and detail expense both increase 140. This is approved/paid
expense recognition, not a rule that an Expenses list total should equal P&L.
Outgoing CARD creates a liability; incoming customer CARD uses a clearing asset.

Products and Shipments have disabled automatic expense-posting flags:
[product source](../../src/modules/products/api/service.ts) and
[shipment source](../../src/modules/shipments/api/expenses.ts). Purchases and
actual logistics belong to acquisition/settlement/capitalization, then COGS on
sale, not a second manual operational expense. Legacy approved/paid PRODUCT or
SHIPMENT expense rows can still be fetched by accounting while the operational
Expenses screen excludes them. Their historical duplicate/source ownership is
an **unverified data-review risk**, not a proven current duplicate or repair.

Payroll source tracing also finds a transactionally upserted paid `PAYROLL`
expense using net pay and paid date in
[payroll API](../../src/app/api/payroll/route.ts), with deductions/13th-month
sources owned separately. This establishes source ownership only; full gross/net,
deduction liabilities and bank settlement were not newly reconciled here.

### P&L: Profit, Details, Valuation And CSV Scope

Summary/details consume the same dated payment/refund/A/R recognition, eligible
expenses, inventory COGS/shrinkage and journal projections. Cash receipts,
supplier credits, loan principal and inventory purchases are not automatically
profit. Customer-money scenarios prove noncash approval and actual payouts do
not invent a second P&L expense; ordinary goods refunds separately reverse the
appropriate revenue/cost effects. Supplier credit preserves purchase gross cost
and funding rather than creating revenue or a cash refund.

Actual summary CSV categories/types/amounts match its API; detail CSV row count
and Revenue/Expense totals match its API. Complete valuation is explicit in the
summary CSV. Fuel search shows scoped profit -140, but the current summary CSV
still exports full-period rows. That observed scope mismatch is documented,
not silently changed or declared a financial discrepancy. Clear search before
comparing full-period cards/export; filtered Journal/Expenses/BS exports have
different, explicitly tested scopes.

An owned unpriced sold-unit fixture produces `valuation.complete: false` and
actual Profit Incomplete/Cost unknown warnings in P&L, Accounting and BI. It is
not treated as genuinely free stock or confirmed at zero. Removing only its
owned product/movements restores the complete original snapshots. Existing
dated correction/return integration tests are supplementary; the complete I08
logistics/correction UI sequence remains unexecuted.

### Investor Funding And Exactly-Once Returns

The [Investors contract](../business-logic/clothing/accounting-investors.md)
already distinguishes principal funding from return expense. Deeper analysis
found that both P&L routes explicitly fetched investor returns and then included
the same line through the
[general journal projector](../../src/lib/accounting/profit-loss-journal.ts).
An actual-shape unit regression reproduced expense 100,000 for one 50,000
return. The repair excludes only exact `INVESTOR_RETURN` / `Investor Return
Expense` lines from that second path. Manual same-account expenses and other
investor-source expense categories are preserved; 16 focused P&L tests pass.

| Actual API Action            | Expected = Actual Across Reports                                                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create profile and agreement | No posting or profit change.                                                                                                                                                              |
| Record funding 1,000         | Cash +1,000; investor principal liability 1,000; no P&L change.                                                                                                                           |
| Attempt partial return 49    | HTTP 400; all five report payloads unchanged.                                                                                                                                             |
| Pay full return 50           | Cash net +950; principal still owed 1,000; Journal/Ledger expense 50; P&L expense +50/profit -50 with exactly one detail; Balance Sheet assets +950/liabilities -1,000/signed equity +50. |
| Repeat funding/payment       | HTTP 409; no duplicate source lines or report changes.                                                                                                                                    |
| Remove only owned fixtures   | Original five report payloads restored exactly.                                                                                                                                           |

Actual P&L summary/detail CSVs match APIs while the funded/paid fixture exists;
Investor Return Expense search shows profit -50 and one detail. Actual Balance
Sheet cards, Cash-only CSV and past/today navigation also agree. Evidence:
`/tmp/bms-reconciliation-2PU6ww`, including `investor-*` exports/screenshots and
per-stage JSON; owned scratch database removed and verified. This is a real
source-to-report bridge, not newly executed principal repayment, every schedule
rule or legacy funding recovery.

### Account Label Classification Risk

Separate unresolved source/unit counterexample: `Bank Fees` is inferred as an
Asset by the broad `bank` token in
[account classification](../../src/lib/accounting/account-classification.ts).
A 25 expense boundary probe consequently produced zero P&L expense. The narrow
investor-source regression uses canonical `Card Processing Fees` so it checks
deduplication without silently changing classification policy. No actual browser
claim or live-account impact is inferred for `Bank Fees`. A typed chart/account
ownership review and shared-consumer tests are needed before changing this
cross-report inference; arbitrary account labels are not fully reconciled.

### Balance Sheet: Stocks, Funding And Historical Truth

Compare identical cutoff/as-of scopes: funded acquisition/transit, reclassified
owned stock and net sold/returned cost; supplier credit and applications;
receivables/deposits/refund liabilities; actual Cash/card-clearing/card payable;
expense payables and retained earnings. Reservations do not remove owned stock.
Prepared plus fully paid creates sold inventory but alone does not release the
initial deposit without the documented invoice/shipment recognition event.

Actual cards match server assets, signed liabilities/equity and equation.
Cash-only search leaves whole-statement stats unchanged and its one-row CSV
matches the filtered API account. A pre-cutover fixed historical date shows zero;
returning to Manila today restores original totals. The controls retain today
after a historical selection; fixed 2025 choices remain a usability limitation,
not arbitrary-date navigation. A zero equation is necessary but insufficient:
the following two real historical defects both retain balanced statements.

### Confirmed Open Historical Expense Findings

| ID / Severity         | Expected Rule                                                                                        | Reproduced Actual / Financial Effect                                                                                                                                         | Owning Boundary / Required Decision                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EXP-HISTORY-01 / High | Today's actual settlement must not move Cash in an earlier as-of statement.                          | Create approved September 30 expense 25: old payable credit 25, no old Cash change. PATCH paid today: September Cash falls 25 and payable clears on September 30, not today. | `Expense.date/status`, `getExpenseCreditAccount`, derived report expense entries. No separate actual settlement event/date exists. Owner-approved dated settlement design required.                                                      |
| EXP-HISTORY-02 / High | Executed paid events must remain represented historically; corrections need explicit dated evidence. | DELETE that paid row returns 200 and a soft-delete timestamp; subsequent GET is 404. September Cash/equity return exactly to pre-expense values, without a dated reversal.   | [single DELETE](../../src/app/api/expenses/[id]/route.ts) has no posted-state/correction guard; active-row reporting drops the effect. Owner-approved paid-expense reversal/correction rules must cover single, bulk and import writers. |

Artifacts: `expense-historical-settlement-finding.json` and
`expense-paid-deletion-finding.json`, with before/after report payloads. These
are intentionally **reproduced defects**, not healthy financial controls. The
harness reports `success: true` for completed execution but
`reconciliationComplete: false`, and includes both unresolved findings. No
historical business record was modified, backfilled or repaired.

Proposed decision boundary, not implemented policy: separate actual settlement
date/amount/account/actor and stable request identity from the accrued expense;
make financial event writes atomic; specify dated reversal/correction and legacy
unknown-date handling. Do not infer the settlement date from `updatedAt`, silently
backdate Cash, or erase paid history to make reports agree.

### What The Expense Defects Mean In Practice

For the actual 25 test expense approved on September 30 and paid on October 28,
September should retain expense 25 and payable 25, with no Cash outflow yet.
October's payment should reduce Cash and clear that payable on October 28,
without charging the expense a second time. Instead, changing the row to Paid
makes the September report show the Cash outflow on September 30. A previously
reviewed historical statement can change after a later payment.

Deleting that paid expense is a separate defect. The row is soft-deleted, not
physically erased from PostgreSQL, but active-row reports omit its financial
effect. Cash and profit/equity then look as though the expense never happened;
no actual cash was returned and no dated reversal was recorded. Soft deletion
preserves a stored row, but does not by itself preserve the accounting history.

Both outcomes still balance mathematically. They are event-date and completeness
failures, not merely a display-sign problem. These reproductions use synthetic
records only: they establish the code's behavior, not how many real expenses
are affected. No real historical books were inspected or repaired. Safe
remediation needs an approved actual-payment event/date, protection against
rewriting or deleting posted effects, a dated correction/reversal workflow and
explicit handling of legacy records whose real payment date is unknown.

### Expense Remediation Proposal

**For owner review only; not approved policy or implemented behavior.** The owner
authorized preparing this design on October 28, not implementation, schema
changes, migration, business-data inspection or repair. Both EXP-HISTORY findings
remain open. The accountable approver is Ron, the requesting business/project
owner, with accounting review of dates, closed periods and legacy evidence.

Review response on October 28: the owner selected "This design direction
matches" after reviewing the September accrual / October actual payment example,
posted-history preservation and no guessed legacy payment dates. This confirms
the design direction only. It does not authorize implementation or resolve the
remaining partial-payment, closed-period, legacy and cross-domain decisions.

#### Proposed Event Model And Statement Effects

Keep the expense document separate from immutable recognition, settlement and
correction evidence. On approval, capture its amount, category/account, domain,
source identity and accrual date once. Actual payment records its own Manila
calendar date, amount, funding method/account/card, actor, evidence/reference and
stable request identity. Persist timestamps separately from calendar dates.
Use the existing domain journal infrastructure with source-owned unique keys;
do not both post a journal and independently project the mutable expense as a
second financial source.

| Event                          | Proposed Posting                                               | Historical Effect                                                                                                  |
| ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Accrue Fuel 25 on September 30 | Dr Fuel 25 / Cr Accounts Payable 25                            | September expense/payable 25; no Cash movement.                                                                    |
| Actually pay 25 on October 28  | Dr Accounts Payable 25 / Cr Cash 25                            | September remains unchanged; October clears the payable and moves Cash once, without another expense.              |
| Correct a posted event         | Explicit dated, linked correction/reversal and any replacement | Preserve the original and its audit trail; never infer that cash returned merely because an expense was cancelled. |

Recommend keeping initial payment scope full-amount only, matching the current
Paid action. Partial payments, advance payments, foreign currency and payment
netting require separate approval. An initially Paid document must create both
the accrual and evidenced settlement atomically, even when their dates match.
Use decimal cents and existing funding mappings; outgoing CARD remains Credit
Card Payable, not customer Card Collections Clearing.

#### Proposed Owning Boundary And Writer Coverage

Use a transaction-aware Clothing expense lifecycle service, rather than adding
independent financial rules to each UI or route. Extend the existing
[expense service boundary](../../src/modules/shared/ledger/expenses/api/serviceBase.ts)
only with explicit domain policy, or delegate Clothing to that owning service;
the shared base must not silently change GM/Trucking semantics.

| Entry Point                                                         | Required Design Coverage                                                                                                                                                                               |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Expenses UI, single PATCH and create POST                           | Explicit approve/pay/correct commands; payment date/evidence; existing permissions remain enforced server-side.                                                                                        |
| Bulk PUT and batch/import POST through the shared route factory     | Same validation and lifecycle boundary; prevalidate the whole requested batch and commit atomically. No direct status/funding rewrite or partial `Promise.all` posting.                                |
| Single-ID DELETE and mass DELETE                                    | Permit only owner-approved unposted draft cleanup. Reject posted recognition/payment dependencies atomically, including a mixed draft/posted batch; offer the approved dated correction route instead. |
| PAYROLL and source-based upserts                                    | Use stable source ownership and the same transaction. An actual source paid date may supply settlement evidence; repeated upsert must not change posted history or duplicate payment.                  |
| PRODUCT/SHIPMENT and recurring/investor journal sources             | Preserve capitalization and their separate posting owners. Do not duplicate them as manual expenses or import a second source event; legacy rows need explicit review.                                 |
| Journal, Ledger, both P&L routes, Balance Sheet, dashboards and CSV | Derive the same dated events once. An operational document may be archived, but posted events remain in historical output. Preserve operational-versus-posted CSV scopes.                              |

The direct [single-ID deletion route](../../src/app/api/expenses/[id]/route.ts)
currently bypasses the shared service and must be routed through the same future
guard. Proposed archival is not a financial reversal. Nonfinancial notes may
remain editable with an audit trail; changing a posted amount, category, accrual
date, funding identity or source requires the approved correction workflow.

#### Proposed Integrity And Legacy Handling

Recognition/payment/correction events, journal legs, balance/state changes and
audit evidence must commit together. Use database uniqueness, bounded conditional
writes and serializable retry handling as appropriate: the same request and
payload return the original result; changed payload conflicts; competing payments
cannot exceed the outstanding payable. Capture authenticated actor/domain, do
not trust client approval flags, and preserve the existing 401/403 boundaries.
Apply the saved domain cutoff and strict Manila date helpers; validate payment
chronology and reject unsupported future/closed-period posting under approved
policy rather than backdating silently.

Legacy Paid rows have no reliable settlement date merely because `updatedAt`,
creation time or the expense date exists. Preserve the originals and explicitly
label unknown settlement evidence. Do not fabricate dates, auto-create payments
or declare their historical reports reconciled. A later authorized, read-only
inventory should separate evidenced sources, unknown dates, deleted posted rows
and potential source duplicates; any corrections require owner-reviewed mappings,
dated decisions, dry-run report differences and a recovery plan.

If implementation is later approved, use an additive, reviewed schema migration
only after settling event/source contracts. Include new events in backup/export
and restore dependency coverage. Prove report parity and preserved legacy output
on disposable databases before any environment-specific rollout; no reset,
silent backfill or replacement of original evidence is proposed.

#### Acceptance Tests And Decisions Before Implementation

- Reproduce September 30 approval / October 28 payment across all five reports:
  September must remain identical after payment and October must not expense 25
  again. Repeat Manila midnight, month/year and saved-cutoff boundaries.
- Paid/approved deletion, financial edits, mass deletion and imported status
  rewrites must reject without changing events or reports. Corrected documents
  must retain the original, linked decision, dates and explicit money evidence.
- Cover single, bulk, CSV/import and source-upsert commands, uncertain-response
  replay, changed-key payload, independent concurrent payments, and injected
  failure after the first event/journal leg. No partial balance or batch writes.
- Verify Cash/Bank/GCash/CARD, API/UI permissions, search/CSV scopes, source
  deduplication, historical as-of statements and backup/restore on owned fixtures.
  Test shared consumers without merging domain financial policies.
- Owner decisions still required: accrual-date authority and approval evidence;
  full-only versus partial settlement; closed-period and pre-cutover corrections;
  correction permissions/reasons and evidence; handling actual refunded cash;
  legacy unknown-date/source mapping; and GM/Trucking rollout scope. No choice
  here is implied by permission to prepare this proposal.

### Repairs, Role Checks And Assurance Limits

| Classification                       | Evidence And Outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixed Ledger response race           | Real old This Month 550 response overwrote newer Last Month 50 (`/tmp/bms-reconciliation-TNTqS1`). Latest-request guard; 10 focused tests cover stale success/error and shared GM consumers; actual period/account/search/CSV pass.                                                                                                                                                                                                                                                                                     |
| Fixed BS signed/search stats         | API balance 0 displayed 800 (`/tmp/bms-reconciliation-WLr3qp`). Cards now preserve server stats, including genuine imbalance; 49 rules/control tests pass.                                                                                                                                                                                                                                                                                                                                                              |
| Fixed BS date navigation             | Selecting past date lost today's option (`/tmp/bms-reconciliation-yu3RxV`). Shared controls now retain/dedupe today; real past/today navigation passes.                                                                                                                                                                                                                                                                                                                                                                 |
| Fixed Expenses initial-fetch race    | Real successful create disappeared behind a slower initial GET (`/tmp/bms-reconciliation-WHWBDU`). Three deterministic failures reproduced shared cache invalidation; cancel-before-refetch repair passes 15 mutation/domain cases plus 13 existing calculations. No financial rules changed.                                                                                                                                                                                                                           |
| Fixed investor return overlap        | One source expense appeared twice in both P&L report paths. Exact source-owned exclusion passes 16 P&L tests and real funding/return/report UI/CSV evidence above; no stored payment or journal rewritten.                                                                                                                                                                                                                                                                                                              |
| Fixed deposit date-boundary mismatch | Combined run `/tmp/bms-reconciliation-NVffB0` failed C09: Ledger A/R 1,000 instead of 800 because date-only October 28 deposit 200 was compared against October 27 18:56 UTC fulfillment, the same Manila day. Ledger/Journal/P&L now compare through shared Manila end-of-day. The regression failed before repair; both same-day and next-day controls pass in UTC/Manila, with 56 surrounding tests passing. Fresh gates and the later combined C09 milestone pass; the complete combined result remains unverified. |
| C12 complete                         | Owned historically deleted paid/cancelled order repeatedly returns restore 404. Complete receipts/approval/payout/inventory/report snapshots unchanged; only synthetic deletion marker undone. No historical recovery workflow certified.                                                                                                                                                                                                                                                                               |
| X05 complete within stated scopes    | Actual Ledger/Journal/P&L/BS/Expenses filters and downloaded CSVs, both refund reminders, Accounting/BI and missing-cost visibility pass. Journal cards total visible rows; Ledger/BS preserve authoritative balances. X04 separately completes cross-date physical returns; historical expense defects remain unresolved.                                                                                                                                                                                              |
| X06 complete                         | `/tmp/bms-reconciliation-Gv2pSk`: anonymous 401/USER 403 on all Expenses methods, five reports, manual journals and supplier APIs; USER may collect and execute an approved payout, not approve a paid-order cancellation. Admin manual create/edit/delete produces exactly one balanced owned pair and preserves soft-delete history. Closed financial bulk/import bypasses reject unchanged.                                                                                                                          |

Recurring Clothing payments have separate transactional journal-posting
integration evidence; they are not the mutable expense status table. Investor
funding/actual returns are now independently exercised above; principal
repayment, loan/owner activity, payroll and tax owner workflows and legacy
source-row review have not all been newly executed. A generic balanced manual
pair does not certify those workflows. Sequential settled-event report parity
is not an atomic multi-report snapshot during concurrent writes, an external
bank/e-wallet/cash reconciliation, a physical stock count or a tax audit.

An attempted combined run at `/tmp/bms-reconciliation-27Jh4E` was interrupted
after C05 and produced no final result. It is not a pass. Its orphaned owned
scratch database/env/cache were removed with strict ownership guards and absence
verified in `interrupted-cleanup.json`.
The later combined run `/tmp/bms-reconciliation-NVffB0` completed with a real C09
assertion failure, not an interruption or a pass. It retained complete failure
evidence and verified scratch database removal. The date-boundary repair above
must pass a fresh combined run; required gates were not started by that failed
attempt.

The later `/tmp/bms-final-validation-N2eKyx/execution-results.json` records a
completed combined driver with exit zero, but its inspected `combined.log`
contains only 11 intermediate milestones and no final harness result. Its exact
artifacts were subsequently identified at `/tmp/bms-reconciliation-09wK3r` using
creation timing, schema database identity and the private temporary environment.
No harness/server remained active. Independent guarded cleanup removed only
`bms_reconciliation_test_99832972911a4653a60d9bdec5923b96` on localhost:5433
and its temporary environment/cache, verifying absence in
`independent-cleanup.json`. The final harness result is still missing: exit zero
and successful cleanup do not establish complete execution. This run is not
claimed as a passing complete workflow.

### Fresh Required Gates

Current completion-batch evidence:
`/tmp/bms-reconciliation-XMrLWS/result.json`, driver
`/tmp/bms-complete-26-gates-k2Tp6Q/execution.json`. All nine required commands
pass: guardrails, lint, strict typecheck, 364 unit files / 4,514 tests,
12 integration files / 90 tests, 4 hardening files / 12 tests, unchanged enforced
coverage, inventory ledger controls and accounting transaction sanity.
Accounting sanity scanned one synthetic baseline transaction with zero issues.
The owned database was removed and verified. Existing lint and 595-line
integration-test warnings remain visible; no rule, test or threshold was disabled.
Guardrails' incidental LIV-1 completion date was restored, with the entire
historical report byte-equal to this run's pre-gate snapshot.

Current-source browser regression checks passed without reopening earned cases:
I01 `/tmp/bms-reconciliation-6DcCaH/result.json`, I06
`/tmp/bms-reconciliation-pcZb0A/result.json`, I07
`/tmp/bms-reconciliation-oZpIxp/result.json` and I08
`/tmp/bms-reconciliation-vdi9Cb/result.json`. All have success and verified owned
database removal. Execution record:
`/tmp/bms-complete-26-regressions-vuUwUw/execution-results.json`.

Two failed current-batch gate attempts remain preserved: `hfHqAl` stopped at lint
and `tdfm6j` stopped at five obsolete mock/probe expectations. Local braces and
the correct atomic/source-evidence test contracts were repaired and focused
checks passed before the final full run. Two new red-to-green regressions also
prove dated cost correction rejects actual split/bundle transformation sources,
not only the legacy assembly bucket. Final gate success does not waive the
unresolved financial findings.

Historical, superseded gate evidence follows:

`node tests/e2e/clothing-reconciliation.browser.cjs --gates` passed all nine
required commands after the transit repair and target-compatibility correction.
Evidence: `/tmp/bms-reconciliation-QM3LAp/result.json` and per-command logs;
driver `/tmp/bms-transit-gates-vqJwXG`. Guardrails/lint/typecheck pass;
358 unit files / 4,444 tests, 12 integration files / 89 tests and 4 hardening
files / 12 tests pass. Enforced coverage and inventory controls pass; accounting
sanity scanned one synthetic baseline transaction with zero issues. The owned
localhost:5433 database was removed and verified absent. Existing lint and
527-line integration-file warnings remain. No test, threshold or guardrail was
disabled. The combined run's final result remains unverified separately;
its independently verified cleanup is recorded above.

The earlier `/tmp/bms-reconciliation-X7rZIa` pass of 4,435 unit tests predates
the nine new regressions. The first post-transit attempt
`/tmp/bms-reconciliation-vp2j9t` passed guardrails/lint but failed typecheck on
Set spread under the existing target. `Array.from` fixes that error without
changing compiler settings; immediate typecheck and all 59 focused tests passed
before the successful full rerun. The failed attempt's owned database was removed;
its incidental LIV-1 report-date change was restored and byte-verified against
its pre-run snapshot. The final gate's same incidental line was also restored
and byte-verified against `/tmp/bms-reconciliation-QM3LAp/pre-gates-summary.md`.

## Remaining Work And Owner Decisions

All26 mandatory C01-C12, I01-I08 and X01-X06 scenarios now have scoped actual
evidence. Latest completion results are listed at the top and in the checklist.
Required current-batch quality gates and selected current-source workflow
regressions now pass as recorded above. Actual additive DDL replay passes in `/tmp/bms-reconciliation-7Gb690`:
both exact SQL files preserve legacy values and null new fields; explicit zero,
source-link restriction/cascade and index checks pass, and the owned database was
removed. This does not certify the full target database's migration history.
The alternate no-key import failure first left two orders after stock rejection;
the owning Serializable boundary now creates/syncs exact rows atomically. All31
neighboring database integrations pass in `/tmp/bms-reconciliation-1qgxw0`, with
verified cleanup. Known future receipts no longer trigger legacy fallback, and
conserved explicit zero split/assembly costs remain distinct from supplier extras.
Source-owned composite movements reject generic edits/deletion. Historical expense
defects still prevent full-accounting reconciliation certification.

Owner decisions remain necessary for partial-shortage spendable credits,
credit reversal/expiry/write-offs and expense correction/legacy evidence. Composite
physical returns and zero-cost supplier extras follow the explicit approvals above.
No historical data repair, migration on a business
database, production build, commit, push or deployment is part of this change.
The earlier unanswered physical-return/free-cost decisions were subsequently
resolved by the owner; they are not current blockers. Unsupported partial-shortage
spendable credit remains explicit, not disguised as whole-product credit.

## Business-Rule Record

This declaration covers implemented changes and actual scoped evidence only. It
does not approve unresolved expense/credit policies or certify real-world books.

<!-- business-rule-change -->

```json
{
  "businessRuleChange": true,
  "rationale": "Complete the owner's 26-scenario reconciliation request at the owning boundaries: supplier discovery/date/settlement, immutable customer/stock history, exact source-cost conversions and returns, explicit zero supplier extras sold at normal prices, cost-conserving split pieces and atomic bulk imports. Preserve deeper Expenses/P&L/Balance Sheet findings without guessing historical remediation policy.",
  "owner": "Ron, requesting Clothing business/project owner, explicitly authorized all needed implementations to complete26 scenarios and approved exact original components/costs, separate zero-cost supplier extras and explicit split-piece acquisition costs. Product service owns receipts/settlement; inventory cost-lot/conversion services and transaction sync own physical allocations; customer financial/refund boundaries own approval/payout/return; accounting projection owns dated report costs.",
  "invariant": "Only eligible issued credit is spendable; partial shortages cannot use whole-product credit. Manila dates honor saved cutoff. Actual delivery, cash approval/payment and physical returns are distinct. Supplier-free extras keep zero acquisition cost but ordinary customer price. Exact original lot/component cost and source survive transfer, assembly, sale and return; split pieces exactly conserve parent cost and only a complete original set rebuilds once. Unknown costs and future stock never become guessed availability/value. Source-owned history is immutable, imports and keyed requests roll back completely, and historical five-report/CSV balances retain their actual event dates.",
  "domains": ["clothing", "general-merchandise", "trucking", "shared"],
  "policyPaths": [
    "docs/business-logic/clothing/operations-products.md",
    "docs/business-logic/clothing/operations-inventory.md",
    "docs/business-logic/clothing/operations-transactions.md",
    "docs/business-logic/clothing/operations-customers.md",
    "docs/business-logic/clothing/operations-shipments.md",
    "docs/business-logic/clothing/accounting-expenses.md",
    "docs/business-logic/clothing/accounting-profit-loss.md",
    "docs/business-logic/clothing/accounting-investors.md",
    "docs/business-logic/clothing/accounting-balance-sheet.md",
    "docs/business-logic/clothing/accounting-ledger.md",
    "docs/business-logic/clothing/accounting-journal.md",
    "docs/business-logic/general-merchandise/accounting-expenses.md",
    "docs/business-logic/general-merchandise/accounting-balance-sheet.md",
    "docs/business-logic/general-merchandise/accounting-ledger.md",
    "docs/plans/SUPPLIER_CREDIT_AND_RECONCILIATION_CHECKLIST.md"
  ],
  "affectedPaths": [
    ".gitignore",
    "prisma/schema.prisma",
    "prisma/migrations/20261028000001_inventory_movement_cost_provenance/migration.sql",
    "prisma/migrations/20261028000002_split_acquisition_cost/migration.sql",
    "src/core/routePermissions.ts",
    "src/lib/inventory/cost-lots.ts",
    "src/lib/inventory/physical-returns.ts",
    "src/lib/inventory/split-stock.ts",
    "src/lib/inventory/bundle-stock.ts",
    "src/lib/accounting/inventoryCogsShared.ts",
    "src/lib/accounting/inventory-cogs.ts",
    "src/lib/accounting/inventory-valuation.ts",
    "src/lib/validations/transaction-refund.validation.ts",
    "src/app/api/inventory/movements/route.ts",
    "src/app/api/customers/[id]/refunds/route.ts",
    "src/app/api/bundles/route.ts",
    "src/app/api/mix-and-match/route.ts",
    "src/app/api/split-batches/route.ts",
    "src/app/clothing/operations/customers/[id]/components/OrdersAndTransactions.tsx",
    "src/modules/clothing/operations/inventory/hooks/useInventoryPage.ts",
    "src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSelection.ts",
    "src/modules/clothing/operations/inventory/hooks/useInventoryAdjustmentSubmit.ts",
    "src/modules/clothing/operations/inventory/components/InventoryPage.tsx",
    "src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts",
    "src/modules/clothing/operations/inventory/types/index.ts",
    "src/modules/clothing/operations/products/components/SplitTab.tsx",
    "src/modules/clothing/operations/products/components/BundlesTab.tsx",
    "src/modules/clothing/operations/products/services/BundleService.ts",
    "src/modules/clothing/operations/products/services/stockCheckService.ts",
    "src/modules/transactions/api/movementStateHelpers.ts",
    "src/modules/transactions/api/transactionInventorySync.ts",
    "src/modules/products/api/service.ts",
    "src/modules/products/api/supplier-resolution.ts",
    "src/modules/clothing/operations/products/components/SupplierProductControls.tsx",
    "src/modules/transactions/api/service.ts",
    "src/app/api/transactions/[id]/route.ts",
    "src/hooks/useSheetData.ts",
    "src/lib/accounting/profit-loss-journal.ts",
    "src/app/api/accounting/ledger/route.ts",
    "src/app/api/accounting/journal/route.ts",
    "src/app/api/accounting/profit-loss/route.ts",
    "src/app/api/accounting/profit-loss/details/route.ts",
    "src/app/clothing/accounting/ledger/hooks/useLedger.ts",
    "src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts",
    "src/app/clothing/accounting/balance-sheet/components/BalanceSheetControls.tsx",
    "tests/e2e/clothing-reconciliation.browser.cjs",
    "tests/e2e/helpers/clothing-reconciliation-atomicity.cjs",
    "tests/e2e/helpers/clothing-reconciliation-report-checks.cjs",
    "tests/e2e/helpers/clothing-reconciliation-investors.cjs",
    "tests/e2e/helpers/clothing-reconciliation-scenarios.cjs",
    "tests/e2e/helpers/clothing-reconciliation-composites.cjs",
    "tests/e2e/helpers/clothing-reconciliation-cost-corrections.cjs",
    "tests/e2e/helpers/clothing-reconciliation-historical.cjs",
    "tests/e2e/supplier-credit-modal.browser.cjs"
  ],
  "tests": {
    "paths": [
      "src/lib/inventory/__tests__/cost-lots.test.ts",
      "src/lib/inventory/__tests__/physical-returns.test.ts",
      "src/lib/inventory/__tests__/split-stock.test.ts",
      "src/lib/inventory/__tests__/bundle-stock.test.ts",
      "src/lib/accounting/__tests__/inventoryCogsShared.test.ts",
      "src/lib/accounting/__tests__/inventory-cogs.test.ts",
      "src/app/api/inventory/movements/__tests__/route.test.ts",
      "src/app/api/customers/[id]/refunds/__tests__/route.test.ts",
      "src/app/api/bundles/__tests__/route.test.ts",
      "src/modules/clothing/operations/inventory/hooks/__tests__/useInventoryPage.test.tsx",
      "src/modules/clothing/operations/inventory/hooks/__tests__/useInventoryAdjustmentSelection.test.ts",
      "src/modules/clothing/operations/inventory/components/__tests__/InventoryPage.test.tsx",
      "src/modules/clothing/operations/products/services/__tests__/stockCheckService.test.ts",
      "tests/unit/transactions/transactionInventorySync.test.ts",
      "tests/unit/api/transaction-accounts-receivable.service.test.ts",
      "src/modules/products/api/__tests__/service.accounting.test.ts",
      "src/modules/clothing/operations/inventory/lib/__tests__/inventoryTransforms.test.ts",
      "src/modules/products/api/__tests__/supplier-resolution.test.ts",
      "src/modules/clothing/operations/products/components/__tests__/SupplierProductControls.test.tsx",
      "tests/unit/accounting/accounting-expenses.business-logic.test.ts",
      "src/app/api/accounting/profit-loss/__tests__/route.test.ts",
      "tests/unit/api/accounting-profit-loss.api.test.ts",
      "tests/unit/api/accounting-ledger.api.test.ts",
      "tests/unit/api/accounting-journal.api.test.ts",
      "src/lib/accounting/__tests__/transaction-recognition.test.ts",
      "tests/unit/accounting/clothing-ledger-entry-guidance.test.ts",
      "tests/unit/accounting/balance-sheet-rules.test.ts",
      "src/modules/transactions/api/__tests__/service.deletion.test.ts",
      "tests/unit/api/transaction-by-id.api.test.ts",
      "tests/unit/audit/clothing-integrity-audit.test.ts",
      "tests/integration/transaction-save-concurrency.integration.test.ts",
      "tests/integration/clothing-supplier-credits.integration.test.ts",
      "tests/integration/clothing-customer-money.integration.test.ts"
    ],
    "results": "All26 mandatory scenarios have scoped actual evidence. Current-source I01/I06/I07/I08 real browser regressions pass with verified cleanup in6DcCaH/pcZb0A/oZpIxp/vdi9Cb; earlier C08 and X04 remain completed. All nine final gates pass in /tmp/bms-reconciliation-XMrLWS/result.json:364unitfiles4514tests,12integrationfiles90tests,4hardeningfiles12tests, unchanged enforced coverage, guardrails/lint/typecheck, inventory controls and accounting sanity1synthetic/0issues, ownedDB removed. Exact migration DDL replay7Gb690 preserves legacy/null/zero/FK/index behavior; exact ignore exceptions expose only reviewed migrations. Focused transformed-history valuation31tests and audit/AR26tests pass after red-to-green repairs. Earlier failed gate attempts and historical totals are retained, not counted as current passes. Expense history and account-label findings remain open. No real-book certification, business database migration or deployment is claimed."
  },
  "docs": {
    "paths": [
      "docs/business-logic/clothing/operations-products.md",
      "docs/business-logic/clothing/operations-inventory.md",
      "docs/business-logic/clothing/operations-transactions.md",
      "docs/business-logic/clothing/operations-customers.md",
      "docs/business-logic/clothing/operations-shipments.md",
      "docs/business-logic/clothing/accounting-expenses.md",
      "docs/business-logic/clothing/accounting-profit-loss.md",
      "docs/business-logic/clothing/accounting-investors.md",
      "docs/business-logic/clothing/accounting-balance-sheet.md",
      "docs/business-logic/clothing/accounting-ledger.md",
      "docs/business-logic/clothing/accounting-journal.md",
      "docs/business-logic/general-merchandise/accounting-expenses.md",
      "docs/business-logic/general-merchandise/accounting-balance-sheet.md",
      "docs/business-logic/general-merchandise/accounting-ledger.md",
      "docs/reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md",
      "docs/plans/SUPPLIER_CREDIT_AND_RECONCILIATION_CHECKLIST.md"
    ]
  },
  "divergence": {
    "status": "intentional",
    "reason": "Clothing owns supplier/settlement/source-lot/composite/physical-return and additive schema behavior; GM keeps independent product/inventory/payment/return APIs and virtual policies. Shared Ledger/Balance Sheet UI changes also serve GM, and expense cache refresh serves Clothing/GM/Trucking with separate keys. Shared accounting COGS remains Clothing's projection; household is unaffected. No business data or historical snapshots are rewritten and no target migration/deployment is run.",
    "approvedBy": "Ron, requesting owner, explicitly approved completion implementations, original component/cost restoration, separate supplier-free zero acquisition cost at the normal selling price, and explicit cost-conserving split component acquisition costs. Existing sibling-domain policies remain intentionally separate; unresolved expense and partial-shortage credit policy is not invented."
  }
}
```

<!-- /business-rule-change -->
