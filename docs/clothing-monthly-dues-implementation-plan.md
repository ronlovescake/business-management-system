# Clothing Monthly Dues, Funding and Opening Reconciliation — Implementation Plan

Status: Implementation specification only; no application changes or financial entries have been made by this plan.

Prepared: October 28, 2026

Updated scope: pooled investor funds, customer reservation deposits, inventory purchases and loan payments. Section 14 adds required implementation work to the original dues plan and extends its acceptance criteria. No CSV import is required.

## 1. Objective

Add a practical **Monthly Dues** workspace within Clothing → Accounting → Ledger. The owner should be able to enter a loan, see upcoming installments, record payments, and see how much remains scheduled to be paid—even when the principal/interest breakdown is not yet available.

Connect verified loan balances and classified payments to the existing accounting ledger so liabilities appear on the balance sheet without counting future interest as principal or deducting cash twice.

**No CSV import is required.** Use manual forms. The existing loan CSV is reference material only; do not build a parser, upload workflow, automatic seed, or bulk posting script for it.

## 2. Agreed scope and starting position

- Module: Clothing accounting, not Household or General Merchandise.
- Cutover: October 28, 2026.
- Intended Cash opening: ₱95,945.14, representing the end of October 28 after that day's payments.
- Check existing saved openings before creating anything; this plan does not establish whether an opening is already recorded.
- October installments through October 28 were reported paid. Capture these as historical tracking records only; do not create new cash deductions for them.
- October 29 and 30 payments remain unpaid until payment is recorded.
- Exclude Unionbank Credit Card and Maya Credit from initial setup.
- Keep one facility per actual loan, even when it has multiple installment dates.
- Do not require an opening principal balance to create a facility, its schedule, or a tracking-only payment.
- Do not infer a principal/interest split from the installment amount, remaining months, or expected end date.
- Implementation and test work must not automatically populate or modify live financial records.

## 3. Product distinction: scheduled payments versus recorded liabilities

The interface must show two separate concepts with plain labels:

| Label                        | Meaning                                                                     | Source                                   |
| ---------------------------- | --------------------------------------------------------------------------- | ---------------------------------------- |
| Remaining scheduled payments | Unpaid scheduled installments, including interest embedded in those amounts | Dues schedule and payment allocations    |
| Recorded loan balance        | Liability currently recorded in the accounting ledger                       | Tagged liability journal/opening entries |
| Accounting setup             | Whether the opening and payment classification are complete                 | Reconciliation state                     |

Never combine the first two amounts into a total. Never present missing opening principal as a confirmed zero liability.

Example: Grab Loan 1 can show one remaining installment of **₱3,965.66 due November 5, 2026**, even if its recorded principal balance is not yet established. Paying that installment can complete the payment schedule. Accounting reconciliation remains separate until the necessary breakdown and opening balance are entered.

The balance sheet continues to use posted accounting entries. Add a nearby notice and link when tracked facilities or payments are not fully reflected in accounting: “Some loans or payments are awaiting accounting details.” Do not silently add schedule totals to formal liability totals.

## 4. Existing implementation inspected

Repository-relative paths below are navigation references for the implementing developer.

