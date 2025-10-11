# 📦 Transactions Module Refactoring Plan

## 🎯 Objective

Refactor the mature, production-ready **Transactions page** (3857 lines) into a **modular architecture** while preserving ALL existing functionality, business logic, and performance optimizations.

### 🏗️ Architecture Evolution

```
CURRENT STATE:
✅ Abstraction Layer (Already Implemented!)
   └── useSheetData hooks (useTransactionData, useCustomerData, etc.)
   └── Service classes (BaseService, TransactionService, etc.)
   └── DTO types (TransactionDTO, CustomerDTO, etc.)
   └── API routes with proper separation

NEW STATE:
✅ Abstraction Layer (Keep as-is!)
   └── [Same solid foundation]
+
✅ Modular Architecture (Add on top!)
   └── Organized feature modules (/src/modules/transactions/, /src/modules/products/)
   └── Dynamic module loading (ModuleRegistry)
   └── Plugin system (enable/disable features)
   └── Clean public APIs per module
```

**Key Insight**: We're **NOT replacing** your abstraction layer. We're **organizing** the pages/features into **self-contained modules** that **USE** the existing abstraction layer. This gives you:

1. **Abstraction Layer** = Clean data access, API calls, business logic (foundation)
2. **Modular Architecture** = Complete feature isolation (UI + hooks + services + types + utils)
3. **Combined Power** = "Plug-and-play" complete features with clean data layer!

**IMPORTANT**: Each module is **NOT just UI components**. Each module contains:

- ✅ UI Components (pages, grids, modals)
- ✅ Business Logic (services, calculations, validations)
- ✅ State Management (hooks, context)
- ✅ Type Definitions (interfaces, DTOs)
- ✅ Utilities (formatters, validators)
- ✅ Configuration (module config, routes, permissions)

**A module = A complete, self-contained feature** that can be enabled/disabled as a unit!

## 📋 Current State Analysis

### Features Identified

1. **Core Grid Display** - Handsontable with 13 columns (Order Date, Customers, Product Code, Quantity, Unit Price, Discount, Adjustment, Line Total, Order Status, Notes, Invoice Date, Packed Date, Shipment Code)
2. **CRUD Operations** - Create, Read, Update, Delete transactions
3. **Batch Operations** - Multi-cell paste with batching and batch notifications
4. **Invoice Generation** - PDF generation + status updates (CRITICAL PROTECTED LOGIC)
5. **Distribution Slips** - Warehouse order distribution PDFs
6. **Packing Lists** - Prepared order packing lists (≤ ₱50 filter)
7. **Customer Validation** - Banned customer detection, cancellation rate warnings
8. **Auto-population** - Product → Shipment mapping, status sync
9. **Filtering** - Status filters with localStorage persistence
10. **Search** - Multi-field search across customers, products, status
11. **Undo/Redo** - Transaction history management
12. **Statistics** - Real-time metrics display

### Critical Protected Logic (DO NOT BREAK)

- ⚠️ **Invoice Generation** - `handleGenerateInvoice()` function
- ⚠️ **Database Persistence** - `saveTransactionToDatabase()` operations
- ⚠️ **Business Formulas** - Unit Price, Line Total calculations
- ⚠️ **Auto-population** - Product Code → Quantity, Discount, Shipment mapping
- ⚠️ **Customer Consolidation** - Warehouse + Prepared order grouping
- ⚠️ **Status Workflows** - Warehouse → Prepared automation

### Dependencies

**Abstraction Layer (Already Exists - Keep Using!):**

- ✅ `useTransactionData()` - Data fetching hook with React Query
- ✅ `useCustomerData()` - Customer data hook
- ✅ `useProductData()` - Product data hook
- ✅ `TransactionService` - Business logic service class
- ✅ `CustomerService` - Customer operations
- ✅ API routes: `/api/transactions`, `/api/customers`, `/api/prices`, `/api/products`, `/api/shipments`

**UI Libraries:**

- `handsontable` - Grid component with Excel-like functionality (specific to Transactions)
- `@handsontable/react` - React wrapper for Handsontable
- `@mantine/core` - UI components
- `@mantine/notifications` - Toast notifications
- `TransactionsLayout` - Custom grid wrapper component

**Note on Table Technology**: This module uses Handsontable, but other modules use different tables:

