'use client';

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { GridView } from '../../../../components/grid';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  GridCellKind,
  GridColumn,
  Item,
  type GridCell,
  type EditableGridCell,
  type GridSelection,
} from '@glideapps/glide-data-grid';
import { Stack, Card, Grid, Text, Group, Select, Button } from '@mantine/core';

// Import Glide Data Grid CSS
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
  const [isMounted, setIsMounted] = useState(false);

  // Information fields state
  const [item, setItem] = useState<string>('');
  const [ordered, setOrdered] = useState<string>('');
  const [estQtyReceived, setEstQtyReceived] = useState<number>(0);
  const [totalReservation, setTotalReservation] = useState<number>(0);
  const [availableStock, setAvailableStock] = useState<number>(0);
  const [totalCustomers, setTotalCustomers] = useState<number>(0);
  const [customerWithOrderQty, setCustomerWithOrderQty] = useState<number>(0);

  // Unique quantities for pill buttons
  const [uniqueQuantities, setUniqueQuantities] = useState<number[]>([]);
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null);

  // Grid selection
  const [gridSelection, setGridSelection] = useState<
    GridSelection | undefined
  >();

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

  // Product options from products table (filtered by "Sorting" shipment status)
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  // Ref for debouncing save operations
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

            // Filter transactions matching the selected product code
            const matchingTransactions = transactions.filter(
              (t: { 'Product Code': string }) => t['Product Code'] === item
            );

            // Sum quantities for total order
            const totalOrderQty = matchingTransactions.reduce(
              (sum: number, t: { Quantity: number | null }) =>
                sum + (t.Quantity || 0),
              0
            );

            // Count the number of customers (transactions) with this product
            const customersCount = matchingTransactions.length;

            // Extract unique quantities for pill buttons
            const quantities: number[] = matchingTransactions
              .map((t: { Quantity: number | null }) => t.Quantity || 0)
              .filter((qty: number) => qty > 0); // Only positive quantities
            const uniqueQtys: number[] = Array.from(new Set(quantities)).sort(
              (a: number, b: number) => a - b
            );

            console.log(
              `Total order quantity for ${item} from transactions:`,
              totalOrderQty
            );
            console.log(`Total customers for ${item}:`, customersCount);
            console.log(`Unique quantities for ${item}:`, uniqueQtys);

            setTotalReservation(totalOrderQty);
            setTotalCustomers(customersCount);
            setUniqueQuantities(uniqueQtys);
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
        setUniqueQuantities([]);
        setSelectedQuantity(null);
      }
    };

    loadTotalOrderFromTransactions();
  }, [item]);

  // Count unique customers with the selected order quantity
  useEffect(() => {
    const countCustomersWithQuantity = async () => {
      if (item && selectedQuantity !== null) {
        try {
          const response = await fetch('/api/transactions');

          if (response.ok) {
            const transactions = await response.json();

            console.log('All transactions:', transactions.length);
            console.log('Looking for product:', item);
            console.log('Looking for quantity:', selectedQuantity);
            console.log('Sample transaction structure:', transactions[0]);

            // Filter transactions matching both the product code AND the selected quantity
            const matchingTransactions = transactions.filter(
              (t: { 'Product Code': string; Quantity: number | null }) =>
                t['Product Code'] === item && t.Quantity === selectedQuantity
            );

            console.log('Matching transactions:', matchingTransactions);
            console.log(
              'Matching transactions count:',
              matchingTransactions.length
            );
            console.log('First matching transaction:', matchingTransactions[0]);

            // Count unique customers - using Customers field from transactions (note: plural)
            const uniqueCustomers = new Set(
              matchingTransactions.map(
                (t: { Customers: string }) => t.Customers
              )
            );
            const uniqueCustomersCount = uniqueCustomers.size;

            console.log('Unique customers:', Array.from(uniqueCustomers));
            console.log(
              `Customers with quantity ${selectedQuantity} for ${item}:`,
              uniqueCustomersCount
            );

            setCustomerWithOrderQty(uniqueCustomersCount);
          } else {
            console.error('Failed to load transactions');
            setCustomerWithOrderQty(0);
          }
        } catch (error) {
          console.error('Error loading customers with order quantity:', error);
          setCustomerWithOrderQty(0);
        }
      } else {
        // Clear customer count when product is deselected or no quantity is selected
        setCustomerWithOrderQty(0);
      }
    };

    countCustomersWithQuantity();
  }, [item, selectedQuantity]);

  // Load saved data when product is selected
  useEffect(() => {
    const loadSavedData = async () => {
      if (!item) {
        console.log('🔄 LOAD - No product selected, skipping load');
        return;
      }

      console.log('🔄 LOAD - Starting load for product:', item);

      try {
        const url = `/api/sorting-distribution?productCode=${encodeURIComponent(item)}`;
        console.log('🔄 LOAD - Fetching from:', url);

        const response = await fetch(url);
        console.log('🔄 LOAD - Response status:', response.status);

        if (response.ok) {
          const { data, selectedQuantity: savedSelectedQty } =
            await response.json();

          console.log('🔄 LOAD - Received data:', data.length, 'rows');
          console.log('🔄 LOAD - Saved selected quantity:', savedSelectedQty);
          console.log('🔄 LOAD - Sample data:', data.slice(0, 3));

          if (data.length > 0) {
            // Restore rows from database (note: database uses snake_case field names)
            const restoredRows = Array.from({ length: 100 }, (_, i) => {
              const savedRow = data.find(
                (d: {
                  row_number: number;
                  quantity: number;
                  percentage: number;
                  group_number: string;
                  distribution: number;
                  checked: boolean;
                }) => d.row_number === i + 1
              );
              return savedRow
                ? {
                    quantity: savedRow.quantity,
                    percentage: savedRow.percentage,
                    groupNumber: savedRow.group_number,
                    distribution: savedRow.distribution,
                    checked: savedRow.checked,
                  }
                : {
                    quantity: 0,
                    percentage: 0,
                    groupNumber: '',
                    distribution: 0,
                    checked: false,
                  };
            });

            console.log(
              '🔄 LOAD - Restoring',
              restoredRows.filter((r) => r.quantity > 0).length,
              'non-empty rows'
            );
            setRows(restoredRows);

            // Restore selected quantity button
            if (savedSelectedQty !== null && savedSelectedQty !== undefined) {
              console.log(
                '🔄 LOAD - Restoring selected quantity:',
                savedSelectedQty
              );
              setSelectedQuantity(savedSelectedQty);
            }

            console.log('✅ LOAD - Data restoration completed');
          } else {
            console.log('🔄 LOAD - No saved data found, using defaults');
          }
        } else {
          console.log('❌ LOAD - Response not ok:', response.status);
        }
      } catch (error) {
        console.error('❌ LOAD - Error loading saved data:', error);
      }
    };

    loadSavedData();
  }, [item]); // Only run when product changes

  // Auto-save data when rows or selectedQuantity changes
  useEffect(() => {
    if (!item) {
      console.log('💾 SAVE - No product selected, skipping save');
      return;
    }

    console.log('💾 SAVE - Change detected, scheduling save for:', item);
    console.log('💾 SAVE - Selected quantity:', selectedQuantity);
    console.log(
      '💾 SAVE - Non-empty rows:',
      rows.filter((r) => r.quantity > 0 || r.groupNumber || r.checked).length
    );

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      console.log('💾 SAVE - Clearing previous timeout');
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('💾 SAVE - Starting auto-save...');
        console.log('💾 SAVE - Product:', item);
        console.log('💾 SAVE - Selected quantity:', selectedQuantity);
        console.log('💾 SAVE - Total rows:', rows.length);

        const nonEmptyRows = rows.filter(
          (r) =>
            r.quantity > 0 ||
            r.percentage > 0 ||
            r.groupNumber ||
            r.distribution > 0 ||
            r.checked
        );
        console.log('💾 SAVE - Non-empty rows to save:', nonEmptyRows.length);
        console.log(
          '💾 SAVE - Sample non-empty rows:',
          nonEmptyRows.slice(0, 3)
        );

        const payload = {
          productCode: item,
          selectedQuantity,
          rows,
        };

        console.log('💾 SAVE - Sending payload to API...');
        const response = await fetch('/api/sorting-distribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        console.log('💾 SAVE - Response status:', response.status);

        if (response.ok) {
          const result = await response.json();
          console.log('✅ SAVE - Data saved successfully:', result);
        } else {
          const errorText = await response.text();
          console.error(
            '❌ SAVE - Failed to save data:',
            response.status,
            errorText
          );
        }
      } catch (error) {
        console.error('❌ SAVE - Error saving data:', error);
      }
    }, 1000);

    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [rows, selectedQuantity, item]);

  // Calculate total distribution sum
  const totalDistribution = useMemo(() => {
    return rows.reduce((sum, row) => sum + (row.distribution || 0), 0);
  }, [rows]);

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

          // Calculate distribution: (Quantity / Est. Qty. Received) * Selected Pill Button
          const distribution =
            estQtyReceived > 0 && selectedQuantity !== null
              ? (newRows[i].quantity / estQtyReceived) * selectedQuantity
              : 0;

          newRows[i] = {
            ...newRows[i],
            groupNumber: `Number ${counter}`,
            percentage: percentage,
            distribution: Math.round(distribution), // Round to whole number
          };
          counter++;
        } else {
          // Clear group number, percentage, and distribution if quantity is 0 or empty
          newRows[i] = {
            ...newRows[i],
            groupNumber: '',
            percentage: 0,
            distribution: 0,
          };
        }
      }

      return newRows;
    });
  }, [quantitiesString, estQtyReceived, selectedQuantity]); // Re-run when any quantity changes, est qty received, or selected quantity changes

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
            displayData:
              rowData.quantity === 0 ? '' : rowData.quantity.toString(),
            allowOverlay: true,
            readonly: false,
            contentAlign: 'center',
            themeOverride: greyTheme,
          };

        case 'percentage':
          return {
            kind: GridCellKind.Number,
            data: rowData.percentage,
            displayData:
              rowData.percentage === 0
                ? ''
                : rowData.percentage.toFixed(2) + '%',
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
            displayData:
              rowData.distribution === 0 ? '' : rowData.distribution.toString(),
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

  // Handle header menu clicks (right-click on header)
  const handleHeaderMenuClick = useCallback(
    (col: number) => {
      const column = columns[col];

      // Only allow clearing the Quantity column for now
      if (column.id === 'quantity') {
        const confirmClear = window.confirm(
          `Are you sure you want to clear all values in the "${column.title}" column?`
        );

        if (confirmClear) {
          setRows((prevRows) =>
            prevRows.map((row) => ({
              ...row,
              quantity: 0,
            }))
          );
          console.log(`Cleared all values in ${column.title} column`);
        }
      } else {
        // For other columns, show a message that they can't be cleared
        alert(
          `The "${column.title}" column cannot be manually cleared as it contains calculated values.`
        );
      }

      return undefined; // Don't show the default menu
    },
    [columns]
  );

  // Handle paste event from grid
  const handlePasteEvent = useCallback(
    (target: Item, values: readonly (readonly string[])[]) => {
      const [col, row] = target;

      // Only allow pasting to Quantity column (index 0)
      if (col !== 0) {
        return false;
      }

      setRows((prevRows) => {
        const newRows = [...prevRows];

        values.forEach((rowData, rowOffset) => {
          const targetRow = row + rowOffset;
          if (targetRow < newRows.length && rowData.length > 0) {
            const pastedValue = parseFloat(rowData[0]) || 0;
            newRows[targetRow] = {
              ...newRows[targetRow],
              quantity: pastedValue,
            };
          }
        });

        console.log(
          `Pasted ${values.length} values starting at row ${row + 1}`
        );
        return newRows;
      });

      return true; // Indicate we handled the paste
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
              <Stack gap="xs">
                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '240px' }}>
                    Total Customers
                  </Text>
                  <Text
                    size="sm"
                    fw={600}
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      padding: '8px 12px',
                      backgroundColor: '#f1f3f5',
                      borderRadius: '4px',
                    }}
                  >
                    {totalCustomers}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '240px' }}>
                    Total Distribution
                  </Text>
                  <Text
                    size="sm"
                    fw={600}
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      padding: '8px 12px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      color: '#1976d2',
                      border: '1px solid #bbdefb',
                    }}
                  >
                    {totalDistribution}
                  </Text>
                </Group>

                <Group gap="xs">
                  <Text size="sm" fw={500} style={{ minWidth: '240px' }}>
                    Customer With This Order Quantity
                  </Text>
                  <Text
                    size="sm"
                    fw={600}
                    style={{
                      flex: 1,
                      textAlign: 'right',
                      padding: '8px 12px',
                      backgroundColor: '#f1f3f5',
                      borderRadius: '4px',
                    }}
                  >
                    {customerWithOrderQty}
                  </Text>
                </Group>

                {/* Pill Buttons for Unique Quantities */}
                {uniqueQuantities.length > 0 && (
                  <Group gap="xs" align="center">
                    <Text size="sm" fw={500} style={{ minWidth: '240px' }}>
                      Order Quantities:
                    </Text>
                    <Group gap="xs">
                      {uniqueQuantities.map((qty) => {
                        const isSelected = selectedQuantity === qty;
                        return (
                          <Button
                            key={qty}
                            variant={isSelected ? 'filled' : 'outline'}
                            size="xs"
                            radius="xl"
                            color={isSelected ? 'blue' : 'gray'}
                            style={{
                              fontWeight: 500,
                              opacity: isSelected ? 1 : 0.6,
                              cursor: 'pointer',
                              width: '50px',
                              minWidth: '50px',
                              padding: '0',
                            }}
                            onClick={() => {
                              // Toggle selection: if already selected, deselect; otherwise select
                              setSelectedQuantity(isSelected ? null : qty);
                              console.log(
                                `Selected quantity: ${isSelected ? 'none' : qty}`
                              );
                            }}
                          >
                            {qty}
                          </Button>
                        );
                      })}
                    </Group>
                  </Group>
                )}
              </Stack>
            </Grid.Col>
          </Grid>

          {/* Distribution Warning/Status - Centered and Prominent */}
          {selectedQuantity !== null && (
            <div
              style={{
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text
                size="md"
                fw={600}
                style={{
                  textAlign: 'center',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  backgroundColor:
                    totalDistribution === selectedQuantity
                      ? '#e8f5e9' // Green background for perfect match
                      : totalDistribution < selectedQuantity
                        ? '#fff3e0' // Orange background for under-distribution
                        : '#ffebee', // Red background for over-distribution
                  color:
                    totalDistribution === selectedQuantity
                      ? '#2e7d32' // Dark green text
                      : totalDistribution < selectedQuantity
                        ? '#e65100' // Dark orange text
                        : '#c62828', // Dark red text
                  border:
                    totalDistribution === selectedQuantity
                      ? '2px solid #4caf50'
                      : totalDistribution < selectedQuantity
                        ? '2px solid #ff9800'
                        : '2px solid #f44336',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  fontSize: '16px',
                }}
              >
                {totalDistribution === selectedQuantity
                  ? '✓ Perfect match!'
                  : totalDistribution < selectedQuantity
                    ? `⚠ Need ${
                        selectedQuantity - totalDistribution
                      } more to reach order quantity of ${selectedQuantity}`
                    : `⚠ Over-distributed by ${
                        totalDistribution - selectedQuantity
                      } (Order quantity: ${selectedQuantity})`}
              </Text>
            </div>
          )}
        </Card>

        {/* Data Grid */}
        {isMounted && (
          <div
            className="data-grid-container"
            style={{
              height: '75vh',
              width: '100%',
              backgroundColor: 'white',
              borderRadius: '8px',
              border: '1px solid #dee2e6',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
            }}
            tabIndex={0}
          >
            <GridView
              columns={columns}
              rows={getRowCount()}
              getCellContent={getData}
              onCellEdited={onCellEdited}
              drawHeader={drawHeader}
              onHeaderMenuClick={handleHeaderMenuClick}
              gridSelection={gridSelection}
              onGridSelectionChange={setGridSelection}
              getCellsForSelection={true}
              onPaste={handlePasteEvent}
              keybindings={{
                copy: true,
                paste: true,
                selectAll: true,
                selectRow: true,
                selectColumn: true,
              }}
              smoothScrollX={true}
              smoothScrollY={true}
              rowHeight={35}
              headerHeight={40}
              rowMarkers="number"
              width="100%"
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