| Existing file or area                                                        | Relevant behavior                                                                                                    |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/app/clothing/accounting/ledger/page.tsx`                                | Entry point for integrating the Monthly Dues workspace                                                               |
| `src/app/clothing/accounting/ledger/components/RecurringPaymentsPanel.tsx`   | Existing monthly templates and drafts; Loan is labeled principal only; Approve posts to the ledger                   |
| `src/modules/clothing/ledger/recurringPayments/api/service.ts`               | Approval creates a debit and credit for the full draft amount, dated using its due date                              |
| `src/modules/clothing/ledger/recurringPayments/api/schemas.ts`               | Frequency supports MONTHLY only; draft states are DRAFT, APPROVED, SKIPPED                                           |
| `src/modules/shared/ledger/recurring-payments/api/helpers.ts`                | Shared monthly date and account-tag helpers                                                                          |
| `src/services/ClothingRecurringPaymentService.ts`                            | Existing recurring-payment service boundary                                                                          |
| `prisma/schema.prisma`                                                       | Existing recurring templates/drafts use Float amounts and do not model tracking-only payments or payment allocations |
| `src/app/clothing/accounting/ledger/components/OpeningBalanceEntryModal.tsx` | Existing balanced opening-entry interface                                                                            |
| `src/app/clothing/accounting/ledger/hooks/useLedgerOpeningEntries.ts`        | Existing opening-entry loading/actions                                                                               |
| `src/app/api/accounting/opening-balance/route.ts`                            | Existing opening API                                                                                                 |
| `src/app/api/accounting/balance-sheet/route.ts`                              | Trace underlying reporting implementation before adding reconciliation indicators                                    |
| `src/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet.ts`         | Balance-sheet client integration                                                                                     |
| `src/app/clothing/accounting/ledger/ledgerEntryGuidance.ts`                  | Existing principal/interest guidance                                                                                 |
| `docs/business-logic/clothing/accounting-ledger.md`                          | Existing accounting, opening, authorization, and cutover rules                                                       |

Preserve the existing recurring-payment feature for its current users. Add a dedicated dues domain rather than changing what existing Approve buttons mean. Review shared General Merchandise consumers before modifying any shared component or helper.

## 5. User experience

### 5.1 Monthly Dues tab

Add a tab or equivalent section next to existing ledger surfaces. Follow existing visual patterns and responsive table behavior.

Top-level cards:

- Due this month: scheduled amount for the selected month.
- Paid toward this month's dues: active allocations to those installments.
- Still due this month: outstanding amount for those installments.
- Overdue: unpaid amounts with due dates before today.

Explain that payments toward a month's dues may have been made on another date. Provide a separate payment-history filter by actual payment date; do not confuse cash paid this month with amounts allocated to this month's dues.

Table columns:

- Loan/lender.
- Due date.
- Amount due.
- Amount paid.
- Remaining amount.
- Status: Upcoming, Due today, Overdue, Partially paid, Paid, Cancelled.
- Accounting: Historical, Awaiting details, Ready to post, Posted.
- Actions: Record payment, View details.

Filters: month/date range, facility, payment status, accounting status. Use the application's business date handling and Asia/Manila for user-facing dates.

### 5.2 Add loan or credit-card account

Required fields:

- Display name.
- Type: installment loan or credit card.
- Stable facility identity/reference to distinguish loans with the same lender.

Optional fields:

- Lender name, notes, supporting statement reference.
- Opening principal or confirmed card liability and its as-of date.
- Schedule start/end dates and amount.

Provide “Set up accounting later.” Unknown balances must be stored as unknown, not zero. A facility can exist while its schedule is awaiting confirmation.

### 5.3 Schedule form

Support:

1. Monthly on one day.
2. Twice monthly on two selected days, with each leg having its own end date if necessary.
3. Every N days, including every 14 days, from an explicit confirmed anchor date.
4. One-time installment.
5. Manually added individual due dates for irregular or variable amounts.

For dates such as the 29th–31st, require a visible short-month rule: last day of month or explicit manual dates. Do not silently assume the lender's rule.

Use one facility with multiple schedule rules for Esquire; do not create duplicate liabilities. BanKo requires a confirmed anchor because October 15 and 28 are 13 days apart, despite the stated 14-day cycle. Allow existing dates as historical records while leaving future generation pending.

### 5.4 Record payment

Fields: actual payment date, total amount, payment reference, notes, installment allocation(s).

Offer two clear actions:

- **Save payment:** record paid status; if accounting details are incomplete, show “Saved for tracking; not yet reflected in accounting.”
- **Save and post to accounting:** available only when all required accounting inputs and validations pass.

Optional accounting fields for installment loans: principal, interest, separately identified fees, and approved account mappings. Require component totals to equal the payment amount exactly to currency precision before posting.

Credit-card repayments need a distinct flow: settlement reduces the recorded card payable. Do not force a loan-style interest split on card settlement if charges/interest were already recognized separately. Review existing card accounting to avoid duplicate expense recognition.

Historical setup mode: “Already paid by the opening balance date.” Store the owner's paid-status assertion even if the exact payment date is unknown. Do not substitute the due date as an actual payment date. Historical records must never be posted as new cash movements.

### 5.5 Loan detail

Show schedule, payment history, remaining scheduled payments, recorded ledger liability, accounting gaps, and links to related journal entries.

Use separate completion states:

- Schedule complete: no outstanding scheduled installments.
- Accounting reconciled: relevant openings and payments have been reviewed and posted, with any residual liability explained.

Do not automatically write off a remaining ledger balance when the schedule ends.

## 6. Proposed data model

Add additive Prisma models, following repository naming and module-scoping conventions. Names below are proposed, not existing.

### ClothingDebtFacility

- ID, displayName, lenderName, type, facilityReference, notes.
- Stable liability tag/account mapping, unique within Clothing where appropriate.
- Lifecycle: ACTIVE, AWAITING_CONFIRMATION, SCHEDULE_COMPLETE, ARCHIVED.
- Opening verification state, verified amount (nullable), as-of business date, evidence reference, linked opening source ID.
- Created/updated timestamps, actor IDs, revision/version for concurrent edits.

### ClothingDebtScheduleRule

- Facility ID, frequency, amount, start/end business dates.
- Day-of-month for monthly rules; use two rules for twice-monthly schedules.
- Interval days and anchor for interval schedules.
- Short-month policy, active flag, revision.
- Confirmed versus pending schedule state.

### ClothingDebtInstallment

- Facility ID, schedule rule ID if generated, due business date, amount, notes.
- Stable occurrence key and generation revision.
- Cancelled/superseded metadata; preserve paid and posted history.
- Unique occurrence constraint to make generation retry-safe.

### ClothingDebtPayment

- Facility ID, total amount, actual payment date (nullable only for historical assertions), reference, notes.
- Origin: CURRENT_PAYMENT or HISTORICAL_AT_OPENING.
- Historical as-of date when applicable.
- Accounting state: HISTORICAL_NO_POST, PENDING_DETAILS, READY, POSTED, REVERSED.
- Nullable principal/interest/fee components and statement reference.
- Journal source ID, idempotency key, created/updated actors, reversal linkage.

### ClothingDebtPaymentAllocation

- Payment ID, installment ID, allocated amount.
- Multiple allocations permit one payment to settle several dues; multiple payments permit partial settlement.
- Validate same facility, positive amounts, allocation totals no greater than payment total, and no accidental over-allocation of an installment.
- Represent intentional unallocated advances separately; never discard an excess payment or reduce scheduled balance twice.

Use Decimal money fields such as Decimal(18,2), exact decimal arithmetic, and decimal-string API serialization. Do not introduce new Float financial fields or broadly migrate existing recurring data in this work.

Derive Paid/Partial/Overdue from active allocations, cancellations, and the business date. Keep accounting state separate. Retain audit history for corrections. Financial records with payments or journal links must not cascade-delete.

Register the new models in the project's backup/restore coverage and module cleanup policies as required; inspect the repository's existing coverage audit before finalizing the migration.

## 7. Accounting integration contract

### 7.1 Cash opening

Use the existing opening-entry service and configured cutover. Review all existing Cash opening pairs, including user-created entries with different references.

If the intended opening is absent, a separately initiated setup action may create:

- Debit Cash ₱95,945.14.
- Credit Opening Equity ₱95,945.14.

If a matching opening exists, link/reuse it. If existing openings conflict, show the difference for reconciliation rather than silently adding another entry or replacing records. Protect the setup action with a stable operation key and transaction-level concurrency safeguards.

Store end-of-day cutover semantics explicitly for this setup. Payments dated October 28 included in the opening must remain historical. Do not globally change existing modules' cutover rules merely to support this batch.

### 7.2 Verified debt openings

For each confirmed facility balance at end of October 28, use the existing opening workflow to debit Opening Equity and credit its tagged Loan Payable or Credit Card Payable.

Link the opening source to the facility. Check for existing tagged openings and account movements before posting. Require reconciliation where mappings or existing balances conflict. Never use the sum of future installments as the principal opening.

For a loan disbursed after cutover, use the actual loan-receipt workflow and date rather than inventing an October opening. A future payment start date alone does not establish the disbursement date.

### 7.3 Payments with complete details

For a loan installment, create one atomic posting group with:

- Debit tagged Loan Payable for principal.
- Debit Interest Expense for interest.
- Debit the approved fee account for separately identified fees, if applicable.
- Credit Cash for the total payment.

Use actual payment date, not installment due date. Reuse the existing journal service if it supports grouped multi-line postings; otherwise introduce a narrow domain posting service with the same authorization, validation, and report conventions. Inspect actual schema constraints before choosing source-line keys.

Facility identity, payment identity, and immutable source-line keys must prevent duplicate posting on retry, concurrent requests, or linking a previously entered manual payment.

### 7.4 Payments awaiting details

Save tracking records immediately. Do not post guessed accounting entries. Show a prominent pending amount/count in the dues workspace and affected report context.

Explicit limitation: until a pending payment is posted, the formal ledger's Cash and liability values do not yet include that payment. Saving a payment must tell the owner this clearly; reports must not imply reconciliation is complete.

If immediate Cash posting without a breakdown is desired later, design a separately reviewed clearing-account workflow. It is not part of this version and must not be introduced as an invisible shortcut.

Posting a pending payment later updates its original actual payment period, subject to existing period-lock rules. Respect locked periods; surface a reconciliation action rather than silently backdating or choosing another date.

### 7.5 Corrections and account balances

- Tracking-only payments may be corrected with audit history and allocation recalculation.
- Posted payments require a dated reversal and replacement, following existing accounting rules.
- Historical paid markers cannot become ordinary cash postings through a generic edit.
- Warn or block principal repayments exceeding the reconciled liability until the discrepancy is resolved.
- Changing schedule amount/end date affects future unpaid occurrences only; never rewrite paid history.
- Archive facilities rather than deleting financial history.
- Recorded liability is derived from accounting entries, not a second mutable balance column.

## 8. API and module boundaries

Suggested new domain: `src/modules/clothing/ledger/dues/` with schemas, scheduling, repository, service, accounting adapter, and tests.

Suggested client service: `src/services/ClothingDuesService.ts`.

Suggested API base: `/api/accounting/dues`.

Endpoints should cover:

- List/create/update/archive facilities.
- Create/update/deactivate schedule rules.
- Preview and generate installments through a bounded date.
- List installments and totals by due-date range.
- Record/update tracking-only payments and allocations.
- Record historical paid assertions.
- Preview/post verified openings using existing opening workflows.
- Preview/post classified payments.
- Reverse posted payments through the established reversal convention.
- Fetch reconciliation summary and accounting links.

Use existing route adapters, authentication, ADMIN/SUPER_ADMIN requirements, error response conventions, module ACL registration, and audit logging. Validate on the server; hidden controls are not security.

Generation and posting must be transactional and retry-safe. Preview operations are read-only. Provide stable pagination and consistent aggregate filters. Keep this feature scoped to Clothing and test cross-module isolation.

## 9. Manual setup using the current reference schedule

No automatic import or seeding. Provide forms capable of entering the following after reviewing live records:

| Reference                           | Initial handling                                                                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grab Loan 1                         | One upcoming installment ₱3,965.66 on November 5, 2026; historical October status tracked separately                                                |
| Esquire 1                           | One facility; rules for the 8th and 23rd; last 8th installment April 8, 2027, last 23rd installment March 23, 2027                                  |
| Esquire 2                           | One facility; rules for the 14th and 29th; October 29 unpaid; confirm February treatment and final dates                                            |
| BPI BanKo Negosyo                   | One facility despite capitalization differences and two source rows; confirm next anchor before every-14-days generation                            |
| Eastwest Credit Card                | October 30 ₱6,319.53 remains unpaid; card settlement accounting                                                                                     |
| Eastwest Personal Loan              | October 30 ₱4,596 remains unpaid                                                                                                                    |
| BPI Business Loan                   | Two schedule amounts ₱31,821.70 and ₱38,389.38 starting November; verify whether these are distinct facilities before creating separate liabilities |
| BPI Personal Loan                   | Keep awaiting confirmation; source notes say bank approval is pending, so do not invent a paid October installment or confirmed debt                |
| Unionbank Credit Card / Maya Credit | Excluded from initial setup                                                                                                                         |
| Other included facilities           | Enter confirmed names, dues, dates and historical payment status manually                                                                           |

The source's Months Remaining and Outstanding Total Balance are reference estimates only. Generate remaining dues from confirmed dates and rules, then subtract allocations. Where the schedule is unconfirmed or open-ended, show “Schedule incomplete” or the generated-through date instead of a misleading lifetime total.

## 10. Implementation sequence

### Phase 1 — Trace existing contracts

- Read applicable repository instructions and relevant business-logic documentation.
- Trace actual opening, journal, balance-sheet, cutover, period-lock, account-tagging, audit and backup flows.
- Inspect live configuration only through authorized read paths; do not infer saved state from source code.
- Confirm new components can be Clothing-only without altering shared GM behavior.

Deliverable: concise implementation notes identifying the exact accounting service extension points.

### Phase 2 — Add persistence and schedule engine

- Add additive migration, constraints, indexes, audit fields and backup coverage.
- Implement facility identity, rule validation, decimal amounts and date-only handling.
- Implement deterministic generation and allocation-derived totals.
- Test schedule edge cases before exposing write actions.

Deliverable: validated domain and APIs with no live data initialization.

### Phase 3 — Build tracking UI

- Add Monthly Dues, facility setup/detail, schedule preview, payment recording and historical setup forms.
- Support partial payments, multiple allocations, references and manual irregular dues.
- Make tracking-only accounting status visible in confirmations and lists.

Deliverable: owner can track Grab Loan 1 and mark its final payment without a principal breakdown.

### Phase 4 — Connect accounting

- Add verified opening reconciliation and duplicate detection.
- Implement atomic multi-line payment posting and reversal.
- Add journal links, recorded liability read models, and report completeness notices.
- Support linking an existing matching accounting entry after review instead of reposting it.

Deliverable: verified liabilities flow through existing reports; payments reduce Cash once and classify principal/interest correctly.

### Phase 5 — Verification and release

- Execute focused unit, API/integration and browser tests below.
- Run repository lint/typecheck and required guardrails; document unrelated existing failures separately.
- Update business-logic documentation and user-facing guidance.
- Validate migration and backup/restore on isolated data.
- Release additive functionality without automatically changing recurring templates, openings or financial records.

## 11. Required verification

### Schedule and money tests

- Grab Loan 1 produces one remaining November 5 installment and none after its end date.
- Monthly rules handle year rollover, leap years, short months and inclusive end dates.
- Twice-monthly schedules preserve separate final dates under one facility.
- Every-14-days rules advance by 14 calendar days across months; missing anchor blocks generation only for that rule.
- Duplicate generation and concurrent generation do not create duplicate dues.
- Decimal allocations and component sums remain exact; reject invalid/negative/non-finite amounts.
- Partial payments, multi-installment payments, advances, cancellations and reversals produce correct totals.
- Incomplete schedule totals are labeled as incomplete or bounded by a generation horizon.

### Accounting and API tests

- Existing Cash opening is reused or flagged, never silently duplicated.
- Historical October-through-28 records create zero new cash or liability journal movements.
- October 29/30 remain unpaid without actual payment records.
- A saved pending payment does not post; accounting notices reflect the outstanding work.
- Verified opening appears under its correct tagged liability once.
- Complete loan payment creates balanced principal/interest/fee/Cash lines atomically.
- Failed or concurrent postings leave no half-written journal group or duplicate deductions.
- Actual payment date determines accounting period; due date remains unchanged.
- Locked periods, unauthorized roles, foreign-module IDs and cross-facility allocations are rejected.
- Card settlement does not create a second interest expense for previously recognized charges.
- Linking existing entries prevents reposting; conflicting mappings require reconciliation.
- Reversals preserve historical reports before the reversal date.
- Reports use ledger-derived liabilities and do not add future installment totals.

### Browser acceptance scenarios

1. Manually create Grab Loan 1 without an opening principal.
2. Add November 5 due of ₱3,965.66; see the amount in remaining scheduled payments.
3. Record an October historical paid assertion with unknown exact date; Cash is unchanged.
4. Record the November final payment without a split; schedule becomes complete and accounting remains pending with an explicit notice.
5. Enter verified opening and payment details; preview and post once; recorded liability, Cash and interest reflect the journal.
6. Retry the action and refresh; no duplicates appear.
7. Create one Esquire facility with two monthly rules; no duplicate opening liability.
8. View BanKo pending an anchor; other facilities remain usable.
9. Check mobile layout, keyboard access, validation messages, loading/error states and data refresh after posting.

Use existing Vitest and Playwright configurations with isolated fixtures. Relevant existing commands include `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, and `npm run guardrails:check`. Select focused tests during development and follow repository-required checks before completion. Never run financial fixtures against the owner's live records.

