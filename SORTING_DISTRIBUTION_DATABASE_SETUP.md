# Sorting Distribution Database Setup

## ✅ Completed Steps

### 1. Database Table Created
Created `sorting_distributions` table with the following structure:

```sql
- id: Auto-incrementing primary key
- created_at: Timestamp (auto-set)
- updated_at: Timestamp (auto-updated via trigger)
- product_code: VARCHAR(100) - The selected product
- selected_quantity: INTEGER - The selected pill button quantity
- row_number: INTEGER - Row position (1-100)
- quantity: DOUBLE PRECISION - User-entered quantity
- percentage: DOUBLE PRECISION - Calculated percentage
- group_number: VARCHAR(50) - Auto-generated group number
- distribution: DOUBLE PRECISION - Calculated distribution
- checked: BOOLEAN - Checkbox state

UNIQUE constraint: (product_code, row_number)
```

### 2. Prisma Schema Updated
Added `SortingDistribution` model in `prisma/schema.prisma`

### 3. API Routes Created
Created `/api/sorting-distribution/route.ts` with three endpoints:

#### GET `/api/sorting-distribution?productCode=XXX`
- Fetches all saved rows for a product
- Returns data ordered by row_number
- Returns selectedQuantity if available

#### POST `/api/sorting-distribution`
Body:
```json
{
  "productCode": "Disney Jumper (DJ-082025)",
  "selectedQuantity": 12,
  "rows": [
    {
      "quantity": 50,
      "percentage": 6.25,
      "groupNumber": "Number 1",
      "distribution": 3,
      "checked": false
    }
    // ... more rows
  ]
}
```
- Saves/updates all data for a product
- Deletes old data and inserts new (full replacement)
- Only saves non-empty rows

#### DELETE `/api/sorting-distribution?productCode=XXX`
- Deletes all rows for a product

## 📋 Next Steps: Frontend Integration

### Step 1: Load Data on Product Selection
When user selects a product from dropdown:
```typescript
const loadSavedData = async (productCode: string) => {
  const response = await fetch(`/api/sorting-distribution?productCode=${encodeURIComponent(productCode)}`);
  const { data, selectedQuantity } = await response.json();
  
  // Restore rows
  if (data.length > 0) {
    const restoredRows = Array.from({ length: 100 }, (_, i) => {
      const savedRow = data.find(d => d.rowNumber === i + 1);
      return savedRow ? {
        quantity: savedRow.quantity,
        percentage: savedRow.percentage,
        groupNumber: savedRow.groupNumber,
        distribution: savedRow.distribution,
        checked: savedRow.checked,
      } : {
        quantity: 0,
        percentage: 0,
        groupNumber: '',
        distribution: 0,
        checked: false,
      };
    });
    setRows(restoredRows);
  }
  
  // Restore selected quantity button
  if (selectedQuantity) {
    setSelectedQuantity(selectedQuantity);
  }
};
```

### Step 2: Auto-Save on Changes
Add debounced save function:
```typescript
const saveData = useMemo(
  () =>
    debounce(async () => {
      if (!item) return;
      
      await fetch('/api/sorting-distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productCode: item,
          selectedQuantity,
          rows,
        }),
      });
    }, 1000),
  [item, selectedQuantity, rows]
);

useEffect(() => {
  saveData();
}, [rows, selectedQuantity]);
```

### Step 3: Clear Data Option
Add a "Clear" button to reset data:
```typescript
const clearData = async () => {
  if (!item) return;
  
  await fetch(`/api/sorting-distribution?productCode=${encodeURIComponent(item)}`, {
    method: 'DELETE',
  });
  
  // Reset local state
  setRows(initialRows);
  setSelectedQuantity(null);
};
```

## 🔧 Files Modified/Created

1. ✅ `prisma/schema.prisma` - Added SortingDistribution model
2. ✅ `scripts/create-sorting-distribution-table.sql` - SQL to create table
3. ✅ `scripts/setup-sorting-distribution.js` - Setup script (not used, executed via Prisma CLI)
4. ✅ `src/app/api/sorting-distribution/route.ts` - API endpoints
5. ⏳ `src/app/clothing/operations/sorting-distribution/page.tsx` - Needs integration

## 🎯 Benefits

- ✅ **Persistence**: Data survives page refreshes
- ✅ **Product-specific**: Each product has its own saved state
- ✅ **Auto-save**: Changes saved automatically (when implemented)
- ✅ **Complete state**: Saves everything (quantities, checkboxes, pill selection)
- ✅ **Performance**: Indexed queries for fast retrieval
- ✅ **Data integrity**: Unique constraint prevents duplicates
