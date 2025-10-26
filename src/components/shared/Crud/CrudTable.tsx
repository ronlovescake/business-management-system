/**
 * Generic CRUD Table Component
 *
 * A reusable data table component with type safety, built on top of DataTable.
 * Provides standard CRUD operations (Create, Read, Update, Delete) with
 * configurable columns, actions, and filtering.
 *
 * @example
 * ```tsx
 * <CrudTable
 *   data={leaveRequests}
 *   columns={[
 *     { key: 'employeeName', label: 'Employee', sortable: true },
 *     { key: 'leaveType', label: 'Type', sortable: true },
 *     { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> }
 *   ]}
 *   onEdit={handleEdit}
 *   onDelete={handleDelete}
 *   onView={handleView}
 *   searchFields={['employeeName', 'leaveType']}
 * />
 * ```
 */

import { useMemo, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Skeleton, Stack } from '@mantine/core';
import { DataTable } from '@/components/ui/DataTable';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { GridCellKind } from '@glideapps/glide-data-grid';
import { useDataTable } from '@/hooks/useDataTable';

/**
 * Column configuration for CrudTable
 */
export interface CrudTableColumn<T> {
  /** Unique key matching the data property */
  key: keyof T | string;
  /** Display label for column header */
  label: string;
  /** Column width in pixels */
  width?: number;
  /** Enable sorting for this column */
  sortable?: boolean;
  /** Custom render function for cell content */
  render?: (item: T, value: unknown) => ReactNode;
  /** Custom text extraction for search/filter */
  getText?: (item: T) => string;
}

/**
 * Action configuration for row actions
 */
export interface CrudTableAction<T> {
  /** Action icon */
  icon: ReactNode;
  /** Tooltip label */
  label: string;
  /** Action handler */
  onClick: (item: T) => void;
  /** Color theme for the action */
  color?: string;
  /** Conditional visibility */
  show?: (item: T) => boolean;
}

/**
 * Props for CrudTable component
 */
export interface CrudTableProps<T> {
  /** Array of data items to display */
  data: T[];
  /** Column configuration */
  columns: CrudTableColumn<T>[];
  /** Fields to include in search */
  searchFields: (keyof T)[];
  /** Search placeholder text */
  searchPlaceholder?: string;

  // CRUD Actions
  /** Edit action handler */
  onEdit?: (item: T) => void;
  /** Delete action handler */
  onDelete?: (item: T) => void;
  /** View action handler */
  onView?: (item: T) => void;
  /** Custom actions */
  customActions?: CrudTableAction<T>[];

  // Optional features
  /** Statistics cards to display above table */
  statsCards?: Array<{
    title: string;
    value: string | number;
    icon: ReactNode;
    color?: string;
  }>;
  /** Action buttons to display in toolbar */
  actionButtons?: ReactNode;
  /** Enable CSV import */
  enableCSVImport?: boolean;
  /** CSV import handler */
  onCSVImport?: (file: File) => Promise<void>;
  /** Grid height */
  gridHeight?: number;
  /** Enable cell click */
  onCellClick?: (item: T) => void;
  /** Custom class name */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
}

/**
 * Generic CRUD Table Component
 *
 * Provides a complete data table with built-in CRUD operations,
 * search, filtering, and customizable columns.
 */
export function CrudTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchFields,
  searchPlaceholder = 'Search...',
  onEdit,
  onDelete,
  onView,
  customActions = [],
  statsCards,
  actionButtons,
  enableCSVImport = false,
  onCSVImport,
  gridHeight,
  onCellClick,
  className,
  loading = false,
  emptyMessage = 'No data available',
}: CrudTableProps<T>) {
  // Use data table hook for search/filter
  const { searchQuery, filteredData, handleSearch } = useDataTable({
    data,
    searchFields,
    initialSearchQuery: '',
  });

  // Convert CrudTableColumn to GridColumn
  const gridColumns = useMemo<GridColumn[]>(() => {
    const cols: GridColumn[] = columns.map((col) => ({
      title: col.label,
      width: col.width || 150,
      id: String(col.key),
    }));

    // Add actions column if any CRUD actions are provided
    if (onEdit || onDelete || onView || customActions.length > 0) {
      cols.push({
        title: 'Actions',
        width: 120,
        id: '__actions',
      });
    }

    return cols;
  }, [columns, onEdit, onDelete, onView, customActions]);

  // Create column key mapping
  const columnKeys = useMemo(() => {
    const keys: Record<string, keyof T> = {};
    columns.forEach((col) => {
      keys[String(col.key)] = col.key as keyof T;
    });
    return keys;
  }, [columns]);

  // Get cell content
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIndex, rowIndex] = cell;
      const column = gridColumns[colIndex];
      const item = filteredData[rowIndex];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      // Handle actions column
      if (column.id === '__actions') {
        return {
          kind: GridCellKind.Text,
          data: 'Actions',
          displayData: 'Actions',
          allowOverlay: false,
        };
      }

      // Get column config
      const colConfig = columns.find((c) => String(c.key) === column.id);
      if (!colConfig) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      // Get value
      const key = columnKeys[column.id as string];
      if (!key) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        };
      }

      const value = item[key];

      // Use custom getText if provided, otherwise convert to string
      let displayText: string;
      if (colConfig.getText) {
        displayText = colConfig.getText(item);
      } else if (value === null || value === undefined) {
        displayText = '';
      } else {
        displayText = String(value);
      }

      return {
        kind: GridCellKind.Text,
        data: displayText,
        displayData: displayText,
        allowOverlay: true,
      };
    },
    [gridColumns, filteredData, columns, columnKeys]
  );

  // Handle cell click
  const handleCellClick = useCallback(
    (cell: Item, rowData: T) => {
      const [colIndex] = cell;
      const column = gridColumns[colIndex];

      // Handle actions column click
      if (column?.id === '__actions') {
        // Show actions menu or trigger default action
        if (onView) {
          onView(rowData);
        } else if (onEdit) {
          onEdit(rowData);
        }
      } else if (onCellClick) {
        onCellClick(rowData);
      }
    },
    [gridColumns, onView, onEdit, onCellClick]
  );

  // Convert stats cards to DataTable format
  const dataTableStats = useMemo(() => {
    if (!statsCards) {
      return undefined;
    }
    return statsCards.map((card) => ({
      title: card.title,
      value: String(card.value),
      icon: card.icon,
      color: card.color || 'blue',
    }));
  }, [statsCards]);

  if (loading) {
    return (
      <Stack gap="md" p="md">
        <Skeleton height={40} radius="sm" />
        <Skeleton height={300} radius="sm" />
        <Skeleton height={50} radius="sm" />
      </Stack>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>{emptyMessage}</div>
    );
  }

  return (
    <DataTable
      data={data}
      filteredData={filteredData}
      columns={gridColumns}
      statsCards={dataTableStats}
      searchQuery={searchQuery}
      onSearch={handleSearch}
      searchPlaceholder={searchPlaceholder}
      getCellContent={getCellContent}
      onCellClick={handleCellClick}
      actionButtons={actionButtons}
      enableCSVImport={enableCSVImport}
      onCSVImport={onCSVImport}
      gridHeight={gridHeight}
      className={className}
    />
  );
}
