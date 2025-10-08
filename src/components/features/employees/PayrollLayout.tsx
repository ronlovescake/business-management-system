import React from 'react';
import { Group, Button, Select } from '@mantine/core';
import { IconDownload, IconCalculator } from '@tabler/icons-react';
import { DataTable } from '@/components/ui/DataTable';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

/**
 * PayrollLayout Component
 *
 * Specialized layout for payroll management pages.
 * Includes pay period selection and payroll processing actions.
 */

export interface PayrollLayoutProps<T = Record<string, unknown>> {
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

  // Pay Period
  payPeriods?: { value: string; label: string }[];
  selectedPayPeriod?: string;
  onPayPeriodChange?: (value: string) => void;

  // Actions
  onProcessPayroll?: () => void;
  onGeneratePayslips?: () => void;
  onExportPayroll?: () => void;
  isProcessing?: boolean;
  isGenerating?: boolean;
  isExporting?: boolean;

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  enableCtrlF?: boolean;
}

export function PayrollLayout<T = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  statsCards,
  searchQuery,
  onSearch,
  getCellContent,
  onCellEdited,
  customRenderers,
  payPeriods,
  selectedPayPeriod,
  onPayPeriodChange,
  onProcessPayroll,
  onGeneratePayslips,
  onExportPayroll,
  isProcessing = false,
  isGenerating = false,
  isExporting = false,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  enableCtrlF = false,
}: PayrollLayoutProps<T>) {
  const actionButtons = (
    <Group>
      {onProcessPayroll && (
        <Button
          leftSection={<IconCalculator size={16} />}
          variant="filled"
          color="green"
          onClick={onProcessPayroll}
          loading={isProcessing}
        >
          {isProcessing ? 'Processing...' : 'Process Payroll'}
        </Button>
      )}
      {onGeneratePayslips && (
        <Button
          leftSection={<IconDownload size={16} />}
          variant="outline"
          color="blue"
          onClick={onGeneratePayslips}
          loading={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Payslips'}
        </Button>
      )}
      {onExportPayroll && (
        <Button
          leftSection={<IconDownload size={16} />}
          variant="outline"
          color="gray"
          onClick={onExportPayroll}
          loading={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export'}
        </Button>
      )}
    </Group>
  );

  const searchRightButtons =
    onPayPeriodChange && payPeriods ? (
      <Select
        placeholder="Select Pay Period"
        data={payPeriods}
        value={selectedPayPeriod}
        onChange={(value) => value && onPayPeriodChange(value)}
        style={{ minWidth: 200 }}
      />
    ) : undefined;

  return (
    <DataTable
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search payroll records..."
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
