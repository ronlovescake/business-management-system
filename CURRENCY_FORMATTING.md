# Currency Column Formatting

## Overview

Added professional number formatting to currency columns with thousand separators and 2 decimal places for improved readability and consistency.

## Formatted Columns

### Currency Columns (Numeric Format):

- **UNIT PRICE** - `0,0.00` format (e.g., `1,250.50`)
- **DISCOUNT** - `0,0.00` format (e.g., `125.00`)
- **ADJUSTMENT** - `0,0.00` format (e.g., `50.75`)
- **LINE TOTAL** - `0,0.00` format (e.g., `25,000.00`)

## Format Pattern

### Pattern: `0,0.00`

Breaking down the pattern:

- `0` - Digit placeholder
- `,` - Thousand separator
- `.` - Decimal point
- `00` - Always show 2 decimal places

### Examples:

| Raw Value | Formatted Display |
| --------- | ----------------- |
| 150       | 150.00            |
| 1500      | 1,500.00          |
| 15000     | 15,000.00         |
| 150000    | 150,000.00        |
| 1500000   | 1,500,000.00      |
| 150.5     | 150.50            |
| 150.50    | 150.50            |
| 150.501   | 150.50 (rounded)  |

## Technical Implementation

### Handsontable Numeric Format

Location: `src/components/ui/HandsontableGrid.tsx`

```typescript
// Determine column type and formatting
let columnType: 'text' | 'numeric' | 'autocomplete' = 'text';
let numericFormat: { pattern: string } | undefined;

if ('id' in col) {
  const columnId = col.id as string;

  // Currency columns with numeric formatting
  if (['unitPrice', 'discount', 'adjustment', 'lineTotal'].includes(columnId)) {
    className = 'htRight';
    columnType = 'numeric';
    numericFormat = {
      pattern: '0,0.00', // Thousand separator with 2 decimals
    };
  }
}

// Apply to column configuration
const columnConfig = {
  data: colIndex,
  type: columnType,
  title: col.title,
  width: col.width,
  className: className,
  numericFormat: numericFormat, // Add numeric format
};
```

### Handsontable Numeric Type

When `type: 'numeric'` is set, Handsontable:

1. **Formats display**: Shows formatted value in cells
2. **Preserves raw value**: Stores actual number for calculations
3. **Validates input**: Only allows numeric input
4. **Auto-aligns**: Right-aligns numeric values
5. **Smart editing**: Allows entering without commas

## User Experience

### Display (Read Mode):

- Values shown with thousand separators
- Always 2 decimal places
- Professional accounting appearance
- Easy to scan and compare

### Editing (Edit Mode):

- Can type numbers naturally: `1500` or `1,500`
- Handsontable accepts both formats
- Auto-formats on blur/save
- Decimal precision maintained

### Calculation:

- Raw numeric values used for calculations
- Line Total = Quantity × Unit Price - Discount - Adjustment
- No formatting artifacts in math operations

## Visual Comparison

### Before (Plain Text):

```
UNIT PRICE | DISCOUNT | ADJUSTMENT | LINE TOTAL
150        | 25       | 10         | 115
1500       | 100      | 50         | 1350
15000      | 500      | 250        | 14250
```

**Problems**:

- Hard to read large numbers
- Inconsistent decimal display
- Looks unprofessional

### After (Formatted):

```
UNIT PRICE | DISCOUNT | ADJUSTMENT | LINE TOTAL
    150.00 |    25.00 |      10.00 |     115.00
  1,500.00 |   100.00 |      50.00 |   1,350.00
 15,000.00 |   500.00 |     250.00 |  14,250.00
```

**Benefits**:

- Easy to read at a glance
- Consistent decimal precision
- Professional appearance
- Clear value hierarchy

## Format Options Reference

Handsontable supports various number formats:

| Pattern   | Example Input | Display   | Use Case             |
| --------- | ------------- | --------- | -------------------- |
| `0,0.00`  | 1234.5        | 1,234.50  | Currency (our case)  |
| `0,0`     | 1234.5        | 1,235     | Rounded integers     |
| `0.00`    | 1234.5        | 1234.50   | Decimal without `,`  |
| `0,0.0`   | 1234.5        | 1,234.5   | 1 decimal place      |
| `$0,0.00` | 1234.5        | $1,234.50 | With currency symbol |

We chose `0,0.00` for clarity without currency symbols (since column headers indicate currency).

## Data Integrity

### Storage:

- Raw numeric values stored in database
- No formatting in data layer
- Example: `1500` stored as `1500`, not as string `"1,500.00"`

### API Communication:

- API sends/receives raw numbers
- Formatting applied only in UI layer
- Example: `{ "Unit Price": 1500 }` not `{ "Unit Price": "1,500.00" }`

### Type Safety:

```typescript
type: 'numeric'; // Handsontable enforces numeric input
```

## Benefits

✅ **Readability**: Thousand separators make large numbers easy to scan  
✅ **Consistency**: Always 2 decimal places (accounting standard)  
✅ **Professionalism**: Matches enterprise software appearance  
✅ **Accuracy**: Prevents confusion between 15000 and 150000  
✅ **Validation**: Numeric type prevents text entry  
✅ **Alignment**: Right-aligned for decimal point alignment  
✅ **Calculations**: Raw values ensure accurate math

## Browser Compatibility

✅ **All Modern Browsers**: Handsontable's numeric formatting works universally

- Chrome/Edge ✓
- Firefox ✓
- Safari ✓

The formatting is handled by Handsontable's built-in number formatter, which is well-tested across browsers.

## Performance Impact

- **Minimal**: Formatting applied only on render
- **Efficient**: Handsontable caches formatted values
- **No API Impact**: Raw numbers still sent/received
- **Memory**: Negligible overhead for format strings

## Locale Considerations

### Current Implementation:

- Uses default locale (English/US)
- Comma (`,`) as thousand separator
- Period (`.`) as decimal separator

### Future Enhancement (if needed):

```typescript
numericFormat: {
  pattern: '0,0.00',
  culture: 'en-US' // or 'de-DE', 'fr-FR', etc.
}
```

Different locales would format as:

- **en-US**: `1,234.50`
- **de-DE**: `1.234,50`
- **fr-FR**: `1 234,50`

## Edge Cases Handled

### Empty Values:

- Empty cells remain empty (not shown as "0.00")
- Handled by sanitizeNumericValue() from previous fix

### Zero Values:

- `0` displays as empty (per ZERO_DISPLAY_FIX.md)
- Prevents clutter in empty cells

### Negative Values:

- Displayed with minus sign: `-1,234.50`
- Useful for returns or adjustments

### Very Large Numbers:

- `1000000` → `1,000,000.00`
- Formatting scales appropriately

## Testing Checklist

### Visual Verification:

- [ ] UNIT PRICE: Shows with `,` separator and `.00`
- [ ] DISCOUNT: Shows with `,` separator and `.00`
- [ ] ADJUSTMENT: Shows with `,` separator and `.00`
- [ ] LINE TOTAL: Shows with `,` separator and `.00`

### Edit Mode:

- [ ] Can type `1500` → formats to `1,500.00`
- [ ] Can type `1,500` → formats to `1,500.00`
- [ ] Can type `1500.5` → formats to `1,500.50`
- [ ] Can type `1500.555` → rounds to `1,500.56`

### Calculations:

- [ ] Line Total = Qty × Unit Price - Discount - Adjustment
- [ ] Calculations use raw numeric values
- [ ] Result displays formatted

### Paste Operations:

- [ ] Paste `1500` → formats to `1,500.00`
- [ ] Paste `1,500.00` → maintains format
- [ ] Batch paste works with formatting

### Empty/Zero Values:

- [ ] Empty cells remain empty (not `0.00`)
- [ ] Zero values display as empty per sanitization

## Related Features

### Complements:

- **COLUMN_ALIGNMENT_CONFIG.md**: Right alignment for currency
- **ZERO_DISPLAY_FIX.md**: Handles empty/zero values
- **BATCH_API_FIX_SUMMARY.md**: Formatting works with batch updates

### Preserves:

- All previous fixes work with numeric formatting
- Search, filter, validation all compatible
- Optimistic updates apply formatted values correctly

## Common Questions

**Q: Why not include currency symbols ($)?**  
A: Column headers already indicate currency. Adding $ to each cell adds visual noise. The format `0,0.00` is cleaner and internationally flexible.

**Q: Can users type with or without commas?**  
A: Yes! Handsontable accepts `1500` or `1,500` - both format correctly.

**Q: Are calculations affected?**  
A: No. Calculations use raw numeric values. Formatting is display-only.

**Q: What happens on paste from Excel?**  
A: Excel-formatted numbers (with or without commas) are parsed correctly and reformatted.

## Conclusion

Currency columns now display with professional number formatting:

- **Thousand separators** (`,`) for readability
- **2 decimal places** (`.00`) for precision
- **Right alignment** for decimal point alignment
- **Numeric validation** prevents invalid input

This follows standard accounting practices and improves the overall professionalism of the transactions grid.

**Pattern**: `0,0.00` applied to UNIT PRICE, DISCOUNT, ADJUSTMENT, LINE TOTAL ✅
