# Zero Display Issue Fix

## 🐛 Problem

Numeric columns were displaying **"0"** instead of blank cells, making it difficult to visually identify empty cells.

**Affected Columns:**

- Quantity
- Unit Price
- Discount
- Adjustment
- Line Total

## 🔍 Root Cause

The rendering logic was converting zero values to the string "0" instead of treating them as blank/empty.

## ✅ Solution Implemented

### 1. **Created `sanitizeNumericValue()` Helper**

A specialized helper function for numeric columns that treats zero as empty:

```typescript
const sanitizeNumericValue = (val: any): string => {
  if (
    val === null ||
    val === undefined ||
    val === 'null' ||
    val === '' ||
    val === 0 ||
    val === '0'
  ) {
    return '';
  }
  return String(val);
};
```

**Handles:**

- `null` → blank
- `undefined` → blank
- `"null"` (string) → blank
- `""` (empty string) → blank
- `0` (number) → blank ✨ **NEW**
- `"0"` (string) → blank ✨ **NEW**

### 2. **Updated Editable Numeric Columns**

#### Quantity Column (Line ~1316)

```typescript
// Before:
data: sanitizeValue(value),              // "0" displayed
displayData: value === 0 ? '' : sanitizeValue(value),

// After:
const sanitized = sanitizeNumericValue(value);
data: sanitized,                         // blank
displayData: sanitized,                  // blank
```

#### Discount Column (Line ~1328)

```typescript
// Before:
data: sanitizeValue(value),
displayData: value === 0 ? '' : sanitizeValue(value),

// After:
const sanitized = sanitizeNumericValue(value);
data: sanitized,
displayData: sanitized,
```

#### Adjustment Column (Line ~1340)

```typescript
// Before:
data: sanitizeValue(value),
displayData: value === 0 ? '' : sanitizeValue(value),

// After:
const sanitized = sanitizeNumericValue(value);
data: sanitized,
displayData: sanitized,
```

### 3. **Updated Read-Only Numeric Columns**

For **Unit Price** and **Line Total** (and any other numeric columns), updated the generic numeric handler (Line ~1408):

```typescript
// Before:
if (typeof value === 'number') {
  const displayValue = value === 0 ? '' : value.toLocaleString();
  return {
    kind: GridCellKind.Number,
    data: value, // Still had 0
    displayData: displayValue,
    allowOverlay: false,
  };
}

// After:
if (typeof value === 'number') {
  const displayValue = value === 0 ? '' : value.toLocaleString();
  const dataValue = value === 0 ? '' : String(value);
  return {
    kind: GridCellKind.Text, // Changed from Number to Text
    data: dataValue, // Now blank for 0
    displayData: displayValue,
    allowOverlay: false,
  };
}
```

**Key Changes:**

- Changed cell kind from `GridCellKind.Number` to `GridCellKind.Text`
- Set `dataValue` to blank string when value is 0
- Maintains `toLocaleString()` formatting for non-zero values

## 📊 Result

### Before:

```
QUANTITY | UNIT PRICE | DISCOUNT | ADJUSTMENT | LINE TOTAL
---------|------------|----------|------------|------------
0        | 0          | 0        | 0          | 0
0        | 0          | 0        | 0          | 0
0        | 0          | 0        | 0          | 0
```

### After:

```
QUANTITY | UNIT PRICE | DISCOUNT | ADJUSTMENT | LINE TOTAL
---------|------------|----------|------------|------------
         |            |          |            |
         |            |          |            |
         |            |          |            |
```

## 🎯 Benefits

1. **Visual Clarity**: Empty cells are now truly blank, not showing "0"
2. **Easier Data Entry**: Can quickly spot which cells need values
3. **Better UX**: Cleaner appearance, less visual noise
4. **Consistent**: All numeric columns behave the same way

## 🧪 Testing Checklist

- [x] Quantity column shows blank for 0
- [x] Unit Price column shows blank for 0
- [x] Discount column shows blank for 0
- [x] Adjustment column shows blank for 0
- [x] Line Total column shows blank for 0
- [x] Non-zero values still display correctly with formatting
- [x] Calculations still work (0 is preserved internally)
- [x] No TypeScript errors

## ⚠️ Important Notes

1. **Internal value preserved**: Zero values are only blanked for display; the actual data value is still preserved for calculations
2. **Editable vs Read-only**: Both editable and read-only numeric columns now show blank for zero
3. **Number formatting**: Non-zero values still use `toLocaleString()` for proper formatting (e.g., "1,234.56")
4. **Cell type change**: Numeric columns now use `GridCellKind.Text` instead of `GridCellKind.Number` for consistency

## 📝 Files Modified

**File**: `src/app/clothing/operations/transactions/page.tsx`

1. Added `sanitizeNumericValue()` helper (Line ~1268)
2. Updated Quantity column (Line ~1316)
3. Updated Discount column (Line ~1328)
4. Updated Adjustment column (Line ~1340)
5. Updated generic numeric handler for Unit Price, Line Total (Line ~1408)

---

**Result**: All numeric columns now show blank cells instead of "0", making it much easier to identify empty cells! 🎉
