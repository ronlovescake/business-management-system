'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.min.css';
import 'handsontable/styles/ht-theme-horizon.min.css';
import '@/styles/handsontable-horizon-light.css';
import {
  GridColumn,
  Item,
  GridCell,
  GridCellKind,
} from '@glideapps/glide-data-grid';
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
import type { StatCard } from './DataTable';

// Register Handsontable modules
registerAllModules();

export interface HandsontableGridProps<T extends Item> {
  data: readonly T[];
  columns: GridColumn[];
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;
  statsCards?: StatCard[];
  filteredData: readonly T[];
  enableCtrlF?: boolean;
  enableCSVImport?: boolean;
  onCSVImport?: (file: File) => Promise<void>;
  csvFile: File | null;
  onFileChange: (file: File | null) => void;
  actionButtons?: React.ReactNode;
  searchRightButtons?: React.ReactNode;
  onCellClick?: (cell: readonly [number, number], row: T) => void;
  getCellContent: (cell: readonly [number, number]) => GridCell;
  onCellEdited?: (cell: readonly [number, number], newValue: GridCell) => void;
  showFooter?: boolean;
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  gridHeight?: number;
  className?: string;
}

export function HandsontableGrid<T extends Item>({
  data,
  columns,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search...',
  statsCards = [],
  filteredData,
  enableCtrlF = false,
  enableCSVImport = false,
  onCSVImport,
  csvFile,
  onFileChange,
  actionButtons,
  searchRightButtons,
  onCellClick,
  getCellContent,
  onCellEdited,
  showFooter = true,
  footerLeft,
  footerRight,
  gridHeight,
  className = '',
}: HandsontableGridProps<T>) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hotRef = useRef(null);
  const [currentGridHeight, setCurrentGridHeight] = useState<number>(600);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isBatchModeRef = useRef(false);
  const batchCountRef = useRef(0);

  // Debug: Check if theme is applied
  useEffect(() => {
    const wrapper = document.querySelector('.ht-theme-horizon');
    if (wrapper) {
      console.log('✅ Horizon theme wrapper found');
    } else {
      console.log('❌ Horizon theme wrapper NOT found');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply header height styles dynamically
  useEffect(() => {
    const styleId = 'handsontable-header-height-styles';

    // Remove existing style if present
    const existingStyle = document.getElementById(styleId);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject new style
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .ht-theme-horizon .handsontable thead th,
      .ht-theme-horizon .handsontable .ht_clone_top thead th,
      .ht-theme-horizon .handsontable .ht_clone_top_left_corner thead th,
      .ht-theme-horizon .handsontable .ht_clone_left thead th {
        height: 50px !important;
        min-height: 50px !important;
        max-height: 50px !important;
        line-height: 50px !important;
        vertical-align: middle !important;
        display: table-cell !important;
        text-align: center !important;
        padding: 0 12px !important;
        box-sizing: border-box !important;
      }
      
      .ht-theme-horizon .handsontable thead th .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top thead th .colHeader,
      .ht-theme-horizon .handsontable .ht_clone_top_left_corner thead th .colHeader {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        line-height: 1 !important;
      }
    `;
    document.head.appendChild(style);

    // Cleanup function
    return () => {
      const styleToRemove = document.getElementById(styleId);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, []);

  // Set grid height to 84vh by default
  useEffect(() => {
    const updateGridHeight = () => {
      const targetHeight = gridHeight || window.innerHeight * 0.84;
      setCurrentGridHeight(targetHeight);
    };

    updateGridHeight();
    const handleResize = () => updateGridHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [gridHeight]);

  // Handle Ctrl+F to focus search bar
  useEffect(() => {
    if (!enableCtrlF) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        event.stopPropagation(); // Stop event from reaching other handlers

        // Close any active cell editor in Handsontable
        if (hotRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const hotInstance = (hotRef.current as any).hotInstance;
          if (hotInstance) {
            hotInstance.deselectCell(); // Exit edit mode and deselect cell
          }
        }

        // Small delay to ensure cell editor is closed before focusing search
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 10);
      }
    };

    // Use capture phase to intercept before Handsontable
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [enableCtrlF]);

  // Google Sheets-style Ctrl+Arrow navigation
  useEffect(() => {
    if (!hotRef.current) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle Ctrl+Arrow keys (or Cmd+Arrow on Mac)
      if (!(event.ctrlKey || event.metaKey)) return;
      if (
        !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)
      )
        return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hotInstance = (hotRef.current as any)?.hotInstance;
      if (!hotInstance) return;

      // Get current selection
      const selected = hotInstance.getSelected();
      if (!selected || selected.length === 0) return;

      const [startRow, startCol] = selected[0];

      event.preventDefault();
      event.stopPropagation();

      let targetRow = startRow;
      let targetCol = startCol;

      // Helper function to check if a cell is empty
      const isCellEmpty = (row: number, col: number): boolean => {
        const value = hotInstance.getDataAtCell(row, col);
        return value === null || value === undefined || value === '';
      };

      if (event.key === 'ArrowDown') {
        // Move down to next non-empty cell or last non-empty cell
        const maxRow = hotInstance.countRows() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to next non-empty cell
          for (let row = startRow + 1; row <= maxRow; row++) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          // If no non-empty cell found, jump to last row
          if (targetRow === startRow) {
            targetRow = maxRow;
          }
        } else {
          // If current cell is non-empty, find the last consecutive non-empty cell
          let lastNonEmpty = startRow;
          for (let row = startRow + 1; row <= maxRow; row++) {
            if (!isCellEmpty(row, startCol)) {
              lastNonEmpty = row;
            } else {
              break;
            }
          }

          if (lastNonEmpty > startRow) {
            // Found consecutive non-empty cells, jump to the last one
            targetRow = lastNonEmpty;
          } else {
            // Next cell is empty, jump to next non-empty cell or end
            for (let row = startRow + 1; row <= maxRow; row++) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            // If no non-empty cell found, jump to last row
            if (targetRow === startRow) {
              targetRow = maxRow;
            }
          }
        }
      } else if (event.key === 'ArrowUp') {
        // Move up to previous non-empty cell or first non-empty cell
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to previous non-empty cell
          for (let row = startRow - 1; row >= 0; row--) {
            if (!isCellEmpty(row, startCol)) {
              targetRow = row;
              break;
            }
          }
          // If no non-empty cell found, jump to first row
          if (targetRow === startRow) {
            targetRow = 0;
          }
        } else {
          // If current cell is non-empty, find the first consecutive non-empty cell
          let firstNonEmpty = startRow;
          for (let row = startRow - 1; row >= 0; row--) {
            if (!isCellEmpty(row, startCol)) {
              firstNonEmpty = row;
            } else {
              break;
            }
          }

          if (firstNonEmpty < startRow) {
            // Found consecutive non-empty cells, jump to the first one
            targetRow = firstNonEmpty;
          } else {
            // Previous cell is empty, jump to previous non-empty cell or beginning
            for (let row = startRow - 1; row >= 0; row--) {
              if (!isCellEmpty(row, startCol)) {
                targetRow = row;
                break;
              }
            }
            // If no non-empty cell found, jump to first row
            if (targetRow === startRow) {
              targetRow = 0;
            }
          }
        }
      } else if (event.key === 'ArrowRight') {
        // Move right to next non-empty cell or last non-empty cell
        const maxCol = hotInstance.countCols() - 1;
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to next non-empty cell
          for (let col = startCol + 1; col <= maxCol; col++) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          // If no non-empty cell found, jump to last column
          if (targetCol === startCol) {
            targetCol = maxCol;
          }
        } else {
          // If current cell is non-empty, find the last consecutive non-empty cell
          let lastNonEmpty = startCol;
          for (let col = startCol + 1; col <= maxCol; col++) {
            if (!isCellEmpty(startRow, col)) {
              lastNonEmpty = col;
            } else {
              break;
            }
          }

          if (lastNonEmpty > startCol) {
            // Found consecutive non-empty cells, jump to the last one
            targetCol = lastNonEmpty;
          } else {
            // Next cell is empty, jump to next non-empty cell or end
            for (let col = startCol + 1; col <= maxCol; col++) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            // If no non-empty cell found, jump to last column
            if (targetCol === startCol) {
              targetCol = maxCol;
            }
          }
        }
      } else if (event.key === 'ArrowLeft') {
        // Move left to previous non-empty cell or first non-empty cell
        const currentEmpty = isCellEmpty(startRow, startCol);

        if (currentEmpty) {
          // If current cell is empty, jump to previous non-empty cell
          for (let col = startCol - 1; col >= 0; col--) {
            if (!isCellEmpty(startRow, col)) {
              targetCol = col;
              break;
            }
          }
          // If no non-empty cell found, jump to first column
          if (targetCol === startCol) {
            targetCol = 0;
          }
        } else {
          // If current cell is non-empty, find the first consecutive non-empty cell
          let firstNonEmpty = startCol;
          for (let col = startCol - 1; col >= 0; col--) {
            if (!isCellEmpty(startRow, col)) {
              firstNonEmpty = col;
            } else {
              break;
            }
          }

          if (firstNonEmpty < startCol) {
            // Found consecutive non-empty cells, jump to the first one
            targetCol = firstNonEmpty;
          } else {
            // Previous cell is empty, jump to previous non-empty cell or beginning
            for (let col = startCol - 1; col >= 0; col--) {
              if (!isCellEmpty(startRow, col)) {
                targetCol = col;
                break;
              }
            }
            // If no non-empty cell found, jump to first column
            if (targetCol === startCol) {
              targetCol = 0;
            }
          }
        }
      }

      // Select the target cell
      hotInstance.selectCell(targetRow, targetCol);
    };

    // Use capture phase to intercept before Handsontable's default behavior
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Convert columns to Handsontable format
  const hotColumns = useMemo(() => {
    return columns.map((col, colIndex) => {
      // Check if this column has dropdown values by examining first row
      const firstCell =
        filteredData.length > 0 ? getCellContent([colIndex, 0]) : null;

      const hasDropdown =
        firstCell &&
        'data' in firstCell &&
        typeof firstCell.data === 'object' &&
        firstCell.data !== null &&
        'allowedValues' in firstCell.data;

      // Determine alignment and type based on column ID
      let className = 'htLeft'; // Default to left
      let columnType: 'text' | 'numeric' | 'autocomplete' = 'text';
      let numericFormat: { pattern: string } | undefined;

      if ('id' in col) {
        const columnId = col.id as string;

        // Currency columns with numeric formatting
        if (
          ['unitPrice', 'discount', 'adjustment', 'lineTotal'].includes(
            columnId
          )
        ) {
          className = 'htRight';
          columnType = 'numeric';
          numericFormat = {
            pattern: '0,0.00', // Thousand separator with 2 decimals
          };
        }
        // CENTER alignment
        else if (
          [
            'orderDate',
            'quantity',
            'orderStatus',
            'invoiceDate',
            'packedDate',
            'shipmentCode',
          ].includes(columnId)
        ) {
          className = 'htCenter';
        }
        // LEFT alignment (default)
        // customers, productCode, notes
      }

      if (hasDropdown && firstCell && 'data' in firstCell) {
        const cellData = firstCell.data as { allowedValues?: string[] };
        const allowedValues = cellData.allowedValues || [];

        return {
          data: colIndex,
          type: 'autocomplete',
          source: allowedValues,
          strict: true, // Only allow values from dropdown list
          allowInvalid: false, // Reject invalid entries
          title: col.title,
          width: 'width' in col && col.width ? col.width : 120,
          className: className, // Apply alignment class
        };
      }

      // Return column config with numeric formatting if applicable
      const columnConfig: {
        data: number;
        type: string;
        title: string;
        width: number;
        className: string;
        numericFormat?: { pattern: string };
      } = {
        data: colIndex,
        type: columnType,
        title: col.title,
        width: 'width' in col && col.width ? col.width : 120,
        className: className, // Apply alignment class
      };

      // Add numeric format for currency columns
      if (numericFormat) {
        columnConfig.numericFormat = numericFormat;
      }

      return columnConfig;
    });
  }, [columns, filteredData, getCellContent]);

  // Convert data to 2D array format for Handsontable
  const hotData = useMemo(() => {
    return filteredData.map((row, rowIndex) => {
      return columns.map((col, colIndex) => {
        const cell = getCellContent([colIndex, rowIndex]);

        // Handle dropdown cells (Custom cells with data.value)
        if (
          'data' in cell &&
          typeof cell.data === 'object' &&
          cell.data !== null &&
          'value' in cell.data
        ) {
          const cellData = cell.data as { value: string };
          return cellData.value || '';
        }

        // Handle regular cells
        if ('data' in cell) {
          return cell.data;
        }
        if ('displayData' in cell) {
          return cell.displayData;
        }
        return '';
      });
    });
  }, [filteredData, columns, getCellContent]);

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
    <Stack
      gap="md"
      className={className}
      style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
    >
      {/* Stats cards */}
      {statsCards && statsCards.length > 0 && (
        <SimpleGrid cols={statsCards.length} spacing="md">
          {statsCards.map((stat, index) => (
            <Card
              key={index}
              padding="md"
              radius="xl"
              withBorder={false}
              style={{
                cursor: 'default',
                background: stat.backgroundColor || 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)',
                },
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text
                    size="xs"
                    c="dark"
                    fw={600}
                    tt="uppercase"
                    style={{
                      opacity: 0.8,
                      textShadow: '0 1px 2px rgba(255, 255, 255, 0.3)',
                    }}
                  >
                    {stat.title}
                  </Text>
                  <Title
                    order={3}
                    mt={4}
                    c="dark"
                    style={{
                      textShadow: '0 1px 2px rgba(255, 255, 255, 0.3)',
                      fontWeight: 700,
                    }}
                  >
                    {stat.value}
                  </Title>
                </div>
                <ThemeIcon
                  variant="filled"
                  color="white"
                  size="lg"
                  radius="md"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                  }}
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
              enableCtrlF ? `${searchPlaceholder} (Ctrl+F)` : searchPlaceholder
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
                backgroundColor: '#ffffff',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                borderWidth: '1px',
                borderStyle: 'solid',
                color: '#333333',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                '&::placeholder': {
                  color: '#999999',
                },
                '&:focus': {
                  borderColor: '#667eea',
                  boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                },
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
                leftSection={<IconUpload size={16} />}
                value={csvFile}
                onChange={onFileChange}
                accept=".csv"
                size="md"
                radius="md"
              />
              <Button
                onClick={handleCSVImport}
                disabled={!csvFile}
                size="md"
                radius="md"
              >
                Import
              </Button>
            </>
          )}
          {actionButtons}
        </Group>
      </Group>

      {/* Handsontable Grid */}
      <div
        style={{
          width: '100%',
          overflow: 'hidden',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
        }}
      >
        <HotTable
          ref={hotRef}
          themeName="ht-theme-horizon"
          data={hotData}
          columns={hotColumns}
          colHeaders={columns.map((col) => col.title)}
          rowHeaders={true}
          width="100%"
          height={currentGridHeight - 40}
          licenseKey="non-commercial-and-evaluation"
          // Performance optimizations for large datasets (4795 rows)
          renderAllRows={false} // Virtual rendering - only render visible rows
          renderAllColumns={false} // Virtual rendering - only render visible columns
          viewportRowRenderingOffset={30} // Render 30 extra rows above/below viewport
          viewportColumnRenderingOffset={5} // Render 5 extra columns left/right
          // Styling
          stretchH="all"
          autoWrapRow={false}
          autoWrapCol={false}
          // Features
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={[]}
          filters={true}
          dropdownMenu={false}
          // Performance: Disable features that slow down large grids
          autoRowSize={false} // Disable auto row height calculation
          autoColumnSize={false} // Disable auto column width calculation
          rowHeights={50} // Set fixed row height (default is ~23px)
          columnHeaderHeight={50} // Set header height to match row height
          afterChange={(changes, source) => {
            if (!changes || !onCellEdited) return;

            // Debug: Log all change sources to understand what's happening
            console.log('📝 afterChange triggered:', {
              source,
              changesCount: changes.length,
            });

            // Detect batch operations:
            // - Paste operations: source contains 'paste' or 'Paste'
            // - Autofill operations: source contains 'Autofill'
            // - Batch delete/edit: multiple changes (more than 5) with 'edit' source
            const isPaste =
              source?.includes('paste') ||
              source?.includes('Paste') ||
              source?.includes('Autofill');

            const isBatchEdit = changes.length > 5 && source === 'edit';
            const isBatchOperation = isPaste || isBatchEdit;

            console.log('🔍 Batch detection:', {
              source,
              changesCount: changes.length,
              isPaste,
              isBatchEdit,
              isBatchOperation,
            });

            if (isBatchOperation) {
              console.log('🚀 BATCH OPERATION DETECTED - Starting batch mode');

              // Set batch mode flag to suppress notifications
              isBatchModeRef.current = true;
              batchCountRef.current = 0;

              // Signal batch mode START immediately
              window.dispatchEvent(new CustomEvent('handsontable-batch-start'));
              console.log('📢 Dispatched handsontable-batch-start event');

              // For paste operations, batch all changes and process after a short delay
              // This prevents the flickering caused by multiple rapid re-renders
              if (updateTimeoutRef.current) {
                clearTimeout(updateTimeoutRef.current);
              }

              updateTimeoutRef.current = setTimeout(() => {
                changes.forEach(([row, col, oldValue, newValue]) => {
                  if (oldValue !== newValue && typeof col === 'number') {
                    const isDropdownColumn =
                      hotColumns[col]?.type === 'autocomplete';

                    const cellData = {
                      kind: GridCellKind.Text,
                      data:
                        isDropdownColumn && newValue
                          ? { value: String(newValue) }
                          : String(newValue),
                      displayData: String(newValue),
                      allowOverlay: true,
                    } as GridCell & { _isBatchMode?: boolean };

                    // Mark as batch mode
                    (
                      cellData as unknown as { _isBatchMode: boolean }
                    )._isBatchMode = true;

                    onCellEdited([col, row], cellData as GridCell);
                    batchCountRef.current++;
                  }
                });

                // After all batch changes are done, dispatch a custom event with count
                setTimeout(() => {
                  isBatchModeRef.current = false;
                  window.dispatchEvent(
                    new CustomEvent('handsontable-batch-complete', {
                      detail: { count: batchCountRef.current },
                    })
                  );
                  batchCountRef.current = 0;
                }, 100);
              }, 100); // 100ms delay to batch paste operations
            } else {
              // For regular edits (typing), process immediately
              changes.forEach(([row, col, oldValue, newValue]) => {
                if (oldValue !== newValue && typeof col === 'number') {
                  const isDropdownColumn =
                    hotColumns[col]?.type === 'autocomplete';

                  const cellData = {
                    kind: GridCellKind.Text,
                    data:
                      isDropdownColumn && newValue
                        ? { value: String(newValue) }
                        : String(newValue),
                    displayData: String(newValue),
                    allowOverlay: true,
                  };

                  onCellEdited([col, row], cellData as GridCell);
                }
              });
            }
          }}
          afterSelectionEnd={(row, col) => {
            if (onCellClick && row >= 0 && col >= 0) {
              const rowData = filteredData[row];
              if (rowData) {
                onCellClick([col, row], rowData);
              }
            }
          }}
        />
      </div>

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
  );
}