- **Transactions** → Handsontable (complex editing, batch operations)
- **Products, Shipments, Customers** → Glide Data Grid (performance, large datasets)
- **Due Dates, Sorting & Distribution** → Mantine Table (simple display, sorting)

Each module chooses the best table library for its use case. The modular architecture supports this via **abstraction layers** (hooks, services) that are table-agnostic.

---

## 🏗️ Module Structure

```
src/modules/transactions/
├── index.ts                      # Public API (module entry point)
├── module.config.ts              # Module registration config
├── components/
│   ├── TransactionsPage.tsx      # Main page component (smart)
│   ├── TransactionsGrid.tsx      # Handsontable grid wrapper (TABLE-SPECIFIC)
│   ├── TransactionsStats.tsx     # Statistics cards
│   ├── StatusFilters.tsx         # Status filter buttons
│   └── modals/
│       ├── InvoiceConfirmationModal.tsx
│       ├── DistributionConfirmationModal.tsx
│       ├── PackingListConfirmationModal.tsx
│       └── CustomerWarningModal.tsx
├── hooks/
│   ├── useTransactionsGrid.ts    # Handsontable configuration (TABLE-SPECIFIC)
│   ├── useTransactionsFilters.ts # Status/search filtering (TABLE-AGNOSTIC)
│   ├── useInvoiceGeneration.ts   # Invoice generation logic (TABLE-AGNOSTIC)
│   ├── useDistributionSlips.ts   # Distribution generation (TABLE-AGNOSTIC)
│   ├── usePackingLists.ts        # Packing list generation (TABLE-AGNOSTIC)
│   ├── useCustomerValidation.ts  # Customer validation (TABLE-AGNOSTIC)
│   ├── useProductMappings.ts     # Product → Shipment mappings (TABLE-AGNOSTIC)
│   ├── useStatusSync.ts          # Shipment status sync (TABLE-AGNOSTIC)
│   └── useBatchOperations.ts     # Batch paste handling (TABLE-SPECIFIC)
├── services/
│   ├── TransactionsService.ts    # Business logic layer (TABLE-AGNOSTIC)
│   ├── InvoiceService.ts         # Invoice generation service (TABLE-AGNOSTIC)
│   ├── ValidationService.ts      # Customer validation service (TABLE-AGNOSTIC)
│   └── CalculationService.ts     # Formula calculations (TABLE-AGNOSTIC)
├── types/
│   ├── transaction.types.ts      # Transaction interfaces (TABLE-AGNOSTIC)
│   ├── invoice.types.ts          # Invoice-related types (TABLE-AGNOSTIC)
│   └── grid.types.ts             # Handsontable-specific types (TABLE-SPECIFIC)
└── utils/
    ├── formatters.ts             # Currency, date formatters (TABLE-AGNOSTIC)
    ├── validators.ts             # Input validation (TABLE-AGNOSTIC)
    └── calculations.ts           # Business formulas (TABLE-AGNOSTIC)
```

**Key Principles**:

1. **Module = Complete Feature** - NOT just UI! Each module contains UI + logic + state + types + utils
2. **Use Existing Abstraction Layer** - Modules leverage shared foundation (hooks, base services)
3. **Self-Contained** - Module can be enabled/disabled as a complete unit (entire feature stack)
4. **Table-Agnostic Logic** - Business logic works with any table technology (Handsontable, Glide, Mantine)
5. **Clean Public APIs** - Modules export only what other modules need, hiding internal complexity
6. **Independent Testing** - Each module can be tested in complete isolation

**What Makes a Module Complete?**

```typescript
// ❌ WRONG: Module as just UI components
src/modules/transactions/
└── TransactionsPage.tsx  // Just the UI component

// ✅ RIGHT: Module as complete feature
src/modules/transactions/
├── components/           // UI (what user sees)
├── hooks/               // State (how UI behaves)
├── services/            // Logic (what happens behind scenes)
├── types/               // Contracts (data shapes)
├── utils/               // Helpers (reusable functions)
└── module.config.ts     // Metadata (how to load it)
```

**Result**: When you plug in a module, you get the **ENTIRE FEATURE**, not just a UI shell!

**Architecture Stack**:

