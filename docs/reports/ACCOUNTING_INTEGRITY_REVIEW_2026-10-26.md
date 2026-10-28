# Clothing Accounting Integrity And Correctness Review

Review date: 2026-10-26. Scope: the development working tree supporting
`/clothing/accounting/` and directly connected operational/reporting code.

## 1. Executive Assessment

**The reviewed accounting implementation is not yet demonstrated safe as the sole
basis for declaring missing or surplus funds.** There are concrete validation and
reporting weaknesses, unresolved event/accounting policy questions, and no
external cash reconciliation demonstrated by this review.

Two defect groups have been corrected in the current working tree: signed net
COGS reversals on the balance sheet, and legacy-sale/payment recognition across
reports. Those changes have unit-test evidence. They have not been committed,
deployed, reconciled against historical records, or shown to repair existing data.

The subsequently approved whole-product supplier transfer/credit implementation
is recorded separately in [section 12](#12-approved-supplier-resolution-implementation).
It is development work, not deployment or confirmation of the example shipment's
actual records. The estimate-only Shipping Fee Calculator is unchanged/excluded.

The most urgent remaining review items are:

1. Consistent payment validation, concurrency control, and retry handling.
2. Preservation of actual cash receipts and payouts when orders or refunds change.
3. Explicit separation of cash refunds, receivable credits, and stock returns.
4. Ledger balance semantics and incoming-card account classification.
5. Consistent historical inventory valuation and landed-cost corrections.

This is a technical integrity review, not a financial-statement audit, tax opinion,
accounting-owner approval, fraud assessment, or certification of live balances.
No missing money, excess money, or monetary exposure has been established.

### Dated Follow-Up (2026-10-28)

This October 26 assessment is historical, not a current list of unfixed items.
The [expanded reconciliation analysis](CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#expanded-accounting-analysis-2026-10-28)
records newer real-app Expenses/P&L/Balance Sheet tests, refund/supplier bridges,
shared UI/cache repairs and two reproduced high-severity expense-history defects:
later settlement backdates Cash, and deleting a paid expense removes its earlier
statement effect without a dated reversal. The statements still balance.

The earlier 19/26 and paused-I01 status is superseded: all 26 mandatory scenarios
now have passing scoped evidence, and all nine final gates passed. Implementation
was committed as `ce3f8f5d`; it has not been pushed or deployed by this work.
The [owner handoff and follow-up register](CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md#owner-handoff-and-follow-up-2026-10-28)
records expected improvements, the two open expense-history defects, Bank Fees
classification risk, unsupported partial-shortage spendable credit and release
prerequisites. Other legacy findings and financial-policy decisions remain open.
Use the linked report/checklist for precise before/after amounts. This dated
follow-up is documentation only; the October 26 assessment below remains
historical. No historical business data repair or live-books certification is
implied by either report.

## 2. Evidence And Scope

### Evidence Levels

| Label                      | Meaning                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------- |
| Confirmed behavior         | Directly visible in inspected source; does not prove affected business records exist.                 |
| Fixed in working tree      | Code changed and focused tests passed; not proof of deployment or historical correction.              |
| Conditional financial risk | Consequence depends on actual cash execution, data state, accounting policy, or concurrent execution. |
| Policy conflict            | Documentation, tests, or implementation differ; accountable accounting owner must decide.             |
| Assurance gap              | Required evidence or control was not established in the reviewed scope.                               |

### Included

- Clothing dashboard, journal, ledger, balance sheet/cash breakdown, P&L summary
  and details, and directly reviewed investor funding/forecast behavior.
- Customer payment endpoints, bulk collection, refund creation/deletion, and
  transaction status effects on derived reporting.
- Stock projection, sale/return movement COGS, cost snapshots, and relevant
  supplier/logistics accounting contracts.
- Nearby tests, the first remediation batch, and the validation results below.

### Excluded Or Not Established

- No production access, database queries, transaction sampling, statement
  matching, physical cash count, or physical stock count was performed.
- The localhost page was not browser-inspected in this review. No visual,
  interactive, export-parity, or production-runtime certification is claimed.
- No complete audit of payroll, taxation, expense lifecycles, supplier credits,
  loan interest, opening-balance provenance, every manual posting path, every
  permission, or all background/import jobs was completed.
- General merchandise has separate accounting routes with similar patterns;
  it has not been remediated or certified by this clothing review.
- Existing tests and historical audit reports are evidence of particular
  scenarios, not proof of transaction completeness or today's financial position.

The required change process is documented in the
[business-rule standard](../BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md).
The reviewed policy authority is the
[operational accounting policy](../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md)
and linked clothing contracts. Conflicts require the accountable accounting
owner; general accounting-policy decisions are not presumed approved by this
report. The requesting owner's narrower supplier-workflow approval is recorded
in section 12 and does not resolve the other findings.

## 3. How The Reports Are Produced

Sales/payment/refund reporting is substantially derived at read time from
operational records, rather than solely from an immutable journal of completed
financial events. Persisted manual/system journal lines also contribute.

| Source/event                       | Reviewed reporting treatment                             | Integrity dependency                                                          |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Ordinary payment                   | Debit Cash; credit Sales Revenue for non-A/R collections | Receipt amount/date and status inclusion must remain faithful to actual cash. |
| Reservation payment                | Debit Cash; credit Customer Deposits                     | A deposit is not automatically earned revenue.                                |
| Reservation recognition/forfeiture | Reclassify deposits using applicable status/date rules   | Voided refunds and forfeitures must remain distinct.                          |
| Shipped A/R sale                   | Debit Accounts Receivable; credit Sales Revenue          | Shipment/recognition date and gross sale must be correct.                     |
| A/R collection                     | Debit collection account; credit Accounts Receivable     | Collection is not a second sale; account mapping must suit incoming funds.    |
| Ordinary refund                    | Debit Sales Returns; credit Cash                         | A credit to a customer's unpaid debt is not necessarily cash paid out.        |
| Voided reservation refund          | Debit Customer Deposits; credit Cash                     | Payout must release the deposit liability, not create another expense.        |
| Sale inventory movement            | Debit COGS; credit Stock on Hand                         | Correct quantity, posting date, cost basis, and movement ownership.           |
| Return to stock asset              | Reverse COGS; restore Stock on Hand                      | Must correspond to actual received goods at an approved cost.                 |
| Return to scrap                    | Existing COGS helper does not reverse COGS               | Separate loss/write-off policy must be understood.                            |

Source boundaries: [recognition helpers](../../src/lib/accounting/transaction-recognition.ts),
[fetchers](../../src/lib/accounting/data-fetchers.ts),
[COGS calculation](../../src/lib/accounting/inventoryCogsShared.ts),
[journal](../../src/app/api/accounting/journal/route.ts),
[ledger](../../src/app/api/accounting/ledger/route.ts),
[balance sheet](../../src/app/api/accounting/balance-sheet/route.ts), and
[P&L](../../src/app/api/accounting/profit-loss/route.ts).

**Architectural consequence:** editing, deleting, or reclassifying operational
records can change historical financial reports without a separate dated
financial reversal. An immutable posting model is one possible solution, not a
mandatory rewrite; the immediate requirement is controlled, auditable financial
event semantics across all entry points.

## 4. Findings By Priority

### A01. High: Direct Payment Endpoint Does Not Enforce The Bulk Rules

**Status:** confirmed validation difference; conditional financial impact.

The [payment schema](../../src/lib/validations/transaction-payment.validation.ts#L3)
accepts zero on direct creation while the bulk schema requires a positive amount.
The [direct payment POST](../../src/app/api/customers/[id]/payments/route.ts#L169)
creates the row, sums payments, and sets `lineTotal = gross - paid` without a
remaining-balance cap or the bulk path's A/R reservation prohibition.
The [bulk endpoint](../../src/app/api/transactions/payments/bulk/route.ts#L146)
does perform those additional checks.

Example: a sale of 100 with 80 already collected can accept an additional direct
payment of 50, leaving 130 in payment records and a negative balance. If that
50 was not actually received, cash reporting is overstated. If it was received,
cash may be correct, but the excess needs an approved customer-credit/liability
treatment rather than automatically being additional sales revenue.

**Revision:** define one owning collection validator/service used by all customer,
bulk, and future import entry points. Enforce positive amounts, remaining-balance
or approved overpayment rules, A/R/deposit distinctions, and legacy-paid migration
semantics server-side. Do not silently discard real overpayments.

**Required proof:** direct and bulk parity, zero/negative rejection, overpayment
handling, pre-existing legacy payments, atomic rollback, and valid A/R collection.

### A02. High: Concurrent Collections And Retries Lack Demonstrated Protection

**Status:** source-backed concurrency/replay risk; no race was executed.

The [bulk transaction](../../src/app/api/transactions/payments/bulk/route.ts#L146)
reads transaction/payment totals, validates, inserts, and updates balances without
an explicit serializable isolation option or row lock visible in that path.
No request idempotency key was found in the reviewed creation path. Actual
database default isolation and external protections were not queried.

Example: two requests each collect 60 against an outstanding 100. Under a
permissive interleaving, both can validate against the same balance, create 120
of payment events, and overwrite the transaction's summary adjustment with 60.
An uncertain-response retry can also duplicate a valid partial payment while
sufficient balance remains.

**Revision:** choose locking or serializable execution with safe conflict retry,
plus stable request/event idempotency where appropriate. Idempotency and balance
serialization solve different problems; one does not replace the other.

**Required proof:** two-connection races, same-request replay, different-request
collections, retry after conflict, and failure after insertion. This requires an
isolated disposable database, not only mocked unit transactions.

### A03. High: Deleting A Refund Removes Its Derived Financial Effect

**Status:** confirmed deletion behavior; financial error depends on execution.

The [refund DELETE](../../src/app/api/customers/[id]/refunds/[refundId]/route.ts#L45)
soft-deletes both the refund and its owned inventory return movement. It does not
create a dated cash-recovery event or accounting reversal in that path. Report
fetchers exclude soft-deleted refunds.

If 30 was actually paid out, deletion makes the payout disappear from reported
cash, overstating it by 30 unless an independent correcting event exists. It can
also remove the reported stock return even when goods remain physically present.
If the refund was only an erroneous, never-executed record, deleting/correcting
it may instead be legitimate. Those cases need distinct semantics.

**Revision:** distinguish draft correction, completed refund, recovered funds,
and stock-return correction. Preserve who changed what, why, original execution
date, and the dated correction. Do not automatically create a cash receipt merely
because someone reverses a refund record.

**Required proof:** completed versus unexecuted refund, period boundaries, partial
cash recovery, independent stock handling, and report history before/after.

### A04. High: Current Order Status Can Remove Historical Receipts

**Status:** confirmed report filtering; conditional cash/reporting error.

The reviewed [journal](../../src/app/api/accounting/journal/route.ts),
[ledger](../../src/app/api/accounting/ledger/route.ts),
[balance sheet](../../src/app/api/accounting/balance-sheet/route.ts), and
[P&L](../../src/app/api/accounting/profit-loss/route.ts) omit non-reservation
payments on canceled/voided transactions while separately processing refunds.

Example: an actual receipt of 100 followed by cancellation and an actual refund
of 100 should have net cash movement zero. If the receipt is excluded and refund
retained, the report can instead show a net cash reduction of 100. Cancellation
without a refund can similarly hide funds that are still held.

**Revision:** resolve whether those receipts are supported and which reversal,
liability, or refund event follows cancellation. Prevent unsupported combinations
at write boundaries; do not delete a real receipt merely through status filtering.
Reservation void and forfeiture are intentional distinct workflows, not aliases.

**Required proof:** paid non-reservation cancellation, cancellation without payout,
full/partial refund, voided reservation, forfeiture, and historical as-of reports.

### A05. High: Refund Amount Does Not Establish A Cash Payout

**Status:** confirmed limit behavior; policy-dependent classification risk.

The [refund POST](../../src/app/api/customers/[id]/refunds/route.ts#L221)
limits ordinary refunds using the sale amount, not collected funds. Voided
reservation refunds have a separate collected-deposit cap. Reports generally
credit Cash for ordinary refunds.

Example: a sale of 100 with only 20 collected has an 80 receivable. Canceling the
sale could require a 20 cash refund and an 80 receivable credit, not 100 cash out.
Conversely, an actual approved 100 cash payment is a real outflow even if only 20
was collected on that sale; the report must not invent a smaller outflow.

**Revision:** accounting owner must define cash payout, receivable reduction,
customer credit, and goodwill/exception payments separately. A blanket collected-
cash cap is not approved by this review. Physical stock return is a separate
event and must not be inferred solely from refund amount.

**Required proof:** unpaid A/R, partially paid sale, cash-plus-credit cancellation,
refund without goods, goods without refund, and cumulative refund limits.

### A06. High: Historical Inventory Costs Have Mixed Time Semantics

**Status:** confirmed snapshot/fallback design; policy reconciliation unresolved.

[COGS calculation](../../src/lib/accounting/inventoryCogsShared.ts) prefers
movement `unitCost`; missing snapshots use current product costs. Existing sale
snapshots are preserved by
[movement updates](../../src/modules/transactions/api/movementStateHelpers.ts),
while product-origin receipt creation in the
[product service](../../src/modules/products/api/service.ts) does not consistently
provide the same snapshot lifecycle. The policy expects actual landed costs to
inform COGS once actual logistics charges are known.

Consequently, a later cost correction can leave snapshotted sales unchanged while
changing snapshotless history. Return cost lookup can also miss legacy movement
metadata and fall back to a newer product cost. Immutable sale costs are not
inherently wrong; unrecorded differences between cost models are the concern.

**Revision:** choose and document sale-time costing, actual-cost corrections,
revaluation/delta entries, cutover treatment, and matching return costs. Do not
rewrite historical reports or backfill cost guesses without approval.

**Required proof:** actual cost after partial sale, sale/return across cutover,
legacy snapshots, damaged/scrap returns, and logistics capitalization without
double counting. Compare P&L and inventory/clearing accounts together.

### A07. Medium: Ledger Balance Is Range/Filter-Local

**Status:** confirmed calculation/presentation mismatch risk.

The [ledger API](../../src/app/api/accounting/ledger/route.ts) selects the period
and computes balances starting at zero. The client
[derived data](../../src/app/clothing/accounting/ledger/hooks/ledgerDerivedData.ts)
recomputes balances after account/search filtering. The
[table](../../src/app/clothing/accounting/ledger/components/LedgerListTable.tsx)
labels the result `BALANCE`.

Example: cash brought forward of 1,000 and this month's outflows of 200 can show
-200 in a period-only view, not the actual 800 closing balance. Search can reduce
the visible running total further. This can resemble missing funds when it is
only a presentation/windowing difference.

**Revision:** choose true account running balances with brought-forward amounts,
or label the value explicitly as filtered/period net movement. Search should not
silently redefine a value presented as an account balance. Align exports too.

### A08. Medium: Incoming CARD Collections Reuse An Outgoing Account Mapping

**Status:** confirmed reachable mapping; settlement policy unresolved.

The [method mapper](../../src/lib/accounting/payment-accounts.ts#L1) maps `CARD`
to `Credit Card Payable`. The
[recognition helper](../../src/lib/accounting/transaction-recognition.ts#L184)
uses that mapper for A/R collection debits; non-A/R payments use Cash directly.
The [payment schema](../../src/lib/validations/transaction-payment.validation.ts)
accepts a free-text method, so CARD is not rejected by that schema.

A supplier card purchase can appropriately create a card liability. An incoming
customer card collection generally requires an approved asset/clearing and
settlement treatment, not an unexplained debit to a supplier-payment liability.
This can misclassify assets/liabilities even when the journal balances.

**Revision:** separate incoming collection mapping from outgoing settlement
mapping; confirm merchant settlement delay, fees, refunds, and supported methods.
Do not globally change CARD mapping and break valid supplier postings.

### A09. Medium: In-Transit Stock Is Presented As On-Hand

**Status:** confirmed implementation/documentation conflict.

[Inventory projection](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts#L464)
sets in-transit reserved/unreserved quantities to zero and computes on-hand
availability from product quantity less allocation. The
[transform tests](../../src/modules/clothing/operations/inventory/lib/__tests__/inventoryTransforms.test.ts)
encode that behavior even for an In Transit product, whereas the operational
policy describes a four-number split.

This is an operational availability issue, not proof the balance-sheet Stock on
Hand figure has the same defect. Treating both screens as interchangeable creates
a false reconciliation and can imply unavailable goods are physically present.

**Revision:** accounting/operations owner must confirm the intended allocation
model. Reconcile physical location/status, reservations, movements, and accounting
reclassification without automatically posting financial entries from a UI label.

### A10. Medium: YTD Label And Comparison Windows Differ

**Status:** confirmed date-range mismatch; future-posting impact conditional.

The [dashboard](../../src/app/accounting/_shared/AccountingDashboardRoutePage.tsx)
labels This Year as Year to date, but
[date utilities](../../src/lib/accounting/date-utils.ts) end that selection on
December 31. The [comparison calculation](../../src/app/accounting/_shared/dashboard/accountingDashboardMetrics.ts)
uses prior-year-to-date, while the
[hook](../../src/app/accounting/_shared/dashboard/useAccountingDashboard.ts)
requests the balance sheet as of today.

Future-dated postings can enter current-year P&L while comparison and cash use
different cutoffs. Even without such records, the terminology states a different
window from the query. Existing full-year date tests are not approval to call it YTD.

**Revision:** explicitly choose calendar-year or YTD behavior and use like-for-like
comparison windows. Test date-only boundaries in UTC and Asia/Manila, leap years,
month/year ends, and future-dated entries. No global period change was made.

### A11. High Assurance Gap: Internal Cash Classification Is Not Reconciliation

**Status:** reviewed controls do not establish external cash completeness.

The [balance-sheet hook](../../src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts)
computes `unclassifiedDelta` between reported Cash and its detail lines. Both
originate from internal accounting data. A zero delta means the selected internal
details add up; it does not show agreement with a bank statement or cash count.
The [investor contract](../business-logic/clothing/accounting-investors.md)
distinguishes forecast obligations and calendar coverage from actual bank balances.

Likewise, a zero accounting equation can coexist with an omitted, duplicated,
misdated, or misclassified balanced entry. No bank/e-wallet statement-matching
workflow was established in the reviewed clothing accounting surfaces.

**Revision:** independently reconcile per real account/location using opening
balance plus verified receipts minus verified payments, allowing documented
timing differences. Match external records, track unmatched items and duplicate
references, and distinguish expected funds from counted/cleared funds. A new
reconciliation feature or historical reconciliation needs separate approved scope.

### A12. High Conditional Risk: Missing Costs Can Omit COGS Without An Exception

**Status:** confirmed helper behavior; affected records and loss amount unknown.

The [COGS helper](../../src/lib/accounting/inventoryCogsShared.ts#L205) uses the
product-cost map when the movement has no usable positive cost snapshot, defaults
a missing map entry to zero, then skips zero or non-finite computed costs. No
unvalued-movement exception is returned by that calculation path.

If a sold quantity has neither a valid snapshot nor a valid product cost, its
revenue can still be reported while its COGS and inventory reduction are omitted.
Profit can be overstated and remaining inventory overstated relative to the same
movement valued at its correct cost. Both missing journal legs are balanced by
their absence, so an accounting-equation check does not detect the omission.

Zero-cost goods can be legitimate. This report does not establish that all zero
costs are errors or that no separate upstream control detects them.

**Revision:** define legitimate zero-cost stock separately from missing valuation;
surface unvalued movements and their quantities in reporting/control results.
Consider preventing a report from being presented as complete while required
costs are unknown, rather than silently inventing a cost.

**Required proof:** missing product, missing snapshot and map cost, legitimate
zero cost, non-finite cost, return with missing original cost, and explicit
exceptions/approval handling. No new application behavior was changed here.

## 5. Defects Corrected In The Current Working Tree

| ID  | Prior defect                                                                             | Correction                                                                                             | Evidence and remaining limit                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Balance sheet applied COGS only when positive, discarding negative net return reversals. | Applies finite nonzero signed COGS to Stock on Hand, Retained Earnings, and stock details.             | [Balance-sheet tests](../../tests/unit/api/accounting-balance-sheet.api.test.ts) cover +100, zero, -75 and accounting-equation consistency; [COGS tests](../../src/lib/accounting/__tests__/inventoryCogsShared.test.ts) specify stock-return reversal. Does not establish historical stock/cost correctness.                          |
| F02 | Any payment row suppressed legacy revenue, even when its amount generated no posting.    | Journal, ledger, P&L summary and details use finite positive payment amounts for fallback suppression. | [Journal tests](../../tests/unit/api/accounting-journal.api.test.ts), [ledger tests](../../tests/unit/api/accounting-ledger.api.test.ts), and [P&L tests](../../tests/unit/api/accounting-profit-loss.api.test.ts) cover non-posting values and retain positive-payment coverage. Legacy fallback amounts still depend on source data. |
| F03 | P&L details included negative payments that summary ignored.                             | Details now reject non-positive payment revenue consistently with summary.                             | P&L tests compare summary revenue with detail revenue for zero, negative, non-finite, and positive cases. Not full summary/detail parity for every event/category.                                                                                                                                                                     |

Contracts updated with those changes:
[balance sheet](../business-logic/clothing/accounting-balance-sheet.md),
[journal](../business-logic/clothing/accounting-journal.md),
[ledger](../business-logic/clothing/accounting-ledger.md), and
[P&L](../business-logic/clothing/accounting-profit-loss.md).

The negative-COGS regression supplies signed totals to the route mock; it does not
execute a database-backed pre-cutover sale/post-cutover return lifecycle. That
integration scenario remains necessary before claiming end-to-end assurance.

## 6. Terminology And Account Review

### Subsequent User Workflow Clarification (2026-10-26)

The user clarified the reservation workflow after this review was drafted. The
[operating workflow](../business-logic/clothing/operations-workflow.md#31-reservation-deposit-terminology-and-allocation)
now records the intended rules:

- **Reservation Deposit** and **Customer Deposits** concern the same collected
  money, not two payments. Use Reservation Deposit for the customer-facing
  concept and Customer Deposits for its accounting liability account.
- No separate Reservation Fee exists in this workflow.
- Deposits, commonly 10% or sometimes 20%, apply per transaction/product code and
  reduce that transaction's remaining balance. No universal rate is prescribed.
- After the invoice has been sent and the order is Prepared (packed and ready
  for dispatch), payment completion is due within three days from the invoice
  date; noncompletion can result in forfeiture. Forfeiture adds no new cash.
- Supplier nonfulfillment is Voided with a deposit refund and is not attributed
  to reseller fault. A medical-emergency consideration can instead be a normal
  cancellation with an approved deposit refund, not a void.
- Additional installments and full prepayments can be collected while goods are
  in transit. Fully paid transactions are exempt from payment-overdue cancellation
  and the three-day payment deadline; awaiting checkout or pickup is not unpaid.
- A fully paid transaction may still receive an approved medical/other financial-
  emergency cancellation and refund, not an automatic overdue cancellation.
- For an overdue partially paid transaction, the business may approve retaining
  the entire initial required deposit, whether 10% or 20%, and refunding additional
  installments. An approved
  emergency exception may instead refund all collected funds. These are
  discretionary outcomes, not automatic refunds or automatic forfeiture of all
  money collected.
- A cancellation can contain both a forfeited amount and a refund-pending amount.
  Future controls must support that split without counting a payment twice or
  reducing Cash on approval alone. Refund payouts remain on the Customers page.

The user confirmed that the entire initial required Reservation Deposit is
forfeitable at either 10% or 20%; a 20% initial deposit is not capped at 10%.
Additional installments are separate and must not automatically be included in
that forfeiture. Preserve the transaction's agreed initial deposit basis rather
than inferring it from total collections. Approved emergency full-refund
considerations remain available. The workflow documents these requirements, not
a completed pending-refund feature or permission to rewrite historical outcomes.

This narrows the workflow questions in A04-A05 but does not close their reporting
risks: a normal canceled transaction may require a deposit refund rather than
forfeiture, and the receipt/payout must remain traceable. Deadline cutoff,
exception approval process, and automatic versus manual enforcement remain
unresolved. These are documented user statements, not independent accounting
sign-off or evidence of runtime implementation. No calculations, database fields,
historical records, or UI labels were changed by this clarification.

| Term/account              | Correct distinction for this review                                                             | Required action                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Cash                      | Policy combines cash, bank, and e-wallet balances; not just physical notes/coins.               | Preserve the policy but identify location-level funds separately for reconciliation.                         |
| Missing/surplus funds     | Difference from independently counted/cleared funds after timing adjustments.                   | Do not infer loss or surplus from a negative period movement or internal classification delta.               |
| Balance                   | Can mean account closing balance or filtered net movement; these are not interchangeable.       | Resolve A07 and align table/export labels.                                                                   |
| Year to date              | January 1 through the stated current/as-of day, not automatically December 31.                  | Resolve A10 without silently changing shared calendar-year behavior.                                         |
| Sellable value            | Inventory page multiplies available quantity by Actual Price, a projected selling price.        | Distinguish retail potential value from balance-sheet inventory cost; do not use it for cost reconciliation. |
| Stock on Hand             | Accounting asset at approved cost; operational on-hand quantity is a different measure.         | Show quantity, valuation basis, and as-of date distinctly.                                                   |
| COGS                      | Expense for sold goods; product unit-cost/pricing inputs are not themselves the period expense. | Explain snapshot and landed-cost correction policy.                                                          |
| Customer Deposits         | Liability until valid recognition, refund, or forfeiture.                                       | Do not treat every deposit receipt as earned sales.                                                          |
| Accounts Receivable       | Recognized customer debt; collection reduces debt rather than repeating revenue.                | Separate debt credit from cash refund and test transitions.                                                  |
| Credit Card Payable       | Liability for outgoing credit-card spending.                                                    | Do not reuse for incoming merchant collections without approved treatment.                                   |
| Landed Cost Clearing      | Temporary asset for confirmed actual logistics awaiting capitalization under policy.            | Do not post pricing estimates as actual cash costs or capitalize twice.                                      |
| Net Change                | Journal-wide debits less credits is primarily a balancing control.                              | Do not interpret zero as zero cash movement or a profit measure.                                             |
| Forecast cash obligations | Expected future payouts, not current bank funds or settled payments.                            | Keep forecast, posted, paid, and reconciled states distinct.                                                 |

The documented account sign convention is internally coherent: debit-positive
balances, liabilities/equity generally credit-negative internally, then inverted
for display. This observation does not certify every account classification or
unusual debit liability/credit asset presentation.

## 7. Existing Controls And Their Limits

- Refund creation validates cumulative monetary/returned-quantity limits and uses
  a serializable transaction for refund plus owned inventory return creation.
  This does not solve the ordinary-refund classification question or prove retry
  idempotency and production behavior.
- Existing COGS tests distinguish stock-asset returns from scrap and prefer
  movement snapshots over current product costs. They do not approve the later
  actual-cost correction policy.
- Reviewed route/API permission configuration did not reveal an obvious clothing
  accounting access gap. This was not a complete authorization penetration test.
- Supplier/logistics contracts include separate build-up, settlement, and delivery
  reclassification controls. Delivery status alone intentionally does not prove
  the reclassification was posted; operational completion must not imply financial
  completeness without checking the posting.
- A suspected missing explicit expense soft-delete filter was not accepted as a
  defect because shared Prisma soft-delete middleware applies to those reads.
- Investor posting links and warning flags provide useful exception evidence;
  calendar coverage or absence of warnings cannot certify all funds are present.

## 8. Validation Evidence

### Fresh Checks While Preparing This Report

- Eight selected unit suites passed: **89 tests**. These include the five
  first-batch reporting/COGS suites plus accounting date rules, payment-account
  mapping, and inventory transforms. No database-backed suite was invoked.
- All 45 local file links in the initial report draft and 24 in the documentation
  hub resolved. Links were rechecked after the report update.
- The successful date/mapping/transform tests confirm those tested behaviors;
  they do not resolve the policy conflicts described in A08-A10.

### Executed During The First Implementation Batch

| Check                                                              | Recorded result                                                      | Interpretation                                                                                                                |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Focused balance-sheet, journal, ledger, P&L, and shared COGS tests | 5 files, 39 tests passed                                             | Includes the new signed COGS and payment-recognition regression cases.                                                        |
| `npm run test:unit`                                                | Exit 0                                                               | Full configured unit suite passed; no claim of complete business-path coverage.                                               |
| `npm run lint`                                                     | Exit 0 with warnings in untouched files                              | Existing warnings remain; not a warning-free result.                                                                          |
| `npm run typecheck`                                                | Exit 0                                                               | Static type gate passed.                                                                                                      |
| Editor diagnostics for touched TypeScript files                    | No errors reported                                                   | Complements, not replaces, executable checks.                                                                                 |
| `git diff --check`                                                 | Passed                                                               | Patch whitespace check only.                                                                                                  |
| `npm run guardrails:check`                                         | Failed on existing oversized `SUMMARIZE` file, reported 20,716 lines | Not bypassed. Later stages of that chained command are not assumed passed. PR business-rule check skipped outside a PR event. |

Earlier test iterations exposed a negative-zero assertion mismatch and the
negative-payment P&L detail discrepancy; both were corrected before the recorded
successful focused run. The guardrail command's unrelated generated status-date
change was removed from the implementation batch.

### Not Executed Or Not Established

- Database-backed integration suite, accounting transaction sanity check, and
  inventory ledger controls: not run under the agreed no-database-access scope.
- Hardening suite, coverage measurement/gates, and browser/E2E checks: not run as
  part of the recorded first batch. No security or browser behavior changed there.
- Actual bank, e-wallet, physical cash, inventory, receivables, liabilities, and
  opening-balance reconciliation: not performed.
- Accounting-owner policy approvals, migration/backfill dry runs, and production
  verification: not performed.

The first implementation batch remains a partial technical correction, not a
completed quality-gate or financial-close certification.

## 9. Required Verification Matrix

The following is a proposed acceptance suite, not a list of executed checks.

| Scenario                                       | Assertions needed                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Cash sale and full/partial collection          | Source balance, Cash, revenue, journal/ledger, P&L totals/details agree; no duplicate recognition.                                   |
| A/R shipment and later collection              | Revenue recognized once; receivable reduced on collection; incoming method mapped appropriately.                                     |
| Reservation completion, void, forfeiture       | Deposit liability released exactly once under each approved event/date; refunds do not become sales expenses incorrectly.            |
| Concurrent/replayed payment requests           | Approved balance invariant holds after two connections and uncertain-response retry; no event lost or duplicated.                    |
| Canceled paid order                            | Historical receipt preserved or explicitly corrected; payout is recorded independently; historical as-of output remains explainable. |
| Partial/unpaid sale cancellation               | Separate customer debt credit and actual cash payout; neither invented cash-out nor remaining false debt.                            |
| Refund correction/deletion                     | Actual payout and actual goods remain traceable; reversals have dates, reasons, and actor references.                                |
| Return without refund/refund without return    | Stock and money move independently and consistently with approved policy.                                                            |
| Return across cutover                          | Correct cost restoration, signed COGS, opening balances, equity, and P&L treatment.                                                  |
| Actual landed-cost correction after sale       | Approved inventory/COGS deltas; no duplicated logistics capitalization or silent mixed historical revaluation.                       |
| Ledger date/account/search filtering           | Closing balance versus filtered movement is explicit; brought-forward amount and CSV semantics tested.                               |
| Future date/year end/leap day/timezone         | Current/comparison/as-of windows match labels and include each boundary event once.                                                  |
| Opening balances/manual and automated postings | No duplicated source events, balanced entries, approved account classification, provenance and cutoff traceable.                     |
| Decimal money and quantity precision           | Document rounding/scale rules; verify boundary amounts, tolerances, negative zero, non-finite inputs, and accumulated rounding.      |
| Report reads during concurrent writes          | Establish required snapshot consistency within and across reports; differences explainable by cutoff/version.                        |
| Independent reconciliation                     | External opening plus cleared receipts less payments matches counted/statement closing after identified timing items.                |

Numeric precision and cross-query snapshot consistency are **unverified review
areas**, not newly confirmed defects. Several report computations use JavaScript
numbers and multiple reads; quantify actual risk with targeted evidence before
choosing a numeric or transaction-isolation redesign.

## 10. Remediation And Sign-Off Order

1. **Accounting-owner decisions:** approve collection/overpayment rules, refund
   execution and reversal semantics, canceled receipts, card clearing, historical
   cost correction, and ledger period/balance presentation. Record a named owner
   and decision; this report does not supply approval.
2. **Protect source writes:** consolidate approved payment rules, control races
   and retries, and prevent unsupported financial states across all entry points.
3. **Preserve event history:** implement approved corrections/reversals and
   distinguish cash, receivable credits, and returned inventory. Keep audit links.
4. **Align report semantics:** resolve ledger windows, dates, terminology, card
   accounts, and inventory cost policy. Check shared/sibling consumers without
   assuming identical business rules.
5. **Prove invariant scenarios:** run targeted tests, isolated PostgreSQL
   concurrency/integration cases, required static/unit gates, and applicable
   accounting/inventory controls. Resolve or explicitly track gate blockers.
6. **Separately approve historical reconciliation:** use anonymized exports or an
   isolated copy first. Compare to independent source documents and statements;
   do not auto-repair, reset, or backfill business data based on this report.
7. **Release and close review:** only after explicit release authorization, verify
   the intended code is deployed and reconcile actual balances with the named
   owner. A passing test suite is not financial sign-off.

Until those steps are satisfied, use the module as an internally calculated
record requiring reconciliation, not conclusive evidence that funds are missing
or available to spend. A discrepancy should trigger investigation of cutoff,
classification, missing/duplicate events, and external statements before being
treated as a loss, surplus, or explanation of someone's conduct.

## 11. Supplier Nonfulfillment And Shipment Completeness Supplement

The pre-implementation findings S01-S08, code-path table, financial alternatives,
and 96-test review evidence are preserved in the linked
[supplier nonfulfillment review](SUPPLIER_NONFULFILLMENT_REVIEW_2026-10-26.md).
That dated snapshot does not describe the later approved implementation below.

## 12. Approved Supplier Resolution Implementation

### 12.1 Authority And Scope

On 2026-10-26 the requesting business/project owner confirmed that the credit
equals the missing item's saved amount, explicitly PHP 19,511.37 for Dreamgrow
Tiny Tots Pants (`DTTP-101626`), and authorized implementation. The owner then
explicitly excluded the Clothing Products Shipping Fee Calculator: it is rarely
used and is for pricing estimates only. Its implementation/tests have no pending
change from this task; neither resolution service nor API reads its state.

The approved invariant is preservation of the original funded value/payment:
delayed goods move with their existing product-origin funding, while confirmed
nonfulfillment replaces that right with usable same-supplier PHP credit, without
inventing cash, erasing card liability, or treating missing goods as physical
stock. Canonical behavior and boundaries are documented in
[Products](../business-logic/clothing/operations-products.md#supplier-nonfulfillment-and-future-purchase-credit),
[Shipments](../business-logic/clothing/operations-shipments.md#delayed-products-and-supplier-credits),
and the [operating workflow](../business-logic/clothing/operations-workflow.md#step-6-link-shipment-codes-to-products).
This user approval does not resolve every accounting policy question in section
11, authorize live data repair, or constitute independent accountant sign-off.

### 12.2 Implemented Boundaries

- An administrator-only serializable service owns transfer, issuance and
  application. UI, middleware and server permissions align; stable request IDs,
  unique keys, conditional balance decrement and Decimal cents protect retries
  and competing writes. The same ID with changed new-purchase details conflicts.
- Transfer preserves source amount/date/accounts/keys and original payment, moves
  source shipment linkage with the product, and adds an audit record. Mixed
  legacy funding and physical/customer fulfillment block whole-product resolution.
- Issuance is exactly saved Grand Total: Dr Supplier Credits / Cr Inventory in
  Transit. An already-paid acquisition source can be materialized once if absent;
  unsettled unpaid goods cannot generate a funded credit asset. Both dated payable
  settlement legs must match before issuance where payable funding was used.
- A replacement retains its full gross cost. Applied credit funds one component;
  only the remainder uses the selected payment account or Supplier Payable. The
  original card liability and unused credit remain. No Cash refund is posted.
- Issuance records only the remaining whole-product shortage, locks its
  independent edit/deletion, blocks new adjustment reversals, and makes credited
  products show zero physical availability. Open reseller reservations/payments
  are not automatically changed. Generic build-up cannot recreate credit funding.
  The drift control expects zero sellable quantity for credited goods and still
  fails on nonzero stock, without changing original ordered quantities.
- Reclass rows show product identity, group all product funding components, and
  reject nonfulfilled or incomplete-component selection. Unchecking is exclusion;
  deleting an original source has a different financial effect and is labeled so.
- Direct product edits, imports/bulk updates, deletion and source mutation guards
  preserve credit-owned funding. General merchandise intentionally does not gain
  this credit workflow; its shared mapper and API boundary are covered separately.
- The additive migration adds status/funding fields, credits, applications and
  transfer audit tables with keys/FKs and balance checks. Backup registration and
  product-parent filtering cover all three models. No credit reversal/expiry,
  partial-receipt allocation, automatic customer refund or historical repair was
  introduced. Existing actual logistics posting and the estimate calculator are
  not used or modified by supplier resolution.

### 12.3 Executed Implementation Evidence

- Schema validation and Prisma generation passed without a database connection.
- The actual additive SQL migration was applied to a newly created scratch
  PostgreSQL database on local test port 5433, starting from the pre-change
  schema. An old-format fake product retained its 19,511.37 amount and received
  ACTIVE/zero defaults; a negative available credit was rejected by the database.
- Scratch schema comparison showed no supplier-model drift. The only diff was
  the pre-existing investor-code sequence-default SQL formatting normalization.
- Five new PostgreSQL integration scenarios passed: exact credit/remaining
  balance and unchanged card liability; funded creation/application rollback and
  same-ID retry; a real simultaneous overspend race with one winner; audited
  transfer without another payment; and complete-component replacement reclass.
- The unchanged estimate calculator's six existing tests passed and its diff was
  verified empty after the owner's clarification.

### 12.4 Handoff Validation And Limits

| Check                                                           | Actual result                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                  | Passed; existing warnings in unrelated code remain. Explicit lint of the new browser fixture and supplier modules also passed without new warnings.                                                                                                                                                                                                                                      |
| `npm run typecheck`                                             | Passed after final service extraction, mobile layout and control changes; touched-file editor diagnostics were clear.                                                                                                                                                                                                                                                                    |
| `npm run test:unit`                                             | 352 files / 4,133 tests passed in the final run.                                                                                                                                                                                                                                                                                                                                         |
| `npm run test:integration`                                      | 11 files / 70 tests passed on scratch PostgreSQL. The five supplier scenarios passed again after guard extraction. The deliberate concurrent write-conflict log is expected by the overspend test.                                                                                                                                                                                       |
| `npm run test:hardening`                                        | 4 files / 12 tests passed.                                                                                                                                                                                                                                                                                                                                                               |
| `COVERAGE_ENFORCE=true npm run test:coverage`                   | 4,133 tests passed; 30.64% lines/statements, 64.73% branches, 47.74% functions. Existing floors were enabled and unchanged.                                                                                                                                                                                                                                                              |
| `npm run test:browser:supplier-credit`                          | Ten intercepted-API Chromium checks passed across desktop 1440x1100 and mobile 390x844: issuance/confirmation without client amount, partial application with gross cost preserved, transfer, credit balance/usage, and nonadministrator exclusion. Screenshots reviewed; mobile modal sizing and short action labels prevent clipping. No default E2E/reset setup or database was used. |
| `npm run accounting:transactions:sanitycheck -- --failOnIssues` | Passed on the remaining synthetic scratch data after exact cleanup of the three inconsistent AUDIT fixtures left by unrelated integration tests.                                                                                                                                                                                                                                         |
| `npm run inventory:ledger:controls`                             | Passed on scratch after that same fixture cleanup. Three additional unit regressions exercise zero expected stock for CREDIT_ISSUED, rejection of resurrected stock, and unchanged ACTIVE-product comparison.                                                                                                                                                                            |
| `npm run guardrails:check`                                      | Blocked by the existing 20,716-line SUMMARIZE hard stop. No override or unrelated decomposition was performed. The generated unrelated status-date edit was removed.                                                                                                                                                                                                                     |
| Later guardrail subchecks                                       | Browser-engine guard, doc-command drift, generated route permissions, module ACL coverage, script manifest and backup audit passed separately; 129 Prisma models covered. New service/report files were split below the 800-line threshold.                                                                                                                                              |

The audit fixtures initially produced three paid-line-balance and three inventory
drift findings. Their exact synthetic identities were verified before removal
from this task-created database; no production/business data or test expectations
were changed to obtain the clean control run. These sparse scratch controls are
not reconciliation of real balances or proof of every operational inventory case.

At the initial implementation handoff, existing business databases had not been
queried or migrated; all financial records used for the implementation checks
above were fake scratch fixtures. The later authorized development migration and
authenticated HTTP checks are recorded in section 12.5. Production and the
existing test database remain untouched. No production build, commit, push, or
deployment was performed. The initial integration scratch database was dropped
and its absence verified. The browser fixture closes its own server/browser.

Whole-product absence remains administrator-confirmed: the application does not
provide a complete physical receiving subsystem, and automatic opening movements
are not physical receipt evidence. Partial receipts, already reclassified/used
goods, credit reversals/expiry/disputes, cross-currency/cross-supplier application,
and multiple credits on one target require separately approved work. The supplier
reference is normalized free text, not a new supplier master. The credit list is
currently unpaginated. Registration/filter tests and hardening do not constitute
a demonstrated selective-backup restore round-trip of these financial records.
The broader A01-A12 findings remain open except for the specifically documented
earlier fixes; no missing or surplus money has been established.

### 12.5 Authorized Development Database Recovery

On 2026-10-26, the owner authorized a development backup, restored-copy rehearsal,
the supplier migration if verification passed, and separate historical-file
investigation. These operations are recorded in
[Development supplier-migration recovery](./DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md).

- A full custom-format backup of `localhost:5435/business_management` was restored
  into a newly created disposable database. Prisma 5.22 applied only
  `20261026120000_clothing_supplier_credits` there and then on development.
- All 125 preexisting non-audit business tables retained their fingerprints.
  All 1,392,527 original audit rows were preserved; concurrent scheduled checks
  appended normal audit entries. Historical migration records were unchanged.
- Authenticated GETs on `http://localhost:5001` returned 200: Products supplied
  240 active products with null supplier reference, ACTIVE status and zero credit
  applied; supplier credits returned an empty list. No auth bypass was used.
- Two edited historical SQL files were restored to their applied checksums. One
  missing file was recovered from an exact-checksum copy. Another 43 originals
  remain unavailable in the checked local archives and Git history. The two blank
  checksums were investigated, not overwritten: 26 columns and 17 indexes match.
- A final deploy rehearsal after file restoration ran no migrations and changed
  no history records. The disposable clone was dropped and its absence verified;
  the backup and private verification artifacts are retained.
- The final lint, typecheck and documentation-command drift checks passed.
  Aggregate guardrails remains blocked by the unchanged SUMMARIZE hard stop.

No supplier credit, application, transfer, payment, journal, or inventory movement
was created in development by these operations. This resolves the missing-column
Products failure, not the broader accounting findings, historical-chain gaps,
blank-checksum provenance, or actual financial reconciliation.
