# Clothing October 12 Cutover — Reconciliation Log

Status: working log. Last updated October 29, 2026. Sections 1-9 retain the prior simulation; sections 10-14 record subsequent development work and qualifications. Sections 15-16 record the owner-approved production historical-refund and seven-product stock corrections. Section 17 records deposit/stock analysis and the initial blocked false-receipt rehearsal; section 18 records its subsequent approved production correction and verification. Wider financial/inventory reconciliation and the recurring UI release remain open.

Companion to [clothing-monthly-dues-implementation-plan.md](../clothing-monthly-dues-implementation-plan.md) and the root `plan.md`. This file records what was actually done, why, and what is still open. Update it after every change.

## 1. Scope and safety

- All changes were made in the **development database** (a copy of production, `localhost:5435`, database `business_management`). Production was not touched.
- Every simulated entry is tagged `SIM-` in its reference or `[SIMULATION]` in its description or notes, so it can be found and removed.
- All writes were append-only or made in one all-or-nothing transaction. A fresh backup was taken before each write batch (section 6).
- No git commit, push or deployment was made.

## 2. Decisions

| Decision            | Detail                                                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clothing cutover    | October 12, 2026 (saved by the owner). General Merchandise stays October 1.                                                                                                      |
| Investor funding    | Repayable, 5% monthly, 36 months (confirmed by the owner). Agreement `CR-2026-003`, ₱500,000, effective October 12.                                                              |
| Purchases           | The 20 products are treated as paid from cash/bank per the owner. The product records still say CARD with a saved card labelled "test".                                          |
| Dues                | CSV dues dated October 12–28 treated as paid on their due dates. Dues dated October 3–9 are not logged: they predate the funding and are already inside the October 12 position. |
| Excluded from stock | Burp Cloth (BC-081326) and Onesie Dress (OD-020726): supplier cannot supply; reseller orders to be cancelled.                                                                    |
| Zeroed products     | Seven products zeroed by scrap, not supplier-short (section 4).                                                                                                                  |

## 3. Entries posted (simulation)

| #   | Entry                                                                                  |      Amount | Reference / how to find                                                                                              | Status                                  |
| --- | -------------------------------------------------------------------------------------- | ----------: | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Investor funding, Cash / Investor Funding Payable, dated Oct 12                        | ₱500,000.00 | `INVESTOR_FUNDING`, agreement `CR-2026-003`                                                                          | Posted with the app's own investor code |
| 2   | 16 purchases, Inventory in Transit / Cash (shipments KPC 23930A-237 to -240)           | ₱246,722.68 | Transit build entries, key `PRODUCT_TRANSIT_BUILD:<id>:GRAND_TOTAL`, notes `[SIMULATION]`                            | Posted                                  |
| 3   | 4 purchases with no shipment code (Gap Socks, Romper, Dress With Sling Bag, Baby Bibs) | ₱132,912.44 | Manual journals `SIM-PURCHASE-<code>`                                                                                | Posted                                  |
| 4   | 9 loan/card dues, Oct 13–28, debit tagged payable / credit Cash                        |  ₱72,090.08 | Manual journals `SIM-DUES-*`                                                                                         | Posted, no principal/interest split     |
| 5   | Household transfers, Owner Draw / Cash, dated Oct 28                                   | ₱104,954.10 | Manual journal `SIM-HOUSEHOLD`                                                                                       | Balancing figure, **not confirmed**     |
| 6   | Opening stock, Stock on Hand / Opening Equity, dated Oct 12                            | ₱197,226.11 | Opening rows `SIM-OPENING-STOCK`                                                                                     | Rebuilt (section 5)                     |
| 7   | Opening customer deposits, Opening Equity / Customer Deposits                          |   ₱3,049.50 | Opening rows `SIM-OPENING-DEPOSITS`                                                                                  | Posted                                  |
| 8   | Onesie Dress cancellations: approval and refund moved to March 1                       |   ₱2,568.50 | 11 cancellations on orders 2245–2258, 22 `CUSTOMER_CANCELLATION` journal lines, 11 payouts with notes `[SIMULATION]` | Done (section 4a)                       |

Dues posted: GGives 664.70; Esquire 2 5,666.67; BPI BanKo Negosyo 10,230.77 (Oct 15) and 10,230.77 (Oct 28); BPI Credit Card 21,500.00; RCBC Credit 6,000.00; Esquire 1 11,333.33; GGives 2 1,282.84; GLoan 2 5,181.00. Both BanKo payments need confirming: the Oct 15 and Oct 28 dates are 13 days apart, not 14.

## 4. Stock zero-out (seven products)

Append-only inventory adjustments dated October 28, notes starting `[SIMULATION] zero-out:`. The scrap rows were later re-dated to October 11 (see section 5). No movement was deleted and no sales movement was touched.

| Product                       | Sold (unchanged) | Scrapped | Note                                                                                                                                                            |
| ----------------------------- | ---------------: | -------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Girls Onesie (GO-091526)      |              360 |      591 | An earlier "set to 0" attempt moved about 1,180 units to supplier-short, double the intended 590. Reversed and scrapped. 50 units stay reserved for order 3545. |
| Baby Pants (BP-022326)        |              110 |       34 |                                                                                                                                                                 |
| Sleeveless Onesie (SO-020726) |              177 |       60 |                                                                                                                                                                 |
| H&M Shorts (HMS-012826)       |               27 |        2 |                                                                                                                                                                 |
| Premium Short (PS-012426)     |              700 |        9 | 3 sellable plus 6 damaged hold                                                                                                                                  |
| Romper (R-012426)             |              285 |       21 | 1 unit was a supplier-short zeroing attempt, reversed                                                                                                           |
| Chickpea Onesie (CO-081026)   |              516 |       65 | The 65 units were a supplier-short zeroing attempt, reversed                                                                                                    |

Result: all seven show 0 sellable, the supplier-short flags are cleared, and sold totals still match their sales. None appears in the inventory health check.

## 4a. Onesie Dress refund (₱2,568.50 Refunds Payable)

- **Problem:** the 11 Onesie Dress orders were cancelled on October 27. The approval posted a Refunds Payable of ₱2,568.50 in October, but the resellers had already been refunded on March 1 because the supplier never shipped. The deposits were paid between February 18 and 28, before the cutover.
- **Fix:** set each cancellation's approval date to 2026-03-01 and re-dated its 22 journal lines to 2026-03-01. Then recorded the 11 payouts through the app's own payout function, dated 2026-03-01. The app only allows a payout on or after approval, so the approval date had to move first.
- **Result:** pending refunds are ₱0 and Refunds Payable is gone. The October 27 approval had also released ₱2,398.50 of deposits that were never in the October books, which understated Customer Deposits. That is corrected.
- **Caveats:** payment method is recorded as `Other` because it was not confirmed. Re-dating an approval changes a record the app treats as immutable, so in production use the owner-approved correction path and keep the original evidence. The orders' status changes are still stamped October 27.

## 5. Findings

1. **Opening stock was overstated.** The first opening (₱588,736.87) came from the movement ledger. The Inventory page uses product-level quantities, and the two disagree: for products bought before October 12 the ledger holds about ₱450.6K at cost, of which only about ₱200K is supported by product quantity minus units sold. Example: Mixed Onesie ledger receipts are 14,412 units against a product quantity of 9,100.
2. **Rebuilt opening ₱197,226.11** = on-hand units from the Inventory page's logic valued at cost (₱71,788.73, 35 products, 1,051 units) + cost of sales since October 12 (₱125,430.17) + other shrinkage already booked (₱7.21). Stock on Hand at October 28 is ₱71,803.15 (₱14.42 is an older inventory entry).
3. **Customer deposits.** Deposits received before October 12 total ₱97,772.40 on 174 orders. Only ₱3,049.50 on 13 orders is still open under the balance sheet's rules. ₱92,453.40 was already recognized as sales and ₱2,269.50 was forfeited. An opening entry cannot age: if those orders are recognized later, the liability stays on the balance sheet.
4. **Inventory Shrinkage is counted as an asset** in the balance sheet, so scrapped stock does not yet reduce equity. This is existing app behavior. The profit and loss report has not been checked.
5. **Drift report.** Six of the seven zeroed products still appear because it compares received quantity to the ledger. A resync of the ledger to product quantity could bring the stock back, so do not run one on these products.
6. **Cash at October 11 is unknown.** The ₱104,954.10 household figure assumes starting cash was ₱0. Any real opening cash raises the unexplained outflow by the same amount.
7. **Cutover side effects.** The February and March openings and the January–March manual journals fall before the cutover and drop out of reports. The product service checks the environment cutover (default January 17), not the saved October 12 value.
8. **Inventory page value.** The ₱54,177 on screen could not be matched exactly. The closest is ₱50,721 at selling price for older products excluding the two removed ones.

## 6. Backups (`~/bms-dev-backups/`)

| File                                                                | Taken before              |
| ------------------------------------------------------------------- | ------------------------- |
| `business_management_dev_pre-simulation_20261028T223704.dump`       | Items 1–5                 |
| `business_management_dev_pre-scrap_20261028T230618.dump`            | Stock zero-out            |
| `business_management_dev_pre-opening-rebuild_20261028T232639.dump`  | Opening stock rebuild     |
| `business_management_dev_pre-deposits-opening_20261028T233223.dump` | Customer deposits opening |
| `business_management_dev_pre-refund-fix_20261028T234548.dump`       | Onesie Dress refund fix   |

Undo: restore the backup taken before the step to reverse. Investor funding cannot be removed from the app, so removing only the manual entries leaves it behind.

## 7. Balance sheet snapshot (October 28, balanced)

| Account                  |       Amount |
| ------------------------ | -----------: |
| Cash                     |   ₱99,331.00 |
| Stock on Hand            |   ₱71,803.15 |
| Inventory in Transit     |  ₱379,635.12 |
| Customer Deposits        |  −₱43,911.80 |
| Investor Funding Payable | −₱500,000.00 |
| Owner Draw               |  ₱104,954.10 |
| Opening Equity           | −₱194,191.03 |
| Inventory Shrinkage      |        ₱7.21 |

Refunds Payable is no longer on the balance sheet (section 4a). Loan lines show debit balances for the dues paid (₱72,090.08 in total) because no October 12 loan openings exist yet.

## 8. Open items

| #   | Item                                                                           | Needs                                     | Status                            |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------- | --------------------------------- |
| 1   | October 12 loan and card balances                                              | Lender statements                         | Open                              |
| 2   | Cash, bank and e-wallet balances at October 11                                 | Statements                                | Open. Drives the household figure |
| 3   | Confirm the ₱104,954.10 household transfers                                    | Statements                                | Open                              |
| 4   | Confirm dates and amounts of dues, including both BanKo payments               | Payment records                           | Open                              |
| 5   | Purchases: cash or card                                                        | Card statement                            | Open                              |
| 6   | Logistics costs (₱49,690 costing) not recorded                                 | Payment records                           | Open                              |
| 7   | Cancel reseller orders for Burp Cloth and Onesie Dress                         | Order cancellation workflow               | Not done                          |
| 8   | Order 3545: 50 Girls Onesie units reserved                                     | Decide ship or cancel                     | Open                              |
| 9   | Inventory Shrinkage shown as an asset                                          | Review classification and profit and loss | Open                              |
| 10  | 8,525 ledger units with no product record; codes with negative ledger balances | Review or physical count                  | Open                              |
| 11  | Physical stock count to confirm the opening                                    | Count                                     | Open                              |
| 12  | ₱3,456 gap to the Inventory page value                                         | Investigate                               | Open                              |
| 13  | Payment method of the March 1 Onesie Dress refunds (recorded as `Other`)       | Confirm with the owner                    | Open                              |

## 9. Before repeating this in production

- Verify items 1–6 in section 8 from statements first. Do not repeat the balancing figures.
- Take and test a full production backup, and follow the reviewed migration and deployment procedure.
- Entries tagged `SIM-` are simulation labels. Use real references in production.
- Update the business-logic docs and the pull request's business-rule record for any code or policy change. None was made here.

## 10. October 29 read-only inventory and cash review

Full evidence and worksheets: [October 12-29 inventory and cash audit](../reports/CLOTHING_OCT12_CASH_AND_INVENTORY_AUDIT_2026-10-29.md).
Snapshot: October 29, 00:25:41 Asia/Manila. No database changes, corrections,
new backup, production access, commit, push or deployment were made. Source
reads were PostgreSQL-enforced read-only transactions; only audit artifacts
and this log were written in the development checkout.

- **Owner Draw remains unverified.** The ₱104,954.10 entry was not changed. After the owner's scope clarification below, the baseline includes only the 20 confirmed purchases and conditionally ₱2,480 shipment 236 fees. With zero opening cash assumed and the approximate ₱95,945.14 closing balance, the unexplained difference is ₱101,528.96. The initial ₱70,892.32 assumed a Product 290 cash payment that is now disproven by the owner's September confirmation; retain it only as superseded history. Actual opening/closing cash, other payment dates/methods and missing expenses remain unresolved.
- **Shipment 236 fees and pre-cutover purchase:** Product 290, Premium Shortsleeves Onesie (PSO-101226), has saved order date October 12 and Grand Total ₱30,636.64, but the owner confirms it was ordered and paid in September, logged October 12 and arrived October 13. It is not an omitted post-funding supplier payment. KPC 23930A-236's actual fee is owner-confirmed ₱1,530 plus Lalamove ₱950, total ₱2,480. Its October receipt, reservations and sales remain included. No acquisition/settlement/logistics posting for this product/shipment was found; do not invent another supplier payment. Its additional ₱1,500 packaging estimate is not confirmed paid.
- **Cash discrepancy:** dated customer events total ₱159,179.30 (₱44,864.30 deposits and ₱114,315 other collections). Seven orders paid before cutover add ₱4,331 through the balance sheet's old-order cash fallback. Excluding that inferred new receipt reproduces ₱95,000 cash after the existing simulation draw, versus the displayed ₱99,331. No code change was made.
- **Purchases:** the owner confirms 20 after-October-12 purchases, 10,639 ordered units, Grand Total ₱379,635.12. Their saved methods are 17 CASH (₱328,807.29) and three CARD (₱50,827.83). The date-inclusive database query separately includes Product 290, producing 21 products/11,379 units/₱410,271.76. The simulation still cash-funded the 20, so actual funding needs confirmation. No purchase date was rewritten.
- **Sales:** 25 fulfilled orders, 3,036 units, ₱161,538 gross order value; every order quantity matches its linked sales movements. Strict movement dates select only 22 orders/986 units because three older order-date movements were fulfilled in October. Accounting-date COGS reproduces ₱125,430.17, with 15 legacy-cost valuation gaps; this is not cash spending.
- **Remaining stock:** the previous 1,051 legacy units/₱71,788.73 catalog cost reproduce, split into 371 available, 606 reserved and 74 damaged. This includes 65 units on three undated catalog rows. Premium Shortsleeves Onesie has 650 sold and 90 reserved; linked shipments 237-240 contain 5,708 in-transit units. Four newer purchases with no shipment link have 4,931 units whose physical location is unconfirmed.
- **Inventory cannot be certified:** 62 products disagree on remaining asset units between ledger and app projection; 51 have negative sellable ledger buckets. Five of the 20 confirmed purchases have receipt differences, net 20 units short. Boundary Product 290 separately differs by 40 units, taking the wider population's net difference to 60; two 50-unit pairs offset without proving a transfer. Never-supplied Burp Cloth and Onesie Dress still appear as 1,810 available and 1,080 reserved units and must be excluded from supportable stock. The newly defined unresolved-code population is 28 codes/8,511 asset units, not a reproduced certification of the earlier 8,525 figure. No resync or stock adjustment was run.
- **Opening stock needs review:** the prior opening adds all ₱125,430.17 period COGS, including ₱30,888 for Product 290. Its September payment/October 13 arrival is now confirmed: review pre-cutover in-transit carrying cost and the arrival reclassification, not another October supplier payment. Its remaining 90 reserved units at ₱4,276.80 saved catalog cost appear outside the earlier ending-stock basis; resolve the 40-unit receipt discrepancy and actual costs before any adjustment. No replacement opening was posted.
- **Dues/expenses:** the nine simulated dues total ₱72,090.08 and payroll marked paid is ₱7,500. October 29 Esquire ₱5,666.67 has no payment record at the snapshot; October 30 Eastwest dues total ₱10,915.53 and remain outside the window. Schedule totals were not posted, and principal/interest splits were not invented. No SHIPMENT_LOGISTICS journal exists in the window; pricing estimates are not proof of cash paid.

