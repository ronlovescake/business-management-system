# Master Business Workflow And Standard Operating Procedures

## Employee Knowledge Base: Czarlie & Ron Clothing

Updated: 2026-10-28. This is the single employee procedure manual for Clothing
Operations and Accounting guidance. It replaces the earlier short operating workflow
at this same address. Module contracts explain the software to developers; they
are not alternative employee procedures.

This manual describes the implemented development version. A supervisor must
confirm that the running application has the required release before employees
use a newly added action. The implementation is committed as `ce3f8f5d`, not
deployed by this documentation work. Missing buttons are not permission to use
another business workspace, invent an adjustment or bypass a warning.

### Find The Right Procedure

| Task                                                            | Where To Look           |
| --------------------------------------------------------------- | ----------------------- |
| Add a supplier purchase or set selling prices                   | Steps 1-2               |
| Register a reseller, reserve goods or record payments           | Step 3                  |
| Confirm a shipment, record actual charges and receive goods     | Steps 4-7               |
| Sort, pack, invoice, dispatch or sell on payment terms          | Steps 8-9               |
| Missing supplier goods, cancellation, refund or physical return | Steps 10-11             |
| Check the day's work or hand over to another employee           | Step 12                 |
| A mistake, unknown balance, failed save or unusual situation    | Exception Procedures    |
| A quick answer about money, stock, dates or buttons             | FAQ And Troubleshooting |

<!-- handbook: {"id":"START","modules":["getting-started"],"kind":"reference"} -->

### Before You Start

1. Sign in with your own account and choose Clothing. Do not share administrator
   accounts or use General Merchandise to get around a Clothing restriction.
2. Read the supplier message, order request, payment proof or delivery document.
   A promise is not a payment, and a shipment code is not proof every item arrived.
3. Check the customer, product code, shipment, quantity, amount and date before
   saving. Use the actual business event and the Manila calendar date allowed by
   the form; never invent an earlier date to make a warning disappear.
4. Wait for save confirmation, then reopen or refresh the saved record. A changed
   cell, copied message or temporary tick is not proof the database saved it.
5. If the result is uncertain, check history before repeating the action. Keep
   the same supported retry form; do not open a second form or import the file
   again merely because a response was slow.

<!-- handbook: {"id":"TERMS","modules":["getting-started"],"kind":"reference"} -->

### Words We Use

| Word On Screen            | Everyday Meaning                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Product code              | The label identifying the goods. Check the full name and shipment too; similar codes can belong to different records. |
| Supplier                  | The business selling goods to us; not our reseller customer.                                                          |
| Grand Total               | The saved purchase amount before the separate forwarder, local delivery and packaging costs.                          |
| Reservation Deposit       | The first agreed advance payment toward one order, often 10% or 20%; not an extra fee.                                |
| Installment               | Another payment toward that same order after the original deposit.                                                    |
| Reserved                  | Set aside for an order, but not necessarily received or sold yet.                                                     |
| In transit                | Still travelling; not ready to hand to a reseller.                                                                    |
| On-hand sellable          | Physically here and available to sell. Reserved or damaged goods are not available for a new buyer.                   |
| Supplier credit           | Confirmed usable value we may apply to another eligible purchase from that supplier; not cash in the bank.            |
| Refund Pending            | Money approved to be returned but not yet actually paid back.                                                         |
| Accounts Receivable / A/R | Goods already dispatched for which the customer still owes money.                                                     |
| Cost / COGS               | What the goods cost us, rather than what we charge the customer. COGS means the cost of goods sold.                   |
| Capitalize                | Move a confirmed transport cost into the recorded cost of stock. It is not another vendor payment.                    |
| Cutoff / cutover          | The approved starting date of the current accounting period. Employees must not change it to bypass a problem.        |

<!-- handbook: {"id":"ACCESS","modules":["getting-started"],"kind":"reference"} -->

### Who Can Decide

Employees record supported operational events within their access. An
administrator handles supplier-credit resolution, transit accounting, logistics
accounting, paid-order cancellation decisions, original-deposit confirmation and
dated cost corrections. The business owner approves unresolved policies and
exception designs. Only an authorized release operator performs migrations,
backups or deployment; those are not employee correction steps.

If an action is locked, preserve the record and ask for review. No employee
should erase a payment, change a closed order to an earlier status or reduce an
opening balance simply to make the screen look right.

<!-- handbook: {"id":"S01","modules":["products"],"kind":"workflow"} -->

## **Step 1: Register Products**

**Page:** Products in Clothing Operations (`/clothing/operations/products`).

**What happened:** the supplier confirmed our purchase or reserved the goods.

1. Search Products first to avoid entering the same purchase twice.
2. Choose **Add Product**. Enter the correct product, purchase/posting date,
   ordered quantity, supplier price, currency/exchange rate and known details.
3. Search the **Supplier** selection. Select the existing supplier; for a genuine
   new supplier use the explicit **Add supplier** choice, not just typed text.
4. Choose **Paid** only for an actual supplier payment. Choose **Unpaid** if we
   still owe the supplier. This is not the reseller's payment status.
5. If using a card, select the saved card required by the form. If applying
   supplier credit, follow Exception E02 before saving.
6. Check the full purchase amount and confirmation, save once, and reopen it.
   Link only a confirmed existing shipment; do not invent a placeholder code.

**Example:** order 1,000 baby tops at PHP20 each. The supplier purchase is
PHP20,000 before separate logistics. Enter 1,000 ordered, not 1,100 just because
the supplier later sends free extras. Those extras are recorded when received.

Everything starts on the Products page. We register products in the system after placing an order with our supplier in China.

Once we have paid for the goods or confirmed that the supplier has reserved them for us, we proceed to set the price tiers for each product.

At this stage, we do not yet know the actual freight forwarder's fee (KPC fee) or the Lalamove delivery fee because the goods have not yet arrived at their respective destinations.

It usually takes approximately one week for the goods to travel from the supplier's warehouse to KPC's warehouse in China.

<!-- handbook: {"id":"S02","modules":["prices"],"kind":"workflow"} -->

## **Step 2: Set Price Tiers Using Estimated Logistics Costs**

**Page:** Prices in Clothing Operations (`/clothing/operations/prices`).

**What happened:** we need selling prices before the actual transport bill is known.

1. Confirm the correct product code and the owner's intended selling price.
2. Use **Add Price**, or double-click the existing Product Code to edit its tiers.
3. Review each quantity range and selling price. Do not overlap ranges or leave
   required values blank. Check the price used for a realistic reseller quantity.
4. Save and reopen. A later standard-product Actual Price edit also updates its
   saved tier prices; previous saved order prices are not automatically changed.
5. Do not use Prices CSV import as a small merge: it replaces the saved price
   dataset. Ask an administrator to review a replacement and recovery plan first.

**Example:** an order of 100 tops at PHP50 each is PHP5,000. Estimated freight
helps us choose PHP50; it is not itself a paid logistics bill.

Since we want to accept pre-orders as soon as our supplier confirms our order, we use estimated logistics costs when setting product prices.

These estimates include:

- **KPC forwarding fee:** The estimated cost of shipping the goods from China to the Philippines.
- **Lalamove delivery fee:** The estimated cost of delivering the goods from KPC's warehouse in the Philippines to us.

We base these estimates on our previous shipping and delivery data because the actual costs are not yet available when we register the products and set their prices.

These estimates help us set selling prices and begin accepting pre-orders immediately. They are not a substitute for recording the shipment's actual logistics costs in the accounting workflow.

**User clarification, 2026-10-26:** the in-app Shipping Fee Calculator is only a
pricing-estimate tool and is rarely used. Supplier-credit and delayed-shipment
resolution must not use it. Its behavior is unchanged by these updates.

Product cost fields can also be used by the system to calculate landed unit cost and COGS. Changing a pricing estimate does not automatically reconcile accounting entries that have already been posted. When actual costs become available, record them through the Logistics Costs tab (Step 5) and follow the approved process before changing product cost values.

<!-- handbook: {"id":"S03","modules":["transactions","customers","due-dates"],"kind":"workflow"} -->

## **Step 3: Accept and Record Reseller Pre-Orders**

**Pages:** Customers, then Transactions in Clothing Operations
(`/clothing/operations/customers`, `/clothing/operations/transactions`).

**What happened:** a reseller wants goods, possibly before they arrive.

1. Find the correct customer. If missing, use **Add Customer**, enter the name and
   available contact/address details, and review possible duplicates before
   creating another record. Verify the saved customer after a network warning.
2. Create the order with the correct customer, product code and positive
   quantity. Review the saved tier price, discount and order total.
3. Check whether goods are travelling or physically available. A preorder is
   not permission to dispatch goods still in transit.
4. Record only money actually received using the payment action, not the legacy
   **Adjustment** column. Select the correct order, actual date, payment method
   and amount. Record the original agreed deposit separately from installments.
5. Reopen the order and payment history. Confirm the remaining balance. Do not
   record the same bank transfer on both Transactions and Customers.