```
┌───────────────────────────────────────────────────────────────┐
│  🔌 Module Layer (NEW!) - Self-Contained Features            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Each Module Contains:                                  │ │
│  │  📱 UI Layer       → Components, Pages, Modals          │ │
│  │  🧠 Logic Layer    → Services, Calculations, Business   │ │
│  │  🔗 State Layer    → Hooks, Context, Store              │ │
│  │  📝 Type Layer     → Interfaces, DTOs, Enums            │ │
│  │  🛠️ Utility Layer  → Formatters, Validators, Helpers   │ │
│  │  ⚙️ Config Layer   → Routes, Permissions, Settings      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  Features:                                                    │
│  ✅ Complete feature isolation (not just UI!)               │
│  ✅ Dynamic loading (enable/disable entire feature)         │
│  ✅ Clean public API (expose only what's needed)            │
│  ✅ Independent testing (test module in isolation)          │
├───────────────────────────────────────────────────────────────┤
│  🏗️ Abstraction Layer (EXISTING!) - Shared Foundation       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  • useSheetData hooks (data fetching)                   │ │
│  │  • Base service classes (CRUD operations)               │ │
│  │  • Shared DTO types (data transfer objects)             │ │
│  │  • Common utilities (shared across all modules)         │ │
│  └─────────────────────────────────────────────────────────┘ │
├───────────────────────────────────────────────────────────────┤
│  💾 Data Layer - Persistence                                 │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  • API routes (REST endpoints)                          │ │
│  │  • Database (Prisma/Supabase)                           │ │
│  │  • CSV imports/exports                                  │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

**Example: Transactions Module is a COMPLETE feature, not just UI:**

```typescript
src/modules/transactions/
├── components/          ← UI Layer (pages, grids, modals)
├── hooks/              ← State Layer (React hooks, custom logic)
├── services/           ← Business Logic Layer (calculations, workflows)
├── types/              ← Type Layer (interfaces, enums)
├── utils/              ← Utility Layer (formatters, validators)
└── module.config.ts    ← Config Layer (routes, permissions, metadata)
```

When you **disable** the Transactions module:

- ❌ UI disappears from navigation
- ❌ Routes are removed
- ❌ Services are not loaded
- ❌ Hooks are not registered
- ❌ Types are not exposed
- ✅ Everything related to that feature is gone!

When you **enable** it:

- ✅ Everything comes back as a complete unit!

---

## 🔄 Refactoring Steps

### Phase 1: Setup Module Infrastructure

1. ✅ Create `/src/modules/transactions/` directory
2. ✅ Create subdirectories (components, hooks, services, types, utils)
3. ✅ Create `index.ts` public API file
4. ✅ Create `module.config.ts` for registration

### Phase 2: Extract Types & Interfaces

1. ✅ Move `TransactionData` interface to `types/transaction.types.ts`
2. ✅ Extract grid-related types to `types/grid.types.ts`
3. ✅ Extract invoice types to `types/invoice.types.ts`
4. ✅ Create barrel exports in `types/index.ts`

### Phase 3: Extract Utility Functions

1. ✅ Move formatters to `utils/formatters.ts`
2. ✅ Move validators to `utils/validators.ts`
3. ✅ Move calculations to `utils/calculations.ts`
4. ✅ Create barrel exports in `utils/index.ts`

### Phase 4: Extract Services (Critical!)

1. ✅ Create `TransactionsService.ts` with CRUD operations
2. ✅ **CAREFULLY** extract `InvoiceService.ts` (protected logic!)
3. ✅ Create `ValidationService.ts` for customer checks
4. ✅ Create `CalculationService.ts` for business formulas
5. ✅ Ensure ALL database persistence logic is preserved
6. ✅ Add comprehensive JSDoc comments to protected functions

### Phase 5: Extract Hooks

1. ✅ Create `useTransactionsGrid.ts` (Handsontable config & settings)
2. ✅ Create `useTransactionsFilters.ts` (status/search)
3. ✅ **CAREFULLY** extract `useInvoiceGeneration.ts` (protected!)
4. ✅ Create `useDistributionSlips.ts`
5. ✅ Create `usePackingLips.ts`
6. ✅ Create `useCustomerValidation.ts`
7. ✅ Create `useProductMappings.ts`
8. ✅ Create `useStatusSync.ts`
9. ✅ Create `useBatchOperations.ts` (batch paste with notifications)

### Phase 6: Extract Components

1. ✅ Create `TransactionsStats.tsx` (statistics cards)
2. ✅ Create `StatusFilters.tsx` (filter buttons)
3. ✅ Extract modal components:
   - `InvoiceConfirmationModal.tsx`
   - `DistributionConfirmationModal.tsx`
   - `PackingListConfirmationModal.tsx`
   - `CustomerWarningModal.tsx`
4. ✅ Create `TransactionsGrid.tsx` (Handsontable wrapper with TransactionsLayout)
5. ✅ Create `TransactionsPage.tsx` (main orchestrator)

### Phase 7: Module Registration

1. ✅ Create `module.config.ts` with ModuleConfig
2. ✅ Register module in `ModuleRegistry`
3. ✅ Add navigation entry
4. ✅ Add route configuration

### Phase 8: Update App Router

1. ✅ Update Sidebar to use `moduleRegistry.getNavigation()`
2. ✅ Keep existing route at `/clothing/operations/transactions` (backward compatibility)
3. ✅ Add alias route: `/[business]/[workspace]/transactions` (future-proof)

### Phase 9: Testing & Validation

1. ✅ Test all CRUD operations
2. ✅ **CRITICAL**: Test invoice generation end-to-end
3. ✅ Test distribution slip generation
4. ✅ Test packing list generation
5. ✅ Test customer validation (banned customers, cancellation rate)
6. ✅ Test status sync with shipments
7. ✅ Test batch paste operations
8. ✅ Test filtering (status + search)
9. ✅ Test undo/redo functionality
10. ✅ Verify database persistence for all operations
11. ✅ Performance testing (ensure no regressions)

### Phase 10: Documentation

1. ✅ Create `TRANSACTIONS_MODULE.md` (module documentation)
2. ✅ Update `MODULAR_ARCHITECTURE_GUIDE.md` with real example
3. ✅ Create migration guide for other pages
4. ✅ Document public API in `index.ts`

---

## 🎯 Module Public API (index.ts)

```typescript
// Public API - Only expose what other modules need
export { TransactionsPage as default } from './components/TransactionsPage';
export { TransactionsStats } from './components/TransactionsStats';
export { StatusFilters } from './components/StatusFilters';

