import React from 'react';
import dynamic from 'next/dynamic';
import { Text, Loader } from '@mantine/core';
import type { StatCard } from '@/components/ui';
import type {
  HandsontableColumn,
  GetCellData,
  CellEditEvent,
  HandsontableGridProps,
  CellClickEvent,
} from '@/components/ui/HandsontableGrid';
import { useTransactionsLayout } from './hooks/useTransactionsLayout';

type HandsontableGridComponent = <T extends object>(
  props: HandsontableGridProps<T>
) => JSX.Element;

// Lazy load HandsontableGrid to reduce initial bundle size
// This is a large dependency (handsontable library) that's only needed when viewing tables
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
) as HandsontableGridComponent;

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
  secondarySearchControl?: React.ReactNode;

  // Stats
  statsCards?: StatCard[];

  // Status Filters
  statusOptions?: string[];
  selectedStatuses?: Set<string>;
  onStatusFilter?: (status: string) => void;

  // Grid Interaction
  getCellData: GetCellData<T>;
  onCellEdited?: (
    edit: CellEditEvent<T>
  ) => void | boolean | Promise<void | boolean>;
  onCellClick?: (event: CellClickEvent<T>) => void;

  // CSV Import
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;

  // Actions
  onGenerateInvoice?: (data: T[]) => void | Promise<void>;
  onGeneratePackingList?: (data: T[]) => void | Promise<void>;
  onGenerateDistribution?: (data: T[]) => void | Promise<void>;
  showActionButtons?: boolean;
  extraActionButtons?: React.ReactNode;

  // Loading States
  isGeneratingInvoice?: boolean;
  isGeneratingPackingList?: boolean;
  isGeneratingDistribution?: boolean;

  // Other Options
  enableCtrlF?: boolean;

  // Scroll Behavior
  scrollToLastNonEmptyRows?: number;
  stretchColumnId?: string;
}

export function TransactionsLayout<T extends object = Record<string, unknown>>({
  data,
  filteredData,
  columns,
  searchQuery,
  onSearch,
  searchPlaceholder = 'Search transactions...',
  secondarySearchControl,
  statsCards,
  statusOptions = [],
  selectedStatuses = new Set(),
  onStatusFilter,
  getCellData,
  onCellEdited,
  onCellClick,
  enableCSVImport = false,
  csvFile,
  onFileChange,
  onCSVImport,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  showActionButtons = true,
  extraActionButtons,
  isGeneratingInvoice = false,
  isGeneratingPackingList = false,
  isGeneratingDistribution = false,
  enableCtrlF = false,
  // scrollToLastNonEmptyRows removed with feature
  stretchColumnId,
}: TransactionsLayoutProps<T>) {
  // Use hook for export, filters, and action buttons
  const { searchRightButtons, actionButtons } = useTransactionsLayout({
    filteredData,
    statusOptions,
    selectedStatuses,
    onStatusFilter,
    extraActionButtons,
    showActionButtons,
    onGenerateInvoice,
    onGeneratePackingList,
    onGenerateDistribution,
    isGeneratingInvoice,
    isGeneratingPackingList,
    isGeneratingDistribution,
  });

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
      onCellClick={onCellClick}
      statsCards={statsCards as StatCard[]}
      enableCSVImport={enableCSVImport}
      enableCtrlF={enableCtrlF}
      csvFile={csvFile || null}
      onFileChange={onFileChange || (() => {})}
      onCSVImport={onCSVImport}
      searchRightButtons={
        secondarySearchControl ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                flex: '1 1 260px',
                minWidth: 160,
                transition: 'flex-basis 220ms ease, min-width 220ms ease',
              }}
            >
              {secondarySearchControl}
            </div>
            <div
              style={{
                flex: '0 0 auto',
                minWidth: 'max-content',
                display: 'flex',
                justifyContent: 'flex-end',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              {searchRightButtons}
            </div>
          </div>
        ) : (
          searchRightButtons
        )
      }
      searchBottomContent={undefined}
      stackActionsBelowSearch={false}
      actionButtons={actionButtons}
      showFooter={false}
      // scrollToLastNonEmptyRows removed
      stretchColumnId={stretchColumnId}
    />
  );
}
