# How to Swap Grid Implementations - Step-by-Step Guide

This guide shows you exactly how to replace the current DataTable grid with any other grid library, without touching your business logic!

## 🎯 Current Setup

Currently using: **Glide Data Grid** (via DataTable component)

Location of grid implementation: `src/components/features/transactions/TransactionsLayout.tsx`

## 📋 What You Need to Know

### Files You'll Edit

✅ **Only one file**: `src/components/features/transactions/TransactionsLayout.tsx`

### Files You'll NEVER Touch

❌ **Business logic**: `src/app/clothing/operations/transactions/page.tsx`

- All invoice generation
- All database operations
- All event handlers
- All state management
- All business calculations

## 🔄 Option 1: Switch to AG Grid

### Step 1: Install AG Grid

```bash
npm install ag-grid-react ag-grid-community
```

### Step 2: Update TransactionsLayout.tsx

```tsx
// Add AG Grid imports at the top
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

// In the component, convert columns
export function TransactionsLayout<T>({ ... }) {
  // Convert Glide columns to AG Grid columns
  const columnDefs = useMemo(() =>
    columns.map(col => ({
      field: col.id,
      headerName: col.title,
      editable: true,
      width: col.width,
      sortable: true,
      filter: true,
      resizable: true,
    })),
    [columns]
  );

  // Handle cell edits
  const onCellValueChanged = useCallback((event) => {
    if (onCellEdited) {
      const rowIndex = event.rowIndex;
      const colIndex = columns.findIndex(c => c.id === event.colDef.field);
      // Convert to Glide format for handler
      onCellEdited([colIndex, rowIndex], {
        kind: GridCellKind.Text,
        data: event.newValue,
        displayData: String(event.newValue),
        allowOverlay: true,
      });
    }
  }, [onCellEdited, columns]);

  return (
    <div>
      {/* Keep all existing UI elements */}
      <div className="ag-theme-alpine" style={{ height: '83vh', width: '100%' }}>
        <AgGridReact
          rowData={filteredData}
          columnDefs={columnDefs}
          onCellValueChanged={onCellValueChanged}
          enableRangeSelection={true}
          suppressRowClickSelection={true}
          rowSelection="multiple"
        />
      </div>
    </div>
  );
}
```

### Step 3: Done! Test it

- Business logic in `page.tsx`: **UNCHANGED** ✅
- Invoice generation: **STILL WORKS** ✅
- Database persistence: **STILL WORKS** ✅

---

## 🔄 Option 2: Switch to TanStack Table

### Step 1: Install TanStack Table

```bash
npm install @tanstack/react-table
```

### Step 2: Update TransactionsLayout.tsx

