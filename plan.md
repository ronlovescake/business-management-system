# Clothing Owner Requirements And Implementation Record

Updated reading order, 2026-10-28: this is the owner-designated requirements and
approval/evidence record, not another employee manual or active implementation
queue. Employee procedures live only in the [Master SOP Manual](docs/business-logic/clothing/operations-workflow.md).
The [current reconciliation report](docs/reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)
records 26/26 mandatory scenarios, all nine final gates and implementation commit
`ce3f8f5d`. That later authorized completion supersedes earlier pauses and the
SUMMARIZE guardrail blocker below; the old test counts retain their original scope.
Expense-history findings, unsupported corrections and authentic migration/external
funds/stock evidence remain separate. No new commit, push or release is authorized.

## Original Owner Requirements (Historical Planning Context)

The recovered owner request was:

> “refunds should also appear on the balance sheet, accounting dashboard and the business intelligence dashboard.”

The original plan recorded **15 traceable requirements**, including **both**
refund reminders. The planned wording below is retained for requirement provenance,
not as an alternative to the implemented manual and owning contracts.

**Refund Visibility**
| Surface | Planned Behavior |
|---|---|
| Transactions | Refund Pending card showing outstanding amount and affected-transaction count; opens a filtered list. |
| Top navigation | Icon and badge opening the same list, using the same totals. |
| Customers | Keep refund execution here; support partial payouts and payment history. |
| Accounting dashboard | Show outstanding refund obligations separately from actual refunds paid and Cash. |
| Business Intelligence | Show pending amounts/counts/age, paid-refund trends, and forfeitures separately. |
| Balance sheet | Show approved unpaid obligations without duplicating Customer Deposots; actual payouts reduce Cash. |
| Journal, ledger, P&L and exports | Consistent event treatment and traceable amounts across reports. |

**Other Recovered Requirements**

- Remove **Forfeited** from new order-status choices; preserve historical forfeitures.
- Use **Cancelled**, with a money-decision popup whenever any payment was collected. No money collected means no financial popup.
- Preserve the initial **10% or 20% deposit** separately from additional installments.
- Support retaining the initial deposit while approving an installment refund, or an approved emergency full refund.
- Fully paid orders awaiting checkout/pickup are **not payment-overdue**.
- Keep supplier-failure **Voided** distinct from normal cancellation.
- Standardize Reservation Deposit terminology; no separate Reservation Fee.

**Execution status:** the later requirement/evidence register and current
reconciliation report replace the original proposed implementation sequence.

One correction matters: **recorded refunds already affect balance-sheet Cash**. The plan must preserve that behavior while adding pending obligations and clearer visibility.

Approval must never reduce Cash. Partial payouts must reduce pending amounts only once. Each requirement now needs implementation, applicable UI, tests and recorded results before being marked complete.

Planning was updated only; no code or business data changed.

## Implementation Tracking (2026-10-26)

The original reference above is preserved. Its planning-only statement describes
the earlier planning step, not the implementation batches below. The original
mentions 15 requirements without assigning IDs; R01-R15 below are working IDs
for those requirements, not recovered historical numbering.

Evidence reviewed:

- [Accounting integrity review](docs/reports/ACCOUNTING_INTEGRITY_REVIEW_2026-10-26.md)
- [Development migration recovery](docs/reports/DEVELOPMENT_MIGRATION_RECOVERY_2026-10-26.md)
- [Business-rule change standard](docs/BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md)
- [Approved workflow clarifications](docs/business-logic/clothing/operations-workflow.md)

Scope: development checkout only. Preserve all preexisting uncommitted changes,
including the accounting/supplier work and recovered SQL. No production access,
commit, push, deployment, production build, historical repair, or unresolved
accounting-policy change is authorized by this tracking record.

### Requirement Register

The register reflects the current development implementation, not deployment.
Focused, disposable-database, isolated browser and final-gate evidence is recorded
below. The earlier guardrail block is superseded by the later completed run.
Preexisting dirty work
and historical batch-01 results alone are not completion evidence.