Read-only aggregate SQL checks independently matched receipts, purchase costs,
dues, and movement totals. Application inventory and accounting cost functions
were reused offline. All 243 active-product bucket rollforwards cross-footed.
These checks do not replace statements or a physical stock count. October 12
loan openings remain paused pending the evidence listed in the full report.
Guardrails, lint and typecheck passed; existing unrelated lint warnings remain.
The report's purchase/sales/dues tables and local links were also validated.

### Owner clarification after the first audit

The owner reconfirmed that only the 20 products listed in the full report's
section 6 were purchased **after** October 12. These resolve to Product IDs
291-310, including the two separate Mayoral Onesie products. Product 290 has a
saved October 12 logging date; the owner subsequently confirmed September
ordering/payment and October 13 arrival. It is not another use of the investment
cash. Its exact September payment day/account remains unverified, but the month
and pre-funding timing are no longer unresolved.

The owner also reconfirmed that Burp Cloth (Product 276, BC-081326) and Onesie
Dress (Product 173, OD-020726) were never shipped by the supplier. Neither is
physical on-hand stock; any supplier refund/credit or remaining customer
obligation needs separate source evidence. Do not repeat the already recorded
Onesie Dress customer refunds or invent supplier credits. The after-October-12
list confirmation does not establish that every listed in-transit product has
arrived, or that each saved payment method is correct.

Only the offline calculation and audit/log wording were updated. The raw
snapshot, database, saved product dates, sales and postings remain unchanged.
The focused checks passed for all 20 purchase rows, exact identity/cost totals,
never-shipped exclusions, boundary timing, conditional cash arithmetic and nine
local links. Guardrails, lint and typecheck were rerun and passed; existing
lint warnings remain. No database-writing test or production build was run.

## 11. Confirmed PSO Timeline And Balance-Sheet Follow-Up

The owner confirms Premium Shortsleeves Onesie was ordered and paid in
September, logged October 12 (hence PSO-101226), and arrived October 13 on
KPC 23930A-236. Confirmed actual delivery charges are **₱1,530 KPC + ₱950
Lalamove = ₱2,480**. Do not remove its October inventory movements or sales:
eight fulfilled orders/650 units/₱44,850 remain included, with 90 units reserved
on two prepared unpaid/part-paid orders. Only the September supplier purchase
is excluded from the October cash-outflow list. Charge amounts/arrival do not
independently verify their payment date or method.

The separate follow-up snapshot was captured October 29 at 01:02:44 Asia/Manila
in an enforced read-only/repeatable-read transaction. Only Product 290's saved
shipment status changed since the first snapshot; its linked shipment remains
Delivered and takes precedence in the inventory projection. All other 26 source
tables match. Both raw snapshots are preserved; no database correction was made.

- **Cash:** ₱99,331 less the ₱4,331 earlier-payment fallback gives ₱95,000 before unposted delivery charges. Increasing Owner Draw by ₱3,385.86 to ₱108,339.96 merely to display the owner's approximate ₱95,945.14 would hide the reporting issue. The remaining gap is ₱945.14 before fees; if ₱2,480 fees were cash-paid in the window, the same recorded draw leaves ₱92,520. No draw change is approved or posted.
- **Stock on Hand:** ₱197,226.11 opening - ₱125,430.17 COGS + ₱14.42 scrap-origin receipts - ₱7.21 shrinkage = ₱71,803.15. The legacy ending basis is 371 available units/₱37,665.79 cost + 606 reserved/₱30,151.75 + 74 damaged/₱3,971.19 = ₱71,788.73. This includes reserved/prepared stock at cost, not just available units at selling prices; damaged value is not independently certified.
- **PSO reserved stock:** order 3471 reserves 50 units (₱345 collected, ₱3,105 outstanding); order 3612 reserves 40 (₱0 collected, ₱2,760 outstanding). Both have no sale movement. Their 90 units stay in inventory, not available sellable value. The prior rebuild omitted those remaining units from its ending basis, so review their ₱4,276.80 catalog cost rather than silently posting it.
- **Sellable value:** the same legacy population reproduces ₱50,721 at saved selling prices, not the reported ₱54,177. The ₱3,456 difference remains open and needs the actual item-level screen/export or count with matching filters/prices. Do not force Stock on Hand to the selling-value total or claim prepared orders explain the whole discrepancy.

The full report's section 10 and the separate follow-up analysis retain the
exact bridges and order evidence. Offline checks passed for both analyses,
including the confirmed timeline, fees, retained PSO sales and reserved stock;
the two raw snapshot files remained byte-identical across recalculation.

## 12. Headline Balance-Sheet Accuracy Check

The October 29 screenshot totals reproduce exactly: Assets **₱550,776.48**,
Liabilities **₱471,821.72**, Equity **₱78,954.76**. All 27 source tables still
match the follow-up snapshot in a fresh enforced read-only comparison. The
asset total is ₱99,331 Cash + ₱71,803.15 Stock on Hand + ₱379,635.12 Inventory
in Transit + ₱7.21 Inventory Shrinkage currently classified as an asset.

The liability total is ₱500,000 investor funding + ₱43,911.80 customer deposits

- ₱72,090.08 loan/card debit balances. Those payments have no loan/card opening
  balances in the window. Their actual business debt balances and principal/interest
  splits are needed; payment debits must not be mistaken for reductions of the
  separate investor/deposit obligations. The ₱543,911.80 gross investor/deposit
  credit total is not a proposed corrected liability amount.

The equation balances, but the statement is not yet verified or demonstrably
close to actual finances. Missing debt openings, the cash fallback, unresolved
inventory/arrival valuation, unverified owner transfers and logistics timing
remain material. Equity is consequently provisional. Exact-decimal aggregate
checks passed; no database or application correction was made. Full evidence
and priority follow-ups are in the audit report's section 11.

## 13. Authorized Development Recurring-Fee Conversion

Executed October 29, 2026 at 01:51:45 Asia/Manila
(2026-10-28T17:51:45.561Z), operation `SIM-DUES-RECURRING-20261029`.
The business owner explicitly approved replacing the eight named creditors'
existing simulated payments with recurring fees in development only. This
section supersedes the earlier loan/card-debit treatment, not the earlier
physical-stock or cash-evidence caveats. No production replication is approved.

- Exactly nine paid occurrences / PHP72,090.08 were converted: October 13 GGives, 14 Esquire 2, 15 BanKo, 17 BPI card, 19 RCBC, 23 Esquire 1, 24 GGives 2, 26 GLoan 2 and 28 BanKo.
- The 18 original MANUAL journal lines were soft-deleted, with all other original fields preserved except update/deletion metadata. Nine APPROVED recurring drafts and 18 replacement journal lines debit `Monthly Dues Expense` and credit `Cash` on the same saved dates and amounts. Dates remain simulation/due dates, not newly verified bank timestamps.
- Ten EXPENSE templates represent eight creditors: Esquire 1 and 2 each have two due-day rules, not two separate loans. Eight templates are active. BanKo's unsupported 14-day cycle and Esquire 2's 29th/February policy remain paused. BanKo's stored date is the last reported October 28 payment, NOT an approved next due date.
- One additional DRAFT records Esquire 2 due October 29, PHP5,666.67, without journal lines. October 29 and 30 payments are not marked paid. No October 30 creditor template was added in this eight-creditor batch.
- Seven owner-confirmed paid installments on October 3-9, totaling PHP52,796.97, remain historical assertions only: GLoan 1, GLoan 3, Grab 1, Grab 2, Asialink, Esquire 1 and PNB card. They are excluded from post-October-12 cash deductions, not forgotten or recorded as SKIPPED. Esquire 1's next 8th rule starts November 8. Other creditors are outside this batch.
- Full-installment expense treatment is a provisional development cash-flow simulation, NOT verified principal/interest accounting or production policy. Unknown principal balances were not invented. Existing UI/API approval and monthly generation semantics are unchanged; no schema or application code changed.

### Backup And Execution Evidence

Fresh full logical development backup:
`~/bms-dev-backups/business_management_dev_pre-recurring-dues_20261028T175105619Z.dump`
(53,363,448 bytes, private permissions). SHA-256:
`3f23f1779c6d36a011cc9e8b6617f89db11f71ede792fd101bd38a380ac013b4`.
The archive listing and required tables were verified; a full restore was NOT rehearsed.

The [one-off conversion script](../../scripts/tmp/reconcile-clothing-dues-recurring-2026-10-29.cjs)
defaults to preview-only and checks the exact development target, backup hash,
source IDs, amounts, dates and pair structure. A serializable transaction and
operation advisory lock protect execution. A successful forced-rollback rehearsal
preceded apply; all originals and protected hashes matched after rollback. A
second apply returned `idempotentNoop: true` and did not overwrite evidence.
Retain this temporary script with these execution notes while production review
is pending; archive or remove it afterward under the TMP retention policy.

The [execution record](../../reports/clothing-dues-recurring-conversion-result-2026-10-29.json)
retains all original row IDs/content and protected-table hashes. Replacement
draft/source IDs use `SIM-DUES-RECURRING-20261029-<key>-<YYYY-MM-DD>`; the reviewed
key/source mapping is in the script. Existing three inactive templates and the
Spotify draft are unchanged. Reversal requires a separately approved atomic
operation; do not approve replacement payments again or restore a whole backup
over subsequent work.

### Result And Business-Rule Record

Read-only verification and the new
[post-conversion snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29-post-conversion.json)
prove that only journal lines, recurring templates and recurring drafts changed;
the other 24 audited source tables match the preserved follow-up snapshot.
Original unrelated journal rows and recurring records also match. Investor
funding, deposits, openings, purchases, inventory, customer receipts/refunds and
Owner Draw remain unchanged. The separate
[post-conversion analysis](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29-post-conversion.json)
reproduces Cash PHP99,331 reported / PHP95,000 dated-event, Stock on Hand
PHP71,803.15 and dues PHP72,090.08. All inventory-analysis output matches the
pre-conversion analysis, including 243 bucket rollforwards and zero sale-quantity
mismatches.

On the unchanged report basis, Assets remain PHP550,776.48, Liabilities become
PHP543,911.80 and Equity becomes PHP6,864.68. These are independently cross-footed
from the prior report plus the verified PHP72,090.08 reclassification, not a
fresh authenticated HTTP report or certification of actual balances. The
PHP4,331 cash fallback, missing principal, inventory drift, unverified draw and
delivery-payment timing remain unresolved.

Accountable owner: the requesting Clothing business owner. Approved invariant:
replace only these development simulation postings without changing cash or
unrelated records. Enforcement is this guarded one-off transaction, mirroring
the existing recurring service's approved-draft/two-line posting structure.
Domain: Clothing only. Clothing UI/API and generator consume the resulting
records normally; no import, bulk, cleanup or application rule was added.
General merchandise, trucking, household finance and shared consumers are
unchanged because their records, schema and code are outside this operation.
The development-only accounting divergence is intentional and explicitly
owner-approved; production debt policy remains unapproved. No commit, push,
migration, deployment, resync or production change occurred.

## 14. Owner-Confirmed Final Esquire 3 Payment

The owner subsequently confirmed an additional **PHP11,333.33 Esquire 3 payment
on October 25, 2026**, which was also the facility's final day. This is a new
post-cutover outflow, not a replacement of any of section 13's nine payments.
It was applied in development at 02:03:09 Asia/Manila on October 29
(2026-10-28T18:03:09.522Z), operation `SIM-DUES-ESQUIRE3-FINAL-20261029`.

After duplicate review, a fresh full logical backup was taken:
`~/bms-dev-backups/business_management_dev_pre-recurring-dues_20261028T180243457Z.dump`
(53,380,942 bytes, SHA-256
`539e0a1f3bbb108ab849390d932fbffc31868d3bbe36386b32bc9cbdc7001dc1`).
Its archive listing/hash passed; no full restore was rehearsed. A successful
forced-rollback rehearsal preceded apply, with all prior protected data verified
unchanged. No old record was modified or soft-deleted for this addendum.

Created one inactive EXPENSE template, ending October 25, one APPROVED October
25 draft and two balanced journal lines: debit `Monthly Dues Expense`, credit
`Cash`, PHP11,333.33. No future dues were created. The inactive template retains
October 25 as historical next-date metadata, not a future obligation. The exact
template/draft/journal IDs and protected hashes are in the
[final-payment execution record](../../reports/clothing-esquire3-final-result-2026-10-29.json).
The business owner approved this additional historical payment; the same
development-only provisional full-installment expense policy applies. No actual
principal/interest allocation was inferred, and production remains untouched.

| Current Working Figure                         |           PHP |
| ---------------------------------------------- | ------------: |
| Paid post-cutover dues, ten occurrences        | **83,423.41** |
| Reported Cash                                  | **87,997.67** |
| Dated-event Cash before unposted delivery fees | **83,666.67** |
| Stock on Hand, unchanged                       |     71,803.15 |
| Assets on the same provisional report basis    |    539,443.15 |
| Liabilities, unchanged by Esquire 3            |    543,911.80 |
| Equity on the same provisional report basis    |     -4,468.65 |

Cash/equity are lower by exactly PHP11,333.33; Owner Draw remains PHP104,954.10
and is still unverified. Do not reduce the draw merely to restore a target cash
figure. The previously documented cash fallback, missing principal, stock and
delivery-timing issues remain open; the new negative working equity is not a
verified actual net-worth assessment. Pre-cutover paid installments remain
excluded from this cash window, and October 29/30 payments remain unconfirmed.

The [separate post-Esquire-3 snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29-post-esquire3.json)
and [separate analysis](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29-post-esquire3.json)
preserve the earlier snapshots. Exact checks prove all 24 other audited source
tables and every pre-existing journal/template/draft row are unchanged. Only
one template, one draft and two journal lines were added. Inventory analysis and
Stock on Hand match the previous analysis exactly; paid dues and cash changes
passed Decimal assertions. Read-only final-payment verification also passed.

