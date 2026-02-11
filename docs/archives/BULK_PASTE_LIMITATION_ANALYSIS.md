# Bulk Paste Limitation Analysis - Transactions Page

**Date:** November 21, 2025  
**Module:** `/clothing/operations/transactions`  
**Issue:** Bulk paste operations fail when pasting more than 4-5 rows

---

## Issue Description

### Symptoms

1. **Small pastes (1-4 rows):** ✅ Work successfully
2. **Large pastes (45+ rows):** ❌ Fail to save
3. **After failed paste:** ❌ Even single-row pastes stop working
4. **Requires page refresh:** To restore functionality

---

## Root Cause Analysis

### Primary Issue: Asynchronous Stock Check Blocking

**Location:** `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts` (lines 460-540)

#### The Flow:

```
User pastes 45 rows
↓
HandsontableGrid detects batch operation (>5 changes)
↓
Sets 100ms timeout to process changes
↓
Each row triggers async stock check API calls
↓
Timeout expires before async operations complete
↓
Batch operations incomplete/corrupted
↓
Refs stuck in inconsistent state
↓
Subsequent pastes fail
```

### Code Evidence

#### 1. Batch Processing Timeout (HandsontableGrid.tsx, line 1095)

```typescript
updateTimeoutRef.current = setTimeout(() => {
  changes.forEach(([row, col, oldValue, newValue]) => {
    const processed = processChange(
      row,
      col as number,
      oldValue,
      newValue,
      true
    );
    if (processed) {
      batchCountRef.current++;
    }
  });

  setTimeout(() => {
    isBatchModeRef.current = false;
    window.dispatchEvent(
      new CustomEvent('handsontable-batch-complete', {
        detail: { count: batchCountRef.current },
      })
    );
    batchCountRef.current = 0;
  }, 100);
}, 100); // ⚠️ Only 100ms to process all changes!
```

**Problem:** 100ms is insufficient for:

- Processing 45+ rows
- Making multiple async API calls
- Waiting for stock check validations
- Completing all calculations

#### 2. Stock Check During Product Code Changes (useTransactionOperations.ts, lines 473-476)

```typescript
if (
  dropdownValue &&
  dropdownValue.trim() !== '' &&
  !isBatchModeRef.current  // ⚠️ Should skip during batch, but timing issues
) {
  try {
    const currentQuantity = getCurrentTransaction().Quantity || 0;

    const stockResponse = await fetch('/api/inventory/check-stock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        productCode: dropdownValue.trim(),
        requestedQuantity: currentQuantity,
      }),
    });
    // ... validation logic
  }
}
```

**Problem:** Even with batch mode check, there's a race condition:

- `isBatchModeRef.current` might not be set yet when first cells are processed
- Async operations don't respect the 100ms timeout
- No cleanup mechanism if timeout expires mid-operation

#### 3. Stock Check During Quantity Changes (useTransactionOperations.ts, lines 875-950)

```typescript
const quantityChange = newQuantity - oldQuantity;

if (
  quantityChange > 0 &&
  currentProductCode &&
  currentProductCode.trim() !== '' &&
  !isBatchModeRef.current
) {
  try {
    const stockResponse = await fetch('/api/inventory/check-stock', {
      // ... API call for EACH quantity change
    });

    if (stockResponse.ok) {
      const stockInfo = await stockResponse.json();

      // 🔴 BLOCKS if insufficient stock
      if (stockInfo.status === 'SOLD_OUT' ||
          stockInfo.status === 'INSUFFICIENT_STOCK') {
        await Swal.fire({
          icon: 'error',
          title: '🔴 Insufficient Quantity!',
          // ... blocks user interaction
        });
        return; // ⚠️ Prevents saving the transaction
      }
    }
  }
}
```

**Problem:**

- For 45 rows = **45 sequential API calls** minimum
- Each API call queries database (products + transactions aggregate)
- SweetAlert2 modals block all user interaction
- No batch optimization for stock checks

---

## Technical Details

### Batch Mode Detection Logic (HandsontableGrid.tsx, lines 1026-1032)

```typescript
const isPaste =
  changeSource.includes('paste') ||
  changeSource.includes('Paste') ||
  changeSource.includes('Autofill');

const isBatchEdit = changes.length > 5 && changeSource === 'edit';
const isBatchOperation = isPaste || isBatchEdit;
```