```tsx
import { useReactTable, flexRender, getCoreRowModel } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';

export function TransactionsLayout<T>({ ... }) {
  // Convert columns
  const tanstackColumns: ColumnDef<T>[] = useMemo(() =>
    columns.map(col => ({
      id: col.id,
      header: col.title,
      accessorKey: col.id,
      cell: ({ getValue, row, column }) => (
        <input
          value={getValue() as string}
          onChange={(e) => handleCellEdit(row.index, column.id, e.target.value)}
          style={{ width: '100%', border: 'none', background: 'transparent' }}
        />
      ),
    })),
    [columns]
  );

  const table = useReactTable({
    data: filteredData,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleCellEdit = (rowIndex: number, colId: string, newValue: any) => {
    if (onCellEdited) {
      const colIndex = columns.findIndex(c => c.id === colId);
      onCellEdited([colIndex, rowIndex], {
        kind: GridCellKind.Text,
        data: newValue,
        displayData: String(newValue),
        allowOverlay: true,
      });
    }
  };

  return (
    <div style={{ height: '83vh', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th key={header.id} style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 3: Done! Test it

- Business logic in `page.tsx`: **UNCHANGED** ✅

---

## 🔄 Option 3: Switch to react-data-grid

### Step 1: Install react-data-grid

```bash
npm install react-data-grid
```

### Step 2: Update TransactionsLayout.tsx

```tsx
import DataGrid from 'react-data-grid';
import type { Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';

export function TransactionsLayout<T>({ ... }) {
  // Convert columns
  const rdgColumns: Column<T>[] = useMemo(() =>
    columns.map(col => ({
      key: col.id,
      name: col.title,
      width: col.width,
      editable: true,
      resizable: true,
      sortable: true,
    })),
    [columns]
  );

  const handleRowsChange = (rows: T[], { indexes, column }: any) => {
    if (onCellEdited && indexes.length > 0) {
      const rowIndex = indexes[0];
      const colIndex = columns.findIndex(c => c.id === column.key);
      onCellEdited([colIndex, rowIndex], {
        kind: GridCellKind.Text,
        data: rows[rowIndex][column.key as keyof T],
        displayData: String(rows[rowIndex][column.key as keyof T]),
        allowOverlay: true,
      });
    }
  };

  return (
    <div style={{ height: '83vh' }}>
      <DataGrid
        columns={rdgColumns}
        rows={filteredData}
        onRowsChange={handleRowsChange}
        style={{ height: '100%' }}
      />
    </div>
  );
}
```

### Step 3: Done! Test it

- Business logic in `page.tsx`: **UNCHANGED** ✅

---

## 🔄 Option 4: Switch to MUI DataGrid

### Step 1: Install MUI DataGrid

```bash
npm install @mui/x-data-grid
```

### Step 2: Update TransactionsLayout.tsx

```tsx
import { DataGrid as MuiDataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRowsProp } from '@mui/x-data-grid';

export function TransactionsLayout<T>({ ... }) {
  // Convert columns
  const muiColumns: GridColDef[] = useMemo(() =>
    columns.map(col => ({
      field: col.id,
      headerName: col.title,
      width: col.width,
      editable: true,
      sortable: true,
      filterable: true,
    })),
    [columns]
  );

  // Add IDs to rows (MUI requirement)
  const muiRows: GridRowsProp = useMemo(() =>
    filteredData.map((row, idx) => ({ ...row, id: idx })),
    [filteredData]
  );

  const handleCellEdit = (params: any, event: any) => {
    if (onCellEdited) {
      const rowIndex = params.id as number;
      const colIndex = columns.findIndex(c => c.id === params.field);
      onCellEdited([colIndex, rowIndex], {
        kind: GridCellKind.Text,
        data: params.value,
        displayData: String(params.value),
        allowOverlay: true,
      });
    }
  };

  return (
    <div style={{ height: '83vh', width: '100%' }}>
      <MuiDataGrid
        rows={muiRows}
        columns={muiColumns}
        onCellEditCommit={handleCellEdit}
        checkboxSelection
        disableSelectionOnClick
      />
    </div>
  );
}
```

### Step 3: Done! Test it

- Business logic in `page.tsx`: **UNCHANGED** ✅

---

## 🎨 Keeping All UI Elements

When swapping grids, remember to **keep all the UI elements** that TransactionsLayout provides:

```tsx
export function TransactionsLayout<T>({ ... }) {
  // ALWAYS keep these UI elements
  const footerLeft = onAddRows ? (
    <Group gap="md" align="center">
      <Button onClick={onAddRows}>Add 10 Rows</Button>
      <Text>Showing {filteredData.length} of {data.length}</Text>
    </Group>
  ) : undefined;

  const searchRightButtons = statusOptions.length > 0 ? (
    <Group gap="xs" wrap="wrap">
      {statusOptions.map(status => (
        <Pill onClick={() => onStatusFilter?.(status)}>{status}</Pill>
      ))}
    </Group>
  ) : undefined;

  const actionButtons = (
    <Group>
      {onGenerateInvoice && <Button onClick={...}>Invoice</Button>}
      {onGeneratePackingList && <Button onClick={...}>Packing List</Button>}
      {onGenerateDistribution && <Button onClick={...}>Distribution</Button>}
    </Group>
  );

  return (
    <Stack>
      {/* Stats Cards */}
      {statsCards && <StatsCardGrid cards={statsCards} />}

      {/* Search Bar */}
      <TextInput
        value={searchQuery}
        onChange={(e) => onSearch(e.currentTarget.value)}
        placeholder={searchPlaceholder}
        rightSection={searchRightButtons}
      />

      {/* Action Buttons */}
      {actionButtons}

      {/* THE GRID - THIS IS THE ONLY PART YOU CHANGE */}
      <YourNewGrid {...convertedProps} />

      {/* Footer */}
      {footerLeft}
    </Stack>
  );
}
```

---

## 🧪 Testing Checklist

After swapping the grid, test these features:

### ✅ Basic Functionality

- [ ] Grid displays data correctly
- [ ] Can edit cells
- [ ] Cell edits save to state
- [ ] Search bar filters data
- [ ] Status pills filter by status
- [ ] Stats cards show correct numbers

### ✅ Critical Business Logic

- [ ] Invoice generation works
- [ ] Packing list generation works
- [ ] Distribution generation works
- [ ] Database saves work (check network tab)
- [ ] CSV import works
- [ ] Auto-population logic works (product code changes)

### ✅ UI Elements

- [ ] All buttons visible
- [ ] Loading states work
- [ ] Add 10 rows button works
- [ ] Count shows correctly
- [ ] Action buttons styled properly

---

## 📊 Comparison Matrix

| Feature           | Glide Data Grid | AG Grid    | TanStack Table | react-data-grid | MUI DataGrid |
| ----------------- | --------------- | ---------- | -------------- | --------------- | ------------ |
| **Performance**   | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐       | ⭐⭐⭐⭐        | ⭐⭐⭐⭐     |
| **Cell Editing**  | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐ | ⭐⭐⭐         | ⭐⭐⭐⭐        | ⭐⭐⭐⭐⭐   |
| **Excel-like UX** | ⭐⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐ | ⭐⭐           | ⭐⭐⭐⭐        | ⭐⭐⭐       |
| **Bundle Size**   | Medium          | Large      | Small          | Medium          | Large        |
| **Free Features** | Many            | Some       | All            | Many            | Limited      |
| **Customization** | High            | Very High  | Very High      | High            | High         |

---

## 🎯 Recommended Choice

**Stick with Glide Data Grid** unless you have a specific reason to switch. It's:

- ✅ Already working
- ✅ Excel-like experience
- ✅ Great performance
- ✅ Good cell editing
- ✅ Free features

**Switch to AG Grid** if you need:

- Advanced enterprise features
- Complex filtering/grouping
- Master-detail views
- Budget for commercial license

**Switch to TanStack Table** if you want:

- Full customization control
- Lightweight bundle
- Headless UI approach

---

## 🚨 Important Notes

### What Changes When You Swap

- ✅ Grid UI and interaction
- ✅ Column configuration format
- ✅ Cell rendering approach

### What NEVER Changes

- ❌ Business logic in `page.tsx`
- ❌ Invoice generation
- ❌ Database persistence
- ❌ Event handlers
- ❌ State management
- ❌ Business calculations

### The Magic

Because of the abstraction layer, you can experiment with different grids **risk-free**!

Try AG Grid? Don't like it? Switch back to Glide. **Business logic never touched!** 🎉

---

## 📞 Support

If you need help swapping grids:

1. Check this guide
2. Read `TRANSACTIONS_ABSTRACTION_LAYER.md`
3. Look at `TRANSACTIONS_ARCHITECTURE_DIAGRAM.md`

Remember: **Only edit `TransactionsLayout.tsx`** - never `page.tsx`!