| ID  | Requirement                                                                                  | Acceptance evidence required                                                                            | Status                                     |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| R01 | Remove Forfeited from new order-status choices; preserve historical forfeitures.             | UI choices, server/import guards and legacy dated-report tests.                                         | Implemented and focused-verified           |
| R02 | Collected money requires a cancellation decision; unpaid closure has no financial popup.     | Actual UI hook in desktop/mobile browser plus protected single/bulk/server paths.                       | Implemented and browser/server-verified    |
| R03 | Preserve agreed original 10%/20% deposit separately from installments.                       | Actual direct/bulk DB writes preserve basis, actor and date; unknown legacy agreement review.           | Implemented and DB-verified                |
| R04 | Retain the whole original deposit and approve installment refunds, or emergency full refund. | Approval snapshot/authorization; legacy 20% browser scenario; actual cash/debt split.                   | Implemented and DB/browser-verified        |
| R05 | Paid awaiting fulfillment is not payment-overdue.                                            | 44 service tests in UTC/Manila, strict dates and invoice-boundary regression; manual cancellation only. | Implemented and focused-verified           |
| R06 | Supplier-failure Voided stays distinct.                                                      | Zero retention, explicit decision/reason, preserved receipts/stock and browser scenario.                | Implemented and focused/browser-verified   |
| R07 | Reservation Deposit, not a separate fee.                                                     | New collection/invoice/default-message/output labels; old API aliases/IDs/saved custom copy preserved.  | Implemented and invoice/message-verified   |
| R08 | Transactions Refund Pending card.                                                            | Shared amount/count/list, view states and desktop/mobile browser flow.                                  | Implemented and component/browser-verified |
| R09 | Header icon/badge as well as R08.                                                            | Same cache, scope and list; refresh/permission/loading/empty/error regressions.                         | Implemented and component/browser-verified |
| R10 | Customers executes actual refunds.                                                           | Partial history and browser flow; real concurrent payout, replay/conflict and rollback tests.           | Implemented and DB/browser-verified        |
| R11 | Accounting dashboard separates pending, actual refunds and Cash.                             | Shared dated summary plus real before/after five-report scenario.                                       | Implemented and dated-report-verified      |
| R12 | BI shows pending/count/age, actual paid trend and forfeitures separately.                    | Dated approval/payout summary; P&L legacy/new forfeiture total; Manila YTD/full-year tests.             | Implemented and focused-verified           |
| R13 | BS liabilities do not duplicate deposits; approval is noncash.                               | Real DB historical as-of equation, clearing, noncash approval and actual partial payout.                | Implemented and DB-verified                |
| R14 | Journal/ledger/P&L/BS/export agreement.                                                      | Actual five-report event sequence; prior-only/search-stable ledger browser CSV; dated costing return.   | Implemented and DB/browser-verified        |
| R15 | Receipts, obligations, payouts and stock events survive exactly once.                        | At least two simultaneous live transactions, UUID replay/conflict, injected rollback and DB checks/FKs. | Implemented and DB-verified                |

The seven surfaces are R08 Transactions, R09 top navigation, R10 Customers,
R11 accounting dashboard, R12 Business Intelligence, R13 balance sheet and
R14 journal/ledger/P&L/exports. Both reminders remain required independently.
Build the shared obligation/event summary before integrating these surfaces.
No pending-refund totals should be inferred from status alone or presented as
real approved obligations before the approval model exists.

### Integrity And Recovery Workstreams

| Review ID                    | Current execution status                                                                                                                 | Remaining decision or proof                                                                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Payment validation       | Implemented: shared finite-positive normalized input; Clothing exact-balance/A/R/original-deposit rules in keyed direct/bulk operations. | DB/direct/bulk proof complete. Preserve historical overpayments; review ambiguous legacy-paid balances. GM retains its separate lifecycle.                    |
| A02 Concurrency and retries  | Implemented and proven with real overlapping collections, payouts and cost corrections.                                                  | Same-key replay, changed-payload conflict, conservation, rollback and database checks passed.                                                                 |
| A03 Refund deletion          | Completed Clothing payouts immutable; delete UI removed and server guard tested.                                                         | Returned-refund recovery is explicitly excluded; ordinary goods refunds keep their separate policy.                                                           |
| A04 Canceled receipts        | Snapshots/protected receipt and closed-order edit guards implemented.                                                                    | Actual historical five-report scenario and alternate-path tests passed; no rewrite of legacy data.                                                            |
| A05 Refund classification    | Approval, unpaid debt credit, retained deposit and actual payout separated and dated.                                                    | Real lifecycle/report proof and goods-vs-approval browser tests passed.                                                                                       |
| A06 Historical costing       | Admin dated sold/unsold corrections, signed capitalization budget, future cost and immutable original bases implemented.                 | Real correction race/sale/return passed. Ambiguous multi-lot/transformed/later histories require review; no guessed backfill.                                 |
| A07 Ledger balances          | Opening/closing, prior-only accounts, distinct movement and search-stable CSV implemented.                                               | Actual table/hook/export desktop/mobile browser proof passed.                                                                                                 |
| A08 Incoming CARD            | Clearing asset, Cash separation and real settlement/fee journal treatment implemented.                                                   | Focused settlement tests and dated real-report clearing/Cash/equation checks passed. Outgoing liability unchanged.                                            |
| A09 Physical inventory       | Physical/transit reserved/unreserved quantities and stable table implemented, without accounting postings from labels.                   | Real transform/table browser proof passed. Model remains shipment-wide; legacy location and partial-receipt counts require operational evidence.              |
| A10 Dates/YTD                | Manila YTD/same-span comparison, separate full-year, future cutoff and BI grouping implemented.                                          | Focused two-timezone/date-only/leap-year/invoice tests passed; canonical contracts updated.                                                                   |
| A11 External reconciliation  | Externally blocked: owner/operator statements and counts required.                                                                       | No bank/e-wallet/physical-cash or stock reconciliation claimed from synthetic tests.                                                                          |
| A12 Missing valuation        | Profit Incomplete lists/quantities and immutable admin genuine-zero confirmation implemented in P&L/dashboard/BI.                        | Real historical confirmation cutoff and browser correction/confirmation passed. No unconfirmed zero is certified.                                             |
| F01-F03 Earlier report fixes | Preexisting working-tree changes preserved and their reporting suites included in fresh full unit/integration/coverage checks.           | Passing synthetic checks are not historical balance certification or external reconciliation.                                                                 |
| M01 Historical recovery      | New additive lifecycle migration, fresh test bootstrap and complete dump/recovery proven only in task DBs.                               | Still blocked: 43 authentic historical originals unavailable and two blank checksums unproven. No fabricated SQL/checksums or historical-chain certification. |

