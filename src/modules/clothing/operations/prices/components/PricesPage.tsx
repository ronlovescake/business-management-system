'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Stack,
  Group,
  TextInput,
  Button,
  Card,
  Text,
  FileInput,
} from '@mantine/core';
import {
  IconSearch,
  IconPlus,
  IconUpload,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import {
  DataEditor as GridView,
  type GridColumn,
  type Item,
  type GridCell,
  GridCellKind,
} from '@glideapps/glide-data-grid';
import { useThrottledCallback } from '@mantine/hooks';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { logger } from '@/lib/logger';
import { usePricesData } from '../hooks/usePricesData';
import { usePriceForm } from '../hooks/usePriceForm';
import { PriceService } from '../services/PriceService';
import { PriceStatsCards } from './PriceStatsCards';
import { AddPriceModal } from './AddPriceModal';

// Custom styles for grid
const customGridStyles = `
  .data-grid-container .dvn-scroller {
    font-size: 17px !important;
  }
  .data-grid-container .dvn-underlay canvas {
    font-size: 17px !important;
  }
`;

/**
 * Main Prices page component
 */
export function PricesPage() {
  // Hooks
  const {
    prices,
    filteredPrices,
    debouncedFilteredPrices,
    searchQuery,
    handleSearch: handleSearchData,
    stats,
    isLoading,
    addPrice: addPriceToData,
    replaceAllPrices,
  } = usePricesData();

  const {
    form,
    isAddOpen,
    setProductCode,
    updateTier,
    setPriceAdjustment,
    formToPriceData,
    openAddModal,
    closeAddModal,
    resetForm,
  } = usePriceForm();

  // Local state
  const [file, setFile] = useState<File | null>(null);
  const [gridHeight, setGridHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // Memoize columns array to prevent recreation
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Product Code', width: 200, id: 'productCode', grow: 1 },
      { title: 'Lower Limit', width: 280, id: 'lowerLimit' },
      { title: 'Upper Limit', width: 280, id: 'upperLimit' },
      { title: 'Prices', width: 280, id: 'prices' },
      { title: 'Price Adjustment', width: 280, id: 'priceAdjustment' },
    ],
    []
  );

  // Throttled resize handler for performance
  const handleResize = useThrottledCallback(() => {
    if (typeof window !== 'undefined') {
      setGridHeight(window.innerHeight * 0.85);
    }
  }, 150);

  useEffect(() => {
    // SSR guard: Only run in browser environment
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // Ctrl+F focus handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // CSV Import functionality
  const handleCSVImport = async () => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const result = PriceService.importFromCSV(text);

      if (!result.success || !result.data) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: result.error || 'No valid price data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // Save to database via API
      const count = await replaceAllPrices(result.data);
      setFile(null); // Clear the file input

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${count} price records to database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      logger.error('CSV import error:', error);
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  // Handle cell click (for product code editing - double-click)
  const onCellClicked = useCallback(
    (cell: Item) => {
      const [col, row] = cell;

      if (row >= filteredPrices.length) {
        return;
      }

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
          // Double-click detected - navigate or edit
          const price = filteredPrices[row];
          logger.debug('Double-click on price:', price['Product Code']);
          // FUTURE: Implement inline edit modal for price tiers
          // Modal should allow editing all tiers for a product code
          lastClickRef.current = null; // Reset after handling
        } else {
          // First click - store it
          lastClickRef.current = { cell, time: now };
        }
      }
    },
    [filteredPrices, columns]
  );

  // Data rendering
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row >= debouncedFilteredPrices.length) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: true,
        };
      }

      const price = debouncedFilteredPrices[row];
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
        allowOverlay: false,
        readonly: true,
        cursor: column.id === 'productCode' ? 'pointer' : 'default',
      };
    },
    [debouncedFilteredPrices, columns]
  );

  const getRowCount = useCallback(
    () => debouncedFilteredPrices.length,
    [debouncedFilteredPrices]
  );

  // Custom header renderer for center alignment
  const drawHeader = useCallback(
    (
      args: Parameters<
        NonNullable<React.ComponentProps<typeof GridView>['drawHeader']>
      >[0]
    ) => {
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
    },
    []
  );

  // Handle add price submission
  const handleAddPriceSubmit = async () => {
    const priceData = formToPriceData();
    const success = await addPriceToData(priceData);
    if (!success) {
      throw new Error('Failed to add price');
    }
  };

  if (isLoading) {
    return (
      <PageLayout fluid withPadding>
        <TableSkeleton rows={10} columns={5} />
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
        <PriceStatsCards stats={stats} />

        <Group justify="flex-end">
          <Group gap="sm">
            <TextInput
              ref={searchInputRef}
              placeholder="Search products... (Ctrl+F)"
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(event) => handleSearchData(event.currentTarget.value)}
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
              onClick={openAddModal}
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

        {/* Pagination counter */}
        <Text size="sm" c="dimmed" ta="center">
          {prices.length > 0
            ? `Showing ${filteredPrices.length} of ${prices.length} products${searchQuery ? ' (filtered)' : ''}`
            : 'Price management system - add products to get started'}
        </Text>

        {/* Add New Price Modal */}
        <AddPriceModal
          opened={isAddOpen}
          onClose={closeAddModal}
          form={form}
          onProductCodeChange={setProductCode}
          onTierChange={updateTier}
          onPriceAdjustmentChange={setPriceAdjustment}
          onSubmit={handleAddPriceSubmit}
          onReset={resetForm}
        />
      </Stack>
    </PageLayout>
  );
}
