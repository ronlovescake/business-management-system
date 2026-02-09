import React from 'react';
import { Group, Button, Stack } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { UniversalModal } from '@/components/modals/UniversalModal';

/**
 * ShipmentsLayout Component
 *
 * Abstraction layer for shipments page that separates:
 * - Business logic (calculations, API calls) → stays in page.tsx
 * - UI layout (stats cards, buttons, modals) → this component
 * - Grid implementation (DataTable) → swappable
 */

export interface ShipmentsLayoutProps<T = Record<string, unknown>> {
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

  // Add Shipment Modal
  addModalOpen?: boolean;
  onAddModalOpenChange?: (open: boolean) => void;
  onAddShipmentClick?: () => void;
  addShipmentForm?: React.ReactNode;

  // Edit Shipment Modal
  editModalOpen?: boolean;
  onEditModalOpenChange?: (open: boolean) => void;
  editShipmentForm?: React.ReactNode;

  // Other Options
  enableCtrlF?: boolean;
}

export function ShipmentsLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search shipments...',
  getCellContent,
  onCellEdited,
  onCellClick,
  customRenderers,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  addModalOpen = false,
  onAddModalOpenChange,
  onAddShipmentClick,
  addShipmentForm,
  editModalOpen = false,
  onEditModalOpenChange,
  editShipmentForm,
  enableCtrlF = false,
}: ShipmentsLayoutProps<T>) {
  // Action button for adding shipment
  const actionButtons = onAddShipmentClick ? (
    <Group>
      <Button
        leftSection={<IconPlus size={16} />}
        variant="filled"
        color="green"
        onClick={onAddShipmentClick}
      >
        Add Shipment
      </Button>
    </Group>
  ) : undefined;

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

      {/* Add Shipment Modal */}
      {addShipmentForm && onAddModalOpenChange && (
        <UniversalModal
          opened={addModalOpen}
          onClose={() => onAddModalOpenChange(false)}
          title="Add New Shipment"
          size="lg"
          centered
        >
          <Stack gap="md">{addShipmentForm}</Stack>
        </UniversalModal>
      )}

      {/* Edit Shipment Modal */}
      {editShipmentForm && onEditModalOpenChange && (
        <UniversalModal
          opened={editModalOpen}
          onClose={() => onEditModalOpenChange(false)}
          title="Edit Shipment"
          size="lg"
          centered
        >
          <Stack gap="md">{editShipmentForm}</Stack>
        </UniversalModal>
      )}
    </>
  );
}
