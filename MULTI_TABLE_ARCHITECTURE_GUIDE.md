# 📊 Multi-Table Architecture Guide

## 🎯 Overview

Your business management system uses **different table technologies** across different pages based on their specific needs. The modular architecture is designed to support this flexibility through **abstraction layers**.

---

## 📋 Table Technology Mapping

### Current Implementation

| Module                     | Table Technology | Why This Choice?                                                                                                            |
| -------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Transactions**           | Handsontable     | ✅ Complex editing (dropdowns, formulas)<br>✅ Excel-like batch paste<br>✅ Advanced auto-population<br>✅ Native undo/redo |
| **Products**               | Glide Data Grid  | ✅ High performance (10,000+ rows)<br>✅ Virtual scrolling<br>✅ Lightweight<br>✅ Custom cell renderers                    |
| **Shipments**              | Glide Data Grid  | ✅ Large datasets<br>✅ Fast rendering<br>✅ Simple CRUD operations                                                         |
| **Customers**              | Glide Data Grid  | ✅ Performance at scale<br>✅ Filtering & sorting<br>✅ Clean UI                                                            |
| **Due Dates**              | Mantine Table    | ✅ Simple display-only<br>✅ Grouped data (by customer)<br>✅ Easy styling with Mantine<br>✅ Double-click modals           |
| **Sorting & Distribution** | Mantine Table    | ✅ Read-only display<br>✅ Simple sorting<br>✅ Integration with Mantine UI                                                 |

---

## 🏗️ Architecture Pattern: Table-Agnostic Modules

### Core Principle

**Separate business logic from presentation layer.**

```
┌─────────────────────────────────────────┐
│         Module (e.g., Transactions)      │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────┐    │
│  │   TABLE-AGNOSTIC LAYERS        │    │
│  │  (Reusable across all tables)  │    │
│  ├────────────────────────────────┤    │
│  │ • Services (business logic)    │    │
│  │ • Hooks (data fetching)        │    │
│  │ • Types (interfaces)           │    │
│  │ • Utils (formatters, calcs)    │    │
│  └────────────────────────────────┘    │
│               ▲                          │
│               │                          │
│               │ Uses                     │
│               │                          │
│  ┌────────────────────────────────┐    │
│  │   TABLE-SPECIFIC LAYERS        │    │
│  │   (Swap these per module)      │    │
│  ├────────────────────────────────┤    │
│  │ • Grid Component               │    │
│  │ • Grid Hooks (config)          │    │
│  │ • Grid Types (cell types)      │    │
│  └────────────────────────────────┘    │
│                                          │
└─────────────────────────────────────────┘
```

---

## 🔧 Implementation Examples

### Example 1: Transactions Module (Handsontable)

```typescript
// src/modules/transactions/components/TransactionsGrid.tsx
import { HotTable } from '@handsontable/react';
import { useTransactionsGrid } from '../hooks/useTransactionsGrid'; // TABLE-SPECIFIC
import { useTransactionData } from '@/hooks/useSheetData'; // TABLE-AGNOSTIC

export function TransactionsGrid() {
  // TABLE-AGNOSTIC: Business logic and data
  const { data, update } = useTransactionData();

  // TABLE-SPECIFIC: Handsontable configuration
  const { hotSettings, columns, afterChange } = useTransactionsGrid(data);

  return (
    <HotTable
      settings={hotSettings}
      columns={columns}
      afterChange={afterChange}
    />
  );
}
```

### Example 2: Products Module (Glide Data Grid)

```typescript
// src/modules/products/components/ProductsGrid.tsx
import { DataEditor } from '@glideapps/glide-data-grid';
import { useProductsGrid } from '../hooks/useProductsGrid'; // TABLE-SPECIFIC
import { useProductData } from '@/hooks/useSheetData'; // TABLE-AGNOSTIC

export function ProductsGrid() {
  // TABLE-AGNOSTIC: Business logic and data
  const { data, update } = useProductData();

  // TABLE-SPECIFIC: Glide Data Grid configuration
  const { columns, getCellContent, onCellEdited } = useProductsGrid(data);

  return (
    <DataEditor
      columns={columns}
      rows={data.length}
      getCellContent={getCellContent}
      onCellEdited={onCellEdited}
    />
  );
}
```

### Example 3: Due Dates Module (Mantine Table)

