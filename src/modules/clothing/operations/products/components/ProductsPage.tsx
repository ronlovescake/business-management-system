'use client';

/**
 * Products Page Component
 * Main orchestration component for Products module
 * - 32-column data grid
 * - Search with Ctrl+F
 * - CSV import/export
 * - Multi-cell paste
 * - Add/Edit products
 * - Real-time statistics
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Stack,
  Group,
  TextInput,
  Button,
  FileInput,
  Card,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconSearch,
  IconPlus,
  IconUpload,
  IconCheck,
} from '@tabler/icons-react';
import { GridView } from '@/components/grid/GridView';
import {
  GridColumn,
  Item,
  GridCell,
  GridCellKind,
  GridSelection,
} from '@glideapps/glide-data-grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { useProductsData } from '../hooks/useProductsData';
import { useProductForm } from '../hooks/useProductForm';
import { ProductStatsCards } from './ProductStatsCards';
import { AddProductModal } from './AddProductModal';
import { ProductService } from '../services/ProductService';
import {
  ProductData,
  ProductColumnKey,
  GridCellWithCursor,
} from '../types/product.types';

// Custom grid styles for 20px font
const customGridStyles = `
  .data-grid-container .dvn-scroller {
    font-size: 20px !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
`;

/**
 * Simple throttle function
 */
function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastRan = 0;

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();

    if (!lastRan) {
      func.apply(this, args);
      lastRan = now;
    } else {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(
        () => {
          if (now - lastRan >= wait) {
            func.apply(this, args);
            lastRan = now;
          }
        },
        wait - (now - lastRan)
      );
    }
  };
}

