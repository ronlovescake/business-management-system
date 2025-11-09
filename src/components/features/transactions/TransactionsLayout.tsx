import React from 'react';
import dynamic from 'next/dynamic';
import { Group, Button, Text, Loader, Pill } from '@mantine/core';
import { IconPlus, IconFileSpreadsheet } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import type { StatCard } from '@/components/ui';
import type {
  HandsontableColumn,
  GetCellData,
  CellEditEvent,
  HandsontableGridProps,
} from '@/components/ui/HandsontableGrid';

// Lazy load HandsontableGrid to reduce initial bundle size
// This is a large dependency (handsontable library) that's only needed when viewing tables
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const HandsontableGrid = dynamic(
  () =>
    import('@/components/ui/HandsontableGrid').then(
      (mod) => mod.HandsontableGrid
    ),
  {
    ssr: false,
    loading: () => (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <Loader size="lg" />
        <Text mt="md">Loading table...</Text>
      </div>
    ),
  }
) as unknown as <T extends object>(
  props: HandsontableGridProps<T>
) => JSX.Element;

/**
 * TransactionsLayout Component
 *
 * This component provides an abstraction layer between the transactions page
 * and the data grid implementation. It handles:
 * - Layout structure (stats cards, filters, action buttons)
 * - UI presentation and styling
 * - Passing data and handlers to the grid
 *
 * Benefits:
 * - Separates business logic from presentation
 * - Makes grid implementation swappable
 * - Keeps critical business logic protected in the page component
 */

export interface TransactionsLayoutProps<T = Record<string, unknown>> {
  // Data
  data: T[];
  filteredData: T[];
  columns: HandsontableColumn[];

  // Search
  searchQuery: string;
  onSearch: (query: string) => void;
  searchPlaceholder?: string;

  // Stats
  statsCards?: StatCard[];

  // Status Filters
  statusOptions?: string[];
  selectedStatuses?: Set<string>;
  onStatusFilter?: (status: string) => void;

  // Grid Interaction
  getCellData: GetCellData<T>;
  onCellEdited?: (edit: CellEditEvent<T>) => void;

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  // Actions
  onAddRows?: () => void;
  onGenerateInvoice?: (data: T[]) => void | Promise<void>;
  onGeneratePackingList?: (data: T[]) => void | Promise<void>;
  onGenerateDistribution?: (data: T[]) => void | Promise<void>;

  // Loading States
  isGeneratingInvoice?: boolean;
  isGeneratingPackingList?: boolean;
  isGeneratingDistribution?: boolean;

  // Other Options
  enableCtrlF?: boolean;
}

export function TransactionsLayout<T extends object = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search transactions...',
  statsCards,
  statusOptions = [],
  selectedStatuses = new Set(),
  onStatusFilter,
  getCellData,
  onCellEdited,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  onAddRows,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice = false,
  isGeneratingPackingList = false,
  isGeneratingDistribution = false,
  enableCtrlF = false,
}: TransactionsLayoutProps<T>) {
  // Export to XLSX function
  const handleExportToXLSX = React.useCallback(() => {
    try {
      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Convert filtered data to worksheet
      const ws = XLSX.utils.json_to_sheet(filteredData);

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      // Generate filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, '');
      const filename = `transactions-${timestamp}.xlsx`;

      // Write and download the file
      XLSX.writeFile(wb, filename);

      showNotification({
        title: '✅ Export Successful',
        message: `Downloaded ${filteredData.length} transactions to ${filename}`,
        color: 'green',
        autoClose: 5000,
      });
    } catch (error) {
      showNotification({
        title: '❌ Export Failed',
        message:
          error instanceof Error ? error.message : 'Failed to export data',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [filteredData]);

  // Footer with Add Rows button and count
  const footerLeft = onAddRows ? (
    <Group gap="md" align="center">
      <Button
        variant="outline"
        size="sm"
        leftSection={<IconPlus size={14} />}
        onClick={onAddRows}
      >
        Add 10 Rows
      </Button>
      <Text size="sm" c="dimmed">
        {`Showing ${filteredData.length} of ${data.length} transactions`}
      </Text>
    </Group>
  ) : undefined;

  // Status filter pills
  const searchRightButtons =
    statusOptions.length > 0 && onStatusFilter ? (
      <Group gap="xs" wrap="wrap">
        {statusOptions.map((status) => (
          <Pill
            key={status}
            size="md"
            withRemoveButton={false}
            onClick={() => onStatusFilter(status)}
            style={{
              backgroundColor: selectedStatuses.has(status)
                ? '#228be6'
                : '#e9ecef',
              color: selectedStatuses.has(status) ? '#ffffff' : '#495057',
              cursor: 'pointer',
              fontWeight: selectedStatuses.has(status) ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              if (!selectedStatuses.has(status)) {
                e.currentTarget.style.backgroundColor = '#dee2e6';
              }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              if (!selectedStatuses.has(status)) {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }
            }}
          >
            {status}
          </Pill>
        ))}
      </Group>
    ) : undefined;

  // Action buttons for document generation
  const actionButtons = (
    <Group>
      {onGenerateDistribution && (
        <Button
          leftSection={
            isGeneratingDistribution ? (
              <Loader size={16} color="white" />
            ) : undefined
          }
          variant="outline"
          onClick={() => onGenerateDistribution(filteredData)}
          disabled={isGeneratingDistribution}
          style={{
            backgroundColor: isGeneratingDistribution ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingDistribution ? '#ef4444' : '#c8e6fd',
            borderWidth: '1px',
            color: isGeneratingDistribution ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingDistribution ? 'GENERATING...' : 'Create Distribution'}
        </Button>
      )}
      {onGenerateInvoice && (
        <Button
          leftSection={
            isGeneratingInvoice ? <Loader size={16} color="white" /> : undefined
          }
          variant="outline"
          onClick={() => onGenerateInvoice(filteredData)}
          disabled={isGeneratingInvoice}
          style={{
            backgroundColor: isGeneratingInvoice ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingInvoice ? '#ef4444' : '#c8e6fd',
            borderWidth: '1px',
            color: isGeneratingInvoice ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingInvoice ? 'GENERATING...' : 'Create Invoice'}
        </Button>
      )}
      {onGeneratePackingList && (
        <Button
          leftSection={
            isGeneratingPackingList ? (
              <Loader size={16} color="white" />
            ) : undefined
          }
          variant="outline"
          onClick={() => onGeneratePackingList(filteredData)}
          disabled={isGeneratingPackingList}
          style={{
            backgroundColor: isGeneratingPackingList ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingPackingList ? '#ef4444' : '#c8e6fd',
            borderWidth: '1px',
            color: isGeneratingPackingList ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingPackingList ? 'GENERATING...' : 'Create Packing List'}
        </Button>
      )}
      <Button
        leftSection={<IconFileSpreadsheet size={16} />}
        variant="outline"
        onClick={handleExportToXLSX}
        style={{
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: '1px',
          color: '#ffffff',
          width: '175px',
        }}
      >
        Export to XLSX
      </Button>
    </Group>
  );

  return (
    <HandsontableGrid<T>
      className="transactions-grid"
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder={searchPlaceholder}
      getCellData={getCellData}
      onCellEdited={onCellEdited}
      statsCards={statsCards as StatCard[]}
      enableCSVImport={enableCSVImport}
      enableCtrlF={enableCtrlF}
      csvFile={csvFile || null}
      onFileChange={onFileChange || (() => {})}
      onCSVImport={onCSVImport}
      footerLeft={footerLeft}
      searchRightButtons={searchRightButtons}
      actionButtons={actionButtons}
    />
  );
}
