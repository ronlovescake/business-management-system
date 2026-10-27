# Clothing — Transactions Business Logic

## Product Identity And Historical Prices

Transactions linked to a standard product use its stable `Product.id` to show
the current product and shipment codes. Rows without a reliable product link
(including composite SKUs) retain their stored codes. Existing `unitPrice`,
discount, line total, refunds, and payments are never repriced by product edits;
new rows use the current saved tier for their quantity. Product-code changes
also update linked inventory movement codes so inventory and transaction
rollups continue to refer to the same product.

### Inline Product Corrections (2026-10-27)

An editable clothing transaction may temporarily have a blank Product Code.
Clearing it detaches its nullable `productId`; entering a unique active standard
product code resolves the new link. Customer clearing and re-entry retain their
existing identity rules. Single PATCH and bulk PUT use the same database rule,
so a retained full-row draft can also save its cleared product code.

The original product-identity trigger rejected a clear on an already linked row
with SQLSTATE `23514` ("Product code is missing or ambiguous; choose a unique
product"), surfaced as HTTP 500. The forward migration
`prisma/migrations/20261027160000_clothing_transaction_product_clear/migration.sql`
allows blank codes only for updates to clothing transactions. Other tables,
nonblank missing/ambiguous replacement checks, and explicit product-ID/code
consistency on insertion retain their existing protections. No existing records,
quantities, prices, balances or payments are rewritten by the migration.

The clothing transaction service still enforces closed-order financial guards,
revision checks and atomic row/status/inventory writes. A successful clear
deactivates owned automatic inventory movements while retaining their product,
quantity and financial history. Create/import validation and background product
renames are unchanged; general merchandise uses a separate identity function and
is outside this requested correction.

Apply the forward migration using the reviewed environment-specific database
release procedure. The application code does not need rebuilding for this
trigger-only repair. Development verification applied it only to the isolated
localhost:5433 test database, not the development business database or production.
If the grid already retains a failed edit, use its existing refresh-and-retry
flow after the migration; do not assume the previous failed request saved.

#### Correction Change Record

```json
{
  "businessRuleChange": true,
  "rationale": "Restore the requested clothing transaction clear-and-reenter workflow without weakening product identity checks outside blank transaction updates.",
  "owner": "Ron, requesting clothing operations owner; the clothing product-identity trigger owns linkage and the clothing transaction service owns financial/status enforcement.",
  "invariant": "An editable clothing transaction can clear its product link and resolve a unique standard product again; row and owned inventory changes remain atomic, with financial history and revision guards preserved.",
  "domains": ["clothing"],
  "policyPaths": ["docs/business-logic/clothing/operations-transactions.md"],
  "affectedPaths": [
    "prisma/migrations/20261027160000_clothing_transaction_product_clear/migration.sql",
    "src/modules/transactions/api/service.ts",
    "src/modules/transactions/api/transactionInventorySync.ts",
    "src/modules/clothing/operations/transactions/hooks/useTransactionGridSaveQueue.ts",
    "scripts/reset-test-db.js"
  ],
  "tests": {
    "paths": [
      "tests/integration/transaction-save-concurrency.integration.test.ts",
      "tests/unit/scripts/reset-test-db.test.ts"
    ],
    "results": "The new linked-row clear/reenter regression reproduced the original SQLSTATE 23514 before the repair. All 10 transaction save-boundary integration tests passed after the repair and after a fresh isolated database reset/seed, covering single/bulk corrections, customer identity, canonical revisions, inventory history, unchanged invalid/ambiguous and price-table guards, explicit-ID insert validation, rollback, concurrent writers and creation replay. Bootstrap unit tests verify installation before optional seed and retain unsafe-target/failure protections. Guardrails, lint (existing warnings), typecheck, full unit (4377), integration (88), hardening (12) and coverage (4377; repository line coverage 32.17%) passed. Isolated-test inventory ledger controls passed; accounting sanitycheck scanned one remaining baseline transaction and found zero issues. Browser E2E was not run for this SQL-only correction. No development business database or production migration, build, commit, push or deployment was performed."
  },
  "docs": {
    "paths": ["docs/business-logic/clothing/operations-transactions.md"]
  },
  "divergence": {
    "status": "intentional",
    "reason": "Ron limited the fix to clothing transactions. General merchandise has a separate product-identity function; its existing behavior and all other clothing trigger consumers remain unchanged.",
    "approvedBy": "Ron, requesting owner, limited the requested fix to /clothing/operations/transactions."
  }
}
```

## Net Prices And Draft Deletion

Discount is per item and is already included in Unit Price. When a stored line
total is absent, remaining balance is `quantity * net unitPrice - adjustment`.
Do not subtract Discount again. An explicit finite zero line total is retained;
null, undefined, empty, and non-finite totals use the fallback. Refund caps use
the same net-price contract.

Mass deletion is draft cleanup, not a reversal workflow. Paid, fulfilled,
historically paid/fulfilled, invoiced, packed, shipped, refunded, or financially
posted transactions block the entire operation with HTTP 409. Permitted draft
cleanup deactivates only owned automatic movements and soft-deletes the selected
transactions in one serializable transaction. Existing audit history is retained.

> **Source files:**
>
> - `src/modules/transactions/api/service.ts`
> - `src/modules/transactions/api/referenceValidation.ts`
> - `src/modules/transactions/api/transactionInventorySync.ts`
> - `src/modules/transactions/api/service-calculations.ts`
> - `src/modules/clothing/operations/transactions/hooks/useTransactionsData.ts`

---

## A — Validation & Lookup Rules

| #   | Logic                                                                                            | Explanation                                                                                          |
| --- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 1   | Customer name, product code, and positive quantity are still required for valid transaction rows | Import and create validation still reject missing essentials.                                        |
| 2   | Product code validation now accepts split-child SKUs even if no child product row exists         | `referenceValidation` treats `SplitBatchComponent.componentSku` as a valid transaction product code. |
| 3   | Bundle and mix-and-match composite SKUs remain valid transaction targets                         | Composite SKU validation still happens before persistence.                                           |
| 4   | Split-child shipment code and shipment status inherit from the parent split SKU                  | Transaction lookup data maps parent shipment metadata onto split-child codes.                        |

---

## B — Pricing & Payment Rules

| #   | Logic                                                                            | Explanation                                                                                      |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 5   | Unit price can still auto-fill from pricing data when the imported value is zero | Transaction creation still resolves pricing through the existing tier flow.                      |
| 6   | Prepared + fully paid transactions are treated as fulfilled for movement sync    | This affects both standard SKUs and split-child movement behavior.                               |
| 7   | Missing remaining balance uses quantity times net unit price less adjustment     | Discount is already in Unit Price; an explicit finite stored total, including zero, is retained. |

---

### Record Payments Customer Filter

The customer dropdown lists each customer once when they have at least one
saved order whose status is not `Shipped`, `Cancelled`, `Voided`, or
`Forfeited`. Customers with no orders or only closed orders are excluded.
The customer list is independent of the selected status pills and product
filter; those filters still control the payment table. A default customer
must meet the same open-order rule, and a selected customer is cleared when
their last open order closes.

The implementation lives in
`src/modules/clothing/operations/transactions/components/useTransactionPaymentsState.ts`.

---

## C — Order Status Rules

New Forfeited selections are removed and rejected server-side; existing
historical values remain readable. Cancelled and supplier-failure Voided use
the dedicated cancellation endpoint, not generic single/bulk/import status
updates. The actual UI hook closes an unpaid order without a financial popup;
collected money opens the explicit administrator decision. Fully paid orders
awaiting fulfillment are not payment-overdue. Closed orders cannot be reopened
or have money/fulfillment identity rewritten through generic edits; harmless
notes preserve the snapshot without recalculating stock or financial history.

Reservation invoices now request Reservation Deposit (10% or 20%), show the
three-Manila-calendar-day end-of-day deadline, and do not promise automatic
cancellation. The shared invoice API accepts legacy `Reservation Fee` request
aliases for compatibility; new UI requests and visible output use Deposit.
Template filenames/placeholders and persisted template IDs are compatibility
identifiers, not separate fees or newly collected money. The shared GM PDF route
inherits this copy/alias change, not the Clothing cancellation lifecycle.

| #   | Logic                                                                                                          | Explanation                                                             |
| --- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 8   | Status cannot regress back to `In Transit` once linked shipment state has advanced to warehouse-stage statuses | `For Pickup`, `Sorting`, and `Delivered` still block backward movement. |
| 9   | Paid-status guards still run before persistence                                                                | Invalid paid transitions are rejected before DB writes occur.           |

---

## D — Inventory Movement Sync

| #   | Logic                                                                                                                    | Explanation                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10  | Every transaction save still re-syncs its auto-created inventory movements                                               | The sync remains the post-save source of inventory movement updates.                                                                                                            |
| 11  | Blank product codes, zero quantity rows, and inactive scenarios deactivate both standard and mix-prefixed auto movements | Cleanup happens before early return.                                                                                                                                            |
| 12  | Standard SKUs use a simple reserve/sale movement pattern                                                                 | Reserve = `sellable → reserved`; sale = `reserved → sold` or `sellable → sold` depending on existing reserve state.                                                             |
| 13  | Mix-and-match SKUs deactivate standard auto movements and create per-component auto movements instead                    | Allocation is derived from current component availability via `allocateByAvailability`.                                                                                         |
| 14  | Mix-and-match movement notes use component-specific note variants                                                        | Notes are `auto-reserve txn {id} mix {component}` and `auto-sale txn {id} mix {component}`.                                                                                     |
| 15  | Split-child SKUs keep the standard reserve/sale note pattern but target the parent split SKU                             | The child code is resolved to the parent before standard movement sync runs.                                                                                                    |
| 16  | Split-child movement quantity currently matches the transaction quantity, not a separate loose-piece bucket adjustment   | Loose-piece reuse is modeled in read-time allocation, not as a dedicated inventory movement type.                                                                               |
| 17  | Auto-created reserve and sale movements store explicit transaction source metadata                                       | New movement writes populate `sourceTransactionId`, `movementSource = transaction`, and `movementType = reserve/sale`; notes remain human-readable and support legacy fallback. |

---

## E — Bulk Update & Soft Delete

| #   | Logic                                                              | Explanation                                                                                      |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| 17  | Bulk update validates and syncs rows inside a database transaction | Observed implementation rolls back the request on a row failure; see the discrepancy note below. |
| 18  | Transactions remain soft-deleted rather than hard-deleted          | Live queries still filter `deletedAt: null`.                                                     |

---

## F — UI Stock Check Behavior

| #   | Logic                                                                     | Explanation                                                                                         |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 19  | Stock check still runs when product code changes or quantity increases    | The UI continues to POST `{ productCode, requestedQuantity }` to the clothing stock-check endpoint. |
| 20  | `SOLD_OUT` blocks save with a red SweetAlert2 error                       | The operator cannot proceed.                                                                        |
| 21  | `INSUFFICIENT_STOCK` with some stock available offers to cap the quantity | Confirming uses the maximum available quantity; cancelling blocks the save.                         |
| 22  | `LOW_STOCK` warns but does not block save                                 | The operator can continue after acknowledging the warning.                                          |
| 23  | Stock-check request failures still fail open                              | Errors are logged but do not block transaction entry.                                               |

---

## G — Stock Check Semantics by SKU Type

| #   | Logic                                                                                      | Explanation                                                                     |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 24  | Standard product stock check uses direct on-hand minus active demand                       | This remains the default fallback path.                                         |
| 25  | Bundle stock check reports `assembled bundle stock + component-constrained build capacity` | The limiting component is surfaced in the message when relevant.                |
| 26  | Mix-and-match stock check reports pooled component availability                            | Availability is based on component pool capacity, not virtual mix SKU quantity. |
| 27  | Split parent stock check returns remaining complete sets                                   | The message explicitly references remaining sets after split-child demand.      |
| 28  | Split-child stock check returns loose-piece-aware availability                             | The message reports loose pieces plus remaining complete parent sets.           |
| 29  | Split sibling demand reuses loose pieces before opening another set                        | Break-pack logic is now encoded in stock-check reads, not left as a TBD.        |

---

## H — Operational Note

The transaction workflow now supports split-child selling without requiring child
product rows or child price rows to exist first. The authoritative split
definition is the split batch, while inventory movement sync and stock checks
translate that definition into transaction-time behavior.

## I - Inline Autosave And Recovery

### Current Hardening Contract (2026-10-25)

Ron approved the reliability hardening and separately approved nullable unique
creation keys in both transaction tables. Existing financial formulas, stock
decisions, paid-status guards, permissions and domain differences remain policy.

- GET/PATCH and bulk acknowledgements expose an opaque revision fingerprint of
  persisted transaction fields. Queued writes send the acknowledged revision,
  not a later draft revision. Clothing PATCH and bulk updates validate it inside
  serializable Prisma transactions; stale writes and serialization conflicts
  return HTTP 409. Row, status-history and inventory writes commit together.
- Bulk acknowledgements include canonical saved rows. The queue checks their
  identities and advances its canonical baseline before sending later edits.
  Explicit retry still refreshes first; the operator must review other clients'
  changes before choosing to reapply local intentions. There is no row lock or
  live collaborative editing. Legacy requests without a revision remain
  compatible, so stale full-row legacy callers are not universally protected.
- Shipment synchronization uses status-only intents in the same queue. Work
  skipped while busy is reconsidered when it drains. Search does not duplicate
  saved blank-customer/product rows already included by another field.
- Grid creation sends a single-row POST with a UUID `creationKey`. The unique
  key and row/movement transaction provide a real saved ID and safe same-key
  replay after an uncertain response. The first submitted payload stays frozen
  after uncertain failures. A definite validation rejection before any uncertain
  attempt permits a corrected request with a new key. Normal multi-row imports
  keep their existing path and are not claimed to be idempotent or newly atomic.
- Drafts are keyed by placeholder object, not visual row index. Creation is
  awaited by ordered edit processing. The old placeholder retains the saved ID
  for edits already captured against it; a new blank placeholder replaces it.
  Later fields following an uncertain create are queued after ID reconciliation.
  Incomplete/failed drafts retain pending-action and unload guards until saved
  or explicitly discarded. Discard does not undo a committed creation.
- Obsolete customer-warning responses/callbacks are ignored. Async rejection
  rolls back only the same row, column, edit generation and current cell value.
  Ctrl/Cmd+Shift+Arrow extends from the selection endpoint while preserving its
  anchor on Transactions and Products; open editors retain native behavior.
- Existing per-edit/paste audit boundaries remain; edit notifications alone do
  not prove persistence. Server change logs remain authoritative. Local drafts
  and creation keys are memory-only; reload/crash recovery is still deferred.

The owning boundaries are `src/modules/transactions/api/service.ts`, the separate
GM transaction service, the shared route factory, transaction data/operations
hooks, and the grid controller. GM preserves its own formulas and per-row bulk
success boundary; only an individual GM row and its movements become atomic.
Its flat-field validation, omitted-customer preservation and Adjustment storage
are corrected, not replaced with clothing financial rules.

The additive migration is
`prisma/migrations/20261025150000_transaction_creation_keys/migration.sql`.
Apply it through the reviewed environment-specific release procedure before
running the new app code. Only the isolated localhost test database received
the SQL during development; its missing migration history prevented normal
`migrate deploy`. No migration baseline, app database, production checkout,
build or deployment was changed.

### Original Queue Checkpoint (Historical)

The table and change record below describe the earlier client-only checkpoint
`0ec2bffc`, not the additional server/schema hardening above.

| #   | Logic                                                           | Explanation                                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 30  | Accepted edits merge by permanent transaction ID                | A local draft overlays server rows while a serial queue saves. Async cell validation is ordered; calculations consult the latest draft and pending paste fields. Status-only renders do not replace grid data. Placeholder creation retains its existing path.                                                                                                           |
| 31  | Individual and pasted edits retain their existing transports    | Individual edits use partial PATCH requests; paste batches use complete row DTOs via PUT, bounded by the existing request limit. Rows are reconstructed from acknowledged state at send time. Overlapping batches accumulate, and newer individual fields supersede older pending paste fields.                                                                          |
| 32  | Acknowledgements do not erase newer edits                       | Only one inline write request runs at a time. Drafts remain visible until the queue drains and a fresh canonical read succeeds. Edits during that read trigger another save/read cycle. PATCH IDs and bulk counts must match.                                                                                                                                            |
| 33  | Errors retain drafts and pause automatic saving                 | HTTP errors, timeouts, invalid acknowledgements and failed reconciliation show a retained-draft alert. Confirmed Refresh and Retry reads server state first; Discard Drafts reloads server values without undoing committed writes. Missing rows cannot be recreated through retry. Queue writes disable automatic transport retries.                                    |
| 34  | Dependent actions wait for saved data                           | Invoice, packing/distribution generation, payment entry, customer details and tab switches are blocked while validation/saves/drafts remain unresolved. Generation and transaction-editing modals block inline edits while active. Browser unload/link navigation warns; other users/tabs and programmatic navigation are not coordinated.                               |
| 35  | Audit and domain enforcement remain authoritative on the server | Existing per-edit notifications/logging and paste-batch notifications/logging are retained. Batch success waits for acknowledgement; ordinary edit notices are not proof of persistence. Server change logs remain the authoritative persisted-change record. Stock validation, financial formulas, payment/status guards and inventory movement services are unchanged. |

### Change Record

Ron, the requesting clothing operations owner, approved retained drafts with
explicit Retry/Discard, blocking conflicting actions, and preserving existing
per-edit/paste-batch audit behavior. No job/import, schema, accounting, permission,
deployment or cross-domain policy change is authorized by this work.

The shared page/route, `useTransactionsData`, `useTransactionOperations`,
`useTransactionBatchMode` and `useTransactionGridSaveQueue` own client coordination.
`src/modules/transactions/api/service.ts` and
`src/modules/general-merchandise/transactions/api/service.ts` remain the separate
enforcement boundaries. Both UI API scopes use this queue; direct API clients,
imports, background jobs, placeholder creation and non-grid modal writes retain
their existing paths. Existing clothing/GM financial differences are not
homogenized. Shared grid navigation uses the same nonempty-boundary helper as
Products, without intercepting arrows inside an open editor.

**Documentation discrepancy:** the previous bulk-update explanation claimed
independent row success. Source inspection shows clothing bulk writes inside a
Prisma transaction. Rule 17 now records that observed implementation, not a new
owner-approved atomicity policy. No server behavior is changed; deciding whether
partial success should instead be supported remains a separate policy decision.

Drafts do not survive reload or a confirmed departure. A network/5xx failure may
already have committed; review saved values before retrying. Explicit retry is
not an exactly-once guarantee. Discard does not reverse inventory/accounting
effects of an already committed request. There is no cross-user locking.

The following declaration records the historical client-only change. The current
hardening record follows it; no new commit, push or deployment is authorized.

```json
{
  "businessRuleChange": true,
  "rationale": "Coordinate rapid inline saves and explicit recovery without changing server business rules; align Products keyboard navigation with Transactions.",
  "owner": "Ron, requesting clothing operations owner; client coordination in useTransactionGridSaveQueue, domain enforcement in the existing separate transaction services.",
  "invariant": "Later accepted edits must not be erased by older saves or refreshes; unresolved drafts remain visible and block dependent local actions until explicit recovery or reconciliation.",
  "domains": ["clothing", "general-merchandise", "shared"],
  "policyPaths": [
    "docs/business-logic/clothing/operations-transactions.md",
    "docs/business-logic/general-merchandise/operations-transactions.md"
  ],
  "affectedPaths": [
    "src/app/operations/transactions/_shared/TransactionsRoutePage.tsx",
    "src/modules/clothing/operations/transactions",
    "src/services/TransactionService.ts",
    "src/services/GeneralMerchandiseTransactionService.ts",
    "src/components/ui/handsontable-grid",
    "src/modules/clothing/operations/products/components/ProductsGrid.tsx"
  ],
  "tests": {
    "paths": [
      "tests/unit/transactions/useTransactionGridSaveQueue.test.tsx",
      "tests/unit/transactions/useTransactionOperations.test.tsx",
      "tests/unit/transactions/transactionService.test.ts",
      "src/components/ui/handsontable-grid/__tests__/dataBoundaryNavigation.test.ts",
      "tests/e2e/handsontable-grid.interactions.spec.ts"
    ],
    "results": "Focused queue, operations, service and navigation tests passed. All seven Chromium grid cases passed, including ten delayed individual pastes, explicit retry/discard and Products navigation. Lint, typecheck, full unit, integration (59 tests) and hardening (12 tests) passed. guardrails:check failed on the preceding committed Products checkpoint: useProductsGrid.test.tsx contains a blocked as unknown as cast. That file is unchanged in this implementation; the guard scans HEAD~1...HEAD, not the uncommitted worktree. No guard was disabled. Authenticated manual testing, Docker rebuild and deployment were not performed."
  },
  "docs": {
    "paths": [
      "docs/business-logic/clothing/operations-transactions.md",
      "docs/business-logic/general-merchandise/operations-transactions.md",
      "docs/business-logic/clothing/operations-products.md",
      "docs/business-logic/general-merchandise/operations-products.md"
    ]
  },
  "divergence": {
    "status": "none",
    "reason": "Both domains share the same isolated client queue/navigation behavior. Existing distinct server policies and financial rules remain unchanged; Ron approved preserving them, not unifying them."
  }
}
```

### Hardening Change Record

```json
{
  "businessRuleChange": true,
  "rationale": "Prevent stale writes, partial row/movement persistence, lost new-row edits and unsafe create replay without changing approved financial rules.",
  "owner": "Ron; separate clothing and general-merchandise transaction services own domain enforcement.",
  "invariant": "Accepted edits survive older acknowledgements; stale revision-bearing writes are rejected; each row and dependent movement writes commit together; a grid creation key identifies one saved row.",
  "domains": ["clothing", "general-merchandise", "shared"],
  "policyPaths": [
    "docs/business-logic/clothing/operations-transactions.md",
    "docs/business-logic/general-merchandise/operations-transactions.md"
  ],
  "affectedPaths": [
    "src/modules/transactions/api",
    "src/modules/general-merchandise/transactions/api",
    "src/modules/clothing/operations/transactions",
    "src/components/ui/handsontable-grid",
    "src/modules/clothing/operations/products/components/ProductsGrid.tsx",
    "src/services/TransactionService.ts",
    "src/services/GeneralMerchandiseTransactionService.ts",
    "prisma/schema.prisma",
    "prisma/migrations/20261025150000_transaction_creation_keys/migration.sql"
  ],
  "tests": {
    "paths": [
      "tests/unit/api/transaction-accounts-receivable.service.test.ts",
      "tests/unit/api/transactions.api.test.ts",
      "tests/unit/transactions/generalMerchandiseTransactionPersistence.test.ts",
      "tests/unit/transactions/useTransactionGridSaveQueue.test.tsx",
      "tests/unit/transactions/useTransactionOperations.test.tsx",
      "tests/integration/transaction-save-concurrency.integration.test.ts",
      "tests/e2e/handsontable-grid.interactions.spec.ts"
    ],
    "results": "Guardrails, lint, typecheck, full unit (4032 tests), coverage (4032 tests), integration and hardening (12 tests) passed. PostgreSQL regressions verify rollback, stale bulk rejection, simultaneous writers, canonical revision progression and same-key creation in both domains. Ten Chromium cases passed across full and focused runs, including twenty-row Product Code paste and delayed creation. Isolated-test inventory ledger controls and accounting sanitycheck passed with zero accounting issues. Existing unrelated lint warnings remain; coverage passing is not a claim of exhaustive coverage or error-free behavior."
  },
  "docs": {
    "paths": [
      "docs/business-logic/clothing/operations-transactions.md",
      "docs/business-logic/general-merchandise/operations-transactions.md"
    ]
  },
  "divergence": {
    "status": "intentional",
    "reason": "Clothing bulk is one transaction; GM bulk retains per-row success. Domain formulas/status rules and normal multi-row imports remain separate and unchanged."
  }
}
```

The Product Code handler and customer-tab selectors were mechanically extracted
to keep the touched coordinator files within existing size guardrails. Their
business computations and stock/confirmation decisions were copied unchanged.

### Validation And Release Limits

- Required gates: guardrails, lint, typecheck, unit (4,032), integration (65),
  hardening (12), and coverage passed. Repository-wide line coverage is 30.04%;
  the targeted concurrency/lifecycle regressions do not certify every workflow.
- Chromium: ten scenarios passed across full and focused runs. This includes
  ten rapid individual pastes, retained retry/discard, twenty-row Product Code
  creation paste, later edits during delayed creation, and both grids' range
  navigation. Firefox/WebKit and authenticated manual testing were not run.
- Test-database inventory ledger controls and accounting sanitycheck passed;
  accounting reported zero issues. No production-data certification is implied.
- Checkpoint `0ec2bffc` is local and was not pushed. This hardening remains
  uncommitted. No production build, Docker rebuild, app migration or deployment
  was performed. The new nullable unique columns must be migrated before release.
