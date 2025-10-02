# Transactions CSV Import - Auto-Calculation Fix

**Date**: October 3, 2025  
**Issue**: Unit Price and Line Total columns were empty after CSV import  
**Status**: ✅ FIXED

---

## 🐛 Problem

When importing transactions from CSV:

- **Unit Price** column was left empty in CSV (expecting auto-calculation)
- **Line Total** column was left empty in CSV (expecting auto-calculation)
- After import, both columns remained at **0** instead of being auto-populated

**Root Cause**: No API route existed for transactions (`/api/transactions`), so CSV import wasn't working at all.

---

## ✅ Solution

Created `/src/app/api/transactions/route.ts` with the **same finalized business logic** as the frontend transactions page.

### Auto-Calculation Logic Implemented:

#### 1. **Unit Price Auto-Calculation**

```typescript
// ⚠️ FINALIZED FORMULA: Unit Price = Tier Price - Discount

If Unit Price is 0 or empty in CSV:
  1. Lookup Tier Price from prices table using Product Code + Quantity
  2. Convert from cents to pesos (divide by 100)
  3. Subtract Discount: Unit Price = Tier Price - Discount
  4. Import with calculated Unit Price
```

**Example**:

```
CSV Row:
- Product Code: "Regular Mixed Brands Onesies (RMBO-031725)"
- Quantity: 50
- Discount: 0
- Unit Price: (empty)

Processing:
1. Lookup Tier Price for RMBO-031725 with quantity 50
2. Found: 1-10,000 range → ₱47 (stored as 4700 cents)
3. Convert: 4700 / 100 = ₱47
4. Apply discount: ₱47 - ₱0 = ₱47
5. Import with Unit Price = ₱47
```

#### 2. **Line Total Auto-Calculation**

```typescript
// ⚠️ FINALIZED FORMULA: Line Total = (Quantity × Unit Price) - Adjustment

If Line Total is 0 or empty in CSV:
  1. Use Quantity from CSV
  2. Use Unit Price (calculated or from CSV)
  3. Use Adjustment from CSV
  4. Calculate: Line Total = (Quantity × Unit Price) - Adjustment
  5. Import with calculated Line Total
```

**Example**:

```
CSV Row:
- Quantity: 50
- Unit Price: ₱47 (calculated above)
- Adjustment: 0
- Line Total: (empty)

Processing:
1. Calculate: (50 × ₱47) - ₱0
2. Result: ₱2,350
3. Import with Line Total = ₱2,350
```

---

## 📋 API Endpoint Details

### **POST /api/transactions**

**Purpose**: Import transactions from CSV with auto-calculation

**Process**:

1. ✅ Fetch all price tiers from database
2. ✅ Validate and filter CSV rows (remove empty/invalid)
3. ✅ For each valid row:
   - Parse numeric values (handle commas, empty strings)
   - **Auto-calculate Unit Price** if empty/0
   - **Auto-calculate Line Total** if empty/0
   - Set defaults for optional fields
4. ✅ Delete existing transactions (clear before import)
5. ✅ Insert all transactions using `createMany`
6. ✅ Return success with count

**Request Body**:

```json
[
  {
    "Order Date": "Mar 17, 2025",
    "Customers": "Kristel Mae Zuñio | Siel May",
    "Product Code": "Regular Mixed Brands Onesies (RMBO-031725)",
    "Quantity": 50,
    "Unit Price": "", // Will be auto-calculated
    "Discount": 0,
    "Adjustment": 0,
    "Line Total": "", // Will be auto-calculated
    "Order Status": "Warehouse",
    "Notes": "",
    "Invoice Date": "",
    "Packed Date": "",
    "Shipment Code": "KPC 239363A-06190"
  }
]
```

**Response**:

```json
{
  "message": "Successfully imported 6 transaction records",
  "count": 6,
  "filtered": 0
}
```

### **GET /api/transactions**

**Purpose**: Fetch all transactions from database

**Response**:

```json
[
  {
    "id": 1,
    "Order Date": "Mar 17, 2025",
    "Customers": "Kristel Mae Zuñio | Siel May",
    "Product Code": "Regular Mixed Brands Onesies (RMBO-031725)",
    "Quantity": 50,
    "Unit Price": 47, // Auto-calculated during import
    "Discount": 0,
    "Adjustment": 0,
    "Line Total": 2350, // Auto-calculated during import
    "Order Status": "Warehouse",
    "Notes": "",
    "Invoice Date": "",
    "Packed Date": "",
    "Shipment Code": "KPC 239363A-06190"
  }
]
```

### **DELETE /api/transactions**

**Purpose**: Clear all transactions from database

**Response**:

```json
{
  "message": "Successfully deleted 6 transaction records",
  "count": 6
}
```

---

## 🔧 How to Use

### Step 1: Prepare Your CSV

Your CSV should have these columns:

```
ORDER DATE, CUSTOMERS, PRODUCT CODE, QUANTITY, UNIT PRICE, DISCOUNT, ADJUSTMENT, LINE TOTAL, ORDER STATUS, NOTES, INVOICE DATE, PACKED DATE, SHIPMENT CODE
```

**Leave empty**:

- ✅ `UNIT PRICE` column (will auto-calculate)
- ✅ `LINE TOTAL` column (will auto-calculate)

**Example CSV**:

```csv
ORDER DATE,CUSTOMERS,PRODUCT CODE,QUANTITY,UNIT PRICE,DISCOUNT,ADJUSTMENT,LINE TOTAL,ORDER STATUS,NOTES,INVOICE DATE,PACKED DATE,SHIPMENT CODE
Mar 17 2025,Kristel Mae Zuñio | Siel May,Regular Mixed Brands Onesies (RMBO-031725),50,,,0,,Warehouse,,,KPC 239363A-06190
Mar 17 2025,Aika Melanie Dionisio-Longcay,Regular Mixed Brands Onesies (RMBO-031725),50,,,0,,Warehouse,,,KPC 239363A-06190
```

### Step 2: Import via UI

1. Go to Transactions page
2. Click "Import CSV" button
3. Select your CSV file
4. System will:
   - ✅ Parse CSV data
   - ✅ Send to `/api/transactions` (POST)
   - ✅ Auto-calculate Unit Price for each row
   - ✅ Auto-calculate Line Total for each row
   - ✅ Save to database
   - ✅ Refresh the page to show imported data

### Step 3: Verify

Check the imported transactions:

- ✅ **Unit Price** should be populated (e.g., ₱47, ₱155, etc.)
- ✅ **Line Total** should be calculated correctly
- ✅ All other fields should match your CSV

---

## ⚠️ Important Notes

### Formula Consistency

The API route formulas **MUST match** the frontend formulas:

- ✅ **Unit Price** = Tier Price - Discount
- ✅ **Line Total** = (Quantity × Unit Price) - Adjustment

These are **FINALIZED** and protected by warning comments in the code.

### Price Tiers Required

For auto-calculation to work:

1. ✅ Price tiers must exist in the `prices` table
2. ✅ Product Code in CSV must match Product Code in prices
3. ✅ Quantity must fall within a tier range (Lower Limit ≤ Quantity ≤ Upper Limit)

If no matching tier is found:

- Unit Price will be set to **0**
- You'll see a console warning

### Discount Impact

Remember: Discount affects **Unit Price**, not Line Total directly!

**With Discount = ₱5**:

```
Tier Price: ₱155
Unit Price: ₱155 - ₱5 = ₱150
Line Total: (100 × ₱150) - ₱0 = ₱15,000
```

**Without Discount**:

```
Tier Price: ₱155
Unit Price: ₱155 - ₱0 = ₱155
Line Total: (100 × ₱155) - ₱0 = ₱15,500
```

### Order of Calculation

```
1. Parse CSV values (Quantity, Discount, Adjustment, Product Code)
2. Lookup Tier Price from prices table
3. Calculate Unit Price = Tier Price - Discount
4. Calculate Line Total = (Quantity × Unit Price) - Adjustment
5. Save to database
```

---

## 🧪 Testing

### Test Case 1: Empty Unit Price & Line Total

**CSV Input**:

```
Product Code: RMBO-031725
Quantity: 50
Unit Price: (empty)
Discount: 0
Adjustment: 0
Line Total: (empty)
```

**Expected Output**:

```
Unit Price: ₱47 (auto-calculated from tier)
Line Total: ₱2,350 (calculated: 50 × ₱47 - ₱0)
```

### Test Case 2: With Discount

**CSV Input**:

```
Product Code: MBEB-010425
Quantity: 100
Unit Price: (empty)
Discount: 5
Adjustment: 0
Line Total: (empty)
```

**Expected Output**:

```
Tier Price: ₱155
Unit Price: ₱150 (calculated: ₱155 - ₱5)
Line Total: ₱15,000 (calculated: 100 × ₱150 - ₱0)
```

### Test Case 3: With Adjustment

**CSV Input**:

```
Product Code: RMBO-031725
Quantity: 100
Unit Price: (empty)
Discount: 0
Adjustment: 10
Line Total: (empty)
```

**Expected Output**:

```
Unit Price: ₱47 (auto-calculated)
Line Total: ₱4,690 (calculated: 100 × ₱47 - ₱10)
```

---

## 📝 Console Logging

During import, you'll see detailed logs:

```
Loaded 150 price tiers for Unit Price calculation
Filtered 6 valid records from 6 total records

Auto-calculated Unit Price for RMBO-031725 (Qty: 50): 47 - 0 = 47
Auto-calculated Line Total: (50 × 47) - 0 = 2350

Auto-calculated Unit Price for RMBO-031725 (Qty: 50): 47 - 0 = 47
Auto-calculated Line Total: (50 × 47) - 0 = 2350

Successfully imported 6 transaction records
```

This helps you verify that calculations are working correctly!

---

## 🚀 Summary

**Before Fix**:

- ❌ No `/api/transactions` route
- ❌ CSV import not working
- ❌ Unit Price = 0 after import
- ❌ Line Total = 0 after import

**After Fix**:

- ✅ `/api/transactions` route created
- ✅ CSV import working with auto-calculation
- ✅ Unit Price auto-calculated from price tiers
- ✅ Line Total auto-calculated from formula
- ✅ Formulas match frontend exactly
- ✅ Detailed logging for debugging

**You can now leave Unit Price and Line Total empty in your CSV - they will be automatically calculated during import!** 🎉

---

**Reference Documentation**:

- Complete logic: `TRANSACTIONS_LOGIC_SUMMARY.md`
- API route: `src/app/api/transactions/route.ts`
- Frontend: `src/app/clothing/operations/transactions/page.tsx`
