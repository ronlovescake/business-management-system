# Expenses Page - Modular Architecture Diagram

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         page.tsx (193 lines)                     │
│                    Main Orchestration Layer                      │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  const { ...all state & handlers } = useExpenses();     │    │
│  └────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            PageLayout (Next.js Layout)                    │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │          Stack (Mantine Container)                  │  │  │
│  │  │                                                      │  │  │
│  │  │  [1] StatsCards Component                           │  │  │
│  │  │  [2] ExpenseControls Component                      │  │  │
│  │  │  [3] Conditional Rendering:                         │  │  │
│  │  │      - ExpenseListTable OR                          │  │  │
│  │  │      - AnalyticsTable                               │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  [4] ExpenseFormDialog (Modal)                            │  │
│  │  [5] ReceiptViewerModal (Modal)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
📁 src/app/clothing/employees/expenses/
│
├── 📄 page.tsx (193 lines) ⭐ MAIN ENTRY POINT
│   │
│   ├─[imports]─> hooks/useExpenses.ts
│   ├─[imports]─> components/StatsCards.tsx
│   ├─[imports]─> components/ExpenseControls.tsx
│   ├─[imports]─> components/ExpenseListTable.tsx
│   ├─[imports]─> components/AnalyticsTable.tsx
│   ├─[imports]─> components/ExpenseFormDialog.tsx
│   └─[imports]─> components/ReceiptViewerModal.tsx
│
├── 📁 hooks/
│   └── 📄 useExpenses.ts (726 lines) 🧠 BUSINESS LOGIC
│       ├── State Management
│       ├── Computed Values (useMemo)
│       ├── Event Handlers
│       └── Utility Functions
│
└── 📁 components/
    ├── 📄 StatsCards.tsx (126 lines) 📊
    │   └── Displays 4 glassmorphism stat cards
    │
    ├── 📄 ExpenseControls.tsx (154 lines) 🎛️
    │   ├── Tab Navigation (List / Analytics)
    │   ├── Search Bar
    │   ├── Category Filter
    │   ├── Status Filter
    │   └── Action Buttons (Import/Export/Add)
    │
    ├── 📄 ExpenseListTable.tsx (274 lines) 📋
    │   ├── 7-Column Table
    │   ├── Approve/Reject Actions
    │   ├── Edit/Delete Actions
    │   └── Summary Card
    │
    ├── 📄 AnalyticsTable.tsx (169 lines) 📈
    │   ├── Category Breakdown
    │   ├── Monthly Statistics
    │   ├── Percentage Bars
    │   └── Total Row
    │
    ├── 📄 ExpenseFormDialog.tsx (291 lines) ✏️
    │   ├── Add/Edit Form
    │   ├── Form Validation
    │   └── Receipt Upload
    │
    └── 📄 ReceiptViewerModal.tsx (117 lines) 🖼️
        ├── Image Display
        ├── Zoom Controls
        └── Download Button
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      useExpenses Hook                        │
│                    (Business Logic Layer)                    │
│                                                              │
│  STATE:                                                      │
│  • expenses: Expense[]                                       │
│  • searchQuery: string                                       │
│  • filterCategory: string | null                             │
│  • filterStatus: string | null                               │
│  • isModalOpen: boolean                                      │
│  • formData: { date, amount, description, ... }              │
│                                                              │
│  COMPUTED:                                                   │
│  • filteredExpenses (useMemo)                                │
│  • totalExpenses (useMemo)                                   │
│  • monthlyBreakdown (useMemo)                                │
│  • stats (useMemo)                                           │
│                                                              │
│  HANDLERS:                                                   │
│  • handleAddExpense()                                        │
│  • handleEditExpense(expense)                                │
│  • handleDeleteExpense(id)                                   │
│  • handleImportCSV(file)                                     │
│  • handleExportCSV()                                         │
│  • handleApprove(id)                                         │
│  • handleReject(id)                                          │
│                                                              │
│  UTILITIES:                                                  │
│  • formatCurrency(amount)                                    │
│  • formatDate(date)                                          │
│  • getCategoryColor(category)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       page.tsx                               │
│                  (Orchestration Layer)                       │
│                                                              │
│  • Calls useExpenses() hook                                  │
│  • Receives all state, handlers, utilities                   │
│  • Passes props to child components                          │
│  • No business logic                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    UI Components                             │
│                 (Presentation Layer)                         │
│                                                              │
│  StatsCards ────────> Receives: stats + formatCurrency       │
│  ExpenseControls ───> Receives: filters + handlers           │
│  ExpenseListTable ──> Receives: expenses + handlers          │
│  AnalyticsTable ────> Receives: breakdown + formatters       │
│  ExpenseFormDialog ─> Receives: form state + handlers        │
│  ReceiptViewerModal > Receives: receipt data + handlers      │
│                                                              │
│  • Pure presentation components                              │
│  • No business logic                                         │
│  • Fully reusable                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsibility Matrix

| Layer              | File                     | Responsibilities                                                                        | Lines |
| ------------------ | ------------------------ | --------------------------------------------------------------------------------------- | ----- |
| **Orchestration**  | `page.tsx`               | • Import hook<br>• Compose UI<br>• Pass props<br>• Route rendering                      | 193   |
| **Business Logic** | `useExpenses.ts`         | • State management<br>• Data transformation<br>• Event handling<br>• API calls (future) | 726   |
| **UI - Stats**     | `StatsCards.tsx`         | • Display 4 stat cards<br>• Visual effects<br>• Responsive layout                       | 126   |
| **UI - Controls**  | `ExpenseControls.tsx`    | • Tab navigation<br>• Search & filters<br>• Action buttons                              | 154   |
| **UI - List**      | `ExpenseListTable.tsx`   | • Expense table<br>• CRUD actions<br>• Summary display                                  | 274   |
| **UI - Analytics** | `AnalyticsTable.tsx`     | • Category breakdown<br>• Monthly view<br>• Progress bars                               | 169   |
| **UI - Form**      | `ExpenseFormDialog.tsx`  | • Add/Edit form<br>• Validation<br>• File upload                                        | 291   |
| **UI - Receipt**   | `ReceiptViewerModal.tsx` | • Image display<br>• Zoom controls<br>• Download                                        | 117   |

