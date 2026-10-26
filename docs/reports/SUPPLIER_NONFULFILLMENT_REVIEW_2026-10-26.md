# Supplier Nonfulfillment And Shipment Completeness Review

Review date: 2026-10-26. Pre-implementation supplement to the
[accounting integrity review](ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md).

**Dated review snapshot:** this report describes evidence and proposals before
the user's implementation approval. See the
[approved implementation and validation record](ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md#12-approved-supplier-resolution-implementation)
for subsequent changes; the earlier "unimplemented" status below is not a claim
about the current working tree.

## 1. Scope And Direct Answer

This follow-up reviews the user's example shipment `KPC 23930A-239`, expecting
H&M Pants (`HMP-101926`), H&M Shorts (`HMS-101926`), Premium Brand Footed Pants
(`PBFP-101626`), and Dreamgrow Tiny Tots Pants (`DTTP-101626`), but receiving only
the first three products. These are scenario identifiers supplied by the user,
not database records verified by this review.

**Yes: the reviewed Products Transit Build-Up service can include all four if all
four remain linked and meet posting eligibility.** Selecting a product row chooses
its shipment code; it does not limit posting to that one product or certify actual
shipment contents. Eligibility is based on linked product records, payment/date,
cutover, positive value, and existing posting keys, not a receipt confirmation.

The user confirmed two different supplier outcomes:

1. Goods still at the supplier are sent with a later order.
2. Goods sent to another buyer are replaced by credit toward a future purchase,
   not a refund to the original payment method.

Neither outcome is a new cash receipt. Neither proves the missing goods are
physically on hand. Supplier credit is also separate from any refund owed to a
reseller whose transaction cannot be fulfilled.

No business database, actual shipment manifest, supplier statement, or historical
posting was queried. No application code, ledger entry, shipment link, or product
quantity was changed during this review phase.

## 2. Confirmed Code Path At Review Time

| Stage                        | Reviewed behavior                                                                                                                                                                                                                                                                 | Consequence for the example                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Products selection           | [Build-up handler](../../src/modules/clothing/operations/products/hooks/useProductsGrid.tsx) gathers every loaded product matching the selected shipment code; API request sends the code.                                                                                        | Clicking H&M Pants does not mean only H&M Pants will be posted.                                                                       |
| Server eligibility           | [Product service](../../src/modules/products/api/service.ts) queries all active products with a case-insensitive matching shipment code. It does not query a received quantity, supplier-short resolution, manifest confirmation, or per-product arrival status.                  | A missing DTTP row linked to that code is not automatically excluded.                                                                 |
| Amount and accounts          | Each eligible unposted product creates its positive Grand Total: debit Inventory in Transit, credit the mapped payment account if Paid, otherwise Supplier Payable. Logistics components are disabled in this path.                                                               | All four eligible rows can become accounting transit sources. Paid goods do not get a Cash refund simply because they fail to arrive. |
| Posting date                 | Uses product Posting Date, falling back to Order Date, normalized to UTC midnight, subject to cutover.                                                                                                                                                                            | This is not necessarily the date the operator clicks Post or the date KPC confirms contents.                                          |
| Retry/source controls        | Stable product/component keys, transactional create/restore, duplicate skipping, and serializable isolation. Mixed source flows and conflicting downstream postings are blocked.                                                                                                  | Helpful duplicate controls do not establish that the selected goods actually shipped.                                                 |
| Reclassification UI          | [Reclass modal](../../src/modules/clothing/operations/shipments/components/TransitReclassModal.tsx) loads posted entries and initially selects all. Operator can select a subset.                                                                                                 | Without excluding the missing product, the default selection can include all four.                                                    |
| Reclassification server      | [Factory](../../src/modules/shipments/api/transitReclassRouteFactory.ts) requires Delivered shipment status and validates selected source entries and active linked products. Product-origin amounts come from the exact posted entries. No actual receipt quantity is consulted. | Delivered on the shipment is not evidence that every linked product arrived; all selected eligible amounts can move to Stock on Hand. |
| Clothing transaction wrapper | [Clothing route](../../src/app/api/shipments/[id]/transit-reclass/route.ts) executes the reclass through a serializable transaction using permanent product identity.                                                                                                             | Financial identity/concurrency protection does not replace item receipt validation.                                                   |
| Product reassignment         | [Identity guard](../../src/modules/products/api/service.ts) blocks shipment/code changes or deletion while active build, reclass, or supplier-settlement sources exist.                                                                                                           | Moving the posted missing product to the next shipment is not a safe ordinary grid edit.                                              |
| Shortage follow-up           | [Movement API](../../src/app/api/inventory/movements/route.ts) stores EXPECTED_LATER, CREDIT_PENDING, CREDIT_RECEIVED, CREDIT_APPLIED, expected shipment code, credit reference and amount.                                                                                       | These fields track follow-up; they are not supplier-credit financial postings or actual receipt events.                               |
| Accounting reports           | [Balance sheet](../../src/app/api/accounting/balance-sheet/route.ts) reads active reclass/build entries and adds their account movements. No supplier-credit metadata consumption was found in the reviewed clothing accounting API paths.                                        | Metadata alone does not remove a missing item's value from transit/stock or apply credit to a future payable.                         |

The selection endpoint can reclass a subset of product-origin entries; it does
not select received units within one product row. A partly received product
therefore needs its own quantity/value handling, not just a product checkbox.

## 3. Prioritized Findings

**S01. High: Shipment linkage is used as posting scope, not confirmed contents.**
The missing fourth product is included whenever it remains eligible and linked.
The existing [workflow](../business-logic/clothing/operations-workflow.md) advises
confirming contents and unlinking missing products before posting, but the owning
service does not enforce receipt/manifest confirmation. This is an operator
dependency, not an automated completeness control.

**S02. High: A Delivered shipment can reclass unreceived linked goods.**
The product-origin reclass honors source amounts and operator selection but lacks
a per-product receipt check. In the example, reclassing all four can overstate
Stock on Hand and understate Inventory in Transit (or another appropriate supplier
claim asset). Total assets and the accounting equation can remain unchanged.
This is not necessarily a cash error, but it is an asset-location/type error.

**S03. High: Supplier-credit tracking is not a credit subledger or settlement.**
The reviewed movement POST/PATCH updates inventory movement metadata. Marking
CREDIT_RECEIVED or CREDIT_APPLIED is not proof of an accounting journal, a
supplier-confirmed credit balance, remaining credit, or actual application to a
new purchase. A supplier credit can be missing from financial reporting even
when the operational follow-up says it was received. The credit amount need not
equal the original landed value: fees and allocations require evidence.

**S04. High: Missing goods discovered after posting lack a demonstrated guided
resolution across shipment identity and accounting.**
The identity lock appropriately prevents casually detaching financial history.
However, it also means the documented pre-posting unlink workflow is not a
complete post-posting remedy. Editing/deleting an original Paid build can remove
the report's original credit to Cash/Bank, falsely suggesting the original
supplier payment never happened. Do not remove source entries solely to bypass
the lock. First determine whether the original entry was erroneous or a real
payment/claim requiring a dated transfer/correction.

**S05. Medium: Build-Up confirmation totals differ from the posted components.**
The Products confirmation displays Forwarder's Fee, Lalamove, and a Total equal
to Grand Total plus those two amounts, while the server's disabled logistics flag
posts only Grand Total. Packaging is explicitly shown as excluded; the other two
logistics amounts are not excluded from that displayed Total. This can mislead an
operator into expecting a larger posting. It is a preview/terminology mismatch,
not evidence of actual duplicate logistics posting by this service.

**S06. Assurance gap: Supplier Short is not an automatic accounting correction or
receipt of delayed goods.**
A sellable-to-supplier_short movement reduces operational availability, but the
reviewed [seed/shrinkage query](../../src/lib/accounting/inventory-cogs.ts)
targets scrap movements, and the COGS sale/return helper targets sold transitions.
Neither is a dedicated supplier-credit posting. Changing an expected-shipment
text field does not prove stock arrived, release the shortage, or link an amount
to a new supplier invoice. Do not record the same shortage twice through product
quantity reduction and a shortage movement without reconciling their effects.

**S07. Assurance gap: Credit-funded purchases lack a demonstrated payment split
in the reviewed Products posting path.**
The build service credits one account for the product's full Grand Total based
on Paid/Unpaid and payment method. The
[payment mapper](../../src/lib/accounting/payment-accounts.ts) has no supplier-
credit settlement method. A future purchase partly covered by supplier credit
and partly by fresh cash needs both components represented; marking the whole
amount Paid by Bank can overstate cash-out. Do not add an arbitrary method label
without the supplier-credit balance and application controls behind it.

**S08. High: Operational received/on-hand quantity is not a verified receipt.**
The [inventory transform](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts)
derives Actual Quantity Received from product Quantity plus Additionals minus
manual Supplier Short and damaged quantities. Its final on-hand/available
calculation does not use shipment status to distinguish transit, and both
in-transit fields are set to zero. If the missing fourth product has positive
Quantity and no offsetting adjustment, it can therefore appear as received and
potentially available independently of whether a financial reclass was posted.
This is the shipment-specific consequence of finding A09 in the parent review,
not a separate proof of an actual affected record.

The [single-product create path](../../src/modules/products/api/service.ts)
also calls an automatic receipt helper which creates an opening_inventory-to-
sellable movement for positive quantity without checking shipment receipt status.
A later physical arrival must be reconciled against that existing movement rather
than blindly adding another receipt. Metadata saying EXPECTED_LATER is not that
reconciliation.

## 4. Accounting Treatment To Confirm, Not Automatically Post

These were proposed financial models for accounting-owner approval. Supplier
terms, ownership/risk transfer, payment status, tax/fee treatment, and actual credit
documents determine the correct accounts, dates, and amounts. The subsequent
user approval is separately recorded in the parent report.

| Situation                                                      | Required economic distinction                                                                                                | Illustrative entry if the stated basis is approved                                                                                                                                         |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Paid goods remain at supplier and will ship later              | Preserve the actual payment and right to goods; do not show physical warehouse receipt or pay again merely for reassignment. | Retain the appropriate asset; possibly transfer from Inventory in Transit to Supplier Advances/Goods Held at Supplier if that better reflects ownership and location. No new Cash receipt. |
| Paid goods will not be delivered and a usable credit is issued | Replace the right to goods with a supplier credit/prepayment claim.                                                          | Debit approved Supplier Credits/Advances asset; credit the inventory/claim asset being replaced. No Cash debit.                                                                            |
| Supplier merely promises a credit                              | Distinguish pending/disputed claim from confirmed usable credit.                                                             | Timing/account recognition needs approval; do not call a promise available cash or settled credit.                                                                                         |
| Unpaid goods are canceled with a supplier credit note          | Determine whether a liability is actually reduced rather than creating a cash-funded advance.                                | Where recognized, debit Supplier Payable and credit the corresponding asset, subject to invoice/credit-note evidence. Do not also create an asset for the same credit.                     |
| Credit is applied to a later purchase                          | Record the full new purchase and settle only the approved portion with supplier credit.                                      | For an approved payable model: debit Supplier Payable, credit Supplier Credits/Advances for credit applied; settle the remaining payable with actual Cash/Bank.                            |
| Missing item already reclassed to Stock on Hand                | Correct the physical/location misstatement while preserving the actual supplier payment and audit trail.                     | A dated transfer/correction may be needed from Stock on Hand to the approved claim/credit asset; amount and cutoff require reconciliation.                                                 |

Illustration only: suppose the missing product's approved carrying value and
confirmed usable supplier credit are both 1,000. Moving 1,000 from the relevant
inventory asset to Supplier Credits leaves total assets unchanged and Cash
unchanged. On a later purchase of 3,000, applying that 1,000 plus paying 2,000
cash should consume 1,000 credit and reduce Cash by only 2,000, not 3,000. Values
are hypothetical; they do not establish the example shipment's amounts.

At review time, the [classifier](../../src/lib/accounting/account-classification.ts)
did not explicitly list Supplier Credits. A custom account label alone was not
proof it would appear as the intended asset throughout reporting.

## 5. Safe Workflow Direction

1. Distinguish expected manifest, supplier-dispatched goods, confirmed KPC receipt,
   warehouse receipt, shortage, and financial posting. One shipment code cannot
   stand in for every event.
2. Before a new build, confirm the actual contents and exclude goods not in that
   shipment. Determine separately how paid goods still with the supplier are
   recognized so excluding them does not hide the original payment/claim.
3. For already posted goods, inspect the exact build/reclass/settlement sources
   in an authorized isolated review before choosing a correction. Do not casually
   delete or repost them, relink around a lock, or create another supplier payment.
4. For delayed goods, preserve the product/payment identity and a shortage claim
   linked to the later receipt; avoid a second asset acquisition or duplicate
   receipt simply because a new shipment is used.
5. For supplier credit, record supplier, currency, approved amount, reference,
   issue/recognition date, source shortage, balance and applications. Do not mark
   credit Applied solely as a free-standing status update.
6. Allocate actual logistics only to goods actually transported/received, using
   the approved actual-cost process, without charging the absent fourth product
   for transport it did not receive or duplicating charges on later arrival.
7. Handle affected reseller orders/refunds independently: a supplier credit is
   not a customer cash refund and does not provide cash for that refund.

## 6. Review Validation And Remaining Decisions

Executed focused validation: **8 test files, 96 tests passed** using Vitest with
mocked database delegates:

- `src/modules/products/api/__tests__/service.transit-build.test.ts`
- `src/modules/products/api/__tests__/service.accounting.test.ts`
- `tests/unit/api/transit-reclass.business-logic.test.ts`
- `tests/unit/api/transit-build.business-logic.test.ts`
- `src/app/api/shipments/[id]/transit-build/__tests__/transit-build.route.test.ts`
- `src/app/api/shipments/[id]/transit-reclass/__tests__/transit-reclass.route.test.ts`
- `src/app/api/inventory/movements/__tests__/route.test.ts`
- `tests/unit/api/accounting-balance-sheet.api.test.ts`

The passing tests exercise existing build accounts/keys, source protections,
reclass rules, shortage-field validation, and balance-sheet behavior. They do
not establish the actual contents or posting history of `KPC 23930A-239`, nor do
they prove the then-unimplemented supplier-credit/receipt cases below. This
review phase changed only documentation. No integration database, browser,
production build, or deployment was used during it. Earlier gate evidence is
recorded in section 8 of the parent accounting review; later implementation
evidence is recorded in its section 12.

Additional acceptance scenarios identified at review time:

- Four expected products versus three confirmed received, before and after build.
- Reclass only received products; reject unreceived quantities; exercise defaults.
- Missing item received on the next shipment with no duplicated payment, asset,
  receipt movement, reservation allocation, or supplier settlement.
- Partial quantity of one product, not just an entirely missing product row.
- Paid/unpaid shortage converted to credit; pending versus confirmed credit.
- Partial credit applications, exhausted credit, multiple invoices, retries,
  concurrent applications, reversals, and supplier/currency isolation.
- Reports agree on Cash, transit, stock, supplier claims/credits, payables, and
  product valuation; no forced balancing entry conceals an absent asset.
- Preview amounts match actual posted components and dates.

Ownership while goods remain at the supplier, recoverable fees, credit expiry/
disputes, and customer reservation/refund decisions still require the accountable
owner outside the approved implementation scope. The actual-content-before-build
instruction alone does not approve a general recognition timing rule or a
historical repair.