### Batch 01: Positive Payment Amounts

Invariant: a newly recorded customer collection must have a finite, positive
amount and remain positive after the existing two-decimal sanitizer. The
requesting business/project owner is accountable for policy decisions; this
batch follows the existing bulk positive-amount safeguard and the requested
payment-safeguard work, not a new overpayment/refund accounting policy.

Owning boundary: the shared transaction-payment schemas and each direct route's
pre-write sanitization. Both bulk routes consume the same create schema and
already reject amounts that round to zero. Clothing and general merchandise
retain their separate records, status rules, success responses and transaction
behavior. Trucking and household payment paths do not use this schema and are
unaffected. No new payment-import/job path is introduced; future consumers must
still validate normalized amounts at their own write boundary.

Changed code:

- [Shared schemas](src/lib/validations/transaction-payment.validation.ts)
- [Clothing direct payments](src/app/api/customers/[id]/payments/route.ts)
- [GM direct payments](src/app/api/general-merchandise/customers/[id]/payments/route.ts)

Regression evidence:

- [Clothing direct and shared-schema tests](src/app/api/customers/[id]/payments/__tests__/route.test.ts)
- [GM direct tests](src/app/api/general-merchandise/customers/[id]/payments/__tests__/route.test.ts)
- [Clothing bulk tests](src/app/api/transactions/payments/bulk/__tests__/bulk-payments.route.test.ts)
- [GM bulk tests](src/app/api/general-merchandise/transactions/payments/bulk/__tests__/bulk-payments.route.test.ts)

| Check                                     | Actual result                                                                                                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial regression run                    | Eight failures reproduced zero/sub-cent direct-write access and positive-infinity schema acceptance; existing bulk rounding guards passed.                                                                              |
| Focused payment rerun                     | Four files / 37 tests passed, including one-cent and half-cent rounding, both-domain invalid batches and existing valid collection scenarios. Prisma is mocked; no DB connection or business write occurred.            |
| `npm run lint`                            | Passed; existing warnings in unrelated files remain.                                                                                                                                                                    |
| `npm run typecheck`                       | Passed; editor diagnostics for the seven changed TypeScript files were clear.                                                                                                                                           |
| `npm run test:unit`                       | 352 files / 4,160 tests passed, including the preexisting accounting/supplier regression suites.                                                                                                                        |
| `npm run test:integration`                | 11 files / 70 tests passed on the task-created disposable PostgreSQL 16 database only. Existing negative-path/conflict tests logged their expected injected failures. These are not new payment-concurrency scenarios.  |
| `npm run test:hardening`                  | Four files / 12 tests passed.                                                                                                                                                                                           |
| `npm run test:coverage:enforce`           | 4,160 tests passed with unchanged enforced floors; 30.66% lines/statements, 64.88% branches, 47.76% functions.                                                                                                          |
| `npm run guardrails:check`                | Blocked by the unchanged 20,716-line SUMMARIZE hard stop. No override, decomposition or bypass was made. PR metadata validation skipped outside a PR event; later chained stages are not claimed passed.                |
| `node scripts/check-doc-command-drift.js` | Passed after the requirement/contract update.                                                                                                                                                                           |
| Validation-side worktree preservation     | All 89 dirty/new files snapshotted immediately before the gates retained identical SHA-256 hashes afterward. The guardrail-generated unrelated LIV-1 date line was restored exactly; that report has no remaining diff. |