---

## Before vs After Comparison

### Before: Monolithic (1,643 lines)

```
page.tsx (1,643 lines)
├── Lines 1-50:    Imports
├── Lines 51-100:  Interfaces
├── Lines 101-300: State declarations
├── Lines 301-400: Utility functions
├── Lines 401-800: Business logic (computed values)
├── Lines 801-1200: Event handlers
└── Lines 1201-1643: JSX (UI rendering)

❌ Everything mixed together
❌ Hard to navigate
❌ Difficult to test
❌ Impossible to reuse
```

### After: Modular (8 files, 2,050 lines total)

```
✅ page.tsx (193 lines)
   └── Only orchestration

✅ useExpenses.ts (726 lines)
   └── All business logic

✅ StatsCards.tsx (126 lines)
   └── Stats UI only

✅ ExpenseControls.tsx (154 lines)
   └── Controls UI only

✅ ExpenseListTable.tsx (274 lines)
   └── List UI only

✅ AnalyticsTable.tsx (169 lines)
   └── Analytics UI only

✅ ExpenseFormDialog.tsx (291 lines)
   └── Form UI only

✅ ReceiptViewerModal.tsx (117 lines)
   └── Receipt UI only

✅ Single responsibility per file
✅ Easy to navigate
✅ Easy to test
✅ Fully reusable
```

---

## Testing Strategy

### Unit Tests

```tsx
// Test business logic in isolation
import { renderHook } from '@testing-library/react';
import { useExpenses } from '../hooks/useExpenses';

describe('useExpenses', () => {
  it('filters expenses by search query', () => {
    const { result } = renderHook(() => useExpenses());

    act(() => {
      result.current.setSearchQuery('Office');
    });

    expect(result.current.filteredExpenses).toHaveLength(1);
  });

  it('calculates total expenses correctly', () => {
    const { result } = renderHook(() => useExpenses());
    expect(result.current.totalExpenses).toBe(1900);
  });
});
```

### Component Tests

```tsx
// Test UI components in isolation
import { render, screen } from '@testing-library/react';
import { StatsCards } from '../components/StatsCards';

describe('StatsCards', () => {
  it('displays all stat cards', () => {
    render(
      <StatsCards
        totalExpenses={1000}
        pendingExpenses={5}
        approvedExpenses={800}
        thisMonthExpenses={500}
        formatCurrency={(n) => `₱${n}`}
      />
    );

    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('₱1000')).toBeInTheDocument();
  });
});
```

---

## Performance Optimization

### Memoization

```tsx
// All computed values are memoized
const filteredExpenses = useMemo(() => {
  return expenses.filter(/* ... */);
}, [expenses, searchQuery, filterCategory, filterStatus]);

const monthlyBreakdown = useMemo(() => {
  return categories.map(/* ... */);
}, [expenses, categories, totalExpenses]);
```

### Component Splitting

```tsx
// Large tables are separate components
// React can optimize rendering independently
<ExpenseListTable />  // 274 lines
<AnalyticsTable />    // 169 lines
```

### Conditional Rendering

```tsx
// Only render active tab
{activeTab === 'list' ? (
  <ExpenseListTable {...} />  // Render only when active
) : (
  <AnalyticsTable {...} />    // Render only when active
)}
```

---

## Scalability Path

### Adding New Features

#### Feature: Export to PDF

```tsx
// 1. Add handler to useExpenses hook
const handleExportPDF = () => {
  // PDF generation logic
};

// 2. Update ExpenseControls component
<Button onClick={handleExportPDF}>Export PDF</Button>;
```

#### Feature: Expense Categories Management

```tsx
// 1. Create new component
// components/CategoryManager.tsx

// 2. Add to page.tsx
<CategoryManager
  categories={categories}
  onAdd={handleAddCategory}
  onEdit={handleEditCategory}
  onDelete={handleDeleteCategory}
/>
```

---

## Migration Checklist for Other Pages

- [ ] Create `hooks/use{PageName}.ts` for business logic
- [ ] Extract stats cards component
- [ ] Extract controls/filters component
- [ ] Extract main table component
- [ ] Extract form dialog component
- [ ] Extract additional modals as needed
- [ ] Update page.tsx to use hook + components
- [ ] Run TypeScript check (zero errors)
- [ ] Test all features work correctly
- [ ] Commit changes

---

## Success Metrics

### ✅ Code Quality

- Main page: 193 lines (was 1,643)
- Business logic: Isolated in hook (726 lines)
- UI components: 6 modular files
- TypeScript: Zero errors
- Test coverage: Ready for testing

### ✅ Architecture

- Separation of concerns: Perfect
- Single responsibility: Each file
- Reusability: High
- Maintainability: Excellent
- Scalability: Ready

### ✅ Developer Experience

- File navigation: Fast
- Code comprehension: Easy
- Feature additions: Straightforward
- Bug fixes: Isolated
- Code reviews: Manageable

---

**Status**: ✅ Production Ready  
**Next**: Apply to Customers and Invoices pages
