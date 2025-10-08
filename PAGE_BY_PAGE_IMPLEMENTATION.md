# Page-by-Page Implementation Guide

This guide shows you exactly how to update each page to use its new abstraction layer.

## 📋 Implementation Order

1. ✅ **Transactions** - Already done!
2. **Products** - Next
3. **Shipments** - After products
4. **Prices** - After shipments
5. **Customers** - After prices
6. **Sorting-Distribution** - Last

---

## 2. Products Page Implementation

### Step 1: Update Imports

**File:** `src/app/clothing/operations/products/page.tsx`

**Find this:**

```tsx
import { GridView } from '../../../../components/grid';
import { PageLayout } from '../../../../components/layout/PageLayout';
```

**Add this after:**

```tsx
import { ProductsLayout } from '../../../../components/features/products';
```

### Step 2: Find the Return Statement

**Current structure (around line 1460):**

```tsx
return (
  <PageLayout fluid withPadding>
    <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
    <Stack gap="md" style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}>
      {/* Stats cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
        {/* ... 4 stat cards ... */}
      </SimpleGrid>

      {/* Search and controls */}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        {/* ... search bar and buttons ... */}
      </Group>

      {/* Add Product Modal */}
      <Modal opened={addProductOpen} ...>
        {/* ... modal content ... */}
      </Modal>

      {/* Grid View */}
      <div style={{ height: '83vh', width: width ? `${width}px` : '100%' }}>
        <GridView
          data={filteredProducts}
          columns={columns}
          getCellContent={getCellContent}
          onCellEdited={handleCellEdited}
          onCellClick={handleCellClick}
          gridSelection={gridSelection}
          onGridSelectionChange={setGridSelection}
          enableClickableCursor={true}
        />
      </div>

      {/* Footer */}
      <Group justify="space-between" align="center">
        <Text size="sm" c="dimmed">
          Showing {filteredProducts.length} of {products.length} products
        </Text>
      </Group>
    </Stack>
  </PageLayout>
);
```

### Step 3: Replace with Layout Component

**Replace the entire return statement with:**

```tsx
return (
  <PageLayout fluid withPadding>
    <ProductsLayout
      data={products}
      filteredData={filteredProducts}
      columns={columns}
      stats={stats}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      searchInputRef={searchInputRef}
      getCellContent={getCellContent}
      onCellEdited={handleCellEdited}
      onCellClick={handleCellClick}
      gridSelection={gridSelection}
      onGridSelectionChange={setGridSelection}
      csvFile={file}
      onFileChange={setFile}
      onCSVImport={handleCSVImport}
      pasteMode={pasteMode}
      onPasteModeToggle={() => setPasteMode((v) => !v)}
      addProductOpen={addProductOpen}
      onAddProductOpenChange={setAddProductOpen}
      onAddProductClick={() => {
        resetForm();
        setAddProductOpen(true);
      }}
      addProductForm={
        // Move the entire modal content here
        // (everything inside the Modal component)
        <YourModalContentHere />
      }
      width={width}
      height={83}
      customStyles={customGridStyles}
      enableClickableCursor={true}
    />
  </PageLayout>
);
```

### Step 4: Remove Unused Imports

After the change, remove these if they're no longer used:

```tsx
// Remove these if not used elsewhere:
import {
  Stack,
  Text,
  Button,
  Group,
  FileInput,
  TextInput,
  Card,
  SimpleGrid,
  ThemeIcon,
  Title,
  Modal,
} from '@mantine/core';
import {
  IconUpload,
  IconSearch,
  IconCurrencyDollar,
  IconTrendingUp,
  IconAdjustments,
  IconPlus,
} from '@tabler/icons-react';
```

### Step 5: Test

- [ ] Products page loads correctly
- [ ] Stats cards display proper values
- [ ] Search works
- [ ] Paste mode toggles
- [ ] CSV import works
- [ ] Add product button opens modal
- [ ] Cell editing works
- [ ] Product calculations preserved

---

## 3. Shipments Page Implementation

### Step 1: Update Imports