**Example:** a PHP1,000 order receives an agreed PHP200 original deposit and a
later PHP300 installment. Total collected is PHP500 and remaining is PHP500,
not PHP300. The deposit is counted once, not again as a separate fee.

Once the price tiers have been added, we can begin accepting pre-orders from our resellers and recording them on the Transactions page.

Our resellers pay a **Reservation Deposit** to reserve the products they order.
This is an advance toward the order price, not a separate charge.

### **3.1 Reservation Deposit Terminology And Allocation**

The following approved rules are implemented for the supported Clothing
collection, cancellation and payout paths. Unknown historical payment/deposit
agreements still need administrator review.

| Term                | Meaning in the clothing workflow                                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Reservation Deposit | Customer money collected in advance for a specific transaction/product code and applied toward that transaction's total price.               |
| Customer Deposits   | Accounting account name for those same reservation deposits while held as a liability. It is not another payment or an additional deduction. |
| Reservation Fee     | Not used. The business does not collect a separate reservation charge or fee.                                                                |
| Remaining Balance   | The transaction total less its collected Reservation Deposit and subsequent payments, each counted once.                                     |
| Forfeited Deposit   | An existing deposit retained under the approved cancellation policy; not another cash receipt.                                               |

The required deposit can be 10% or sometimes 20% of the relevant transaction's
total. These are workflow examples, not a newly mandated universal rate or a new
rate-selection rule.

For example, if a customer orders Baby Socks (`BS-101725`) and Prenatal Tops
(`PT-012426`), a 10% deposit requirement applies separately to each order's total.
Track the amount collected and the remaining balance per transaction/product
code. Do not treat one unallocated customer-level amount as satisfying both
orders or subtract it twice under the two deposit names. A product code identifies
the ordered product; it does not imply all transactions sharing that code are
one payment obligation.

### **3.2 Completion Deadline, Forfeiture, And Refund Exceptions**

**User-confirmed workflow clarification, 2026-10-26:**

- Once the invoice has been sent and the order is **Prepared**, the goods have
  been packed and are ready for dispatch from our warehouse.
- The customer has three days from the invoice date to complete payment for the
  transaction. If payment is not completed after that period, the Reservation
  Deposit is forfeited, subject to approved exceptions.
- Forfeiture changes the treatment of money already collected; it must not
  create another receipt or increase Cash a second time.
- If the supplier cannot provide the reserved goods, for example because they
  were sold to another customer, mark the affected transaction **Voided** and
  refund the deposit. This is not the reseller's fault and must not count against
  them. No delivery or physical return of those goods should be invented.
- A medical emergency can receive consideration through a **normal cancellation**
  and an approved deposit refund. This is not automatically **Voided**, and it
  is not an automatic refund entitlement for every cancellation.
- Refund means money actually paid back; approval of an exception alone is not
  proof that a payout has occurred.

### **3.3 Fully Paid Orders And Additional Installments**

**Further user-confirmed workflow clarification, 2026-10-26:** resellers may
make additional installments after the initial Reservation Deposit, including
paying in full while goods are still in transit. Track all collected amounts
against the same transaction, not just the initial deposit.

| Transaction situation                                                       | Intended handling                                                                                                                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fully paid, awaiting checkout or pickup                                     | Not subject to the three-day payment deadline and must not be canceled for payment overdue. Delayed checkout or pickup alone does not make payment overdue.                                  |
| Fully paid, approved medical or other financial-emergency consideration     | May be canceled with an approved refund. This is a discretionary exception, not an automatic refund entitlement or supplier-failure void.                                                    |
| Partially paid, overdue, with additional installments                       | May approve refunding the additional installments while retaining the entire initial required Reservation Deposit, whether 10% or 20%. Do not automatically forfeit every collected payment. |
| Partially paid, approved medical or other financial-emergency consideration | May approve a full refund of collected funds, including the initial deposit and additional installments.                                                                                     |

For example, on an order totaling 1,000 with an initial 100 deposit and 300 in
additional installments, an approved split can retain 100 and refund 300. An
approved full-refund exception can instead refund all 400. Neither outcome
records a new receipt, and refund approval is not itself a cash payout.

One cancellation can therefore have both a forfeited portion and a refundable
portion. The implemented cancellation decision records explicit retained and
refundable amounts against the recorded collections and prior refunds; the same
money cannot be both retained and refunded. Approval creates Refund Pending,
not a cash payment. Record actual partial or full payouts on Customers. Only
those recorded payouts reduce Refund Pending and Cash. Both the Transactions
reminder and header badge open the shared pending-refund list.

**User-confirmed retention rule, 2026-10-26:** the entire initial required
Reservation Deposit is forfeitable, whether the required rate was 10% or 20%.
A 20% initial required deposit is not capped at 10% when forfeited. Additional
installments are separate from that initial required deposit and are not
automatically forfeited. Preserve the transaction's agreed initial deposit basis;
do not infer the forfeitable amount from total collections or a later rate change.
The additional-installment refund and approved emergency full-refund exception
remain discretionary decisions, not new automatic defaults.

**Approved and implemented deadline:** an invoice dated October 26 is due on
October 29 at 11:59 PM Asia/Manila. Fully paid orders are excluded from payment
overdue. Cancellation remains manual, and only an administrator approves the
money decision. Late-sent or revised invoices need administrator review before
cancellation; do not assume selecting Prepared starts a new three-day period.

Normal cancellation with an approved medical exception remains distinct from
supplier-failure Voided. The implemented approval preserves original receipts,
separates unpaid order balance from money refundable, and does not restock goods.
A label alone never proves that money was kept, paid back or physically returned.

Since we accept pre-orders as soon as our orders are confirmed with the supplier, the goods may still be in China or in transit to the Philippines when the pre-orders are recorded.

<!-- handbook: {"id":"S04","modules":["products","shipments","ledger"],"kind":"workflow"} -->

## **Step 4: Record Transit Build-Up After Shipment Contents Are Confirmed**

**Pages:**

- Products in Clothing Operations (`/clothing/operations/products`).
- Ledger in Clothing Accounting (`/clothing/accounting/ledger`).

**What happened:** KPC has confirmed which purchased products are in a shipment.

1. Confirm the actual product list and supplier funding with the administrator.
2. Resolve wholly delayed products through the dedicated transfer action; do not
   leave them included merely because they were originally expected.
3. The administrator selects a product linked to the shipment and reviews
   **Transit Build-Up** for every eligible product in that shipment, not just the
   clicked row. The amount posted here is supplier Grand Total, not estimated
   freight and courier charges.
4. Verify the saved result and sources. Do not repeat the purchase to settle an
   Unpaid supplier later; the supported Unpaid-to-Paid settlement pays the debt once.

**Example:** three confirmed products belong in KPC shipment A; a fourth is
delayed to shipment B. Do not build or receive all four under A by default.

Under the Products page, **Transit Build-Up** records the product Grand Total in the Accounting Ledger as **Inventory in Transit**. In the current workflow, it does not post the KPC forwarding, Lalamove, or packaging costs; those costs are recorded separately through the Shipments page's **Logistics Costs** tab (Step 5).

The current Transit Build-Up function requires a KPC Shipment Code and posts every eligible product linked to that code. Therefore, use it only after the products actually included in the shipment are confirmed and the products not received have been unlinked (Step 6). Do not post while the product list is provisional. If goods must be recognized at supplier dispatch before a KPC code and confirmed contents exist, confirm the accounting timing with our accountant; do not use a placeholder KPC code.

After the shipment is marked **Delivered**, **Reclass to Stock on Hand** transfers the same amount previously posted for that product from **Inventory in Transit** to **Stock on Hand**. It does not recalculate the amount using corrected shipping costs. The separate logistics costs are capitalized to Stock on Hand through the Logistics Costs workflow.

<!-- handbook: {"id":"S05","modules":["shipments"],"kind":"workflow"} -->

## **Step 5: Track Shipments from China to the Philippines**

**Page:** Shipments in Clothing Operations (`/clothing/operations/shipments`).

**What happened:** KPC provides a real shipment code and later the goods arrive.

1. Find or add the confirmed shipment and update its real progress and dates.
2. Record actual Forwarder, Courier and Packaging charges separately through an
   administrator in **Logistics Costs**. Keep the vendor document/reference.
3. Use **Record Actual Cost** for the confirmed charge, **Pay** for money actually
   paid, and **Capitalize** for the amount added to stock cost after Delivered.
   These are three different events; one is not proof the others happened.
4. Count/check what arrived before marking the relevant shipment **Delivered**.
   Do not mark Delivered merely because the supplier was paid or a truck was booked.
5. On Products, the administrator reviews **Reclass to Stock on Hand** using the
   original posted product sources. Status changes alone do not post this entry.

**Location warning:** explicit In Transit is kept out of on-hand stock, but
other/intermediate or unclear shipment statuses can still use the existing
received-stock display fallback. An on-hand-looking number does not verify
arrival. Check the real location and count; report a discrepancy rather than
inventing a movement or marking Delivered early.

**Example:** actual forwarding is PHP200, paid once and capitalized once. A
later product-cost allocation must not pay the same PHP200 again.

