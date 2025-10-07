'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from 'react';
import { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconSearch } from '@tabler/icons-react';
import { GridView } from '../grid';

// Types for DrawHeader callback
interface DrawHeaderArgs {
  ctx: CanvasRenderingContext2D;
  column: GridColumn;
  rect: { x: number; y: number; width: number; height: number };
  theme: {
    bgHeader: string;
    textHeader: string;
    headerFontStyle: string;
  };
}

// Custom styles for larger font and center aligned headers
const customGridStyles = `
  .data-grid-container * {
    font-size: 42px !important;
    font-family: 'Roboto', sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 42px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 42px !important;
    font-family: 'Roboto', sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 42px !important;
    font-weight: 600 !important;
    font-family: 'Roboto', sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 42px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 42px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 42px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 42px !important;
  }
  .dvn-scroller {
    font-size: 42px !important;
  }
  
  /* Default cursor styling */
  .data-grid-container canvas {
    cursor: default;
  }
`;

// Stats card interface
export interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  backgroundColor?: string;
}

// Table configuration interface
export interface DataTableProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];
  columns: GridColumn[];

  // Stats cards (optional)
  statsCards?: StatCard[];

  // Search functionality
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  enableCtrlF?: boolean;

  // CSV Import (optional)
  enableCSVImport?: boolean;
  onCSVImport?: (file: File) => Promise<void>;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;

  // Action buttons (optional)
  actionButtons?: React.ReactNode;

  // Search right buttons (appear right after search bar)
  searchRightButtons?: React.ReactNode;

  // Table behavior
  onCellClick?: (cell: Item, data: T) => void;
  getCellContent: (cell: Item) => GridCell;
  onCellEdited?: (cell: Item, newValue: GridCell) => void;
  customRenderers?: readonly Record<string, unknown>[];

  // Footer customization
  showFooter?: boolean;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;

  // Grid height (defaults to 83vh)
  gridHeight?: number;

  // Custom styling
  enableClickableCursor?: boolean;
  className?: string;
}