**File:** `src/app/clothing/operations/shipments/page.tsx`

**Add this:**

```tsx
import { ShipmentsLayout } from '../../../../components/features/shipments';
```

### Step 2: Replace Return Statement

**Find the return statement and replace with:**

```tsx
return (
  <PageLayout fluid withPadding>
    <ShipmentsLayout
      data={shipments}
      filteredData={filteredData}
      columns={columns}
      statsCards={statsCards}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      getCellContent={cellContentGetter}
      onCellEdited={handleCellEdited}
      onCellClick={handleCellClick}
      customRenderers={
        allCells as unknown as readonly Record<string, unknown>[]
      }
      enableCSVImport={true}
      csvFile={csvFile}
      onFileChange={setCsvFile}
      onCSVImport={handleCSVImport}
      addModalOpen={addModalOpened}
      onAddModalOpenChange={setAddModalOpened}
      onAddShipmentClick={() => setAddModalOpened(true)}
      addShipmentForm={
        // Your add shipment form content
        <YourAddShipmentForm />
      }
      editModalOpen={editModalOpened}
      onEditModalOpenChange={setEditModalOpened}
      editShipmentForm={
        // Your edit shipment form content
        <YourEditShipmentForm />
      }
      enableCtrlF={true}
    />
  </PageLayout>
);
```

### Step 3: Test

- [ ] Shipments page loads
- [ ] Stats cards display
- [ ] Search works
- [ ] Add shipment modal opens
- [ ] Edit shipment works (double-click)
- [ ] CSV import works
- [ ] Cell editing works

---

## 4. Prices Page Implementation

### Step 1: Update Imports

**File:** `src/app/clothing/operations/prices/page.tsx`

**Add this:**

```tsx
import { PricesLayout } from '../../../../components/features/prices';
```

### Step 2: Replace Return Statement

```tsx
return (
  <PageLayout fluid withPadding>
    <PricesLayout
      data={prices}
      filteredData={filteredData}
      columns={columns}
      statsCards={statsCards}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      getCellContent={cellContentGetter}
      onCellEdited={handleCellEdited}
      customRenderers={
        allCells as unknown as readonly Record<string, unknown>[]
      }
      enableCSVImport={true}
      csvFile={csvFile}
      onFileChange={setCsvFile}
      onCSVImport={handleCSVImport}
      onAddRows={handleAdd10Rows}
      enableCtrlF={true}
    />
  </PageLayout>
);
```

### Step 3: Test

- [ ] Prices page loads
- [ ] Stats cards display
- [ ] Search works
- [ ] Add rows button works
- [ ] CSV import works
- [ ] Cell editing works
- [ ] Tier pricing calculations preserved

---

## 5. Customers Page Implementation

### Step 1: Update Imports

**File:** `src/app/clothing/operations/customers/page.tsx`

**Add this:**

```tsx
import { CustomersLayout } from '../../../../components/features/customers';
```

### Step 2: Replace Return Statement

```tsx
return (
  <PageLayout fluid withPadding>
    <CustomersLayout
      data={customers}
      filteredData={filteredData}
      columns={columns}
      statsCards={statsCards}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      getCellContent={cellContentGetter}
      onCellEdited={handleCellEdited}
      customRenderers={
        allCells as unknown as readonly Record<string, unknown>[]
      }
      enableCSVImport={true}
      csvFile={csvFile}
      onFileChange={setCsvFile}
      onCSVImport={handleCSVImport}
      onAddRows={handleAdd10Rows}
      enableCtrlF={true}
    />
  </PageLayout>
);
```

### Step 3: Test

- [ ] Customers page loads
- [ ] Stats cards display
- [ ] Search works
- [ ] Add rows button works
- [ ] CSV import works
- [ ] Cell editing works

---

## 6. Sorting-Distribution Page Implementation

### Step 1: Update Imports

**File:** `src/app/clothing/operations/sorting-distribution/page.tsx`

**Add this:**

```tsx
import { SortingDistributionLayout } from '../../../../components/features/sorting-distribution';
```

### Step 2: Replace Return Statement

