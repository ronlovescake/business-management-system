# Clothing October 12-29 Inventory And Cash Audit

Status: read-only development-data analysis, not a certified cash or physical-stock reconciliation.

Snapshot: October 29, 2026, 00:25:41 Asia/Manila (2026-10-28T16:25:41.254Z).
Window: October 12 through October 29 as recorded at that snapshot. No October 29 customer receipts were recorded yet. Later transactions are not included.

Owner clarification, October 29: only the 20 products in section 6 were
purchased **after** October 12. Burp Cloth and Onesie Dress were never shipped
by the supplier. This supersedes the earlier assumption that Product 290's
saved October 12 date established an omitted post-investment cash purchase.
The original database snapshot and all sale/movement evidence are unchanged.

Further owner confirmation: Premium Shortsleeves Onesie was ordered and paid
in September, logged October 12, and arrived October 13 on KPC 23930A-236.
Actual charges are KPC PHP1,530 and Lalamove PHP950, total PHP2,480. Its October
receipt, reservations and sales remain in scope; its supplier purchase is not
another October cash payment. Section 10 records the balance-sheet follow-up.

## 1. Conclusion And Safety

**Do not treat the simulated PHP104,954.10 Owner Draw as a verified withdrawal.**
It was a balancing figure. The owner confirmed 20 purchases after October 12,
totaling PHP379,635.12. Product 290 was paid in September despite its October 12
logging date and is not an additional window purchase payment. Shipment charges and
PHP4,331 of cash inferred from older payments remain reconciliation findings,
but they do not prove how much the owner actually withdrew.

- Only localhost:5435/business_management in the development checkout was read.
- PostgreSQL enforced READ ONLY and REPEATABLE READ for the source snapshot and the independent aggregate checks. No financial or inventory records were changed.
- No production access, migration, stock resync, refund change, posting, commit, push, deployment, or production build occurred. No new database backup was needed because there were no database writes.
- Source scope: 260 product records, 2,501 orders, 4,989 movements, 1,830 payment records, 238 stored journal lines, and 77 shipments, including soft-deleted history. Active projections use 243 products, 2,476 orders, and 3,976 movements.
- Money was summed with Decimal arithmetic. Stored legacy Float costs and catalog-cost fallbacks are not independently verified acquisition values.

## 2. Cash Reconciliation

### Dated money received

There are 156 positive, active customer payment events in the window, all recorded
as Cash: 113 reservation deposits and 43 other collections.

| Source                                                        |            PHP |
| ------------------------------------------------------------- | -------------: |
| Investor funding received, agreement CR-2026-003              |     500,000.00 |
| Customer reservation deposits actually recorded in the window |      44,864.30 |
| Other customer collections actually recorded in the window    |     114,315.00 |
| Receipts excluding unknown opening cash                       | **659,179.30** |

The investor receipt exists as the prior simulation's funding journal. The
owner-confirmed funding and customer receipts are pooled; this report does not
assign particular receipts to particular purchases. Spending them does not
repay the investor or release customer-deposit obligations.

### Illustrative owner-confirmed purchase-scope scenario

This scenario retains the earlier owner's cash/bank treatment of the original
20 purchases, now confirmed as the complete after-October-12 list. It does not
deduct Product 290's acquisition as another cash payment. The two shipment 236
charges are still assumed paid from combined Cash inside the window; their
payment dates/methods are **not confirmed**. The payroll is marked paid; the
nine dues are simulation journals, not independent statement evidence. The
purchase list confirms scope, not every cash/card payment date or method.

| Cash bridge                                                                               |            PHP |
| ----------------------------------------------------------------------------------------- | -------------: |
| Cash immediately before the October 12 funding                                            |    **Unknown** |
| Investor and dated customer receipts                                                      |    +659,179.30 |
| The 20 owner-confirmed purchase Grand Totals, if cash-paid in this window                 |    -379,635.12 |
| Nine reported loan/card payments, October 13-28                                           |     -72,090.08 |
| Payroll recorded paid on October 18                                                       |      -7,500.00 |
| KPC 23930A-236 saved forwarder charge, if paid in this window                             |      -1,530.00 |
| KPC 23930A-236 owner-supplied Lalamove charge, if paid in this window                     |        -950.00 |
| Calculated cash before withdrawals and other missing outflows, assuming zero opening cash | **197,474.10** |
| Earlier plan's intended October 28 closing cash, not statement-verified                   |     -95,945.14 |
| **Illustrative unexplained difference, not proven Owner Draw**                            | **101,528.96** |

Opening cash is unknown, not zero. Every PHP1 of real opening cash adds PHP1 to
this difference, holding everything else fixed. Missing business payments reduce
it. A different observed closing balance changes it. The owner now reports
approximately PHP95,945.14 currently held, but that is not an independently
verified count/statement or an automatic posting target.

The reduction from the old PHP104,954.10 plug to this illustrative PHP101,528.96
is PHP3,425.14: shipment fees are PHP2,480, and the intended PHP95,945.14 target
is PHP945.14 above the dated-event closing of PHP95,000. The earlier PHP70,892.32
figure additionally deducted Product 290's PHP30,636.64. The September payment
confirmation disproves that additional window outflow; the figure is retained
only as superseded history, not a valid alternative to post.
The PHP4,331 reporting discrepancy below explains why the displayed balance
sheet instead showed PHP99,331; it is not another receipt to subtract twice.