export function DataTable<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search...',
  enableCtrlF = true,
  enableCSVImport = false,
  onCSVImport,
  csvFile,
  onFileChange,
  actionButtons,
  searchRightButtons,
  onCellClick,
  getCellContent,
  onCellEdited,
  customRenderers,
  showFooter = true,
  footerLeft,
  footerRight,
  gridHeight,
  enableClickableCursor = false,
  className = '',
}: DataTableProps<T>) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [currentGridHeight, setCurrentGridHeight] = useState<number>(600);

  // Set grid height to 83vh by default
  useEffect(() => {
    const updateGridHeight = () => {
      const targetHeight = gridHeight || window.innerHeight * 0.83;
      setCurrentGridHeight(targetHeight);
    };

    updateGridHeight();
    window.addEventListener('resize', updateGridHeight);
    return () => window.removeEventListener('resize', updateGridHeight);
  }, [gridHeight]);

  // Handle Ctrl+F to focus search bar
  useEffect(() => {
    if (!enableCtrlF) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault(); // Prevent browser's find dialog
        searchInputRef.current?.focus();
        searchInputRef.current?.select(); // Select existing text if any
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableCtrlF]);

  // Custom header drawing function
  const drawHeader = useCallback((args: DrawHeaderArgs) => {
    const { ctx, column, rect, theme } = args;

    // Fill header background
    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Set text properties
    ctx.fillStyle = theme.textHeader;
    ctx.font = '400 17px Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw centered text
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);

    return true;
  }, []);

  // Get row count
  const getRowCount = useCallback(() => filteredData.length, [filteredData]);

  // Handle cell clicks
  const onCellClicked = useCallback(
    (cell: Item) => {
      if (onCellClick) {
        const [, row] = cell;
        const rowData = filteredData[row];
        if (rowData) {
          onCellClick(cell, rowData);
        }
      }
    },
    [filteredData, onCellClick]
  );

  // Enhanced grid styles with clickable cursor option
  const enhancedGridStyles = useMemo(() => {
    let styles = customGridStyles;
    if (enableClickableCursor) {
      styles += `
        .data-grid-container:hover canvas {
          cursor: pointer;
        }
      `;
    }
    return styles;
  }, [enableClickableCursor]);

  // CSV import handler
  const handleCSVImport = async () => {
    if (!csvFile || !onCSVImport) return;

    try {
      await onCSVImport(csvFile);
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

  return (
    <div className={className}>
      <style dangerouslySetInnerHTML={{ __html: enhancedGridStyles }} />
      <Stack
        gap="md"
        style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
      >
        {/* Stats cards */}
        {statsCards && statsCards.length > 0 && (
          <SimpleGrid cols={statsCards.length} spacing="md">
            {statsCards.map((stat, index) => (
              <Card
                key={index}
                shadow="xs"
                padding="md"
                radius="md"
                withBorder
                style={{
                  backgroundColor: '#ffffff',
                  borderColor: '#6b7280',
                  borderWidth: '1px',
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text c="gray.5" size="xs" fw={500}>
                      {stat.title}
                    </Text>
                    <Title order={3} style={{ color: '#374151' }} mt="xs">
                      {typeof stat.value === 'number'
                        ? stat.value.toLocaleString()
                        : stat.value}
                    </Title>
                  </div>
                  <ThemeIcon
                    variant="light"
                    color={stat.color}
                    size="lg"
                    radius="md"
                  >
                    {stat.icon}
                  </ThemeIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <Group gap="md" style={{ flex: 1 }}>
            <TextInput
              ref={searchInputRef}
              placeholder={
                enableCtrlF
                  ? `${searchPlaceholder} (Ctrl+F)`
                  : searchPlaceholder
              }
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 300,
              }}
              styles={{
                input: {
                  backgroundColor: '#eaeef6',
                  borderColor: '#eaeef6',
                },
              }}
              size="md"
              radius="md"
            />
            {searchRightButtons}
          </Group>

          <Group gap="sm">
            {enableCSVImport && (
              <>
                <FileInput
                  placeholder="Select CSV file"
                  accept=".csv"
                  value={csvFile}
                  onChange={onFileChange}
                  leftSection={<IconUpload size={16} />}
                  size="md"
                  radius="md"
                  style={{ minWidth: 200 }}
                />
                <Button
                  onClick={handleCSVImport}
                  disabled={!csvFile}
                  leftSection={<IconUpload size={16} />}
                  size="md"
                  radius="md"
                  color="blue"
                >
                  Import CSV
                </Button>
              </>
            )}
            {actionButtons}
          </Group>
        </Group>

        {/* Data Grid */}
        <Card
          withBorder
          shadow="sm"
          radius="md"
          padding={0}
          style={{
            height: currentGridHeight,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
            fontSize: '20px',
          }}
          className="data-grid-container"
        >
          <GridView
            getCellContent={getCellContent}
            columns={columns}
            rows={getRowCount()}
            height={currentGridHeight}
            width={'100%'}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={50}
            headerHeight={50}
            rowMarkers="number"
            onCellClicked={onCellClicked}
            onCellEdited={onCellEdited}
            onPaste={true}
            keybindings={{
              clear: true,
              copy: true,
              paste: true,
              search: false,
            }}
            isDraggable={false}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
            drawHeader={drawHeader}
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
              horizontalBorderColor: '#dee2e6',
              fontFamily: 'Roboto, sans-serif',
            }}
            verticalBorder={false}
            getCellsForSelection={true}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            customRenderers={customRenderers as any}
          />
        </Card>

        {/* Footer pagination counter at bottom */}
        {showFooter && (
          <Group
            justify="space-between"
            align="center"
            style={{ marginTop: 'md' }}
          >
            <div>
              {footerLeft || (
                <Text size="sm" c="dimmed">
                  {`Showing ${filteredData.length} of ${data.length} items`}
                </Text>
              )}
            </div>
            {footerRight && (
              <div>
                {typeof footerRight === 'string' ? (
                  <Text size="sm" c="dimmed">
                    {footerRight}
                  </Text>
                ) : (
                  footerRight
                )}
              </div>
            )}
          </Group>
        )}
      </Stack>
    </div>
  );
}

export default DataTable;
