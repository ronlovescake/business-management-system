'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import { Stack, Text, Button, Group, FileInput, Loader, TextInput, Card, SimpleGrid, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload, IconSearch, IconPlus } from '@tabler/icons-react';

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
  
  /* Default cursor styling */
  .data-grid-container canvas {
    cursor: default;
  }
`;

// Dynamic import to prevent SSR issues
const DataEditor = dynamic(
  () => import('@glideapps/glide-data-grid').then((mod) => mod.DataEditor),
  { 
    ssr: false,
    loading: () => <Loader />
  }
);

// Stats card interface
export interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  backgroundColor?: string;
}

// Table configuration interface
export interface DataTableProps<T = any> {
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
  
  // Table behavior
  onCellClick?: (cell: Item, data: T) => void;
  getCellContent: (cell: Item) => any;
  
  // Footer customization
  showFooter?: boolean;
  footerLeft?: string;
  footerRight?: string;
  
  // Grid height (defaults to 83vh)
  gridHeight?: number;
  
  // Custom styling
  enableClickableCursor?: boolean;
  className?: string;
}

export function DataTable<T = any>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = "Search...",
  enableCtrlF = true,
  enableCSVImport = false,
  onCSVImport,
  csvFile,
  onFileChange,
  actionButtons,
  onCellClick,
  getCellContent,
  showFooter = true,
  footerLeft,
  footerRight,
  gridHeight,
  enableClickableCursor = false,
  className = "",
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
  const drawHeader = useCallback((args: any) => {
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

  // Get row count
  const getRowCount = useCallback(() => filteredData.length, [filteredData]);

  // Handle cell clicks
  const onCellClicked = useCallback((cell: Item) => {
    if (onCellClick) {
      const [col, row] = cell;
      const rowData = filteredData[row];
      if (rowData) {
        onCellClick(cell, rowData);
      }
    }
  }, [filteredData, onCellClick]);

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
      <Stack gap="md" style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}>
        {/* Stats cards */}
        {statsCards && statsCards.length > 0 && (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
            {statsCards.map((stat, index) => (
              <Card 
                key={index}
                shadow="sm" 
                padding="md" 
                radius="md" 
                style={{ 
                  background: stat.backgroundColor || stat.color, 
                  color: 'white' 
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                      {stat.title}
                    </Text>
                    <Title order={3} c="white">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </Title>
                  </div>
                  <ThemeIcon variant="white" color={stat.color} size="lg" radius="md">
                    {stat.icon}
                  </ThemeIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}

        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <TextInput
            ref={searchInputRef}
            placeholder={enableCtrlF ? `${searchPlaceholder} (Ctrl+F)` : searchPlaceholder}
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            style={{ flex: 1, minWidth: 300 }}
            size="md"
            radius="md"
          />
          
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
        <Card withBorder shadow="sm" radius="md" padding={0} style={{
          height: currentGridHeight,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
          fontSize: '18px'
        }} className="data-grid-container">
          <DataEditor
            getCellContent={getCellContent}
            columns={columns}
            rows={getRowCount()}
            height={currentGridHeight}
            width={"100%"}
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
            getCellsForSelection={true}
          />
        </Card>

        {/* Footer pagination counter at bottom */}
        {showFooter && (
          <Group justify="space-between" align="center" style={{ marginTop: 'md' }}>
            <Text size="sm" c="dimmed">
              {footerLeft || `Showing ${filteredData.length} of ${data.length} items`}
            </Text>
            {footerRight && (
              <Text size="sm" c="dimmed">
                {footerRight}
              </Text>
            )}
          </Group>
        )}
      </Stack>
    </div>
  );
}

export default DataTable;