# Page Template System - Complete Guide

## 🎯 Overview

The **Page Template System** provides reusable UI components that ensure **100% visual consistency** across all pages in the application. No more manual reconfiguration - just import and use!

## 📦 Components

### 1. **StatsCardGroup** - Glassmorphism Stats Cards

Displays 4 stats cards in a responsive grid with hover effects.

### 2. **PageControls** - Control Panel with Tabs, Search & Filters

Provides search, filters, tabs, and action buttons in a consistent card layout.

### 3. **DataTable** - Styled Data Table

Displays data in a table with actions, matching the exact Expenses page styling.

---

## 🚀 Quick Start

### Creating a New Page (5 minutes)

```tsx
'use client';

import React from 'react';
import { Stack, Text, Badge } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  IconReceipt,
  IconClock,
  IconCheck,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import {
  StatsCardGroup,
  PageControls,
  DataTable,
} from '@/components/shared/PageTemplates';
import type {
  StatCard,
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates';

export default function MyPage() {
  // 1. Define your stats
  const stats: StatCard[] = [
    {
      title: 'Total Items',
      value: '100',
      icon: <IconReceipt size={32} stroke={1.5} />,
    },
    {
      title: 'Pending',
      value: '10',
      icon: <IconClock size={32} stroke={1.5} />,
    },
    {
      title: 'Approved',
      value: '90',
      icon: <IconCheck size={32} stroke={1.5} />,
    },
    {
      title: 'This Month',
      value: '$5,000',
      icon: <IconReceipt size={32} stroke={1.5} />,
    },
  ];

  // 2. Define your table columns
  const columns: TableColumn<MyDataType>[] = [
    {
      key: 'name',
      label: 'NAME',
      render: (item) => <Text fw={500}>{item.name}</Text>,
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      render: (item) => <Text fw={600}>${item.amount}</Text>,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (item) => (
        <Badge color={item.status === 'active' ? 'green' : 'gray'}>
          {item.status}
        </Badge>
      ),
    },
  ];

  // 3. Define your table actions
  const actions: TableAction<MyDataType>[] = [
    {
      icon: <IconEdit size={16} />,
      label: 'Edit',
      color: 'blue',
      onClick: (item) => handleEdit(item),
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (item) => handleDelete(item),
    },
  ];

  // 4. Render with templates
  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <StatsCardGroup stats={stats} />

        <PageControls
          title="My Records"
          searchPlaceholder="Search..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              placeholder: 'Filter by status',
              data: ['All', 'Active', 'Inactive'],
              value: statusFilter,
              onChange: setStatusFilter,
            },
          ]}
          onImportCSV={handleImport}
          onExportCSV={handleExport}
          onAdd={handleAdd}
          addButtonLabel="Add Item"
        />

        <DataTable
          data={items}
          columns={columns}
          actions={actions}
          emptyMessage="No items found"
        />
      </Stack>
    </PageLayout>
  );
}
```

**That's it!** Your page now looks **exactly** like the Expenses page with zero manual styling.

---

## 📋 Component API Reference

### StatsCardGroup

#### Props

```typescript
interface StatCard {
  title: string; // e.g., "Total Expenses"
  value: string; // e.g., "$5,000" or "100"
  icon: React.ReactNode; // e.g., <IconReceipt size={32} />
  color?: string; // Optional (not used in current styling)
}

interface StatsCardGroupProps {
  stats: StatCard[]; // Array of 4 stats (recommended)
}
```

#### Example

```tsx
const stats: StatCard[] = [
  {
    title: 'Total Expenses',
    value: formatCurrency(totalExpenses),
    icon: <IconReceipt size={32} stroke={1.5} />,
  },
  {
    title: 'Pending Approval',
    value: pendingExpenses.toString(),
    icon: <IconX size={32} stroke={1.5} />,
  },
];

<StatsCardGroup stats={stats} />;
```

#### Features

- ✅ Glassmorphism styling
- ✅ Hover animations (translateY + shadow)
- ✅ Responsive grid (4 cols on desktop, 2 on tablet, 1 on mobile)
- ✅ Consistent spacing and sizing

---

### PageControls

#### Props

