# Transactions Page - Complete Logic & Computation Summary

**File**: `src/app/clothing/operations/transactions/page.tsx`  
**Date**: October 2, 2025

---

## 📋 Table of Contents
1. [Column Overview](#column-overview)
2. [Helper Functions](#helper-functions)
3. [Auto-Population Logic](#auto-population-logic)
4. [Computation Formulas](#computation-formulas)
5. [Column-by-Column Details](#column-by-column-details)

---

## Column Overview

| Column | Type | Auto-Populated | Computed | Editable |
|--------|------|----------------|----------|----------|
| Order Date | Date | ❌ | ❌ | ✅ |
| Customers | Dropdown | ❌ | ❌ | ✅ |
| Product Code | Dropdown | ❌ | ❌ | ✅ |
| Quantity | Number | ❌ | ❌ | ✅ |
| Unit Price | Number | ✅ | ✅ | ✅ |
| Discount | Number | ❌ | ❌ | ✅ |
| Adjustment | Number | ❌ | ❌ | ✅ |
| Line Total | Number | ❌ | ✅ | ❌ (Read-only) |
| Order Status | Dropdown | ✅ | ❌ | ✅ |
| Notes | Text | ❌ | ❌ | ✅ |
| Invoice Date | Date | ❌ | ❌ | ✅ |
| Packed Date | Date | ❌ | ❌ | ✅ |
| Shipment Code | Text | ✅ | ❌ | ✅ |

---

## Helper Functions

### 1. `getUnitPriceForQuantity(productCode, quantity)`
**Purpose**: Lookup the tier price from the prices table based on Product Code and Quantity

**Logic**:
```typescript
- Input: productCode (string), quantity (number)
- Output: Tier price (number) or null

Steps:
1. Filter all price tiers for the given Product Code
2. Find the tier where: quantity >= Lower Limit AND quantity <= Upper Limit
3. Return the Prices value from the matching tier
4. Return null if no match found
```

**Example**:
- Product: "MBEB-010425" (Milkberry)
- Quantity: 100 pcs
- Price Tiers:
  - Lower: 50, Upper: 99, Price: ₱160.00
  - Lower: 100, Upper: 149, Price: ₱155.00 ✅ (Match!)
  - Lower: 150, Upper: 199, Price: ₱150.00
- **Returns**: ₱155.00

---

### 2. `calculateLineTotal(quantity, unitPrice, adjustment)`
**Purpose**: Calculate the Line Total amount

**Formula**: 
```
LINE TOTAL = (QUANTITY × UNIT PRICE) - ADJUSTMENT
```

**Logic**:
```typescript
- Input: quantity (number), unitPrice (number), adjustment (number)
- Output: Line Total (number)

Calculation:
return quantity * unitPrice - adjustment;
```

**Example**:
- Quantity: 100
- Unit Price: ₱150.00
- Adjustment: ₱10.00
- **Line Total**: (100 × ₱150.00) - ₱10.00 = **₱14,990.00**

---

## Auto-Population Logic

### 1. **Unit Price Auto-Population**

**Triggers**:
- When **Product Code** is selected/changed (if Quantity exists)
- When **Quantity** is entered/changed (if Product Code exists)
- When **Discount** is changed (recalculates with new discount)

**Formula**:
```
UNIT PRICE = (TIER PRICE - DISCOUNT)
```

**Logic Flow**:
```typescript
IF Product Code is cleared:
  → Clear Unit Price to 0

ELSE IF Product Code exists AND Quantity > 0:
  1. Lookup Tier Price using getUnitPriceForQuantity()
  2. Get current Discount value
  3. Calculate: Unit Price = Tier Price - Discount
  4. Update Unit Price in the transaction

ELSE IF Quantity <= 0:
  → Clear Unit Price to 0
```

**Examples**:

| Product Code | Quantity | Tier Price | Discount | **Unit Price** |
|--------------|----------|------------|----------|----------------|
| MBEB-010425 | 100 | ₱155.00 | ₱0.00 | **₱155.00** |
| MBEB-010425 | 100 | ₱155.00 | ₱5.00 | **₱150.00** |
| MBEB-010425 | 100 | ₱155.00 | ₱10.00 | **₱145.00** |
| MBEB-010425 | 50 | ₱160.00 | ₱5.00 | **₱155.00** |
| (cleared) | 100 | N/A | ₱5.00 | **₱0.00** |
| MBEB-010425 | 0 | N/A | ₱5.00 | **₱0.00** |

---

### 2. **Shipment Code Auto-Population**

**Trigger**: When **Product Code** is selected

**Logic**:
```typescript
1. Lookup product in productToShipmentMap
2. Get corresponding Shipment Code
3. Auto-populate Shipment Code field
4. Show notification: "Shipment Code auto-populated"
```

**Data Source**: Products page mapping (Product Code → Shipment Code)

---

### 3. **Order Status Auto-Population**

**Trigger**: When **Product Code** is selected

**Conditions**: Only auto-populates if current Order Status is:
- Empty/blank, OR
- "In Transit"

**Logic**:
```typescript
IF current Order Status is blank OR "In Transit":
  1. Lookup product's shipment status from productToShipmentStatusMap
  2. Convert shipment status to order status using getOrderStatusFromShipmentStatus()
  3. Auto-populate Order Status
  4. Show notification: "Order Status auto-populated"

ELSE:
  → Preserve existing Order Status
  → Show notification: "Order Status '{current}' preserved"
```

**Shipment Status to Order Status Mapping**:
- "Arrived" → "Warehouse"
- "In Transit" → "In Transit"
- Other → Keep as-is

---

## Computation Formulas

### Primary Formula: Line Total
```
LINE TOTAL = (QUANTITY × UNIT PRICE) - ADJUSTMENT
```

**Important Notes**:
- ✅ **Unit Price already includes the discount** (Tier Price - Discount)
- ✅ **Discount is NOT subtracted from Line Total** (it affects Unit Price only)
- ✅ **Adjustment is subtracted from Line Total** (order-level adjustment)

### Secondary Formula: Unit Price
```
UNIT PRICE = TIER PRICE - DISCOUNT
```

**Important Notes**:
- ✅ **Tier Price is looked up** from prices table based on Product Code + Quantity
- ✅ **Discount is a per-unit reduction** applied to the tier price
- ✅ **Discount recalculates Unit Price** when discount changes

---

## Column-by-Column Details

### 1. **Order Date**
- **Type**: Date picker
- **Editable**: ✅ Yes
- **Logic**: None - simple date field
- **Auto-Population**: ❌ No
- **Computation**: ❌ No

---

### 2. **Customers**
- **Type**: Dropdown
- **Editable**: ✅ Yes
- **Logic**: Dropdown populated from customers table
- **Auto-Population**: ❌ No
- **Computation**: ❌ No
- **Data Source**: `customerNames` state (loaded from `/api/customers`)

---

### 3. **Product Code**
- **Type**: Dropdown
- **Editable**: ✅ Yes
- **Logic**: 
  1. Dropdown populated from prices table (unique product codes)
  2. **Triggers auto-population** of:
     - Shipment Code
     - Order Status (conditionally)
     - Unit Price (if Quantity exists)
- **Auto-Population**: ❌ No (but triggers other fields)
- **Computation**: ❌ No
- **Data Source**: `productCodes` state (loaded from `/api/prices`)

**Handler Logic**:
```typescript
When Product Code changes:
1. Get selected product code value
2. Lookup Shipment Code from productToShipmentMap
3. Lookup Shipment Status from productToShipmentStatusMap
4. IF Order Status is blank or "In Transit":
   → Auto-populate Order Status from shipment status
   ELSE:
   → Keep existing Order Status
5. IF Quantity > 0:
   → Lookup Tier Price using getUnitPriceForQuantity()
   → Calculate Unit Price = Tier Price - Discount
   → Update Unit Price
   ELSE IF Product Code is cleared:
   → Clear Unit Price to 0
6. Show notification with all auto-populated fields
```

---

### 4. **Quantity**
- **Type**: Number input
- **Editable**: ✅ Yes
- **Logic**: 
  1. User enters quantity value
  2. **Triggers auto-population** of Unit Price (if Product Code exists)
  3. **Triggers computation** of Line Total
- **Auto-Population**: ❌ No
- **Computation**: ❌ No (but used in computations)

**Handler Logic**:
```typescript
When Quantity changes:
1. Get new quantity value
2. IF Quantity <= 0:
   → Clear Unit Price to 0
3. ELSE IF Product Code exists AND Quantity > 0:
   → Lookup Tier Price using getUnitPriceForQuantity()
   → Calculate Unit Price = Tier Price - Discount
   → Update Unit Price
4. Calculate Line Total = (Quantity × Unit Price) - Adjustment
5. Update transaction with new Quantity, Unit Price, Line Total
6. Show notification
```

---

### 5. **Unit Price** ⭐
- **Type**: Number input (currency)
- **Editable**: ✅ Yes (manual override allowed)
- **Logic**: 
  - **Auto-populated** when Product Code or Quantity changes
  - **Recalculated** when Discount changes
  - Can be manually edited to override auto-populated value
- **Auto-Population**: ✅ Yes
- **Computation**: ✅ Yes

**Formula**:
```
UNIT PRICE = TIER PRICE - DISCOUNT
```

**Handler Logic**:
```typescript
When Unit Price manually changed:
1. Get new unit price value
2. Calculate Line Total = (Quantity × Unit Price) - Adjustment
3. Update transaction with new Unit Price and Line Total
4. Show notification
```

**Auto-Population Scenarios**:

| Scenario | Action |
|----------|--------|
| Product Code selected (Quantity exists) | Lookup tier price, apply discount, set Unit Price |
| Quantity entered (Product Code exists) | Lookup tier price, apply discount, set Unit Price |
| Discount changed | Lookup tier price, apply new discount, recalculate Unit Price |
| Product Code cleared | Clear Unit Price to 0 |
| Quantity cleared/zero | Clear Unit Price to 0 |
| Manual edit | Accept manual value, calculate Line Total |

---

### 6. **Discount**
- **Type**: Number input (currency)
- **Editable**: ✅ Yes
- **Logic**: 
  1. Per-unit discount amount
  2. **Triggers recalculation** of Unit Price
  3. **Triggers recalculation** of Line Total (indirectly through Unit Price)
- **Auto-Population**: ❌ No
- **Computation**: ❌ No (but affects computations)

**Handler Logic**:
```typescript
When Discount changes:
1. Get new discount value
2. IF Product Code exists AND Quantity > 0:
   → Lookup Tier Price using getUnitPriceForQuantity()
   → Calculate Unit Price = Tier Price - New Discount
   → Update Unit Price
3. Calculate Line Total = (Quantity × Unit Price) - Adjustment
4. Update transaction with new Unit Price, Discount, Line Total
5. Show notification
```

**Example Impact**:
```
Product: MBEB-010425, Quantity: 100, Tier Price: ₱155.00

Discount: ₱0.00
→ Unit Price: ₱155.00
→ Line Total: (100 × ₱155.00) - ₱10.00 = ₱15,490.00

Discount: ₱5.00
→ Unit Price: ₱150.00 (recalculated!)
→ Line Total: (100 × ₱150.00) - ₱10.00 = ₱14,990.00

Discount: ₱10.00
→ Unit Price: ₱145.00 (recalculated!)
→ Line Total: (100 × ₱145.00) - ₱10.00 = ₱14,490.00
```

---

### 7. **Adjustment**
- **Type**: Number input (currency)
- **Editable**: ✅ Yes
- **Logic**: 
  1. Order-level adjustment (positive or negative)
  2. **Triggers recalculation** of Line Total
- **Auto-Population**: ❌ No
- **Computation**: ❌ No (but used in computation)

**Handler Logic**:
```typescript
When Adjustment changes:
1. Get new adjustment value
2. Calculate Line Total = (Quantity × Unit Price) - Adjustment
3. Update transaction with new Adjustment and Line Total
4. Show notification
```

**Example Impact**:
```
Quantity: 100, Unit Price: ₱150.00

Adjustment: ₱0.00
→ Line Total: (100 × ₱150.00) - ₱0.00 = ₱15,000.00

Adjustment: ₱10.00
→ Line Total: (100 × ₱150.00) - ₱10.00 = ₱14,990.00

Adjustment: -₱50.00 (negative = add to total)
→ Line Total: (100 × ₱150.00) - (-₱50.00) = ₱15,050.00
```

---

### 8. **Line Total** ⭐
- **Type**: Number display (currency, read-only)
- **Editable**: ❌ No (computed field)
- **Logic**: Automatically calculated whenever Quantity, Unit Price, or Adjustment changes
- **Auto-Population**: ❌ No
- **Computation**: ✅ Yes

**Formula**:
```
LINE TOTAL = (QUANTITY × UNIT PRICE) - ADJUSTMENT
```

**Recalculation Triggers**:
- ✅ Quantity changes
- ✅ Unit Price changes (manual or auto-populated)
- ✅ Discount changes (triggers Unit Price recalculation → Line Total updates)
- ✅ Adjustment changes

**Handler Logic**:
```typescript
Line Total is NOT directly editable.
It is automatically recalculated in these handlers:
- Quantity handler
- Unit Price handler
- Discount handler (via Unit Price recalculation)
- Adjustment handler
```

---

### 9. **Order Status**
- **Type**: Dropdown
- **Editable**: ✅ Yes
- **Logic**: 
  - **Auto-populated** when Product Code changes (conditionally)
  - Only auto-populates if current status is blank or "In Transit"
  - Otherwise preserves existing status
- **Auto-Population**: ✅ Yes (conditional)
- **Computation**: ❌ No

**Available Options**:
- In Transit
- Warehouse
- Prepared
- Ready For Dispatch
- Checked Out
- Lalamove
- On-Hold
- Pending Payment

**Handler Logic**:
```typescript
When Order Status manually changed:
1. Get selected status value
2. Update transaction with new Order Status
3. Show notification
```

**Auto-Population Logic** (from Product Code handler):
```typescript
Current Status: blank or "In Transit"
→ Auto-populate from product's shipment status

Current Status: any other value (e.g., "Warehouse", "Prepared")
→ Preserve existing status (no auto-population)
```

---

### 10. **Notes**
- **Type**: Text input
- **Editable**: ✅ Yes
- **Logic**: None - free text field for comments
- **Auto-Population**: ❌ No
- **Computation**: ❌ No

---

### 11. **Invoice Date**
- **Type**: Date picker
- **Editable**: ✅ Yes
- **Logic**: None - simple date field
- **Auto-Population**: ❌ No
- **Computation**: ❌ No

---

### 12. **Packed Date**
- **Type**: Date picker
- **Editable**: ✅ Yes
- **Logic**: None - simple date field
- **Auto-Population**: ❌ No
- **Computation**: ❌ No

---

### 13. **Shipment Code**
- **Type**: Text input
- **Editable**: ✅ Yes (auto-populated but can override)
- **Logic**: **Auto-populated** when Product Code is selected
- **Auto-Population**: ✅ Yes
- **Computation**: ❌ No
- **Data Source**: `productToShipmentMap` (Product Code → Shipment Code mapping from products table)

**Handler Logic**:
```typescript
Shipment Code is NOT directly handled (no dedicated handler).
It is auto-populated in the Product Code handler.
Can be manually edited after auto-population.
```

---

## Complete Example Workflow

Let's walk through a complete transaction entry:

### Step 1: Select Product Code
**Action**: Select "MBEB-010425" (Milkberry)

**Result**:
- ✅ Shipment Code auto-populated: "SHIP-001"
- ✅ Order Status auto-populated: "Warehouse" (if was blank/In Transit)
- ❌ Unit Price: 0 (no quantity yet)
- **Notification**: "Product Code updated successfully and Shipment Code & Order Status auto-populated"

---

### Step 2: Enter Quantity
**Action**: Enter 100

**Result**:
- ✅ Tier Price looked up: ₱155.00 (100 is in 100-149 range)
- ✅ Discount: ₱0.00 (default)
- ✅ Unit Price calculated: ₱155.00 - ₱0.00 = **₱155.00**
- ✅ Adjustment: ₱0.00 (default)
- ✅ Line Total calculated: (100 × ₱155.00) - ₱0.00 = **₱15,500.00**
- **Notification**: "Quantity updated and Unit Price auto-populated"

---

### Step 3: Add Discount
**Action**: Enter ₱5.00

**Result**:
- ✅ Tier Price re-looked up: ₱155.00
- ✅ Unit Price recalculated: ₱155.00 - ₱5.00 = **₱150.00**
- ✅ Line Total recalculated: (100 × ₱150.00) - ₱0.00 = **₱15,000.00**
- **Notification**: "Discount updated successfully"

---

### Step 4: Add Adjustment
**Action**: Enter ₱10.00

**Result**:
- ✅ Unit Price unchanged: ₱150.00 (adjustment doesn't affect unit price)
- ✅ Line Total recalculated: (100 × ₱150.00) - ₱10.00 = **₱14,990.00**
- **Notification**: "Adjustment updated successfully"

---

### Final Transaction State:

| Field | Value | How It Got There |
|-------|-------|------------------|
| Product Code | MBEB-010425 | User selected |
| Quantity | 100 | User entered |
| Tier Price | ₱155.00 | Auto-looked up from prices table |
| Discount | ₱5.00 | User entered |
| **Unit Price** | **₱150.00** | **Computed: ₱155.00 - ₱5.00** |
| Adjustment | ₱10.00 | User entered |
| **Line Total** | **₱14,990.00** | **Computed: (100 × ₱150.00) - ₱10.00** |
| Shipment Code | SHIP-001 | Auto-populated from product |
| Order Status | Warehouse | Auto-populated from product |

---

## Key Takeaways

### 🎯 Auto-Population
1. **Unit Price** auto-populates when Product Code + Quantity exist
2. **Shipment Code** auto-populates when Product Code selected
3. **Order Status** conditionally auto-populates when Product Code selected

### 🧮 Computations
1. **Unit Price** = Tier Price - Discount
2. **Line Total** = (Quantity × Unit Price) - Adjustment

### 🔄 Recalculation Triggers
- **Unit Price recalculates** when: Product Code, Quantity, or Discount changes
- **Line Total recalculates** when: Quantity, Unit Price, Discount (via Unit Price), or Adjustment changes

### 💡 Important Rules
- ✅ Discount affects **Unit Price** (per-unit discount)
- ✅ Adjustment affects **Line Total** (order-level adjustment)
- ✅ Discount is NOT subtracted from Line Total (already in Unit Price)
- ✅ Unit Price can be manually overridden after auto-population
- ✅ Order Status preserves existing value unless it's blank or "In Transit"

---

## Data Flow Diagram

```
┌─────────────────┐
│  Product Code   │──┐
└─────────────────┘  │
                     ├──→ Lookup Tier Price ──┐
┌─────────────────┐  │                         │
│    Quantity     │──┘                         │
└─────────────────┘                            ├──→ Unit Price = Tier Price - Discount
                                               │
┌─────────────────┐                            │
│    Discount     │────────────────────────────┘
└─────────────────┘

┌─────────────────┐
│    Quantity     │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  ├──→ Line Total = (Quantity × Unit Price) - Adjustment
│   Unit Price    │──┤
└─────────────────┘  │
                     │
┌─────────────────┐  │
│   Adjustment    │──┘
└─────────────────┘
```

---

**End of Document**
