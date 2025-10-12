# Expenses Page - Abstraction Layer Implementation

## Overview

The expenses page now has a complete **abstraction layer** that separates business logic from UI presentation, following the same pattern as Transactions, Products, Shipments, and other pages in the system.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Page Component (page.tsx)                              │
│  ✅ Business Logic ONLY                                 │
│  ✅ State Management                                    │
│  ✅ CSV Import/Export Logic                             │
│  ✅ Receipt File Management                             │
│  ✅ Calculations (totals, analytics)                    │
│  ✅ Event Handlers                                      │
│  ✅ Data Filtering & Sorting                            │
└─────────────┬───────────────────────────────────────────┘
              │
              │ Props Interface (ExpensesLayoutProps)
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Layout Component (ExpensesLayout.tsx)                  │
│  ✅ UI Structure ONLY                                   │
│  ✅ Header with Tabs                                    │
│  ✅ Search & Filter Controls                            │
│  ✅ Action Buttons                                      │
│  ✅ Expense List Table                                  │
│  ✅ Analytics Table                                     │
│  ✅ Add/Edit Modal                                      │
│  ✅ Styling & Layout                                    │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/clothing/employees/expenses/
│   └── page.tsx                    # Business logic only (protected)
│
├── components/features/expenses/
│   ├── ExpensesLayout.tsx          # UI abstraction layer
│   └── index.ts                    # Exports
│
└── components/expenses/            # Reusable utilities
    ├── ReceiptViewer.tsx           # Receipt modal
    ├── TableContainer.tsx          # Table wrapper
    ├── PageHeaderWithTabs.tsx      # Header component
    ├── useReceiptManager.ts        # Receipt hook
    ├── csvUtils.ts                 # CSV utilities
    └── index.ts
```

## Benefits

### 1. **Separation of Concerns**

- **Business Logic** (page.tsx): Data management, calculations, API calls
- **UI Presentation** (ExpensesLayout.tsx): Visual structure, styling
- Clean interface between the two layers

### 2. **Protected Business Logic**

All critical business logic stays in page.tsx:

- CSV import parsing and validation
- Receipt file storage and data URL conversion
- Expense calculations and analytics
- Status approval/rejection logic
- Data filtering and sorting algorithms

### 3. **Swappable UI**

The UI can be completely redesigned without touching business logic:

- Replace Mantine Table with DataGrid
- Change layout structure
- Modify styling and theming
- Add new UI components

### 4. **Consistency**

Follows the same pattern as all other pages:

- Transactions → TransactionsLayout
- Products → ProductsLayout
- Shipments → ShipmentsLayout
- **Expenses → ExpensesLayout** ✅

## Features Abstracted

### In ExpensesLayout.tsx (UI Layer):

✅ **Header Section**

- Page title
- Tab navigation (Expense List / Analytics by Category)
- Tab icons

✅ **Search and Filters**

- Search input field
- Category filter dropdown
- Status filter dropdown
- Filter layout and styling

✅ **Action Buttons**

- Import CSV button (with loading state)
- Export CSV button
- Add Expense button
- Button styling and positioning

✅ **Expense List Table**

- Table structure (7 columns)
- Header styling (#f1f3f5 background, #495057 text)
- Row rendering
- Status badges
- Action icons (approve/reject/edit/delete)
- Receipt viewing links
- Empty state message

✅ **Analytics Table**

- Monthly breakdown table (16 columns)
- Progress bars for percentages
- Category colors
- Scrollable horizontal layout
- Sticky header

✅ **Add/Edit Modal**

- Modal structure
- Form fields (date, amount, description, category, notes, receipt)
- Save/Cancel buttons
- Modal sizing and styling

✅ **Summary Footer**

- Row count display
- Filtered total calculation display

### In page.tsx (Business Logic Layer):

✅ **State Management**

- Expenses data array
- Filter states
- Modal states
- Form states
- Receipt file storage

✅ **Data Processing**

- Expense filtering by search/category/status
- Date sorting (newest first)
- Monthly analytics calculations
- Category aggregation
- Percentage calculations

✅ **CSV Operations**

- Import validation
- CSV parsing with quotes handling
- Export data formatting
- File download generation

✅ **Receipt Management**

- File upload handling
- Data URL conversion
- Receipt viewing logic
- Zoom and download functionality

✅ **CRUD Operations**

- Add new expense
- Edit existing expense
- Delete expense
- Approve/Reject expense

## Usage Pattern

### In page.tsx:

```tsx
import { ExpensesLayout } from '@/components/features/expenses';

