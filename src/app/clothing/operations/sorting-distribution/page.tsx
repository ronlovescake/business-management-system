'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  GridCellKind,
  GridColumn,
  Item,
  type GridCell,
  type EditableGridCell,
} from '@glideapps/glide-data-grid';
import {
  Stack,
  Loader,
  Card,
  Grid,
  Text,
  TextInput,
  Group,
  Select,
} from '@mantine/core';

// Import Glide Data Grid CSS
import '@glideapps/glide-data-grid/dist/index.css';

// Custom styles for larger font and center aligned headers
const customGridStyles = `
  .data-grid-container * {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 20px !important;
    font-weight: 600 !important;
    font-family: Inter, sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 20px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 20px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 20px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 20px !important;
  }
  .dvn-scroller {
    font-size: 20px !important;
  }
`;

// Dynamic import to prevent SSR issues
const DataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  {
    ssr: false,
    loading: () => <Loader />,
  }
);

interface DistributionRow {
  quantity: number;
  percentage: number;
  groupNumber: string; // Changed to string to hold "Number X" format
  distribution: number;
  checked: boolean;
}

interface Product {
  productCode: string | null;
  shipmentStatus: string | null;
  quantity: number;
}

export default function SortingDistribution() {
  const [gridHeight, setGridHeight] = useState<number>(600);
  const [isMounted, setIsMounted] = useState(false);

  // Information fields state
  const [item, setItem] = useState<string>('');
  const [ordered, setOrdered] = useState<string>('');
  const [estQtyReceived, setEstQtyReceived] = useState<number>(0);
  const [totalReservation, setTotalReservation] = useState<number>(0);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [totalCustomers, setTotalCustomers] = useState<number>(0);
  const [customerWithOrderQty, setCustomerWithOrderQty] = useState<number>(0);

  // Product options from products table (filtered by "Sorting" shipment status)
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Load product codes from products with "Sorting" shipment status
  useEffect(() => {
    const loadProductCodes = async () => {
      try {
        const response = await fetch('/api/products');

        if (response.ok) {
          const products = await response.json();

          console.log('Loaded products:', products.length);

          // Store all products for lookup
          setAllProducts(products);

          // Filter products with "Sorting" shipment status and extract unique product codes
          // Database uses camelCase field names: shipmentStatus and productCode
          const sortingProductCodes = products
            .filter((p: { shipmentStatus: string | null }) => {
              console.log('Product shipmentStatus:', p.shipmentStatus);
              return p.shipmentStatus === 'Sorting';
            })
            .map((p: { productCode: string | null }) => p.productCode)
            .filter((code: string | null) => code && code.trim() !== ''); // Remove empty codes

          console.log('Filtered sorting products:', sortingProductCodes);

          // Get unique product codes
          const uniqueCodes: string[] = Array.from(
            new Set(sortingProductCodes)
          );

          console.log('Unique product codes:', uniqueCodes);
          setProductOptions(uniqueCodes);
        } else {
          console.error('Failed to load products, status:', response.status);
          setProductOptions([]);
          setAllProducts([]);
        }
      } catch (error) {
        console.error('Error loading product codes:', error);
        setProductOptions([]);
        setAllProducts([]);
      }
    };

    loadProductCodes();
  }, []);

  // Auto-populate quantity when product code is selected
  useEffect(() => {
    if (item && allProducts.length > 0) {
      // Find all products matching the selected product code
      const matchingProducts = allProducts.filter(
        (p: Product) => p.productCode === item
      );

      // Calculate total quantity for this product code
      const totalQuantity = matchingProducts.reduce(
        (sum: number, p: Product) => sum + (p.quantity || 0),
        0
      );

      console.log(`Total quantity for ${item}:`, totalQuantity);
      setOrdered(totalQuantity.toString());
    } else if (!item) {
      // Clear quantity when product is deselected
      setOrdered('');
    }
  }, [item, allProducts]);

  // Auto-populate Total Order from transactions table when product code is selected
  useEffect(() => {
    const loadTotalOrderFromTransactions = async () => {
      if (item) {
        try {
          const response = await fetch('/api/transactions');

          if (response.ok) {
            const transactions = await response.json();

            // Filter transactions matching the selected product code and sum quantities
            const totalOrderQty = transactions
              .filter(
                (t: { 'Product Code': string }) => t['Product Code'] === item
              )
              .reduce(
                (sum: number, t: { Quantity: number | null }) =>
                  sum + (t.Quantity || 0),
                0
              );

            // Count the number of customers (transactions) with this product
            const customersCount = transactions.filter(
              (t: { 'Product Code': string }) => t['Product Code'] === item
            ).length;

            console.log(
              `Total order quantity for ${item} from transactions:`,
              totalOrderQty
            );
            console.log(`Total customers for ${item}:`, customersCount);
            setTotalReservation(totalOrderQty);
            setTotalCustomers(customersCount);
          } else {
            console.error('Failed to load transactions');
            setTotalReservation(0);
            setTotalCustomers(0);
          }
        } catch (error) {
          console.error('Error loading total order from transactions:', error);
          setTotalReservation(0);
          setTotalCustomers(0);
        }
      } else {
        // Clear total order when product is deselected
        setTotalReservation(0);
        setTotalCustomers(0);
      }
    };

    loadTotalOrderFromTransactions();
  }, [item]);

  // Initialize 100 rows with default values
  const [rows, setRows] = useState<DistributionRow[]>(() => {
    return Array.from({ length: 100 }, () => ({
      quantity: 0,
      percentage: 0,
      groupNumber: '',
      distribution: 0,
      checked: false,
    }));
  });

  // Auto-populate Est. Qty. Received from sum of Quantity column in the table
  useEffect(() => {
    const totalQuantity = rows.reduce(
      (sum, row) => sum + (row.quantity || 0),
      0
    );
    setEstQtyReceived(totalQuantity);
  }, [rows]);

  // Auto-populate Available Stock as Est. Qty. Received - Total Order
  useEffect(() => {
    const available = estQtyReceived - totalReservation;
    setAvailableStock(available);
  }, [estQtyReceived, totalReservation]);

  // Inject styles only on client side to prevent hydration errors
  React.useEffect(() => {
    setIsMounted(true);

    // Inject custom styles
    const styleId = 'sorting-distribution-custom-styles';
    if (!document.getElementById(styleId)) {
      const styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.textContent = customGridStyles;
      document.head.appendChild(styleElement);
    }

    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, []);

  // Keep grid height at ~85vh responsively
  React.useEffect(() => {
    const updateHeight = () => {
      const h = Math.floor(window.innerHeight * 0.85);
      setGridHeight(Math.max(300, h));
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // 🚀 Auto-populate Group Number based on non-empty Quantity rows
  const quantitiesString = useMemo(
    () => rows.map((r) => r.quantity).join(','),
    [rows]
  );

  React.useEffect(() => {
    setRows((prevRows) => {
      const newRows = [...prevRows];
      let counter = 1;

      // Calculate total sum of all quantities
      const totalQuantity = newRows.reduce(
        (sum, row) => sum + (row.quantity > 0 ? row.quantity : 0),
        0
      );

      // Iterate through all rows and assign group numbers to rows with quantity > 0
      for (let i = 0; i < newRows.length; i++) {
        if (newRows[i].quantity > 0) {
          // Calculate percentage: (quantity / total) * 100
          const percentage =
            totalQuantity > 0 ? (newRows[i].quantity / totalQuantity) * 100 : 0;

          newRows[i] = {
            ...newRows[i],
            groupNumber: `Number ${counter}`,
            percentage: percentage,
          };
          counter++;
        } else {
          // Clear group number and percentage if quantity is 0 or empty
          newRows[i] = {
            ...newRows[i],
            groupNumber: '',
            percentage: 0,
          };
        }
      }

      return newRows;
    });
  }, [quantitiesString]); // Re-run when any quantity changes

  // 🚀 PERFORMANCE: Memoize columns array to prevent recreation on every render
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Quantity', width: 200, id: 'quantity', grow: 1 },
      { title: 'Percentage', width: 200, id: 'percentage', grow: 1 },
      { title: 'Group Number', width: 200, id: 'groupNumber', grow: 1 },
      { title: 'Distribution', width: 200, id: 'distribution', grow: 1 },
      { title: 'Checkbox', width: 200, id: 'checkbox', grow: 1 },
    ],
    []
  );

  // Get cell content
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const rowData = rows[row];

      if (!rowData) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      const column = columns[col];

      // Determine if row should be greyed out (checkbox is checked)
      const isGreyedOut = rowData.checked;
      const greyTheme = isGreyedOut
        ? {
            bgCell: '#e9ecef',
            fgCell: '#868e96',
          }
        : undefined;

      switch (column.id) {
        case 'quantity':
          return {
            kind: GridCellKind.Number,
            data: rowData.quantity,
            displayData: rowData.quantity.toString(),
            allowOverlay: true,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'percentage':
          return {
            kind: GridCellKind.Number,
            data: rowData.percentage,
            displayData: rowData.percentage.toFixed(2) + '%',
            allowOverlay: false,
            readonly: true, // Will add formula later
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'groupNumber':
          return {
            kind: GridCellKind.Text,
            data: rowData.groupNumber,
            displayData: rowData.groupNumber,
            allowOverlay: false,
            readonly: true, // Auto-populated based on Quantity
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'distribution':
          return {
            kind: GridCellKind.Number,
            data: rowData.distribution,
            displayData: rowData.distribution.toString(),
            allowOverlay: false,
            readonly: true, // Will add formula later
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'checkbox':
          return {
            kind: GridCellKind.Boolean,
            data: rowData.checked,
            allowOverlay: false,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        default:
          return {
            kind: GridCellKind.Text,
            data: '',
            displayData: '',
            allowOverlay: false,
          };
      }
    },
    [rows, columns]
  );

  // Handle cell edits
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [col, row] = cell;
      const column = columns[col];

      setRows((prevRows) => {
        const newRows = [...prevRows];
        const rowData = { ...newRows[row] };

        switch (column.id) {
          case 'quantity':
            if (newValue.kind === GridCellKind.Number) {
              rowData.quantity = newValue.data ?? 0;
            }
            break;

          case 'checkbox':
            if (newValue.kind === GridCellKind.Boolean) {
              rowData.checked = newValue.data ?? false;
            }
            break;

          default:
            break;
        }

        newRows[row] = rowData;
        return newRows;
      });
    },
    [columns]
  );

  // Get row count
  const getRowCount = useCallback(() => rows.length, [rows]);

  // Handle spacebar to toggle all checkboxes
  // This will work when the user presses spacebar anywhere in the grid
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' && event.target instanceof HTMLElement) {
        // Check if the target is within the data-grid-container
        const isInGrid = event.target.closest('.data-grid-container');
        if (isInGrid) {
          event.preventDefault();

          // Determine if we should check or uncheck all
          // If any checkbox is unchecked, check all. If all are checked, uncheck all.
          setRows((prevRows) => {
            const hasUnchecked = prevRows.some((row) => !row.checked);
            const newCheckedState = hasUnchecked;

            return prevRows.map((row) => ({
              ...row,
              checked: newCheckedState,
            }));
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Custom header drawing for center alignment
  const drawHeader = useCallback(
    (args: {
      ctx: CanvasRenderingContext2D;
      rect: { x: number; y: number; width: number; height: number };
      column: GridColumn;
    }) => {
      const { ctx, rect, column } = args;

      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

      ctx.fillStyle = '#000000';
      ctx.font = '600 20px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const centerX = rect.x + rect.width / 2;
      const centerY = rect.y + rect.height / 2;

      ctx.fillText(column.title, centerX, centerY);

      return true;
    },
    []
  );

  return (
    <PageLayout fluid withPadding>
      <Stack gap="md">
        {/* Information Section */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Grid gutter="md">
            {/* Left Column */}
            <Grid.Col span={6}>
              <Stack gap="xs">
                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                    Product Code
                  </Text>
                  <Select
                    value={item}
                    onChange={(value) => setItem(value || '')}
                    data={productOptions}
                    placeholder="Select a product..."
                    searchable
                    clearable
                    style={{ flex: 1 }}
                  />
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                    Quantity
                  </Text>
                  <Text
                    size="sm"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                    }}
                  >
                    {ordered || ''}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                    Est. Qty. Received
                  </Text>
                  <Text
                    size="sm"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                    }}
                  >
                    {estQtyReceived || 0}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                    Total Order
                  </Text>
                  <Text
                    size="sm"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                    }}
                  >
                    {totalReservation || 0}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '140px' }}>
                    Available Stock
                  </Text>
                  <Text
                    size="sm"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '4px',
                    }}
                  >
                    {availableStock || 0}
                  </Text>
                </Group>
              </Stack>
            </Grid.Col>

            {/* Right Column */}
            <Grid.Col span={6}>
              <Stack gap="xs" align="flex-end">
                <Group gap="xs" justify="flex-end">
                  <Text size="sm" fw={500}>
                    Total Customers
                  </Text>
                  <Text
                    size="sm"
                    fw={600}
                    style={{
                      minWidth: '100px',
                      textAlign: 'right',
                      padding: '8px 12px',
                      backgroundColor: '#f1f3f5',
                      borderRadius: '4px',
                    }}
                  >
                    {totalCustomers}
                  </Text>
                </Group>

                <Group gap="xs" justify="flex-end">
                  <Text
                    size="sm"
                    fw={500}
                    style={{ minWidth: '240px', textAlign: 'right' }}
                  >
                    Customer With This Order Quantity
                  </Text>
                  <TextInput
                    type="number"
                    value={customerWithOrderQty}
                    onChange={(e) =>
                      setCustomerWithOrderQty(Number(e.currentTarget.value))
                    }
                    placeholder="0"
                    style={{ width: '100px' }}
                    styles={{
                      input: {
                        textAlign: 'right',
                        fontWeight: 600,
                        borderBottom: '2px solid #228be6',
                      },
                    }}
                  />
                </Group>
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Data Grid */}
        {isMounted && (
          <div
            className="data-grid-container"
            style={{ height: `${gridHeight}px` }}
            tabIndex={0}
          >
            <DataEditor
              columns={columns}
              rows={getRowCount()}
              getCellContent={getData}
              onCellEdited={onCellEdited}
              drawHeader={drawHeader}
              smoothScrollX={true}
              smoothScrollY={true}
              rowHeight={35}
              headerHeight={40}
              rowMarkers="number"
              theme={{
                accentColor: '#228be6',
                accentLight: '#e7f5ff',
                textDark: '#000000',
                textMedium: '#495057',
                textLight: '#868e96',
                textBubble: '#000000',
                bgIconHeader: '#f8f9fa',
                fgIconHeader: '#495057',
                bgCell: '#ffffff',
                bgCellMedium: '#f8f9fa',
                bgHeader: '#f8f9fa',
                bgHeaderHasFocus: '#e9ecef',
                bgHeaderHovered: '#e9ecef',
                borderColor: '#dee2e6',
                fontFamily: 'Inter, sans-serif',
              }}
            />
          </div>
        )}
      </Stack>
    </PageLayout>
  );
}
