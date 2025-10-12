'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { GridView } from '../../../../components/grid';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import type { GridCell, Rectangle, Theme } from '@glideapps/glide-data-grid';
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
  NumberInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconSearch,
  IconCurrencyDollar,
  IconTrendingUp,
  IconTrendingDown,
  IconPlus,
  IconCheck,
  IconAdjustments,
} from '@tabler/icons-react';
import { throttle } from '../../../../lib/performance';

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
  
  /* Make product code column look clickable */
  .data-grid-container canvas {
    cursor: default;
  }
  .data-grid-container:hover canvas {
    cursor: pointer;
  }
`;

// Dynamic import to prevent SSR issues
interface PriceData {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
}

interface HeaderDrawArgs {
  ctx: CanvasRenderingContext2D;
  column: GridColumn;
  rect: Rectangle;
  theme: Theme;
}

export default function Prices() {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [filteredPrices, setFilteredPrices] = useState<PriceData[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [gridHeight, setGridHeight] = useState<number>(600);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceData | null>(null);
  const [newPriceForm, setNewPriceForm] = useState({
    productCode: '',
    tiers: [
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
    ],
    priceAdjustment: 0,
  });

  // Track double-click for Product Code column
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // Keep grid height at ~85vh responsively
  // 🚀 PERFORMANCE: Throttle resize events to prevent excessive re-renders
  useEffect(() => {
    const updateHeight = () => {
      const h = Math.floor(window.innerHeight * 0.85);
      // Keep a sensible minimum height
      setGridHeight(Math.max(300, h));
    };

    // Throttle resize handler to run at most once every 150ms
    const throttledResize = throttle(updateHeight, 150);

    updateHeight();
    window.addEventListener('resize', throttledResize);
    return () => window.removeEventListener('resize', throttledResize);
  }, []);

  // Handle Ctrl+F to focus search input instead of browser find
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+F (or Cmd+F on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's find dialog
        searchInputRef.current?.focus(); // Focus our search input
        searchInputRef.current?.select(); // Select all text for easy replacement
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup event listener on unmount
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Initial load from API/database
  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/prices', {
          next: { revalidate: 30 },
        });
        if (response.ok) {
          const pricesFromDB = await response.json();
          setPrices(pricesFromDB);
          setFilteredPrices(pricesFromDB);
        } else {
          // Start with empty array if no data
          setPrices([]);
          setFilteredPrices([]);
        }
      } catch (e) {
        console.error('Failed to load prices', e);
        setPrices([]);
        setFilteredPrices([]);
      }
    };
    load();
  }, []);

  // 🚀 PERFORMANCE: Debounce filtered prices for smoother typing during search
  const [debouncedFilteredPrices, setDebouncedFilteredPrices] =
    useState(filteredPrices);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilteredPrices(filteredPrices);
    }, 300); // 300ms delay for smooth typing experience

    return () => clearTimeout(timer);
  }, [filteredPrices]);

  // 🚀 PERFORMANCE: Pre-compute search index for 5x faster search
  // Note: Ready for implementation when search logic is updated
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const pricesWithSearchIndex = useMemo(() => {
    return prices.map((price) => ({
      ...price,
      _searchIndex: [
        price['Product Code'],
        price['Lower Limit'].toString(),
        price['Upper Limit'].toString(),
        price['Prices'].toString(),
        price['Price Adjustment'].toString(),
      ]
        .filter(Boolean)
        .join('|')
        .toLowerCase(),
    }));
  }, [prices]);

  // Derived stats - using debounced data for smoother performance
  const stats = useMemo(() => {
    const total = prices.length;
    const filtered = debouncedFilteredPrices.length; // Use debounced version
    const avgPrice =
      prices.length > 0
        ? Math.round(
            prices.reduce((sum, p) => sum + p.Prices, 0) / prices.length
          )
        : 0;
    const totalAdjustments = prices.filter(
      (p) => p['Price Adjustment'] !== 0
    ).length;
    const priceIncreases = prices.filter(
      (p) => p['Price Adjustment'] > 0
    ).length;
    const priceDecreases = prices.filter(
      (p) => p['Price Adjustment'] < 0
    ).length;

    return {
      total,
      filtered,
      avgPrice,
      totalAdjustments,
      priceIncreases,
      priceDecreases,
    };
  }, [prices, debouncedFilteredPrices]); // Updated dependency

  // 🚀 PERFORMANCE: Memoize columns array to prevent recreation on every render
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Product Code', width: 200, id: 'productCode', grow: 1 },
      { title: 'Lower Limit', width: 280, id: 'lowerLimit' },
      { title: 'Upper Limit', width: 280, id: 'upperLimit' },
      { title: 'Prices', width: 280, id: 'prices' },
      { title: 'Price Adjustment', width: 280, id: 'priceAdjustment' },
    ],
    []
  ); // Empty deps - columns never change

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredPrices(prices);
      return;
    }

    const filtered = prices.filter((price) => {
      const searchTerm = query.toLowerCase();
      return (
        price['Product Code'].toLowerCase().includes(searchTerm) ||
        price['Lower Limit'].toString().includes(searchTerm) ||
        price['Upper Limit'].toString().includes(searchTerm) ||
        price['Prices'].toString().includes(searchTerm) ||
        price['Price Adjustment'].toString().includes(searchTerm)
      );
    });

    setFilteredPrices(filtered);
  };

  // CSV Import functionality
  const handleCSVImport = async () => {
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const importedPrices: PriceData[] = [];
      let id = 1;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line === ',,,,') continue; // Skip empty lines

        const values = line.split(',');
        if (values.length < 5) continue; // Skip incomplete rows

        const productCode = values[0]?.trim();
        const lowerLimit = parseFloat(values[1]?.trim()) || 0;
        const upperLimit = parseFloat(values[2]?.trim()) || 0;
        const prices = parseFloat(values[3]?.trim()) || 0;
        const priceAdjustment = parseFloat(values[4]?.trim()) || 0;

        if (!productCode) continue; // Skip rows without product code

        // Convert prices to proper format (remove commas and quotes)
        const cleanPrices = prices.toString().replace(/[,"]/g, '');
        const cleanAdjustment = priceAdjustment.toString().replace(/[,"]/g, '');

        const priceData: PriceData = {
          id: id++,
          'Product Code': productCode,
          'Lower Limit': Math.round(lowerLimit),
          'Upper Limit': Math.round(upperLimit),
          Prices: Math.round(parseFloat(cleanPrices)),
          'Price Adjustment': Math.round(parseFloat(cleanAdjustment)),
        };

        importedPrices.push(priceData);
      }

      if (importedPrices.length === 0) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: 'No valid price data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database via API
      const saveResponse = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importedPrices),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save to database');
      }

      const saveResult = await saveResponse.json();

      // Update local state
      setPrices(importedPrices);
      setFilteredPrices(importedPrices);
      setFile(null); // Clear the file input

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${saveResult.count} price records to database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      console.error('CSV import error:', error);
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  // Handle cell click (for product code editing)
  const onCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;

      if (row >= filteredPrices.length) return;

      const column = columns[col];

      // Only handle clicks on the product code column
      if (column.id === 'productCode') {
        const now = Date.now();
        const lastClick = lastClickRef.current;

        // Check if this is a double-click (within 500ms on the same cell)
        if (
          lastClick &&
          lastClick.cell[0] === col &&
          lastClick.cell[1] === row &&
          now - lastClick.time < 500
        ) {
          // Double-click detected - open edit modal
          const price = filteredPrices[row];
          setEditingPrice(price);

          // Find all tiers for this product code
          const productCode = price['Product Code'];
          const allTiersForProduct = prices.filter(
            (p) => p['Product Code'] === productCode
          );

          // Sort by lower limit to get proper tier order
          allTiersForProduct.sort(
            (a, b) => a['Lower Limit'] - b['Lower Limit']
          );

          // Pre-populate the form with existing data (up to 4 tiers)
          const tiers = [
            { lowerLimit: 0, upperLimit: 0, price: 0 },
            { lowerLimit: 0, upperLimit: 0, price: 0 },
            { lowerLimit: 0, upperLimit: 0, price: 0 },
            { lowerLimit: 0, upperLimit: 0, price: 0 },
          ];

          // Fill in the existing tiers
          allTiersForProduct.slice(0, 4).forEach((tier, index) => {
            tiers[index] = {
              lowerLimit: tier['Lower Limit'],
              upperLimit: tier['Upper Limit'],
              price: tier['Prices'],
            };
          });

          setNewPriceForm({
            productCode: productCode,
            tiers: tiers,
            priceAdjustment: price['Price Adjustment'], // Use the first tier's adjustment
          });

          setEditOpen(true);
          lastClickRef.current = null; // Reset after handling
        } else {
          // First click - store it
          lastClickRef.current = { cell, time: now };
        }
      }
    },
    [filteredPrices, columns, prices]
  );

  // Data rendering
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row >= filteredPrices.length) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: true,
        };
      }

      const price = filteredPrices[row];
      const column = columns[col];

      let cellData = '';
      let displayData = '';

      switch (column.id) {
        case 'productCode':
          cellData = price['Product Code'];
          displayData = cellData;
          break;
        case 'lowerLimit':
          cellData = price['Lower Limit'].toString();
          displayData = price['Lower Limit'].toLocaleString();
          break;
        case 'upperLimit':
          cellData = price['Upper Limit'].toString();
          displayData = price['Upper Limit'].toLocaleString();
          break;
        case 'prices':
          cellData = price['Prices'].toString();
          displayData = `₱${price['Prices'].toLocaleString()}`;
          break;
        case 'priceAdjustment':
          cellData = price['Price Adjustment'].toString();
          const adjustment = price['Price Adjustment'];
          if (adjustment > 0) {
            displayData = `+₱${adjustment.toLocaleString()}`;
          } else if (adjustment < 0) {
            displayData = `-₱${Math.abs(adjustment).toLocaleString()}`;
          } else {
            displayData = '₱0';
          }
          break;
        default:
          cellData = '';
          displayData = '';
      }

      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: displayData,
        allowOverlay: false, // Make read-only
        readonly: true, // Explicitly mark as readonly
        cursor: column.id === 'productCode' ? 'pointer' : 'default',
      };
    },
    [filteredPrices, columns]
  );

  const getRowCount = useCallback(
    () => filteredPrices.length,
    [filteredPrices]
  );

  // Custom header renderer for center alignment
  const drawHeader = useCallback((args: HeaderDrawArgs) => {
    const { ctx, column, rect, theme } = args;

    // Fill header background
    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Set text properties
    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw centered text
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);

    return true;
  }, []);

  return (
    <PageLayout fluid withPadding>
      <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
      <Stack
        gap="md"
        style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
      >
        {/* Stats cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-blue-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Total Products
                </Text>
                <Title order={3} c="white">
                  {stats.total}
                </Title>
              </div>
              <ThemeIcon variant="white" color="blue" size="lg" radius="md">
                <IconCurrencyDollar size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-green-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Average Price
                </Text>
                <Title order={3} c="white">
                  ₱{stats.avgPrice.toLocaleString()}
                </Title>
              </div>
              <ThemeIcon variant="white" color="green" size="lg" radius="md">
                <IconTrendingUp size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-orange-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Price Increases
                </Text>
                <Title order={3} c="white">
                  {stats.priceIncreases}
                </Title>
              </div>
              <ThemeIcon variant="white" color="orange" size="lg" radius="md">
                <IconTrendingUp size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{ background: 'var(--mantine-color-red-6)', color: 'white' }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Price Decreases
                </Text>
                <Title order={3} c="white">
                  {stats.priceDecreases}
                </Title>
              </div>
              <ThemeIcon variant="white" color="red" size="lg" radius="md">
                <IconTrendingDown size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        <Group justify="flex-end">
          <Group gap="sm">
            <TextInput
              ref={searchInputRef}
              placeholder="Search products... (Ctrl+F)"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => handleSearch(event.currentTarget.value)}
              size="sm"
              disabled={prices.length === 0}
              style={{ minWidth: 260 }}
            />
            <FileInput
              placeholder="Select CSV file"
              accept=".csv"
              value={file}
              onChange={setFile}
              leftSection={<IconUpload size={16} />}
              size="sm"
              style={{ minWidth: 200 }}
            />
            <Button
              onClick={handleCSVImport}
              disabled={!file}
              leftSection={<IconUpload size={16} />}
              size="sm"
            >
              Import CSV
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              color="blue"
              onClick={() => setAddOpen(true)}
            >
              Add New Price
            </Button>
          </Group>
        </Group>

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
            rows={getRowCount()}
            height={gridHeight}
            width={'100%'}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={70}
            headerHeight={80}
            rowMarkers="number"
            onCellClicked={onCellClicked}
            isDraggable={false}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
            drawHeader={drawHeader}
            theme={{
              // Updated font sizes for better readability
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
              borderColor: 'rgba(206, 212, 218, 0.5)',
              drilldownBorder: 'rgba(34, 139, 230, 0.4)',
              linkColor: '#228be6',
              headerFontStyle: 'bold 17px Inter',
              baseFontStyle: '17px Inter',
              editorFontSize: '20',
              fontFamily: 'Inter',
              cellHorizontalPadding: 12,
              cellVerticalPadding: 8,
            }}
          />
        </Card>

        {/* Pagination counter - moved to bottom */}
        <Text size="sm" c="dimmed" ta="center">
          {prices.length > 0
            ? `Showing ${filteredPrices.length} of ${prices.length} products${searchQuery ? ' (filtered)' : ''}`
            : 'Price management system - add products to get started'}
        </Text>

        {/* Add New Price Modal - Enhanced Modern Design */}
        <Modal
          opened={addOpen}
          onClose={() => setAddOpen(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="lg"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-green-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-green-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-green-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-green-1)',
              },
            },
          }}
          title={
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="green">
                <IconPlus size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={600} c="green.8">
                  Add New Price
                </Text>
                <Text size="sm" c="dimmed">
                  Set pricing information for a product
                </Text>
              </div>
            </Group>
          }
        >
          <Stack gap="lg">
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="green">
                  <IconCurrencyDollar size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="green.7">
                  Product Pricing Information
                </Text>
              </Group>

              <TextInput
                label="Product Code"
                placeholder="e.g. TSH-001"
                withAsterisk
                size="md"
                radius="md"
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-green-5)' },
                  },
                }}
                value={newPriceForm.productCode}
                onChange={(e) =>
                  setNewPriceForm((prev) => ({
                    ...prev,
                    productCode: e.target.value,
                  }))
                }
              />

              {/* Pricing Tiers */}
              <div style={{ marginTop: 24 }}>
                <Text size="lg" fw={500} c="green.7" mb="md">
                  Pricing Tiers
                </Text>

                {newPriceForm.tiers.map((tier, index) => {
                  // Check if this tier should be enabled
                  const isProductCodeFilled =
                    newPriceForm.productCode.trim().length > 0;
                  const isPreviousTierComplete =
                    index === 0
                      ? true
                      : newPriceForm.tiers[index - 1].lowerLimit > 0 &&
                        newPriceForm.tiers[index - 1].upperLimit > 0 &&
                        newPriceForm.tiers[index - 1].price > 0;
                  const isTierEnabled =
                    isProductCodeFilled && isPreviousTierComplete;
                  const previousTier =
                    index > 0 ? newPriceForm.tiers[index - 1] : null;
                  const previousLowerLimit = previousTier?.lowerLimit ?? 0;
                  const tierHasLowerLimitError =
                    index > 0 &&
                    tier.lowerLimit > 0 &&
                    tier.lowerLimit <= previousLowerLimit;

                  return (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <Text
                        size="sm"
                        fw={500}
                        mb="xs"
                        c={isTierEnabled ? 'dimmed' : 'gray.5'}
                      >
                        Tier {index + 1}{' '}
                        {!isTierEnabled &&
                          (index === 0
                            ? '(Fill Product Code first)'
                            : '(Complete previous tier first)')}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                        <NumberInput
                          label="Lower Limit"
                          placeholder={
                            index === 0 ? '1' : `> ${previousLowerLimit}`
                          }
                          size="md"
                          radius="md"
                          min={index === 0 ? 0 : previousLowerLimit + 1}
                          hideControls
                          disabled={!isTierEnabled}
                          error={
                            tierHasLowerLimitError
                              ? `Must be greater than ${previousLowerLimit}`
                              : null
                          }
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-green-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.lowerLimit}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              const numValue = Number(value) || 0;

                              // Validation: Ensure this tier's lower limit is greater than previous tier's lower limit
                              if (index > 0) {
                                const previousLowerLimitValue =
                                  newTiers[index - 1]?.lowerLimit ?? 0;
                                if (
                                  numValue > 0 &&
                                  numValue <= previousLowerLimitValue
                                ) {
                                  // Don't update if the value is not greater than previous tier
                                  return;
                                }
                              }

                              newTiers[index].lowerLimit = numValue;

                              // Auto-fill logic based on tier
                              if (index === 0 && numValue > 0) {
                                // Tier 1: Auto-fill Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                              } else if (index === 1 && numValue > 0) {
                                // Tier 2: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 1's Upper Limit to be 1 less than Tier 2's Lower Limit
                                newTiers[0].upperLimit = numValue - 1;
                              } else if (index === 2 && numValue > 0) {
                                // Tier 3: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 2's Upper Limit to be 1 less than Tier 3's Lower Limit
                                newTiers[1].upperLimit = numValue - 1;
                              } else if (index === 3 && numValue > 0) {
                                // Tier 4: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 3's Upper Limit to be 1 less than Tier 4's Lower Limit
                                newTiers[2].upperLimit = numValue - 1;
                              }

                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />

                        <NumberInput
                          label="Upper Limit"
                          placeholder="100"
                          size="md"
                          radius="md"
                          min={0}
                          hideControls
                          disabled={!isTierEnabled}
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-green-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.upperLimit}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              newTiers[index].upperLimit = Number(value) || 0;
                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />

                        <NumberInput
                          label="Price"
                          placeholder="₱350"
                          size="md"
                          radius="md"
                          prefix="₱"
                          min={0}
                          hideControls
                          disabled={!isTierEnabled}
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-green-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.price}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              newTiers[index].price = Number(value) || 0;
                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />
                      </SimpleGrid>
                    </div>
                  );
                })}
              </div>

              <NumberInput
                label="Price Adjustment"
                placeholder="0"
                size="md"
                radius="md"
                prefix="₱"
                description="Positive for increases, negative for decreases"
                mt="md"
                hideControls
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-green-5)' },
                  },
                }}
                value={newPriceForm.priceAdjustment}
                onChange={(value) =>
                  setNewPriceForm((prev) => ({
                    ...prev,
                    priceAdjustment: Number(value) || 0,
                  }))
                }
              />
            </div>

            {/* Action Buttons */}
            <Group
              justify="flex-end"
              mt="xl"
              pt="md"
              style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
            >
              <Button
                variant="subtle"
                size="md"
                radius="md"
                onClick={() => {
                  // Clear all form fields
                  setNewPriceForm({
                    productCode: '',
                    tiers: [
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                    ],
                    priceAdjustment: 0,
                  });
                  // Close the modal
                  setAddOpen(false);
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                    },
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                size="md"
                radius="md"
                gradient={{ from: 'green', to: 'green.6', deg: 45 }}
                disabled={
                  !newPriceForm.productCode.trim() ||
                  !newPriceForm.tiers.some(
                    (tier) =>
                      tier.lowerLimit > 0 ||
                      tier.upperLimit > 0 ||
                      tier.price > 0
                  )
                }
                leftSection={<IconPlus size={18} />}
                styles={{
                  root: {
                    boxShadow: '0 4px 12px rgba(51, 217, 178, 0.2)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(51, 217, 178, 0.3)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  },
                }}
                onClick={async () => {
                  try {
                    // For now, let's use the first tier's data for the price entry
                    // We'll enhance this later to handle multiple tiers
                    const firstTier = newPriceForm.tiers[0];
                    const newPrice: PriceData = {
                      'Product Code': newPriceForm.productCode.trim(),
                      'Lower Limit': firstTier.lowerLimit,
                      'Upper Limit': firstTier.upperLimit,
                      Prices: firstTier.price,
                      'Price Adjustment': newPriceForm.priceAdjustment,
                    };

                    // Save to database
                    const response = await fetch('/api/prices', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify([newPrice]), // Send as array
                      cache: 'no-store', // Bypass cache for mutations
                    });

                    if (!response.ok) {
                      throw new Error('Failed to save price');
                    }

                    // 🚀 PERFORMANCE: Optimistic update instead of full reload
                    const updatedPrices = [...prices, newPrice];
                    setPrices(updatedPrices);

                    if (!searchQuery.trim()) {
                      setFilteredPrices(updatedPrices);
                    } else {
                      const q = searchQuery.toLowerCase();
                      const filtered = updatedPrices.filter(
                        (price: PriceData) =>
                          price['Product Code'].toLowerCase().includes(q) ||
                          price['Lower Limit'].toString().includes(q) ||
                          price['Upper Limit'].toString().includes(q) ||
                          price['Prices'].toString().includes(q) ||
                          price['Price Adjustment'].toString().includes(q)
                      );
                      setFilteredPrices(filtered);
                    }

                    // Reset and close
                    setNewPriceForm({
                      productCode: '',
                      tiers: [
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                      ],
                      priceAdjustment: 0,
                    });
                    setAddOpen(false);

                    // Success toast
                    notifications.show({
                      title: '🎉 Price Added Successfully!',
                      message: `${newPrice['Product Code']} has been added to your pricing database`,
                      color: 'green',
                      icon: <IconCheck size={18} />,
                      autoClose: 4000,
                    });
                  } catch (error) {
                    console.error('Failed to add price:', error);
                    notifications.show({
                      title: '❌ Failed to Add Price',
                      message:
                        'Could not save the price to database. Please try again.',
                      color: 'red',
                      autoClose: 4000,
                    });
                  }
                }}
              >
                Add Price
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Edit Price Modal - Enhanced Modern Design */}
        <Modal
          opened={editOpen}
          onClose={() => setEditOpen(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="lg"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-blue-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-blue-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-blue-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-blue-1)',
              },
            },
          }}
          title={
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="blue">
                <IconAdjustments size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={600} c="blue.8">
                  Edit Price
                </Text>
                <Text size="sm" c="dimmed">
                  Update pricing information for{' '}
                  {editingPrice?.['Product Code']}
                </Text>
              </div>
            </Group>
          }
        >
          <Stack gap="lg">
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="blue">
                  <IconCurrencyDollar size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="blue.7">
                  Product Pricing Information
                </Text>
              </Group>

              <TextInput
                label="Product Code"
                placeholder="e.g. TSH-001"
                withAsterisk
                size="md"
                radius="md"
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                  },
                }}
                value={newPriceForm.productCode}
                onChange={(e) =>
                  setNewPriceForm((prev) => ({
                    ...prev,
                    productCode: e.target.value,
                  }))
                }
              />

              {/* Pricing Tiers */}
              <div style={{ marginTop: 24 }}>
                <Text size="lg" fw={500} c="blue.7" mb="md">
                  Pricing Tiers
                </Text>

                {newPriceForm.tiers.map((tier, index) => {
                  // Check if this tier should be enabled
                  const isProductCodeFilled =
                    newPriceForm.productCode.trim().length > 0;
                  const isPreviousTierComplete =
                    index === 0
                      ? true
                      : newPriceForm.tiers[index - 1].lowerLimit > 0 &&
                        newPriceForm.tiers[index - 1].upperLimit > 0 &&
                        newPriceForm.tiers[index - 1].price > 0;
                  const isTierEnabled =
                    isProductCodeFilled && isPreviousTierComplete;
                  const previousTier =
                    index > 0 ? newPriceForm.tiers[index - 1] : null;
                  const previousLowerLimit = previousTier?.lowerLimit ?? 0;
                  const tierHasLowerLimitError =
                    index > 0 &&
                    tier.lowerLimit > 0 &&
                    tier.lowerLimit <= previousLowerLimit;

                  return (
                    <div key={index} style={{ marginBottom: 16 }}>
                      <Text
                        size="sm"
                        fw={500}
                        mb="xs"
                        c={isTierEnabled ? 'dimmed' : 'gray.5'}
                      >
                        Tier {index + 1}{' '}
                        {!isTierEnabled &&
                          (index === 0
                            ? '(Fill Product Code first)'
                            : '(Complete previous tier first)')}
                      </Text>
                      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                        <NumberInput
                          label="Lower Limit"
                          placeholder={
                            index === 0 ? '1' : `> ${previousLowerLimit}`
                          }
                          size="md"
                          radius="md"
                          min={index === 0 ? 0 : previousLowerLimit + 1}
                          hideControls
                          disabled={!isTierEnabled}
                          error={
                            tierHasLowerLimitError
                              ? `Must be greater than ${previousLowerLimit}`
                              : null
                          }
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-blue-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.lowerLimit}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              const numValue = Number(value) || 0;

                              // Validation: Ensure this tier's lower limit is greater than previous tier's lower limit
                              if (index > 0) {
                                const previousLowerLimitValue =
                                  newTiers[index - 1]?.lowerLimit ?? 0;
                                if (
                                  numValue > 0 &&
                                  numValue <= previousLowerLimitValue
                                ) {
                                  // Don't update if the value is not greater than previous tier
                                  return;
                                }
                              }

                              newTiers[index].lowerLimit = numValue;

                              // Auto-fill logic based on tier
                              if (index === 0 && numValue > 0) {
                                // Tier 1: Auto-fill Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                              } else if (index === 1 && numValue > 0) {
                                // Tier 2: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 1's Upper Limit to be 1 less than Tier 2's Lower Limit
                                newTiers[0].upperLimit = numValue - 1;
                              } else if (index === 2 && numValue > 0) {
                                // Tier 3: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 2's Upper Limit to be 1 less than Tier 3's Lower Limit
                                newTiers[1].upperLimit = numValue - 1;
                              } else if (index === 3 && numValue > 0) {
                                // Tier 4: Auto-fill its Upper Limit to 10,000
                                newTiers[index].upperLimit = 10000;
                                // Also update Tier 3's Upper Limit to be 1 less than Tier 4's Lower Limit
                                newTiers[2].upperLimit = numValue - 1;
                              }

                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />

                        <NumberInput
                          label="Upper Limit"
                          placeholder="100"
                          size="md"
                          radius="md"
                          min={0}
                          hideControls
                          disabled={!isTierEnabled}
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-blue-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.upperLimit}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              newTiers[index].upperLimit = Number(value) || 0;
                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />

                        <NumberInput
                          label="Price"
                          placeholder="₱350"
                          size="md"
                          radius="md"
                          prefix="₱"
                          min={0}
                          hideControls
                          disabled={!isTierEnabled}
                          styles={{
                            label: { fontWeight: 500, marginBottom: 8 },
                            input: {
                              borderWidth: 2,
                              '&:focus': {
                                borderColor: 'var(--mantine-color-blue-5)',
                              },
                              backgroundColor: !isTierEnabled
                                ? 'var(--mantine-color-gray-1)'
                                : undefined,
                              color: !isTierEnabled
                                ? 'var(--mantine-color-gray-5)'
                                : undefined,
                            },
                          }}
                          value={tier.price}
                          onChange={(value) => {
                            if (isTierEnabled) {
                              const newTiers = [...newPriceForm.tiers];
                              newTiers[index].price = Number(value) || 0;
                              setNewPriceForm((prev) => ({
                                ...prev,
                                tiers: newTiers,
                              }));
                            }
                          }}
                        />
                      </SimpleGrid>
                    </div>
                  );
                })}
              </div>

              <NumberInput
                label="Price Adjustment"
                placeholder="0"
                size="md"
                radius="md"
                prefix="₱"
                description="Positive for increases, negative for decreases"
                mt="md"
                hideControls
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                  },
                }}
                value={newPriceForm.priceAdjustment}
                onChange={(value) =>
                  setNewPriceForm((prev) => ({
                    ...prev,
                    priceAdjustment: Number(value) || 0,
                  }))
                }
              />
            </div>

            {/* Action Buttons */}
            <Group
              justify="flex-end"
              mt="xl"
              pt="md"
              style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
            >
              <Button
                variant="subtle"
                size="md"
                radius="md"
                onClick={() => {
                  // Clear all form fields
                  setNewPriceForm({
                    productCode: '',
                    tiers: [
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                      { lowerLimit: 0, upperLimit: 0, price: 0 },
                    ],
                    priceAdjustment: 0,
                  });
                  // Close the modal
                  setEditOpen(false);
                  setEditingPrice(null);
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                    },
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                size="md"
                radius="md"
                gradient={{ from: 'blue', to: 'blue.6', deg: 45 }}
                disabled={
                  !newPriceForm.productCode.trim() ||
                  !newPriceForm.tiers.some(
                    (tier) =>
                      tier.lowerLimit > 0 ||
                      tier.upperLimit > 0 ||
                      tier.price > 0
                  )
                }
                leftSection={<IconAdjustments size={18} />}
                styles={{
                  root: {
                    boxShadow: '0 4px 12px rgba(34, 139, 230, 0.2)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(34, 139, 230, 0.3)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  },
                }}
                onClick={async () => {
                  try {
                    if (!editingPrice?.id) {
                      throw new Error('No price selected for editing');
                    }

                    // Use the first tier's data for the price entry
                    const firstTier = newPriceForm.tiers[0];
                    const updatedPrice: PriceData = {
                      id: editingPrice.id,
                      'Product Code': newPriceForm.productCode.trim(),
                      'Lower Limit': firstTier.lowerLimit,
                      'Upper Limit': firstTier.upperLimit,
                      Prices: firstTier.price,
                      'Price Adjustment': newPriceForm.priceAdjustment,
                    };

                    // Update in database
                    const response = await fetch(
                      `/api/prices/${editingPrice.id}`,
                      {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(updatedPrice),
                        cache: 'no-store', // Bypass cache for mutations
                      }
                    );

                    if (!response.ok) {
                      throw new Error('Failed to update price');
                    }

                    // 🚀 PERFORMANCE: Optimistic update instead of full reload
                    const updatedPrices = prices.map((p) =>
                      p.id === editingPrice.id ? updatedPrice : p
                    );
                    setPrices(updatedPrices);

                    if (!searchQuery.trim()) {
                      setFilteredPrices(updatedPrices);
                    } else {
                      const q = searchQuery.toLowerCase();
                      const filtered = updatedPrices.filter(
                        (price: PriceData) =>
                          price['Product Code'].toLowerCase().includes(q) ||
                          price['Lower Limit'].toString().includes(q) ||
                          price['Upper Limit'].toString().includes(q) ||
                          price['Prices'].toString().includes(q) ||
                          price['Price Adjustment'].toString().includes(q)
                      );
                      setFilteredPrices(filtered);
                    }

                    // Reset and close
                    setNewPriceForm({
                      productCode: '',
                      tiers: [
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                        { lowerLimit: 0, upperLimit: 0, price: 0 },
                      ],
                      priceAdjustment: 0,
                    });
                    setEditOpen(false);
                    setEditingPrice(null);

                    // Success toast
                    notifications.show({
                      title: '🎉 Price Updated Successfully!',
                      message: `${updatedPrice['Product Code']} has been updated in your pricing database`,
                      color: 'blue',
                      icon: <IconCheck size={18} />,
                      autoClose: 4000,
                    });
                  } catch (error) {
                    console.error('Failed to update price:', error);
                    notifications.show({
                      title: '❌ Failed to Update Price',
                      message:
                        'Could not save the changes to database. Please try again.',
                      color: 'red',
                      autoClose: 4000,
                    });
                  }
                }}
              >
                Update Price
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </PageLayout>
  );
}