export default function Expenses() {
  // All business logic here
  const [expenses, setExpenses] = useState<Expense[]>([...]);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculations
  const filteredExpenses = useMemo(() => {
    // filtering logic
  }, [expenses, searchQuery]);

  // Handlers
  const handleAddExpense = () => { /* logic */ };
  const handleCSVExport = () => { /* logic */ };

  return (
    <PageLayout title="Expenses" statsCards={statsCards}>
      <ExpensesLayout
        expenses={expenses}
        filteredExpenses={filteredExpenses}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onAddExpense={handleAddExpense}
        onCSVExport={handleCSVExport}
        // ... all other props
      />
    </PageLayout>
  );
}
```

## Props Interface

The `ExpensesLayoutProps` interface defines a clean contract between business logic and UI:

```typescript
interface ExpensesLayoutProps {
  // Data (read-only from UI perspective)
  expenses: Expense[];
  filteredExpenses: Expense[];
  monthlyBreakdown: MonthlyBreakdown[];
  categories: string[];

  // Handlers (business logic callbacks)
  onSearch: (query: string) => void;
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  // ... more handlers

  // Utility functions
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}
```

## Migration Status

| Component                  | Status     | Notes                          |
| -------------------------- | ---------- | ------------------------------ |
| ExpensesLayout.tsx         | ✅ Created | Full UI abstraction            |
| Expense interface          | ✅ Defined | Type-safe data structure       |
| MonthlyBreakdown interface | ✅ Defined | Analytics data structure       |
| Props interface            | ✅ Defined | 40+ props for complete control |
| page.tsx refactor          | ⚠️ Pending | Optional migration step        |

## Next Steps

### Option 1: Refactor Existing Page (Recommended)

1. Import ExpensesLayout in page.tsx
2. Move all UI code to use ExpensesLayout component
3. Keep all business logic in page.tsx
4. Test thoroughly
5. Remove old UI code
6. Benefit from abstraction immediately

### Option 2: Keep Current Implementation

1. Use ExpensesLayout for future pages only
2. Current expenses page continues working
3. No risk of breaking changes
4. Gradual migration when needed

### Option 3: Hybrid Approach

1. Use modular components (ReceiptViewer, TableContainer, etc.)
2. Keep some custom UI in page.tsx
3. Partial abstraction benefits

## Comparison with Other Pages

The expenses abstraction follows the exact same pattern:

```typescript
// Transactions
<TransactionsLayout
  data={transactions}
  filteredData={filteredTransactions}
  onGenerateInvoice={handleGenerateInvoice}
  // ...
/>

// Products
<ProductsLayout
  data={products}
  filteredData={filteredProducts}
  onAddProduct={handleAddProduct}
  // ...
/>

// Expenses (NEW!)
<ExpensesLayout
  expenses={expenses}
  filteredExpenses={filteredExpenses}
  onAddExpense={handleAddExpense}
  // ...
/>
```

## Testing Checklist

Before using ExpensesLayout in production:

- [ ] Import ExpensesLayout in page.tsx
- [ ] Pass all required props
- [ ] Test search functionality
- [ ] Test category/status filters
- [ ] Test CSV import/export
- [ ] Test add/edit/delete operations
- [ ] Test approve/reject actions
- [ ] Test receipt viewing
- [ ] Test tab switching
- [ ] Test analytics calculations
- [ ] Verify styling matches current design
- [ ] Test responsive behavior
- [ ] Check for TypeScript errors

## Key Features of This Abstraction

1. **Complete Table Rendering**: Both expense list and analytics tables
2. **Modal Management**: Add/edit expense form modal
3. **Receipt Integration**: Clickable receipt links with viewing capability
4. **Status Actions**: Approve/reject buttons for pending expenses
5. **Tab Navigation**: Clean switching between list and analytics views
6. **Consistent Styling**: 71vh table height, #495057 text, #f1f3f5 headers
7. **Type Safety**: Full TypeScript interfaces for all props
8. **Empty States**: Proper handling of no data scenarios

## Documentation

- Full component JSDoc comments
- TypeScript interfaces with descriptions
- Usage examples in this file
- Consistent with other page abstractions

---

**Status**: ✅ Complete - ExpensesLayout abstraction layer ready for use
**Location**: `/src/components/features/expenses/ExpensesLayout.tsx`
**Integration**: Optional refactor of page.tsx or use in new pages