### Why the existing balance sheet says PHP99,331

| Same existing simulation, before adding missing shipment 236 costs |           PHP |
| ------------------------------------------------------------------ | ------------: |
| Dated receipt bridge after the existing SIM-HOUSEHOLD draw         |     95,000.00 |
| Cash added by the balance sheet's old-order fallback               |      4,331.00 |
| Reproduced balance-sheet Cash                                      | **99,331.00** |

The balance-sheet calculation uses legacy order amounts when an order has no
payment event **inside** the report window, even where it has real payment
events before the cutover. These seven orders have no new window receipt:

| Order ID | Product        | Actual recorded receipt date | PHP inferred as new window cash |
| -------- | -------------- | ---------------------------- | ------------------------------: |
| 3201     | Baby Shoes     | July 29                      |                           96.00 |
| 3212     | Organic Undies | August 21                    |                          315.00 |
| 3258     | MK Shoes       | August 21                    |                          450.00 |
| 3259     | Baby Shoes     | August 21                    |                          390.00 |
| 3373     | Organic Undies | September 4                  |                          950.00 |
| 3386     | Mixed Onesie   | September 22                 |                        1,080.00 |
| 3387     | Organic Undies | September 22                 |                        1,050.00 |
| Total    |                |                              |                    **4,331.00** |