Integration used task container `bms-payment-validation-5097e6204a41`, a unique
`_test` database, localhost-only port 32768, in-memory PostgreSQL data and a
private explicit environment file. Existing development/test databases and
production were not accessed. The existing guarded reset helper bootstrapped
only this disposable database from the current schema and existing identity
rules; this is not a migration-history replay or proof that missing migrations
are recovered. The container and temporary credentials were removed after the
tests. Non-secret logs remain outside the repo at
`/tmp/bms-payment-validation-wpFfUS` for this session.

No accounting/inventory data-control command, external reconciliation,
Playwright/E2E, production build or migration deployment was run for this
input-validation batch. No posting/valuation/stock rule or browser layout was
changed. Existing suites passing does not close A02-A12, certify balances, or
complete any refund surface.

Contracts updated in [Clothing Customers](docs/business-logic/clothing/operations-customers.md#payment-amount-validation)
and [GM Customers](docs/business-logic/general-merchandise/operations-customers.md#payment-amount-validation).
No intentional divergence is introduced in amount validity. Existing differences
in collection/status/atomicity behavior remain; A01-A02 are not closed by this
batch. No refund reminder, obligation, payout lifecycle or reporting-surface row
is marked complete by payment validation alone.

Historical next-batch note (superseded by the owner decisions and evidence below): confirm overpayment and legacy-paid rules before consolidating
collection balance enforcement; specify approved obligation, refund-execution
and historical-compatibility semantics before schema/lifecycle implementation.
Deadline cutoff/automation, approval authority, CARD, ledger/date windows and
valuation decisions remain with the accountable owner.

### Batch 01 Business-Rule Record

PR-ready evidence only; no PR, commit or push was created. The record describes
the narrow new-payment validity safeguard, not approval of the unresolved
collection/refund/accounting policies above.

<!-- business-rule-change -->

```json
{
  "businessRuleChange": true,
  "owner": "Requesting business/project owner; enforced by the shared payment schemas and domain payment-route sanitizers",
  "invariant": "A new customer payment is finite and positive, remains positive after existing two-decimal normalization, and invalid direct/bulk input creates no payment or balance mutation.",
  "domains": ["clothing", "general-merchandise", "shared"],
  "policyPaths": [
    "plan.md",
    "docs/business-logic/clothing/operations-customers.md",
    "docs/business-logic/general-merchandise/operations-customers.md"
  ],
  "affectedPaths": [
    "src/lib/validations/transaction-payment.validation.ts",
    "src/app/api/customers/[id]/payments/route.ts",
    "src/app/api/transactions/payments/bulk/route.ts",
    "src/app/api/general-merchandise/customers/[id]/payments/route.ts",
    "src/app/api/general-merchandise/transactions/payments/bulk/route.ts"
  ],
  "tests": {
    "paths": [
      "src/app/api/customers/[id]/payments/__tests__/route.test.ts",
      "src/app/api/transactions/payments/bulk/__tests__/bulk-payments.route.test.ts",
      "src/app/api/general-merchandise/customers/[id]/payments/__tests__/route.test.ts",
      "src/app/api/general-merchandise/transactions/payments/bulk/__tests__/bulk-payments.route.test.ts"
    ],
    "results": "Focused: 37 passed after eight initial failures. Unit: 4160 passed. Disposable-DB integration: 70 passed. Hardening: 12 passed. Enforced coverage passed. Lint/typecheck and doc-command drift passed. Aggregate guardrails remains blocked by preexisting SUMMARIZE size; no new payment-race or historical reconciliation claim."
  },
  "docs": {
    "paths": [
      "plan.md",
      "docs/business-logic/clothing/operations-customers.md",
      "docs/business-logic/general-merchandise/operations-customers.md"
    ]
  },
  "divergence": {
    "status": "none",
    "reason": "No new amount-validity divergence: Clothing and GM use the same schema and reject rounded zero before writing. Their existing separate records, status, balance and atomicity behavior are preserved; trucking and household paths do not consume this schema."
  }
}
```

<!-- /business-rule-change -->

## Owner Decisions For Remaining Implementation (2026-10-26)

The requesting business/project owner explicitly approved these examples and
controls during the follow-up implementation conversation. They replace the
corresponding unresolved questions above for new workflows only; they do not
authorize historical repair, production access or deployment.

1. Reject new payments above the remaining balance. Preserve existing recorded
   overpayments. Block further collection on ambiguous legacy-paid orders until
   reviewed rather than guessing or erasing historical receipts.
2. On cancellation of a PHP 1,000 order with PHP 400 collected, remove the PHP 600
   the customer has not paid. At most the PHP 400 collected is available for a
   cash refund, less prior repayments. This is not future-purchase customer credit.
3. The admin may keep the agreed PHP 100 initial deposit and approve PHP 300 to
   return, or approve all PHP 400 for an emergency. Approval creates Refund Pending,
   not money out; actual payouts alone reduce Cash and the pending amount.
4. Only administrators decide what money to keep or return. Completed payouts
   stay in history rather than being deleted. If a customer actually returns
   PHP 50 of a paid refund, record that PHP 50 receipt separately; never invent
   a receipt merely because a refund is being corrected.
5. For old orders whose initial deposit agreement is unknown, an administrator
   must confirm the original agreement. Do not infer it from total collections.
6. An invoice dated October 26 is due October 29 at 11:59 PM Asia/Manila.
   Fully paid orders are excluded. Cancellation remains manual. Late-sent or
   revised invoices require admin review before cancellation; there is no
   automatic cancellation, deposit retention or refund creation.

Initial R05 evidence: the existing Transactions due-date list and shared
DueDateService already exclude zero outstanding balances. Two added service
regressions cover paid orders awaiting pickup/checkout and a customer with both
paid and unpaid orders. The shared service now uses the approved end-of-third-day
Manila cutoff and detects overdue status immediately after it passes. Its
44-test focused suite passed under both UTC and Asia/Manila, including leap days,
year ends and legacy invoice dates. Later invoice and browser evidence is recorded
below; no automatic cancellation was added. Review of actual late-sent/revised
invoices remains an administrator's operational responsibility; a generated PDF
does not prove the customer's original delivery date or authorize retention.

The owner additionally approved:

- Actual ledger balances including money brought forward, separate period
  movement, and searches that do not recalculate account balances.
- Incoming unsettled card collections as a separate asset, not Cash or supplier
  Credit Card Payable. Settlement and actual fees remain separately traceable.
- Dashboard Year to Date from January 1 through today, compared to the same
  date last year, with future records excluded and a separate full-year option.
- Separate physically received and in-transit stock, including reservations,
  without automatically posting accounting entries from availability labels.
- Dated corrections when confirmed costs change after a sale, preserving the
  original sale cost/history and checking existing logistics capitalization to
  avoid double counting. No guessed historical cost backfill is authorized.
- Explicit incomplete-profit warnings for unknown costs and administrator
  confirmation for genuinely free/zero-cost goods, listing affected quantities.

### Subsequent Owner Clarification: No Returned-Refund Workflow

The owner clarified that customers do not return part of a refund in this
workflow. Damaged-item refunds and refunds of deposits on voided orders are
normal payouts, not receipts from customers. The hypothetical PHP 50 example
in decision 4 above is superseded: do not implement a customer-returned-refund
or recovery feature. Completed payouts still remain in history. Ordinary
goods refunds remain separate from approved cancellation payouts and do not
inherit the cancellation-only collected-cash cap.

### Current Lifecycle And Reporting Implementation Evidence

This is development evidence, not deployment or historical reconciliation. The
additive lifecycle migration was applied only in task-created disposable
databases. Existing business databases and production were not accessed.

Owning boundaries are the shared collection calculations, keyed Serializable
financial requests, customer-money approval/payout service, dated transaction
recognition and ledger-period aggregation. Paid decisions require an administrator;
staff may record an already-approved actual payout. Generic single/bulk edits
cannot create cancellation decisions, reopen closed orders or rewrite their
financial snapshots. Real receipts protected by a closed order, original-deposit
agreement or financial request cannot be deleted. Legacy open-order corrections
remain separate and do not erase protected histories. New Forfeited outcomes
are blocked, while historical outcomes remain readable.

Both reminders, Customers, accounting dashboard and BI use the shared dated
obligation summary. Customers retains partial-payout execution and history.
The ordinary goods-refund selector excludes approvals including completed ones;
GM does not query Clothing approvals and keeps its own existing refund controls.
The balance sheet, journal, ledger and P&L use dated A/R/deposit recognition;
incoming CARD remains in clearing until actual settlement. Ledger search/CSV
preserve authoritative balances including earlier activity.

| Focused check                                                              | Actual result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original deposit calculations, direct/bulk collection and payment UI       | 116 tests passed before the column-name correction; corrected direct/bulk and UI rerun: 37 passed.                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Corrected deposit columns and balance-sheet regressions                    | 47 passed; whole strict typecheck passed afterward.                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Closed-order edits, inventory-history/deletion and A/R service             | 53 passed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Receipt-deletion guard, direct collection and cancellation/payout service  | 44 passed, including six protected-history cases and unchanged legacy open-order correction.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Journal, ledger, P&L, balance sheet and shared recognition                 | Five files / 65 passed initially; later real lifecycle/report proof is recorded below.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Shared reminders, goods/cancellation separation and customer-money service | Two files / 28 passed with zero unhandled errors after repairing ambiguous test selectors.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Isolated Playwright customer-money fixture                                 | All four desktop 1440x1000/mobile 390x844 Clothing/GM scenarios pass: actual cancellation hook (unpaid/no popup, collected, legacy 20%, supplier failure), partial payout/history, reminders, goods-vs-approval selector, correction/genuine-zero, actual ledger search/downloaded CSV/prior-only balance and physical/transit inventory grid. API fixture only, no app server or business DB. Screenshots inspected; mobile ledger overlap fixed and retested.                                                             |
| Date/dashboard and BI filters                                              | Focused 36-test and 71-test groups passed under UTC/Manila; later 53-test BI/P&L group passed with explicit full-year, native-date grouping and separate accounting forfeiture.                                                                                                                                                                                                                                                                                                                                             |
| New invoice/default messaging                                              | 31 tests passed, including legacy aliases and Oct 25 17:30 UTC -> Oct 26 Manila invoice -> Oct 29 end-of-day due. Saved/custom copy is not overwritten.                                                                                                                                                                                                                                                                                                                                                                     |
| Backup filters/restore ordering                                            | 37 focused tests passed; actual Prisma selective queries additionally passed in the task DB. Retired JSON restore remains 410; JSON/CSV/XLSX are inspection, not complete recovery.                                                                                                                                                                                                                                                                                                                                         |
| Real lifecycle, valuation and selective-query integration                  | 14 tests passed in task-only PostgreSQL 16: actual direct/bulk deposit columns; at least two simultaneous live collection transactions; payout/correction races; idempotent replay/conflict; failure rollback; CHECK/FK enforcement; real dated five-report parity; original costing snapshots/later corrected return; genuine-zero as-of cutoff; parent-aware backup queries.                                                                                                                                              |
| Canonical fresh test bootstrap                                             | Separate task DB freshly reset/seeded through the normal guarded helper with all five lifecycle checks. Final full integration passed all 84 tests, including 14 lifecycle tests. No existing DB reset.                                                                                                                                                                                                                                                                                                                     |
| Forward migration                                                          | Initial snapshot SHA-256 f72a9082abfb9e31a1e5f66db75a21380e51fc4d6decb9b18304d66ee16c3b10. Final exact SQL SHA-256 5724b3a67c070cfcfbbf1315a296dafbea4e23fb02e1da25af0b02ad77854f99 was additionally applied in a new committed-pre-lifecycle-schema task DB: all original columns of order/payment/refund 900000001 preserved, before/after snapshot SHA-256 both 8e86c5e5882fc2e473601b0da24f5f8e6aae789b29698fe86f90d27fe5dc0f6c; all five checks present. This is one forward migration, not historical-chain recovery. |
| Full dump/recovery                                                         | Custom pg_dump -> new task DB pg_restore: exact canonical rows across 11 relevant models, all five operation types and all five checks. Snapshot SHA-256 f4af6da730282d97dc97a9ff38d71de9cd19286721f9ca6985e4e5840e40f16c; dump SHA-256 6a6893fde1c3080a0bb30107aa7683ba729f4853f2460a35d321f26b4f97543c.                                                                                                                                                                                                                   |
| Aggregate-test fixture repair                                              | Six old unit-fixture failures repaired; 20-test focused rerun and fresh full 4,369-unit rerun passed. Three old integration refund-delete expectations updated to the approved immutable-history rule, fully-paid fixtures corrected and owned-record cleanup added; eight focused and all 84 fresh integration tests passed. No production guard was weakened.                                                                                                                                                             |

Nonsecret lifecycle/migration/recovery and final-gate logs are under
`/tmp/bms-customer-money-1XxdRj`; screenshots are under
`/tmp/bms-customer-money-browser`. These are local session evidence, not checked-in
artifacts or production certification. All database work is confined to the
manifest/label-verified tmpfs PostgreSQL 16 task container on port 32769; no
application instance was started against unapplied existing schemas.

### Earlier Lifecycle Handoff Gates (Superseded Checkpoint)

At this earlier checkpoint, implementable R01-R15 and A01-A10/A12 development
work was complete within that scope, but SUMMARIZE blocked aggregate guardrails.
The table preserves that actual outcome, not a current failure. The later
reconciliation report records 4,514 unit, 90 integration and 12 hardening tests
with all nine final gates passing and the separately approved implementation
commit. Neither checkpoint certifies historical business books or deployment.

| Final check                                                     | Actual result                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                                                  | Passed after the final integration-fixture change; warnings remain.                                                                                                                                                                                                                    |
| `npm run typecheck`                                             | Passed after the final integration-fixture change; editor diagnostics clear.                                                                                                                                                                                                           |
| `npm run test:unit`                                             | 357 files / 4,369 tests passed.                                                                                                                                                                                                                                                        |
| `npm run test:integration`                                      | 12 files / 84 tests passed after a fresh task-only reset/seed, including real lifecycle races/report/cost/backup-query tests.                                                                                                                                                          |
| `npm run test:hardening`                                        | Four files / 12 tests passed.                                                                                                                                                                                                                                                          |
| `npm run test:coverage:enforce`                                 | 357 files / 4,369 tests passed; unchanged enforced thresholds. Lines/statements 31.71%, branches 65.8%, functions 48.51%.                                                                                                                                                              |
| `npm run accounting:transactions:sanitycheck -- --failOnIssues` | Passed: one remaining synthetic baseline transaction, zero issues. Initial inconsistent manually created fixtures were corrected and scoped cleanup verified. Not a business-ledger audit.                                                                                             |
| `npm run inventory:ledger:controls`                             | Both read-only controls passed on the cleaned synthetic baseline; separate actual transform/grid and dated-cost tests supply behavioral proof. Not a physical count/reconciliation.                                                                                                    |
| Isolated Playwright fixture                                     | All four desktop/mobile Clothing/GM scenarios passed with screenshots inspected; no existing app/DB connection.                                                                                                                                                                        |
| Current forward SQL / full dump recovery                        | Passed in new task-only databases as detailed above; original rows/snapshots and database checks preserved.                                                                                                                                                                            |
| `npm run guardrails:check`                                      | BLOCKED: unchanged 20,716-line [SUMMARIZE](SUMMARIZE) exceeds hard-stop size. No bypass or unrelated decomposition. PR metadata stage skips non-PR events; both marked records pass the real declaration validator independently.                                                      |
| Downstream guardrails run independently                         | Doc-command drift, permission codegen `--check`, module ACL, scripts manifest and backup audit all passed; backup audit covers 132 Prisma models. These do not turn the failed aggregate gate green.                                                                                   |
| Worktree preservation                                           | All 207 pre-gate dirty/new files retained their exact snapshot hashes through the gates/cleanup; only the subsequently repaired integration fixture became newly dirty. Generated unrelated LIV-1 date restored exactly. This final plan-only evidence update follows that comparison. |
| Task cleanup                                                    | Label/tmpfs verified before removal; only task container bms-customer-money-fde22770-5c7 and its four task DBs removed. Both private env files removed; retained text evidence verified free of task credentials. Other containers/data untouched.                                     |

External blockers are A11's actual bank/e-wallet/cash/stock evidence and M01's
authentic migration SQL/checksum provenance. Conservative costing/location
review blocks are deliberate documented limits, not silent historical repairs.
External evidence and target migration review remain explicit release
conditions; the old SUMMARIZE gate failure is not a current blocker. Unavailable
external evidence cannot be replaced with fabricated
SQL, inferred original agreements or a synthetic test pass.

### Current Batch Business-Rule Record

This supersedes the narrow batch-01 policy/evidence record for the current
development changes; no PR or git write is authorized. Owner approvals refer to
the explicit conversation decisions recorded above, not approval inferred from
conflicting existing implementations.

<!-- business-rule-change -->

```json
{
  "businessRuleChange": true,
  "owner": "Requesting business/project owner; explicit collection, cancellation, deadline, CARD, ledger, date, physical/transit and valuation decisions recorded above",
  "invariant": "New Clothing collections cannot exceed an exact unambiguous remaining balance; original deposit agreements and actual receipts survive; admin approval separates cancelled unpaid debt, retained original deposit and refunds payable without Cash; only actual immutable payouts reduce Cash/pending exactly once; dated reports retain historical balances/costs, unknown valuation stays incomplete, and confirmed cost deltas cannot double-capitalize logistics.",
  "domains": ["clothing", "general-merchandise", "platform", "shared"],
  "policyPaths": [
    "plan.md",
    "docs/business-logic/clothing/operations-workflow.md",
    "docs/business-logic/clothing/accounting-overview.md",
    "docs/DATE_TIME_TIMEZONE_RULES.md"
  ],
  "affectedPaths": [
    "prisma/schema.prisma",
    "prisma/migrations/20261026153000_clothing_customer_money_lifecycle/migration.sql",
    "scripts/reset-test-db.js",
    "src/lib/accounting/customer-money.ts",
    "src/lib/accounting/financial-transactions.ts",
    "src/lib/accounting/refund-obligations.ts",
    "src/lib/accounting/transaction-recognition.ts",
    "src/lib/accounting/inventory-valuation.ts",
    "src/lib/accounting/profit-loss-journal.ts",
    "src/app/api/accounting/inventory-valuation/route.ts",
    "src/modules/transactions/api/service-calculations.ts",
    "src/modules/transactions/api/transactionInventorySync.ts",
    "src/app/api/customers/[id]/payments/route.ts",
    "src/app/api/transactions/payments/bulk/route.ts",
    "src/components/refunds/RefundPending.tsx",
    "src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts",
    "src/app/clothing/operations/business-intelligence/hooks/useBusinessIntelligence.ts",
    "src/modules/clothing/operations/message-templates/templates.data.ts",
    "src/app/api/generate-invoice/route.ts",
    "src/app/api/accounting",
    "src/app/api/customers",
    "src/app/api/transactions",
    "src/app/accounting",
    "src/app/clothing/accounting",
    "src/app/clothing/operations/business-intelligence",
    "src/modules/clothing/operations/transactions",
    "src/modules/clothing/operations/due-dates",
    "src/modules/clothing/operations/dashboard",
    "src/modules/products/api",
    "src/lib/accounting",
    "src/lib/auth",
    "src/components",
    "templates",
    "src/app/api/general-merchandise/customers/[id]/payments/route.ts",
    "src/lib/backup/backupModelRegistry.ts",
    "src/app/api/restore/restoreModelMap.ts",
    "src/app/api/restore/restore-order.ts"
  ],
  "tests": {
    "paths": [
      "tests/integration/clothing-customer-money.integration.test.ts",
      "tests/integration/clothing-persistence.integration.test.ts",
      "tests/unit/accounting/customer-money.service.test.ts",
      "tests/unit/transactions/refundPending.test.tsx",
      "tests/unit/transactions/transactionCancellationModal.test.tsx",
      "tests/unit/scripts/reset-test-db.test.ts",
      "tests/unit/backup/backupRouteUtils.test.ts",
      "tests/unit/api/accounting-profit-loss.api.test.ts",
      "src/app/api/accounting/inventory-valuation/__tests__/route.test.ts",
      "src/app/api/generate-invoice/__tests__/route.test.ts",
      "tests/unit/api/message-templates.business-logic.test.ts"
    ],
    "results": "Final lint/typecheck passed; unit 4369/357 files, fresh task-only integration 84/12 files (including 14 lifecycle tests), hardening 12/4 files, enforced coverage 4369 with unchanged floors (31.71% lines/statements, 65.8% branches, 48.51% functions) passed. Read-only accounting/inventory controls passed on the cleaned synthetic baseline. All four desktop/mobile Clothing/GM browser scenarios passed. Exact final forward SQL preserved original order/receipt/refund columns; full-dump recovery preserved lifecycle/valuation/journal evidence and checks. Stale unit/integration expectations were repaired without weakening production guards. Aggregate guardrails remains blocked only by preexisting SUMMARIZE size; downstream docs/codegen/ACL/manifest/132-model backup audit and both declarations passed independently. Task container/databases and private env credentials removed. No historical/external reconciliation or deployment certification."
  },
  "docs": {
    "paths": [
      "plan.md",
      "docs/BUSINESS_LOGIC_DOCUMENTATION_STANDARD.md",
      "docs/DATE_TIME_TIMEZONE_RULES.md",
      "docs/business-logic/clothing/accounting-overview.md",
      "docs/business-logic/clothing/accounting-journal.md",
      "docs/business-logic/clothing/accounting-ledger.md",
      "docs/business-logic/clothing/accounting-profit-loss.md",
      "docs/business-logic/clothing/accounting-balance-sheet.md",
      "docs/business-logic/clothing/operations-transactions.md",
      "docs/business-logic/clothing/operations-customers.md",
      "docs/business-logic/clothing/operations-inventory.md",
      "docs/business-logic/clothing/operations-business-intelligence.md",
      "docs/business-logic/clothing/operations-message-templates.md",
      "docs/business-logic/general-merchandise/operations-message-templates.md",
      "docs/business-logic/platform/admin-backup-restore.md"
    ]
  },
  "divergence": {
    "status": "intentional",
    "reason": "Owner-scoped Clothing lifecycle/valuation remediation, not GM certification: GM retains separate tables, cancellation/refund and outgoing-card behavior. Shared positive amount validation, Manila periods, ledger infrastructure, message-default wording and invoice PDF aliases have regression coverage; saved custom templates are not rewritten. Trucking/household are not consumers of the new Clothing lifecycle or valuation APIs. No returned-refund recovery feature is added.",
    "approvedBy": "Requesting business/project owner; explicit Clothing workflow decisions and exclusion of returned-refund recovery recorded above"
  }
}
```

<!-- /business-rule-change -->