// Hooks (if other modules need them)
export { useTransactionsGrid } from './hooks/useTransactionsGrid';
export { useTransactionsFilters } from './hooks/useTransactionsFilters';

// Types (shared with other modules)
export type { TransactionData, TransactionDTO } from './types';

// Services (if other modules need business logic)
export { TransactionsService } from './services/TransactionsService';

// DO NOT export:
// - Internal components (modals, cells)
// - Internal hooks (invoice generation, validation)
// - Utility functions (formatters, validators)
// - Protected business logic
```

---

## 🚨 Critical Warnings

### Protected Business Logic

The following functions contain **FINALIZED, BUSINESS-APPROVED** logic:

1. **`handleGenerateInvoice()`**
   - Customer order consolidation (Warehouse + Prepared)
   - Automated status workflow (Warehouse → Prepared)
   - Invoice date setting and database persistence
   - **DO NOT MODIFY** without explicit approval

2. **`saveTransactionToDatabase()`**
   - Database persistence operations
   - Critical for data integrity
   - **MUST PRESERVE** all save operations

3. **Business Formulas**
   - `Unit Price = Tier Price - Discount`
   - `Line Total = (Quantity × Unit Price) - Adjustment`
   - **DO NOT CHANGE** calculation sequences

4. **Auto-population Logic**
   - Product Code → Quantity, Discount, Shipment Code
   - Shipment Status → Order Status mapping
   - **DO NOT ALTER** trigger conditions

### Testing Requirements

- ✅ **Invoice generation MUST be tested end-to-end** before deployment
- ✅ **Database saves MUST be verified** for all operations
- ✅ **Status workflows MUST work** exactly as before
- ✅ **Customer validation MUST trigger** warnings correctly
- ✅ **Performance MUST NOT regress** (currently optimized with React.memo, useMemo)

### Documentation Requirements

- ✅ **Preserve all code comments** explaining business logic
- ✅ **Add JSDoc** to all public functions
- ✅ **Document breaking changes** (if any)
- ✅ **Create migration guide** for updating other pages

---

## 📊 Success Criteria

- ✅ All existing functionality works exactly as before
- ✅ Protected business logic is preserved byte-for-byte
- ✅ Database persistence works for all operations
- ✅ Performance is equal or better (no regressions)
- ✅ Code is more maintainable and testable
- ✅ Module can be disabled/enabled via registry
- ✅ Module can be loaded dynamically
- ✅ Public API is clean and documented
- ✅ Tests pass for all features
- ✅ Documentation is complete

---

## 🔄 Next Steps

1. **Review this plan** with business owner (if needed)
2. **Start Phase 1** - Create directory structure
3. **Proceed carefully** through Phases 2-6 (extract code)
4. **Test thoroughly** in Phase 9 (critical!)
5. **Document** in Phase 10
6. **Use as template** for refactoring other pages (Due Dates, Products, etc.)

---

## 📚 References

### Current Implementation

- Original file: `/src/app/clothing/operations/transactions/page.tsx` (3857 lines)
- Protected logic docs: `INVOICE_GENERATION_LOGIC_PROTECTION.md`
- Business logic docs: `TRANSACTIONS_LOGIC_SUMMARY.md`

### Existing Abstraction Layer (Keep Using!)

- Hooks: `/src/hooks/useSheetData.ts` - Data fetching hooks
- Services: `/src/services/` - Business logic services
- Types: `/src/types/` - DTO interfaces
- See: `ABSTRACTION_LAYER_SUMMARY.md`, `EMPLOYEE_TRUCKING_ABSTRACTION_LAYERS.md`

### New Modular Architecture (Adding Now!)

- Architecture guide: `MODULAR_ARCHITECTURE_GUIDE.md`
- Multi-table guide: `MULTI_TABLE_ARCHITECTURE_GUIDE.md`
- Core infrastructure: `/src/core/ModuleRegistry.ts`, `/src/core/EventBus.ts`

---

**Status**: 📋 Plan Created - Ready for Implementation
**Architecture**: 🏗️ **Abstraction Layer (✅ Existing) + Modular Architecture (🔄 Adding)**
**Priority**: 🔥 High - This is the template for all other modules
**Risk Level**: ⚠️ Medium-High - Contains critical business logic
**Estimated Time**: 6-8 hours (leveraging existing abstraction layer speeds this up!)

---

## 💡 Why This is Faster Than Starting From Scratch

You already have:

- ✅ Data fetching layer (`useSheetData` hooks)
- ✅ Business logic layer (Service classes)
- ✅ Type definitions (DTOs)
- ✅ API routes with proper separation

So we're just:

- 🔄 **Organizing** complete features into self-contained modules (UI + logic + state + types + utils)
- 🔄 **Adding** dynamic loading capability (enable/disable entire features)
- 🔄 **Creating** plugin system (modules register themselves)
- 🔄 **NOT rewriting** the data layer (keep using abstraction layer!)

This is **reorganization + enhancement**, not **rewrite**. Much faster and safer! 🚀

**The Power of Complete Modules:**

```typescript
// Before: Everything mixed together in one 3857-line file
src/app/clothing/operations/transactions/page.tsx
  ├── UI code (components, JSX)
  ├── Business logic (invoice generation, calculations)
  ├── State management (hooks, useState)
  ├── Type definitions (interfaces)
  ├── Utilities (formatters, validators)
  └── ALL TANGLED TOGETHER!

// After: Organized into logical layers within module
src/modules/transactions/
  ├── components/      ← UI separated
  ├── services/        ← Business logic separated
  ├── hooks/          ← State separated
  ├── types/          ← Types separated
  ├── utils/          ← Utilities separated
  └── module.config.ts ← Module metadata

  ✅ Each layer can be tested independently
  ✅ Each layer can be modified without breaking others
  ✅ Entire module can be disabled/enabled as a unit
  ✅ Module can be reused in different contexts
```

**Example: Disabling Transactions Module**

```typescript
// In module.config.ts
export const transactionsModule: ModuleConfig = {
  id: 'transactions',
  enabled: false, // ← ONE FLAG disables EVERYTHING
  // This removes:
  // - All UI components
  // - All business logic services
  // - All custom hooks
  // - All routes
  // - Navigation entries
  // - Everything!
};
```

**Example: Enabling Transactions Module**

```typescript
export const transactionsModule: ModuleConfig = {
  id: 'transactions',
  enabled: true, // ← ONE FLAG enables EVERYTHING
  // This restores:
  // - Complete UI
  // - All business logic
  // - All functionality
  // - Full feature set
};
```

This is the power of **complete modular architecture**! 💪