We use KPC as our freight forwarder to transport goods from China to the Philippines. Shipping usually takes approximately one to two months.

Once KPC receives the goods from our supplier in China, we receive the shipment codes and relevant shipment information.

We then record the shipment details on the Shipments page, including:

- Shipment codes
- Shipment weight
- Shipment charges and cost details
- Other relevant shipment information

Recording shipment details and recording the related accounting entries are separate tasks. Use the **Logistics Costs** tab for the accounting entries for KPC, Lalamove, and packaging costs.

### **5.1 Record the Actual KPC Forwarding Fee**

The actual KPC forwarding fee becomes available once the relevant shipment information and charges are known.

On the Shipments page, open **Logistics Costs**, select **Forwarder**, choose
**Record Actual Cost**, and enter the confirmed KPC charge. Pricing estimates
are not prefilled or posted. Record payment when paid, then capitalize the cost
to Stock on Hand once the shipment is Delivered. Payment and capitalization
are limited to the remaining actual-cost balances.

If historical manual journals already exist, guided posting requires review
before recording another charge. Existing entries are preserved, not inferred
or converted automatically. **Adjust Down** is for a confirmed correction to a
recorded actual charge and cannot reduce paid or capitalized cost; it is not an
estimate-to-actual step. Confirm any increase, refund or reversal treatment
before recording a correcting entry. See the [accounting policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md).

### **5.2 Record the Actual Lalamove Delivery Fee**

We only know the actual Lalamove delivery fee once the goods have arrived at KPC's warehouse in the Philippines.

After the goods arrive, which usually takes approximately one to two months from the time KPC receives them in China, we book Lalamove to deliver them.

Once the delivery is booked and the actual fee is known, we record the Lalamove delivery cost under the **Logistics Costs** tab on the Shipments page, selecting the **Courier** vendor.

Follow the same actual-cost sequence: record the confirmed charge, record
payment when paid, and capitalize when Delivered. Do not accrue the estimate
used for product pricing. Legacy entries and corrections need the same review
described for KPC charges above.

<!-- handbook: {"id":"S06","modules":["products","shipments"],"kind":"workflow"} -->

## **Step 6: Link Shipment Codes to Products**

**Page:** Products in Clothing Operations (`/clothing/operations/products`).

**What happened:** we know the actual shipment containing each product.

1. Compare supplier/KPC documents with each product, not just the shipment total.
2. Link only the confirmed shipment. If accounting has already been recorded,
   ask the administrator to use the dedicated delayed-product resolution action.
3. Keep the missing-product explanation and review reseller orders separately.

After recording the shipment details, we return to the Products page and link the shipment codes to the corresponding product codes.

For example, shipment code **KPC 23930A-239** may contain the following products:

1. H\&M Pants (HMP-101926)
2. H\&M Shorts (HMS-101926)
3. Premium Brand Footed Pants (PBFP-101626)
4. Dreamgrow Tiny Tots Pants (DTTP-101626)

However, our supplier does not always ship all the products included in an order.

For example, instead of shipping all four products, the supplier may send only:

1. H\&M Pants (HMP-101926)
2. H\&M Shorts (HMS-101926)
3. Premium Brand Footed Pants (PBFP-101626)

We may initially link the products expected in a shipment while its contents are still being confirmed. Once we know what KPC actually received, keep linked only the products included in that shipment. In this example, Dreamgrow Tiny Tots Pants is missing. Link it to a later shipment only when the supplier confirms its destination.

For an entirely delayed, unreceived product, an administrator can use **Edit
Product > Supplier resolution > Transfer delayed product** to transfer it to the next
existing shipment, for example `KPC 23930A-240`. This preserves original
product-origin funding and records the reason/audit trail. Ordinary shipment-code
edits remain locked while accounting sources exist. Already reclassified,
fulfilled or partially received goods require separate correction.

After the received product list is final, use our separate actual-cost calculator, based on each product's actual received quantity and weight, to allocate the actual KPC and Lalamove fees only across the products received. Enter the resulting per-product amounts in the Products page's cost fields, replacing the estimates rather than adding the actual fees on top of them. The in-app Shipping Fee Calculator remains for estimates and is not our actual-cost accounting tool.

The missing products may be shipped together with our next order. If the supplier
instead confirms future-purchase credit, an administrator records it through
**Edit Product > Supplier resolution > Record supplier credit**.
For the entire missing Dreamgrow product, the user-approved credit is its saved
Grand Total of PHP 19,511.37. The system records Dr Supplier Credits / Cr Inventory
in Transit while preserving the original payment; it is not a cash/card refund.
An already-Paid purchase without a source can have its original acquisition
materialized once to preserve that funding history. An unsettled unpaid purchase
requires payable cancellation/resolution, not an invented funded credit.