### Validation Status

- Guardrails, lint and typecheck passed during this operation; lint retains existing unrelated warnings. The guardrail's generated LIV-1 date-only change was removed after checking the prior clean baseline.
- Unit suite passed: 367 files, 4,532 tests. Application TypeScript/runtime code was not changed by the later Esquire 3 addendum; its operations script passed preview, rollback and committed-state checks.
- Integration suite ran only against `localhost:5433/business_management_test`: 70 passed, 20 failed across five files. Captured failures report Prisma P2022 for missing `inventory_movements.costBasis` in that isolated test database. No owner database reset, migration or schema repair was attempted. This gate is NOT passing.
- No production build, coverage run, hardening suite or browser E2E was run. No shared application logic, auth or browser behavior changed. The backup was archive-validated, not restore-tested. Cash, physical stock and actual debt balances remain unreconciled.

## 15. Production Historical Refund Correction

The owner confirms the Onesie Dress buyers were already refunded in March 2026. The October 27 cancellations were entered late because they had been
overlooked. The absence of payout rows is a missing historical accounting
record, not evidence that the buyers still need to be paid. Any correction
must record the already-completed refunds without initiating another payment.

The production preflight found the same 11 cancellation approvals totaling
PHP2,568.50, with 22 active `CUSTOMER_CANCELLATION` journal lines still dated
October 27 and no payout rows. The approval debits are PHP2,398.50 Customer
Deposits and PHP170 Sales Returns (order 2256); credits are PHP2,568.50 Refunds
Payable. Preserve the October entry/status audit trail and before-images when
correcting the historical effective dates. Do not include other Onesie Dress
orders merely because their notes mention refunds.

The owner subsequently confirmed **March 1, 2026** as the effective date for
these 11 cancellations and already-completed refunds, and **GCash** as the
refund method. This resolves the date/method questions for the production
correction. `Other` in development remains the earlier unconfirmed simulation
value, not the approved production channel. Stock corrections remain a
separate, unapplied work item.

A full logical production backup was taken before any proposed write:
`/home/ron/business-management-system-data/production/backup/clothing-accounting-corrections-20261029/business_management_production_pre-clothing-corrections_20261028T195438Z.dump`.
It is 52,712,614 bytes with mode 600; SHA-256:
`0bf1e720a7d2b7361f2c8ea5960da353612836b1e7e8b71f038fc997e45560ef`.
The archive listing and checksum were verified, including the affected tables.
Its subsequent full restore into an isolated PostgreSQL container succeeded.
This dump does not include PostgreSQL roles/globals.

The [historical-refund correction script](../../scripts/tmp/reconcile-clothing-historical-refunds-2026-10-29.cjs)
was prepared and validated in development. It defaults to a production
read-only preview. Its write path requires exact before-images, a fresh backup,
and a rehearsal certificate bound to the script and plan checksums. The
correction uses a serializable transaction, an operation advisory lock,
fail-fast table locks and pre-commit verification of corrected rows and 20
protected sources. It records the existing customer-money service's keyed
refund/payout/request structure; no duplicate stored payout journal is added.

### Fresh Backup And Rehearsal

A fresh full production backup was taken in the same private directory:
`business_management_production_pre-historical-refunds_20261028T202433990Z.dump`,
52,725,455 bytes, SHA-256
`b2c3c47258e44a24b5c79b8b4f569da39694930f80a77330914d7a68c0707005`.
Its exact before-image plan is
`production-historical-refund-plan_20261028T202433990Z.json`.
The adjacent `.rehearsal.json` certificate records successful fresh-backup
restore, forced rollback, injected failure on the final refund, commit,
idempotent retry and exact undo. All protected-source checks passed. The
initial backup manifest predates that restore test; the later certificate is
the restore evidence. Rehearsal used a disposable PostgreSQL container with no
network access or published ports, not the existing development/test databases.

### Approved Apply And Result

The owner asked whether Git push/pull was needed first. The deployed refund
service files were verified byte-identical to development, and Git does not
transfer database corrections. After being told about the validation caveats
below, the owner explicitly selected **Proceed with the refund correction now**.
The script, plan, backup checksum, backup age and production preconditions were
reverified before execution.

Operation `CLOTHING-HISTORICAL-REFUNDS-20261029` committed on October 29 at
04:29 Asia/Manila (execution evidence `2026-10-28T20:29:02.734Z`). Exactly:

- 11 cancellation decision dates and their saved request-result dates changed from October 27 to March 1, 2026.
- 22 approval journal effective dates changed to March 1; accounts, amounts, references, original creation dates and all other original fields except update timestamps were preserved.
- 11 linked historical refund records, 11 GCash payout records and 11 keyed payout requests record PHP2,568.50 already paid on March 1. No new money transfer or goods return occurred.
- Pending balances for these 11 approvals are PHP0.00. Their approval/payout sources net Refunds Payable to zero, with no October approval lines or payout sources.
- Original customer receipts, order rows/status history, inventory, investor funding, openings, purchases, Owner Draw, recurring records and unrelated journal/refund/request rows passed all 20 protected-source checks unchanged.

Affected orders: 2245, 2246, 2248, 2249, 2251, 2252, 2254, 2255, 2256, 2257
and 2258. Other Onesie Dress orders were not included. Independent PostgreSQL
read-only verification confirmed all counts, dates, GCash methods, the balanced
approval journal, zero pending balances and the preserved October creation
dates. This is source-level reconciliation, not an authenticated report-screen
or whole-balance-sheet certification.

Private before/after execution evidence is retained beside the backup as
`production-historical-refund-plan_20261028T202433990Z.json.20261028T202902734Z.applied.json`.
Do not restore the full backup over subsequent work. Any reversal needs a
separately approved, exact-record procedure using the retained before-images.

### Validation And Remaining Scope

Lint, typecheck and all 4,541 unit tests passed. Guardrails failed on the
previously committed recurring UI's 1,021-line panel and a blocked test cast;
those files were not changed during this correction. Integration remains
failing: 70 tests passed and 20 failed against the isolated test database,
including missing `inventory_movements.costBasis` and
`split_batch_components.acquisitionUnitCost` columns. No tests were disabled,
guardrails bypassed or test schema repaired. The guardrail-generated date-only
report delta was removed after inspection. Private quality logs remain beside
the backup and before-images. No production build or browser E2E was run.

Accountable owner: the requesting Clothing business owner. Approved invariant:
record only these already-paid March 1 GCash refunds and correct their late
approval dates without another payment or unrelated data changes. The guarded
one-off transaction enforces that scope; existing application services and
UI/API/job/import behavior are unchanged. Other domains are unaffected because
no shared rule, schema or other-domain data changed. This approved historical
correction is not a general exception to immutable approval/payout history.

At the end of the refund batch, production stock corrections remained
unapplied; section 16 records their subsequent separate approval and execution.
No recurring payment data, push, pull, commit, schema migration or deployment
was included. The recurring UI rollout still needs its separate guardrail
failures resolved.

## 16. Production Seven-Product Old-Stock Write-Off

The owner requested zero available stock for the seven products in section 4,
confirmed that Premium Short's six damaged units should also be scrapped, and
explicitly selected **October 11, 2026** as the write-off effective date. After
reviewing the exact quantities, protected records and validation caveats, the
owner selected **Apply this seven-product correction**.

Supplier Short was not the appropriate final record for old stock that had
already been received. Girls Onesie's mistaken net 1,180-unit manual shortage
exceeded its catalog baseline; the application floors that intermediate supply
at zero before adding transferred stock. As a result, it still showed 590
available units. Reversing the mistakes restores its correct 591-unit disposal
basis. The same canonical projection recovers one Romper unit and one Chickpea
unit hidden by that clipping behavior. Genuine transfers and additionals are
not supplier shortages and were preserved.

### Applied Scope And Results

Operation `CLOTHING-OLD-STOCK-ZERO-20261029` committed on October 29 at
04:51 Asia/Manila (execution evidence `2026-10-28T20:51:11.833Z`). It added
exactly 13 inventory movements in one serializable transaction:

- Five opposite movements reverse only the identified mistaken zeroing rows: Girls Onesie 5455, 5458 and 5459; Chickpea 5470; Romper 5502. Each reversal uses the original movement's effective date. No original row was changed, deleted or soft-deleted.
- Eight scrap movements dated October 11 record seven sellable disposals plus the separately approved six-unit Premium Short damaged disposal. Total scrapped: **782 units**, comprising 776 sellable and six damaged units.

| Product                       | Scrapped | Sold Preserved | Reserved Preserved | Ending Sellable | Ending Damaged |
| ----------------------------- | -------: | -------------: | -----------------: | --------------: | -------------: |
| Girls Onesie (GO-091526)      |      591 |            360 |                 50 |               0 |              0 |
| Baby Pants (BP-022326)        |       34 |            110 |                  0 |               0 |              0 |
| Sleeveless Onesie (SO-020726) |       60 |            177 |                  0 |               0 |              0 |
| H&M Shorts (HMS-012826)       |        2 |             27 |                  0 |               0 |              0 |
| Premium Short (PS-012426)     |        9 |            700 |                  0 |               0 |              0 |
| Romper (R-012426)             |       21 |            285 |                  0 |               0 |              0 |
| Chickpea Onesie (CO-081026)   |       65 |            516 |                  0 |               0 |              0 |

Both the deployed Inventory page's canonical calculation and an independent
PostgreSQL read-only ledger query verify these ending quantities. Manual
Supplier Short is zero for all seven. Girls Onesie's 50 units for order 3545
remain reserved, not available or scrapped. Negative raw `supplier_short`
offsets from genuine transfers/additionals were not falsely cleared.

All 24 protected-source checks passed unchanged, including products/catalog
quantities, transactions, every original inventory movement, receipts/refunds,
the completed March refund correction, journal lines, openings, purchases,
investor funding and recurring records. Other product projections also match
their before-images. No sale, reservation, receipt, transfer or additional was
rewritten. No catalog zeroing, ledger resync, stock valuation, opening rebuild,
cost invention, cash posting, schema migration or application change occurred.
This verifies the scoped quantity correction, not the entire stock valuation
or balance sheet; no authenticated browser report was inspected.

### Backup And Execution Evidence

The [one-off stock correction script](../../scripts/tmp/reconcile-clothing-stock-zero-out-2026-10-29.cjs)
defaults to read-only preview. Before production apply it requires the exact
plan, unchanged script/backup checksums, a backup less than one hour old, and
successful isolated rehearsal. Advisory and fail-fast table locks protect the
single transaction; exact original-row and inserted-content checks run before
commit. All execution notes and before-images are retained privately beside
the section 15 backups.

Applied backup: `business_management_production_pre-stock-zero_20261028T204323880Z.dump`,
52,737,916 bytes, SHA-256
`84bb6bfa529bece958cd83ffbd355cfa437ebc540facfcdda8ba2159d50610c6`.
Exact before-image plan: `production-stock-zero-plan_20261028T204323880Z.json`.
Its adjacent `.rehearsal.json` certificate records successful full restore into
an isolated no-network/no-port PostgreSQL container, forced rollback, injected
failure on the final scrap row, commit, idempotent retry and exact undo.
An initial rehearsal stopped on an ambiguous duplicate note; unique product
notes fixed it before the successful fresh-backup rehearsal or production write.

Production execution record:
`production-stock-zero-plan_20261028T204323880Z.json.production.20261028T205111833Z.applied.json`.
Keep the backup, before-images and original movement history. Any reversal
requires a separately approved exact-record operation; do not restore the full
database over later work or resync these products back to catalog quantities.

### Validation And Policy Record

Lint, typecheck and all 4,541 unit tests passed. Guardrails retain the existing
recurring UI's oversized panel and blocked test-cast failures. Integration
remains 70 passed / 20 failed on the stale isolated test schema, including the
missing cost-basis and split acquisition-cost columns; it was not reset or
migrated. `inventory:ledger:controls` and the separately run drift check fail
on wider pre-existing development ledger negatives and catalog/ledger drift.
The accounting sanity command completed with 21 existing issues, not a clean
data certification. Private `stock-quality-20261028T204443307Z` logs retain the
actual results. No tests were disabled, guardrails bypassed or unrelated data
repaired. The generated date-only guardrail report delta was removed.

Accountable owner: the requesting Clothing business owner. Approved invariant:
write off exactly these old-stock quantities as of October 11, undo only the
identified zeroing mistakes, and preserve sold/reserved demand and unrelated
data. The enforcement boundary is this guarded one-off transaction, using the
existing movement shape and canonical Clothing inventory projection. UI, API,
jobs/imports and other domains have no code or policy changes. This is a
specific historical correction, not permission to backdate future disposals.
No commit, push, pull, deployment or recurring-payment data was included.

## 17. Production Deposit Check And Provisional Opening Valuation

### Evidence And Owner Confirmations

This phase is read-only production analysis, not another correction apply.
The private production snapshot was captured at 2026-10-28T21:21:40.776261Z
(October 29 in Manila), using a repeatable-read, read-only transaction. Its
filename is `production-deposits-opening-stock-readonly_20261028T212141070Z.json`
in the existing private correction evidence directory; SHA-256 is
`c0305a97f9a54a13cd2fe7afd2b04a05af09aa0f8f42d389abc799d182828e64`.
The analysis uses the production October 12 cutoff through October 29.

- The owner has posted investor funding through the UI. Active October 12
  `INVESTOR_FUNDING` lines for `INV-CR-2026-003` debit Cash PHP 500,000 and
  credit the investor loan payable PHP 500,000. Do not duplicate this funding
  or classify it as income or Opening Equity.
- The owner confirms order 3399 is already sold, fully paid and held pending
  customer checkout. Its 60 units remain Prepared/reserved operationally;
  do not invent another receipt, customer receivable or dispatch event.
- The owner confirms orders 2247 and 2250 were already refunded before modern
  refund tracking. Their PHP 163.50 receipts each are not outstanding customer
  deposits. Exact refund dates/methods remain unverified; do not repay them or
  borrow dates/methods from the separate eleven-refund correction.
- For that reviewed historical population only, the old PHP 3,049.50 simulation
  deposit opening reduces to zero after PHP 2,398.50 historical refunded
  deposits, PHP 324 for order 3399 and PHP 327 for orders 2247/2250. This does
  not mean current post-cutover customer deposits are zero.

### Current Customer Deposits

The report calculation was reproduced using its reservation-payment,
recognition, forfeiture, refund, manual-journal and opening filters. Manual,
opening and direct-refund contributions are zero for this reporting window.

| Population              | Orders | Customer Deposits (PHP) |
| ----------------------- | -----: | ----------------------: |
| In Transit              |    115 |               47,429.00 |
| Prepared: order 3471    |      1 |                  345.00 |
| Voided: order 3494      |      1 |                  255.30 |
| Reproduced report total |    117 |               48,029.30 |

The arithmetic matches the displayed PHP 48,029.30 exactly, but this is not
an unconditional certification of the liability classification:

- Order 3471, Marl Eisler Antonio / Nicole Sacristan, is fully paid at
  PHP 3,450: PHP 345 reservation on October 14 plus PHP 3,105 on October 29.
  It remains Prepared without dispatch. If the owner's treatment of order
  3399 applies here too, its PHP 345 should no longer remain a deposit;
  the conditional balance would be PHP 47,684.30, including order 3494.
- Order 3494, TIN SOLIS / Christine Abigail Solis, received PHP 255.30 on
  October 17 and was Voided that day. There is no active refund or cancellation
  record. Confirm whether the amount remains refundable, was refunded, was
  transferred to another order or was validly retained. Voided status alone
  is not evidence that the liability was discharged. PHP 47,429.00 is the
  In Transit subtotal, not an approved replacement balance.

### Opening Stock Worksheet: Conditional, Not Approved For Posting

Private generated stock-analysis, item-review and opening-stock worksheets
are retained beside the snapshot. The `opening-stock-worksheet-v2.json` suffix
identifies the corrected bridge; it supersedes the earlier worksheet that
omitted PHP 14.42 of post-cutover stock additions. Historical simulations and
the earlier worksheet are not posting authority.

| Catalog/report bridge                                               |         PHP |
| ------------------------------------------------------------------- | ----------: |
| Selected legacy ending stock, including PSO                         |   76,065.53 |
| Add period report COGS                                              |  125,430.17 |
| Add recorded shrinkage                                              |        7.21 |
| Deduct post-cutover stock additions                                 |     (14.42) |
| Reconstructed combined opening before transit/ownership review      |  201,488.49 |
| Remove PSO period COGS from physical opening                        | (30,888.00) |
| Remove PSO ending stock from physical opening                       |  (4,276.80) |
| Physical-opening bridge before order 3399 adjustment                |  166,323.69 |
| Remove order 3399: 60 units at catalog unit cost PHP 40.07          |  (2,404.20) |
| Conditional physical opening after that single ownership adjustment |  163,919.49 |

The Decimal reverse-rollforward reproduces PHP 73,661.33, the selected ending
stock less order 3399's catalog cost. This checks arithmetic only, not stock
ownership, quantities, historical valuation or recoverability.

Remaining posting blockers:

- A scoped scan found 36 current Prepared orders fully paid before October 12,
  including order 3399. The other 35 need ownership and inventory-projection
  review. The table adjusts only the specifically owner-confirmed order 3399;
  PHP 163,919.49 is not a comprehensive sold-but-held adjustment or final opening.
- The owner says PSO was paid in September and arrived October 13. It belongs
  in an October 12 in-transit opening, not physical Stock on Hand. The database
  receipt shows 700 units with posting date October 12, whereas the catalog
  and sold/reserved projection use 740. The 40-unit and date differences remain
  unresolved; do not fabricate another receipt.
- PSO supplier grand total is PHP 30,636.64. Saved costing is PHP 35,166.64,
  including PHP 1,530 forwarder, PHP 1,500 courier and PHP 1,500 packaging.
  The owner confirmed PHP 1,530 KPC and PHP 950 courier. Supplier cost plus
  those two charges is PHP 33,116.64, but packaging and charge-incurrence/payment
  dates are not verified. Neither this sum nor the saved landed total is a
  certified October 12 in-transit opening. Do not backdate post-cutover freight
  automatically. Rounded PSO catalog valuation also differs from saved COGS.
- The selected ending projection includes PHP 3,971.19 damaged stock and undated
  catalog items. Recoverability and opening quantities require evidence. The
  shared cost engine reports 15 legacy-cost warnings; wider diagnostics show
  62 product quantity drifts and 51 negative sellable buckets. These diagnostics
  are not repaired by making an opening journal balance.

Validation: the deposit total cross-foots exactly; PSO COGS was recalculated
through the shared movement-cost engine at PHP 30,888.00; Decimal assertions
check the corrected opening and reverse-rollforward. The item-review artifact
contains 36 selected stock rows plus the held-order review population. No
application behavior, operational status, money movement, opening posting,
database row, schema or other business domain changed. No refund/write-off
operation was reapplied. Application quality gates were not rerun for this
read-only analysis and documentation-only addition; prior gate results above
remain historical, not a new clean certification.

### Subsequent Owner Clarification: Orders 3494, 3495 And 3471

The owner identifies TIN SOLIS / Christine Abigail Solis order 3495 as the
correct 30-unit PSO order, with PHP 207 received and current status Forfeited.
The owner believes Voided order 3494 was an erroneous or duplicate entry,
not an additional customer obligation. The recorded sequence supports this:
3494 was voided at `2026-10-17T05:13:58.020`; 3495 was created about nine
seconds later, at `2026-10-17T05:14:07.135`. These are stored timestamps;
the sequence alone does not establish whether an extra cash receipt occurred.

- Order 3494 still has active Cash reservation payment 1694 for PHP 255.30,
  dated October 17. Voiding the order did not remove this payment, which is
  why the report still counts PHP 255.30 as Customer Deposits. Before a data
  correction, confirm whether this payment row itself is erroneous, or whether
  money was actually received and refunded/transferred. The owner's duplicate
  explanation is tentative; do not convert it into a confirmed refund.
- Correct order 3495 has separate Cash reservation payment 1695 for PHP 207,
  dated October 17, and became Forfeited on October 22. The report already
  classifies this receipt as forfeited, outside Customer Deposits. Preserve it;
  do not subtract PHP 207 again or forfeit the disputed PHP 255.30 as well.
- The owner confirms order 3471, Marl Eisler Antonio / Nicole Sacristan, is
  fully paid and only awaiting checkout/pickup. Its recorded payments already
  total PHP 3,450. Reconcile this specific sold-but-held order consistently
  with owner-confirmed order 3399, without inventing dispatch or another cash
  receipt. Its PHP 345 reservation is not an outstanding deposit under that
  owner-confirmed treatment. This does not resolve the other 35 pre-cutover
  Prepared orders or authorize a global recognition-rule change.

The working deposit bridge is PHP 48,029.30 minus PHP 345 for order 3471,
giving PHP 47,684.30 while the disputed receipt remains unresolved. If payment
1694's PHP 255.30 is confirmed to be an erroneous receipt, the reconciled
target becomes PHP 47,429.00. Removing a nonexistent receipt would affect
reported cash as well as deposits; a deposit-only balancing journal or a
fictional refund would not correct that source error.

This clarification adds no October 12 stock opening. Order 3471's final
payment is post-cutover; its sold-but-held inventory/COGS treatment belongs
in the period, without changing PSO's September purchase/October arrival
history. The physical-opening worksheet remains conditional on the ownership,
quantity and cost reviews above. No production payment, status, inventory,
journal, opening or money movement was changed in this follow-up.

### Owner-Confirmed False Receipt: Correction Prepared, Not Applied

The owner subsequently confirms that order 3494's PHP 255.30 was an incorrect
entry and should be corrected. No money was received for payment 1694. This
resolves that receipt question: do not record a refund, forfeiture or transfer
for this nonexistent receipt. Preserve correct order 3495 and its actual
PHP 207 forfeited receipt, and preserve both orders' status history.

The [scoped correction script](../../scripts/tmp/reconcile-clothing-false-receipt-2026-10-29.cjs)
defaults to read-only preview. The intended single transaction soft-deletes
payment 1694, preserving its original amount/date/method, and resynchronizes
order 3494's adjustment to zero and lineTotal to PHP 2,070 while preserving its
Voided status. This follows the payment-deletion projection shape without
weakening the normal API's prohibition on deleting cancelled financial history.
It is a specifically owner-approved historical false-entry correction, not a
general deletion policy. Accountable owner: the requesting Clothing owner.

The script checks exact target before-images and content hashes for 133 public
and general-merchandise tables. Other orders/payments, inventory, journals,
refunds and earlier corrections must remain unchanged. Existing audit rows
are protected through a captured timestamp boundary; later normal audit appends
are allowed. The one-off does not change application UI/API/job/import rules,
permissions, schema or other domains. Direct SQL does not generate an app audit
event; private before/after evidence and this log are required instead.

Latest fresh full production backup:
`business_management_production_pre-false-receipt_20261028T214700569Z.dump`,
52,808,668 bytes, mode 600, SHA-256
`761ecd1bd777264804a6ff55744557712e7c4794203bd7c2489f493a2cdc11a8`.
Its plan is `production-false-receipt-plan_20261028T214700569Z.json` in the same
private correction evidence directory. Archive/checksum validation and full
isolated restore passed; the restored protected data matched the before-image.
Earlier preparation backups remain retained, not restored over production.

The rehearsal then stopped before its first correction transaction could
acquire the fail-fast lock on `public.audit_logs`. No successful correction,
rollback/failure/retry/undo certificate or production apply exists for this
batch. The disposable container was removed by the cleanup path. Earlier
preparation attempts exposed the large-table JSON aggregate limit, normal
audit appends and temporary PostgreSQL startup readiness; corresponding local
fixes passed preview, but the complete rehearsal remains blocked. The draft
script is not certified for production. Application quality gates have not
been rerun for this unfinished batch; prior passing results are not a current
certification. Do not apply until rehearsal and required validation succeed.

Receipt-only expected effect: reduce reported Cash and Customer Deposits by
PHP 255.30, with no real money movement. Against the captured PHP 48,029.30
deposit baseline this would display PHP 47,774.00, not PHP 47,429.00. The latter
also requires the separate PHP 345 sold-but-held reconciliation for order 3471,
which this receipt script intentionally does not perform. No production row,
opening stock, investor funding or operational order status has changed.

## 18. Production False-Receipt Correction Applied And Verified

This section supersedes section 17's blocked execution status, not its retained
before-images or the remaining sold-but-held/stock-valuation qualifications.
The owner confirmed that PHP 255.30 on payment 1694/order 3494 was an incorrect
entry, not money received, and requested correction. After the initial blocked
rehearsal was disclosed, the owner explicitly said to proceed with troubleshooting
and the approved correction. No refund, forfeiture or money transfer is justified
for this nonexistent receipt.

### Rehearsal Fix And Fresh Backup

A diagnostic on the isolated restored database identified `autovacuum: VACUUM
ANALYZE public.audit_logs` holding `ShareUpdateExclusiveLock`. The script's
`NOWAIT` lock failed immediately despite a configured three-second lock timeout.
Removing `NOWAIT` preserves `SHARE ROW EXCLUSIVE` table locks and allows that
existing bounded timeout to handle transient maintenance. No production
maintenance, permission, API deletion protection or lock strength was changed.

Fresh full logical production backup in the private correction evidence
directory: `business_management_production_pre-false-receipt_20261028T215320933Z.dump`,
52,810,308 bytes, mode 600, SHA-256
`5b0278058bcf26ea814cc368f5fa33d594b6a665908262928a1a38a135aed3e5`.
Plan: `production-false-receipt-plan_20261028T215320933Z.json`.
The adjacent `.rehearsal.json` certificate is bound to the script, plan and
backup hashes. Full isolated restore, forced rollback, injected final-row
failure, successful commit, idempotent retry and exact undo all passed.
The disposable no-network/no-published-port container was subsequently removed.
Earlier backups and failed-attempt evidence remain retained.

### Approved Apply And Independent Verification

Operation `CLOTHING-FALSE-RECEIPT-1694-20261029` committed October 29 at
06:07 Asia/Manila (execution evidence `2026-10-28T22:07:25.402Z`). In one
serializable transaction it:

- Soft-deleted only false receipt 1694 for PHP 255.30, with deletion/update
  timestamps. The original amount, date, Cash method, reservation flag, notes
  and creation timestamp remain preserved for traceability; no hard delete.
- Resynchronized order 3494 to adjustment PHP 0 and lineTotal PHP 2,070,
  updating only its projection/update fields. It remains Voided, not a new
  customer obligation. Customer/product identity, quantity, unit price, original
  dates and operational/status history remain unchanged.
- Preserved valid order 3495, its PHP 207 receipt 1695 and Forfeited status.
  Order 3471 remains Prepared, fully paid PHP 3,450 and awaiting pickup; neither
  its PHP 345 deposit classification nor inventory was changed by this batch.

Exact protected-state checks passed across 133 tables, excluding only the
specified payment/order fields from their whole-table hashes. All unrelated
payments/orders, existing audit history through the recorded cutoff, journals,
refunds/payouts, inventory, purchases, funding, openings, recurring records and
earlier approved correction records were unchanged. Later normal audit appends
are allowed, not mistaken for mutations to preserved history.

The script's post-apply verification and independent repeatable-read/read-only
SQL checks passed. The active reservation receipts in the previously reconciled
deposit population cross-foot to **PHP 47,774.00**, down PHP 255.30 from
PHP 48,029.30. Reported Cash is reduced by the same false receipt amount; no
cash was actually paid out. This is source-level verification, not a fresh
authenticated report-screen or entire balance-sheet certification.

Private evidence beside the plan:

- `production-false-receipt-plan_20261028T215320933Z.json.20261028T220725402Z.applied.json`
- `production-false-receipt-plan_20261028T215320933Z.json.independent-verification.json`

Do not reapply as a new correction or restore an older whole backup over later
work. Retain the scoped script and evidence for this active reconciliation;
archive or remove the temporary script when its operational review is complete.
Any undo requires separate approval and exact-record review.

### Validation And Remaining Work

Quality evidence prefix: `false-receipt-quality-20261028T220110704Z` in the
private correction directory. Lint and typecheck passed. Unit tests passed:
369 files, 4,541 tests. Guardrails retain the earlier recurring UI violations:
the 1,021-line panel and blocked test cast. Integration on isolated
`localhost:5433/business_management_test` remains 70 passed / 20 failed,
including missing `inventory_movements.costBasis` and
`split_batch_components.acquisitionUnitCost` columns. These are not passing
gates; no test was disabled, schema reset/migrated or guardrail bypassed.
The guardrail-generated date-only report change was removed. No production
build, browser E2E, hardening suite or deployment was run.

The requesting Clothing owner is accountable for the approved invariant:
remove exactly the confirmed nonexistent receipt from active accounting and
resynchronize its Voided source order without another payment or unrelated
financial/inventory change. The guarded one-off script is the enforcement
boundary; normal UI/API/job/bulk/import rules remain unchanged. Other domains
and shared runtime code have no policy or data change. This is an approved
historical data exception, not permission to delete genuine cancelled receipts.

Order 3471's separate PHP 345 sold-but-held classification would bring the
working deposit total to PHP 47,429.00, but that correction is not part of this
applied operation. Opening stock remains unposted and conditional on section
17's ownership, physical quantity and cost evidence. No opening rebuild, stock
resync, duplicate investor funding, commit, push, pull or deployment occurred.

## 19. Future Policy Review: Fully Paid Is Not Necessarily Completed

Status: logged for future Clothing policy review, not an implemented rule or
authorization for another production correction. Accountable policy owner:
the requesting Clothing business owner. The owner clarified that buyers may
pay in full before pickup and later request a refund because of an emergency;
full payment alone must not automatically mark an order completed.

This clarification supersedes the earlier recommendation to remove order
3471's PHP 345 from Customer Deposits merely because it is fully paid. The
previous PHP 47,429.00 target is a historical scenario, not an approved revised
balance. The verified PHP 47,774.00 remains the report's current calculation
after the false-receipt correction, not certification of every receipt's
economic classification. No recognition correction has been applied to 3471.

