import React from 'react';
import { Group, Button } from '@mantine/core';
import { IconPlus, IconCalendar, IconDownload } from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * AttendanceLayout Component
 *
 * Specialized layout for attendance tracking pages.
 * Includes date range filters and export functionality.
 */

export interface AttendanceLayoutProps<T = Record<string, unknown>> {
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
  customRenderers?: readonly Record<string, unknown>[];

  // Date Filtering
  dateRange?: { start: Date | null; end: Date | null };
  onDateRangeChange?: (start: Date | null, end: Date | null) => void;

  // Actions
  onAddAttendance?: () => void;
  onExportReport?: () => void;
  isExporting?: boolean;

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  enableCtrlF?: boolean;
}

export function AttendanceLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  getCellContent,
  onCellEdited,
  customRenderers,
  dateRange,
  onDateRangeChange,
  onAddAttendance,
  onExportReport,
  isExporting = false,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  enableCtrlF = false,
}: AttendanceLayoutProps<T>) {
  const actionButtons = (
    <Group>
      {onAddAttendance && (
        <Button
          leftSection={<IconPlus size={16} />}
          variant="filled"
          color="green"
          onClick={onAddAttendance}
        >
          Add Attendance
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

  const searchRightButtons =
    onDateRangeChange && dateRange ? (
      <Group gap="xs">
        <DateInput
          placeholder="Start Date"
          value={dateRange.start}
          onChange={(date: Date | null) =>
            onDateRangeChange(date, dateRange.end)
          }
          leftSection={<IconCalendar size={16} />}
          clearable
          {...COMMON_DATE_INPUT_PROPS}
        />
        <DateInput
          placeholder="End Date"
          value={dateRange.end}
          onChange={(date: Date | null) =>
            onDateRangeChange(dateRange.start, date)
          }
          leftSection={<IconCalendar size={16} />}
          clearable
          {...COMMON_DATE_INPUT_PROPS}
        />
      </Group>
    ) : undefined;

  return (
    <DataTable
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search attendance records..."
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
      searchRightButtons={searchRightButtons}
    />
  );
}