export function ProductsPage() {
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
    setProducts,
    setFilteredProducts,
  } = useProductsData();

  const productForm = useProductForm();

  // Local state
  const [pasteMode, setPasteMode] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [gridHeight, setGridHeight] = useState(600); // Default height, will update in useEffect
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);
  const cellContentCache = useRef<Map<string, GridCellWithCursor>>(new Map());

  // Set grid height on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setGridHeight(window.innerHeight * 0.83);
    }
  }, []);

  // Clear cache when filtered products change
  useEffect(() => {
    cellContentCache.current.clear();
  }, [filteredProducts]);

  /**
   * Define 32 columns with auto-sizing
   */
  const columns = useMemo<GridColumn[]>(
    () => [
      { id: 'shipmentCode', title: 'Shipment Code', width: 180 },
      { id: 'cvNumber', title: 'CV Number', width: 150 },
      { id: 'noOfSacks', title: 'No. Of Sacks', width: 130 },
      { id: 'totalCBM', title: 'Total CBM', width: 120 },
      { id: 'weight', title: 'Weight', width: 100 },
      { id: 'shipmentStatus', title: 'Shipment Status', width: 150 },
      { id: 'postingDate', title: 'Posting Date', width: 140 },
      { id: 'orderDate', title: 'Order Date', width: 140 },
      { id: 'payment', title: 'Payment', width: 120 },
      { id: 'product', title: 'Product', width: 200 },
      { id: 'productCode', title: 'Product Code', width: 250 },
      { id: 'ageRange', title: 'Age Range', width: 130 },
      { id: 'unit', title: 'Unit', width: 100 },
      { id: 'unitPrice', title: 'Unit Price', width: 130 },
      { id: 'quantity', title: 'Quantity', width: 110 },
      { id: 'alibabaShippingCost', title: 'Alibaba Shipping', width: 160 },
      { id: 'exchangeRates', title: 'Exchange Rate', width: 140 },
      { id: 'php', title: 'PHP', width: 120 },
      { id: 'subTotalPHP', title: 'Sub Total (PHP)', width: 160 },
      { id: 'transactionFee', title: 'Transaction Fee', width: 160 },
      { id: 'grandTotal', title: 'Grand Total', width: 150 },
      { id: 'forwardersFee', title: "Forwarder's Fee", width: 160 },
      { id: 'lalamove', title: 'Lalamove', width: 120 },
      { id: 'packagingCost', title: 'Packaging Cost', width: 160 },
      { id: 'suggestedPrice', title: 'Suggested Price', width: 160 },
      { id: 'actualPrice', title: 'Actual Price', width: 140 },
      { id: 'basePrice', title: 'Base Price', width: 130 },
      { id: 'cogs', title: 'COGS', width: 130 },
      { id: 'projectedSales', title: 'Projected Sales', width: 160 },
      { id: 'projectedProfit', title: 'Projected Profit', width: 170 },
      { id: 'projectedProfitPercent', title: 'Profit Margin (%)', width: 170 },
      { id: 'totalMarkup', title: 'Total Markup (%)', width: 170 },
    ],
    []
  );

  // Column ID to ProductData key mapping
  const idToKey: Record<string, ProductColumnKey> = useMemo(
    () => ({
      shipmentCode: 'Shipment Code',
      cvNumber: 'CV Number',
      noOfSacks: 'No. Of Sacks',
      totalCBM: 'Total CBM',
      weight: 'Weight',
      shipmentStatus: 'Shipment Status',
      postingDate: 'Posting Date',
      orderDate: 'Order Date',
      payment: 'Payment',
      product: 'Product',
      productCode: 'Product Code',
      ageRange: 'Age Range',
      unit: 'Unit',
      unitPrice: 'Unit Price',
      quantity: 'Quantity',
      alibabaShippingCost: 'Alibaba Shipping Cost',
      exchangeRates: 'Exchange Rates',
      php: 'PHP',
      subTotalPHP: 'Sub Total (PHP)',
      transactionFee: 'Transaction Fee',
      grandTotal: 'Grand Total',
      forwardersFee: "Forwarder's Fee",
      lalamove: 'Lalamove',
      packagingCost: 'Packaging Cost',
      suggestedPrice: 'Suggested Price',
      actualPrice: 'Actual Price',
      basePrice: 'Base Price',
      cogs: 'COGS',
      projectedSales: 'Projected Sales',
      projectedProfit: 'Projected Profit',
      projectedProfitPercent: 'Projected Profit (%)',
      totalMarkup: 'Total Markup',
    }),
    []
  );

  /**
   * Handle CSV import
   */
  const handleCSVImport = useCallback(async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const result = await ProductService.importFromCSV(text);

      if (!result.success) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: result.errors?.[0] || 'Failed to import CSV',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database
      const saveResponse = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.products),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save to database');
      }

      const saveResult = await saveResponse.json();

      // Update local state
      setProducts(result.products);
      setFilteredProducts(result.products);
      setFile(null);

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${saveResult.count} product records to database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      console.error('Import error:', error);
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  }, [file, setProducts, setFilteredProducts]);

  /**
   * Handle paste (multi-cell)
   */
  const handlePaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      if (!pasteMode) return false;
      const [startCol, startRow] = target;
      let applied = 0;
      let clipped = false;
      const nextProducts = [...products];

      const makeEmpty = (): ProductData => ({
        'Shipment Code': '',
        'CV Number': '',
        'No. Of Sacks': 0,
        'Total CBM': 0,
        Weight: 0,
        'Shipment Status': '',
        'Posting Date': '',
        'Order Date': '',
        Payment: '',
        Product: '',
        'Product Code': '',
        'Age Range': '',
        Unit: '',
        'Unit Price': 0,
        Quantity: 0,
        'Alibaba Shipping Cost': 0,
        'Exchange Rates': 0,
        PHP: 0,
        'Sub Total (PHP)': 0,
        'Transaction Fee': 0,
        'Grand Total': 0,
        "Forwarder's Fee": 0,
        Lalamove: 0,
        'Packaging Cost': 0,
        'Suggested Price': 0,
        'Actual Price': 0,
        'Base Price': 0,
        COGS: 0,
        'Projected Sales': 0,
        'Projected Profit': 0,
        'Projected Profit (%)': 0,
        'Total Markup': 0,
      });

      for (let r = 0; r < values.length; r++) {
        const rowIdx = startRow + r;
        const rowData = values[r] ?? [];

        let globalIndex: number;
        if (rowIdx < filteredProducts.length) {
          const rowObj = filteredProducts[rowIdx];
          globalIndex = nextProducts.indexOf(rowObj);
          if (globalIndex === -1) {
            nextProducts.push(makeEmpty());
            globalIndex = nextProducts.length - 1;
          }
        } else {
          nextProducts.push(makeEmpty());
          globalIndex = nextProducts.length - 1;
        }

        for (let c = 0; c < rowData.length; c++) {
          const colIdx = startCol + c;
          if (colIdx >= columns.length) {
            clipped = true;
            break;
          }
          const v = (rowData[c] ?? '').toString();
          const col = columns[colIdx];
          const key = col ? idToKey[col.id ?? ''] : undefined;
          if (key) {
            const updated: ProductData = {
              ...nextProducts[globalIndex],
              [key]: v,
            } as ProductData;
            nextProducts[globalIndex] = updated;
            applied++;
          }
        }
      }

      if (applied > 0) {
        bulkUpdateProducts(nextProducts);
        notifications.show({
          title: 'Pasted into table',
          message: `Applied ${applied} cell${applied === 1 ? '' : 's'}${clipped ? ' (some data clipped)' : ''}`,
          color: 'blue',
        });
        return true;
      }
      return false;
    },
    [
      pasteMode,
      products,
      filteredProducts,
      columns,
      idToKey,
      bulkUpdateProducts,
    ]
  );

  /**
   * Handle delete operations
   */
  const handleDelete = useCallback(
    (selection: GridSelection) => {
      if (!pasteMode) return false;

      const range = selection.current?.range;
      if (!range) return false;

      const { x, y, width, height } = range;
      const nextProducts = [...products];
      let deletedCount = 0;

      for (let row = y; row < y + height; row++) {
        if (row >= filteredProducts.length) break;

        const rowObj = filteredProducts[row];
        const globalIndex = nextProducts.indexOf(rowObj);

        if (globalIndex === -1) continue;

        for (let col = x; col < x + width; col++) {
          if (col >= columns.length) break;

          const column = columns[col];

          // Only allow deletion in Shipment Code column
          if (column.id === 'shipmentCode') {
            const key = idToKey[column.id];
            if (key) {
              nextProducts[globalIndex] = {
                ...nextProducts[globalIndex],
                [key]: '',
              };
              deletedCount++;
            }
          }
        }
      }

      if (deletedCount > 0) {
        bulkUpdateProducts(nextProducts);
        return true;
      }

      return false;
    },
    [
      pasteMode,
      products,
      filteredProducts,
      columns,
      idToKey,
      bulkUpdateProducts,
    ]
  );

  /**
   * Get cell data (with caching)
   */
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      // Check cache first
      const cacheKey = `${col}-${row}`;
      const cached = cellContentCache.current.get(cacheKey);
      if (cached) return cached;

      const product = filteredProducts[row];
      const column = columns[col];

      if (!product || !column) {
        const emptyCell: GridCellWithCursor = {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          contentAlign: 'center' as const,
          cursor: column?.id === 'productCode' ? 'pointer' : undefined,
        };
        cellContentCache.current.set(cacheKey, emptyCell);
        return emptyCell;
      }

      const key = idToKey[column.id as string];
      const value = product[key];
      const alignment = ProductService.getColumnAlignment(column.id as string);
      const useTwoDecimals = ProductService.usesTwoDecimalPlaces(
        column.id as string
      );

      let cellContent: GridCellWithCursor;

      if (typeof value === 'number') {
        const displayData = useTwoDecimals
          ? value.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : value.toLocaleString();

        cellContent = {
          kind: GridCellKind.Number,
          data: value,
          displayData: displayData,
          allowOverlay: false,
          contentAlign: alignment,
          cursor: column.id === 'productCode' ? 'pointer' : undefined,
        };
      } else {
        cellContent = {
          kind: GridCellKind.Text,
          data: value?.toString() || '',
          displayData: value?.toString() || '',
          allowOverlay: false,
          contentAlign: alignment,
          cursor: column.id === 'productCode' ? 'pointer' : undefined,
        };
      }

      cellContentCache.current.set(cacheKey, cellContent);

      // Limit cache size
      if (cellContentCache.current.size > 10000) {
        const keysToDelete = Array.from(cellContentCache.current.keys()).slice(
          0,
          1000
        );
        keysToDelete.forEach((key) => cellContentCache.current.delete(key));
      }

      return cellContent;
    },
    [filteredProducts, columns, idToKey]
  );

  /**
   * Handle cell clicks (double-click to edit)
   */
  const onCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;
      const product = filteredProducts[row];
      const column = columns[col];

      if (!product || !column) return;

      if (column.id === 'productCode') {
        const now = Date.now();
        const lastClick = lastClickRef.current;

        if (
          lastClick &&
          lastClick.cell[0] === col &&
          lastClick.cell[1] === row &&
          now - lastClick.time < 500
        ) {
          // Double-click detected
          productForm.populateForm(product);
          setAddProductOpen(true);
          lastClickRef.current = null;
        } else {
          lastClickRef.current = { cell, time: now };
        }
      }
    },
    [filteredProducts, columns, productForm]
  );

  /**
   * Custom header drawing
   */
  const drawHeader = useCallback(
    (args: {
      ctx: CanvasRenderingContext2D;
      column: GridColumn;
      rect: { x: number; y: number; width: number; height: number };
      theme: {
        bgHeader: string;
        textHeader: string;
        headerFontStyle: string;
      };
    }) => {
      const { ctx, column, rect, theme } = args;
      ctx.fillStyle = theme.bgHeader;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      ctx.fillStyle = theme.textHeader;
      ctx.font = theme.headerFontStyle;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;
      ctx.fillText(column.title ?? '', centerX, centerY);

      return true;
    },
    []
  );

  /**
   * Set grid height to 83vh
   */
  useEffect(() => {
    const updateGridHeight = () => {
      const vh83 = window.innerHeight * 0.83;
      setGridHeight(vh83);
    };

    const throttledResize = throttle(updateGridHeight, 150);

    updateGridHeight();
    window.addEventListener('resize', throttledResize);
    return () => window.removeEventListener('resize', throttledResize);
  }, []);

  /**
   * Handle Ctrl+F to focus search bar
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * Handle product form submission
   */
  const handleSubmitProduct = useCallback(async () => {
    const validation = productForm.validate();
    if (!validation.isValid) {
      notifications.show({
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
        notifications.show({
          title: '✅ Product Updated Successfully!',
          message: `${productForm.form.product} has been updated`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        notifications.show({
          title: '❌ Failed to Update Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    } else {
      const result = await addProduct(productData);
      if (result.success) {
        notifications.show({
          title: '🎉 Product Added Successfully!',
          message: `${productForm.form.product} has been added`,
          color: 'green',
          icon: <IconCheck size={18} />,
        });
        productForm.resetForm();
        setAddProductOpen(false);
      } else {
        notifications.show({
          title: '❌ Failed to Add Product',
          message: result.error || 'An error occurred',
          color: 'red',
        });
      }
    }
  }, [productForm, products, updateProduct, addProduct]);

  if (isLoading) {
    return (
      <PageLayout fluid withPadding>
        <Text>Loading products...</Text>
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
      <Stack
        gap="md"
        style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
      >
        {/* Stats cards */}
        <ProductStatsCards statistics={statistics} />

        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <TextInput
            ref={searchInputRef}
            placeholder="Search products by code, name, shipment code..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.currentTarget?.value || '')}
            style={{ flex: 1, minWidth: 300 }}
            size="md"
            radius="md"
          />

          <Group gap="sm">
            <Button
              variant={pasteMode ? 'filled' : 'outline'}
              color={pasteMode ? 'yellow' : 'gray'}
              size="md"
              radius="md"
              onClick={() => setPasteMode((v) => !v)}
            >
              {pasteMode ? 'Disable Paste Mode' : 'Enable Paste Mode'}
            </Button>
            <FileInput
              placeholder="Select CSV file"
              accept=".csv"
              value={file}
              onChange={setFile}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              style={{ minWidth: 200 }}
            />
            <Button
              onClick={handleCSVImport}
              disabled={!file}
              leftSection={<IconUpload size={16} />}
              size="md"
              radius="md"
              color="blue"
            >
              Import CSV
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              variant="filled"
              color="green"
              size="md"
              radius="md"
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

        {/* Data Grid */}
        <Card
          withBorder
          shadow="sm"
          radius="md"
          padding={0}
          style={{
            height: gridHeight,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
            fontSize: '18px',
          }}
          className="data-grid-container"
        >
          <GridView
            getCellContent={getData}
            columns={columns}
            rows={filteredProducts.length}
            height={gridHeight}
            width={'100%'}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={70}
            headerHeight={80}
            rowMarkers="number"
            onCellClicked={onCellClicked}
            onPaste={pasteMode ? handlePaste : undefined}
            onDelete={pasteMode ? handleDelete : undefined}
            isDraggable={false}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
            drawHeader={drawHeader}
            theme={{
              accentColor: '#228be6',
              accentLight: 'rgba(34, 139, 230, 0.1)',
              textDark: '#212529',
              textMedium: '#495057',
              textLight: '#868e96',
              textBubble: '#ffffff',
              bgIconHeader: '#f8f9fa',
              fgIconHeader: '#495057',
              textHeader: '#343a40',
              textHeaderSelected: '#228be6',
              bgCell: '#ffffff',
              bgCellMedium: '#ffffff',
              bgHeader: '#f8f9fa',
              bgHeaderHasFocus: '#e9ecef',
              bgHeaderHovered: '#e9ecef',
              bgBubble: '#228be6',
              bgBubbleSelected: '#1c7ed6',
              bgSearchResult: '#fff3cd',
              borderColor: 'transparent',
              horizontalBorderColor: 'rgba(206, 212, 218, 0.5)',
              drilldownBorder: 'rgba(34, 139, 230, 0.4)',
              linkColor: '#228be6',
              headerFontStyle: 'bold 17px Inter',
              baseFontStyle: '17px Inter',
              editorFontSize: '20',
              fontFamily: 'Inter',
              cellHorizontalPadding: 12,
              cellVerticalPadding: 8,
            }}
            getCellsForSelection={true}
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
    </PageLayout>
  );
}
