# Clothing Accounts Receivable Implementation Plan

> **Status:** Implemented in the development checkout. Database migrations have not been applied to production.

## Confirmed Operating Policy

- In the clothing Transactions workflow, `Accounts Receivable` means the goods have already shipped and payment remains outstanding.
- Operators may select this status without a customer credit-approval flag, tag, or approval step. Ordinary transaction access and reference validation still apply.
- Customers may pay early or in partial payments. The maximum payment term is two calendar months from shipment; full payment before then closes the receivable.
- Preserve the existing `Shipped` status as the operator's paid-in-full status, even though physical shipment occurs earlier.
- No interest, late fees, credit limit, or automated collections are part of this change.

## Target Transaction Flow

1. The goods are dispatched. The operator sets the order to `Accounts Receivable`; the server checks the outstanding balance and records the shipment date and due date without requiring customer credit approval.
2. Inventory moves to sold once at shipment. The sale and COGS are recognized once at this point.
3. Each payment is recorded as a collection against Accounts Receivable. Partial payment leaves the order in `Accounts Receivable`; full payment allows the operator to mark it `Shipped`. A calculated line total of zero automatically resolves A/R to `Shipped`.
4. The customer balance, due date, and overdue state remain separate from the existing three-day invoice due-date workflow for `Prepared` orders. Do not add an A/R Due Date column to the main Transactions grid.

## Implementation Phases

### 1. Status Contract and Compatibility

- Add `Accounts Receivable` to the clothing order-status options and preserve `Pending Payment` as a legacy value during transition.
- Continue accepting historical `Pending Payment` records; display them as `Accounts Receivable` in the clothing workflow where they represent shipped credit sales.
- Keep General Merchandise's existing `Pending Payment` reservation meaning unchanged.
- Use one consistent fulfilled/sold classification so the new status moves inventory to sold and does not reserve it.

### 2. Operator Selection and Dates

- Do not require customer credit approval when an operator selects `Accounts Receivable`, including imports and bulk updates.
- Do not expose an approval tag or switch in customer details or accept an approval field through the customer API.
- Record the actual shipment timestamp and a due date two calendar months later. Due date is a maximum term, not a payment delay.
- Keep shipment and due dates stable through partial payments and the later paid status.
- Keep the nullable shipment and due-date fields and existing additive migration. The retired customer approval column may remain unused for compatibility; removing the approval workflow requires no migration or customer data changes.

### 3. Payments and Inventory

- Validate payment amounts server-side against the current outstanding balance; reject overpayment and duplicate submissions.
- Update payment totals and remaining balance atomically. Keep reservation/deposit payments distinct from post-shipment collections.
- Keep `Accounts Receivable` after partial payment. Allow the paid status `Shipped` only when the balance is zero within the established rounding tolerance.
- Ensure moving from `Accounts Receivable` to `Shipped` does not create a second stock sale or COGS posting.

### 4. Accounting and Receivables Visibility

- At shipment, debit Accounts Receivable and credit Sales Revenue once; recognize COGS and reduce inventory once.
- On collection, debit the actual cash/bank/card account and credit Accounts Receivable. Do not recognize revenue a second time.
- Reconcile transaction balances to the customer subledger, balance sheet, journal, ledger, and P&L. Preserve customer-deposit liabilities until applied to a sale.
- Show outstanding balances, due dates, partial payments, and overdue amounts in a receivables view. Do not repurpose the existing `Prepared` invoice Due Dates tab.

### 5. Documentation and Validation

- Keep this plan in the business-logic index. Update transaction, customer, inventory, and accounting docs when behavior is implemented.
- Add focused tests for unrestricted A/R selection, confirmed save feedback, rejection rollback, canonical zero-balance `Shipped` responses, shipment sync, legacy status handling, shipment dates, calendar-month due dates, partial/full/early/overdue payments, overpayment rejection, one-time inventory/COGS recognition, and A/R report reconciliation.
- Run targeted unit tests and standard development checks. Use DB-backed tests only with a confirmed disposable development test database. Never apply this migration to production as part of local implementation.

## Current Implementation Notes

- In the clothing Transactions workflow, operators set `Accounts Receivable` after dispatch. The status is domain-specific; General Merchandise retains its existing `Pending Payment` behavior.
- The `Prepared` Transactions Due Dates tab remains a separate 72-hour workflow. A/R due dates are persisted as two calendar months from shipment, but are not shown as an added column in the main Transactions grid.
- Clothing A/R does not require customer credit approval. Customer approval UI and application fields have been removed. Server-side transaction and payment paths retain outstanding-balance, overpayment, and reservation-deposit rules, along with ordinary access checks.
- Status changes report success and log the change only after a confirmed save. Errors display the server message and restore the failed optimistic edit. Successful single saves use the canonical returned row; successful paste batches refresh the affected transaction query before reporting success. Shipment synchronization preserves manually selected A/R.
- Partial or early collections remain in `Accounts Receivable`. If an A/R transaction's calculated line total reaches zero, its status automatically transitions to `Shipped`; the sale, inventory movement, revenue, and COGS are recognized only once at shipment.
- A/R revenue and receivables are included in P&L, journal, ledger, and balance-sheet reporting. Collection journal/ledger entries debit the recorded payment account; the balance sheet continues to aggregate Bank and GCash under Cash equivalents.
- Nullable `unitCost` snapshots are recorded on new clothing and GM sale movements and preferred by COGS and inventory seed/shrinkage reporting. Historical movements without snapshots retain the current-product-cost fallback until separately backfilled, if desired.
- Clothing and GM refund endpoints enforce cumulative refund amount and returned-quantity limits in serializable transactions. Refund writes and related inventory movements are atomic, and return movements inherit the original sale cost where available.
- Opening-balance paired create, update, and delete operations use one transaction through a batch API. Legacy single-line API calls remain supported.
- Additive Prisma migrations and code changes exist in the development checkout only. No production database was queried or changed, and no migration was applied.

## Remaining Follow-Up

- Confirm and document the rollout procedure for the outstanding Prisma migrations before any production update.
- Integration tests were attempted against the verified disposable tmpfs-backed test database on port 5433. Setup remains blocked by Prisma P1014: the `public.ClothingInvestorCodeSequence` table is missing. Do not treat this as successful integration validation or change production schema to work around it.

## Source Areas

- `src/modules/clothing/operations/transactions/`
- `src/modules/clothing/operations/customers/`
- `src/modules/transactions/api/`
- `src/lib/transactions/order-status.ts`
- `src/lib/inventory/statuses.ts`
- `src/lib/accounting/`
- `src/app/api/accounting/`
- `prisma/schema.prisma` and `prisma/migrations/`
