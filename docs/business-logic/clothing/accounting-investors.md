# Clothing - Investors

## Scope and Access

- Location: Clothing > Accounting > Investors (`/clothing/accounting/investors`).
- API: `/api/clothing/investors`.
- Only ADMIN and SUPER_ADMIN may view or change records. Middleware, the server page, API handlers, and sidebar visibility enforce this restriction.
- This version manages investor profiles, separate investment agreements, projected schedules, funding receipts, full monthly payouts, and full principal repayments at maturity. Confirmed financial movements post balanced journal entries. It does not execute bank transfers, accrue overdue penalties, or process early termination.
- General Merchandise and Trucking are unchanged.

## Records

An investor has contact and bank details and may have multiple agreements. Each agreement has a unique reference, effective date, original principal, monthly rate (default 5%), and notes. Principal is stored as a PostgreSQL Decimal(14,2); returns are rounded half-up to centavos using integer arithmetic. Once funding or a payout is recorded, the agreement's investor, reference, effective date, principal, and rate cannot change. Notes remain editable.

Admins can mark a payable monthly return as Paid after transferring the funds. The record stores the actual amount and paid date, with at most one payment per agreement/month. Only a full payout equal to the projected return can be recorded; partial payouts are not supported. Deferred setup months and waived March payouts cannot be marked paid. New payment records and their journal lines are saved atomically. Principal repayment is a separate action, not a monthly-return payment.

The payout schedule includes the selected banking month plus all scheduled unpaid returns whose banking date is today or earlier, across all agreements and months. Orange **Mark paid** actions in both the schedule and portfolio open a payment confirmation; only **Confirm payment** submits the payment and journal posting. Cancelling makes no changes. Statement downloads remain limited to Paid records in the selected banking month, not the additional unpaid candidates.

All four tabs share the same search-field styling and toolbar arrangement. Each tab remembers its own search: dashboard and payouts by investor name/agreement reference, investors by name/email/phone, and bank closures by name/date within the selected year. Searches are case-insensitive. Payout statement downloads remain scoped to the selected month, independent of the row search; calendar coverage warnings use the full selected year, not search results.

## Dashboard

Dashboard is the default tab. It reads the existing portfolio response and does not create journal entries or require a migration. General Merchandise and Trucking are unchanged.

The dashboard uses a two-column card layout on large screens and stacks into one column on smaller screens. Agreement review appears at the top only when agreements need attention or bank-calendar coverage is missing; it combines unlinked funding, unposted historical returns, and matured unpaid principal in compact rows. The main column shows a Cash outlook card (cumulative 30/60/90-day totals and one chart with a Next 12 months / Principal maturities toggle) and Upcoming payouts. The side column shows Unpaid due returns (or an "All caught up" status), Investment maturities with Matured, Within 90 days, Past deadline, or Active badges, Recent activity, and Investors. Long lists show the first few rows with a Show all control. Search filters lists without changing totals; a search with no matching due returns does not imply that the portfolio has no unpaid returns due.

The monthly cash-requirements chart covers the current calendar month and the next 11 months, plus a separate Overdue bucket for unpaid movements before today. Returns are grouped by banking date and principal by repayment deadline. The maturity chart groups all confirmed outstanding principal by contractual maturity month, including older matured balances and maturities beyond the cash chart's 12-month horizon. Paid returns, unlinked principal, and repaid principal are excluded from their respective chart totals. Charts include peso tooltips, legends, and screen-reader data tables; they do not change with dashboard detail search and do not create postings.

- Summary metrics distinguish confirmed outstanding principal, all unpaid returns due through today, upcoming returns in the next 30 days (excluding amounts already due), and confirmed principal maturing from today through day 90.
- Outstanding principal includes only agreements with linked funding and without linked full principal repayment, including matured agreements still unpaid. Unlinked funding is excluded and flagged for reconciliation, not assumed to be zero owed in reality. Partial principal repayment is not supported by the underlying workflow.
- The cumulative 30/60/90-day cash forecast includes all scheduled unpaid returns with banking dates through each horizon, including already-due returns. Principal is included by its contractual repayment deadline (maturity plus 30 days), including overdue unpaid principal. Paid returns and repaid principal are excluded. Horizons use Manila's current business date and UTC date-only calendar arithmetic. Forecasts are not bank balances or overdue-interest calculations.
- Unpaid legacy returns remain visible even when funding has no linked posting; reconcile these agreements rather than silently dropping obligations. Final returns may remain payable after principal repayment because banking adjustments can move the last return after maturity.
- Unpaid due returns are sorted oldest first. Upcoming payouts cover the next 90 days. Both use the bank-adjusted schedule. Orange Mark paid actions open the existing confirmation; only confirmation saves the payment and balanced journal entries.
- Investment maturities lists all confirmed outstanding agreements, sorted by maturity, with principal, maturity, deadline, and status. Maturity, activity, and review links open the relevant investor agreement. Investor overview lists every investor, confirmed principal, agreement count, earliest unpaid banking date (which may be past due), and nearest funded maturity.
- Needs attention flags unlinked funding, historical paid returns without linked journal entries, matured outstanding principal, and years within the 90-day horizon with no recorded bank closures. A nonempty closure year is not proof that the holiday calendar is complete or officially verified.
- Recent activity shows the latest 15 recorded funding receipts, principal repayments, and Paid returns by actual movement date, not entry-creation time. Legacy Paid records may lack journal postings and are separately flagged; this is not an immutable audit log.
- Dashboard search filters detail tables but does not change overall summary metrics, cash requirements, or reconciliation warning totals. Existing permissions and financial posting behavior remain unchanged.