**Key Point:** Triggers batch mode when:

- Source contains "paste" OR
- More than 5 changes with source="edit"

### Race Condition Scenario

```
T=0ms:    User pastes 45 rows
T=1ms:    HandsontableGrid detects batch operation
T=2ms:    Sets updateTimeoutRef to 100ms
T=3ms:    Starts processing first few cells
T=5ms:    First stock check API call starts
T=10ms:   isBatchModeRef.current set to true
T=50ms:   Multiple stock checks still pending
T=100ms:  Timeout expires
T=101ms:  Starts processing remaining cells (batch mode still active)
T=102ms:  Second setTimeout for cleanup set to 100ms
T=150ms:  Stock checks return (too late)
T=202ms:  Cleanup runs, but state is corrupted
T=203ms:  Some cells saved, others not
T=204ms:  User tries single paste - refs show batch mode still active
T=205ms:  Paste fails
```

---

## Why It Affects Subsequent Pastes

### State Corruption

After a failed large paste:

1. **`isBatchModeRef.current`** may be stuck as `true`
2. **`batchUpdatesRef.current`** may contain partial data
3. **`updateTimeoutRef.current`** may have dangling timeout

### Evidence in Code

```typescript
// useTransactionOperations.ts, lines 149-152
const isBatchModeRef = useRef(false);
const batchUpdatesRef = useRef<Map<number, Partial<TransactionData>>>(
  new Map()
);
```

No cleanup mechanism when operations fail or timeout!

---

## Performance Bottlenecks

### 1. Stock Check API (NOT Optimized for Batch)

```typescript
// /api/inventory/check-stock/route.ts
export async function POST(request: NextRequest) {
  // Gets product quantity
  const product = await prisma.product.findFirst({
    /* ... */
  });

  // Aggregates ALL transactions for this product
  const totalOrderResult = await prisma.transaction.aggregate({
    where: {
      productCode: { equals: productCode.trim() },
      orderStatus: { not: 'Cancelled' },
    },
    _sum: { quantity: true },
  });

  // Calculates available stock
  const availableStock = quantity - totalOrder;
}
```

**For 45 rows:**

- 45 database queries to `products` table
- 45 aggregate queries to `transactions` table
- No caching mechanism
- No batch endpoint

### 2. API Route Limits (Found but not the issue)

```typescript
// /api/transactions/route.ts
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';

if (transactionsData.length > MAX_QUERY_LIMIT) {
  // MAX_QUERY_LIMIT = 10,000
  return NextResponse.json(
    {
      error: 'Batch size limit exceeded',
      details: `Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per import.`,
    },
    { status: 413 }
  );
}
```

**Not the issue:** Limit is 10,000 rows (way above 45)

### 3. No Concurrent Request Limiting

```typescript
// constants/batch-sizes.ts
export const MAX_CONCURRENT_REQUESTS = 5;
```

**Not enforced:** Stock checks fire all at once, not limited to 5

---

## Limiting Factors Summary

| Factor                    | Current Value       | Impact                     |
| ------------------------- | ------------------- | -------------------------- |
| Batch timeout             | 100ms               | ❌ Too short for async ops |
| Stock check strategy      | Sequential, per-row | ❌ No batch optimization   |
| Concurrent API calls      | Unlimited           | ❌ Overwhelms server       |
| Cleanup on timeout        | None                | ❌ Corrupts state          |
| Batch mode ref management | Manual, no guards   | ❌ Race conditions         |
| Error recovery            | None                | ❌ Requires refresh        |

---

## Configuration Constants

### Batch Sizes (src/constants/batch-sizes.ts)

```typescript
export const MAX_QUERY_LIMIT = 10000; // API route limit
export const DEFAULT_BATCH_SIZE = 1000; // CSV imports
export const MAX_CONCURRENT_REQUESTS = 5; // Not enforced for stock checks
export const BATCH_DELAY = 100; // Between batches (ms)
```

### Handsontable Detection

```typescript
const isBatchEdit = changes.length > 5; // Threshold for batch mode
```

---

## Recommended Solutions (Not Implemented)

### Option 1: Increase Timeout

