'use client';

/**
 * Products Grid Component
 * Main data grid for Products using Handsontable
 * - 36-column data grid
 * - Search with Ctrl+F
 * - CSV import/export
 * - Multi-cell paste
 * - Add/Edit products
 * - Real-time statistics
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Stack, Group, TextInput, Button, Card, Text } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import {
  IconSearch,
  IconPlus,
  IconCheck,
  IconEdit,
  IconLock,
} from '@tabler/icons-react';
import { HotTable } from '@handsontable/react';
import type { HotTableClass } from '@handsontable/react';
import type { CellChange, ChangeSource } from 'handsontable/common';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import { useProductsData } from '../hooks/useProductsData';
import { useProductForm } from '../hooks/useProductForm';
import type { ProductData } from '../types/product.types';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

// Register Handsontable modules
registerAllModules();

// Lazy load heavy modal component
const AddProductModal = dynamic(
  () =>
    import('./AddProductModal').then((mod) => ({
      default: mod.AddProductModal,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

const displayOptionalNumber = (value?: number | null) => {
  if (value === null || value === undefined) {
    return '';
  }

  return value === 0 ? '' : value;
};

export function ProductsGrid() {
  // Hooks
  const {
    products,
    filteredProducts,
    searchQuery,
    statistics,
    isLoading,
    handleSearch,
    addProduct,
    updateProduct,
    bulkUpdateProducts,
    refreshProducts: _refreshProducts,
  } = useProductsData();

  const productForm = useProductForm();

  // Local state
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [gridHeight, setGridHeight] = useState(600);
  const [isEditMode, setIsEditMode] = useState(false);
  const hotTableRef = useRef<HotTableClass>(null);
  const lastClickRef = useRef<{
    row: number;
    col: number;
    time: number;
  } | null>(null);

  // Set grid height on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGridHeight(window.innerHeight * 0.83);
    }
  }, []);

  // Convert ProductData to row arrays for Handsontable
  const tableData = filteredProducts.map((product) => [
    product['Shipment Code'],
    product['CV Number'],
    product['No. Of Sacks'],
    product['Total CBM'],
    product.Weight,
    product['Shipment Status'],
    product['Posting Date'],
    product['Order Date'],
    product.Payment,
    product.Product,
    product['Product Code'],
    product['Age Range'],
    product.Unit,
    product['Unit Price'],
    product.Quantity,
    product['Alibaba Shipping Cost'],
    product['Exchange Rates'],
    product.PHP,
    product['Sub Total (PHP)'],
    product['Transaction Fee'],
    product['Grand Total'],
    product["Forwarder's Fee"],
    product.Lalamove,
    product['Packaging Cost'],
    product['Suggested Price'],
    product['Actual Price'],
    product['Base Price'],
    product.COGS,
    product['Projected Sales'],
    product['Projected Profit'],
    product['Projected Profit (%)'],
    product['Total Markup'],
    product['Link To Post'] || '',
    displayOptionalNumber(product['Bulk Quantity']),
    displayOptionalNumber(product['Bulk Weight']),
    displayOptionalNumber(product['Weight Per Piece']),
  ]);

  // Define columns
  const columns = [
    {
      data: 0,
      title: 'SHIPMENT CODE',
      width: 180,
      type: 'text',
      readOnly: !isEditMode,
    },
    { data: 1, title: 'CV NUMBER', width: 180, type: 'text', readOnly: true },
    {
      data: 2,
      title: 'NO. OF SACKS',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0' },
      readOnly: true,
    },
    {
      data: 3,
      title: 'TOTAL CBM',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 4,
      title: 'WEIGHT',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0' },
      readOnly: true,
    },
    {
      data: 5,
      title: 'SHIPMENT STATUS',
      width: 180,
      type: 'text',
      readOnly: true,
    },
    {
      data: 6,
      title: 'POSTING DATE',
      width: 180,
      type: 'text',
      readOnly: true,
    },
    { data: 7, title: 'ORDER DATE', width: 180, type: 'text', readOnly: true },
    { data: 8, title: 'PAYMENT', width: 180, type: 'text', readOnly: true },
    {
      data: 9,
      title: 'PRODUCT',
      width: 500,
      type: 'text',
      readOnly: !isEditMode,
      className: 'htLeft',
    },
    {
      data: 10,
      title: 'PRODUCT CODE',
      width: 500,
      type: 'text',
      readOnly: true,
      className: 'htLeft',
    },
    { data: 11, title: 'AGE RANGE', width: 180, type: 'text', readOnly: true },
    { data: 12, title: 'UNIT', width: 180, type: 'text', readOnly: true },
    {
      data: 13,
      title: 'UNIT PRICE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 14,
      title: 'QUANTITY',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0' },
      readOnly: true,
    },
    {
      data: 15,
      title: 'ALIBABA SHIPPING',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: !isEditMode,
    },
    {
      data: 16,
      title: 'EXCHANGE RATE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 17,
      title: 'PHP',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 18,
      title: 'SUB TOTAL (PHP)',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 19,
      title: 'TRANSACTION FEE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 20,
      title: 'GRAND TOTAL',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 21,
      title: "FORWARDER'S FEE",
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: !isEditMode,
    },
    {
      data: 22,
      title: 'LALAMOVE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: !isEditMode,
    },
    {
      data: 23,
      title: 'PACKAGING COST',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: !isEditMode,
    },
    {
      data: 24,
      title: 'SUGGESTED PRICE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 25,
      title: 'ACTUAL PRICE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 26,
      title: 'BASE PRICE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 27,
      title: 'COGS',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 28,
      title: 'PROJECTED SALES',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 29,
      title: 'PROJECTED PROFIT',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 30,
      title: 'PROFIT MARGIN (%)',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 31,
      title: 'TOTAL MARKUP (%)',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 32,
      title: 'LINK TO POST',
      width: 220,
      type: 'text',
      readOnly: true,
      className: 'htLeft',
    },
    {
      data: 33,
      title: 'BULK QUANTITY',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0' },
      readOnly: true,
    },
    {
      data: 34,
      title: 'BULK WEIGHT',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
    {
      data: 35,
      title: 'WEIGHT PER PIECE',
      width: 180,
      type: 'numeric',
      numericFormat: { pattern: '0,0.00' },
      readOnly: true,
    },
  ];

  /**
   * Handle cell changes
   */
  const handleAfterChange = useCallback(
    (changes: CellChange[] | null, source: ChangeSource) => {
      if (!changes || source === 'loadData') {
        return;
      }

      // Update products based on changes
      const updatedProducts = [...products];

      changes.forEach(([row, col, _oldValue, newValue]) => {
        if (row < filteredProducts.length) {
          const product = filteredProducts[row];
          const globalIndex = products.findIndex((p) => p.id === product.id);

          if (globalIndex !== -1) {
            const columnKeys: (keyof ProductData)[] = [
              'Shipment Code',
              'CV Number',
              'No. Of Sacks',
              'Total CBM',
              'Weight',
              'Shipment Status',
              'Posting Date',
              'Order Date',
              'Payment',
              'Product',
              'Product Code',
              'Age Range',
              'Unit',
              'Unit Price',
              'Quantity',
              'Alibaba Shipping Cost',
              'Exchange Rates',
              'PHP',
              'Sub Total (PHP)',
              'Transaction Fee',
              'Grand Total',
              "Forwarder's Fee",
              'Lalamove',
              'Packaging Cost',
              'Suggested Price',
              'Actual Price',
              'Base Price',
              'COGS',
              'Projected Sales',
              'Projected Profit',
              'Projected Profit (%)',
              'Total Markup',
              'Link To Post',
              'Bulk Quantity',
              'Bulk Weight',
              'Weight Per Piece',
            ];

            const key = columnKeys[col as number];
            if (key) {
              // Check if Shipment Code column (0) is being cleared
              if (col === 0 && (!newValue || newValue === '')) {
                // Clear dependent fields when shipment code is deleted
                updatedProducts[globalIndex] = {
                  ...updatedProducts[globalIndex],
                  'Shipment Code': '',
                  'CV Number': '',
                  'No. Of Sacks': 0,
                  'Total CBM': 0,
                  Weight: 0,
                  'Shipment Status': '',
                };
              } else {
                updatedProducts[globalIndex] = {
                  ...updatedProducts[globalIndex],
                  [key]: newValue,
                };
              }
            }
          }
        }
      });

      bulkUpdateProducts(updatedProducts);
    },
    [products, filteredProducts, bulkUpdateProducts]
  );

  /**
   * Handle double-click on Product Code column to edit product
   */
  const handleCellClick = useCallback(
    (event: MouseEvent, coords: { row: number; col: number }) => {
      const now = Date.now();
      const lastClick = lastClickRef.current;

      // Check if this is a double-click (within 300ms on the same cell)
      const isDoubleClick =
        lastClick &&
        lastClick.row === coords.row &&
        lastClick.col === coords.col &&
        now - lastClick.time < 300;

      if (isDoubleClick) {
        // Double-click detected on Product Code column (column index 10)
        if (
          coords.col === 10 &&
          coords.row >= 0 &&
          coords.row < filteredProducts.length
        ) {
          const product = filteredProducts[coords.row];

          // Populate the form with the selected product data
          productForm.populateForm(product);
          setAddProductOpen(true);
        }

        // Reset the last click
        lastClickRef.current = null;
      } else {
        // Store this click for double-click detection
        lastClickRef.current = {
          row: coords.row,
          col: coords.col,
          time: now,
        };
      }
    },
    [filteredProducts, productForm]
  );

  useCtrlFFocus('[data-ctrlf-target="products-search-input"]', !isLoading);

  /**
   * Handle product form submission
   */
  const handleSubmitProduct = useCallback(async () => {
    const validation = productForm.validate();
    if (!validation.isValid) {
      showNotification({
        title: 'Validation Error',
        message: validation.errors[0],
        color: 'red',
      });
      return;
    }

    const existingProduct = productForm.isEditMode
      ? products.find((p) => p.id === productForm.editingProductId)
      : undefined;

    const productData = productForm.toProductData(existingProduct);

    if (productForm.isEditMode && productForm.editingProductId) {
      const result = await updateProduct(
        productForm.editingProductId,
        productData
      );
      if (result.success) {
        showNotification({
          title: '✅ Product Updated Successfully!',
          message: `${productForm.form.product} has been updated`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        showNotification({
          title: '❌ Failed to Update Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    } else {
      const result = await addProduct(productData);
      if (result.success) {
        showNotification({
          title: '🎉 Product Added Successfully!',
          message: `${productForm.form.product} has been added`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        showNotification({
          title: '❌ Failed to Add Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    }
  }, [productForm, products, updateProduct, addProduct]);

  return (
    <>
      <style>{`
        .ht-theme-horizon {
          --ht-font-size: 14px;
          --ht-line-height: 20px;
          --ht-font-weight: 400;
          --ht-letter-spacing: 0;
          --ht-gap-size: 6px;
          --ht-icon-size: 16px;
          --ht-table-transition: 0.2s;
          --ht-border-color: #e7e7e9;
          --ht-accent-color: #37bc6c;
          --ht-foreground-color: #353535;
          --ht-background-color: #ffffff;
          --ht-placeholder-color: #aeaeae;
          --ht-read-only-color: #727272;
          --ht-disabled-color: #aeaeae;
          --ht-cell-horizontal-border-color: rgba(255, 255, 255, 0);
          --ht-cell-vertical-border-color: #e7e7e9;
          --ht-wrapper-border-width: 0;
          --ht-wrapper-border-radius: 12px;
          --ht-wrapper-border-color: #e7e7e9;
          --ht-row-header-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-header-even-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-odd-background-color: rgba(255, 255, 255, 0);
          --ht-row-cell-even-background-color: rgba(255, 255, 255, 0);
          --ht-cell-horizontal-padding: 12px;
          --ht-cell-vertical-padding: 8px;
          --ht-cell-editor-border-width: 2px;
          --ht-cell-editor-border-color: #37bc6c;
          --ht-cell-editor-foreground-color: #070604;
          --ht-cell-editor-background-color: #ffffff;
          --ht-cell-editor-shadow-blur-radius: 8px;
          --ht-cell-editor-shadow-color: #37bc6c;
          --ht-cell-success-background-color: rgba(55, 188, 108, 0.30);
          --ht-cell-error-background-color: rgba(250, 77, 50, 0.30);
          --ht-cell-read-only-background-color: #ffffff;
          --ht-cell-selection-border-color: #37bc6c;
          --ht-cell-selection-background-color: #37bc6c;
          --ht-cell-autofill-size: 6px;
          --ht-cell-autofill-border-width: 1px;
          --ht-cell-autofill-border-radius: 4px;
          --ht-cell-autofill-border-color: #ffffff;
          --ht-cell-autofill-background-color: #37bc6c;
          --ht-cell-autofill-fill-border-color: #353535;
          --ht-cell-mobile-handle-size: 12px;
          --ht-cell-mobile-handle-border-width: 1px;
          --ht-cell-mobile-handle-border-radius: 6px;
          --ht-cell-mobile-handle-border-color: #37bc6c;
          --ht-cell-mobile-handle-background-color: rgba(55, 188, 108, 0.40);
          --ht-resize-indicator-color: #727272;
          --ht-move-backlight-color: rgba(35, 35, 38, 0.06);
          --ht-move-indicator-color: #37bc6c;
          --ht-hidden-indicator-color: #727272;
          --ht-scrollbar-border-radius: 8px;
          --ht-scrollbar-track-color: #f7f7f9;
          --ht-scrollbar-thumb-color: #aeaeae;
          --ht-header-font-weight: 400;
          --ht-header-foreground-color: #353535;
          --ht-header-background-color: #f7f7f9;
          --ht-header-highlighted-shadow-size: 1px;
          --ht-header-highlighted-foreground-color: #353535;
          --ht-header-highlighted-background-color: #ededef;
          --ht-header-active-border-color: #232326;
          --ht-header-active-foreground-color: #ffffff;
          --ht-header-active-background-color: #070604;
          --ht-header-filter-background-color: rgba(55, 188, 108, 0.30);
          --ht-header-row-foreground-color: #353535;
          --ht-header-row-background-color: #ffffff;
          --ht-header-row-highlighted-foreground-color: #353535;
          --ht-header-row-highlighted-background-color: #ededef;
          --ht-header-row-active-foreground-color: #ffffff;
          --ht-header-row-active-background-color: #070604;
        }
        
        /* Remove zebra striping completely */
        .ht-theme-horizon tr:nth-child(even) td,
        .ht-theme-horizon tr:nth-child(odd) td {
          background-color: #ffffff !important;
        }
        
        .ht-theme-horizon tr:nth-child(even) th,
        .ht-theme-horizon tr:nth-child(odd) th {
          background-color: rgba(255, 255, 255, 0) !important;
        }
      `}</style>

      <Stack gap="md">
        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <TextInput
            placeholder="Search products by code, name, shipment code..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget?.value || '')}
            style={{ flex: 1, minWidth: 300 }}
            size="md"
            radius="md"
            data-ctrlf-target="products-search-input"
          />

          <Group gap="sm">
            <Button
              leftSection={
                isEditMode ? <IconLock size={16} /> : <IconEdit size={16} />
              }
              variant="filled"
              color={isEditMode ? 'red' : 'blue'}
              size="sm"
              radius="sm"
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              color="green"
              size="sm"
              radius="sm"
              onClick={() => {
                productForm.resetForm();
                setAddProductOpen(true);
              }}
            >
              Add Product
            </Button>
          </Group>
        </Group>

        {/* Add Product Modal */}
        <AddProductModal
          opened={addProductOpen}
          onClose={() => {
            productForm.resetForm();
            setAddProductOpen(false);
          }}
          form={productForm.form}
          updateField={productForm.updateField}
          calculations={productForm.calculations}
          onSubmit={handleSubmitProduct}
          isEditMode={productForm.isEditMode}
        />

        {/* Handsontable Grid */}
        <Card
          withBorder
          shadow="sm"
          radius="md"
          padding={0}
          style={{
            height: gridHeight,
            width: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
          }}
        >
          <HotTable
            ref={hotTableRef}
            data={tableData}
            columns={columns}
            colHeaders={true}
            rowHeaders={true}
            width="100%"
            height={gridHeight}
            licenseKey="non-commercial-and-evaluation"
            stretchH="all"
            contextMenu={true}
            manualColumnResize={true}
            manualRowResize={true}
            filters={true}
            dropdownMenu={false}
            afterChange={handleAfterChange}
            afterOnCellMouseDown={handleCellClick}
            minSpareRows={50}
            className="ht-theme-horizon htCenter htMiddle"
          />
        </Card>

        {/* Footer info */}
        <Group
          justify="space-between"
          align="center"
          style={{ marginTop: 'md' }}
        >
          <Text size="sm" c="dimmed">
            Showing {filteredProducts.length} of {products.length} products
          </Text>
          <Text size="sm" c="dimmed">
            Total Value: ₱{statistics.totalValue.toLocaleString()} | Total
            Profit: ₱{statistics.totalProfit.toLocaleString()}
          </Text>
        </Group>
      </Stack>
    </>
  );
}
