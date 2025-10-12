# Expenses Module - Reusable Components

This module provides standardized, reusable components for building expense management pages and similar table-based UIs throughout the application.

## Components

### 1. `TableContainer`

A standardized container for Mantine tables with consistent styling and scroll behavior.

**Features:**

- Bordered card wrapper
- Fixed height with vertical scroll
- Configurable height (default: 71vh)

**Usage:**

```tsx
import { TableContainer } from '@/components/expenses';

<TableContainer height="71vh">
  <Table>{/* Your table content */}</Table>
</TableContainer>;
```

### 2. `PageHeaderWithTabs`

A reusable header component with tab navigation for pages.

**Features:**

- Page title
- Tab navigation with icons
- Content panels for each tab
- Bordered card container

**Usage:**

```tsx
import { PageHeaderWithTabs, TabConfig } from '@/components/expenses';
import { IconList, IconChartPie } from '@tabler/icons-react';

const tabs: TabConfig[] = [
  {
    value: 'list',
    label: 'List View',
    icon: <IconList size={16} />,
    panel: <Group>{/* Search and filter controls */}</Group>,
  },
  {
    value: 'analytics',
    label: 'Analytics',
    icon: <IconChartPie size={16} />,
    panel: <div>{/* Analytics controls */}</div>,
  },
];

<PageHeaderWithTabs
  title="Expense Records"
  tabs={tabs}
  activeTab={activeTab}
  onTabChange={setActiveTab}
/>;
```

### 3. `ReceiptViewer`

An advanced modal for viewing receipts with zoom and download controls.

**Features:**

- Large modal (90% screen width, 85vh height)
- Zoom in/out (25% - 300%)
- Reset zoom to 100%
- Download button
- Live zoom percentage display

**Usage:**

```tsx
import { ReceiptViewer } from '@/components/expenses';

<ReceiptViewer
  opened={receiptModalOpen}
  onClose={closeViewer}
  receiptUrl={viewingReceipt}
  zoom={receiptZoom}
  onZoomIn={zoomIn}
  onZoomOut={zoomOut}
  onZoomReset={zoomReset}
  onDownload={downloadReceipt}
/>;
```

### 4. `useReceiptManager` Hook

A custom hook for managing receipt files and viewer state.

**Features:**

- Receipt file storage as data URLs
- Receipt viewer state management
- Zoom controls (in/out/reset)
- Upload and view handlers
- Download functionality

**Usage:**

```tsx
import { useReceiptManager } from '@/components/expenses';

function MyComponent() {
  const {
    // State
    receiptFiles,
    viewingReceipt,
    receiptModalOpen,
    receiptZoom,
    receiptFileName,

    // Actions
    storeReceipt,
    viewReceipt,
    closeViewer,
    zoomIn,
    zoomOut,
    zoomReset,
    downloadReceipt,
  } = useReceiptManager();

  // Store receipt when file is uploaded
  const handleFileUpload = async (file: File) => {
    const fileName = await storeReceipt(file);
    // Use fileName in your data
  };

  // View receipt
  const handleViewReceipt = (receiptName: string) => {
    viewReceipt(receiptName);
  };

  return (
    <>
      {/* Your UI */}
      <ReceiptViewer
        opened={receiptModalOpen}
        onClose={closeViewer}
        receiptUrl={viewingReceipt}
        zoom={receiptZoom}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onZoomReset={zoomReset}
        onDownload={downloadReceipt}
      />
    </>
  );
}
```

## CSV Utilities

### `exportToCSV`

Export data to CSV file with proper escaping and formatting.

**Usage:**

```tsx
import { exportToCSV } from '@/components/expenses';

interface MyData {
  id: string;
  name: string;
  amount: number;
}

const data: MyData[] = [...];

exportToCSV(
  data,
  ['ID', 'Name', 'Amount'],
  'my-export',
  (item) => [item.id, item.name, item.amount]
);
```

### `parseCSVLine`

Parse a CSV line with proper handling of quoted values.

**Usage:**