- Change 100ms → 5000ms (5 seconds)
- Pros: Simple fix
- Cons: Doesn't solve API overload

### Option 2: Batch Stock Check API

- Create `/api/inventory/check-stock-batch` endpoint
- Accept array of products
- Return all stock levels in one query
- Pros: Reduces API calls from 45 → 1
- Cons: Requires API refactor

### Option 3: Disable Stock Check During Paste

- Skip validation during batch operations
- Validate after batch complete
- Show summary of stock issues
- Pros: Fast paste operations
- Cons: User gets feedback after paste, not during

### Option 4: Debounce + Queue

- Queue stock checks with debouncing
- Process max 5 concurrent requests
- Show loading indicator
- Pros: Balanced approach
- Cons: More complex implementation

### Option 5: Client-Side Stock Cache

- Fetch all stock levels on page load
- Validate against cached data
- Sync with server periodically
- Pros: Instant validation
- Cons: Potential stale data

---

## Additional Notes

### Customer Validation

Similar async validation exists for customers (lines 350-380):

```typescript
TransactionService.validateCustomer(dropdownValue).then((validation) => {
  if (validation.warnings.length > 0 && onCustomerWarning) {
    // Shows modal warning
  }
});
```

**Impact:** Adds more async operations to batch processing

### Auto-population Logic

Each paste also triggers:

- Unit Price calculation
- Line Total calculation
- Order Date auto-population
- Shipment Code auto-population
- Order Status auto-population

**Impact:** Increases processing time per row

---

## Testing Recommendations

1. **Test with different row counts:**
   - 1 row (works)
   - 5 rows (threshold)
   - 10 rows
   - 25 rows
   - 50 rows (fails)
   - 100 rows

2. **Test with different columns:**
   - Paste into non-validated columns (Order Date, Notes)
   - Paste into Product Code (triggers stock check)
   - Paste into Quantity (triggers stock check)
   - Paste into multiple columns simultaneously

3. **Test timing:**
   - Fast network vs slow network
   - With/without other tabs open
   - After first paste failure

4. **Monitor browser console:**
   - Check for timeout errors
   - Check API call waterfall
   - Check ref state consistency

---

## Related Files

### Core Logic

- `src/modules/clothing/operations/transactions/hooks/useTransactionOperations.ts`
- `src/components/ui/HandsontableGrid.tsx`

### API Endpoints

- `src/app/api/transactions/route.ts`
- `src/app/api/inventory/check-stock/route.ts`

### Configuration

- `src/constants/batch-sizes.ts`

### Services

- `src/modules/clothing/operations/transactions/services/TransactionService.ts`
- `src/modules/clothing/operations/transactions/services/TransactionCachingService.ts`

---

## Conclusion

The bulk paste limitation is caused by a **combination of factors**:

1. **Short timeout** (100ms) insufficient for async operations
2. **Sequential stock checks** causing API overload
3. **No cleanup mechanism** on timeout/failure
4. **Race conditions** in batch mode ref management
5. **Blocking UI** (SweetAlert2) during validation

The issue is **not a hard limit** but rather a **timing and coordination problem** between:

- Synchronous batch processing expectations
- Asynchronous validation requirements
- Inadequate timeout duration
- Missing error recovery

**Fix Priority:** Medium-High (affects user experience but has workaround of smaller pastes)

**Complexity:** Medium (requires coordination between UI, hooks, and API)

**Risk:** Low-Medium (changes affect core transaction editing flow)

---

## Resolution Summary (Nov 22, 2025)

- Removed the fixed 100 ms batching delays in `HandsontableGrid.tsx` so paste/autofill edits enter batch mode immediately and remain there until the operation finishes.
- Batch finalization now waits for all asynchronous cell edits (e.g., validation fetches, alerts) to resolve before firing `handsontable-batch-complete`, guaranteeing every pasted row lands in `batchUpdatesRef` before the `bulkUpdate` flush runs.
- Because batch mode stays active the entire time, stock checks and modal prompts remain suppressed until the paste finishes, eliminating the stale-ref corruption that previously blocked any subsequent edits.
- With these sequencing fixes the UI can reliably paste ~100 rows in one action, and the log/notification output reflects the true number of transactions affected.