## 12. Definition of done

- Monthly dues can be entered manually with no CSV workflow.
- Missing principal details do not block schedule or payment-status tracking.
- Owner can distinguish remaining scheduled payments from recorded liabilities.
- Historical payments reflected in the cash opening are not deducted again.
- Verified accounting postings update the existing ledger and balance sheet once.
- Pending accounting work is visible wherever report completeness would otherwise be misleading.
- Monthly, twice-monthly, every-N-days and manual schedules work correctly.
- Repeated lender names or schedule legs do not automatically create duplicate debt facilities.
- Existing recurring payments, Household and General Merchandise behavior remain intact.
- Migration, audit history, backup coverage, tests and documentation are complete.
- No live loans or payments are created automatically as part of deployment.

## 13. Handoff instruction for VS Code

Implement this plan, including Section 14, in the existing business-management-system-development repository. Begin by reading repository instructions and tracing the listed accounting services. Build a Clothing-only Monthly Dues feature with manual entry, schedule and payment tracking, and explicit accounting reconciliation. Also build the pooled-cash and opening reconciliation described below, connecting existing investor, customer-payment, product, logistics and loan sources. Do not implement CSV import. Preserve the separation between scheduled installment totals and recorded liabilities. Do not fabricate principal balances, interest splits, historical payment dates, source-of-funds allocations or uncertain facility identities. Use isolated test fixtures and do not populate or post live financial records during implementation. Report the completed behavior, validation results, and any unresolved accounting integration constraints.

