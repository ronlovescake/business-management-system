import React from 'react';
import { Group, Button, Badge } from '@mantine/core';
import { IconTruck, IconDownload } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * TripsLayout Component
 *
 * Specialized layout for trucking trips management.
 * Includes trip status filtering and route tracking.
 */

export interface TripsLayoutProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];
  columns: GridColumn[];

  // Stats
  statsCards?: StatCard[];

  // Search
  searchQuery: string;
  onSearch: (query: string) => void;

  // Grid Interaction
  getCellContent: (cell: Item) => GridCell;
  onCellEdited?: (cell: Item, newValue: GridCell) => void;
  onCellClick?: (cell: Item) => void;
  customRenderers?: readonly Record<string, unknown>[];

  // Trip Status Filtering
  tripStatuses?: string[];
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;

  // Actions
  onAddTrip?: () => void;
  onViewMap?: (tripId: string) => void;
  onExportReport?: () => void;
  isExporting?: boolean;

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  enableCtrlF?: boolean;
}

export function TripsLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  getCellContent,
  onCellEdited,
  onCellClick,
  customRenderers,
  tripStatuses = ['All', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'],
  selectedStatus,
  onStatusChange,
  onAddTrip,
  onExportReport,
  isExporting = false,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  enableCtrlF = false,
}: TripsLayoutProps<T>) {
  const actionButtons = (
    <Group>
      {onAddTrip && (
        <Button
          leftSection={<IconTruck size={16} />}
          variant="filled"
          color="green"
          onClick={onAddTrip}
        >
          Add Trip
        </Button>
      )}
      {onExportReport && (
        <Button
          leftSection={<IconDownload size={16} />}
          variant="outline"
          color="blue"
          onClick={onExportReport}
          loading={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export Report'}
        </Button>
      )}
    </Group>
  );

  const searchRightButtons = onStatusChange ? (
    <Group gap="xs">
      {tripStatuses.map((status) => (
        <Badge
          key={status}
          size="lg"
          variant={selectedStatus === status ? 'filled' : 'light'}
          color={
            status === 'Completed'
              ? 'green'
              : status === 'In Progress'
                ? 'blue'
                : status === 'Scheduled'
                  ? 'yellow'
                  : status === 'Cancelled'
                    ? 'red'
                    : 'gray'
          }
          style={{ cursor: 'pointer' }}
          onClick={() => onStatusChange(status)}
        >
          {status}
        </Badge>
      ))}
    </Group>
  ) : undefined;

  return (
    <DataTable
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search trips by route, driver, truck..."
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
      searchRightButtons={searchRightButtons}
    />
  );
}