Use **Add Product** to apply some/all of an available credit to another purchase
from the same supplier. Record the full new purchase cost; only the uncovered
portion uses cash/card/bank or Supplier Payable. Unused credit remains available.
This process does not read/update the estimate calculator, add logistics fees to
credit, or automatically void/refund reseller transactions. Follow the
[product contract](operations-products.md#supplier-nonfulfillment-and-future-purchase-credit)
for restrictions and the required migration.

<!-- handbook: {"id":"S07","modules":["inventory"],"kind":"workflow"} -->

## **Step 7: Check and Adjust Inventory**

**Page:** Inventory in Clothing Operations (`/clothing/operations/inventory`).

**What happened:** the physical count differs from the purchase quantity, or
we need to check which goods are available.

1. Select the correct product and compare the actual count with orders, sold
   history, reservations and earlier adjustments. Received quantity is not the
   same as today's remaining stock.
2. Use **All Product Codes** when looking for zero-stock or credit-issued goods;
   the default non-zero sellable filter can hide them.
3. Use **Supplier Short** only for genuinely missing supplier quantity. Do not
   also reduce the original ordered quantity for the same missing units.
4. Use **Additionals** for genuine free supplier extras actually received, not
   for correcting paid cost, undoing a sale or making a stock warning disappear.
5. Review the saved adjustment and its reason. Internal stock transfers must use
   the linked transfer form; do not create an outgoing side and forget the incoming side.

**Example:** 1,000 ordered, 880 received and 120 short means 880 physical units.
A PHP5,000 supplier follow-up note does not create PHP5,000 spendable credit.

The Inventory page is where we check available stock and make inventory adjustments when the actual quantities received differ from the quantities ordered.

For example, if we order 1,000 pieces of mixed onesies but the supplier sends only 900 pieces, we record the missing 100 pieces as a **Supplier Short** so the inventory quantity reflects what was actually received.

After recording the Supplier Short, use its resolution details in the Adjustments tab to track whether the missing goods are expected in a later shipment, a supplier credit is pending, a credit was received, or a credit was applied. Add the expected shipment code or credit reference and amount when known. This tracks the supplier follow-up only; it does not post a supplier-credit accounting entry. Confirm the accounting treatment with our accountant before recording a journal entry.

Sometimes, the supplier sends more than the quantity we ordered. In these cases, use the **Additionals** adjustment to reflect the extra quantity received. This updates inventory quantities; it does not by itself create an accounting entry or record a supplier charge.

The owner approved genuine supplier extras at zero purchase cost, sold at the
ordinary customer price. Keep the original paid units' costs; do not spread
their cost across the extras or rewrite old sales. An unknown cost is not a free
item. Example: 1,000 at PHP20 plus 100 free, all sold at PHP50, produces PHP55,000
revenue and PHP20,000 acquisition cost before any separately recorded eligible
logistics. Split-piece cost and customer selling price are also separate.

<!-- handbook: {"id":"S08","modules":["sorting-distribution","invoicing","due-dates"],"kind":"workflow"} -->

## Step 8: Sort, Pack And Invoice

**What happened:** goods are here and the reseller order is being prepared.

1. Use **Sorting and Distribution** for the correct product and check customer
   requests. Review the selected quantity and Add/Deduct message. Rounded
   suggestions may not total exactly; count the physical pieces before packing.
2. Wait for saving and reopen the same product to verify. A summary label alone
   is not a recovery guarantee after a network failure.
3. Check the saved customer/order, actual items, quantity and agreed price.
   Use the Transactions packing/invoice actions only after pending grid saves finish.
4. Set Prepared and the real invoice date only when goods are actually packed.
   A fully paid Prepared order is treated as fulfilled for stock purposes; do
   not create a second manual sale movement when dispatching it.
5. Check the invoice's deposit request and remaining amount, then actually send
   it. An invoice date or PDF generation is not proof the customer received it.
6. In **Invoicing**, review the weight, checkout/payment links and Facebook
   contact before using the message handoff. Paste and send the copied message
   yourself. Local tickboxes reset and are not delivery receipts.
7. Check the Prepared unpaid-order Due Dates list using the agreed invoice
   date. October26 means October29 at 11:59 PM Manila. Do not cancel a fully paid
   order because pickup or checkout is delayed.

**Example:** Ana's PHP1,000 order is packed on October26 and she has paid PHP200.
If the invoice date is October26, the unpaid PHP800 is due by October29 at
11:59 PM Manila, not a new deadline three days after someone later opens the row.
A late-sent or revised invoice needs administrator review before cancellation.

<!-- handbook: {"id":"S09","modules":["dispatch","transactions"],"kind":"workflow"} -->

## Step 9: Checkout, Dispatch And Collect Credit Sales

**What happened:** packed goods are ready to leave, or have been shipped on terms.

1. Confirm the actual parcel, customer, shipping/checkout information and payment
   arrangement. Do not use an available-stock number as proof of parcel handoff.
2. In **Dispatch**, review imported Shopee data and **Possible Match** candidates
   against real customer information. A similarity suggestion is not proof of identity.
3. Link a username only after confirming the customer. Check imported replacement
   data before saving; do not overwrite a working dispatch list blindly.
4. Use the supported shipped update only after real dispatch. Its recent-shipped
   action covers the last 24 hours and eligible Checked Out/Ready For Dispatch
   orders. Review both confirmations and the result counts; separate rows can
   succeed or fail. Reload and resolve only the failed ones.
5. For actual goods shipped with money still owing, use **Accounts Receivable**.
   This is a shipped credit sale, not a reservation. The maximum term is two
   calendar months from shipment; no customer credit-approval tag is required.
6. Record later A/R payments against that same order. Partial/early payment is
   allowed. Do not mark it fully paid while a balance remains; the exact last
   collection changes the saved status to **Shipped** without selling stock twice.
7. Keep A/R follow-up separate from the Prepared three-day Due Dates list. Use
   recorded shipment/due dates and outstanding balances, not an invented penalty.

**Stock warning:** Ready For Dispatch and Checked Out already act as same-day
fulfillment signals. Shipped and Accounts Receivable also consume stock; old
Pending Payment records retain their supported compatibility meaning. Do not
use these labels as harmless preparation notes or enter another sale movement
when changing between fulfilled statuses.

**Example:** ship a PHP1,000 order after collecting PHP200. The customer owes
PHP800. Later PHP300 and PHP500 receipts clear it. Do not collect another deposit,
create another order or deduct another unit of stock at final payment.

<!-- handbook: {"id":"S10","modules":["transactions","customers"],"kind":"workflow"} -->

## **Step 10: Handle Missing Products and Voided Orders**

**Pages:** Transactions for the decision; Customers for actual refund payouts.

**What happened:** the supplier cannot provide the goods reserved by our reseller.

1. Confirm the supplier outcome and identify every affected reseller order.
2. Explain the problem to the reseller. Use supplier-failure **Voided**, not a
   customer-fault cancellation or a new Forfeited status.
3. With no collected money, close the unpaid order through its supported action.
   With collected money, an administrator approves returning eligible remaining
   collections, including installments, with nothing kept.
4. Check **Refund Pending**. It is an obligation, not a completed refund.
5. Open that customer on Customers, record each actual payout against the
   approved refund, then verify the history and remaining pending amount.
6. Do not enter a physical return for goods the reseller never received.

**Example:** a PHP1,000 preorder has PHP200 deposit plus PHP300 installment.
Supplier-failure void approves PHP500 to return, not just PHP200. Paying PHP100
leaves PHP400 pending; approval alone pays nothing.

Sometimes, our supplier accidentally sells products intended for us to another customer. When this happens, the supplier may issue us a credit toward our next purchase instead of sending the missing goods.

If the affected products have already been reserved by our resellers and the supplier can no longer provide them, we explain the situation to the affected resellers, void their transactions, and issue refunds for the Reservation Deposits they have paid. The refund and the voided transaction should both be recorded; do not treat the goods as delivered or returned to the reseller. This supplier-failure outcome is not attributed to reseller fault.

### Distinguish Voided Orders From Sales Returns

For a supplier-failure **Voided** transaction, an administrator approves returning
the remaining eligible collections, including later installments, with nothing
retained. Approval moves the obligation to Refund Pending without moving Cash;
actual Customers payouts reduce the pending obligation and Cash. An unpaid
order balance is removed separately, not paid back as cash. Do not record a
physical return for goods the reseller never received.

Delivered/damaged-item refunds use the separate goods-refund procedure below.
Do not use it to bypass an existing cancellation approval, even after its last
payout. A supplier credit to our business and a cash refund to a reseller are
separate decisions; one does not automatically create or fund the other.

<!-- handbook: {"id":"S11","modules":["customers","inventory"],"kind":"workflow"} -->

## **Step 11: Handle Refunds for Damaged Items and Returned Goods**

**Page:** the customer's detail page, **Return/Refund** area.

**What happened:** delivered goods are damaged, or goods actually come back.

1. Verify the original customer, order, delivered quantity, prior refunds and
   returned quantities. Confirm the owner's decision before paying money back.
2. For an ordinary delivered/damaged-item monetary refund, use **Record Refund**.
   Enter the actual refund date, amount and reason. If the customer keeps the
   goods, leave returned quantity empty; do not restock them.
3. An order with cancellation approval uses its approved payout action, not the
   ordinary refund selector. Pay only the approved remaining amount.
4. For a separate physical event, use **Record Physical Return**. Select the
   original order and actual returned product/component, date, quantity,
   condition/bucket and reason. This action records goods, not another cash refund.
5. Put only resale-ready goods in sellable. Use damaged hold or scrap for the
   actual condition; do not choose sellable to hide damage.
6. Review the saved refund and return histories separately. If the ordinary
   goods-refund form already recorded its optional returned quantity, do not
   record those same units again through the physical-only action.

**Example:** refund PHP250 for five damaged pieces the reseller keeps: money
goes out but zero pieces come back. If two pieces actually arrive later, record
only those two and their real condition, not five invented sellable units.

Most of the refunds we issue are for damaged or defective items.

For example, if a reseller purchases 1,000 pieces of mixed onesies and 50 pieces are damaged, we refund the cost of the 50 defective pieces.

In most cases, the resellers keep the damaged items, and we do not require them to return the goods to avoid causing them additional inconvenience. Record the monetary refund without recording the items as returned to our inventory; handle any inventory adjustment separately if needed.

In rare cases, resellers request to return the items, either because they need the funds back or because they do not like the products. When items are physically returned, record the refund and separately enter the returned quantity and the appropriate restock bucket. A refund by itself does not record returned inventory.

These refunds differ from refunds for voided orders because the reseller has already received the goods in the case of damaged items or returned products, whereas a voided order due to supplier unavailability involves goods that were never delivered to the reseller.

<!-- handbook: {"id":"S12","modules":["getting-started","transactions","inventory","accounting-dashboard"],"kind":"workflow"} -->

## Step 12: Daily Checks And Employee Handover

**What happened:** a shift is ending or another employee will continue the work.

1. Finish or explicitly resolve pending saves. Reopen important product, order,
   receipt, adjustment and refund records; do not hand over unsaved screen values.
2. Compare today's actual customer receipts and payouts with payment proofs and
   saved histories. Keep a deposit, installment and refund as separate events.
3. Review both Refund Pending reminders and confirm which approved amounts are
   still unpaid. Record who will arrange the next real payout; never mark it
   paid merely because it was handed over to another employee.
4. Review unpaid Prepared orders and A/R balances separately. Flag late invoices,
   fully paid goods awaiting pickup, supplier delays and customer promises.
5. Compare physical goods with the correct stock buckets, reservations and
   shipment. Note damaged, missing and loose split pieces without hiding them
   inside sellable stock.
6. Ask the administrator to compare the same report dates, cutoff and accounts.
   Keep unknown-cost warnings and unexplained differences visible. Never enter
   a made-up payment, journal or opening balance just to make totals agree.
7. Leave a handover with customer/order/product/shipment identifiers, what
   actually happened, amount/quantity/date, saved reference, what is unresolved
   and who owns the next action. Use approved internal channels for private data.

**Example:** approved refund PHP500, paid PHP100, pending PHP400. Handover says
"PHP400 still to pay; first payout saved," not "refund completed." A report that
adds up correctly is still not proof the bank balance or physical count agrees.

## Exception Procedures

These are supported steps or explicit review paths, not permission to override a
blocked record. Do not promise customers an unapproved refund, credit, penalty
or delivery date. Preserve original evidence when the expected outcome changes.

<!-- handbook: {"id":"E01","modules":["products","shipments"],"kind":"issue"} -->

### E01: A Whole Product Moves To A Later Shipment

**What happened:** KPC did not receive any of that product; the supplier will send it later.

1. Confirm the whole product is still unreceived and identify the existing later shipment.
2. Ask the administrator to open **Edit Product > Supplier resolution > Transfer
   delayed product**, record the reason, review the date and confirm once.
3. Verify the new linkage and original payment history. If partially received,
   already sold/reclassified or locked, stop for review rather than deleting sources.

**Example:** all 100 pants move from shipment A to B. The supplier is not paid
again, and no reseller automatically receives a refund.

<!-- handbook: {"id":"E02","modules":["products","ledger","balance-sheet"],"kind":"issue"} -->

### E02: A Whole Missing Paid Product Becomes Supplier Credit

**What happened:** the supplier confirms usable credit instead of delivering the entire eligible product.

1. Give the administrator the supplier confirmation and original purchase record.
2. Use **Record supplier credit** in the dedicated Supplier resolution action.
   The amount is the saved whole-product Grand Total, not a freely typed shortage amount.
3. For a replacement, select the same supplier and issued credit, then enter the
   separate amount to apply. Keep the replacement's full purchase total.
4. Review saved credit use, remaining credit and other funding. An unsettled
   Unpaid purchase, partial shortage or already received goods need review instead.

**Example:** PHP5,000 issued credit funds PHP3,000 of a PHP10,000 purchase.
Other funding is PHP7,000 and remaining credit is PHP2,000. No PHP5,000 arrives in Cash.

<!-- handbook: {"id":"E03","modules":["inventory","shipments"],"kind":"issue"} -->

### E03: Only Part Of The Supplier Quantity Arrives

**What happened:** we ordered 1,000 pieces but counted only 880.

1. Recount, check the product/shipment and record **Supplier Short** for 120.
2. Record the expected later shipment or credit reference/amount in follow-up details.
3. Keep the supplier document and ask the owner about any financial resolution.
   The note is not an issued credit. Do not reduce the original quantity again
   or issue whole-purchase credit as a workaround.

**Example:** a PHP5,000 credit follow-up leaves physical quantity 880; it does
not make PHP5,000 selectable when buying another product.

<!-- handbook: {"id":"E04","modules":["inventory","products"],"kind":"issue"} -->

### E04: The Supplier Sends Free Extra Pieces

**What happened:** the supplier sends 1,100 although we paid for 1,000.

1. Confirm the extra 100 are genuinely free and actually arrived.
2. Record **Additionals** for 100 with a clear reason. Keep the paid purchase unchanged.
3. Use the normal approved customer selling price. Do not enter another supplier
   charge, divide old costs across extras or call unknown-cost goods free.

**Example:** buy 1,000 at PHP20, get 100 free, sell all at PHP50: PHP55,000
sales and PHP20,000 acquisition cost, before separately recorded logistics.

<!-- handbook: {"id":"E05","modules":["transactions","customers","prices"],"kind":"issue"} -->

### E05: Wrong Product, Customer, Quantity Or Selling Price

**What happened:** an employee notices an incorrect order field.

1. Check whether it is an editable draft or already paid, invoiced, fulfilled or closed.
2. For an editable draft, correct the actual saved row, review its price/stock
   warnings, wait for the save and reopen it. Clearing/re-entering a product is
   supported where the current database trigger permits it.
3. For a financial/closed order, give the administrator the original and intended
   values. Do not delete/recreate the order, rename a product to another item or
   alter payments to bypass a lock. A price change does not reprice old orders.

**Example:** 10 tops were typed as 100. Correct a clean draft to 10; if paid or
shipped, preserve its receipts and obtain the appropriate reviewed correction.

<!-- handbook: {"id":"E06","modules":["transactions","prices","dispatch","inventory"],"kind":"issue"} -->

### E06: An Import Fails Or Seems Duplicated

**What happened:** a CSV/XLSX request failed, timed out or reported invalid rows.

1. Read the result and search saved records before importing again. Keep the original file.
2. Clothing order creation and stock work roll back together on a reported
   transaction failure, but a lost response may follow success. CSV imports do
   not have the same duplicate-safe identity as a single-row retry.
3. Ask the administrator to review uncertain or replacement imports. Prices
   import replaces its dataset, Dispatch import replaces its imported list, and
   Inventory CSV import/export buttons are simulations, not saved records/files.

**Example:** a 20-order import times out. Verify which records exist first;
importing all 20 again can duplicate already saved orders.

<!-- handbook: {"id":"E07","modules":["inventory"],"kind":"issue"} -->

### E07: Move Stock Or Reverse An Eligible Transfer

**What happened:** goods need another product allocation, or a previous transfer was wrong.

1. Confirm the actual source, destination and remaining units. Never transfer
   a product to itself or transfer travelling goods as if physically received.
2. Use the supported linked transfer in Inventory Adjust, with both products,
   correct date, quantity and reason. Verify both histories after saving.
3. Reverse only remaining eligible original transferred stock through the same
   supported form. Sold/used destination units cannot be invented back; ask for
   review if the reversal is rejected. Do not delete the original transfer.

**Example:** transfer 100 and later sell 20 at the destination. The remaining
80 may be eligible to reverse; returning 100 would recreate sold goods.

<!-- handbook: {"id":"E08","modules":["inventory"],"kind":"issue"} -->

### E08: Goods Are Damaged, Missing Or Scrapped After Arrival

**What happened:** today's physical stock no longer matches resale-ready stock.

1. Identify the product, actual quantity, condition, date and supporting evidence.
2. Use the supported adjustment and correct bucket, with a reason. Keep damaged
   goods out of sellable and do not call warehouse damage a supplier shortage.
3. Verify quantity/history. Ask an administrator to review value or ambiguous
   old costs; do not change the original purchase or delete sold movements.

**Example:** five of 100 received pieces are damaged. Move the actual five to
damaged hold; do not keep all 100 available to new customers.

<!-- handbook: {"id":"E09","modules":["products","inventory","transactions"],"kind":"issue"} -->

### E09: Sell Bundles, Mixes Or Split Pieces

**What happened:** a sale uses several products together, or pieces from a complete set.

1. Create/review the correct Products **Bundles**, **Mix & Match** or **Split**
   definition before entering orders. Include the real products and quantities.
2. For Split, obtain explicit acquisition cost per included piece separately
   from its selling price. Included costs must add up to the parent's recorded cost.
3. Use the defined SKU in Transactions. The supported stock operation preserves
   source costs, consumes components once and uses loose pieces first.
4. Do not edit/delete a used definition or manually consume the parent again.
   Missing costs or insufficient components require review, not guessed allocations.

**Example:** a PHP20 set contains two PHP5-cost tops and one PHP10-cost bottom.
Selling a top for PHP50 does not make PHP50 its acquisition cost.

<!-- handbook: {"id":"E10","modules":["customers","inventory"],"kind":"issue"} -->

### E10: Only Some Original Split Pieces Come Back

**What happened:** the customer returns part of a set or one component of a mix.

1. Use **Record Physical Return** for the original order and select the actual
   originally sold component. Do not select whatever component is cheapest today.
2. Count the real pieces, choose their condition and verify the saved result.
3. Leave an incomplete returned set as loose pieces. Only the complete original
   pieces from the same opening can rebuild a parent once. Do not add a parent manually.

**Example:** one top returns from the PHP20 set above. Stock gets one loose
top, not another PHP20 complete set. Unrelated pieces do not prove the original set returned.

<!-- handbook: {"id":"E11","modules":["shipments","products","profit-loss"],"kind":"issue"} -->

### E11: Actual Transport Cost Changes After Some Goods Sold

**What happened:** confirmed freight or product cost arrives after a sale.

1. Give the administrator the actual charge, prior payment/capitalization and
   product/source records. Do not just overwrite the old sold cost.
2. Use the supported dated cost-correction action only for eligible histories.
   It separates already sold cost from remaining stock and preserves earlier reports.
3. Verify the cost allocation and actual vendor entries. Transformed/ambiguous
   history may reject correction; escalate instead of using a generic journal to force it.

**Example:** 100 units change from PHP20 to PHP22 after four sold. PHP8 is
extra sold cost and PHP192 belongs to remaining stock. The PHP200 is not paid twice.

<!-- handbook: {"id":"E12","modules":["inventory","profit-loss","accounting-dashboard"],"kind":"issue"} -->

### E12: The App Says Profit Is Incomplete Or Cost Is Missing

**What happened:** it cannot prove the cost of some sold or held units.

1. Read the affected products/quantities and check the purchase, source and cost evidence.
2. Give the administrator the missing information. Use a supported correction
   or genuine-zero confirmation only when evidence supports it.
3. Keep the warning visible until resolved. Never type zero or copy the selling
   price simply to make Profit look complete.

**Example:** an old sale has no cost. It is not automatically pure profit or a
free supplier extra just because the cost field is blank.

<!-- handbook: {"id":"E13","modules":["transactions","customers","due-dates"],"kind":"issue"} -->

### E13: A Customer Cancels With Money Already Collected

**What happened:** a partially or fully paid customer cannot continue.

1. Use normal **Cancelled** for a customer request, not supplier-failure Voided.
2. An administrator reviews the original agreed deposit, later installments,
   earlier refunds and reason. The supported decision may retain the whole
   agreed deposit and refund installments, or approve an emergency full refund.
3. Verify the approved split and pending amount. Record actual payouts on Customers;
   do not count approval as cash paid. Keep any physical return separate.

**Example:** PHP1,000 order, original 20% deposit PHP200 plus PHP300 installment.
An approved split retains PHP200 and returns PHP300; approved full relief returns
PHP500. The same PHP200 cannot be both retained and refunded.

<!-- handbook: {"id":"E14","modules":["transactions","customers"],"kind":"issue"} -->

### E14: The Old Deposit Agreement Or Paid Balance Is Unknown

**What happened:** old records lack the agreed initial rate or show unexplained paid adjustments.

1. Stop before taking more money or deciding what deposit to keep.
2. Provide the original invoice, messages, receipts and prior refunds to the administrator.
3. Confirm only a documented original agreement through the supported review.
   Do not assume 10%, treat all installments as a deposit or erase an old overpayment.

**Example:** PHP400 paid is recorded but the initial agreement is missing.
The system must not invent a PHP100 original deposit from that total.

<!-- handbook: {"id":"E15","modules":["customers","transactions"],"kind":"issue"} -->

### E15: There Was An Earlier Refund Or Only Part Can Be Paid Now

**What happened:** part of the collected money was already returned, or payout will happen in stages.

1. Read actual refund/payout history before calculating the remaining eligible amount.
2. Approve only the eligible remainder. Record each real payout separately
   against its approval; do not mark the entire approval paid early.
3. Verify both the new history row and remaining Refund Pending. If a repeat
   conflicts, check whether it already succeeded rather than starting another payout.

**Example:** PHP1,000 collected, PHP900 already refunded leaves at most PHP100
for a collected-money cancellation refund, not another PHP1,000.

<!-- handbook: {"id":"E16","modules":["customers","transactions","journal"],"kind":"issue"} -->

### E16: A Payment Or Completed Refund Was Entered Incorrectly

**What happened:** the saved amount, recipient, date or method may be wrong.

1. Check whether money actually moved and preserve its proof and saved reference.
2. Stop further collection/payout on the disputed event and ask an administrator
   to determine a supported correction. Completed Clothing payouts are not deletable.
3. Do not enter a fake opposite payment, use Adjustment, delete/recreate the
   order or claim a customer returned refund money. That recovery workflow is not supported.

**Example:** PHP100 was paid to the wrong destination. Deleting its row would
not put PHP100 back in the bank; a real recovery needs owner-reviewed handling.

<!-- handbook: {"id":"E17","modules":["transactions","customers","dispatch","due-dates"],"kind":"issue"} -->

### E17: A Paid Order Is Still Awaiting Pickup Or An A/R Payment Is Early

**What happened:** the order is not collected yet, or the debtor pays before their due date.

1. Check the actual remaining balance and fulfillment status.
2. Do not payment-overdue-cancel a fully paid order. Contact the customer about pickup.
3. Accept valid early/partial A/R receipts against the existing debt and keep
   its original dates. Do not delay recording real money until the due date.

**Example:** Ana fully pays October26 but picks up November2. Delayed pickup
is not an unpaid invoice and does not justify forfeiting her payment.

<!-- handbook: {"id":"E18","modules":["invoicing","due-dates"],"kind":"issue"} -->

### E18: An Invoice Was Sent Late, Revised Or Uses The Wrong Date

**What happened:** the recorded date does not match the customer's actual invoice situation.

1. Keep the invoice and real send/revision evidence. Do not silently backdate a new one.
2. Ask an administrator to review the applicable payment deadline before cancelling.
3. Correct only through the supported editable path, then confirm saved data and
   communicate the reviewed deadline. Do not assume a resend automatically restarts it.

**Example:** an October26 invoice first reaches the customer October29. Review
that late-send case; do not automatically keep the deposit on October30.

<!-- handbook: {"id":"E19","modules":["expenses","journal","ledger","balance-sheet","profit-loss"],"kind":"issue"} -->

### E19: An Expense Payment Or Bank Fee Makes Old Reports Change

**What happened:** an older expense is paid later, a paid row is deleted, or Bank Fees looks misclassified.

1. Keep the real expense date, actual payment date, receipt and old/new report scope.
2. Escalate before changing a posted expense's status/date or deleting it as a
   correction. Known expense-history defects remain unresolved; the app can
   move earlier Cash or erase its effect despite balanced totals.
3. Ask the owner/accounting administrator to review Bank Fees classification.
   Do not rename accounts or post invented journals merely to make Profit agree.

**Example:** a September expense paid in October must not be assumed to have
been paid in September. A balanced statement alone cannot prove that timing is right.

<!-- handbook: {"id":"E20","modules":["inventory","accounting-dashboard","journal","ledger","balance-sheet","profit-loss"],"kind":"issue"} -->

### E20: Reports Or Physical Counts Do Not Agree

**What happened:** Inventory, Ledger, P&L or Balance Sheet shows a different number.

1. Match the same product/source, dates, accounting cutoff and accounts first.
   Check whether a screen shows selling-price value, acquisition cost, a
   reservation, a period movement or a full closing balance.
2. Reopen after saving and review missing-cost or incomplete-posting warnings.
3. Give the administrator the exact scope, records, expected result and difference.
   Do not change cutoffs, seed a balancing amount or treat synthetic tests as a bank count.

**Example:** 10 items that cost PHP20 and sell at PHP50 have PHP200 cost but
PHP500 selling value. That difference is not automatically missing money.

<!-- handbook: {"id":"E21","modules":["getting-started","products","transactions","customers","inventory","shipments","sorting-distribution","prices"],"kind":"issue"} -->

### E21: Save Failed, Screen Refreshed Or Another Employee Changed The Row

**What happened:** a draft remains, an older view appears or a conflict message blocks the save.

1. Keep the exact error, intended values and record identity. Do not leave a
   grid with unresolved drafts or refresh away the only copy without review.
2. Use the supported **Refresh and Retry** flow to read saved values first.
   Review another employee's changes before reapplying your intention.
3. **Discard Drafts** abandons local unsaved intentions; it does not undo a saved
   payment/order. After an uncertain response, verify history before any new request.

**Example:** quantity 10 is changed to 12 while another employee updates the
same row. Review the saved 12 and their changes rather than overwriting blindly.

<!-- handbook: {"id":"E22","modules":["getting-started","products","transactions","customers","inventory","shipments","prices","sorting-distribution","invoicing","dispatch","due-dates"],"kind":"issue"} -->

### E22: Required Information Or A Supported Action Is Missing

**What happened:** the supplier, cost, customer, date or required button is unavailable.

1. Check the selected business, product, filters, permissions and loading/error state.
2. Obtain the actual missing information or ask the administrator to confirm
   access/release readiness. Do not invent a supplier, zero cost or shipment code.
3. If the screen still rejects it, hand over the identifiers and message.
   A greyed-out control or server rejection is not permission to use another route.

**Example:** supplier credit does not appear because only a shortage note
exists. Repeated searches cannot turn that note into an issued credit.

## FAQ And Troubleshooting

<!-- handbook: {"id":"F01","modules":["products","transactions"],"kind":"reference"} -->

### Is The Supplier Paid Status The Customer's Paid Status?

No. Products describes what we owe the supplier; Transactions describes what the
reseller owes us. For example, an Unpaid supplier purchase can have a fully paid
reseller preorder. Follow Steps 1 and 3 separately.

<!-- handbook: {"id":"F02","modules":["transactions","customers"],"kind":"reference"} -->

### Does Reservation Deposit Mean An Extra Fee?

No. It is part of the order price and is recorded once per order. A PHP200
deposit on PHP1,000 leaves PHP800, not PHP1,000 plus a fee. See Step 3.1.

<!-- handbook: {"id":"F03","modules":["transactions","customers","due-dates"],"kind":"reference"} -->

### Can I Keep Only 10% When The Original Required Deposit Was 20%?

The approved rule permits the whole agreed initial 20% to be retained in the
appropriate administrator decision. It does not automatically retain later
installments. Use [E13](#e13-a-customer-cancels-with-money-already-collected).

<!-- handbook: {"id":"F04","modules":["due-dates","invoicing"],"kind":"reference"} -->

### When Is An Unpaid Prepared Invoice Due?

At 11:59 PM Manila on the third calendar day after its invoice date. An
October26 invoice is due October29, not exactly 72 hours after a button click.
Late/revised invoices require [E18](#e18-an-invoice-was-sent-late-revised-or-uses-the-wrong-date).

<!-- handbook: {"id":"F05","modules":["due-dates","transactions"],"kind":"reference"} -->

### Does The App Cancel Or Forfeit Automatically?

No. The due list is a review aid; cancellation is manual and money decisions
are administrator actions. Fully paid orders are not payment-overdue.

<!-- handbook: {"id":"F06","modules":["transactions","customers"],"kind":"reference"} -->

### What Is The Difference Between Cancelled And Voided?

Cancelled covers a customer cancellation with its reviewed money split. Voided
for supplier failure keeps nothing from the customer's eligible collections.
Neither word alone proves that cash was refunded or goods returned.

<!-- handbook: {"id":"F07","modules":["customers","transactions"],"kind":"reference"} -->

### Is Refund Pending Already Money Paid Back?

No. Approval PHP500 with payout PHP100 leaves PHP400 unpaid. Use Customers for
the actual next payout, not another approval. See Step 10 and E15.

<!-- handbook: {"id":"F08","modules":["customers","transactions"],"kind":"reference"} -->

### Should I Record A Refund Twice Because Both Reminders Show It?

No. Transactions and the header show the same obligation. Open one and check
history. They are two reminders, not two amounts to pay.

<!-- handbook: {"id":"F09","modules":["customers","inventory"],"kind":"reference"} -->

### The Customer Keeps Damaged Goods. What Should I Enter?

Record the approved actual monetary refund without a returned quantity. No
goods came back. See Step 11; do not add stock merely because cash went out.

<!-- handbook: {"id":"F10","modules":["customers","inventory"],"kind":"reference"} -->

### A Refund Was Recorded With Returned Quantity. Should I Also Use Physical Return?

Not for those same pieces. Verify the movement history first. The physical-only
action is for a separate, not-yet-recorded actual return, not a second restock.

<!-- handbook: {"id":"F11","modules":["transactions","customers"],"kind":"reference"} -->

### Can I Reopen Or Delete A Closed Order To Correct It?

No general reopening/reversal workflow is supported. Preserve payments,
fulfillment and closure history and use [E05](#e05-wrong-product-customer-quantity-or-selling-price)
or [E16](#e16-a-payment-or-completed-refund-was-entered-incorrectly).

<!-- handbook: {"id":"F12","modules":["inventory","products"],"kind":"reference"} -->

### Why Is A Credit-Issued Product Missing From Inventory?

The default non-zero sellable filter hides zero stock. Choose All Product Codes.
Issued credit does not mean the missing goods are physically here.

<!-- handbook: {"id":"F13","modules":["inventory","products"],"kind":"reference"} -->

### Does A Supplier Short Credit Reference Fund The Next Purchase?

No. Only an eligible issued supplier-credit record can do so. The supported
whole-product case is [E02](#e02-a-whole-missing-paid-product-becomes-supplier-credit);
partial-shortage funding is still unsupported under E03.

<!-- handbook: {"id":"F14","modules":["inventory"],"kind":"reference"} -->

### Why Can I Not Transfer Or Reverse All The Units?

Some original units may already be sold, used or unavailable on that date. Use
[E07](#e07-move-stock-or-reverse-an-eligible-transfer); do not change the source history.

<!-- handbook: {"id":"F15","modules":["shipments","inventory","products"],"kind":"reference"} -->

### Does Paying A Supplier Mean The Goods Are On Hand?

No. Physical delivery and financial settlement are separate. A paid travelling
shipment stays travelling. Check receipt evidence, Step 5 and Step 7.

<!-- handbook: {"id":"F16","modules":["shipments","prices"],"kind":"reference"} -->

### Can I Use The Shipping Calculator As The Actual Logistics Bill?

No. It estimates pricing only. An estimated PHP1,000 and actual PHP950 means
only the confirmed PHP950 is recorded as an actual charge. See Step 5.

<!-- handbook: {"id":"F17","modules":["products","profit-loss"],"kind":"reference"} -->

### Why Can I Not Just Edit Yesterday's Cost?

It could change earlier sales or double-count freight. Ask the administrator
about [E11](#e11-actual-transport-cost-changes-after-some-goods-sold).

<!-- handbook: {"id":"F18","modules":["inventory","customers"],"kind":"reference"} -->

### Why Does A Returned Top Not Restore A Whole Set?

Only a complete original set can rebuild once. One top is one loose top until
the other original pieces return. Follow [E10](#e10-only-some-original-split-pieces-come-back).

<!-- handbook: {"id":"F19","modules":["products","inventory"],"kind":"reference"} -->

### Can Split Selling Prices Decide The Pieces' Purchase Costs?

No. Piece acquisition costs must be explicitly confirmed and add up to the
parent cost. A piece can sell at PHP50 but cost PHP5. See E09.

<!-- handbook: {"id":"F20","modules":["products","inventory","profit-loss"],"kind":"reference"} -->

### Does A Zero Cost Mean The Item Was Free?

Not without evidence. Genuine supplier extras have an explicit known-zero
record; missing old costs stay incomplete. See E04 and E12.

<!-- handbook: {"id":"F21","modules":["customers","transactions"],"kind":"reference"} -->

### Why Does My Customer Not Appear In Record Payments?

The chooser needs at least one saved open eligible order. A customer with only
Shipped or closed orders is not a new collection target. Check the saved order
and filters; do not reopen a closed order to force it into the list.

<!-- handbook: {"id":"F22","modules":["invoicing"],"kind":"reference"} -->

### Why Is My Invoice Weight Or Checkout Link Missing?

Check eligible Prepared/On-Hold/Ready For Dispatch orders, the product's actual
weight and a saved checkout link for the calculated weight. Missing product
weights can contribute zero. Obtain correct data; never send a guessed link.

<!-- handbook: {"id":"F23","modules":["invoicing"],"kind":"reference"} -->

### Does A Messenger Tick Prove The Customer Received The Invoice?

No. It is local state after the handoff and resets on reload. Confirm the
message was actually pasted/sent and retain real delivery evidence if needed.

<!-- handbook: {"id":"F24","modules":["inventory","dispatch"],"kind":"reference"} -->

### Can Inventory Or Dispatch CSV Export Be Used As My Backup?

No. Those export controls currently simulate an action, not a real downloaded
file. Use an authorized supported export/backup path and verify the actual file.

<!-- handbook: {"id":"F25","modules":["dispatch"],"kind":"reference"} -->

### Why Did The Dispatch Update Some Rows But Not Others?

Its shipped update makes separate requests. Review the result counts, reload
and resolve the failed rows; do not repeat successful actions blindly. See Step 9.

<!-- handbook: {"id":"F26","modules":["accounting-dashboard","ledger","balance-sheet","profit-loss"],"kind":"reference"} -->

### Why Does A Report Show Different Cash, Profit Or Stock Value?

They measure different things and may have different dates. Match the scope
and warnings under [E20](#e20-reports-or-physical-counts-do-not-agree).
Card money awaiting settlement is not yet available bank Cash.

<!-- handbook: {"id":"F27","modules":["getting-started"],"kind":"reference"} -->

### What Should I Send When Asking For Help?

Send the business, customer/order/product/shipment identifiers, actual event
date, quantity/amount, expected result, exact error and saved reference. Explain
whether cash or goods actually moved and what you already tried. Do not send
passwords or sensitive payment details in screenshots.

## Accounting Procedures

These are employee explanations of the existing Accounting workflows, not
permission to post or a replacement for the accountant's approval. Accounting
screens, imports and posting actions remain administrator-only. Staff without
that access should provide the evidence below to an authorized administrator.

<!-- handbook: {"id":"A01","modules":["accounting-dashboard"],"kind":"accounting"} -->

### Review The Accounting Dashboard

**What happened:** someone needs a summary of business performance or a handover figure.

1. Ask an authorized administrator to open Clothing Accounting and confirm the
   selected period. Year to date stops at today; Full Calendar Year is a different scope.
2. Read revenue, gross profit, net profit and operating expenses separately.
   Operating expenses exclude COGS; they are not the total of every outgoing payment.
3. Keep the report date and any Profit Incomplete notice with the figures.
   The Cash card covers the Cash account, not every asset or unsettled card receipt.
4. For a difference, compare the same period in P&L and the same as-of date in
   Balance Sheet with the administrator. Follow [E20](#e20-reports-or-physical-counts-do-not-agree).

**Example:** PHP5,000 revenue with PHP2,000 COGS and PHP500 operating expenses
means PHP3,000 gross profit and PHP2,500 net profit, not PHP5,000 cash available.

<!-- handbook: {"id":"A02","modules":["expenses"],"kind":"accounting"} -->

### Check An Expense And Its Approval Status

**What happened:** a business expense needs recording or its total looks different from P&L.

1. Give the administrator the real date, category, amount, description and receipt.
   Check for an existing record before requesting another one.
2. Read its status: Pending and Rejected do not financially post; Approved
   records an expense payable; Paid changes the funding, not the expense amount.
3. Compare matching statuses and dates. The operational list/cards/CSV can include
   Pending and Rejected; Approved Total excludes Paid. These are not P&L totals.
4. Keep product purchase and shipment logistics in Products and Shipments.
   Do not request another manual expense for the same capitalized source cost.
5. Escalate later payments, paid-row deletion or historical changes under
   [E19](#e19-an-expense-payment-or-bank-fee-makes-old-reports-change). Known
   settlement-date and deletion defects remain unresolved; do not use deletion
   or a guessed date to correct an earlier report.

**Example:** PHP100 Paid plus PHP50 Pending gives PHP150 in an all-status list,
but only PHP100 of those two records is a financial expense.

<!-- handbook: {"id":"A03","modules":["journal"],"kind":"accounting"} -->

### Trace A Journal Event To Its Source

**What happened:** an amount appears missing, duplicated or on an unexpected date.

1. Ask the administrator to select the relevant Clothing Journal period and
   search the reference, account or description. Keep the actual event date.
2. Read the source and paired debit/credit entries. One payment can have two
   balanced accounting lines; two lines do not mean the customer paid twice.
3. Review filters before comparing totals or CSV. Journal cards and its export
   describe the visible filtered activity, not an account's closing balance.
4. Trace supplier, shipment, customer-money and stock events back to their owning
   workflow. Do not copy a system-generated event into a manual journal or change
   an operational record just to make a searched total look balanced.
5. Preserve original receipts and references. A cancellation approval, actual
   payout and physical return are separate dated events, not interchangeable corrections.

**Example:** a PHP200 deposit produces a money-account debit and a Customer
Deposits credit. It remains one PHP200 receipt, not PHP400 collected.

<!-- handbook: {"id":"A04","modules":["ledger"],"kind":"accounting"} -->

### Read Brought Forward, Period Movement And Closing Balance

**What happened:** a Ledger number does not equal this month's visible transactions.

1. With an administrator, choose the correct period and account in Clothing Ledger.
2. Read Brought Forward as the balance before the period, Period Movement as the
   change inside it, and Closing Balance as their combined result.
3. Search only to find rows. Search and account filters do not restart an
   authoritative running balance at zero. CSV preserves those row balances.
4. An account with no period rows can still have an earlier balance. Do not
   create an opening or receipt just because that account's activity list is empty.
5. For a mismatch, keep the same period, account and reference for administrator
   review under [E20](#e20-reports-or-physical-counts-do-not-agree).

**Example:** Cash brought forward PHP100, receipt PHP25 and payout PHP10 closes
at PHP115. Searching for the receipt still shows its running balance PHP125,
not PHP25.

<!-- handbook: {"id":"A05","modules":["ledger","journal"],"kind":"accounting"} -->

### Request A Supported Manual Entry Without Duplicating A Workflow

**What happened:** a loan, owner contribution or another genuine manual event needs posting.

1. Give an authorized administrator the actual date, amount, reference and proof.
   First check whether an operational workflow already owns or posted the event.
2. For a supported loan or owner event, the administrator uses the guided Ledger
   entry, reviews both accounts and saves once. Principal and interest are
   separate; use the lender's breakdown and consistent loan tag, not a guessed split.
3. Products owns supplier purchases/transit; Shipments owns actual logistics;
   Transactions and Customers own collections, cancellation decisions and payouts.
   A generic journal does not update those source records.
4. Reopen and verify the saved entry. Locked source dependencies require review,
   not a manual opposite entry or deletion to defeat the protection.

**Example:** a loan payment includes PHP1,000 principal and PHP100 interest.
The supported entries reflect that breakdown; PHP1,100 is not all interest expense.

<!-- handbook: {"id":"A06","modules":["ledger"],"kind":"accounting"} -->

### Escalate An Opening Balance Or Cutoff Question

**What happened:** an old balance is missing or someone proposes a balancing opening.

1. Preserve the earlier statement, bank/stock evidence and the exact missing account.
2. Ask the accounting owner to confirm the approved cutoff and supported opening.
   Only an authorized administrator uses Ledger's Opening Balance surface.
3. Openings are balanced debit/credit pairs on the configured cutoff date. They
   are not new cash receipts or a way to rewrite an uncertain legacy deposit.
4. Do not change the cutoff, enter a plug amount or add the same earlier balance
   again as current activity. Unknown payment terms follow
   [E14](#e14-the-old-deposit-agreement-or-paid-balance-is-unknown).

**Example:** a verified PHP200 earlier Cash balance belongs in its approved
opening treatment once, not another PHP200 customer payment this month.

<!-- handbook: {"id":"A07","modules":["balance-sheet"],"kind":"accounting"} -->

### Review A Balance Sheet Snapshot

**What happened:** someone needs to understand stock, money owed or a balanced statement.

1. Ask an administrator to confirm the selected As Of date. This is an
   end-of-day snapshot, not just activity inside a Journal period.
2. Read assets, liabilities and equity separately. Supplier Credits is not Cash;
   Customer Deposits and Refunds Payable represent different obligations.
3. Review the Cash, Stock on Hand and Inventory in Transit breakdowns against
   the underlying records and real bank/physical evidence.
4. Search filters account rows/CSV, not the whole-statement cards or equation.
   A zero equation difference does not prove complete history or correct dates.
5. Report unexplained differences under [E20](#e20-reports-or-physical-counts-do-not-agree).
   Preserve the known expense-history warnings in
   [E19](#e19-an-expense-payment-or-bank-fee-makes-old-reports-change).

**Example:** PHP500 approved refund with PHP100 actually paid leaves PHP400
Refunds Payable. Approval alone does not reduce Cash by PHP500.

<!-- handbook: {"id":"A08","modules":["profit-loss"],"kind":"accounting"} -->

### Review Profit, Costs And Export Scope

**What happened:** reported profit looks surprising or needs checking against a file.

1. With an administrator, select the intended P&L period and read any valuation warning.
2. Gross Profit is Revenue less COGS. Net Profit also subtracts other expenses;
   a supplier purchase, loan principal or owner contribution is not automatically
   an operating expense or sales revenue.
3. Use Details to identify the source, date, product and amount. Missing cost is
   not proof an item was free; follow [E12](#e12-the-app-says-profit-is-incomplete-or-cost-is-missing).
4. Clear summary search when comparing its CSV: the current summary export
   covers the complete selected period, while search scopes visible rows/cards.
   Operational Expenses exports can include statuses that do not post to P&L.
5. Late actual costs need the supported dated correction and administrator
   review under [E11](#e11-actual-transport-cost-changes-after-some-goods-sold),
   not an overwrite of earlier sold cost. Escalate Bank Fees classification under E19.

**Example:** PHP1,000 revenue, PHP400 COGS and PHP100 other expense means PHP600
gross profit and PHP500 net profit. A loan receipt does not increase that profit.

<!-- handbook: {"id":"A09","modules":["journal","ledger","balance-sheet"],"kind":"accounting"} -->

### Distinguish Card Collections From Available Cash

**What happened:** a customer's CARD receipt is saved but the bank has not settled it.

1. Verify the one original receipt in its supported customer-money workflow.
   Do not record the same amount again as a bank payment.
2. Ask the administrator to review Card Collections Clearing, the asset holding
   incoming unsettled card money. This is not outgoing Credit Card Payable.
3. Only the administrator records actual settlement and actual processing fees
   through the supported Ledger presets, using the real date and evidence.
4. Verify the resulting Cash, clearing and fee amounts. Settlement is not a
   second customer receipt and the app does not automatically settle the processor.

**Example:** PHP1,000 card collection settled as PHP970 plus PHP30 actual fee
clears PHP1,000, adds PHP970 Cash and records PHP30 fee, not another PHP1,000 sale.

<!-- handbook: {"id":"A10","modules":["ledger","expenses"],"kind":"accounting"} -->

### Review A Recurring Payment Draft

**What happened:** a scheduled loan or subscription has appeared for review.

1. Give the administrator the real bill/payment evidence and due date.
2. A recurring template is a schedule; a generated draft is not proof of payment.
   The administrator reviews its amount, accounts, reference and existing sources.
3. Only approve the appropriate draft for posting, or skip it when appropriate.
   Reopen its saved status and journal before retrying an uncertain response.
4. Recurring journal posting is separate from the manual Expenses status table.
   Do not create both for the same event. Loan-principal drafts are not interest expense.

**Example:** a PHP500 subscription draft remains unposted until approved.
Generating it again is not a reason to pay or post a second PHP500.

## Source Of Truth And Maintenance

The application's **Clothing > Operations > Employee Handbook** page is at
`/clothing/operations/handbook`. It publishes tagged procedures from this file,
including the curated Accounting explanations, for authenticated staff. Reading
those explanations does not grant Accounting or HR access. The
[page contract](operations-handbook.md) owns metadata, search, stable links,
sanitization and runtime packaging; it is not another employee manual. Preserve
the `handbook` metadata IDs and existing heading anchors when maintaining text.

Use this manual for employee steps. Developers maintain enforcement details in
the [Products](operations-products.md), [Transactions](operations-transactions.md),
[Customers](operations-customers.md), [Inventory](operations-inventory.md),
[Shipments](operations-shipments.md), [Prices](operations-prices.md),
[Invoicing](operations-checkout-links.md), [Sorting](operations-sorting-distribution.md)
and [Dispatch](operations-dispatch.md) contracts. Accounting interpretation
belongs in the [accounting policy](../../OPERATIONAL_WORKFLOW_AND_ACCOUNTING_POLICY.md),
not a second employee SOP.

The [current reconciliation record](../../reports/CLOTHING_SUPPLIER_RECONCILIATION_2026-10-27.md)
owns the 26/26 scenario evidence and open financial findings. The implementation
register at [plan.md](../../../plan.md) retains the original owner requirements;
the [refactor tracker](../../plans/REFACTOR_CHECKLIST.md) owns engineering backlog.
Historical reviews are evidence, not instructions overriding this manual.

Other businesses have intentionally different tables, approvals and payment
rules. Use the [Business Logic Index](../../BUSINESS_LOGIC_INDEX.md) for General
Merchandise, Trucking and Household; do not apply this Clothing SOP to them by
analogy. HR/payroll, backup/restore and unresolved accounting correction policies
are outside this employee manual and require their own authorized owners.

When a supported behavior changes, update the owning contract and this manual
together, remove the superseded procedure, repair its links and record actual
validation. Do not keep another employee manual or copied FAQ elsewhere.