## Accounting Posting

Saving an agreement is not proof of receiving cash and does not post a journal entry. Use **Record funding received** with the actual receipt date only after checking that the movement is not already in opening balances or a manual entry.

| Movement                 | Debit                    | Credit                   |
| ------------------------ | ------------------------ | ------------------------ |
| Funding received         | Cash                     | Investor Funding Payable |
| Monthly return paid      | Investor Return Expense  | Cash                     |
| Principal repaid in full | Investor Funding Payable | Cash                     |

Balance sheet, journal, and ledger reports display investor liability accounts as `Investor Funding Payable - {investor name} - {agreement reference}`. This also applies to existing postings. Stored account identifiers retain the legacy `Loan Payable - Investor {agreement ID}` key so funding and repayment stay linked without rewriting financial records. If an agreement cannot be resolved, reports display `Investor Funding Payable - {agreement ID}`.

For PHP 1,000,000 received and a PHP 50,000 return paid, cash increases net PHP 950,000, principal owed stays PHP 1,000,000, and profit/equity decreases PHP 50,000. Principal repayment reduces cash and the liability equally, without being an expense. This assumes repayable investment principal, not ownership equity.

- Journal and ledger read the existing ClothingAccountingJournalLine records. The balance sheet recognizes cash and the investor funding liability, and rolls return expenses into retained earnings. P&L totals and details include posted investor return expenses by actual payment date. Cash includes bank/e-wallet equivalents under the existing accounting policy.
- Source types are `INVESTOR_FUNDING`, `INVESTOR_RETURN`, and `INVESTOR_REPAYMENT`; source IDs link to the agreement or monthly payment. Unique source/line keys prevent duplicate journal posting. Agreement row locks serialize financial actions and agreement edits. System-generated entries cannot be modified through the manual-journal endpoints.
- Principal repayment requires linked funding, contract maturity, and a date not earlier than funding or existing returns. Partial principal repayment and early termination require separate review. Repayment does not delete the agreement or its history.
- Dates before the configured Clothing accounting cutover or in the future are rejected. Older balances must be reconciled through opening balances, not silently moved to a new date.
- Existing agreements and historical Paid records are **not automatically backfilled**. The portfolio flags unposted historical returns and unlinked funding. If already represented in manual entries/opening balances, do not record funding again. Historical reconciliation, linking previously posted principal for repayment, and correcting/reversing investor postings require an accountant-led follow-up; there is no automatic correction workflow.
- Monthly returns may still be recorded for legacy agreements without linked funding (which may already exist in opening balances); the unlinked funding warning remains until reconciliation. New returns must not be duplicated as ordinary expenses or manual journals.
- This integration uses the existing journal table and requires no new database migration.

### Reconciled Return Reporting

P&L summary and details consume posted returns through their dedicated investor
fetcher. The generic journal projection excludes only that same
`INVESTOR_RETURN` / `Investor Return Expense` line, preventing double counting;
manual same-account entries and other investor expense categories remain eligible.
No source journal or historical payment is rewritten by this reporting repair.

Real authenticated API evidence on 2026-10-28 created an investor/agreement
without posting, recorded funding 1,000, rejected partial return 49, and paid the
full 50. Journal/Ledger, P&L summary/details, Balance Sheet, actual report cards
and downloaded CSVs agreed: Cash +950, principal liability 1,000 and expense 50
exactly once. Duplicate funding/payment rejected with unchanged reports. Only
owned fixtures were removed, restoring original report payloads; the isolated
database was removed and verified absent. Evidence:
`/tmp/bms-reconciliation-2PU6ww`, driven by
`node tests/e2e/clothing-reconciliation.browser.cjs --reminders-only`.
This does not newly certify principal repayment, legacy reconciliation, external
bank settlement, every schedule rule or the whole investor UI lifecycle.