```tsx
return (
  <PageLayout fluid withPadding>
    <SortingDistributionLayout
      data={entries}
      filteredData={filteredData}
      columns={columns}
      statsCards={statsCards}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      getCellContent={cellContentGetter}
      onCellEdited={handleCellEdited}
      customRenderers={
        allCells as unknown as readonly Record<string, unknown>[]
      }
      enableCSVImport={true}
      csvFile={csvFile}
      onFileChange={setCsvFile}
      onCSVImport={handleCSVImport}
      onAddEntry={() => setAddModalOpen(true)}
      onGenerateReport={handleGenerateReport}
      isGeneratingReport={isGeneratingReport}
      addModalOpen={addModalOpen}
      onAddModalOpenChange={setAddModalOpen}
      addEntryForm={
        // Your add entry form content
        <YourAddEntryForm />
      }
      enableCtrlF={true}
    />
  </PageLayout>
);
```

### Step 3: Test

- [ ] Sorting-distribution page loads
- [ ] Stats cards display
- [ ] Search works
- [ ] Add entry modal opens
- [ ] Generate report works
- [ ] CSV import works
- [ ] Cell editing works

---

## 🧪 Testing Checklist (For All Pages)

After implementing each page, verify:

### ✅ Visual & UI

- [ ] Page loads without errors
- [ ] Stats cards display correct values
- [ ] Search bar is visible and functional
- [ ] All buttons are present
- [ ] Modals open/close correctly
- [ ] Grid displays all data

### ✅ Functionality

- [ ] Search filters data correctly
- [ ] CSV import works
- [ ] Cell editing saves properly
- [ ] Add buttons work (Add rows, Add entry, etc.)
- [ ] Modals submit forms correctly
- [ ] All business logic calculations work

### ✅ Performance

- [ ] Page loads quickly
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Grid scrolling is smooth

### ✅ Business Logic

- [ ] All formulas calculate correctly
- [ ] Database saves work
- [ ] Validation rules enforced
- [ ] Auto-population logic works

---

## 🚨 Common Issues & Solutions

### Issue: Modal content not showing

**Solution:** Make sure to pass the modal form content as `addProductForm` prop (or equivalent for each page):

```tsx
<ProductsLayout
  addProductForm={
    <Stack gap="md">
      {/* Your form fields here */}
      <TextInput label="Product Code" {...form.getInputProps('productCode')} />
      {/* More fields... */}
      <Button onClick={handleSubmit}>Submit</Button>
    </Stack>
  }
/>
```

### Issue: TypeScript errors about types

**Solution:** Make sure your data types match. The layout components use generics:

```tsx
// If you have custom types:
<ProductsLayout<YourProductType>
  data={products}
  // ... other props
/>
```

### Issue: Grid not rendering

**Solution:** Check that you're passing all required grid props:

- `getCellContent`
- `columns`
- `data` and `filteredData`

### Issue: Stats cards not updating

**Solution:** Make sure the `stats` or `statsCards` prop is being recalculated when data changes:

```tsx
const stats = useMemo(
  () => ({
    total: products.length,
    totalValue: calculateTotal(products),
    // ... other calculations
  }),
  [products]
); // Add dependencies!
```

---

## 📝 Notes

1. **Take it one page at a time** - Don't try to migrate all pages at once
2. **Test thoroughly** after each page migration
3. **Commit after each successful page** - Makes it easy to rollback if needed
4. **Keep business logic in page.tsx** - Only move UI to layout components
5. **Modal content stays in page.tsx** - Pass it as props to layout

---

## 🎯 Success Criteria

After completing all migrations:

✅ All 6 pages use abstraction layers
✅ Business logic isolated in page components
✅ UI managed by layout components  
✅ Grid implementations easily swappable
✅ Zero breaking changes to functionality
✅ All tests passing
✅ TypeScript errors resolved
✅ Consistent patterns across all pages

---

## 🚀 Ready to Start?

Begin with the **Products page** as it's the next most complex after Transactions!

Follow the steps above carefully, test thoroughly, and move to the next page.

Good luck! 🎉