```tsx
import { parseCSVLine } from '@/components/expenses';

const line = 'John,"Doe, Jr.",30';
const values = parseCSVLine(line);
// Result: ['John', 'Doe, Jr.', '30']
```

### `validateCSVHeaders`

Validate that CSV has required columns.

**Usage:**

```tsx
import { validateCSVHeaders } from '@/components/expenses';

const headers = ['date', 'amount', 'description'];
const required = ['date', 'amount', 'description', 'category'];
const missing = validateCSVHeaders(headers, required);
// Result: ['category']
```

### `escapeCSV`

Escape CSV values properly for safe export.

**Usage:**

```tsx
import { escapeCSV } from '@/components/expenses';

const value = 'Description with, comma';
const escaped = escapeCSV(value);
// Result: '"Description with, comma"'
```

## Standard Pattern for Pages

Here's the recommended pattern for creating new table-based pages:

```tsx
'use client';

import React, { useState, useMemo } from 'react';
import { Stack, Table, Group, Button, TextInput } from '@mantine/core';
import {
  IconPlus,
  IconDownload,
  IconList,
  IconChartPie,
} from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  TableContainer,
  PageHeaderWithTabs,
  ReceiptViewer,
  useReceiptManager,
  exportToCSV,
  TabConfig,
} from '@/components/expenses';

export default function MyPage() {
  // State management
  const [data, setData] = useState([]);
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Receipt management
  const receipt = useReceiptManager();

  // Filtered data
  const filteredData = useMemo(() => {
    return data.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  // Export handler
  const handleExport = () => {
    exportToCSV(filteredData, ['Name', 'Amount'], 'export', (item) => [
      item.name,
      item.amount,
    ]);
  };

  // Tab configuration
  const tabs: TabConfig[] = [
    {
      value: 'list',
      label: 'List View',
      icon: <IconList size={16} />,
      panel: (
        <Group>
          <TextInput
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleExport}
          >
            Export
          </Button>
          <Button leftSection={<IconPlus size={16} />}>Add New</Button>
        </Group>
      ),
    },
    {
      value: 'analytics',
      label: 'Analytics',
      icon: <IconChartPie size={16} />,
      panel: <div>{/* Analytics controls */}</div>,
    },
  ];

  return (
    <PageLayout title="My Page">
      <Stack gap="md">
        {/* Header with tabs */}
        <PageHeaderWithTabs
          title="My Records"
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        {/* Conditional table rendering */}
        {activeTab === 'list' ? (
          <TableContainer height="71vh">
            <Table>{/* Your table content */}</Table>
          </TableContainer>
        ) : (
          <TableContainer height="71vh">
            <Table>{/* Analytics table */}</Table>
          </TableContainer>
        )}
      </Stack>

      {/* Receipt viewer */}
      <ReceiptViewer
        opened={receipt.receiptModalOpen}
        onClose={receipt.closeViewer}
        receiptUrl={receipt.viewingReceipt}
        zoom={receipt.receiptZoom}
        onZoomIn={receipt.zoomIn}
        onZoomOut={receipt.zoomOut}
        onZoomReset={receipt.zoomReset}
        onDownload={receipt.downloadReceipt}
      />
    </PageLayout>
  );
}
```

## Benefits

1. **Consistency**: All pages follow the same pattern and styling
2. **Reusability**: Components can be used across multiple pages
3. **Maintainability**: Changes to common functionality update all pages
4. **Productivity**: Faster development of new pages
5. **Type Safety**: Full TypeScript support with proper interfaces
6. **Best Practices**: Built-in proper escaping, validation, and error handling

## Migration Guide

To migrate an existing page to use these components:

1. Import the components: `import { TableContainer, PageHeaderWithTabs, ... } from '@/components/expenses';`
2. Replace table wrapper with `<TableContainer>`
3. Replace header section with `<PageHeaderWithTabs>`
4. Replace receipt viewer with `<ReceiptViewer>` component
5. Use `useReceiptManager()` hook for receipt functionality
6. Use CSV utilities for import/export
7. Test all functionality
8. Remove old duplicate code