The payout schedule can generate a branded A4 Investor Payout Statement ZIP for a selected banking month. It includes only recorded payments whose scheduled banking date falls in that month, with one PDF per agreement payout. The statement shows investor and agreement details, scheduled banking date, recorded amount, and payment date. It is not a bank transfer receipt or tax invoice; generation does not record a separate document or transfer reference.

Each PDF keeps the payout statement on portrait page 1 and adds **Projected returns** on landscape page 2. Page 1 highlights the amount paid, PAID status, and agreement month (of 36), followed by payout-month, banking-date, and payment-date tiles, investment details, and the principal × monthly rate calculation. Page 2 shows summary tiles for paid to date, upcoming, overdue, and total contract returns, a paid-months progress bar, and the 36 months in two side-by-side tables with status pills; the statement's own month is highlighted. The second page lists all 36 agreement months, anniversary and bank-adjusted dates, return amounts, recorded payment dates, and Paid, Upcoming, Overdue, Setup deferral, or March waived statuses. Paid status uses all recorded payments for that agreement, not just the selected banking month. Unpaid banking dates before the generation business date are Overdue; today and later are Upcoming. This is a current snapshot, not a historical month-end statement. Projections use the current bank calendar and exclude principal repayment.

The overview reports investors, agreements within their effective-to-maturity dates, capital in those terms, and projected returns by banking date. These figures are not confirmations of funds received, principal outstanding, or payments made. Matured agreements remain visible in each portfolio.

## Schedule Rules

1. The effective date is a date-only business date. Calendar arithmetic is timezone-independent; current business dates and display use the application's Manila date utilities.
2. The initial setup threshold is effective date plus 81 calendar days. The first eligible payout is the first monthly anniversary on or after that threshold, except March. There is no separate payout on day 81.
3. All 36 monthly anniversaries are calculated independently from the effective date, not from the previous adjusted banking date. Short months clamp to their last day without changing subsequent anniversary days.
4. March anniversaries have zero return. They do not accrue or carry forward. Setup deferrals also have zero return.
5. Each payable return is original principal multiplied by the monthly rate, without compounding.
6. Saturdays, Sundays, and recorded bank closures move payment forward to the next banking day. A February return shifted into March remains payable; the waiver uses the original anniversary month.
7. Contract maturity is effective date plus 36 months. Banking adjustments never change maturity. A final scheduled return may have a banking date after maturity.
8. The principal repayment deadline is maturity plus 30 calendar days, displayed separately from monthly returns.
9. Early-termination repayment and partial-month proration are not automated in this version. Projections assume the full contract term.

Example: January 25, 2026 reaches day 81 on April 16. Its first eligible anniversary is April 25, adjusted to Monday April 27 unless that date is a recorded closure. Future anniversaries remain on the 25th. Maturity is January 25, 2029.

## Bank Calendar

The migration imports 81 dates marked Closed from the supplied investor workbook's NATIONAL HOLIDAYS sheet, covering 2026-2030. Open working holidays are excluded. These are workbook-derived dates, not an independently verified official calendar; administrators must check proclamations, additional holidays, local bank closures, and future years before relying on payment projections.

Admins can add closures, rename them, or soft-remove them. Saving a previously removed date restores it. To change a date, remove the old entry and add the correct one. Schedule projections immediately reflect calendar changes. The page warns when no closures are recorded for a selected year.

## Storage and Rollout

- Models: ClothingInvestor, ClothingInvestmentAgreement, ClothingInvestmentPayment, ClothingInvestorBankClosure, in the public schema.
- Migration: `20261017090000_clothing_investors`. It only creates new tables/indexes and inserts the workbook bank calendar; it does not import investor personal data or alter existing accounting records.
- Migration: `20261017110000_clothing_investment_payments`. It adds a payment table and constraints; it does not alter existing accounting records.
- Generate the Prisma client and apply this migration through the normal reviewed deployment process. Do not replay unrelated historical migrations against a database with unmanaged migration history.
- These models are covered by full PostgreSQL dumps, not selective JSON backups/restores. Use full database backups to preserve investor data.
- The source agreement template remains unchanged. Its third-month and bracketed fifth-day wording must be reconciled with the agreed anniversary/81-day policy before issuing contracts.

## Validation

- `npx vitest run tests/unit/investors`
- `npx vitest run --config vitest.config.integration.ts tests/integration/investors.test.ts`
- Repository quality gates: guardrails, lint, typecheck, unit, integration, and hardening suites.