```typescript
// src/modules/due-dates/components/DueDatesTable.tsx
import { Table } from '@mantine/core';
import { useDueDatesTable } from '../hooks/useDueDatesTable'; // TABLE-SPECIFIC
import { useTransactionData } from '@/hooks/useSheetData'; // TABLE-AGNOSTIC

export function DueDatesTable() {
  // TABLE-AGNOSTIC: Business logic and data
  const { data } = useTransactionData();

  // TABLE-SPECIFIC: Mantine Table configuration
  const { dueDateItems, handleRowClick } = useDueDatesTable(data);

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Customer</Table.Th>
          <Table.Th>Total Due</Table.Th>
          <Table.Th>Invoice Date</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {dueDateItems.map((item) => (
          <Table.Tr key={item.customer} onClick={() => handleRowClick(item)}>
            <Table.Td>{item.customer}</Table.Td>
            <Table.Td>{item.totalDue}</Table.Td>
            <Table.Td>{item.invoiceDate}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
```

---

## 📂 Module Structure Template

### For ANY Module (Regardless of Table)

```
src/modules/{module-name}/
├── index.ts                    # Public API
├── module.config.ts            # Module registration
│
├── components/
│   ├── {Module}Page.tsx        # Main page (orchestrator)
│   ├── {Module}Grid.tsx        # TABLE-SPECIFIC: Grid wrapper
│   ├── {Module}Stats.tsx       # TABLE-AGNOSTIC: Stats display
│   ├── {Module}Filters.tsx     # TABLE-AGNOSTIC: Filter UI
│   └── modals/                 # TABLE-AGNOSTIC: Modals
│
├── hooks/
│   ├── use{Module}Grid.ts      # TABLE-SPECIFIC: Grid config
│   ├── use{Module}Data.ts      # TABLE-AGNOSTIC: Data fetching
│   ├── use{Module}Filters.ts   # TABLE-AGNOSTIC: Filtering logic
│   └── use{Module}Actions.ts   # TABLE-AGNOSTIC: Business actions
│
├── services/
│   ├── {Module}Service.ts      # TABLE-AGNOSTIC: Business logic
│   ├── ValidationService.ts    # TABLE-AGNOSTIC: Validation
│   └── CalculationService.ts   # TABLE-AGNOSTIC: Calculations
│
├── types/
│   ├── {module}.types.ts       # TABLE-AGNOSTIC: Data types
│   └── grid.types.ts           # TABLE-SPECIFIC: Grid types
│
└── utils/
    ├── formatters.ts           # TABLE-AGNOSTIC: Formatters
    ├── validators.ts           # TABLE-AGNOSTIC: Validators
    └── calculations.ts         # TABLE-AGNOSTIC: Calculations
```

---

## 🔄 Sharing Logic Between Modules

### 1. Shared Services (Table-Agnostic)

```typescript
// src/services/shared/FormatterService.ts
export class FormatterService {
  static formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(value);
  }

  static formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
}

// Used in ALL modules regardless of table:
// - Transactions (Handsontable)
// - Products (Glide)
// - Due Dates (Mantine)
```

### 2. Shared Hooks (Table-Agnostic)

```typescript
// src/hooks/useSheetData.ts (Already exists!)
export function useTransactionData() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const res = await fetch('/api/transactions');
      return res.json();
    },
  });
}

// Used in:
// - Transactions module (Handsontable)
// - Due Dates module (Mantine Table)
// - Business Intelligence module (charts)
```

### 3. Shared Types (Table-Agnostic)

```typescript
// src/types/transaction.types.ts
export interface TransactionData {
  id: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | null;
  'Unit Price': number | null;
  // ... rest of fields
}

// Used in ALL modules that work with transactions
```

---

## 🎨 Table-Specific Adapters

### Pattern: Adapter Layer

Create **adapter hooks** that translate table-agnostic data into table-specific formats:

```typescript
// src/modules/transactions/hooks/useHandsontableAdapter.ts
import { TransactionData } from '@/types/transaction.types';

export function useHandsontableAdapter(data: TransactionData[]) {
  // Convert TransactionData[] → Handsontable format
  const hotData = data.map((transaction) => [
    transaction['Order Date'],
    transaction.Customers,
    transaction['Product Code'],
    // ...
  ]);

  const columns = [
    { data: 'Order Date', type: 'date' },
    { data: 'Customers', type: 'dropdown', source: customers },
    { data: 'Product Code', type: 'dropdown', source: products },
    // ...
  ];

  return { hotData, columns };
}
```

```typescript
// src/modules/products/hooks/useGlideAdapter.ts
import { ProductData } from '@/types/product.types';
import { GridColumn } from '@glideapps/glide-data-grid';

export function useGlideAdapter(data: ProductData[]) {
  // Convert ProductData[] → Glide Data Grid format
  const columns: GridColumn[] = [
    { title: 'Product Code', width: 200 },
    { title: 'Description', width: 300 },
    // ...
  ];

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = data[row];
      // Convert to GridCell format...
    },
    [data]
  );

  return { columns, getCellContent };
}
```