## 14. Required extension: pooled funding and October opening reconciliation

### 14.1 Newly confirmed context

- An investor provided ₱500,000 on October 12, 2026.
- Some of that money purchased the listed in-transit goods; some paid loans listed in the reference CSV.
- Customer reservation deposits also helped fund the purchases.
- Money is pooled. There is no confirmed one-to-one allocation of a particular receipt to a particular purchase or loan payment.
- ₱95,945.14 remains the intended end-of-day October 28 Cash opening, subject to verification against physical cash, bank and e-wallet records.
- The investor's repayment/ownership terms, actual purchase/payment amounts, deposit totals and pre-investment cash have not yet been verified.

Do not assume that ₱500,000 minus ₱95,945.14 equals inventory cost. Do not treat all cash as the investor's remaining money. Do not derive opening loan principal from the amount of investor cash used for repayments.

### 14.2 Required user outcome

Provide a **Cash and Opening Reconciliation** workspace within Clothing accounting, linked from Monthly Dues and Opening Balance. It should answer:

1. How much money came into the business, and from which recorded sources?
2. How much actually went out for goods, logistics, loans and other purposes?
3. Does the calculated cash equal the cash actually held on October 28?
4. Which inventory assets and obligations still exist at that date?
5. Which existing entries already represent those balances, and which remain unresolved?

