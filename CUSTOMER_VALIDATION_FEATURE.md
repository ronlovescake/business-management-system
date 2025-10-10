# 🚫 Customer Validation Feature

## Overview

Added customer validation system that shows warnings when entering banned customers or customers with high cancellation rates (50%+) in the transactions page.

## How It Works

### 1. **Customer Validation Logic**

- **Location**: `/src/app/clothing/operations/transactions/page.tsx` (lines ~479-545)
- **Function**: `validateCustomer(customerName: string)`
- **Triggers**: When a customer is selected in the "Customers" column dropdown

### 2. **Validation Checks**

1. **Banned Customer Check**:
   - Checks if `Customer Status` field contains "banned" (case-insensitive)
   - Shows: `🚫 BANNED CUSTOMER: "[Name]" is marked as BANNED`

2. **High Cancellation Rate Check**:
   - Fetches customer's transaction history via `/api/customers/{id}/transactions`
   - Calculates cancellation rate from transactions with "cancel" in order status
   - Shows warning if cancellation rate ≥ 50%
   - Shows: `⚠️ HIGH CANCELLATION RATE: "[Name]" has a X% cancellation rate (Y/Z orders cancelled)`

### 3. **User Experience**

- **Warning Modal**: Shows `window.confirm()` dialog with all warnings
- **User Choice**:
  - Click **OK** → Proceed with customer (shows acknowledgment notification)
  - Click **Cancel** → Cancel customer selection (reverts to empty, shows cancellation notification)

## Test Cases

### Test Case 1: Trixie Mauricio (Banned + High Cancellation Rate)

- **Customer**: "Trixie Mauricio" (ID: 743)
- **Expected Warnings**:
  - `🚫 BANNED CUSTOMER: "Trixie Mauricio" is marked as BANNED`
  - `⚠️ HIGH CANCELLATION RATE: "Trixie Mauricio" has a 84% cancellation rate`

### Test Case 2: Regular Customer

- **Expected**: No warnings, normal customer selection

### Test Case 3: High Cancellation Rate Only

- **Expected**: Only cancellation rate warning (no banned status)

## Integration Points

### 1. **API Endpoints Used**

- `GET /api/customers` - Get all customers to find selected customer
- `GET /api/customers/{id}/transactions` - Get customer transaction history

### 2. **Cell Editing Integration**

- **Location**: `handleCellEdited` function in transactions page
- **Trigger**: When `column.id === 'customers'` and dropdown value changes
- **Execution**: Asynchronous validation using `validateCustomer().then()`

### 3. **Dependencies**

- Added `validateCustomer` to `handleCellEdited` useCallback dependency array
- Uses existing notification system for user feedback
- Integrates with existing customer dropdown functionality

## Code Structure

```typescript
// Customer validation function (lines ~479-545)
const validateCustomer = useCallback(
  async (
    customerName: string
  ): Promise<{
    isValid: boolean;
    warnings: string[];
    customerData?: Record<string, unknown>;
  }> => {
    // Implementation...
  },
  []
);

// Integration in cell editing (lines ~2157-2205)
if (column.id === 'customers') {
  // Customer validation check
  if (dropdownValue && dropdownValue.trim() !== '') {
    validateCustomer(dropdownValue).then((validation) => {
      if (validation.warnings.length > 0) {
        // Show warning modal and handle user response
      }
    });
  }
  // Continue with normal customer selection logic...
}
```

## File Changes

- **Modified**: `/src/app/clothing/operations/transactions/page.tsx`
  - Added `validateCustomer` function
  - Modified customer cell editing handler
  - Added validation dependency to useCallback

## Testing Instructions

1. Navigate to `/clothing/operations/transactions`
2. Try to enter "Trixie Mauricio" in the Customers column
3. Should see warning modal with banned status and cancellation rate
4. Test with other customers to ensure normal flow works

## Notes

- Validation is non-blocking (asynchronous) to avoid UI freezing
- Fallback handling if APIs are unavailable
- Maintains existing business logic and auto-population features
- TypeScript typed with proper error handling