---

## ✅ Benefits of This Architecture

### 1. **Flexibility**

- ✅ Each module chooses the best table for its use case
- ✅ Easy to swap tables if requirements change
- ✅ No vendor lock-in

### 2. **Reusability**

- ✅ Business logic shared across all modules
- ✅ Services, hooks, utils reused everywhere
- ✅ Less code duplication

### 3. **Maintainability**

- ✅ Clear separation of concerns
- ✅ Table-specific code isolated to grid components/hooks
- ✅ Easy to test business logic independently

### 4. **Consistency**

- ✅ Same data fetching patterns everywhere
- ✅ Same formatting/validation rules
- ✅ Unified user experience

---

## 🚀 Migration Strategy

### Phase 1: Extract Table-Agnostic Code First

1. Move all services to `/src/services/shared/`
2. Move all types to `/src/types/`
3. Move all formatters/validators to `/src/utils/`
4. Create reusable hooks in `/src/hooks/`

### Phase 2: Create Module-Specific Adapters

1. Keep table-specific code in each module
2. Create adapter hooks (e.g., `useHandsontableAdapter`, `useGlideAdapter`)
3. Ensure adapters consume the same table-agnostic data

### Phase 3: Test Each Module Independently

1. Verify table-specific features work (dropdowns, editing, etc.)
2. Verify business logic works (calculations, validations, etc.)
3. Verify data persistence works across all tables

---

## 📊 Decision Matrix: Choosing the Right Table

| Feature                      | Handsontable | Glide Data Grid | Mantine Table |
| ---------------------------- | ------------ | --------------- | ------------- |
| **Complex Editing**          | ⭐⭐⭐⭐⭐   | ⭐⭐⭐          | ⭐            |
| **Performance (>10k rows)**  | ⭐⭐⭐       | ⭐⭐⭐⭐⭐      | ⭐⭐          |
| **Excel-like Features**      | ⭐⭐⭐⭐⭐   | ⭐⭐            | ⭐            |
| **Read-Only Display**        | ⭐⭐         | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐    |
| **Styling Flexibility**      | ⭐⭐⭐       | ⭐⭐⭐          | ⭐⭐⭐⭐⭐    |
| **Bundle Size**              | ⭐⭐ (large) | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐    |
| **Integration with Mantine** | ⭐⭐         | ⭐⭐⭐          | ⭐⭐⭐⭐⭐    |

### Recommendations:

- **Handsontable** → Complex CRUD with formulas, dropdowns, batch operations
- **Glide Data Grid** → High-performance display/editing of large datasets
- **Mantine Table** → Simple read-only displays, grouped data, styled tables

---

## 🔍 Example: Swapping Tables

### Scenario: Want to replace Mantine Table with Glide in Due Dates

**Before** (Mantine Table):

```typescript
// src/modules/due-dates/components/DueDatesTable.tsx
import { Table } from '@mantine/core';
import { useDueDatesTable } from '../hooks/useDueDatesTable';

export function DueDatesTable() {
  const { dueDateItems } = useDueDatesTable();

  return <Table>{/* Mantine table code */}</Table>;
}
```

**After** (Glide Data Grid):

```typescript
// src/modules/due-dates/components/DueDatesTable.tsx
import { DataEditor } from '@glideapps/glide-data-grid';
import { useDueDatesGrid } from '../hooks/useDueDatesGrid'; // NEW

export function DueDatesTable() {
  const { columns, getCellContent } = useDueDatesGrid(); // NEW

  return <DataEditor columns={columns} getCellContent={getCellContent} />;
}
```

**Result**:

- ✅ Business logic unchanged (filtering, grouping, calculations)
- ✅ Only grid component and grid hook changed
- ✅ Services, types, utils remain the same

---

## 📚 Summary

The modular architecture supports multiple table technologies through:

1. **Abstraction Layers** - Services, hooks, types are table-agnostic
2. **Adapter Pattern** - Table-specific adapters translate data formats
3. **Clear Separation** - Table code isolated to grid components/hooks
4. **Shared Logic** - Business logic reused across all modules

This allows you to:

- ✅ Choose the best table for each module
- ✅ Swap tables easily if needs change
- ✅ Maintain consistency in business logic
- ✅ Avoid code duplication

---

**Next Steps**: Continue with Transactions module refactoring using this pattern as the template for all future modules!
