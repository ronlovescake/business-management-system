# Low Stock Alert System - Implementation Guide

## Overview

Real-time stock validation system to prevent overselling and alert users when creating orders for low-stock or sold-out products.

## ✅ Completed Components

### 1. Stock Check API (`/api/inventory/check-stock`)

**Location:** `src/app/api/inventory/check-stock/route.ts`

**Functionality:**

- Accepts: Product Code + Optional Requested Quantity
- Calculates: AVAILABLE STOCK = QUANTITY - TOTAL ORDER (non-cancelled)
- Returns: Stock status with color-coded alerts

**Status Levels:**

- 🔴 **SOLD_OUT** (0 available) - Blocks order creation
- 🔴 **INSUFFICIENT_STOCK** (requested > available) - Blocks order creation
- 🟡 **LOW_STOCK** (≤10 units) - Warning but allows order
- 🟢 **IN_STOCK** (>10 units) - Normal operation

**Performance:** ~50-200ms response time

### 2. Stock Check Hook (`useStockCheck`)

**Location:** `src/modules/clothing/operations/transactions/hooks/useStockCheck.ts`

**Features:**

- Debounced API calls (500ms default)
- Automatic request cancellation
- Loading and error states
- Manual refetch capability

**Usage:**

```typescript
const { stockInfo, isChecking, error } = useStockCheck({
  productCode: 'MBO-080725',
  requestedQuantity: 50,
  enabled: true, // Only check when needed
  debounceMs: 500,
});
```

### 3. Stock Alert Banner Component

**Location:** `src/modules/clothing/operations/transactions/components/StockAlertBanner.tsx`

**Features:**

- Color-coded alerts (red/yellow based on status)
- Icons and clear messaging
- Dismissible (optional)
- Only shows for low-stock/sold-out items

## 🚧 Integration Needed

### Challenge: Inline Table Editing

The transactions page uses Glide Data Grid for inline editing, which presents integration challenges:

1. **No Traditional Form State**
   - Users type directly into table cells
   - No "Add New" modal or form component
   - Cell edits handled by `useTransactionOperations` hook

2. **Batch Editing Support**
   - Users can paste multiple rows at once
   - Copy/paste operations trigger batch mode
   - Individual cell edits vs. bulk operations

3. **Complex Business Logic**
   - Auto-population of related fields
   - Unit price calculations
   - Order status updates
   - Customer validation

### Recommended Integration Approach

#### Option A: Pre-Save Validation (Recommended)

Add validation in `useTransactionOperations.ts` before saving:

```typescript
// In PRODUCT CODE HANDLER section
if (columnId === 'productCode') {
  const dropdownValue = getCellValue(newValue);

  // NEW: Check stock before saving
  const stockCheck = await fetch('/api/inventory/check-stock', {
    method: 'POST',
    body: JSON.stringify({
      productCode: dropdownValue,
      requestedQuantity: transaction.Quantity || 0,
    }),
  });

  const stockInfo = await stockCheck.json();

  // Block if sold out or insufficient
  if (
    stockInfo.status === 'SOLD_OUT' ||
    stockInfo.status === 'INSUFFICIENT_STOCK'
  ) {
    notifications.show({
      title: '🔴 Cannot Create Order',
      message: stockInfo.message,
      color: 'red',
    });
    return; // Don't save
  }

  // Warn if low stock
  if (stockInfo.status === 'LOW_STOCK') {
    notifications.show({
      title: '🟡 Low Stock Warning',
      message: stockInfo.message,
      color: 'yellow',
    });
    // Continue with save
  }

  // ... existing code continues
}
```

**Pros:**

- ✅ Works with existing architecture
- ✅ Minimal UI changes needed
- ✅ Handles batch operations
- ✅ Simple to implement

**Cons:**

- ⚠️ User only sees alert after typing (not during)
- ⚠️ Adds ~100-200ms latency to each product code edit

#### Option B: Cell Background Coloring

Track stock status and apply background colors to cells:

