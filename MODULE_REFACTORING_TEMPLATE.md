# 📚 MODULE REFACTORING TEMPLATE PATTERN

## 🎯 Complete Step-by-Step Guide

**Purpose:** Refactor any monolithic page into modular architecture  
**Proven On:** Due Dates (428 lines) + Transactions (3,857 lines)  
**Success Rate:** 100% - Zero TypeScript errors, 100% business logic preserved  
**Time Estimate:** 2-8 hours depending on complexity

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Module Structure](#module-structure)
4. [Step-by-Step Process](#step-by-step-process)
5. [Type Definitions](#type-definitions)
6. [Service Layer](#service-layer)
7. [Hooks Layer](#hooks-layer)
8. [Components Layer](#components-layer)
9. [Module Configuration](#module-configuration)
10. [Registration](#registration)
11. [Route Update](#route-update)
12. [Validation Checklist](#validation-checklist)
13. [Common Issues & Solutions](#common-issues--solutions)
14. [Best Practices](#best-practices)

---

## 🎯 Overview

### What This Pattern Does

Transforms a monolithic page file into a modular architecture:

**Before:**

```
/src/app/[business]/[workspace]/[page]/page.tsx
└── 500-4,000 lines (everything in one file)
    ├── Types (inline)
    ├── Business logic (embedded)
    ├── React hooks (inline)
    ├── UI components (mixed)
    └── Utility functions (scattered)
```

**After:**

```
/src/modules/[business]/[workspace]/[page]/
├── types/
│   └── [page].types.ts           (All interfaces & types)
├── services/
│   └── [Page]Service.ts          (All business logic)
├── hooks/
│   ├── use[Page]Data.ts          (Data fetching & state)
│   ├── use[Page]Operations.ts   (CRUD operations)
│   └── use[Page]Modals.ts        (Modal workflows)
├── components/
│   ├── [Page]Page.tsx            (Main UI component)
│   └── [Page]Modals.tsx          (Modal components)
├── module.config.ts              (Module registration)
└── index.ts                      (Public API)
```

### Benefits Achieved

✅ **Maintainability**: Small, focused files vs monolith  
✅ **Testability**: Business logic in services (unit testable)  
✅ **Reusability**: Shared services prevent duplication  
✅ **Type Safety**: Full TypeScript strict mode compliance  
✅ **Scalability**: Pattern works for any complexity level  
✅ **Performance**: Optimized re-renders, better code splitting

---

## ✅ Prerequisites

### Before Starting

1. **Backup Original File**

   ```bash
   cp src/app/[business]/[workspace]/[page]/page.tsx \
      src/app/[business]/[workspace]/[page]/page.tsx.backup
   ```

2. **Understand Current Functionality**
   - [ ] Document all features
   - [ ] List all formulas/calculations
   - [ ] Note all business rules
   - [ ] Identify external dependencies
   - [ ] Map out modal workflows

3. **Environment Check**
   - [ ] TypeScript strict mode enabled
   - [ ] ESLint configured
   - [ ] Git repository clean (commit pending changes)
   - [ ] Development server running

4. **Review Existing Modules**
   - [ ] Study Due Dates module (simpler example)
   - [ ] Study Transactions module (complex example)
   - [ ] Understand shared services available

---

## 🏗️ Module Structure

### Directory Layout

Create the following structure:

```bash
/src/modules/[business]/[workspace]/[page]/
├── types/
│   └── [page].types.ts              # 150-350 lines
├── services/
│   └── [Page]Service.ts             # 200-600 lines
├── hooks/
│   ├── use[Page]Data.ts             # 200-500 lines
│   ├── use[Page]Operations.ts      # 300-800 lines
│   └── use[Page]Modals.ts           # 200-600 lines (if modals exist)
├── components/
│   ├── [Page]Page.tsx               # 300-600 lines
│   └── [Page]Modals.tsx             # 200-600 lines (if modals exist)
├── module.config.ts                 # 50-80 lines
└── index.ts                         # 30-60 lines
```

### Naming Conventions

- **Types file**: Lowercase with extension (e.g., `transaction.types.ts`)
- **Service file**: PascalCase + Service (e.g., `TransactionService.ts`)
- **Hook files**: camelCase with `use` prefix (e.g., `useTransactionData.ts`)
- **Component files**: PascalCase (e.g., `TransactionsPage.tsx`)
- **Config file**: Lowercase (e.g., `module.config.ts`)
- **Public API**: Lowercase (e.g., `index.ts`)

---

## 📝 Step-by-Step Process

### Phase 1: Analysis & Planning (30-60 minutes)

#### Step 1.1: Read Original File Thoroughly

```bash
# Open original file
code src/app/[business]/[workspace]/[page]/page.tsx

# Count lines to estimate effort
wc -l src/app/[business]/[workspace]/[page]/page.tsx
```

**Document:**

- [ ] Total lines count
- [ ] Number of interfaces/types
- [ ] Number of functions
- [ ] Number of hooks used
- [ ] Number of components
- [ ] Number of modals
- [ ] External dependencies

#### Step 1.2: Identify Business Logic

**Look for:**

- Calculation functions
- Validation functions
- Data transformation functions
- Business rules (if/else logic)
- Formula implementations

**Example from Transactions:**

```typescript
// Business logic to extract:
const calculateUnitPrice = (tierPrice: number, discount: number) => {
  return tierPrice - discount;
};

const calculateLineTotal = (
  quantity: number,
  unitPrice: number,
  adjustment: number
) => {
  return quantity * unitPrice - adjustment;
};
```

#### Step 1.3: Map Data Flow

**Identify:**

- Data sources (API calls, databases, CSV files)
- State management (useState, useRef)
- Data transformations
- Filtering/searching logic
- Statistics calculations

#### Step 1.4: List UI Components

**Document:**

- Main grid/table component
- Statistics cards
- Modal components
- Form inputs
- Buttons and actions

---

### Phase 2: Create Directory Structure (5 minutes)

```bash
# Navigate to modules directory
cd src/modules/[business]/[workspace]

# Create module directory
mkdir -p [page]/types
mkdir -p [page]/services
mkdir -p [page]/hooks
mkdir -p [page]/components

# Create empty files
touch [page]/types/[page].types.ts
touch [page]/services/[Page]Service.ts
touch [page]/hooks/use[Page]Data.ts
touch [page]/hooks/use[Page]Operations.ts
touch [page]/hooks/use[Page]Modals.ts  # if needed
touch [page]/components/[Page]Page.tsx
touch [page]/components/[Page]Modals.tsx  # if needed
touch [page]/module.config.ts
touch [page]/index.ts
```

**Example for Products module:**

```bash
mkdir -p products/types
mkdir -p products/services
mkdir -p products/hooks
mkdir -p products/components
touch products/types/product.types.ts
touch products/services/ProductService.ts
touch products/hooks/useProductsData.ts
touch products/hooks/useProductOperations.ts
touch products/components/ProductsPage.tsx
touch products/module.config.ts
touch products/index.ts
```

---

### Phase 3: Extract Types (30-60 minutes)

#### Step 3.1: Create Base Data Interface

**Location:** `types/[page].types.ts`

**Template:**

```typescript
/**
 * [Page Name] Types
 *
 * Core type definitions for [Page Name] module
 */

import type { GridCell } from '@glideapps/glide-data-grid';

// ============================================================================
// MAIN DATA INTERFACE
// ============================================================================

export interface [Entity]Data {
  id: string;
  // Add all fields from your data structure
  createdAt?: Date;
  updatedAt?: Date;
}

// ============================================================================
// GRID TYPES
// ============================================================================

export type [Entity]GridCell = GridCell;

export interface [Entity]Column {
  id: string;
  title: string;
  width: number;
}

// ============================================================================
// STATISTICS
// ============================================================================

export interface [Entity]Statistics {
  total: number;
  // Add all statistics fields
}

// ============================================================================
// FILTER & SEARCH
// ============================================================================

export interface [Entity]FilterState {
  searchQuery: string;
  // Add filter fields
}

// ============================================================================
// MODAL DATA (if applicable)
// ============================================================================

export interface [Entity]ModalData {
  // Modal-specific data
}

// ============================================================================
// FORM DATA (if applicable)
// ============================================================================

export interface [Entity]FormData {
  // Form fields
}

// ============================================================================
// VALIDATION RESULTS
// ============================================================================

export interface [Entity]ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// OPTIONS & CONSTANTS
// ============================================================================

export const [ENTITY]_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export type [Entity]Status = typeof [ENTITY]_STATUS_OPTIONS[number]['value'];
```

**Real Example from Transactions:**

```typescript
export interface TransactionData {
  id: string;
  productCode: string;
  customer: string;
  orderStatus: string;
  quantity: number;
  tierPrice: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  adjustment: number;
  paymentStatus: string;
  dateNeeded: string;
  dateReceived: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransactionStatistics {
  totalTransactions: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  paidOrders: number;
  unpaidOrders: number;
  partiallyPaidOrders: number;
  overdueOrders: number;
}
```

#### Step 3.2: Extract All Interfaces

**What to extract:**

- [ ] Main data interface
- [ ] Grid cell types
- [ ] Column definitions
- [ ] Statistics interface
- [ ] Filter state interface
- [ ] Modal data interfaces
- [ ] Form data interfaces
- [ ] Validation result interfaces
- [ ] Any utility types

#### Step 3.3: Extract Constants

**What to extract:**

- [ ] Status options
- [ ] Dropdown options
- [ ] Default values
- [ ] Configuration constants

**Example:**

```typescript
export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;
```

#### Step 3.4: Validate Types File

```bash
# Check for TypeScript errors
npx tsc --noEmit src/modules/[business]/[workspace]/[page]/types/[page].types.ts
```

**Must have:**

- ✅ Zero TypeScript errors
- ✅ All interfaces exported
- ✅ Proper JSDoc comments
- ✅ Consistent naming

---

### Phase 4: Create Service Layer (60-120 minutes)

#### Step 4.1: Service Template

**Location:** `services/[Page]Service.ts`

**Template:**

```typescript
/**
 * [Page Name] Service
 *
 * Business logic for [Page Name] module
 *
 * This service handles:
 * - Data validation
 * - Calculations and formulas
 * - Business rules
 * - Data transformations
 * - CSV parsing
 * - Statistics calculations
 */

import { FormatterService } from '@/services/FormatterService';
import { ValidationService } from '@/services/ValidationService';
import type { [Entity]Data, [Entity]Statistics } from '../types/[page].types';

export class [Page]Service {
  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  constructor(
    private formatterService: FormatterService,
    private validationService: ValidationService
  ) {}

  // =========================================================================
  // VALIDATION
  // =========================================================================

  validate[Entity](data: Partial<[Entity]Data>): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Add validation logic

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // =========================================================================
  // CALCULATIONS
  // =========================================================================

  calculate[Something](/* parameters */): number {
    // Add calculation logic
    return 0;
  }

  // =========================================================================
  // STATISTICS
  // =========================================================================

  calculateStatistics(data: [Entity]Data[]): [Entity]Statistics {
    // Calculate all statistics
    return {
      total: data.length,
      // ... other statistics
    };
  }

  // =========================================================================
  // DATA TRANSFORMATION
  // =========================================================================

  transform[Entity](raw: any): [Entity]Data {
    // Transform raw data to typed data
    return {
      id: raw.id,
      // ... map all fields
    };
  }

  // =========================================================================
  // CSV PARSING
  // =========================================================================

  parseCSV(csvContent: string): [Entity]Data[] {
    // Parse CSV and return typed data
    return [];
  }

  // =========================================================================
  // UTILITY FUNCTIONS
  // =========================================================================

  sanitizeValue(value: any): string | null {
    if (value === null || value === undefined || value === '' || value === 'null') {
      return null;
    }
    return String(value).trim();
  }

  sanitizeNumericValue(value: any): number {
    const sanitized = this.sanitizeValue(value);
    if (sanitized === null) return 0;
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
  }
}

// Export singleton instance
export const [page]Service = new [Page]Service(
  FormatterService.getInstance(),
  ValidationService.getInstance()
);
```

#### Step 4.2: Extract Business Logic

**Critical: Preserve formulas EXACTLY!**

**From Transactions (PROTECTED FORMULAS):**

```typescript
// ✅ CORRECT - Preserved exactly as-is
calculateUnitPrice(tierPrice: number, discount: number): number {
  return tierPrice - discount;  // EXACT FORMULA
}

calculateLineTotal(quantity: number, unitPrice: number, adjustment: number): number {
  return (quantity * unitPrice) - adjustment;  // EXACT FORMULA
}
```

**Steps:**

1. Find all calculation functions
2. Copy EXACTLY (including comments)
3. Add to service class
4. Add proper typing
5. Test calculations match original

#### Step 4.3: Extract Validation Logic

**What to extract:**

- Field validation (email, phone, codes)
- Business rules (banned customers, stock levels)
- Cross-field validation
- Custom validation functions

**Example:**

```typescript
validateCustomer(customerName: string, customers: CustomerData[]): CustomerValidationResult {
  const customer = customers.find(c => c.name === customerName);

  if (!customer) {
    return {
      isValid: true,
      warnings: ['Customer not found in database'],
    };
  }

  if (customer.isBanned) {
    return {
      isValid: false,
      errors: ['This customer is BANNED'],
      showWarning: true,
    };
  }

  const cancellationRate = customer.cancelledOrders / customer.totalOrders;
  if (cancellationRate >= 0.5) {
    return {
      isValid: true,
      warnings: [`High cancellation rate: ${(cancellationRate * 100).toFixed(0)}%`],
      showWarning: true,
    };
  }

  return { isValid: true };
}
```

#### Step 4.4: Extract Data Transformations

**What to extract:**

- CSV parsing
- API response mapping
- Data formatting
- Data sanitization

#### Step 4.5: Integrate Shared Services

**Use FormatterService for:**

- Currency formatting
- Date formatting
- Number formatting
- Phone formatting

**Use ValidationService for:**

- Email validation
- Product code validation
- Customer name validation
- Standard field validation

**Example:**

```typescript
formatCurrency(amount: number): string {
  return this.formatterService.formatCurrency(amount);
}

validateEmail(email: string): boolean {
  return this.validationService.isValidEmail(email);
}
```

#### Step 4.6: Validate Service

```bash
# Check for TypeScript errors
npx tsc --noEmit src/modules/[business]/[workspace]/[page]/services/[Page]Service.ts
```

**Must have:**

- ✅ Zero TypeScript errors
- ✅ All business logic extracted
- ✅ Formulas preserved exactly
- ✅ Shared services integrated
- ✅ Proper JSDoc comments

---

### Phase 5: Create Hooks Layer (90-180 minutes)

This is the most complex phase. We'll create 2-3 hooks:

1. **use[Page]Data** - Data fetching, filtering, statistics
2. **use[Page]Operations** - CRUD operations, cell editing
3. **use[Page]Modals** - Modal workflows (if applicable)

#### Step 5.1: Data Hook (use[Page]Data.ts)

**Purpose:** Handle data fetching, filtering, searching, statistics

**Template:**

```typescript
'use client';

/**
 * use[Page]Data Hook
 *
 * Manages data fetching, filtering, and statistics for [Page Name]
 */

import { useMemo, useCallback } from 'react';
import { use[Page]Data as useDataFetching } from '@/hooks/use[Page]Data';
import { [page]Service } from '../services/[Page]Service';
import type { [Entity]Data, [Entity]Statistics, [Entity]FilterState } from '../types/[page].types';

export function use[Page]Data() {
  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const {
    data: [entities],
    isLoading,
    error,
    mutate: refresh[Entities],
    update[Entity]Data,
  } = useDataFetching();

  // ==========================================================================
  // FILTERING & SEARCH
  // ==========================================================================

  const [filterState, setFilterState] = useState<[Entity]FilterState>({
    searchQuery: '',
  });

  const filteredData = useMemo(() => {
    let filtered = [...([entities] || [])];

    // Apply search
    if (filterState.searchQuery) {
      const query = filterState.searchQuery.toLowerCase();
      filtered = filtered.filter((item) =>
        // Add search logic for each field
        item.name?.toLowerCase().includes(query) ||
        item.code?.toLowerCase().includes(query)
      );
    }

    // Apply other filters
    // ...

    return filtered;
  }, [[entities], filterState]);

  // ==========================================================================
  // STATISTICS
  // ==========================================================================

  const statistics = useMemo(() => {
    return [page]Service.calculateStatistics(filteredData);
  }, [filteredData]);

  // ==========================================================================
  // BULK UPDATE
  // ==========================================================================

  const bulkUpdate = useCallback(
    async (updates: Map<string, Partial<[Entity]Data>>) => {
      // Implement bulk update logic
    },
    [update[Entity]Data]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    [entities]: filteredData,
    all[Entities]: [entities] || [],
    isLoading,
    error,

    // Statistics
    statistics,

    // Filters
    filterState,
    setFilterState,

    // Operations
    refresh[Entities],
    update[Entity],
    bulkUpdate,
  };
}
```

**Key Points:**

- ✅ Add `'use client'` directive at top
- ✅ Use existing data hooks (don't recreate API calls)
- ✅ Keep filtering logic here
- ✅ Calculate statistics using service
- ✅ Return clean API

#### Step 5.2: Operations Hook (use[Page]Operations.ts)

**Purpose:** Handle CRUD operations, cell editing, batch operations

**Template:**

```typescript
'use client';

/**
 * use[Page]Operations Hook
 *
 * Manages CRUD operations and cell editing for [Page Name]
 */

import { useCallback, useRef } from 'react';
import type { GridCell, GridCellKind, Item } from '@glideapps/glide-data-grid';
import { [page]Service } from '../services/[Page]Service';
import type { [Entity]Data } from '../types/[page].types';

interface Use[Page]OperationsProps {
  [entities]: [Entity]Data[];
  update[Entity]: (id: string, updates: Partial<[Entity]Data>) => Promise<void>;
  bulkUpdate: (updates: Map<string, Partial<[Entity]Data>>) => Promise<void>;
  // Add other dependencies
}

export function use[Page]Operations({
  [entities],
  update[Entity],
  bulkUpdate,
}: Use[Page]OperationsProps) {
  // ==========================================================================
  // BATCH MODE
  // ==========================================================================

  const batchUpdatesRef = useRef<Map<string, Partial<[Entity]Data>>>(new Map());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to get current transaction with pending batch updates
  const getCurrent[Entity] = useCallback(
    ([entity]Id: string) => {
      const [entity] = [entities].find((t) => t.id === [entity]Id);
      if (![entity]) return null;

      const batchUpdate = batchUpdatesRef.current.get([entity]Id);
      if (batchUpdate) {
        return { ...[entity], ...batchUpdate };
      }
      return [entity];
    },
    [[entities]]
  );

  // ==========================================================================
  // CELL EDITING
  // ==========================================================================

  const handleCellEdited = useCallback(
    async (cell: Item, newValue: GridCell): Promise<void> => {
      const [col, row] = cell;
      const [entity] = [entities][row];
      if (![entity]) return;

      const current[Entity] = getCurrent[Entity]([entity].id);
      if (!current[Entity]) return;

      // Determine column being edited
      const columnId = COLUMNS[col].id;

      switch (columnId) {
        case 'fieldName': {
          // Handle field edit
          const updatedFields = {
            fieldName: newValue.data as string,
          };

          // Update immediately for UI
          await update[Entity]([entity].id, updatedFields);
          break;
        }

        case 'numericField': {
          // Handle numeric field with calculations
          const value = [page]Service.sanitizeNumericValue(newValue.data);

          // Perform calculations
          const calculated = [page]Service.calculateSomething(value);

          const updatedFields = {
            numericField: value,
            calculatedField: calculated,
          };

          await update[Entity]([entity].id, updatedFields);
          break;
        }

        // Add handlers for all columns
      }
    },
    [[entities], update[Entity], getCurrent[Entity]]
  );

  // ==========================================================================
  // BATCH PASTE
  // ==========================================================================

  const handlePaste = useCallback(
    async (target: Item, values: string[][]): Promise<boolean> => {
      // Implement batch paste logic
      return true;
    },
    [[entities], bulkUpdate]
  );

  // ==========================================================================
  // CSV IMPORT
  // ==========================================================================

  const handleCSVImport = useCallback(
    async (file: File): Promise<void> => {
      // Read file
      const text = await file.text();

      // Parse using service
      const parsed = [page]Service.parseCSV(text);

      // Validate and import
      // ...
    },
    [bulkUpdate]
  );

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    handleCellEdited,
    handlePaste,
    handleCSVImport,
  };
}
```

**Critical Points:**

- ✅ Add `'use client'` directive
- ✅ Use `getCurrent[Entity]()` pattern for batch mode
- ✅ Only update changed fields (prevents field clearing bug)
- ✅ Call service for calculations
- ✅ Handle all column types (text, number, dropdown, date)

**Field Update Pattern (IMPORTANT):**

```typescript
// ❌ WRONG - Spreads entire transaction, causes field clearing
const updatedTransaction = {
  ...currentTransaction,
  quantity: newQuantity,
};

// ✅ CORRECT - Only update changed fields
const updatedFields = {
  quantity: newQuantity,
  lineTotal: calculated, // Only recalculated fields
};

// For database save, merge if needed
const fullTransaction = {
  ...currentTransaction,
  ...updatedFields,
};
```

#### Step 5.3: Modals Hook (use[Page]Modals.ts) - If Applicable

**Purpose:** Manage modal state and workflows

**Template:**

```typescript
'use client';

/**
 * use[Page]Modals Hook
 *
 * Manages modal state and workflows for [Page Name]
 */

import { useState, useCallback } from 'react';
import type { [Entity]Data, [Entity]ModalData } from '../types/[page].types';

export function use[Page]Modals() {
  // ==========================================================================
  // MODAL STATE
  // ==========================================================================

  const [modal1Opened, setModal1Opened] = useState(false);
  const [modal1Data, setModal1Data] = useState<[Entity]ModalData | null>(null);

  // ==========================================================================
  // MODAL 1 WORKFLOW
  // ==========================================================================

  const prepareModal1 = useCallback(([entity]: [Entity]Data) => {
    setModal1Data({
      // Prepare modal data
    });
    setModal1Opened(true);
  }, []);

  const confirmModal1 = useCallback(async () => {
    if (!modal1Data) return;

    try {
      // Perform modal action
      setModal1Opened(false);
      setModal1Data(null);
    } catch (error) {
      console.error('Modal 1 error:', error);
    }
  }, [modal1Data]);

  const cancelModal1 = useCallback(() => {
    setModal1Opened(false);
    setModal1Data(null);
  }, []);

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Modal 1
    modal1Opened,
    modal1Data,
    prepareModal1,
    confirmModal1,
    cancelModal1,

    // Add more modals as needed
  };
}
```

#### Step 5.4: Validate All Hooks

```bash
# Check each hook for errors
npx tsc --noEmit src/modules/[business]/[workspace]/[page]/hooks/*.ts
```

**Must have:**

- ✅ `'use client'` directive on all hooks
- ✅ Zero TypeScript errors
- ✅ Proper dependency arrays
- ✅ No infinite loops (careful with useEffect dependencies)
- ✅ Clean return API

---

### Phase 6: Create Components (60-90 minutes)

#### Step 6.1: Main Page Component

**Location:** `components/[Page]Page.tsx`

**Template:**

```typescript
'use client';

/**
 * [Page Name] Page Component
 *
 * Main page component for [Page Name] module
 */

import { Stack, Text, Group, Button, TextInput } from '@mantine/core';
import DataEditor, { GridColumn, GridCellKind, Item } from '@glideapps/glide-data-grid';
import { use[Page]Data } from '../hooks/use[Page]Data';
import { use[Page]Operations } from '../hooks/use[Page]Operations';
import { use[Page]Modals } from '../hooks/use[Page]Modals'; // if applicable

export function [Page]Page() {
  // ==========================================================================
  // HOOKS
  // ==========================================================================

  const {
    [entities],
    isLoading,
    statistics,
    filterState,
    setFilterState,
    update[Entity],
    bulkUpdate,
    refresh[Entities],
  } = use[Page]Data();

  const {
    handleCellEdited,
    handlePaste,
    handleCSVImport,
  } = use[Page]Operations({
    [entities],
    update[Entity],
    bulkUpdate,
  });

  const modalHandlers = use[Page]Modals(); // if applicable

  // ==========================================================================
  // GRID CONFIGURATION
  // ==========================================================================

  const columns: GridColumn[] = [
    { title: 'Column 1', width: 150, id: 'col1' },
    { title: 'Column 2', width: 200, id: 'col2' },
    // Add all columns
  ];

  const getCellContent = useCallback((cell: Item): GridCell => {
    const [col, row] = cell;
    const [entity] = [entities][row];

    if (![entity]) {
      return { kind: GridCellKind.Text, data: '', allowOverlay: false, displayData: '' };
    }

    // Return cell content based on column
    switch (col) {
      case 0: // Column 1
        return {
          kind: GridCellKind.Text,
          data: [entity].field1 || '',
          allowOverlay: true,
          displayData: [entity].field1 || '',
        };

      // Add all column cases

      default:
        return { kind: GridCellKind.Text, data: '', allowOverlay: false, displayData: '' };
    }
  }, [[entities]]);

  // ==========================================================================
  // LOADING STATE
  // ==========================================================================

  if (isLoading) {
    return (
      <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
        <Text>Loading...</Text>
      </Stack>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <Stack gap="md" p="md">
      {/* Statistics Cards */}
      <Group gap="md">
        <StatCard title="Total" value={statistics.total} />
        {/* Add all stat cards */}
      </Group>

      {/* Search & Filters */}
      <Group gap="md">
        <TextInput
          placeholder="Search..."
          value={filterState.searchQuery}
          onChange={(e) => setFilterState({ ...filterState, searchQuery: e.target.value })}
        />
        {/* Add more filters */}
      </Group>

      {/* Actions */}
      <Group gap="md">
        <Button onClick={refresh[Entities]}>Refresh</Button>
        <Button onClick={() => {/* CSV import */}}>Import CSV</Button>
        {/* Add more actions */}
      </Group>

      {/* Grid */}
      <DataEditor
        columns={columns}
        rows={[entities].length}
        getCellContent={getCellContent}
        onCellEdited={handleCellEdited}
        onPaste={handlePaste}
        height="600px"
        // Add all grid props
      />
    </Stack>
  );
}
```

**Key Points:**

- ✅ Add `'use client'` directive
- ✅ Use hooks for all logic
- ✅ Keep component focused on UI
- ✅ Proper loading states
- ✅ Match original UI exactly

#### Step 6.2: Modal Components (if applicable)

**Location:** `components/[Page]Modals.tsx`

**Template:**

```typescript
'use client';

/**
 * [Page Name] Modals
 *
 * Modal components for [Page Name]
 */

import { Modal, Stack, Text, Button, Group } from '@mantine/core';

interface [Page]ModalsProps {
  // Modal props from hook
  modal1Opened: boolean;
  modal1Data: any;
  confirmModal1: () => void;
  cancelModal1: () => void;
}

export function [Page]Modals({
  modal1Opened,
  modal1Data,
  confirmModal1,
  cancelModal1,
}: [Page]ModalsProps) {
  return (
    <>
      {/* Modal 1 */}
      <Modal
        opened={modal1Opened}
        onClose={cancelModal1}
        title="Modal Title"
        size="lg"
      >
        <Stack gap="md">
          {/* Modal content */}

          <Group justify="flex-end" gap="md">
            <Button variant="subtle" onClick={cancelModal1}>
              Cancel
            </Button>
            <Button onClick={confirmModal1}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add more modals */}
    </>
  );
}
```

#### Step 6.3: Validate Components

```bash
# Check for errors
npx tsc --noEmit src/modules/[business]/[workspace]/[page]/components/*.tsx
```

**Must have:**

- ✅ `'use client'` directive
- ✅ Zero TypeScript errors
- ✅ UI matches original exactly
- ✅ All props properly typed

---

### Phase 7: Module Configuration (15 minutes)

#### Step 7.1: Create module.config.ts

**Location:** `module.config.ts`

**Template:**

```typescript
/**
 * [Page Name] Module Configuration
 *
 * ==============================================================================
 * Module: [Page Name] ([Business] → [Workspace])
 * ==============================================================================
 *
 * This module handles:
 * - [Feature 1]
 * - [Feature 2]
 * - [Feature 3]
 */

import { Icon[Name] } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const [page]Module: ModuleConfig = {
  id: '[business]-[page]',
  name: '[Page Name]',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: '[Page Name]',
      path: '/[business]/[workspace]/[page]',
      icon: Icon[Name] as unknown as React.FC<{ size?: number; stroke?: number }>,
      order: 10, // Adjust order as needed
      business: ['[business]'], // 'clothing' or 'trucking' or both
      workspace: ['[workspace]'], // 'operations' or 'employees' or both
    },
  ],

  routes: [
    {
      path: '/[business]/[workspace]/[page]',
      component: async () => {
        const { [Page]Page } = await import('./components/[Page]Page');
        return { default: [Page]Page };
      },
      protected: true,
    },
  ],

  permissions: ['admin', 'manager', '[workspace]'],

  metadata: {
    description: '[Brief description of module]',
    tags: ['[page]', '[feature]', '[business]'],
  },
};
```

**Real Example (Transactions):**

```typescript
export const transactionsModule: ModuleConfig = {
  id: 'clothing-transactions',
  name: 'Transactions',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Transactions',
      path: '/clothing/operations/transactions',
      icon: IconReceipt as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 1,
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

  routes: [
    {
      path: '/clothing/operations/transactions',
      component: async () => {
        const { TransactionsPage } = await import(
          './components/TransactionsPage'
        );
        return { default: TransactionsPage };
      },
      protected: true,
    },
  ],

  permissions: ['admin', 'manager', 'operations', 'finance'],

  metadata: {
    description: 'Manage transactions with invoice generation and tracking',
    tags: ['transactions', 'invoices', 'orders', 'critical', 'operations'],
  },
};
```

#### Step 7.2: Choose Appropriate Icon

**Common Icons:**

- `IconReceipt` - Transactions, invoices
- `IconCalendar` - Due dates, schedules
- `IconShirt` - Products (clothing)
- `IconTruck` - Shipments, deliveries
- `IconUsers` - Customers, team, employees
- `IconCurrencyDollar` - Prices, payroll
- `IconBoxSeam` - Inventory, stock
- `IconClipboardList` - Sorting, distribution, attendance
- `IconPackage` - Pickup forms
- `IconChartBar` - Business intelligence, reports

#### Step 7.3: Set Order Number

**Order Guidelines:**

- 1-10: Critical operations (Transactions, Orders)
- 11-20: Core features (Products, Customers, Due Dates)
- 21-30: Supporting features (Inventory, Prices)
- 31-40: Administrative (Settings, Team)
- 41-50: Utilities (Notifications)

---

### Phase 8: Public API (10 minutes)

#### Step 8.1: Create index.ts

**Location:** `index.ts`

**Template:**

```typescript
/**
 * [Page Name] Module Public API
 *
 * Central export point for [Page Name] module
 */

// =============================================================================
// MODULE CONFIGURATION
// =============================================================================

export { [page]Module } from './module.config';

// =============================================================================
// TYPES
// =============================================================================

export type {
  [Entity]Data,
  [Entity]Statistics,
  [Entity]FilterState,
  // Export all public types
} from './types/[page].types';

export {
  [ENTITY]_STATUS_OPTIONS,
  // Export all constants
} from './types/[page].types';

// =============================================================================
// SERVICES
// =============================================================================

export { [Page]Service, [page]Service } from './services/[Page]Service';

// =============================================================================
// HOOKS
// =============================================================================

export { use[Page]Data } from './hooks/use[Page]Data';
export { use[Page]Operations } from './hooks/use[Page]Operations';
export { use[Page]Modals } from './hooks/use[Page]Modals'; // if applicable

// =============================================================================
// COMPONENTS
// =============================================================================

export { [Page]Page } from './components/[Page]Page';
export { [Page]Modals } from './components/[Page]Modals'; // if applicable
```

**Purpose:**

- ✅ Single import point for module
- ✅ Clear exports
- ✅ Easy to see what's public vs private

#### Step 8.2: Validate Public API

```bash
# Check for errors
npx tsc --noEmit src/modules/[business]/[workspace]/[page]/index.ts
```

---

### Phase 9: Registration (5 minutes)

#### Step 9.1: Register Module

**Location:** `/src/modules/index.ts`

**Add import:**

```typescript
import { [page]Module } from './[business]/[workspace]/[page]';
```

**Add registration:**

```typescript
moduleRegistry.register([page]Module);
```

**Example:**

```typescript
// BEFORE
import { transactionsModule } from './clothing/operations/transactions';
import { dueDatesModule } from './clothing/operations/due-dates';

moduleRegistry.register(transactionsModule);
moduleRegistry.register(dueDatesModule);

// AFTER (adding products)
import { transactionsModule } from './clothing/operations/transactions';
import { dueDatesModule } from './clothing/operations/due-dates';
import { productsModule } from './clothing/operations/products';

moduleRegistry.register(transactionsModule);
moduleRegistry.register(dueDatesModule);
moduleRegistry.register(productsModule);
```

#### Step 9.2: Validate Registration

```bash
# Check for errors
npx tsc --noEmit src/modules/index.ts
```

---

### Phase 10: Route Update (10 minutes)

#### Step 10.1: Update Route Handler

**Location:** `/src/app/[business]/[workspace]/[page]/page.tsx`

**Replace entire file with:**

```typescript
/**
 * [Page Name] Route Handler
 *
 * This file now simply delegates to the modular [Page]Page component.
 * All business logic has been extracted to the module structure.
 */

import { [Page]Page } from '@/modules/[business]/[workspace]/[page]';

export default function [Page]RouteHandler() {
  return <[Page]Page />;
}
```

**Example (Transactions):**

```typescript
import { TransactionsPage } from '@/modules/clothing/operations/transactions';

export default function TransactionsRouteHandler() {
  return <TransactionsPage />;
}
```

**Result:**

- Original: 500-4,000 lines
- New: 10-15 lines
- Reduction: 99%+ 🎉

#### Step 10.2: Keep Backup

**DON'T delete the backup yet!**

```bash
# Backup is at: page.tsx.backup
# Keep it until testing is complete
```

---

### Phase 11: Validation & Testing (30-60 minutes)

#### Step 11.1: TypeScript Validation

```bash
# Check entire module for errors
npx tsc --noEmit

# Should see zero errors in your module files
```

**Fix any errors immediately - no workarounds!**

#### Step 11.2: Build Test

```bash
# Build the application
npm run build
# or
yarn build
```

**Must complete without errors**

#### Step 11.3: Runtime Testing

```bash
# Start dev server
npm run dev

# Navigate to page
open http://localhost:3000/[business]/[workspace]/[page]
```

**Test Checklist:**

- [ ] Page loads without errors
- [ ] Data displays correctly
- [ ] Cell editing works
- [ ] Dropdowns work
- [ ] Calculations are correct (verify formulas!)
- [ ] Search/filter works
- [ ] Statistics display correctly
- [ ] Modals work (if applicable)
- [ ] CSV import works (if applicable)
- [ ] No console errors
- [ ] No data flickering
- [ ] Performance acceptable

#### Step 11.4: Business Logic Verification

**CRITICAL: Verify formulas produce same results**

**Test Method:**

1. Open original backup file
2. Find a calculation (e.g., Line Total)
3. Note the formula
4. Test same inputs in new module
5. Verify output matches exactly

**Example:**

```typescript
// Original formula: (Quantity × Unit Price) - Adjustment
// Test: Quantity=5, Unit Price=10, Adjustment=2
// Expected: (5 × 10) - 2 = 48
// Verify new module produces: 48 ✅
```

#### Step 11.5: Console Check

**Open browser console (F12)**

Look for:

- ❌ Red errors (must fix)
- ⚠️ Yellow warnings (should fix)
- ✅ No errors/warnings (perfect!)

---

### Phase 12: Documentation (15 minutes)

#### Step 12.1: Create Module README

**Location:** `/src/modules/[business]/[workspace]/[page]/README.md`

**Template:**

````markdown
# [Page Name] Module

## Overview

[Brief description of module]

## Structure

\`\`\`
/[page]/
├── types/[page].types.ts - Type definitions
├── services/[Page]Service.ts - Business logic
├── hooks/
│ ├── use[Page]Data.ts - Data management
│ ├── use[Page]Operations.ts - Operations
│ └── use[Page]Modals.ts - Modal workflows
├── components/
│ ├── [Page]Page.tsx - Main component
│ └── [Page]Modals.tsx - Modal components
├── module.config.ts - Configuration
└── index.ts - Public API
\`\`\`

## Features

- [Feature 1]
- [Feature 2]
- [Feature 3]

## Business Logic

### Formulas

1. **[Formula Name]**: `[formula]`
2. **[Formula Name]**: `[formula]`

### Validation Rules

1. [Rule 1]
2. [Rule 2]

## Usage

\`\`\`typescript
import { [Page]Page } from '@/modules/[business]/[workspace]/[page]';

// Use in route
export default function Route() {
return <[Page]Page />;
}
\`\`\`

## Statistics

The module calculates:

- [Statistic 1]
- [Statistic 2]

## Modals

1. **[Modal Name]**: [Description]
2. **[Modal Name]**: [Description]

## Permissions

Required permissions: `[permission1]`, `[permission2]`

## Dependencies

- FormatterService (formatting)
- ValidationService (validation)
- use[Page]Data hook (data fetching)

## Performance

- Initial load: ~[X]s
- Cell edit: ~[Y]ms
- Statistics calculation: ~[Z]ms

## Known Issues

- [Issue 1] (low priority)

## Migration Notes

- Migrated from: `src/app/[business]/[workspace]/[page]/page.tsx`
- Original size: [X] lines
- New size: [Y] lines
- Reduction: [Z]%
- Date: [Date]
- Business logic: 100% preserved ✅
  \`\`\`

#### Step 12.2: Update Module List

**Location:** `/MODULES.md` (create if doesn't exist)

Add entry:

```markdown
## [Business] - [Workspace]

### [Page Name] ✅

- **Status**: Migrated
- **Location**: `/src/modules/[business]/[workspace]/[page]`
- **Original Size**: [X] lines
- **New Size**: [Y] lines
- **Reduction**: [Z]%
- **Date**: [Date]
- **Issues**: None
```
````

---

## ✅ Validation Checklist

### Pre-Migration

- [ ] Original file backed up (`.backup`)
- [ ] Features documented
- [ ] Business logic identified
- [ ] Formulas noted
- [ ] Git repository clean

### During Migration

- [ ] Directory structure created
- [ ] Types file complete (zero errors)
- [ ] Service file complete (zero errors)
- [ ] Hooks files complete (zero errors, `'use client'`)
- [ ] Component files complete (zero errors, `'use client'`)
- [ ] Module config created
- [ ] Public API created
- [ ] Module registered
- [ ] Route updated

### Post-Migration

- [ ] TypeScript compilation: zero errors
- [ ] Build process: successful
- [ ] Page loads: no errors
- [ ] Data displays: correctly
- [ ] Cell editing: works
- [ ] Calculations: match original exactly
- [ ] Search/filter: works
- [ ] Statistics: correct
- [ ] Modals: work (if applicable)
- [ ] Console: no errors
- [ ] Performance: acceptable
- [ ] UI: pixel-perfect match
- [ ] Documentation: complete

### Quality Gates

- [ ] Zero TypeScript errors ✅
- [ ] Zero ESLint errors ✅
- [ ] No `any` types used ✅
- [ ] 100% business logic preserved ✅
- [ ] Formulas produce same results ✅
- [ ] Shared services integrated ✅
- [ ] `'use client'` on all hooks/components ✅
- [ ] No infinite loops ✅
- [ ] No data flickering ✅
- [ ] No breaking changes ✅

---

## 🐛 Common Issues & Solutions

### Issue 1: 'use client' Missing

**Error:**

```
You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with "use client"
```

**Solution:**
Add `'use client'` at the top of the file:

```typescript
'use client';

import { useState } from 'react';
// ... rest of file
```

**Affected files:**

- All hooks files
- All component files

---

### Issue 2: Icon Import Errors

**Error:**

```
Module not found: Can't resolve '@tabler/icons-react'
```

**Solution:**
Add to `next.config.js`:

```javascript
experimental: {
  optimizePackageImports: ['@tabler/icons-react'],
}
```

---

### Issue 3: Infinite Re-render Loop

**Error:**

```
Maximum update depth exceeded
```

**Solution:**
Check useEffect dependencies:

```typescript
// ❌ WRONG - causes infinite loop
useEffect(() => {
  // Do something with data
}, [data, data.length]); // data.length changes every render

// ✅ CORRECT
useEffect(() => {
  // Do something with data
}, [data]); // Only re-run when data reference changes
```

---

### Issue 4: Field Clearing Bug

**Problem:** Fields clear when editing other fields

**Root Cause:** Spreading entire object in update

**Solution:**

```typescript
// ❌ WRONG
const updated = {
  ...currentTransaction,
  quantity: newQuantity,
};
await updateTransaction(id, updated); // Overwrites recent edits

// ✅ CORRECT
const updatedFields = {
  quantity: newQuantity,
  lineTotal: calculated,
};
await updateTransaction(id, updatedFields); // Only updates these fields
```

---

### Issue 5: TypeScript Errors in Service

**Error:**

```
Property 'formatterService' does not exist on type 'ProductService'
```

**Solution:**
Ensure proper constructor:

```typescript
export class ProductService {
  constructor(
    private formatterService: FormatterService,
    private validationService: ValidationService
  ) {}

  // ... methods
}

// Singleton with injected dependencies
export const productService = new ProductService(
  FormatterService.getInstance(),
  ValidationService.getInstance()
);
```

---

### Issue 6: Grid Cell Type Errors

**Error:**

```
Type 'string | undefined' is not assignable to type 'string'
```

**Solution:**
Always provide defaults:

```typescript
// ❌ WRONG
data: entity.field,

// ✅ CORRECT
data: entity.field || '',
displayData: entity.field || '',
```

---

### Issue 7: Batch Mode Product Code Clearing

**Problem:** Product Code clears during batch paste

**Solution:**
Use `getCurrentTransaction()` helper:

```typescript
const getCurrentTransaction = useCallback(
  (transactionId: string) => {
    const transaction = transactions.find((t) => t.id === transactionId);
    if (!transaction) return null;

    const batchUpdate = batchUpdatesRef.current.get(transactionId);
    if (batchUpdate) {
      return { ...transaction, ...batchUpdate };
    }
    return transaction;
  },
  [transactions]
);

// Use in handlers
const currentTransaction = getCurrentTransaction(transaction.id);
```

---

### Issue 8: Module Not Appearing in Sidebar

**Problem:** Module registered but not in menu

**Checklist:**

- [ ] Module registered in `/src/modules/index.ts`
- [ ] `enabled: true` in module.config.ts
- [ ] `navigation` array defined with correct business/workspace
- [ ] Icon imported correctly
- [ ] Sidebar.tsx uses ModuleRegistry.getNavigation()

---

### Issue 9: Formulas Produce Different Results

**Problem:** Calculations don't match original

**Solution:**

1. Find original formula in backup file
2. Copy EXACTLY (including parentheses, order of operations)
3. Test with same inputs
4. Verify output matches

**Example:**

```typescript
// Original: (Quantity × Unit Price) - Adjustment
// Not: Quantity × (Unit Price - Adjustment)  ← Wrong!

// ✅ CORRECT
return quantity * unitPrice - adjustment;
```

---

## 📋 Best Practices

### 1. Start Small

**Do:**

- ✅ Start with simpler modules (Due Dates, 428 lines)
- ✅ Build confidence with template
- ✅ Then tackle complex modules (Transactions, 3,857 lines)

**Don't:**

- ❌ Start with most complex module
- ❌ Try to refactor multiple modules simultaneously

---

### 2. Preserve Business Logic EXACTLY

**Do:**

- ✅ Copy formulas exactly as they are
- ✅ Include all parentheses
- ✅ Preserve order of operations
- ✅ Test calculations match original

**Don't:**

- ❌ "Improve" or "optimize" formulas
- ❌ Change calculation logic
- ❌ Remove seemingly redundant checks

**Why:** Business logic is often the result of real-world requirements and edge cases

---

### 3. Validate After Each Phase

**Do:**

- ✅ Run `npx tsc --noEmit` after each file
- ✅ Fix errors immediately
- ✅ Test build process frequently
- ✅ Commit working states

**Don't:**

- ❌ Wait until end to check for errors
- ❌ Accumulate TypeScript errors
- ❌ Use `any` or `@ts-ignore`

---

### 4. Use Shared Services

**Do:**

- ✅ Use FormatterService for formatting
- ✅ Use ValidationService for validation
- ✅ Inject services into your service class
- ✅ Reuse existing functions

**Don't:**

- ❌ Duplicate formatting logic
- ❌ Duplicate validation logic
- ❌ Create parallel implementations

---

### 5. Document As You Go

**Do:**

- ✅ Add JSDoc comments to functions
- ✅ Note why formulas exist
- ✅ Document business rules
- ✅ Explain non-obvious logic

**Don't:**

- ❌ Wait until end to document
- ❌ Assume code is self-documenting
- ❌ Skip edge case documentation

---

### 6. Test Thoroughly

**Do:**

- ✅ Test all CRUD operations
- ✅ Test all calculations
- ✅ Test edge cases
- ✅ Test performance
- ✅ Compare with original

**Don't:**

- ❌ Assume it works
- ❌ Skip testing calculations
- ❌ Ignore edge cases

---

### 7. Handle 'use client' Correctly

**Do:**

- ✅ Add to ALL hooks files
- ✅ Add to ALL component files
- ✅ Add at very top of file
- ✅ Check build output

**Don't:**

- ❌ Add to service files
- ❌ Add to type files
- ❌ Add to config files
- ❌ Forget to add

---

### 8. Manage State Carefully

**Do:**

- ✅ Use proper dependency arrays
- ✅ Avoid unnecessary re-renders
- ✅ Use useMemo for expensive calculations
- ✅ Use useCallback for functions

**Don't:**

- ❌ Put everything in dependencies
- ❌ Create infinite loops
- ❌ Cause unnecessary re-renders

---

### 9. Follow the Pattern

**Do:**

- ✅ Use exact same structure as Due Dates/Transactions
- ✅ Follow same naming conventions
- ✅ Use same file organization
- ✅ Maintain consistency

**Don't:**

- ❌ Create your own structure
- ❌ Use different patterns
- ❌ Mix approaches

---

### 10. Keep UI Identical

**Do:**

- ✅ Match layout exactly
- ✅ Use same styling
- ✅ Preserve all interactions
- ✅ Keep same user experience

**Don't:**

- ❌ "Improve" UI during refactoring
- ❌ Change layouts
- ❌ Add new features

**Why:** Refactoring ≠ redesign. Do one thing at a time.

---

## 🎯 Success Criteria

### Module is Complete When:

- ✅ Zero TypeScript errors (strict mode)
- ✅ Zero ESLint errors
- ✅ All business logic preserved (formulas exact)
- ✅ All features working (no regressions)
- ✅ UI pixel-perfect match
- ✅ Performance acceptable (< 3s load)
- ✅ No console errors
- ✅ Shared services integrated
- ✅ Module registered
- ✅ Navigation working
- ✅ Documentation complete
- ✅ Tests passing (if tests exist)

---

## 📊 Metrics to Track

### Per Module:

- **Original Lines**: [X]
- **New Lines**: [Y]
- **Reduction**: [Z]%
- **Files Created**: [N]
- **Time Taken**: [Hours]
- **Bugs Found**: [N]
- **Bugs Fixed**: [N]

### Overall:

- **Total Modules**: [N]
- **Modules Migrated**: [N]
- **Total Line Reduction**: [X]%
- **Average Time per Module**: [X] hours
- **Zero TypeScript Errors**: ✅
- **Zero Breaking Changes**: ✅

---

## 🚀 Next Steps After Completing Module

1. **Test Thoroughly** (Phase 5 testing plan)
2. **Document** (README, MODULES.md)
3. **Commit** to git with descriptive message
4. **Deploy** to development environment
5. **Monitor** for issues
6. **Move to next module**

---

## 📚 Reference Materials

### Essential Documents:

- **This Guide**: Complete refactoring template
- **PHASE_3A (Due Dates)**: Simple module example
- **PHASE_3B (Transactions)**: Complex module example
- **FormatterService**: `/src/services/FormatterService.ts`
- **ValidationService**: `/src/services/ValidationService.ts`
- **ModuleRegistry**: `/src/core/ModuleRegistry.ts`

### Example Modules:

- **Due Dates**: `/src/modules/clothing/operations/due-dates/`
- **Transactions**: `/src/modules/clothing/operations/transactions/`

---

## 🎉 Conclusion

This template pattern is **PROVEN** to work for modules of any complexity:

- ✅ Due Dates (428 lines) - SUCCESS
- ✅ Transactions (3,857 lines) - SUCCESS

**Follow this guide exactly, and you'll achieve:**

- Zero TypeScript errors
- 100% business logic preservation
- Improved performance
- Better maintainability
- Scalable architecture

**Remember:**

- Start small (simpler modules first)
- Validate after each phase
- Preserve formulas EXACTLY
- Test thoroughly
- Document everything

**You've got this!** 🚀

---

**Generated:** October 12, 2025  
**Version:** 1.0  
**Status:** Complete and Battle-Tested  
**Success Rate:** 100% (2/2 modules)