These are real earlier collections, potentially part of opening cash, not new
October 12-29 receipts. The controlling calculation is
[balance-sheet/route.ts](../../src/app/api/accounting/balance-sheet/route.ts#L545).
This report reproduces its Cash calculation offline; it does not claim that
the authenticated HTTP endpoint or full balance-sheet equation was rerun.
No application correction was made.

### Cash/card uncertainty changes the answer materially

For the owner's 20 confirmed purchases, saved methods are 17 CASH purchases
worth PHP328,807.29 and three CARD purchases worth PHP50,827.83 (Products 301,
302 and 303). The simulation nevertheless funded all 20 from Cash. Product
290 is an additional CARD row worth PHP30,636.64 on the boundary date, not part
of that list. These card rows refer to the saved card labelled test. A label
is not a statement, and saved method is not proof of actual settlement.

| Alternative, same unverified closing target and zero-opening assumption                                                                               | Unexplained PHP |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------: |
| Owner-confirmed 20 treated as cash, plus shipment 236 fees; Product 290 paid before funding                                                           |      101,528.96 |
| Only the 17 saved CASH purchases paid from cash; three confirmed-list CARD purchases not settled from cash in this window; boundary purchase excluded |      152,356.79 |

Both assume the PHP2,480 shipment charges were actually paid in the window.
The second is a sensitivity check, not a proposed correction. The owner confirms
Product 290 was paid in September; its saved CARD label is not a new October
payment. Actual statements for the other purchases still matter. If a card
funded a purchase, count its actual later cash repayment, not both the purchase
cost and the repayment. Loan/card dues already in this bridge must not be added
again as a second settlement. Statements are needed to determine which scenario,
if any, reflects actual movements.

## 3. KPC 23930A-236

Shipment 223 is marked Delivered, with creation and delivery dates October 13.
Its product is Product 290, Premium Shortsleeves Onesie (PSO-101226), with saved
order date October 12. The owner confirmed it is not one of the purchases
**after** October 12. Its absence from that list is therefore not evidence of
an omission. The owner confirms September ordering/payment, October 12 logging,
and October 13 arrival on this shipment. Its supplier cost is not deducted again
in October cash. Its October inventory movements and all eight October sales
remain included. Shipment fees remain separate cash events; service/arrival
date and amount do not by themselves establish a bank/card payment date.

| Item                                           |           PHP | Evidence and limitation                                                                                    |
| ---------------------------------------------- | ------------: | ---------------------------------------------------------------------------------------------------------- |
| Supplier purchase Grand Total                  |     30,636.64 | Owner confirms paid in September; do not deduct again in October                                           |
| KPC forwarder fee                              |      1,530.00 | Owner-confirmed actual charge, matching saved Shipment.fee; payment date/method not independently verified |
| Lalamove                                       |        950.00 | Owner-supplied actual amount in this request; payment date/method not supplied                             |
| Shipment charges only                          |  **2,480.00** | Included conditionally in the baseline if paid in the window                                               |
| Supplier purchase plus actual delivery charges | **33,116.64** | Spans September purchase and October delivery; not one October cash outflow                                |

There is no active acquisition/transit build for shipment 236 or Product 290,
no Product 290 supplier-settlement journal, and no shipment 236 logistics journal.
Do not post these findings automatically or use today's settlement action to
invent historical payment dates.

The saved product courier estimate is PHP1,500, PHP550 above the owner's PHP950.
It also has a PHP1,500 packaging estimate; that is not confirmed paid and is not
included in the PHP33,116.64 combined cost reference. Other actual costs could still exist.
The app's landed cost includes estimates, so replacing only the courier amount
is not sufficient to certify actual landed cost or profit.

## 4. Sales And Inventory Movements

### Fulfillment-date sales

Using the application's accounting completion-date rule, **25 orders / 3,036
units / PHP161,538.00 gross order value** fall in the window. All 25 order
quantities match their identified sale-movement quantities; there are no
quantity mismatches in this set. This is fulfilled order value, not customer
cash received during the window or necessarily the P&L's payment-timed revenue.

| Product                                  | Orders |     Units | Gross order value PHP |
| ---------------------------------------- | -----: | --------: | --------------------: |
| Baby Shoes (BS-062926)                   |      2 |         7 |                486.00 |
| Organic Undies (OU-042226)               |      3 |       115 |              2,315.00 |
| Mixed Onesie (MO-062626)                 |      2 |        50 |              2,490.00 |
| Onesie (O-091426)                        |      3 |     2,053 |            100,867.00 |
| Premium Shortsleeves Onesie (PSO-101226) |      8 |       650 |             44,850.00 |
| MK Shoes (MS-062226)                     |      1 |         1 |                450.00 |
| Chickpea Onesie (CO-081026)              |      2 |        60 |              3,390.00 |
| Organic Dress (OD-042226)                |      2 |        40 |              3,960.00 |
| Bonnets (B-061626)                       |      1 |        30 |                660.00 |
| Girls Onesie (GO-091526)                 |      1 |        30 |              2,070.00 |
| Total                                    | **25** | **3,036** |        **161,538.00** |

The PHP98,000 order 3427 alone has 2,000 Onesie units. Its actual payment events
are PHP15,000 and PHP43,000 on October 11, and PHP40,000 on October 15. Only
PHP40,000 belongs in this window's cash receipts, although fulfillment is in
October. This is one important reason sales and period cash differ.

### Movement-date audit

There are 306 active movements whose effective business date falls in the
window. This uses postingDate when present, otherwise createdAt, with Manila
business dates. All 243 active-product bucket rollforwards cross-foot: earlier
ledger balance plus window movement equals current ledger balance. That proves
the arithmetic, not that historical receipt quantities or physical stock are true.

| Transition                    | Rows |  Units |
| ----------------------------- | ---: | -----: |
| Sellable to reserved          |  210 | 10,502 |
| Reserved to sold              |   22 |    986 |
| Opening inventory to sellable |   21 | 11,319 |
| Sellable to supplier short    |   44 |  4,533 |
| Supplier short to sellable    |    6 |  1,254 |
| Sellable to scrap             |    1 |      7 |
| Scrap to sellable             |    2 |     14 |

There are also 309 active movements created in the window. Fourteen were
backdated outside it, including ten simulated scrap rows totaling 782 units
dated October 11. Eleven effective-window movements were created earlier.
The complete raw and analysis files retain both posting and creation dates.

Three sale movements explain the difference between movement-date and accounting
sales: order 3212 (15 Organic Undies), 3453 (35 Onesie), and 3427 (2,000 Onesie).
Their posting dates are July 29, September 28 and September 18, but creation and
fulfillment status history are October 13, 14 and 15. No packedDate is saved;
the accounting COGS service uses movement creation in that case.

The accounting-date calculation reproduces PHP125,430.17 COGS. The strictly
movement-dated set gives PHP43,640.67. The difference is PHP81,789.50 from those
three orders. Fifteen accounting-period movements, covering 2,740 units, rely
on legacy catalog cost rather than confirmed movement valuation. No dated
cost corrections or zero-cost confirmations were found. Profit is therefore
not certified. COGS is noncash here and is never deducted again in the cash bridge.

The owning date and valuation boundary is
[inventory-cogs.ts](../../src/lib/accounting/inventory-cogs.ts#L299).

## 5. Remaining Stock: What Matches And What Does Not

The application projection was run from the snapshot with the actual
[inventoryTransforms.ts](../../src/modules/clothing/operations/inventory/lib/inventoryTransforms.ts).
Linked shipment status was resolved as the products API does. Bundles,
mix-and-match definitions, split definitions, reservations and posted sales
were included; identified sales were not counted again by current order status.

| Group in the current app projection                    | Available | Reserved | Damaged | Remaining units | Interpretation                                                        |
| ------------------------------------------------------ | --------: | -------: | ------: | --------------: | --------------------------------------------------------------------- |
| Legacy stock excluding the two known supplier failures |       371 |      606 |      74 |           1,051 | 35 products; catalog carrying cost PHP71,788.73, not a physical count |
| Premium Shortsleeves Onesie, shipment 236              |         0 |       90 |       0 |              90 | Delivered; 650 of 740 product units sold                              |
| Four new purchases with no shipment code               |       760 |    4,171 |       0 |           4,931 | App falls back to on-hand; physical arrival is not established        |
| Burp Cloth and Onesie Dress                            |     1,810 |    1,080 |       0 |           2,890 | Known supplier-failed goods; exclude from supportable physical stock  |
| New linked shipments 237-240                           |       563 |    5,145 |       0 |           5,708 | These are in-transit quantities, not physically on hand               |

The 1,051 legacy units include 65 units on three products with no purchase date:
Baby Socks (49), Chickpea Tops (4), and Organic Cotton Willow + Whimsy 2-PC Set
(12). Omitting undated rows would incorrectly produce 986 units/PHP70,863.45.

The unfiltered app shows 2,941 available units, valued at PHP155,811 using selling
prices, not acquisition cost. This includes 1,810 unavailable supplier-failed
units and 760 units whose location is unconfirmed. Excluding the failed goods
leaves 1,131 app-available units at PHP63,603.69 catalog cost, but 760 of those
still need arrival confirmation. These totals do not certify physical stock or
resolve the older PHP54,177 screen value without its original filter/date state.

### Receipt discrepancies: five confirmed purchases and one boundary item

| Product ID and name                                               | Product quantity | Ledger receipts | Product minus ledger |
| ----------------------------------------------------------------- | ---------------: | --------------: | -------------------: |
| 290 Premium Shortsleeves Onesie (October 12 boundary)             |              740 |             700 |                  +40 |
| 299 Premium Footed Pants                                          |              239 |             189 |                  +50 |
| 300 Tribu Footed Pants                                            |              120 |             170 |                  -50 |
| 305 Mayoral Longsleeves Onesie                                    |              305 |             355 |                  -50 |
| 306 Premium Longsleeves Onesie                                    |              130 |              80 |                  +50 |
| 308 Romper (R-102726)                                             |              600 |             580 |                  +20 |
| Net difference across the 20 confirmed after-October-12 purchases |       **10,639** |      **10,619** |              **+20** |
| Same date-inclusive population plus the boundary item             |       **11,379** |      **11,319** |              **+60** |

The two offsetting 50-unit pairs do not prove transfers or a harmless swap.
No reassignment was made. Product 290's ledger has 650 sold and 90 reserved
against only 700 received, leaving sellable at -40, while the product-based
projection gives exactly 90 remaining reserved units.

### Wider legacy drift

- 62 active products have a difference between ledger remaining asset units and the app's remaining units. This compares sellable + reserved + damaged + assembly WIP, avoiding a false exception merely because a reservation changes buckets.
- 51 active products have a negative sellable ledger bucket. Displayed availability floors at zero, so a nonnegative screen is not proof the ledger balances.
- Organic Undies: product quantity 3,600 versus 9,977 ledger receipt units; remaining ledger asset units 6,512 versus app 135, a 6,377-unit difference.
- Mixed Onesie (MO-062626): product quantity 9,100 versus 14,412 ledger receipt units; remaining ledger asset units 5,392 versus app 80, a 5,312-unit difference.
- 28 unresolved nonvirtual ledger codes carry 8,511 asset-bucket units without an active product match. Some are deleted or test-like records. This fresh defined population does not reproduce the earlier 8,525 count; do not silently substitute either as a physical stock count.
- Onesie Dress still appears as 290 available units despite its March refund correction. A refund or cancellation does not itself remove a never-received product's catalog quantity.
- Burp Cloth still appears as 1,520 available plus 1,080 reserved units despite the supplier-failure decision. The log's exclusion was not an inventory-data correction.
- Order 3545 still reserves 50 Girls Onesie units; the ship-or-cancel decision remains open.

Do not run a stock resync or invent receipts to make these differences disappear.
All per-product quantities, movement rows and order matches are retained in the
machine-readable analysis for an owner-approved correction and physical count.

### Opening stock is not ready for another automatic posting

The earlier PHP197,226.11 opening equals PHP71,788.73 legacy ending stock plus
PHP125,430.17 accounting COGS plus PHP7.21 shrinkage. However, that COGS includes
PHP30,888 for Product 290, now confirmed paid in September and received October 13. For reconciliation, pre-cutover goods travelling to the business belong in
the opening in-transit inventory position, followed by the actual arrival's
location reclassification; neither event creates another supplier cash payment.
The current opening rebuild included this product's sold-unit cost but excluded
its remaining 90 reserved units, valued at PHP4,276.80 using saved catalog cost.
That is an apparent omission to investigate, not an approved adjustment: the
product/receipt quantities differ by 40 and actual landed cost is uncertified.
Do not automatically add PHP30,636.64 to October spending or remove PHP30,888
from opening inventory. No replacement opening or reclassification was posted.

## 6. Owner-Confirmed Purchases After October 12

Grand Total includes the saved supplier price, transaction fee and Alibaba
shipping where present; do not subtract those components again. The table is
purchase cost, not proof of a cash payment. Shipment numbers below are suffixes
of KPC 23930A. Product IDs, not matching suffixes or supplied short codes,
identify the two Mayoral Onesie products separately.

These are exactly the owner's 20 confirmed products, resolved to permanent
Product IDs 291-310. They exclude Product 290 on October 12 and the two
never-shipped products. The inclusive database-date query still returns 21
rows/PHP410,271.76, but that is not the same population as purchases after
October 12. No saved purchase date was changed to force the populations to match.

| Product ID | Product                     | October order day |      Units | Grand Total PHP | Saved method | Shipment suffix |
| ---------- | --------------------------- | ----------------: | ---------: | --------------: | ------------ | --------------- |
| 291        | Baby Photoshoot Mat         |                15 |        178 |        2,471.70 | CASH         | 238             |
| 292        | Dreamgrow, Tiny Tots Pants  |                16 |        496 |       19,511.37 | CASH         | 239             |
| 293        | Bibs                        |                16 |        300 |        4,209.20 | CASH         | 238             |
| 294        | Premium Brand Footed Pants  |                16 |        411 |       16,226.82 | CASH         | 239             |
| 295        | Bucket Hats                 |                18 |        700 |       36,157.73 | CASH         | 240             |
| 296        | Skort                       |                18 |        270 |       16,809.20 | CASH         | 240             |
| 297        | H&M Shorts                  |                19 |        394 |       18,219.63 | CASH         | 239             |
| 298        | H&M Pants                   |                19 |        515 |       20,887.30 | CASH         | 239             |
| 299        | Premium Footed Pants        |                19 |        239 |        9,373.41 | CASH         | 237             |
| 300        | Tribu Footed Pants          |                19 |        120 |        4,775.03 | CASH         | 237             |
| 301        | Mayoral Shortsleeves Onesie |                19 |        421 |       20,473.28 | CARD         | 237             |
| 302        | Mayoral Sleeveless Onesie   |                19 |        285 |       13,904.16 | CARD         | 237             |
| 303        | Premium Pants               |                20 |        394 |       16,450.39 | CARD         | 237             |
| 304        | Premium Leggings            |                21 |        550 |       22,426.07 | CASH         | 240             |
| 305        | Mayoral Longsleeves Onesie  |                21 |        305 |       16,974.81 | CASH         | 237             |
| 306        | Premium Longsleeves Onesie  |                21 |        130 |        7,852.58 | CASH         | 237             |
| 307        | Gap Socks                   |                24 |      1,300 |       23,737.14 | CASH         | None            |
| 308        | Romper                      |                27 |        600 |       52,304.50 | CASH         | None            |
| 309        | Dress With Sling Bag        |                27 |         31 |        5,870.80 | CASH         | None            |
| 310        | Baby Bibs                   |                27 |      3,000 |       51,000.00 | CASH         | None            |
| Total      |                             |                   | **10,639** |  **379,635.12** |              |                 |

The earlier simulation represents PHP379,635.12: PHP246,722.68 in 16 product
transit builds plus PHP132,912.44 in four manual purchase journals. Their product
records and posting sources are evidence of the same acquisitions, not extra
purchases to count again.

Saved forwarder/courier/packaging estimates on these 20 total PHP49,690.
The separate Product 290 adds PHP4,530 to the wider database-date population,
bringing that estimate total to PHP54,220; it is not another confirmed window
payment. No
SHIPMENT_LOGISTICS journal exists in the window. Shipment fees for in-transit
237-240 total PHP14,690, but arrival status and a saved fee do not establish
that cash was paid. Do not subtract all these estimates from cash or call them
confirmed missing withdrawals.

## 7. Monthly Dues And Other Expenses

| Reported payment date          | Loan/card         |           PHP | Evidence                                  |
| ------------------------------ | ----------------- | ------------: | ----------------------------------------- |
| October 13                     | GGives            |        664.70 | SIM-DUES journal                          |
| October 14                     | Esquire 2         |      5,666.67 | SIM-DUES journal                          |
| October 15                     | BPI BanKo Negosyo |     10,230.77 | SIM-DUES journal; date needs confirmation |
| October 17                     | BPI Credit Card   |     21,500.00 | SIM-DUES journal                          |
| October 19                     | RCBC Credit       |      6,000.00 | SIM-DUES journal                          |
| October 23                     | Esquire 1         |     11,333.33 | SIM-DUES journal                          |
| October 24                     | GGives 2          |      1,282.84 | SIM-DUES journal                          |
| October 26                     | GLoan 2           |      5,181.00 | SIM-DUES journal                          |
| October 28                     | BPI BanKo Negosyo |     10,230.77 | SIM-DUES journal; date needs confirmation |
| Total reported window payments |                   | **72,090.08** | No principal/interest split               |

These are cash-payment amounts, not all P&L expenses: principal and card
liability settlement are not operating expenses. The two BanKo dates are
13 days apart; no future 14-day anchor is inferred.

The reference schedule was read only for comparison, not imported or posted:

| Schedule segment                            |            PHP | Cash handling                                                                   |
| ------------------------------------------- | -------------: | ------------------------------------------------------------------------------- |
| October 3-9                                 |      52,796.97 | Before this cash bridge; affects opening position, not another window deduction |
| October 13-28                               |      72,090.08 | Matches the nine simulation payments; external proof still needed               |
| October 29, Esquire 2                       |       5,666.67 | Due today; no recorded payment found, so not deducted                           |
| October 30, Eastwest card and personal loan |      10,915.53 | Outside today's window; not deducted                                            |
| Full October reference schedule             | **141,469.25** | Not a paid total or opening loan principal                                      |

The excluded Unionbank, Maya and unapproved BPI Personal Loan rows and
November-start BPI Business Loan amounts are not included. Esquire and BanKo
schedule legs are not treated as separate loan balances.

The only operating expense marked paid in the window is payroll PHP7,500 on
October 18. No other approved/paid expense record in the window establishes
rent, utilities, packaging or other monthly overhead. Their absence is a missing
evidence question, not proof that no such bills were paid. No October-window
refund payout was found; the corrected March Onesie Dress payouts stay outside.

## 8. Required Evidence Before Corrections

1. Confirm combined cash, bank and e-wallet balances immediately before October 12 and the actual closing date/balance being reconciled. The PHP95,945.14 target is not a statement or count.
2. Resolve actual cash/card funding for the 20 confirmed purchases, especially the three CARD rows the simulation funded with Cash. Product 290's September payment is owner-confirmed; obtain source evidence for its exact date and funding account without treating it as October spending. Include actual card repayments without counting purchase cost twice.
3. Confirm when and how KPC 236's PHP1,530 and Lalamove PHP950 were paid, and whether any packaging/other logistics amounts were actually paid.
4. Confirm the nine dues and both BanKo dates. Confirm whether today's Esquire installment has now been paid, with a matching closing balance/date.
5. Obtain missing business-expense and actual household-transfer evidence. Do not replace one Owner Draw plug with another.
6. Count and locate stock: the five confirmed-purchase receipt discrepancies plus the boundary item's discrepancy, the 62 remaining-stock discrepancies, four unlinked shipments, and Girls Onesie reservation need resolution. Never-shipped Burp Cloth and Onesie Dress are not physical stock; investigate any supplier claim separately without inventing a credit/refund or repeating completed customer refunds.
7. Review the PHP4,331 balance-sheet cash fallback and opening-stock composition as separate approved accounting/code corrections. Do not silently change a cutover or replay historical cash.

Until these are supplied, status remains **cash unreconciled, physical stock
unreconciled, and accounting unreconciled**. The next step is evidence review,
not posting October 12 loan openings or changing Owner Draw.

## 9. Evidence And Validation

- [Read-only audit script](../../reports/clothing-oct12-reconciliation-readonly.cjs)
- [Consistent raw snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29.json)
- [Detailed calculations, all product rows, movement rows and order matches](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29.json)
- [Prior simulation and backup log](../plans/clothing-oct12-cutover-reconciliation-log.md)

Validation performed: database read-only/isolation assertions; 243 product
bucket rollforwards; canonical inventory projection; all 25 accounting-date
order/sale quantity comparisons; separate movement/accounting COGS calculations;
independent read-only PostgreSQL receipt, purchase, dues and movement aggregates;
exact-decimal cash cross-foot. Source rules were inspected, not changed.
No browser, app API request, financial fixture, migration, or full application
test suite was used to certify owner balances. External statements and stock
counts remain unavailable. This is an analysis artifact, not a business-rule change.

Repository gates: guardrails:check, lint and typecheck all passed. Lint retains
existing unrelated warnings; PR metadata validation skipped because this was
not a pull-request event. The initial written 21 purchase rows, ten product sales rows
and nine dues rows were parsed and checked against the calculated totals, and
all local report/log links resolved. The guardrail's unrelated automatic LIV-1
date refresh was removed, preserving that report's prior contents.

After the owner clarified scope, the offline analysis was rerun against the
unchanged snapshot. It asserts the exact 20-product identity set, excludes
the two never-shipped products, and records Product 290's unresolved boundary
timing. Current purchase-table and conditional-cash totals supersede the first
draft's additional-purchase assumption; no database or application rule changed.
The revised 20 purchase rows, exact IDs/costs, never-shipped exclusions,
unresolved boundary timing, cash arithmetic and nine local links passed focused
checks. Guardrails, lint and typecheck were rerun and passed with the same
existing lint warnings. No database-writing test or production build was run.

## 10. October 29 Balance-Sheet Follow-Up

A separate read-only snapshot was captured at 01:02:44 Asia/Manila
(2026-10-28T17:02:44.237Z). The other 26 source tables matched the original;
Product 290 alone changed its saved shipment status from Delivered to In
Transit. Its linked shipment remains Delivered and takes precedence in the
Products API. The owner's confirmed October 13 arrival agrees with that linked
shipment. No status or date was changed by this audit.

### Cash: do not use Owner Draw to hide a reporting error

| Check                                                                     |           PHP |
| ------------------------------------------------------------------------- | ------------: |
| Reproduced displayed cash                                                 |     99,331.00 |
| Less older receipts incorrectly inferred as new window cash               |     -4,331.00 |
| Dated-event cash with the existing draw and before unposted delivery fees | **95,000.00** |
| Owner's approximately reported current cash                               | **95,945.14** |
| Difference still to reconcile after removing the fallback                 |    **945.14** |

Simply increasing Owner Draw by PHP3,385.86 to PHP108,339.96 would make the
uncorrected display match the owner's estimate, but would conceal the PHP4,331
reporting issue. It is not a supported withdrawal. If the confirmed PHP2,480
delivery charges were paid from combined Cash inside the window, dated-event
cash with the existing draw would instead be PHP92,520; reconcile those actual
payments and the closing count before considering any draw correction.

### Stock: cost, available selling value and prepared orders differ

The reported Stock on Hand reproduces exactly:
PHP197,226.11 opening - PHP125,430.17 COGS + PHP14.42 scrap-origin receipts

- PHP7.21 shrinkage = **PHP71,803.15**. There are no window Stock on Hand manual
  or arrival reclassification entries in this snapshot. This is a rollforward,
  not a live physical count multiplied by selling prices.

The legacy ending-stock basis used by the earlier opening rebuild excludes
Product 290 and the two never-shipped products:

| Stock category                                             |     Units | Saved catalog cost PHP |
| ---------------------------------------------------------- | --------: | ---------------------: |
| Available, unreserved                                      |       371 |              37,665.79 |
| Reserved, including prepared orders                        |       606 |              30,151.75 |
| Damaged hold                                               |        74 |               3,971.19 |
| Total legacy basis before the rollforward's seed additions | **1,051** |          **71,788.73** |

**Prepared and unpaid goods remain inventory until fulfilled or otherwise
disposed of.** They are unavailable for a new sale, but are not removed from
inventory merely because a customer has not paid. Payment and physical
fulfillment are separate events. The sellable summary excludes reserved units
and uses saved selling prices, not carrying cost. Damaged stock at full catalog
cost also needs recoverability review; this report does not certify that value.

Product 290 has two prepared orders without sale movements: order 3471 has 50
units, PHP345 collected and PHP3,105 outstanding; order 3612 has 40 units, no
collection and PHP2,760 outstanding. All **90 reserved units remain included in
the inventory audit**, alongside the 650 sold units/PHP44,850 fulfilled value.
They are not part of available sellable value. Their catalog cost PHP4,276.80
appears outside the prior opening rebuild's ending-stock basis and needs review
alongside the ledger's 700 receipts versus the product's 740 units.

For the same legacy product population, the available selling-value calculation
reproduces **PHP50,721**, not the owner's PHP54,177. The **PHP3,456 difference
remains unresolved**; an item-level screen/export or physical count with the
same filters and prices is needed. The unfiltered current projection also
includes four unlinked newer products and never-shipped supplier goods, so it
cannot certify the owner's physically held stock. Do not change Stock on Hand
to PHP54,177 or claim the whole difference is prepared orders.

Evidence: [follow-up source snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29-followup.json)
and [follow-up calculations](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29-followup.json).
Both analyses were rerun offline. Exact checks retained eight PSO sales/650
units/PHP44,850, 90 reserved units, September purchase cash exclusion, October
13 arrival, and PHP1,530 + PHP950 = PHP2,480 charges. Both raw snapshot files
were preserved byte-for-byte. No database record or application rule changed.

## 11. Headline Totals Are Balanced, Not Yet Reliable

The owner's screenshot shows Assets PHP550,776.48, Liabilities PHP471,821.72
and Equity PHP78,954.76 as of October 29. A further PostgreSQL-enforced
read-only/repeatable-read comparison at 01:21:15 Asia/Manila verified that all
27 current source tables still match the follow-up snapshot. The calculation
reproduces all three figures; no authenticated HTTP request was performed.

| Reported asset component                              |            PHP |
| ----------------------------------------------------- | -------------: |
| Cash                                                  |      99,331.00 |
| Stock on Hand                                         |      71,803.15 |
| Inventory in Transit                                  |     379,635.12 |
| Inventory Shrinkage, currently classified as an asset |           7.21 |
| Total reported assets                                 | **550,776.48** |

| Reported liability component                                    |            PHP |
| --------------------------------------------------------------- | -------------: |
| Investor funding outstanding                                    |     500,000.00 |
| Book customer-deposit liability                                 |      43,911.80 |
| Debit balances from loan/card payments without opening balances |     -72,090.08 |
| Total reported liabilities                                      | **471,821.72** |

The liability total is net of payment debits on GGives, Esquire 1/2, BanKo,
BPI Credit Card, RCBC Credit, GGives 2 and GLoan 2. There are no window opening
balances for these loan/card debts. Their actual business obligations, opening
balances and principal/interest splits must be established; paying a separate
loan does not reduce the investor principal or customer deposits. The gross
recorded investor-plus-deposit credit balances are PHP543,911.80, but that is
**not a corrected liability total**: the other debts, classifications and
deposit reconciliation remain outstanding.

PHP550,776.48 - PHP471,821.72 = PHP78,954.76 exactly. This confirms arithmetic,
not independently supported equity. Missing openings, the simulated/unverified
PHP104,954.10 Owner Draw and inventory valuation issues can materially change
equity while the equation continues to balance.

**Assessment: a balanced working statement, not an accurate or demonstrably
close-to-actual balance sheet yet.** Known concerns include the PHP4,331 cash
fallback; missing loan/card opening balances; the apparent omitted remaining
PSO carrying value and other inventory drift; unsupported shipment/location
assumptions for unlinked purchases; unverified delivery payment dates; and
Inventory Shrinkage classified as an asset. Do not assign an accuracy percentage
or force the three headline totals to reconcile to estimated cash/selling value.

Prioritize correcting the identified reporting defects under a separate approved
change, then verify actual opening/closing cash, business debt statements,
physical stock and carrying costs, actual delivery payments and owner transfers.
No financial entry, source record, app behavior or balance was changed by this
assessment. The screenshot totals and liability-debit cross-foot passed exact
Decimal assertions.

## 12. Executed Recurring-Fee Simulation Conversion

**This is an authorized development data change, unlike the read-only work in
sections 1-11.** At 01:51:45 Asia/Manila on October 29, the nine existing paid
simulation occurrences for the eight approved creditors were replaced with
recurring EXPENSE records. Their PHP72,090.08 cash deduction is unchanged.
The owner approved full-installment fee treatment for development simulation;
this is not verified loan principal/interest accounting or production policy.

| Preserved October Date | Creditor                  |           PHP |
| ---------------------- | ------------------------- | ------------: |
| 13                     | GGives                    |        664.70 |
| 14                     | Esquire 2                 |      5,666.67 |
| 15                     | BPI BanKo Negosyo Loan    |     10,230.77 |
| 17                     | BPI Credit Card           |     21,500.00 |
| 19                     | RCBC Credit               |      6,000.00 |
| 23                     | Esquire 1                 |     11,333.33 |
| 24                     | GGives 2                  |      1,282.84 |
| 26                     | GLoan 2                   |      5,181.00 |
| 28                     | BPI BanKo Negosyo Loan    |     10,230.77 |
| Total                  | Nine approved occurrences | **72,090.08** |

Exactly 18 old MANUAL lines are soft-deleted, not erased. Eighteen replacement
lines debit `Monthly Dues Expense` and credit `Cash`, sourced from nine APPROVED
recurring drafts. This expense label was checked against the application's
account classifier. All amounts and dates match the originals; bank settlement
dates have not been independently established. Three existing inactive templates
and the unrelated Spotify draft are preserved.

### Cutover And Future Schedules

**Omit pre-October-12 payments from this cash window, not from historical tracking
or future obligations.** The owner confirmed seven paid installments on October
3-9 totaling PHP52,796.97: GLoan 1, GLoan 3, Grab 1, Grab 2, Asialink, Esquire 1
and PNB card. No new cash posting or false APPROVED/SKIPPED record was created for
them. The current schema has no tracking-only historical-paid status; this note
records that confirmation without manufacturing a ledger event.

Ten templates cover the eight creditors, with Esquire 1 and 2 each split into
two due-day rules of the same facility. Normal monthly rules next fall in
November, including Esquire 1's November 8 rule. BanKo remains inactive: the
scheduler supports MONTHLY only, while its 14-day anchor is unresolved (October
15 to 28 is 13 days). Its displayed saved date is the last reported payment,
not an approved next due. Esquire 2's 29th rule is also inactive pending the
short-month policy. An October 29 DRAFT for PHP5,666.67 remains unpaid and has
no journal lines. No October 30 payment was approved. Other CSV facilities were
not added under this eight-creditor authorization.

### Verified Effect And Remaining Risk

A fresh private full development backup and successful forced-rollback rehearsal
preceded apply. The backup archive was listed and hashed, not restored. Read-only
verification passed after commit; a retry returned an idempotent no-op. Across
the 27 audited sources, only journal lines, recurring templates and drafts
changed. All 24 other tables, all unrelated journal rows and existing recurring
records match the prior snapshot. Funding, deposits, inventory, purchases,
openings, customer payments/refunds and Owner Draw were not adjusted.

| Report Basis     | Before Conversion PHP | After Conversion PHP |
| ---------------- | --------------------: | -------------------: |
| Assets           |            550,776.48 |           550,776.48 |
| Liabilities      |            471,821.72 |           543,911.80 |
| Equity           |             78,954.76 |             6,864.68 |
| Reported Cash    |             99,331.00 |            99,331.00 |
| Dated-event Cash |             95,000.00 |            95,000.00 |
| Stock on Hand    |             71,803.15 |            71,803.15 |

The headline totals are cross-footed from the unchanged prior basis and the
exact new journal effect, not a new authenticated HTTP report. Expensing the
repayments removes unsupported debt debit balances; it does not establish actual
loan balances or certify equity. The PHP4,331 reporting fallback, stock issues,
unknown debt principal, unverified PHP104,954.10 draw and delivery-payment dates
remain open. Production is unchanged and is not ready for automatic replication.

Evidence: [execution record](../../reports/clothing-dues-recurring-conversion-result-2026-10-29.json),
[new read-only snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29-post-conversion.json),
[new analysis](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29-post-conversion.json)
and [working log, section 13](../plans/clothing-oct12-cutover-reconciliation-log.md#13-authorized-development-recurring-fee-conversion).
The original and follow-up raw snapshots are preserved separately. The log
records backup details, reviewed source/new ID mapping, approvals, scope and
rollback/retry checks. Application behavior, schema and sibling domains are
unchanged; no migration, production build, commit, push or deployment occurred.

## 13. Final Esquire 3 Payment Addendum

After section 12, the owner confirmed **Esquire 3 was paid PHP11,333.33 on
October 25, 2026 and ended that day**. It was added to development as one
APPROVED recurring-fee occurrence with two balanced expense/Cash lines and an
inactive template ending October 25. This is a new payment, not a replacement;
no future installment was created and no previous record was changed.

| Current Working Figure                      |           PHP |
| ------------------------------------------- | ------------: |
| Paid dues since October 12: ten occurrences | **83,423.41** |
| Reported Cash                               | **87,997.67** |
| Dated-event Cash before unposted fees       | **83,666.67** |
| Stock on Hand, unchanged                    |     71,803.15 |
| Assets on the same report basis             |    539,443.15 |
| Liabilities, unchanged by this payment      |    543,911.80 |
| Equity on the same report basis             |     -4,468.65 |

The additional outflow reduces cash and equity by exactly PHP11,333.33. Owner
Draw is still PHP104,954.10 and was not adjusted to force cash back to a target.
These are provisional simulation figures, not verified actual cash or net worth.
All earlier cash, debt-principal, inventory and logistics-payment caveats remain.
Pre-cutover paid history and unconfirmed October 29/30 payments are unchanged.

A fresh private development backup, archive/hash checks and successful forced
rollback preceded apply. Committed-state verification and exact snapshot
comparisons passed: all 24 other audited tables and every existing journal,
template and draft row are unchanged. Only one completed template, one paid
draft and two lines were added. Prior raw evidence is preserved separately.

Evidence: [final-payment execution record](../../reports/clothing-esquire3-final-result-2026-10-29.json),
[new read-only snapshot](../../reports/clothing-oct12-reconciliation-data-2026-10-29-post-esquire3.json),
[new analysis](../../reports/clothing-oct12-reconciliation-analysis-2026-10-29-post-esquire3.json)
and [working log, section 14](../plans/clothing-oct12-cutover-reconciliation-log.md#14-owner-confirmed-final-esquire-3-payment).
The log records backup details and validation limits: 4,532 unit tests passed;
the isolated test-database integration gate has 20 failures with captured
missing-column P2022 errors. No unrelated schema repair or production change
was attempted. Full-installment expense treatment remains development-only,
not an approved production debt policy.
