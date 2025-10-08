import React from 'react';
import { Group, Button } from '@mantine/core';
import { IconPlus, IconUserPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * EmployeeManagementLayout Component
 *
 * Reusable abstraction layer for employee management pages across:
 * - Clothing/Employees (Team, Attendance, Payroll, etc.)
 * - Trucking/Employees (Team, Attendance, Payroll, etc.)
 *
 * Separates:
 * - Business logic (calculations, validations) → stays in page.tsx
 * - UI layout (stats cards, buttons) → this component
 * - Grid implementation (DataTable) → swappable
 */

export interface EmployeeManagementLayoutProps<T = Record<string, unknown>> {
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
  onCellClick?: (cell: Item) => void;
  customRenderers?: readonly Record<string, unknown>[];

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  // Actions
  onAddEmployee?: () => void;
  onAddRecord?: () => void;
  addButtonLabel?: string;
  customActionButtons?: React.ReactNode;

  // Other Options
  enableCtrlF?: boolean;
}

export function EmployeeManagementLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search employees...',
  getCellContent,
  onCellEdited,
  onCellClick,
  customRenderers,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  onAddEmployee,
  onAddRecord,
  addButtonLabel,
  customActionButtons,
  enableCtrlF = false,
}: EmployeeManagementLayoutProps<T>) {
  // Action buttons
  const actionButtons = (
    <Group>
      {onAddEmployee && (
        <Button
          leftSection={<IconUserPlus size={16} />}
          variant="filled"
          color="green"
          onClick={onAddEmployee}
        >
          {addButtonLabel || 'Add Employee'}
        </Button>
      )}
      {onAddRecord && !onAddEmployee && (
        <Button
          leftSection={<IconPlus size={16} />}
          variant="filled"
          color="blue"
          onClick={onAddRecord}
        >
          {addButtonLabel || 'Add Record'}
        </Button>
      )}
      {customActionButtons}
    </Group>
  );

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
      onCellClick={onCellClick}
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