```typescript
interface TabConfig {
  value: string;
  label: string;
  icon?: ReactNode;
}

interface FilterConfig {
  placeholder: string;
  data: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  width?: number;
}

interface PageControlsProps {
  title: string;

  // Tabs (optional)
  tabs?: TabConfig[];
  activeTab?: string | null;
  onTabChange?: (tab: string | null) => void;

  // Search (optional)
  searchPlaceholder?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;

  // Filters (optional)
  filters?: FilterConfig[];

  // Actions (optional)
  onImportCSV?: (file: File | null) => void;
  onExportCSV?: () => void;
  onAdd?: () => void;
  addButtonLabel?: string;
  isImporting?: boolean;

  // Custom content
  children?: ReactNode;
}
```

#### Example (Without Tabs)

```tsx
<PageControls
  title="Cash Advance Records"
  searchPlaceholder="Search by employee..."
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  filters={[
    {
      placeholder: 'Filter by status',
      data: ['All', 'pending', 'approved'],
      value: statusFilter,
      onChange: setStatusFilter,
    },
  ]}
  onImportCSV={handleImport}
  onExportCSV={handleExport}
  onAdd={handleAdd}
  addButtonLabel="Add Request"
/>
```

#### Example (With Tabs)

```tsx
<PageControls
  title="Expense Records"
  tabs={[
    { value: 'list', label: 'Expense List', icon: <IconList size={16} /> },
    { value: 'analytics', label: 'Analytics', icon: <IconChartPie size={16} /> },
  ]}
  activeTab={activeTab}
  onTabChange={setActiveTab}
  searchPlaceholder="Search expenses..."
  searchQuery={searchQuery}
  onSearchChange={setSearchQuery}
  filters={[...]}
  onAdd={handleAdd}
/>
```

#### Features

- ✅ Glassmorphism card styling
- ✅ Optional tabs with icons
- ✅ Flexible search and filters
- ✅ Import/Export CSV buttons
- ✅ Customizable "Add" button
- ✅ Loading state for import

---

### DataTable

#### Props

```typescript
interface TableColumn<T> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => ReactNode;
}

interface TableAction<T> {
  icon: ReactNode;
  label: string;
  color?: string;
  onClick: (item: T) => void;
  show?: (item: T) => boolean; // Conditional rendering
}

interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  emptyMessage?: string;
  showFooter?: boolean;
  footerContent?: ReactNode;
  height?: string;
}
```

#### Example

```tsx
interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
}

const columns: TableColumn<Expense>[] = [
  {
    key: 'date',
    label: 'DATE',
    render: (item) => formatDate(item.date),
  },
  {
    key: 'amount',
    label: 'AMOUNT',
    render: (item) => <Text fw={600}>{formatCurrency(item.amount)}</Text>,
  },
  {
    key: 'description',
    label: 'DESCRIPTION',
    render: (item) => item.description,
  },
  {
    key: 'status',
    label: 'STATUS',
    render: (item) => (
      <Badge color={item.status === 'approved' ? 'green' : 'yellow'}>
        {item.status}
      </Badge>
    ),
  },
];

const actions: TableAction<Expense>[] = [
  {
    icon: <IconCheck size={16} />,
    label: 'Approve',
    color: 'green',
    onClick: (item) => handleApprove(item.id),
    show: (item) => item.status === 'pending', // Only show for pending
  },
  {
    icon: <IconEdit size={16} />,
    label: 'Edit',
    color: 'blue',
    onClick: (item) => handleEdit(item),
  },
  {
    icon: <IconTrash size={16} />,
    label: 'Delete',
    color: 'red',
    onClick: (item) => handleDelete(item.id),
  },
];

<DataTable
  data={expenses}
  columns={columns}
  actions={actions}
  emptyMessage="No expenses found"
  showFooter
  footerContent={
    <>
      <Table.Th>Total ({expenses.length} items)</Table.Th>
      <Table.Th>
        <Text fw={700}>{formatCurrency(totalAmount)}</Text>
      </Table.Th>
      <Table.Th colSpan={3}></Table.Th>
    </>
  }
/>;
```

#### Features

