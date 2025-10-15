import React from 'react';
import { Group, Button, Text, Loader, Pill } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { HandsontableGrid } from '@/components/ui/HandsontableGrid';
import type { StatCard } from '@/components/ui';
import type { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';

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
  columns: GridColumn[];

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

export function TransactionsLayout<
  T extends Item = Record<string, unknown> & Item,
>({
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
  getCellContent,
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
    </Group>
  );

  return (
    <HandsontableGrid
      className="transactions-grid"
      data={data as readonly Item[]}
      filteredData={filteredData as readonly Item[]}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder={searchPlaceholder}
      getCellContent={getCellContent}
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
