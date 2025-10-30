# Standard Table Template Guide

## Overview

All new modules created from the reusable template will now have consistent styling and features matching the `clothing/operations/checkout-links` page.

## What's Included

### ✅ Automatic Features

Every new module based on the template gets:

1. **Auto-Expanding Search Bar**
   - Takes up all available space
   - Searches across all data fields
   - Shows dynamic results count

2. **Action Buttons (Blue with White Text)**
   - **Import** - CSV file upload with loading state
   - **Export** - CSV file download
   - **Add New** - Create new items

3. **Standard Table Styling**
   - Height: `71vh` (consistent across all tables)
   - Gray header background: `#f1f3f5`
   - Centered header text
   - Vertical scrolling
   - Hover effects

4. **Responsive Layout**
   - Search bar and buttons wrap on small screens
   - Mobile-friendly design

## Files Modified

### 1. StandardDataTable.tsx

**Location:** `/src/components/tables/StandardDataTable.tsx`

**New Export:** `StandardTableControls`

**Props:**

```typescript
{
  searchPlaceholder?: string;        // Default: "Search..."
  onSearch?: (query: string) => void;
  onImport?: (file: File | null) => void;
  onExport?: () => void;
  onAddNew?: () => void;
  isImporting?: boolean;             // Default: false
  hideImport?: boolean;              // Default: false
  hideExport?: boolean;              // Default: false
  hideAddNew?: boolean;              // Default: false
  hideSearch?: boolean;              // Default: false
}
```

### 2. Template File

**Location:** `/src/components/tables/TEMPLATE_StandardTable.tsx`

Complete working example showing:

- How to structure your component
- How to implement search
- How to handle import/export
- How to add edit/delete actions
- Step-by-step instructions

## How to Create a New Module

### Quick Start

1. **Copy the template:**

   ```bash
   cp src/components/tables/TEMPLATE_StandardTable.tsx \
      src/modules/your-path/YourModuleComponent.tsx
   ```

2. **Update the component:**
   - Replace `YourModule` with your module name
   - Update the data interface
   - Update table headers
   - Implement handler functions

3. **That's it!** You automatically get:
   - ✅ Search bar (auto-expanding)
   - ✅ Import/Export buttons (blue)
   - ✅ Add New button (blue)
   - ✅ Standard table height (71vh)
   - ✅ Gray headers (#f1f3f5)

### Example Usage

```tsx
import { StandardTableControls } from '@/components/tables/StandardDataTable';

<StandardTableControls
  searchPlaceholder="Search items..."
  onSearch={setSearchQuery}
  onImport={handleImportCSV}
  onExport={handleExportCSV}
  onAddNew={handleAddNew}
  isImporting={isImporting}
/>;
```

### Hiding Buttons (Optional)

If you don't need certain buttons:

```tsx
<StandardTableControls
  // ... other props
  hideImport={true} // No import button
  hideExport={true} // No export button
  hideAddNew={true} // No add new button
  hideSearch={true} // No search bar
/>
```

## Styling Consistency

All buttons now use the default Mantine blue styling:

- **Color:** Blue (`#2563eb`)
- **Text:** White
- **Variant:** Default (solid)

This ensures visual consistency across all modules.

## Updated Module

The `clothing/operations/checkout-links` module has been updated to use `StandardTableControls`, serving as a real-world example.

**File:** `/src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx`

## Features Summary

| Feature               | Included | Customizable          |
| --------------------- | -------- | --------------------- |
| Auto-expanding search | ✅       | ✅ (can hide)         |
| Import button (CSV)   | ✅       | ✅ (can hide)         |
| Export button (CSV)   | ✅       | ✅ (can hide)         |
| Add New button        | ✅       | ✅ (can hide)         |
| Loading state         | ✅       | ✅ (isImporting prop) |
| Blue button styling   | ✅       | ❌ (standardized)     |
| Table height (71vh)   | ✅       | ✅ (height prop)      |
| Gray headers          | ✅       | ❌ (standardized)     |
| Responsive layout     | ✅       | ❌ (standardized)     |

## Benefits

1. **Consistency** - All tables look and behave the same
2. **Speed** - Create new modules in minutes
3. **Maintainability** - Update template, all modules benefit
4. **Accessibility** - Built-in best practices
5. **Responsive** - Works on all screen sizes

## Next Steps

When creating new modules:

1. Use the template file as your starting point
2. Follow the step-by-step comments
3. Focus on your business logic, not UI boilerplate
4. All standard features work out of the box

---

**Last Updated:** October 31, 2025
**Template Version:** 1.0