The workspace is a reconciliation view first. Viewing it or matching records must not create journal entries.

### 14.3 Cash bridge

Build a dated reconciliation from the balance immediately before the October 12 receipt through end of October 28:

```text
Verified cash immediately before October 12 investment
+ Investor cash received: 500,000.00
+ Customer reservation deposits actually received
+ Other customer collections (excluding deposits already counted)
+ Other actual cash receipts
- Actual supplier payments for purchases
- Actual logistics payments
- Actual loan/card payments (full cash amounts, including interest)
- Other expenses, refunds, investor payouts and withdrawals paid
= Calculated cash at end of October 28
- Verified physical cash + bank balances + e-wallet balances
= Unexplained difference (target: 0.00)
```

Show missing inputs as unknown and reconciliation as incomplete; never silently use zero. Break actual balances down by cash location for evidence, then aggregate into the application's combined Cash account. Exclude transfers between those locations from consolidated inflows/outflows. Keep transactions outside the date range out of this bridge.

The bridge may use documented actual payments even when their principal/interest classification is pending. This permits cash reconciliation without pretending that accounting is complete. Show separate statuses for **Cash reconciled** and **Accounting reconciled**.

### 14.4 Existing source integration and deduplication

Read existing investor receipts, transaction payment/deposit records, product payments, logistics settlements, dues payments and journal sources. Trace the actual repositories/services before choosing fetchers.

