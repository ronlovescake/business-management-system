'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
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

  // Set grid height to 83vh by default
  useEffect(() => {
    const updateGridHeight = () => {
      const targetHeight = gridHeight || window.innerHeight * 0.83;
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
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableCtrlF]);

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

      if (hasDropdown && firstCell && 'data' in firstCell) {
        const cellData = firstCell.data as { allowedValues?: string[] };
        const allowedValues = cellData.allowedValues || [];

        return {
          data: colIndex,
          type: 'autocomplete',
          source: allowedValues,
          strict: false,
          allowInvalid: true,
          title: col.title,
          width: 'width' in col && col.width ? col.width : 120,
        };
      }

      return {
        data: colIndex,
        type: 'text',
        title: col.title,
        width: 'width' in col && col.width ? col.width : 120,
      };
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
              shadow="xs"
              padding="md"
              radius="md"
              withBorder
              bg={stat.backgroundColor || '#ffffff'}
              style={{
                cursor: 'default',
                transition: 'transform 0.1s ease',
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="xs" c="dimmed" fw={500} tt="uppercase">
                    {stat.title}
                  </Text>
                  <Title order={3} mt={4}>
                    {stat.value}
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
                borderColor: '#dee2e6',
                borderWidth: '1px',
                borderStyle: 'solid',
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
      <Card
        withBorder
        shadow="sm"
        radius="md"
        padding="md"
        style={{
          minHeight: currentGridHeight,
          width: '100%',
          maxWidth: '100%',
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}
      >
        <HotTable
          ref={hotRef}
          data={hotData}
          columns={hotColumns}
          colHeaders={columns.map((col) => col.title)}
          rowHeaders={true}
          width="100%"
          height={currentGridHeight - 40}
          licenseKey="non-commercial-and-evaluation"
          stretchH="all"
          autoWrapRow={true}
          autoWrapCol={true}
          manualColumnResize={true}
          manualRowResize={true}
          contextMenu={true}
          filters={true}
          dropdownMenu={true}
          afterChange={(changes) => {
            if (!changes || !onCellEdited) return;

            changes.forEach(([row, col, oldValue, newValue]) => {
              if (oldValue !== newValue && typeof col === 'number') {
                onCellEdited([col, row], {
                  kind: GridCellKind.Text,
                  data: String(newValue),
                  displayData: String(newValue),
                  allowOverlay: true,
                });
              }
            });
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
  );
}
