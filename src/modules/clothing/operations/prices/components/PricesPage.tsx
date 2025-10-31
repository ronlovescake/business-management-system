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
import { EditPriceModal } from './EditPriceModal';

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
    replaceAllPrices,
    reloadPrices,
  } = usePricesData();

  const {
    form,
    isAddOpen,
    productCodeOptions,
    fetchProductCodes,
    setProductCode,
    updateTier,
    setPriceAdjustment,
    openAddModal,
    closeAddModal,
    resetForm,
  } = usePriceForm();

  // Edit modal state and form
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<typeof form>({
    productCode: '',
    tiers: [
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
      { lowerLimit: 0, upperLimit: 0, price: 0 },
    ],
    priceAdjustment: 0,
  });

  // Edit modal handlers
  const openEditModal = useCallback(
    (productCode: string) => {
      // Get all tiers for this product code
      const allTiersForProduct = prices.filter(
        (p) => p['Product Code'] === productCode
      );

      // Convert to form format
      const formData = PriceService.priceDataToForm(allTiersForProduct);
      setEditForm(formData);
      setIsEditOpen(true);
    },
    [prices]
  );

  const closeEditModal = useCallback(() => {
    setIsEditOpen(false);
  }, []);

  const resetEditForm = useCallback(() => {
    setEditForm({
      productCode: '',
      tiers: [
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    });
  }, []);

  const updateEditTier = useCallback(
    (
      index: number,
      field: 'lowerLimit' | 'upperLimit' | 'price',
      value: number
    ) => {
      setEditForm((prev) => {
        const newTiers = [...prev.tiers];
        const numValue = value || 0;

        // Handle lower limit changes with clearing logic
        if (field === 'lowerLimit') {
          // Allow clearing the field (value = 0 or empty)
          // But validate if there's an actual value being set
          if (index > 0 && numValue > 0) {
            const previousLowerLimit = newTiers[index - 1]?.lowerLimit ?? 0;
            if (numValue <= previousLowerLimit) {
              // Don't update if the value is not greater than previous tier
              return prev;
            }
          }

          newTiers[index].lowerLimit = numValue;

          // If clearing the lower limit (numValue = 0), also clear upper limit AND price
          if (numValue === 0) {
            newTiers[index].upperLimit = 0;
            newTiers[index].price = 0;

            // Recalculate prices for remaining tiers if product code is set
            const updatedForm = {
              ...prev,
              tiers: newTiers,
            };

            if (prev.productCode.trim()) {
              // Schedule the recalculation to happen after this state update
              setTimeout(async () => {
                try {
                  // Fetch all products
                  const response = await fetch('/api/products');
                  const products = await response.json();

                  // Find the product by product code
                  const product = products.find(
                    (p: Record<string, unknown>) =>
                      p['Product Code'] === prev.productCode.trim()
                  );

                  if (product && product['Actual Price']) {
                    const actualPrice = Number(product['Actual Price']) || 0;

                    // Find the highest filled tier
                    let highestFilledTier = -1;
                    for (let i = updatedForm.tiers.length - 1; i >= 0; i--) {
                      if (updatedForm.tiers[i].lowerLimit > 0) {
                        highestFilledTier = i;
                        break;
                      }
                    }

                    // If no tier has lower limit, default to Tier 1 (index 0)
                    if (highestFilledTier === -1) {
                      highestFilledTier = 0;
                    }

                    // Calculate prices based on highest filled tier
                    const newTiersWithPrices = updatedForm.tiers.map(
                      (tier, i) => {
                        if (tier.lowerLimit > 0 && i <= highestFilledTier) {
                          const priceIncrement = (highestFilledTier - i) * 5;
                          return {
                            ...tier,
                            price: actualPrice + priceIncrement,
                          };
                        }
                        return tier;
                      }
                    );

                    setEditForm((current) => ({
                      ...current,
                      tiers: newTiersWithPrices,
                    }));
                  }
                } catch (error) {
                  logger.error('Failed to recalculate prices:', error);
                }
              }, 0);
            }

            return updatedForm;
          }

          // Auto-fill logic based on tier (only when numValue > 0)
          if (index === 0 && numValue > 0) {
            newTiers[index].upperLimit = 10000;
          } else if (index === 1 && numValue > 0) {
            newTiers[index].upperLimit = 10000;
            newTiers[0].upperLimit = numValue - 1;
          } else if (index === 2 && numValue > 0) {
            newTiers[index].upperLimit = 10000;
            newTiers[1].upperLimit = numValue - 1;
          } else if (index === 3 && numValue > 0) {
            newTiers[index].upperLimit = 10000;
            newTiers[2].upperLimit = numValue - 1;
          }

          // After updating lower limit, recalculate prices if product code is set
          const updatedForm = {
            ...prev,
            tiers: newTiers,
          };

          // Trigger price recalculation after state update (only if numValue > 0)
          if (prev.productCode.trim() && numValue > 0) {
            setTimeout(async () => {
              try {
                // Fetch all products
                const response = await fetch('/api/products');
                const products = await response.json();

                // Find the product by product code
                const product = products.find(
                  (p: Record<string, unknown>) =>
                    p['Product Code'] === prev.productCode.trim()
                );

                if (product && product['Actual Price']) {
                  const actualPrice = Number(product['Actual Price']) || 0;

                  // Find the highest filled tier
                  let highestFilledTier = -1;
                  for (let i = updatedForm.tiers.length - 1; i >= 0; i--) {
                    if (updatedForm.tiers[i].lowerLimit > 0) {
                      highestFilledTier = i;
                      break;
                    }
                  }

                  // If no tier has lower limit, default to Tier 1 (index 0)
                  if (highestFilledTier === -1) {
                    highestFilledTier = 0;
                  }

                  // Calculate prices based on highest filled tier
                  const newTiersWithPrices = updatedForm.tiers.map(
                    (tier, i) => {
                      if (tier.lowerLimit > 0 && i <= highestFilledTier) {
                        const priceIncrement = (highestFilledTier - i) * 5;
                        return {
                          ...tier,
                          price: actualPrice + priceIncrement,
                        };
                      }
                      return tier;
                    }
                  );

                  setEditForm((current) => ({
                    ...current,
                    tiers: newTiersWithPrices,
                  }));
                }
              } catch (error) {
                logger.error('Failed to recalculate prices:', error);
              }
            }, 0);
          }

          return updatedForm;
        } else {
          // For upperLimit and price, just update the field
          newTiers[index][field] = numValue;
        }

        return {
          ...prev,
          tiers: newTiers,
        };
      });
    },
    []
  );

  const setEditPriceAdjustment = useCallback((value: number) => {
    setEditForm((prev) => ({ ...prev, priceAdjustment: value }));
  }, []);

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
          // Double-click detected - open edit modal
          const price = filteredPrices[row];
          logger.debug('Double-click on price:', price['Product Code']);
          openEditModal(price['Product Code']);
          lastClickRef.current = null; // Reset after handling
        } else {
          // First click - store it
          lastClickRef.current = { cell, time: now };
        }
      }
    },
    [filteredPrices, columns, openEditModal]
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
    // Convert form to multiple price data (one per tier)
    const priceDataArray = PriceService.formToMultiplePriceData(form);

    if (priceDataArray.length === 0) {
      throw new Error('No tiers filled');
    }

    // Add all tiers at once
    const success = await PriceService.addMultiplePrices(priceDataArray);

    if (!success) {
      throw new Error('Failed to add prices');
    }

    // Reload prices to show the new tiers
    await reloadPrices();

    // Refresh product codes dropdown to exclude newly added product
    await fetchProductCodes();
  };

  // Handle edit price submission
  const handleEditPriceSubmit = async () => {
    // Convert form to multiple price data (one per tier)
    const priceDataArray = PriceService.formToMultiplePriceData(editForm);

    if (priceDataArray.length === 0) {
      throw new Error('No tiers filled');
    }

    // Update all tiers for this product code
    const success = await PriceService.updateProductPrices(
      editForm.productCode,
      priceDataArray
    );

    if (!success) {
      throw new Error('Failed to update prices');
    }

    // Reload prices to show the updated tiers
    await reloadPrices();
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
            getCellsForSelection={true}
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
          productCodeOptions={productCodeOptions}
          onProductCodeChange={setProductCode}
          onTierChange={updateTier}
          onPriceAdjustmentChange={setPriceAdjustment}
          onSubmit={handleAddPriceSubmit}
          onReset={resetForm}
        />

        {/* Edit Price Modal */}
        <EditPriceModal
          opened={isEditOpen}
          onClose={closeEditModal}
          form={editForm}
          onTierChange={updateEditTier}
          onPriceAdjustmentChange={setEditPriceAdjustment}
          onSubmit={handleEditPriceSubmit}
          onReset={resetEditForm}
        />
      </Stack>
    </PageLayout>
  );
}