Represent each real cash movement once using stable source type/source ID and linked journal IDs. A source record and its generated debit/credit lines are evidence of one movement, not separate receipts or payments. Matching a statement line to a source must not create an additional transaction.

For documented historical movements missing from the application, allow manual reconciliation-only evidence with amount, date or explicit date uncertainty, counterparty, reference, payment location and supporting note. These are not new journal postings. Later linkage to an operational record must supersede the reconciliation-only representation so the cash bridge still counts it once.

Do not count loan schedule amounts as payments merely because they are due. Historical “paid by October 28” assertions with unknown actual dates may support the snapshot but cannot establish inclusion in the October 12–28 cash bridge until the date window is confirmed. Display them as unresolved timing items.

### 14.5 Customer reservation deposits

Trace `docs/business-logic/clothing/accounting-journal.md` and existing transaction-recognition/payment logic. Preserve existing dated deposit receipt, application, refund and recognition rules.

- A receipt can increase Cash while creating a customer-deposit obligation before recognition.
- Using the cash to buy inventory does not fulfill the customer order and does not release that obligation.
- Only the established order recognition/application/refund workflow changes its accounting treatment.
- At October 28, reconcile outstanding deposits by customer/order from receipts, valid applications and refunds, including applicable pre-period history.
- Exclude deposits already counted when collecting the same order's remaining balance.
- Link to the original customer/order rather than inventing a generic “investor funds” allocation.

