# **Czarlie & Ron Clothing — Business Operations Workflow**

## **Step 1: Register Products**

**Page:** [http\://localhost:5002/clothing/operations/products](http://localhost:5002/clothing/operations/products)

Everything starts on the Products page. We register products in the system after placing an order with our supplier in China.

Once we have paid for the goods or confirmed that the supplier has reserved them for us, we proceed to set the price tiers for each product.

At this stage, we do not yet know the actual freight forwarder's fee (KPC fee) or the Lalamove delivery fee because the goods have not yet arrived at their respective destinations.

It usually takes approximately one week for the goods to travel from the supplier's warehouse to KPC's warehouse in China.

## **Step 2: Set Price Tiers Using Estimated Logistics Costs**

**Page:** [http\://localhost:5002/clothing/operations/prices](http://localhost:5002/clothing/operations/prices)

Since we want to accept pre-orders as soon as our supplier confirms our order, we use estimated logistics costs when setting product prices.

These estimates include:

- **KPC forwarding fee:** The estimated cost of shipping the goods from China to the Philippines.
- **Lalamove delivery fee:** The estimated cost of delivering the goods from KPC's warehouse in the Philippines to us.

We base these estimates on our previous shipping and delivery data because the actual costs are not yet available when we register the products and set their prices.

These estimates help us set selling prices and begin accepting pre-orders immediately. They are not a substitute for recording the shipment's actual logistics costs in the accounting workflow.

Product cost fields can also be used by the system to calculate landed unit cost and COGS. Changing a pricing estimate does not automatically reconcile accounting entries that have already been posted. When actual costs become available, record them through the Logistics Costs tab (Step 5) and follow the approved process before changing product cost values.

## **Step 3: Accept and Record Reseller Pre-Orders**

**Page:** [http\://localhost:5002/clothing/operations/transactions](http://localhost:5002/clothing/operations/transactions)

Once the price tiers have been added, we can begin accepting pre-orders from our resellers and recording them on the Transactions page.

Our resellers pay a reservation fee to reserve the products they order.

Since we accept pre-orders as soon as our orders are confirmed with the supplier, the goods may still be in China or in transit to the Philippines when the pre-orders are recorded.

## **Step 4: Record Transit Build-Up After Shipment Contents Are Confirmed**

**Pages:**

- Products: [http\://localhost:5002/clothing/operations/products](http://localhost:5002/clothing/operations/products)
- Accounting Ledger: [http\://localhost:5002/clothing/accounting/ledger](http://localhost:5002/clothing/accounting/ledger)

Under the Products page, **Transit Build-Up** records the product Grand Total in the Accounting Ledger as **Inventory in Transit**. In the current workflow, it does not post the KPC forwarding, Lalamove, or packaging costs; those costs are recorded separately through the Shipments page's **Logistics Costs** tab (Step 5).

The current Transit Build-Up function requires a KPC Shipment Code and posts every eligible product linked to that code. Therefore, use it only after the products actually included in the shipment are confirmed and the products not received have been unlinked (Step 6). Do not post while the product list is provisional. If goods must be recognized at supplier dispatch before a KPC code and confirmed contents exist, confirm the accounting timing with our accountant; do not use a placeholder KPC code.

After the shipment is marked **Delivered**, **Reclass to Stock on Hand** transfers the same amount previously posted for that product from **Inventory in Transit** to **Stock on Hand**. It does not recalculate the amount using corrected shipping costs. The separate logistics costs are capitalized to Stock on Hand through the Logistics Costs workflow.

## **Step 5: Track Shipments from China to the Philippines**

**Page:** [http\://localhost:5002/clothing/operations/shipments](http://localhost:5002/clothing/operations/shipments)

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

On the Shipments page, open **Logistics Costs**, select the **Forwarder** vendor, and record the fee. If no estimate has been accrued, accrue the actual amount to clearing. Record payment when the fee is paid, then capitalize the cost to Stock on Hand when the shipment is delivered.

If an estimate was already accrued and the actual fee is lower, use **Adjust Down** to reduce the accrued amount. The current workflow does not provide an **Adjust Up** action. If the actual fee is higher than the accrued estimate, confirm the accounting treatment before recording an additional or correcting entry.

### **5.2 Record the Actual Lalamove Delivery Fee**

We only know the actual Lalamove delivery fee once the goods have arrived at KPC's warehouse in the Philippines.

After the goods arrive, which usually takes approximately one to two months from the time KPC receives them in China, we book Lalamove to deliver them.

Once the delivery is booked and the actual fee is known, we record the Lalamove delivery cost under the **Logistics Costs** tab on the Shipments page, selecting the **Courier** vendor.

Follow the same accounting sequence: accrue the actual amount (or adjust down an existing estimate if the actual amount is lower), record payment when paid, and capitalize the cost to Stock on Hand when the shipment is delivered. If the actual fee is higher than an accrued estimate, confirm the accounting treatment before recording a correcting entry.

## **Step 6: Link Shipment Codes to Products**

**Page:** [http\://localhost:5002/clothing/operations/products](http://localhost:5002/clothing/operations/products)

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

We may initially link the products expected in a shipment while its contents are still being confirmed. Once we know what KPC actually received, keep linked only the products included in that shipment. In this example, unlink Premium Brand Footed Pants and Dreamgrow Tiny Tots Pants. Link them to a later shipment only when they are actually included in it.

If a product already has an active Transit Build-Up or Reclass entry, resolve that accounting entry before changing its Shipment Code. The system prevents changing the code while active entries still reference it.

After the received product list is final, use our separate actual-cost calculator, based on each product's actual received quantity and weight, to allocate the actual KPC and Lalamove fees only across the products received. Enter the resulting per-product amounts in the Products page's cost fields, replacing the estimates rather than adding the actual fees on top of them. The in-app Shipping Fee Calculator remains for estimates and is not our actual-cost accounting tool.

The missing products may be shipped together with our next order. However, there are also cases where the supplier accidentally sells the goods intended for us to another customer. When this happens, the supplier may issue us a credit that we can use toward our next purchase. Record any supplier credit through the approved supplier-credit/accounting process; linking products or adjusting inventory does not record that credit.

## **Step 7: Check and Adjust Inventory**

**Page:** [http\://localhost:5002/clothing/operations/inventory](http://localhost:5002/clothing/operations/inventory)

The Inventory page is where we check available stock and make inventory adjustments when the actual quantities received differ from the quantities ordered.

For example, if we order 1,000 pieces of mixed onesies but the supplier sends only 900 pieces, we record the missing 100 pieces as a **Supplier Short** so the inventory quantity reflects what was actually received.

After recording the Supplier Short, use its resolution details in the Adjustments tab to track whether the missing goods are expected in a later shipment, a supplier credit is pending, a credit was received, or a credit was applied. Add the expected shipment code or credit reference and amount when known. This tracks the supplier follow-up only; it does not post a supplier-credit accounting entry. Confirm the accounting treatment with our accountant before recording a journal entry.

Sometimes, the supplier sends more than the quantity we ordered. In these cases, use the **Additionals** adjustment to reflect the extra quantity received. This updates inventory quantities; it does not by itself create an accounting entry or record a supplier charge.

Any additional pieces sent by the supplier beyond our original order quantity are considered free goods. We do not pay for these additional pieces. Follow the approved accounting policy for how free goods should be valued in inventory.

## **Step 8: Handle Missing Products and Voided Orders**

**Page:** [http\://localhost:5002/clothing/operations/transactions](http://localhost:5002/clothing/operations/transactions)

Sometimes, our supplier accidentally sells products intended for us to another customer. When this happens, the supplier may issue us a credit toward our next purchase instead of sending the missing goods.

If the affected products have already been reserved by our resellers and the supplier can no longer provide them, we explain the situation to the affected resellers, void their transactions, and issue refunds for the reservation fees they have paid. The refund and the voided transaction should both be recorded; do not treat the goods as delivered or returned to the reseller.

### **8.1 Distinguish Voided Orders from Sales Returns**

For a **Voided** transaction with a recorded reservation payment, the ledger keeps that payment in **Customer Deposits** until the refund is recorded. The refund debits **Customer Deposits** and credits **Cash**; it is limited to the reservation payments collected, less prior refunds. A voided transaction cannot record returned inventory because the reseller did not receive the goods.

Refunds for delivered goods continue to be posted as **Sales Returns**. This treatment remains appropriate for goods the reseller received and later returned, or for a refund on damaged or defective goods.

This treatment is generally appropriate when a reseller has received the goods but subsequently returns them or receives a refund for damaged or defective items.

However, when we void an order because the supplier accidentally sold the reserved goods to another customer, the reseller never receives the item.

In these cases, the refund is distinguished from a Sales Return because the reseller never received the goods. The refund is recorded against **Customer Deposits**, not sales returns. Refunds remain credited to **Cash** in the current workflow.

Refunds for damaged goods or goods that were delivered and later returned should continue to be recorded according to the approved returns process. The reason for each refund should be recorded clearly so it can be reviewed and classified correctly.

## **Step 9: Handle Refunds for Damaged Items and Returned Goods**

**Page:** [http\://localhost:5002/clothing/operations/transactions](http://localhost:5002/clothing/operations/transactions)

Most of the refunds we issue are for damaged or defective items.

For example, if a reseller purchases 1,000 pieces of mixed onesies and 50 pieces are damaged, we refund the cost of the 50 defective pieces.

In most cases, the resellers keep the damaged items, and we do not require them to return the goods to avoid causing them additional inconvenience. Record the monetary refund without recording the items as returned to our inventory; handle any inventory adjustment separately if needed.

In rare cases, resellers request to return the items, either because they need the funds back or because they do not like the products. When items are physically returned, record the refund and separately enter the returned quantity and the appropriate restock bucket. A refund by itself does not record returned inventory.

These refunds differ from refunds for voided orders because the reseller has already received the goods in the case of damaged items or returned products, whereas a voided order due to supplier unavailability involves goods that were never delivered to the reseller.