```typescript
// In getCellContent function
if (col === 2) {
  // Product Code column
  const productCode = data['Product Code'];
  const stockStatus = stockStatusMap.get(productCode);

  return {
    kind: GridCellKind.Text,
    data: productCode,
    displayData: productCode,
    themeOverride:
      stockStatus === 'SOLD_OUT'
        ? { bgCell: '#ffe6e6' } // Red
        : stockStatus === 'LOW_STOCK'
          ? { bgCell: '#fff4e6' } // Yellow
          : undefined,
  };
}
```

**Pros:**

- ✅ Immediate visual feedback
- ✅ Persistent indicator

**Cons:**

- ⚠️ Complex state management
- ⚠️ Requires pre-fetching stock for all visible products
- ⚠️ May color existing rows (not just new ones)

#### Option C: Floating Banner (Hybrid Approach)

Add a banner above the table that appears when editing new rows:

```tsx
{
  /* In TransactionsPage.tsx, above TransactionsLayout */
}
{
  editingNewRow && currentProductCode && (
    <StockAlertBanner
      status={stockInfo?.status || 'IN_STOCK'}
      message={stockInfo?.message || ''}
      productCode={currentProductCode}
      availableStock={stockInfo?.availableStock || 0}
      onClose={() => setEditingNewRow(false)}
    />
  );
}
```

**Pros:**

- ✅ Non-intrusive
- ✅ Only shows for new rows
- ✅ Uses existing component

**Cons:**

- ⚠️ Needs state tracking for "editingNewRow"
- ⚠️ May be overlooked by users

## 📋 Next Steps

### Immediate Actions:

1. **Choose Integration Option** (Recommend: Option A - Pre-Save Validation)
2. **Implement in useTransactionOperations.ts**
3. **Test with real data** (MBO-080725 and other products)
4. **Add user confirmation dialog** for low-stock warnings

### Code Changes Required:

```
src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts
  ├─ Import useStockCheck or create inline fetch
  ├─ Add stock validation in PRODUCT CODE HANDLER
  ├─ Add notifications for sold-out/low-stock
  └─ Prevent save if status is SOLD_OUT or INSUFFICIENT_STOCK

src/modules/clothing/operations/transactions/components/TransactionsPage.tsx
  ├─ Optional: Add StockAlertBanner import
  └─ Optional: Add banner display logic
```

### Testing Checklist:

- [ ] Test with sold-out product (MBO-080725)
- [ ] Test with low-stock product (≤10 units)
- [ ] Test with in-stock product (>10 units)
- [ ] Test batch paste operations
- [ ] Test quantity changes after product code entry
- [ ] Test clearing product code
- [ ] Verify existing rows are not affected

## Performance Considerations

- **API Calls:** 1 per product code edit (debounced 500ms)
- **Response Time:** 50-200ms typical
- **Batch Mode:** Can skip checks during paste, validate on complete
- **Caching:** Consider caching stock status for 30 seconds

## User Experience Flow

### Current Behavior:

```
User types "MBO-080725" → Auto-populates fields → Saves
```

### With Stock Check:

```
User types "MBO-080725"
  → Checks stock (100ms)
  → If SOLD OUT: Shows error, blocks save
  → If LOW STOCK: Shows warning, allows save
  → If IN STOCK: Normal behavior
  → Auto-populates fields → Saves
```

## Color Scheme Reference

- 🔴 **Red (#ffe6e6):** SOLD_OUT, INSUFFICIENT_STOCK
- 🟡 **Yellow (#fff4e6):** LOW_STOCK
- 🟢 **Green:** IN_STOCK (no special styling needed)

## Files Created

1. `/src/app/api/inventory/check-stock/route.ts` ✅
2. `/src/modules/clothing/operations/transactions/hooks/useStockCheck.ts` ✅
3. `/src/modules/clothing/operations/transactions/components/StockAlertBanner.tsx` ✅
4. `/docs/LOW_STOCK_ALERT_IMPLEMENTATION.md` ✅ (this file)

## Git Commits

1. `feat(inventory): add stock check API endpoint` (578538f)
2. `feat(transactions): add useStockCheck hook for real-time stock validation` (ea879a9)
3. `feat(transactions): add StockAlertBanner component for visual stock alerts` (f141ebd)

---

**Status:** Foundation complete, integration pending user decision on approach.