If deposit balances are already derived from existing order/payment history in reports, do not add an explicit opening for the same amounts. Trace report inclusion before any opening write. Test deposits received before cutover that are applied or refunded after cutover.

### 14.6 Investor treatment and historical linkage

The existing investor module posts funding as Cash / Investor Funding Payable and assumes repayable principal. Verify the actual agreement before using that treatment; ownership capital requires an appropriate equity mapping and must not be forced into the repayable-investor schedule.

Spending the investor's funding on goods or paying another lender does not itself repay the investor. If the ₱500,000 is repayable and no principal repayment occurred, the obligation remains ₱500,000 despite the cash spending. Do not reduce it by purchase costs or unrelated loan repayments.

Current implementation constraints, from `docs/business-logic/clothing/accounting-investors.md`:

- Creating an agreement does not post funding.
- Record funding received creates a Cash receipt and liability.
- Receipt dates before Clothing cutover are rejected.
- Historical opening/manual funding linkage is not an automated workflow today.

Therefore do not move the October 12 receipt to October 28 to bypass validation. Add a narrowly scoped **Link historical funding** reconciliation action for repayable agreements. It must validate investor/agreement identity, amount, original receipt date, correct liability account, existing opening/manual source and absence of another linked funding movement. Linking must not create Cash again.

Inspect the existing investor funding fields and outstanding-principal calculations before defining the linkage schema. Extend portfolio summaries, repayment eligibility and audit history to recognize a verified historical opening link. Use transaction locks and unique constraints to prevent one opening from funding multiple agreements accidentally. Account mapping must preserve the existing stable investor account identifier, not create a parallel generic loan balance.

If no liability is represented yet, use a reviewed opening proposal rather than a fabricated post-cutover receipt. Separate historical receipt evidence from the October 28 opening source. Do not permit repayment workflows until linkage is reconciled. Ownership-equity handling must remain visibly pending if the agreement type has not been confirmed.

### 14.7 Purchases to reconcile

Use these names/codes as search references, then resolve actual permanent Product IDs:

| Product                     | Supplied code |
| --------------------------- | ------------- |
| Baby Bibs                   | BB-102726     |
| Dress With Sling Bag        | DWSB-102726   |
| Romper                      | R-102726      |
| Gap Socks                   | GS-102426     |
| Premium Leggings            | PL-102126     |
| Skort                       | S-101826      |
| Bucket Hats                 | BH-101826     |
| H&M Pants                   | HMP-101926    |
| H&M Shorts                  | HMS-101926    |
| Premium Brand Footed Pants  | PBFP-101626   |
| Dreamgrow Tiny Tots Pants   | DTTP-101626   |
| Bibs                        | B-101626      |
| Baby Photoshoot Mat         | BPM-101526    |
| Premium Longsleeves Onesie  | PLO-102126    |
| Mayoral Longsleeves Onesie  | MLO-102126    |
| Premium Pants               | PP-102026     |
| Mayoral Sleeveless Onesie   | MSO-101926    |
| Mayoral Shortsleeves Onesie | MSO-101926    |
| Tribu Footed Pants          | TFP-101926    |
| Premium Footed Pants        | PFP-101926    |

The two Mayoral products share a supplied code. Product codes are not unique database identities; never merge them solely by code.

For each product show purchase cost, actual supplier cash paid by cutoff, payment dates/methods, unpaid supplier balance, card-funded amounts, shipment/location status as of cutoff, and existing transit/settlement/reclassification source links. Show attributable logistics separately and reconcile through the existing logistics/landed-cost workflow.

