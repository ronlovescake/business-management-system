import React from 'react';
import { Group, Button, Modal, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * SortingDistributionLayout Component
 *
 * Abstraction layer for sorting-distribution page that separates:
 * - Business logic (sorting calculations, distribution logic) → stays in page.tsx
 * - UI layout (stats cards, buttons, modals) → this component
 * - Grid implementation (DataTable) → swappable
 */

export interface SortingDistributionLayoutProps<T = Record<string, unknown>> {
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
  onAddEntry?: () => void;
  onGenerateReport?: () => void;
  isGeneratingReport?: boolean;

  // Add Entry Modal
  addModalOpen?: boolean;
  onAddModalOpenChange?: (open: boolean) => void;
  addEntryForm?: React.ReactNode;

  // Other Options
  enableCtrlF?: boolean;
}

export function SortingDistributionLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search sorting distribution entries...',
  getCellContent,
  onCellEdited,
  customRenderers,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  onAddEntry,
  onGenerateReport,
  isGeneratingReport = false,
  addModalOpen = false,
  onAddModalOpenChange,
  addEntryForm,
  enableCtrlF = false,
}: SortingDistributionLayoutProps<T>) {
  // Action buttons
  const actionButtons = (
    <Group>
      {onAddEntry && (
        <Button
          leftSection={<IconPlus size={16} />}
          variant="filled"
          color="green"
          onClick={onAddEntry}
        >
          Add Entry
        </Button>
      )}
      {onGenerateReport && (
        <Button
          variant="outline"
          color="blue"
          onClick={onGenerateReport}
          loading={isGeneratingReport}
        >
          {isGeneratingReport ? 'Generating...' : 'Generate Report'}
        </Button>
      )}
    </Group>
  );

  return (
    <>
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

      {/* Add Entry Modal */}
      {addEntryForm && onAddModalOpenChange && (
        <Modal
          opened={addModalOpen}
          onClose={() => onAddModalOpenChange(false)}
          title="Add Sorting Distribution Entry"
          size="lg"
          centered
        >
          <Stack gap="md">{addEntryForm}</Stack>
        </Modal>
      )}
    </>
  );
}