### Proposed Model And Decisions Required

- Separate payment status, fulfillment status and accounting recognition.
  A proposed display is `Fully Paid - Awaiting Pickup`, with PHP 0 outstanding
  while the operational order remains Prepared. This need not introduce a new
  stored order status; review the existing model before choosing implementation.
- Define the event that transfers control and recognizes the sale: pickup,
  delivery, dispatch under agreed terms, or an explicitly supported held-goods
  arrangement. Neither full payment nor refund eligibility alone decides this.
  A completed sale can also have a later refund under its applicable terms.
- If recognition has not occurred, review all advance receipts, including
  ordinary installments, as potential customer-advance liabilities. Do not
  assume only payments tagged Reservation Deposit need deferral. On recognition,
  apply the advance once, recognize revenue and the matching inventory/COGS
  effects without another cash receipt or a fabricated dispatch event.
- Keep cancellation approval, refundable/retained amounts and actual payouts
  separate. A requested refund is not automatically approved or paid; retain
  the existing keyed financial history and explicit refund-policy requirements.

### Order 3471 And Follow-Up Scope

Order 3471 has PHP 345 reservation plus PHP 3,105 final payment, totaling
PHP 3,450, with PHP 0 outstanding; it is Prepared and awaiting checkout/pickup.
Before reclassification, trace both receipts across journal, ledger, P&L and
balance sheet. If it is still an advance, potentially the full PHP 3,450 belongs
in the liability, not just PHP 345. This is a review scenario, not a posted
amount or confirmation of a new total. Do not delete either genuine payment.

Revisit order 3399's previously proposed sold-but-held opening-stock exclusion
and the other 35 fully paid pre-cutover Prepared orders under the eventual
approved recognition policy; do not assume payment completeness proves stock
ownership has transferred. The opening-stock worksheet remains provisional.
The completed false-receipt, historical-refund and seven-product write-off
corrections are separate and are not reversed by this policy discussion.

Before implementation, approve the recognition and refund terms, update the
canonical Clothing accounting/inventory contracts and review UI, direct/bulk
collections, order transitions, cancellations/refunds, imports/jobs and report
consumers. Check General Merchandise explicitly rather than automatically
applying Clothing policy across domains. Validate partial/full advances,
fulfillment, held goods, refunds before/after recognition, historical cutoffs,
retry and concurrency without duplicate cash, revenue, deposit release or COGS.
This entry changes documentation only; no application behavior, schema,
operational status, accounting entry or production data was changed.

## 20. Inventory Quantity Reconciliation Defect: PSO 740 Versus Receipt 700

Status: confirmed record/projection inconsistency; root cause and repair pending.
The owner requested that this be documented for future investigation and repair.
This is not approval to add stock, resync the ledger or post opening balances.

### Evidence And Current Behavior

- The owner's Clothing Inventory screenshot shows PSO-101226 (product 290),
  shipment KPC 23930A-236, Delivered: P.O. Quantity 740, Actual Quantity 740,
  Sold 650, On-Hand Reserved 90 and On-Hand Sellable 0. The page does not show
  a 700-unit receipt or a 40-unit physical shortage.
- The retained production snapshot from section 17 contains movement 5225,
  `auto-receipt product 290`, quantity 700, from `opening_inventory` to
  `sellable`, posting date October 12. The owner previously confirmed arrival
  October 13. Both quantity and effective-date differences need investigation.