An unpaid or card-funded purchase can create inventory without a contemporaneous Cash payment. Later card settlement is a separate cash event. Avoid counting both purchase cost and card settlement as cash outflow. Likewise, a supplier payment and its journal settlement lines are one outflow.

Do not trigger current-date product settlement actions to reconstruct historical payments. Propose missing historical accounting through a reviewed path that preserves dates and existing product posting protections. No broad bypass of payment locks or source identity controls.

### 14.8 Opening balance worksheet

Display, as of end of October 28:

- Cash across all locations.
- Inventory in Transit and other inventory/assets supported by source records.
- Outstanding customer deposits/refund obligations under existing recognition rules.
- Investor payable or appropriate ownership equity, depending on the agreement.
- Remaining loan/card liabilities supported by verified records.
- Supplier/logistics payables and any other balances necessary for a complete opening.

Each row needs expected amount, existing represented amount, difference, supporting source, and resolution state. “Existing represented amount” must include relevant derived operational balances, not just explicit openings. Review all assets, liabilities and equity; these listed balances alone may not form the whole opening balance sheet.

Do not force unexplained differences into an expense, investor balance, inventory valuation or extra cash entry. Opening Equity may be the existing opening mechanism's offset, but it is not proof that a difference has been explained. Provide previews that show the resulting complete report position before posting approved missing entries.

Retain the October 28 opening approach. Historical cash bridge movements are supporting evidence, not instructions to replay those receipts/payments into post-cutover Cash. Reconstructing the full earlier ledger would be a separate migration strategy, not an additional posting on top of the same opening.

### 14.9 Persistence and APIs

Add only what cannot be derived from existing records:

- A reconciliation session with date window, cutover snapshot date, revision and actor history.
- Verified observed balances by cash location with statement/reference evidence.
- Reconciliation-only historical movement evidence and links to canonical operational sources.
- Source matching/resolution records with uniqueness constraints and audit history.
- Historical investor-funding linkage as described above.
- Optional source-of-funds attribution records only if the owner provides an explicit allocation later. These are reporting annotations, not extra journal entries; no automatic FIFO or proportional allocation.

Use Decimal values and date-only business semantics. Authorize all financial reconciliation writes using existing accounting permissions. Preview/read endpoints must not post; write endpoints must require revision checks, stable operation keys and transactional deduplication. Include new tables in backup coverage.

### 14.10 Additional implementation phases and tests

Extend Phase 1 with a trace of investor funding, customer deposit recognition, product transit/settlement and logistics sources. After Phase 3, build the read-only cash bridge and manual evidence/matching UI. Extend Phase 4 with opening previews and historical investor linkage. Finish with isolated end-to-end reconciliation tests.

Required scenarios:

1. Investor receipt, reservation deposits and other receipts combine into one cash pool.
2. Loan payments and purchases both reduce that pool; neither reduces investor principal automatically.
3. Purchase spending does not release customer-deposit obligations.
4. A source payment plus its journal lines is counted once.
5. Credit-card/unpaid purchases do not reduce Cash until settlement; settlement is counted once.
6. Existing deposit-derived liabilities and transit assets are not duplicated by openings.
7. A historical October 12 investor receipt links to a verified opening without a new October 28 Cash receipt.
8. Historical linked investor principal appears once in investor portfolio and balance sheet; retries cannot duplicate linkage.
9. Loan cash payments with missing splits reconcile cash but keep accounting status incomplete.
10. Unknown opening cash, uncertain payment dates or missing statements leave the bridge incomplete, not falsely balanced.
11. Two products sharing MSO-101926 remain distinct by Product ID.
12. Deposits applied/refunded after cutoff leave the earlier snapshot unchanged.
13. Bank/e-wallet internal transfers net to zero in the consolidated bridge.
14. Subsequent record changes invalidate or version an approved reconciliation rather than silently altering its evidence.

Example test fixture only: pre-investment cash 0 + investor 500,000 + deposits 50,000 - inventory cash payments 400,000 - loan payments 54,054.86 = 95,945.14. These invented component amounts are solely for automated tests and must never be used as the owner's purchase/deposit/loan amounts.

Completion requires a documented source-to-cash reconciliation, a separate opening balance reconciliation, explicit unresolved items, and no duplicated receipts, purchases, customer deposits or repayments. Confirm the user can understand why cash, inventory and liabilities differ without needing to enter accounting terminology into ordinary tracking forms.