- ✅ Exact Expenses page table styling
- ✅ Sticky header with light gray background
- ✅ Hover effects on rows
- ✅ Conditional action rendering
- ✅ Custom cell rendering
- ✅ Footer with totals
- ✅ Empty state message
- ✅ Scrollable (71vh default height)
- ✅ Action buttons with tooltips

---

## 🎨 Visual Consistency

All template components use the **exact same styling** as the Expenses page:

### Colors & Effects

```css
/* Stats Cards */
background: rgba(255, 255, 255, 0.25)
backdrop-filter: blur(10px)
border: 1px solid rgba(255, 255, 255, 0.18)
box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37)

/* Page Controls Card */
background: rgba(255, 255, 255, 0.15)
backdrop-filter: blur(15px)
border: 1px solid rgba(255, 255, 255, 0.15)
box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.2)

/* Table Header */
background-color: #f1f3f5
color: #495057
```

### Typography

- **Card Titles**: `order={3}`, white with text shadow
- **Stat Labels**: Uppercase, 0.5px letter spacing
- **Stat Values**: `size="xl"`, bold
- **Table Headers**: Uppercase, centered, gray

---

## 🔄 Migration Guide

### Converting Existing Pages

**Before (Custom Components):**

```tsx
<StatsCards stats={stats} />
<RequestControls {...props} />
<RequestListTable {...props} />
```

**After (Template System):**

```tsx
<StatsCardGroup stats={stats} />
<PageControls title="..." {...props} />
<DataTable data={items} columns={columns} actions={actions} />
```

**Steps:**

1. Replace custom StatsCards with `StatsCardGroup`
2. Replace custom controls with `PageControls`
3. Convert table to use `DataTable` with column/action configs
4. Delete old custom components (optional, keep if used elsewhere)

---

## ✅ Benefits

### For Developers

- 🚀 **Create pages in 5 minutes** instead of hours
- 🎨 **Zero styling needed** - everything pre-configured
- 🔄 **100% consistency** across all pages
- 🧪 **Easier testing** - consistent structure
- 📦 **Type-safe** - full TypeScript support
- 🔧 **Maintainable** - update once, apply everywhere

### For Users

- ✨ **Consistent UI** - same look and feel everywhere
- 🎯 **Familiar patterns** - once learned, applies to all pages
- 💨 **Better performance** - optimized components
- 📱 **Responsive** - works on all screen sizes

---

## 🎓 Examples

### Cash Advance Page (Converted)

See: `/src/app/clothing/employees/cash-advance/page.tsx`

This page now uses all three template components and looks **exactly** like the Expenses page.

### Expenses Page (Original)

See: `/src/app/clothing/accounting/page.tsx`

This page uses custom components but has the exact same visual output. It can be converted to use templates for even better maintainability.

---

## 🛠️ Customization

### Adding New Features

**Want to add a new control type?**
Update `PageControls.tsx` and add the new prop/feature.

**Want to change the styling?**
Update the component styles in the template files - all pages will automatically update!

**Want to add a new stat card style?**
Create a variant in `StatsCardGroup.tsx` or create a new component like `CompactStatsCardGroup`.

---

## 📝 File Structure

```
src/components/shared/PageTemplates/
├── index.ts                  # Exports all components
├── StatsCardGroup.tsx        # Stats cards component
├── PageControls.tsx          # Control panel component
├── DataTable.tsx             # Data table component
└── README.md                 # This documentation
```

---

## 🎯 Best Practices

1. **Always use templates for new pages** - Don't create custom components
2. **Pass formatted data** - Format dates/currency before passing to render functions
3. **Use conditional actions** - Use `show` prop to conditionally display actions
4. **Keep columns simple** - Use `render` for complex cell content
5. **Provide good empty messages** - Help users understand when data is empty

---

## 🚦 Next Steps

1. **Convert remaining pages** to use template system
2. **Create page creation script** - CLI tool to scaffold new pages
3. **Add more variants** - Different table styles, card layouts, etc.
4. **Document patterns** - Common use cases and solutions
5. **Add storybook examples** - Visual documentation

---

## 📞 Support

Questions or issues with the template system?

- Check the examples in `/src/app/clothing/employees/cash-advance/page.tsx`
- Review this documentation
- Look at component prop types for available options

---

**Created:** October 13, 2025  
**Last Updated:** October 13, 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready
