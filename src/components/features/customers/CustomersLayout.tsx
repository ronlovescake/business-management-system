import React from 'react';
import { Group, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * CustomersLayout Component
 *
 * Abstraction layer for customers page that separates:
 * - Business logic (customer data, calculations) → stays in page.tsx
 * - UI layout (stats cards, buttons) → this component
 * - Grid implementation (DataTable) → swappable
 */

export interface CustomersLayoutProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];
  columns: GridColumn[];

  // Stats
  statsCards?: StatCard[];

  // Search
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;

  // Grid Interaction
  getCellContent: (cell: Item) => GridCell;
  onCellEdited?: (cell: Item, newValue: GridCell) => void;
  customRenderers?: readonly Record<string, unknown>[];

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  // Actions
  onAddRows?: () => void;

  // Other Options
  enableCtrlF?: boolean;
}

export function CustomersLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search customers by name, code, or contact...',
  getCellContent,
  onCellEdited,
  customRenderers,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  onAddRows,
  enableCtrlF = false,
}: CustomersLayoutProps<T>) {
  // Action buttons
  const actionButtons = onAddRows ? (
    <Group>
      <Button
        leftSection={<IconPlus size={16} />}
        variant="filled"
        color="green"
        onClick={onAddRows}
      >
        Add 10 Rows
      </Button>
    </Group>
  ) : undefined;

  return (
    <DataTable
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder={searchPlaceholder}
      getCellContent={getCellContent}
      onCellEdited={onCellEdited}
      statsCards={statsCards}
      enableCSVImport={enableCSVImport}
      enableCtrlF={enableCtrlF}
      csvFile={csvFile}
      onFileChange={onFileChange}
      onCSVImport={onCSVImport}
      customRenderers={customRenderers}
      actionButtons={actionButtons}
    />
  );
}