- [The Clothing inventory projection](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts#L358)
  derives received supply from saved product Quantity plus additionals and
  conversion adjustments, less supplier-short and damaged quantities. It does
  not derive that base from the recorded receipt total. Thus the UI's 740 and
  the receipt's 700 can coexist; their disagreement is not a new stock count.

This is a reconciliation defect to resolve, not proof that the current receipt
writer is faulty or that either 700 or 740 is physically correct. Possible
causes include legacy/import data, a later catalog edit or a receipt-generation
gap; none is established yet. Ordered quantity and received quantity can also
legitimately differ for partial deliveries. Do not equate every such difference
with corruption or make the ledger authoritative without reviewing its history.

### Investigation And Fix Acceptance

- Trace product 290's original quantity, subsequent edits/imports, receipt
  creation and delivery-date changes. Verify physical receipt evidence, then
  identify the owning write/enforcement boundary rather than patching the UI
  alone. The accountable business owner is the requesting Clothing owner;
  confirm the quantity definitions and repair plan with that owner.
- Define ordered, received, reserved, sold, damaged and available quantities
  explicitly. Make UI, movement history and accounting/COGS explainable against
  the same approved events, while preserving legitimate partial receipts and
  domain differences. Surface unresolved mismatches rather than silently
  treating a purchase-order quantity as proof of physical receipt.
- Check create/edit, receipt/delivery, adjustments, bulk/import, jobs and retry
  paths for missing or duplicate movements. Review General Merchandise and
  shared consumers explicitly; this Clothing finding is not evidence that all
  other domains have the same defect.
- Test the PSO 740-versus-700 case, partial deliveries, quantity edits,
  reservation/sale rollforwards, effective dates, rollback, idempotent retry and
  concurrent receipt/update operations. Preserve the earlier seven-product
  write-off and all genuine sales/reservations; do not revive disposed stock.
- Any historical repair needs a separate reviewed scope, fresh backup,
  before-images and verification. Do not fabricate an additional 40-unit
  receipt, delete history or create cash merely to force agreement. Revalidate
  opening stock and affected COGS after the approved quantity/cost repair.

Only this documentation item was added. No application fix, production query,
database correction, physical shortage declaration or opening posting occurred.

## 21. Working October 12 Opening Inventory Valuation

The owner requested proceeding with valuation and subsequent reconciliation.
Use the following as a provisional worksheet basis, not an approved or posted
opening balance. This carries forward section 17's corrected bridge while
keeping sections 19-20's recognition and receipt issues explicitly unresolved.

| Component                                                 |    Working PHP | Basis                                                                                                                |
| --------------------------------------------------------- | -------------: | -------------------------------------------------------------------------------------------------------------------- |
| Physical Stock on Hand before held-order ownership review |     166,323.69 | Corrected reverse-rollforward, excluding PSO period COGS and remaining PSO stock                                     |
| PSO Inventory in Transit                                  |      30,636.64 | Saved supplier grand total; owner confirms September payment and October 13 arrival; assumes ownership at October 12 |
| Combined working opening inventory                        | **196,960.33** | Physical stock plus supplier-cost-only PSO transit basis, subject to the qualifications below                        |

The physical bridge is PHP 76,065.53 ending stock + PHP 125,430.17 period
COGS + PHP 7.21 shrinkage - PHP 14.42 post-cutover additions - PHP 30,888.00
PSO period COGS - PHP 4,276.80 PSO ending stock = PHP 166,323.69. Adding PSO's
supplier-cost basis separately avoids treating its October 13 arrival as
physical stock already present on October 12 or another supplier cash payment.
This remains a reconstruction from catalog/report data, not a physical count.

### Qualifications And Next Steps

- Do not automatically deduct order 3399's PHP 2,404.20 cost merely because it
  was fully paid. Retain the PHP 163,919.49 alternative as conditional history;
  resolve its ownership/recognition evidence and the other held orders under
  section 19. Including it in this worksheet does not certify ownership.
- PSO uses the supplier amount, not the saved PHP 35,166.64 landed estimate.
  The confirmed PHP 1,530 KPC and PHP 950 courier charges total PHP 2,480;
  establish when they were incurred and whether they belong in opening transit
  cost or subsequent landed cost. Payment timing is a separate cash question.
  Do not add them to the October 12 opening automatically. Packaging remains
  unverified. Neither excluding these costs here nor their confirmed amounts
  establishes the final accounting valuation.
- Section 20's 740-versus-700 receipt and October 12-versus-13 date differences
  remain unresolved. No physical shortage or additional 40-unit receipt is
  assumed. The worksheet does not resolve wider ledger/catalog drift, legacy
  cost warnings, undated items or the PHP 3,971.19 damaged-stock recoverability
  question. These may change the result; this is not a certified total or range.
- Continue gathering opening cash/bank/e-wallet balances, debt statements,
  actual dues and expense-payment evidence separately. Those steps need not
  wait for an inventory repair, but do not use this stock figure or Owner Draw
  as a plug to force cash or the balance sheet to a target.
- Before posting, resolve material quantity, ownership and cost exceptions,
  revalidate the rollforward and obtain approval for the exact opening records
  and accounts. Preserve the completed refunds, stock write-off and false-
  receipt correction; do not repeat them or add the old PHP 3,049.50 simulation
  deposit opening. Any opening counterpart requires its own reviewed basis,
  not an assumed cash movement or duplicate investor funding.

Validation for this worksheet is exact-decimal arithmetic against the retained
section 17 evidence, not a new production snapshot or full application gate.
Only documentation changed; no opening was posted and no application behavior,
production data, inventory quantity, cash or customer obligation was changed.

## 22. Conditional Cash Bridge From Retained Production Receipts

The owner requested expected cash using stock, deposits, sales, investor funding
and the listed 22 products. Cash must be reconstructed from receipts and payments,
not by adding stock values, sales and the current deposit liability together.
Customer receipts below include reservation and other payments once, regardless
of whether their current accounting classification is deposits or sales.

Source: section 17's retained production snapshot, October 29 at 05:21 Asia/Manila,
adjusted for section 18's subsequently applied false-receipt correction. This is
not a fresh production query or a verified current physical cash count. The
earlier development receipts total of PHP 159,179.30 is not the receipt basis for
this calculation: the production snapshot contains additional payment records.

| Cash bridge, October 12-29 snapshot basis                                                                 |                                PHP |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------: |
| Opening cash before investor funding                                                                      | Unknown, not assumed verified zero |
| Investor funding, counted once                                                                            |                        +500,000.00 |
| Active dated customer receipts, excluding false payment 1694                                              |                        +176,066.00 |
| Twenty confirmed purchase Grand Totals, if cash-paid in the window                                        |                        -379,635.12 |
| Ten previously reviewed paid dues, including final Esquire 3                                              |                         -83,423.41 |
| Payroll previously recorded paid                                                                          |                          -7,500.00 |
| Working cash before delivery fees, withdrawals and other missing outflows, with zero opening cash assumed |                     **205,507.47** |
| PSO KPC and Lalamove charges, owner-confirmed paid at pickup/delivery                                     |                          -2,480.00 |
| Working balance after confirmed delivery payments, subject to the other cash-bridge assumptions           |                     **203,027.47** |

### Owner Confirmation: Delivery Charges Already Paid

The owner confirms that PHP 1,530 KPC and PHP 950 Lalamove were already paid
when PSO was picked up from the KPC warehouse and delivered to the owner's
premises, consistent with the previously confirmed October 13 arrival. This
resolves the earlier uncertainty about whether these charges were paid in the
October 12-29 window. An exact paying account and payment references were not
supplied. Do not deduct these PHP 2,480 again from PHP 203,027.47 or initiate
another payment. Their October 12 opening-cost treatment remains a separate
incurrence/capitalization question; this confirmation does not alter section 21.

PHP 203,027.47 is now the working cash-bridge balance after these paid fees,
not a verified closing cash count. Unknown opening cash, actual withdrawals,
purchase-settlement evidence, additional outflows and later receipts still
affect the final balance. Only this documentation confirmation was recorded;
no database payment, expense approval, accounting posting or money transfer
was created.

The receipt selection contains 172 active-payment rows attached to active orders
in the window before excluding payment 1694: PHP 176,321.30. Removing its false
PHP 255.30 leaves 171 rows / PHP 176,066.00, all recorded as Cash. Order 3471's
PHP 3,105 October 29 payment is already included; do not add it again. The earlier
PHP 4,331 legacy-order cash fallback is not a new receipt and is not included.

The owner's list comprises the same 20 confirmed purchases (products 291-310)
plus never-supplied Burp Cloth and Onesie Dress. The 20 cost PHP 379,635.12 and
are all marked CASH in this production snapshot; the earlier development
CARD-label sensitivity is not this snapshot's saved-method split. Actual cash
settlement dates/accounts still require evidence. Excluding the two never-
supplied items from this purchase basis does not prove they never had supplier
payments or refunds; separately evidenced cash events must still be reconciled.
PSO's September supplier payment is not another October outflow.

Neither the PHP 196,960.33 provisional opening inventory nor current stock/transit
value is added to cash. Do not subtract COGS on top of purchase payments, subtract
customer deposits again as if they were a payout, or duplicate investor funding.
Exclude the already-paid March customer refunds from October cash movements.

Actual expected closing cash equals opening cash plus this net cash bridge,
less verified owner withdrawals, additional paid expenses/refunds/fees and any
other outflows, plus additional genuine receipts after the snapshot. Do not
subtract the unverified PHP 104,954.10 simulation Owner Draw as an actual payment
or treat the difference from a bank/cash count as proof of household spending.
October 29 Esquire 2 and October 30 Eastwest dues remain unconfirmed paid and
are not deducted. This combines cash/bank/e-wallet funds; physical cash on hand
requires account balances and transfer reconciliation separately.

Validation: exact-decimal source aggregation, receipt-identity/date checks,
snapshot integrity and an independent integer-cent cross-check. The dues and
payroll are previously reviewed amounts, not newly verified production postings.
Only documentation changed; no application/database change, payment, posting,
stock resync or production query was performed for this calculation.

## 23. Cash Difference Investigation: PHP 1,335.67 Explained

An enforced repeatable-read, read-only production query at October 29, 2026,
13:58:23 Asia/Manila reproduced the owner's reported Cash PHP 581,326.92.
This is a later check than section 22's snapshot, not a rewrite of that history.

Two differences explain the PHP 1,335.67 exactly:

- Esquire 2's October 29 draft `cmvt2h9sp09zaegnqi00mcz7r` is now APPROVED,
  with approval timestamp 13:35:08 Asia/Manila and a PHP 5,666.67 Cash credit
  dated October 29. Section 22 excluded this then-unconfirmed payment. The
  database posting is verified; actual payment still requires owner/payment
  evidence, and must not be inferred solely from approval status.
- The balance-sheet legacy paid-order fallback adds PHP 4,331 as period Cash
  although the seven orders have no October 12-29 payment events and their
  recorded receipts predate cutover. Section 22 deliberately excluded it.
  This is the existing reporting issue, not another genuine cash collection.

| Legacy fallback order                               | Pre-cutover receipt date |          PHP |
| --------------------------------------------------- | ------------------------ | -----------: |
| 3201                                                | July 29, 2026            |        96.00 |
| 3258                                                | August 21, 2026          |       450.00 |
| 3259                                                | August 21, 2026          |       390.00 |
| 3212                                                | August 21, 2026          |       315.00 |
| 3373                                                | September 4, 2026        |       950.00 |
| 3387                                                | September 22, 2026       |     1,050.00 |
| 3386                                                | September 22, 2026       |     1,080.00 |
| Total inferred by fallback, not new period receipts |                          | **4,331.00** |

The owning report path is
[the balance-sheet transaction projection](../../src/app/api/accounting/balance-sheet/route.ts#L557).
It uses in-window payment events when present, otherwise falls back to normalized
paid-order amounts and a completion/recognition date. These orders completed
after cutover despite having been paid earlier; completion must not be mistaken
for another cash receipt. This investigation does not change recognition policy,
opening cash or historical receipts, and does not implement a runtime fix.

### Reproduction And Revised Conditional Cash Difference

| Current report cash reproduction                                      |            PHP |
| --------------------------------------------------------------------- | -------------: |
| Investor funding                                                      |    +500,000.00 |
| Active dated customer receipts, 171 Cash payments                     |    +176,066.00 |
| Legacy fallback, not genuine period receipts                          |      +4,331.00 |
| Eleven recurring payment Cash credits, including October 29 Esquire 2 |     -89,090.08 |
| Paid payroll expense 800                                              |      -7,500.00 |
| Paid PSO forwarder and courier                                        |      -2,480.00 |
| Reproduced reported Cash                                              | **581,326.92** |

PHP 5,666.67 additional posted payment minus PHP 4,331 fallback = PHP 1,335.67.
Thus section 22's PHP 203,027.47 minus PHP 5,666.67 plus PHP 4,331 equals the
earlier report-based PHP 201,691.80 after the conditional purchase deduction.
The difference is not evidence of an additional owner withdrawal.

Removing the fallback rather than treating it as available cash gives:

| Revised conditional reconciliation                                    |            PHP |
| --------------------------------------------------------------------- | -------------: |
| Reported Cash less PHP 4,331 fallback                                 |     576,995.92 |
| Less twenty purchase payments, assuming paid and not already deducted |    -379,635.12 |
| Working expected Cash before withdrawals and other missing movements  | **197,360.80** |
| Owner-reported funds: PHP 82,783 plus other e-wallet PHP 8,535.40     |     -91,318.40 |
| Unexplained difference, not confirmed Owner Draw                      | **106,042.40** |

This supersedes PHP 110,373.40 as the report-based unexplained-difference scenario:
that earlier number still included the PHP 4,331 fallback. It also updates the
PHP 111,709.07 earlier-worksheet scenario for the newly posted PHP 5,666.67.
Neither is an approved Owner Draw. PHP 106,042.40 assumes zero opening cash,
actual payment of all twenty purchases and the October 29 Esquire installment,
complete comparable cash/bank/e-wallet balances, and no other missing cash events.
If the installment was approved without actual payment, review that exact posting
separately rather than silently counting it as paid or creating another entry.

Validation: the live read-only query cross-footed receipts, cash journal sources,
payroll and seven legacy fallback orders, reproducing the reported Cash exactly.
Focused Decimal and independent integer-cent checks validate both the PHP 1,335.67
explanation and revised conditional arithmetic. No database rows, application
behavior, production files, opening balances or Owner Draw postings were changed.

### Subsequent Owner Confirmation: October 29 Esquire 2 Paid

The owner confirms that the October 29 Esquire 2 installment of PHP 5,666.67
was already paid. This resolves section 23's actual-payment uncertainty for
that installment; the existing approved draft and Cash credit already record
it. Do not approve another draft, create another payment or deduct it again.
The confirmation does not supply an exact payment timestamp, paying account
or payment reference, and does not resolve the future February due-date rule.

The eleven paid installments total PHP 89,090.08. Working expected Cash remains
PHP 197,360.80 and the unexplained difference against owner-reported funds of
PHP 91,318.40 remains PHP 106,042.40. These calculations already include the
October 29 payment. Unknown opening cash, purchase-settlement evidence, balance
completeness and other missing cash events remain unresolved; the difference
is not a confirmed or approved Owner Draw. Only documentation was updated;
no database posting or money transfer was made for this confirmation.

## 24. Planned Follow-Up: Early Payments And On-Hold Orders

Status: documented backlog and proposed implementation sequence, not an
implemented fix or authorization for production changes. The requesting
Clothing business owner confirms that the seven orders in section 23 were
paid well before pickup/checkout. Customers may pay while goods are still
in transit, after invoicing, or months before collection. They may also ask
for received goods to be held in safekeeping while away. These are legitimate
workflows, not evidence that another payment occurred at checkout.

### Existing Gaps And Workflow To Reuse

- Section 19 already records the payment-versus-fulfillment and recognition
  policy gap. Keep ownership, revenue recognition, customer-advance treatment
  and matching inventory/COGS decisions in that separate policy review.
- Section 20 already records the separate PSO 740-versus-700 receipt and
  effective-date discrepancy. Neither the cash fix nor hold controls resolve
  that quantity issue or certify section 21's opening inventory worksheet.
- The Transactions page at `/clothing/operations/transactions` already offers
  `On-Hold`. [Inventory status rules](../../src/lib/inventory/statuses.ts)
  classify it as reserved, not fulfilled. Reuse this operational status rather
  than introducing another status merely to represent full payment.
- [Packing-list selection](../../src/modules/clothing/operations/transactions/hooks/useTransactionsDerivedData.ts)
  can include an On-Hold order when the same customer has an eligible Prepared
  order. Review whether that is intentional combined packing or needs an
  explicit release control; selection alone does not prove automatic dispatch.

### Proposed Sequence And Acceptance Criteria

1. **Fix duplicate-cash reporting first.** The owning balance-sheet projection
   is linked in section 23. Recorded receipts must contribute by their actual
   payment dates, once, independently of packing, checkout, dispatch or release.
   An explicit receipt outside the reporting window must not become an inferred
   receipt inside it. Review legacy orders without payment rows separately;
   do not silently discard genuine legacy collections or invent payment dates.
   Regression coverage must include the seven-order PHP 4,331 example,
   pre-cutover payment with later fulfillment, payment while in transit,
   partial payments across windows, in-window payment before later pickup,
   same-window payment/fulfillment and legacy records without payment events.
   Preserve existing revenue/COGS policy and original payment/status history;
   check report consistency rather than using a balancing journal or Owner Draw.
2. **Improve payment visibility.** Propose Unpaid, Partially Paid and Fully Paid
   indicators alongside, not instead of, operational status. An order may be
   `On-Hold` and Fully Paid, or In Transit and Fully Paid, without being checked
   out. Derive amounts from the existing canonical financial calculation,
   including applicable discounts/refunds, rather than a second UI-only rule.
3. **Review hold/release controls with the owner.** Consider recording the
   customer's hold request, reason and optional release date. Agree how release
   is confirmed before changing packing/dispatch eligibility. Do not fabricate
   pickup, release automatically merely because payment is complete, or assume
   an optional date proves consent to ship. Test combined-customer packing,
   individual and bulk transitions, retry and concurrent release paths.
4. **Approve recognition policy separately.** Resolve section 19's ownership,
   safekeeping and refund terms before changing revenue, advance liabilities,
   inventory ownership or COGS. Full payment and On-Hold status alone must not
   be used as approval for those accounting changes.

Before implementation, update the affected canonical domain contracts, trace
UI/API/bulk/import/job and report consumers, and explicitly check General
Merchandise/shared consumers without assuming identical domain policy. The
accountable policy owner is the requesting Clothing owner. This entry records
future work only: no runtime rule, schema, payment, operational status,
production data, opening balance or Owner Draw was changed. The PHP 4,331
reporting defect remains unfixed in the application.

## 25. Reporting Fix Review And October 12 Maya Credit Posting

This subsequent review updates sections 23-24's historical unfixed status.
The current development balance-sheet route now records explicit receipts by
payment date and suppresses legacy inferred cash for orders with positive
recorded payment activity, including payments outside the reporting window.
The production checkout's route is byte-identical to development. This checks
source code, not the running container's compiled route or an authenticated
report response; deployed runtime behavior is not independently certified here.
The two focused balance-sheet/journal API test files passed: 45 tests. Full
quality gates were not rerun for this review. No runtime code was edited in
this session; payment visibility, hold/release and recognition-policy follow-up
remain separate from the verified source-level cash fix.

An enforced repeatable-read, read-only production check at October 29, 2026,
15:06:17 Asia/Manila found one APPROVED Maya Credit draft for PHP 1,767.05,
effective October 12, approved October 29 at 15:04:01 Asia/Manila. Draft
`cmvt76cji0067bs7tnutad8oq` has exactly one active balanced pair: debit Monthly
Dues Expense and credit Cash, PHP 1,767.05 each. No additional Maya expense
record or duplicate October Maya journal pair was found in the reviewed
sources. The owner's statement establishes the historical posting; actual
settlement date/account/reference were not independently verified. Do not
create another payment or deduct this installment twice. This retains the
existing provisional full-installment expense treatment, not a newly approved
principal/interest allocation.

The twelve October recurring Cash credits total PHP 90,857.13. Active dated
customer receipts remain 171 rows / PHP 176,066.00; investor funding remains
PHP 500,000 and paid logistics PHP 2,480. Carrying forward the previously
verified payroll and conditional purchase assumptions gives:

| Updated conditional cash bridge                                           |            PHP |
| ------------------------------------------------------------------------- | -------------: |
| Cash from dated receipts and reviewed outflows, excluding legacy fallback |     575,228.87 |
| Less twenty purchases, assuming cash-paid and not already deducted        |    -379,635.12 |
| Working expected Cash before withdrawals/other missing movements          | **195,593.75** |
| Previously owner-reported funds, not a new balance confirmation           |     -91,318.40 |
| Conditional unexplained difference, not confirmed Owner Draw              | **104,275.35** |

This is section 23's PHP 197,360.80 working cash and PHP 106,042.40 difference,
each reduced once by PHP 1,767.05. It is not a fresh displayed-report total or
cash count. Unknown opening cash, purchase-settlement evidence, comparable
balance completeness and other missing movements remain unresolved. Opening
inventory remains provisional; this check does not authorize an opening or
Owner Draw posting. Only this review documentation changed; no database row,
production file, payment, operational status or accounting posting was changed.

## 26. Paw Patrol: Owner-Confirmed Zero Remaining Physical Stock

**October 29 follow-up:** the seven-unit phantom-stock/negative-scrap issue
was corrected in development and production; see section 35. The investigation
below is retained as historical evidence, not the current unresolved status.

On October 29, the owner confirms that Paw Patrol 2-PC Onesie
`PP2PCO-082026` has zero remaining physical stock: all pieces were disposed
of or shipped. This resolves the current physical-count question, not the
quantities/dates attributable to each disposal or shipment. The owner does
not recall the intent of the earlier adjustments; do not identify a particular
row as erroneous solely from this zero-stock confirmation.

The October 29, 15:12:38 Asia/Manila read-only production check found these
active October 23 movements for product 280:

| Movement | From     | To       | Units | Report value at saved PHP 1.03/unit |
| -------- | -------- | -------- | ----: | ----------------------------------: |
| 5466     | sellable | scrap    |     7 |                               -7.21 |
| 5467     | scrap    | sellable |     7 |                               +7.21 |
| 5468     | scrap    | sellable |     7 |                               +7.21 |

The report groups the two scrap-to-sellable rows as 14 units / PHP 14.42 and
labels them `opening` to sellable. The underlying movements are returns from
scrap, not evidence of an October 12 opening receipt. These three adjustments
alone net to seven additional sellable units; that is not a full ending-stock
rollforward or proof that either return was a duplicate. The original August
20 receipt 4890 records ten units, while the current catalog quantity is one,
with grand total and landed unit cost PHP 1.03. The saved valuation remains
unverified; do not infer actual acquisition cost from those fields alone.

Next review: reconcile all genuine sales, reservations, transfers and disposals
against the owner-confirmed zero remaining count before proposing any scoped
repair. Preserve fulfilled orders and existing history. Do not scrap shipped
units again, fabricate sales, reverse either return without evidence, backdate
a count to October 12, or use these values to change cash or Owner Draw.
Sections 17 and 21's opening valuation remains provisional. Only documentation
changed for this confirmation; no inventory movement, product quantity, cost,
order, accounting posting or production data was changed.

### Full Movement Rollforward And Why The Report Still Shows Value

A further enforced read-only production check at October 29, 15:21:00
Asia/Manila retrieved all twelve matching movements and both active orders.
No matching soft-deleted movement or order was returned. Orders 3331 and 3378
are Shipped, four units each; their sale movements 5023 and 5008 are dated
August 20 and August 27 respectively. Neither is an October COGS movement.

| Effective period / movement                               | Sellable change | Running raw sellable units |
| --------------------------------------------------------- | --------------: | -------------------------: |
| August 20 receipt 4890                                    |             +10 |                         10 |
| August 20 transfer from Mixed Onesie, 4891                |             +15 |                         25 |
| August reservations subsequently sold, orders 3331 / 3378 |              -8 |                         17 |
| October 23 supplier-short movement 5463                   |             -17 |                          0 |
| October 23 supplier-short movement 5464                   |              -7 |                         -7 |
| October 23 supplier-short return 5465                     |              +7 |                          0 |
| October 23 scrap movement 5466                            |              -7 |                         -7 |
| October 23 scrap return 5467                              |              +7 |                          0 |
| October 23 scrap return 5468                              |              +7 |                          7 |

The final raw buckets are sellable 7, reserved 0, sold 8, scrap -7,
supplier_short 2 and opening_inventory -10. The last two include source-bucket
offsets, including the transfer; they are not independent physical counts.
Negative scrap and seven sellable units disagree with the owner's zero
remaining physical stock and demonstrate that this history is unreconciled.
They do not establish which individual adjustment was mistaken.

The [inventory report calculation](../../src/lib/accounting/inventory-cogs.ts)
selects scrap-related movements for its seed/shrinkage entries; it does not
include the October supplier-short adjustments in that calculation. The
[balance-sheet route](../../src/app/api/accounting/balance-sheet/route.ts)
adds those derived inventory entries and period COGS, rather than replacing
them with the Inventory page's current available quantity. Consequently,
Paw Patrol's reviewed October movement component is PHP 14.42 added less
PHP 7.21 removed = **PHP 7.21 added to Stock on Hand**, using the saved,
unverified PHP 1.03/unit. Its recorded sale movements are before cutover, so
they do not offset that addition in October. This identifies the scoped
movement contribution, not a certified product-level closing balance inclusive
of all aggregate opening/reclassification entries or a live report response.

The operations projection uses catalog supply, adjustments, order demand and
clipping at zero instead of a raw sum of receipt movements. Legacy scrap
returns without `movementSource: inventory_adjustment` are not treated as
scrap reversals by that projection, although the report includes them as
inventory seeds. This provides a concrete explanation for inconsistent views;
the operations display being zero does not repair the raw ledger/report.

Correction requires a reviewed plan for the supplier-short/scrap sequence,
its classification and cost basis, with the original history and eight shipped
units preserved. Do not simply hide the report lines, subtract PHP 7.21 from
cash, or append another scrap movement to force one view to zero. The report's
`opening` label also requires separate review. No historical correction,
runtime change or production write was performed by this investigation.

## 27. Compact Unconfirmed-Valuation Warning

The owner reported that the expanded fifteen-movement valuation table displaced
the main content on the Clothing Accounting, Profit & Loss and Business
Intelligence pages. All three used the shared InventoryValuationNotice.
The owner then directed that it be removed from the other pages, so the
Accounting Dashboard and Business Intelligence no longer render the warning.

After the owner rejected the top-of-page placement on Profit & Loss, that page
now has a dedicated Cost Review tab with an affected-movement count badge.
Neither the warning table nor Dated cost corrections appears above the main
report. Selecting Cost Review opens the exception table immediately, preserving
the existing confirmation permissions and refresh callbacks. The shared General
Merchandise P&L page uses the same tab but remains read-only. Complete valuations
show a completion state; absent valuation data is shown as unavailable, not
confirmed. The Profit & Loss Cost Review tab is now the only place the warning
and exception table appear; the underlying valuation data and API responses are
unchanged.

This is a presentation-only change, not a business-rule change. These warnings
mean that historical movement cost snapshots are missing and current product
costs are being used; they do not prove physical stock is missing or that the
goods had zero cost. Do not confirm zero cost merely to dismiss the warning.
No costing, accounting, permission, production-data or recognition rule changed.
The Paw Patrol and opening-valuation exceptions above remain unresolved.

Validation: eight focused component/page tests, TypeScript, lint and all twelve
hardening tests passed. Lint retains unrelated warnings. Guardrails stopped
on the existing 1,000-line accounting-balance-sheet API test file; no override
was used. An authenticated full-page browser check was not completed; the
development preview requires login. No production deployment was performed.

## 28. Refund Pending Summary Placement

The owner reported that the Refund Pending block (pending amount, orders,
oldest age, approved refunds paid and approved retained deposits) sat above the
main content on Clothing Accounting, Transactions and Business Intelligence.

- Accounting Dashboard: the block is gone from the top. Refund Pending is now a
  stat card in the KPI row (it opens the same pending list), next to an
  Approved Refunds Paid card whose caption shows retained deposits. Clothing
  shows eight cards in rows of four; General Merchandise is unchanged.
- Transactions: the block was removed; the header navigation badge remains the
  entry point for the pending list.
- Business Intelligence: the block and its monthly table were removed from the
  top. A Refunds chart card now sits with the other charts, showing pending,
  pending orders/oldest age, paid and retained totals plus a monthly paid bar
  chart. Its icon opens the pending list.

All views use the same refund-obligations API and query keys as before, with
the same dates and period filters. This is presentation-only; no refund,
deposit, accounting or permission rule changed.

Validation: 16 focused tests in the refund and Profit & Loss test files,
TypeScript, ESLint on the changed files and `git diff --check` passed. An
authenticated browser check was not completed.

## 29. Inventory Owns Cost Review

At the owner's request, Cost Review and Dated cost corrections now reside in
Inventory's Cost Review tab, not Profit & Loss. The tab includes a review-period
selector and refreshes the existing valuation data after corrections. Clothing
retains its existing confirmation controls; General Merchandise remains read-only.
Profit & Loss shows only a compact provisional-profit warning linking to
Inventory when costs are unconfirmed. The Accounting Dashboard and Business
Intelligence do not regain the movement warning.

This is a presentation-only relocation: no API, permission, inventory quantity,
costing or recognition rules change. Missing snapshots do not establish that
goods were free; zero-cost confirmation remains only for genuinely free goods.
The focused relocation and existing refund/valuation interaction suites passed
(16 tests). Authenticated visual verification remains incomplete.

## 30. Historical Cost Review And Date-Fallback Qualification

### Recorded Cost Reconciliation, October 29

Owner confirmation received October 29, 2026: after being asked whether the six
listed unit costs were the original all-in costs for these exact batches rather
than later recalculations, the requesting Clothing owner answered, "yes they are
all correct". Approved historical unit costs: Onesie (O-091426) PHP 40.07;
Premium Shortsleeves Onesie (PSO-101226) PHP 47.52; Mixed Onesie (MO-062626)
PHP 39.01; Baby Shoes (BS-062926) PHP 77.65; MK Shoes (MS-062226) PHP 401.96;
Organic Undies (OU-042226) PHP 16.47. This supplies owner attestation of the
historical basis for the listed 15 movements / 2,740 units, valued at PHP
111,553.57. No further payment proof is needed to establish that approved basis.
The quantity discrepancies remain separate reconciliation items; this approval
does not authorize altering receipts, quantities, payment flags, cash, or posting
logistics charges again. The subsequent explicitly authorized application is
recorded below; the original approval was documentation-only at that time.
Earlier uncertainty about whether these unit costs were historical is superseded
by this attestation; underlying read-only findings below remain as evidence.

#### Approval Applied In Development And Production

The owner selected "Development, then production" for this exact data change.
`confirmLegacyMovementCosts` in src/lib/accounting/inventory-valuation.ts saved
six LEGACY_COST_CONFIRMATION request records with stable UUIDs ending 000000000001
through 000000000006 (prefix b0d0c026-1029-4000-8000). Each contains the original
movement before-images, approved cost, exact quantities and transaction links,
owner-attestation reference, operator identity and timestamp. The operational
runner is scripts/tmp/reconcile-approved-clothing-costs.ts; no route, UI action
or General Merchandise rule changed.

Fresh full custom-format database dumps were verified with pg_restore to a
discard file before approval writes, never restored over a live database.
Production backup: backups/2026-10-29T09-38-49-880Z-production-legacy-cost-approval/
(before.dump, before.json with SHA-256, after.json). Final development verification:
backups/2026-10-29T09-32-17-674Z-development-legacy-cost-approval/.
Development retries exposed a TOC-only stdin pipe closure and JSONB key-order
comparison issue in the runner; both were fixed before production. Existing
partial approvals were preserved and resumed under the same idempotency keys.

Both databases now have all six approval records. Replaying each request returned
the saved result. The updated development reader, run against each database,
reports zero current valuation issues (formerly 15 movements / 2,740 units).
Period COGS stayed PHP 125,430.17 before/after, including PHP 111,553.57 for these
approved movements; the difference is other already-valued period movements.
Whole-table fingerprints for products, inventory_movements, transactions and
clothing_accounting_journal_lines were identical before/after in each database.
The report as of October 28 Manila was identical before/after, retaining its
historical unconfirmed state. Approval adds evidence, not stock, cash, a new
expense, a payment or a duplicate logistics journal.

Validation: 49 focused tests, 4,586 full unit tests, 12 hardening tests, lint and
typecheck passed. Guardrails remains blocked by the pre-existing 1,000-line
balance-sheet API test. Integration remained 70 passed / 20 failed, including
missing split_batch_components.acquisitionUnitCost in the test database.
No schema changes or test bypasses were made. No production code was edited,
committed, pushed, built or deployed. The running production app still needs a
separately approved release of the reader change to recognize the saved evidence;
the zero-issue result is from the updated reader, not a deployed-UI verification.

Read-only production checks reconciled all six saved cost totals exactly to
Grand Total + Forwarder's Fee + Lalamove + Packaging Cost. Every difference is
PHP 0.00. This establishes internal arithmetic consistency, not independent
verification that the current costs were the historical sale costs.

| Product                                  | Saved payment | Product quantity | Original receipt quantity | Recorded total cost PHP | Saved unit cost PHP | Flagged movements / units | Estimated flagged cost PHP |
| ---------------------------------------- | ------------- | ---------------: | ------------------------: | ----------------------: | ------------------: | ------------------------: | -------------------------: |
| Onesie (O-091426)                        | Paid          |            5,600 |                     5,600 |              224,371.44 |               40.07 |                 3 / 2,053 |                  82,263.71 |
| Premium Shortsleeves Onesie (PSO-101226) | Paid          |              740 |                       700 |               35,166.64 |               47.52 |                   6 / 550 |                  26,136.00 |
| Mixed Onesie (MO-062626)                 | Unpaid        |            9,100 |                    14,412 |              355,036.00 |               39.01 |                    1 / 20 |                     780.20 |
| Baby Shoes (BS-062926)                   | Paid          |              207 |                       200 |               16,074.03 |               77.65 |                     1 / 1 |                      77.65 |
| MK Shoes (MS-062226)                     | Paid          |               51 |                        51 |               20,500.00 |              401.96 |                     1 / 1 |                     401.96 |
| Organic Undies (OU-042226)               | Unpaid        |            3,600 |                     9,977 |               59,293.49 |               16.47 |                   3 / 115 |                   1,894.05 |
| Total                                    |               |                  |                           |                         |                     |                15 / 2,740 |                 111,553.57 |

The saved unit costs round the recorded total divided by Product quantity to
two decimal places. Estimates above use that saved rounded basis, not a newly
invented cost or a new journal expense. Payment flags do not determine cost:
an unpaid supplier balance does not make received inventory free.

Receipt rollforwards contain real supplier-short adjustments (including Onesie,
MK Shoes, Mixed Onesie and Organic Undies); preserve them. Do not repair receipt
differences merely by equating received quantities with catalog quantities.
The four quantity mismatches above require historical quantity-definition review.
PSO's previously documented 740/700 and landed-charge qualifications remain open.
Matching exact product/shipment journal references found PHP 2,480 of Stock on
Hand logistics capitalization for shipment 236, with matching cash settlement;
this is not authority to capitalize the whole purchase or book those fees again.
The reference-scoped query is not proof that no other opening/source records exist.

No database writes, payment-status changes, cost confirmations, receipt changes
or journals were made. Clearing missing snapshots requires an audited approval
of the historical basis; payment confirmation alone is not that approval.
The current dated-correction service rejects unchanged costs and requires an
actual capitalized delta. It is not a suitable workaround for confirming these
unchanged legacy estimates. The earlier suggestion to use that tool for every
missing snapshot was too broad and is withdrawn.

Direct-pickup follow-up: the owner clarified that packing lists are optional;
single-item pickups can be marked Shipped directly. Clothing COGS briefly preferred
shipment metadata over existing dates; this was withdrawn after it incorrectly
pulled 16 older movements / 611 units into October review (31 / 3,351 instead of
15 / 2,740). COGS retains packed date or, when absent, movement creation date.
General Merchandise is unchanged. This restores existing recognition, rather
than claiming that movement creation independently proves physical pickup.
Read-only production evidence records Roshelle Devanadera (2,000 Onesie) as
Shipped October 15, Ces Obejas (35 Onesie) October 14, Anne Tionson (50 Premium
Shortsleeves Onesie) October 15, and Iris Lacastesantos (15 Organic Undies)
October 15, 2026, Manila time. These prove recorded transitions, not independently
verified physical pickup dates. No production writes or cost confirmations occurred.

Enforcement: src/lib/accounting/inventory-cogs.ts; contract:
docs/business-logic/clothing/accounting-profit-loss.md. Focused COGS tests: 35
passed; full unit suite: 4,572 passed; lint and typecheck passed. Guardrails is
blocked by the existing 1,000-line accounting-balance-sheet API test. Integration:
70 passed / 20 failed, including missing split_batch_components.acquisitionUnitCost
in the test database. Historical cost evidence remains unresolved; no missing
snapshot is converted into free goods or invented purchase cost.

Read-only checks on October 29 found the same fifteen screenshot movements in
development and production: 2,740 units, all with null unitCost and costBasis.
Their six products have positive current catalog costs; neither database has
ZERO_COST_CONFIRMATION or INVENTORY_COST_CORRECTION requests. A subsequent
production read-only query found one original opening-inventory-to-sellable
receipt for each product, also without a positive saved unit cost. Thus the
movement ledger alone does not establish historical acquisition cost. This is
not evidence of free goods or authority to confirm zero cost or copy today's
catalog values into historical snapshots. PSO's cost/quantity qualifications
in sections 20-21 remain unresolved.

The earlier conversational claim that older posting dates prove an October
date bug was too strong. The automatic-sale writer in
src/modules/transactions/api/transactionInventorySync.ts sets postingDate from
packedDate or orderDate. Without packedDate, an old postingDate can therefore
be an order date, not fulfillment evidence. Existing Clothing and General
Merchandise regression tests explicitly preserve creation-time fallback for
these automatic sales. A trial change to prefer postingDate failed four tests
and was undone; it is not a delivered reporting fix.

Orders 3212, 3453, 3467 and 3427 have no packedDate. Their sale movements
5226, 5268, 5270 and 5271 were created October 13-15, but have posting dates
July 29, September 28, October 14 and September 18 respectively. Establish
actual fulfillment dates before changing their reporting periods. Review
historical purchase/landed-cost evidence for the six products before approving
any exact-record cost repair. No production write, zero-cost confirmation,
cost backfill, quantity change or recognition-policy change was performed.

## 31. Owner-Confirmed PSO Receipt Quantity Reconciliation

On October 29, 2026 the requesting Clothing owner confirmed that all 740 ordered
PSO-101226 pieces were received and that all customers collected their goods
except Marl Eisler Antonio / Nicole Sacristan (50) and Lyn Domingo / SIERRAS
THRIFTEES (40), both fully paid. This evidence resolves the physical-quantity
uncertainty in section 20, not the separate historical receipt-date question.

The live orders are 3471 and 3612, both Prepared. Production payments total
PHP 3,450 and PHP 2,760 respectively, with zero recorded balance. Development
has older payment data; no payments were copied or invented there. The accountable
policy owner is the requesting Clothing business owner. Payment alone remains
insufficient to invent pickup, sale recognition or a new movement to sold.

### Approved Scope And Enforcement

The one-off [repair runner](../../scripts/tmp/reconcile-pso-receipt.ts) corrected
only movement 5225's quantity from 700 to 740, plus its update timestamp. It did
not insert another receipt or append a fictitious purchase/stock adjustment.
The exact original row remains in the audit before-image and verified backup.
This is an owner-supported historical data correction, not a change to the
application's receipt, fulfillment or accounting policies.

The owning receipt writer is `ensureReceiptMovementForProduct` in
`src/modules/products/api/service.ts`. It intentionally preserves an existing
receipt instead of resizing it after catalog edits. The Inventory UI already
derived 740 from catalog data and floored negative availability; the underlying
ledger still had 700 received and negative 40 sellable. The original cause of
the stale 700 capture is not established by this investigation. Do not remove
the writer's duplicate-receipt protection or generalize this repair to partial
receipts or other products.

The runner defaults to read-only inspection. Explicit `--apply` creates a fresh
owner-only custom PostgreSQL backup, fully validates it with pg_restore without
restoring, and stores its SHA-256 and before-state. The serializable correction
locks affected tables, checks the exact product/receipt, one original receipt,
held orders, production payments and pre-repair bucket totals. It atomically
records immutable before/after evidence under request
`b0d0c026-1029-4000-8000-000000000740`, operation
`RECEIPT_QUANTITY_RECONCILIATION`. Same-key retries check the saved payload and
receipt image; they cannot add another 40 units. Unexpected scope or failed
postconditions abort the transaction.

Whole-table fingerprints verify unchanged products, orders, payments, accounting
journal lines and every other movement. Only quantity and updatedAt may differ
on the corrected row. Its cost fields, original timestamps, postingDate, links
and notes are preserved. No other UI/API/job/bulk/import path is modified;
General Merchandise remains independent. The canonical contract is
[Clothing inventory](../business-logic/clothing/operations-inventory.md#owner-confirmed-legacy-receipt-quantity).

### Execution And Verification

- Development applied successfully at approximately 11:39 UTC, then an identical
  retry returned the existing result without another stock change.
- Production applied successfully at approximately 11:40 UTC. An independent
  read-only query confirmed the corrected row and saved audit record.
- Both databases: 740 received, 650 sold, 90 reserved, zero sellable. All protected
  table fingerprints matched before/after within each repair transaction.
- First development backup:
  `backups/2026-10-29T11-39-23-021Z-development-pso-receipt/`.
- Development retry backup:
  `backups/2026-10-29T11-39-39-988Z-development-pso-receipt/`.
- Production backup:
  `backups/2026-10-29T11-40-05-458Z-production-pso-receipt/`.
- Each directory retains `before.dump`, `before.json` (including SHA-256) and
  `after.json`. No database restore was performed.
- Focused receipt/accounting and COGS tests: 86 passed. Script lint and repository
  typecheck passed. Guardrails, repository lint (existing warnings), the full
  unit suite and all 12 hardening tests passed. Integration failed with P2022
  missing-column errors for `inventory_movements.costBasis` and
  `split_batch_components.acquisitionUnitCost` in the test database. No schema
  changes or test bypasses were made. Guardrails' unrelated generated LIV-1
  completion-date change was removed from this repair's diff.
- Ledger controls initially could not start without DATABASE_URL. Both constituent
  checks were rerun with the explicit development connection. Healthcheck and
  drift each exited 2, reporting other negative-sellable balances and catalog/net
  ledger differences. These are not certification of the rest of inventory;
  catalog purchase quantities and remaining stock also have distinct meanings.
  No unrelated stock was changed to force these controls to pass.

### Remaining Qualifications

Receipt 5225 still has postingDate October 12 and its original creation time;
the earlier owner-reported physical arrival was October 13. This quantity-only
repair neither backdates nor certifies historical physical location, ownership,
landed-charge timing or opening accounting recognition. The separate Paw Patrol,
held-order recognition and damaged-stock questions also remain open. Accordingly,
PHP 196,960.33 remains provisional; no opening valuation or balancing journal was
posted. Genuine investor funding, sales, payments and historical cost evidence
are untouched. No commit, push, production source edit, deployment or build was
performed for this repair.

## 32. PSO Shipment Timeline And Pricing-Only Packaging Clarification

**Final owner-agreed reconciliation basis:** October 12 Inventory in Transit
is PHP 30,636.64 supplier cost. KPC PHP 1,530 and Lalamove PHP 950 are treated
on October 13; the owner confirms KPC was paid that day, with the Lalamove
pickup recorded at 1:45 PM. The packaging allowance is a pricing estimate,
not an actual acquisition cost or expense. This treatment is decided and must
not remain an outstanding policy question. The conditional KPC-opening scenario
below is retained as superseded investigation history, not an approved increase
to PHP 198,490.33. The supplier-only combined worksheet remains PHP 196,960.33,
subject to its separate remaining opening qualifications. Agreed treatment does
not assert that opening/reclassification entries or historical cost restatements
have been posted. Preserve existing genuine cash entries and do not duplicate
the already paid PHP 2,480 logistics amounts.

On October 29 the Clothing owner clarified that KPC received the goods from
the supplier on September 15, they remained in transit until October 13, 2026,
and the supplier was paid around September 10. A fresh enforced read-only
production query confirmed shipment KPC 23930A-236 has dateCreated 2026-09-15,
dateDelivered 2026-10-13, status Delivered and fee PHP 1,530. The owner's
clarification supplies the physical meaning of those shipment dates. The
October 12 catalog/receipt date is not evidence of physical arrival.

The owner also clarified that packaging is an estimate used for pricing, not
an evidenced actual acquisition cost. Do not capitalize the saved PHP 1,500
packaging allowance merely because it appears in the pricing calculation.
This resolves the earlier request for packaging-incurrence evidence: it is
not an actual cost to allocate to October 12. Actual future packaging purchases
or consumption require their own evidence and accounting classification.

### Superseded Conditional Cost Scenario

- October 12: supplier cost PHP 30,636.64 belongs in Inventory in Transit,
  not physical Stock on Hand and not another October supplier payment.
- Attribute the confirmed PHP 1,530 KPC freight to that pre-existing shipment.
  If incurred by the October 12 cutoff, include it in transit carrying cost,
  with an accrued payable if still unpaid. This gives PHP 32,166.64 for PSO's
  opening transit value. Shipment dates and later payment establish neither
  the exact contractual incurrence date nor a required service allocation by
  themselves; this is the proposed freight treatment, not a posted approval.
- October 13: reclassify the received carrying amount from transit to physical
  inventory. Add the actual PHP 950 courier cost incurred for delivery to the
  premises. Supplier plus confirmed freight and courier totals PHP 33,116.64,
  excluding the pricing-only packaging estimate. Do not duplicate the already
  recorded PHP 2,480 logistics payments/capitalization.
- The saved PHP 35,166.64 pricing total exceeds those identified actual costs
  by PHP 2,050: PHP 550 estimated-versus-actual courier difference plus PHP 1,500
  packaging allowance. It is not automatically an additional expense or cash
  payment. The earlier approved PHP 47.52 legacy sale-cost evidence is not
  silently overwritten; any actual-cost restatement needs a separately reviewed
  dated correction and an allocation between sold and remaining inventory.

This clarification resolves the physical transit timeline and packaging's
pricing-only purpose. It does not certify the full opening worksheet or post
an opening balance. If the proposed KPC opening allocation is approved, PSO adds
PHP 1,530 to section 21's supplier-only opening scenario: PHP 198,490.33 instead
of PHP 196,960.33, with the other opening qualifications unchanged. These remain
scenarios, not certified valuations. Only this reconciliation documentation
changed; no database, cash, cost approval, receipt date or journal was changed.

## 33. Standing Seven-Day Policy And Order 3399 Decision

On October 29 the requesting Clothing owner directed that the discussed
seven-day collection/refund rule be recorded as the concrete policy basis,
rather than repeatedly reopening the same question. The canonical rule is
[the Clothing SOP](../business-logic/clothing/operations-workflow.md#seven-day-collection-and-discretionary-refund-policy).
The window begins once full payment, physical readiness and invoice/customer
notification are all satisfied. Ordinary discretionary cancellation requests
are declined after seven calendar days, with recorded owner exceptions and
applicable statutory rights kept separate. Expiry is not a shipment or sale.

For order 3399 the owner explicitly identifies the September 14 invoice and
confirms that the order is beyond seven days. The production read-only review
verified 60 Onesie units, Prepared status, PHP 324 paid September 14 plus
PHP 2,916 paid September 15, one 60-unit reservation (movement 5055), and no
linked sale or refund. Keep the 60 units reserved and PHP 2,404.20 in the
opening worksheet; do not deduct it merely because full payment or a refund
deadline has passed. These September receipts do not create October cash.

The policy/worksheet decision is recorded and must not remain listed as an
unanswered ownership-policy question. Earlier conditional suggestions to
exclude these held units are superseded by this basis. Accounting verification
and any required customer-advance/opening posting remain separate execution
tasks: this does not assert that the full PHP 3,240 has already been correctly
classified in existing reports or opening entries. No policy-enforcement code,
order status, movement, payment, opening balance or journal was changed.
Other historical customers' acceptance/readiness is not inferred, and General
Merchandise is unchanged. Documentation checks and the seven-day date example
passed; application suites were not rerun for this documentation-only record.

## 34. Seven-Day Cancellation Policy Enforcement In Development

The Clothing owner subsequently requested implementation where needed. The
approved invariant and accountable owner remain those in section 33 and the
canonical Clothing SOP. This change enforces cancellation eligibility, not a
new ownership transfer, pickup event or accounting recognition rule.

The existing serializable/idempotent `approveOrderCancellation` service in
`src/lib/accounting/customer-money.ts` now rejects fully paid discretionary
cancellations after seven calendar days. It derives the full-payment date from
cumulative actual receipts, uses the latest invoice/readiness/notification date,
and includes the deadline through Manila end of day. A later overpayment does
not restart the window. Administrator-attested readiness, notification and
accepted-terms evidence is required because the current order schema does not
store those historical notices. Missing or future dates are not fabricated;
terms accepted later cannot retroactively impose the earlier deadline.

The existing Clothing cancellation modal now records the cancellation ground,
supporting dates or a separate explicit owner-authorized exception reason.
Only existing ADMIN/SUPER_ADMIN decision-makers may attest an owner exception.
Defective goods, incorrect goods, non-delivery and supplier-failure voids remain
separate from ordinary discretionary cancellation. An exception is not inferred
merely from an administrator clicking Approve or typing an ordinary reason.
Existing partial-payment deposit rules and actual refund payout handling remain
unchanged.

All callers use the same cancellation API/service. Generic single/bulk status
updates already prohibit direct cancellation transitions; there is no new
background expiry job or inventory import path. The guard runs before money,
order or stock mutations. Successful cancellation results save policy version,
ground, calculated window, supplied evidence, approver and exception reason in
the existing `ClothingFinancialRequest.result`. Exact retries reuse that result;
changed details conflict. No Prisma/schema change or historical-data migration
is needed. General Merchandise has independent operations and is unchanged.

Order 3399 remains Prepared/reserved. No existing receipt, payment, stock,
opening balance, customer advance or journal was updated by this implementation.
Missing historical accounting classification is not silently repaired or treated
as verified. Production source, deployment, builds and git history were not changed.

Validation: 38 focused cancellation service/API and modal tests passed, including
expiry, deadline boundaries, late readiness, missing/future evidence, retroactive
terms, statutory grounds, supplier failure, explicit exceptions, authorization,
direct requests, identical retry and conflicting-key behavior. Guardrails,
repository lint (existing warnings), strict typecheck, 4,605 unit tests and all
12 hardening tests passed. Integration: 70 passed / 20 failed with test-database
P2022 missing columns `inventory_movements.costBasis` and
`split_batch_components.acquisitionUnitCost`, consistent with the earlier
unresolved schema limitation. No tests, guardrails or thresholds were bypassed.
The unrelated guardrail-generated LIV-1 completion date was restored.
The configured coverage run also executed all 4,605 tests successfully, then
aborted with exit 134 while generating coverage after exhausting Node's 4 GB
heap. Coverage thresholds/results are therefore unverified, not passed; no
coverage exclusions, thresholds or runtime limits were changed to force a pass.

## 35. Paw Patrol Unsupported Second Scrap Return Corrected

The requesting Clothing owner authorized fixing this discrepancy on October 29.
Accountable owner: the requesting Clothing business owner. Approved invariant:
reconcile the owner-confirmed zero remaining physical stock without inventing
another seven-piece write-off, sale, receipt, cost or cash event, while preserving
the eight genuinely shipped units and full correction evidence.

Fresh enforced read-only snapshots from development and production matched the
twelve-movement chain in section 26, with no matching deleted movements. After
movement 5466 recorded seven scrap units, 5467 returned all seven, leaving the
recorded scrap source empty. Movement 5468 then returned seven more from that
empty bucket. It had no transaction, source-allocation link, note or saved cost
provenance. This is the specific unsupported ledger event; the zero physical
count alone was not used to select an arbitrary reversal. The correction does
not claim to reconstruct the intent of every earlier supplier-short adjustment.

### Scope And Safety

The one-off [repair runner](../../scripts/tmp/reconcile-paw-patrol-return.ts)
soft-deletes only movement 5468, changing deletedAt and updatedAt. All original
quantity, date, product, bucket, source and cost fields remain stored. A keyed
audit retains the complete original chain, before/after row images, protected
table fingerprints, owner-attested reason and backup location under request
`b0d0c026-1029-4000-8000-000000000280`, operation
`UNSUPPORTED_SCRAP_RETURN_REPAIR`.

The default mode is read-only. Development `--check` executes all guards,
correction, audit insertion and postconditions, then rolls back. Explicit
`--apply` first creates an owner-only full custom PostgreSQL dump, consumes it
through pg_restore validation without restoring, and saves its SHA-256. The
serializable transaction locks affected tables, requires the exact twelve-event
chain, verifies the empty preceding scrap balance and two shipped four-unit
orders, and rejects linked allocation/cost evidence or changed scope. Identical
request retries check the saved payload and after-image rather than changing
stock again. No hard delete, replacement purchase or balancing entry occurs.

Whole-table fingerprints verify unchanged products, orders, payments, refunds,
stored journal lines, opening balances and every movement except 5468. The
enforcement surface is this exact historical-data repair and the existing
readers' deletedAt filtering. No UI/API/job/bulk/import behavior, schema,
authorization or General Merchandise policy is changed. The canonical contract
is [Clothing inventory](../business-logic/clothing/operations-inventory.md#audited-unsupported-scrap-return-correction).

### Execution And Independent Verification

- Development rollback validation passed before any retained change. Development
  apply and same-key replay then passed with protected fingerprints unchanged.
- Production apply and same-key replay passed. An independent read-only query
  confirmed 5466/5467 active, only 5468 soft-deleted and exactly one audit record.
- Both databases now show sellable 0, reserved 0, scrap 0 and sold 8. Historical
  supplier_short 2 and opening_inventory -10 are preserved source offsets, not
  assertions of remaining physical stock.
- The actual accounting reader showed production's Paw Patrol October movement
  Stock on Hand contribution fall from PHP 7.21 to zero. Seed value fell from
  PHP 14.42 to PHP 7.21; the retained original shrinkage/return pair is unchanged.
  No new shrinkage charge or stored journal was written. These are scoped derived
  movement effects, not certification of the full opening/closing balance sheet.
- Period COGS remains PHP 125,430.17 and the updated reader reports zero valuation
  warnings before and after the repair. This does not independently certify the
  saved PHP 1.03 Paw Patrol cost or other historical receipt/catalog differences.
- Focused inventory-accounting regressions: all 49 passed. Script lint passed.
- Development backup:
  `backups/2026-10-29T12-54-55-933Z-development-paw-patrol-return/`.
- Development replay backup:
  `backups/2026-10-29T12-55-22-377Z-development-paw-patrol-return/`.
- Production backup:
  `backups/2026-10-29T12-56-19-438Z-production-paw-patrol-return/`.
- Production replay backup:
  `backups/2026-10-29T12-56-27-896Z-production-paw-patrol-return/`.

Each backup directory retains before.dump, before.json with SHA-256 and after.json.
The seven-unit phantom-stock discrepancy is resolved, not an outstanding request
for another physical count or an invented write-off. Wider inventory and opening
valuation qualifications remain separate. No commit, push, deployment, production
source edit, application build or database restore was performed.

Post-repair gates: guardrails, repository lint (existing warnings), strict
typecheck and all 4,605 unit tests passed. Integration again had 70 passing and
20 failing tests, with P2022 missing `inventory_movements.costBasis` and
`split_batch_components.acquisitionUnitCost` columns in the test database.
Read-only development ledger healthcheck and drift checks each exited 2 on
wider existing diagnostics; Paw Patrol was absent from the negative-sellable
output. No unrelated quantity, cost, test schema or guardrail was changed to
force a pass. The guardrail-generated unrelated LIV-1 completion date was
restored. No application accounting algorithm was changed; the executed rollback,
exact-scope guards, replay checks and independent live-reader verification are
the behavior-scoped validation for this historical data repair.
