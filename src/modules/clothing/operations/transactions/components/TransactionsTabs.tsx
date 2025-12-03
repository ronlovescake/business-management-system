'use client';

import React, { memo } from 'react';
import { Tabs } from '@mantine/core';
import { TransactionsLayout } from '@/components/features/transactions';
import type {
  HandsontableColumn,
  GetCellData,
} from '@/components/ui/HandsontableGrid';
import type { TransactionData } from '../types/transaction.types';
import type { DueDateGridRow } from '@/lib/transactions';
import { DUE_DATE_FILTER_OPTIONS } from '@/lib/transactions';
import type { CellEditEvent } from '@/components/ui/HandsontableGrid';
import { TransactionsStatsSection } from './TransactionsStatsSection';
import type { TransactionStatistics } from '../types/transaction.types';

export type TransactionsTabValue =
  | 'main'
  | 'packing-list'
  | 'packed'
  | 'due-dates'
  | 'recently-updated';

interface BaseTabProps {
  searchQuery: string;
  onSearch: (query: string) => void;
  stretchColumnId?: string;
}

interface MainTransactionsTabProps extends BaseTabProps {
  transactions: TransactionData[];
  filteredData: TransactionData[];
  columns: HandsontableColumn[];
  getCellData: GetCellData<TransactionData>;
  onCellEdited: (event: CellEditEvent<TransactionData>) => void;
  statusOptions: string[];
  selectedStatuses: Set<string>;
  onStatusFilter: (status: string) => void;
  onGenerateInvoice: (data: TransactionData[]) => void | Promise<void>;
  onGeneratePackingList: (data: TransactionData[]) => void | Promise<void>;
  onGenerateDistribution: (data: TransactionData[]) => void | Promise<void>;
  isGeneratingInvoice: boolean;
  isGeneratingPackingList: boolean;
  isGeneratingDistribution: boolean;
}

const MainTransactionsTab = memo(function MainTransactionsTab({
  transactions,
  filteredData,
  columns,
  getCellData,
  onCellEdited,
  statusOptions,
  selectedStatuses,
  onStatusFilter,
  searchQuery,
  onSearch,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice,
  isGeneratingPackingList,
  isGeneratingDistribution,
  stretchColumnId,
}: MainTransactionsTabProps) {
  return (
    <TransactionsLayout<TransactionData>
      data={transactions}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search transactions by customer, product code, status, notes, or shipment code..."
      getCellData={getCellData}
      onCellEdited={onCellEdited}
      enableCSVImport={false}
      enableCtrlF={true}
      statusOptions={statusOptions}
      selectedStatuses={selectedStatuses}
      onStatusFilter={onStatusFilter}
      onGenerateInvoice={onGenerateInvoice}
      onGeneratePackingList={onGeneratePackingList}
      onGenerateDistribution={onGenerateDistribution}
      isGeneratingInvoice={isGeneratingInvoice}
      isGeneratingPackingList={isGeneratingPackingList}
      isGeneratingDistribution={isGeneratingDistribution}
      stretchColumnId={stretchColumnId}
    />
  );
});

interface ReadOnlyTransactionsTabProps<T extends object> extends BaseTabProps {
  data: T[];
  filteredData: T[];
  columns: HandsontableColumn[];
  getCellData: GetCellData<T>;
  searchPlaceholder: string;
}

function ReadOnlyTransactionsTabComponent<T extends object>({
  data,
  filteredData,
  columns,
  getCellData,
  searchQuery,
  onSearch,
  searchPlaceholder,
  stretchColumnId,
}: ReadOnlyTransactionsTabProps<T>) {
  return (
    <TransactionsLayout<T>
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder={searchPlaceholder}
      getCellData={getCellData}
      enableCSVImport={false}
      enableCtrlF={true}
      statusOptions={[]}
      showActionButtons={false}
      stretchColumnId={stretchColumnId}
    />
  );
}

const ReadOnlyTransactionsTab = memo(
  ReadOnlyTransactionsTabComponent
) as typeof ReadOnlyTransactionsTabComponent;

interface DueDatesTabProps extends BaseTabProps {
  data: DueDateGridRow[];
  filteredData: DueDateGridRow[];
  columns: HandsontableColumn[];
  getCellData: GetCellData<DueDateGridRow>;
  dueDateFilters: Set<string>;
  onDueDateFilter: (filter: string) => void;
  statusOptions: string[];
}

const DueDatesTab = memo(function DueDatesTab({
  data,
  filteredData,
  columns,
  getCellData,
  dueDateFilters,
  onDueDateFilter,
  statusOptions,
  searchQuery,
  onSearch,
  stretchColumnId,
}: DueDatesTabProps) {
  return (
    <TransactionsLayout<DueDateGridRow>
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search due dates by customer or product code..."
      getCellData={getCellData}
      enableCSVImport={false}
      enableCtrlF={true}
      statusOptions={statusOptions}
      selectedStatuses={dueDateFilters}
      onStatusFilter={onDueDateFilter}
      showActionButtons={false}
      stretchColumnId={stretchColumnId}
    />
  );
});

interface RecentlyUpdatedTabProps extends BaseTabProps {
  data: TransactionData[];
  filteredData: TransactionData[];
  columns: HandsontableColumn[];
  getCellData: GetCellData<TransactionData>;
  statusOptions: string[];
  selectedStatuses: Set<string>;
  onStatusFilter: (status: string) => void;
  onGenerateInvoice: (data: TransactionData[]) => void | Promise<void>;
  onGeneratePackingList: (data: TransactionData[]) => void | Promise<void>;
  onGenerateDistribution: (data: TransactionData[]) => void | Promise<void>;
  isGeneratingInvoice: boolean;
  isGeneratingPackingList: boolean;
  isGeneratingDistribution: boolean;
}

const RecentlyUpdatedTab = memo(function RecentlyUpdatedTab({
  data,
  filteredData,
  columns,
  getCellData,
  statusOptions,
  selectedStatuses,
  onStatusFilter,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice,
  isGeneratingPackingList,
  isGeneratingDistribution,
  searchQuery,
  onSearch,
  stretchColumnId,
}: RecentlyUpdatedTabProps) {
  return (
    <TransactionsLayout<TransactionData>
      data={data}
      filteredData={filteredData}
      columns={columns}
      searchQuery={searchQuery}
      onSearch={onSearch}
      searchPlaceholder="Search recently updated transactions..."
      getCellData={getCellData}
      enableCSVImport={false}
      enableCtrlF={true}
      showActionButtons={false}
      statusOptions={statusOptions}
      selectedStatuses={selectedStatuses}
      onStatusFilter={onStatusFilter}
      onGenerateInvoice={onGenerateInvoice}
      onGeneratePackingList={onGeneratePackingList}
      onGenerateDistribution={onGenerateDistribution}
      isGeneratingInvoice={isGeneratingInvoice}
      isGeneratingPackingList={isGeneratingPackingList}
      isGeneratingDistribution={isGeneratingDistribution}
      stretchColumnId={stretchColumnId}
    />
  );
});

interface TransactionsTabsProps extends BaseTabProps {
  activeTab: TransactionsTabValue;
  onTabChange: (value: TransactionsTabValue) => void;
  statistics: TransactionStatistics;
  transactions: TransactionData[];
  cappedFilteredTransactions: TransactionData[];
  columns: HandsontableColumn[];
  getCellData: GetCellData<TransactionData>;
  onCellEdited: (event: CellEditEvent<TransactionData>) => void;
  packingListEligibleData: TransactionData[];
  packingListColumns: HandsontableColumn[];
  packedTransactionsData: TransactionData[];
  dueDateColumns: HandsontableColumn[];
  dueDatesData: DueDateGridRow[];
  filteredDueDatesData: DueDateGridRow[];
  getDueDateCellData: GetCellData<DueDateGridRow>;
  dueDateFilters: Set<string>;
  onDueDateFilter: (filter: string) => void;
  meaningfulTransactions: TransactionData[];
  recentlyUpdatedColumns: HandsontableColumn[];
  recentlyUpdatedData: TransactionData[];
  getRecentlyUpdatedCellData: GetCellData<TransactionData>;
  statusOptions: string[];
  selectedStatuses: Set<string>;
  onStatusFilter: (status: string) => void;
  onGenerateInvoice: (data: TransactionData[]) => void | Promise<void>;
  onGeneratePackingList: (data: TransactionData[]) => void | Promise<void>;
  onGenerateDistribution: (data: TransactionData[]) => void | Promise<void>;
  isGeneratingInvoice: boolean;
  isGeneratingPackingList: boolean;
  isGeneratingDistribution: boolean;
}

export const TransactionsTabs = memo(function TransactionsTabs({
  activeTab,
  onTabChange,
  statistics,
  transactions,
  cappedFilteredTransactions,
  columns,
  getCellData,
  onCellEdited,
  packingListEligibleData,
  packingListColumns,
  packedTransactionsData,
  dueDateColumns,
  dueDatesData,
  filteredDueDatesData,
  getDueDateCellData,
  dueDateFilters,
  onDueDateFilter,
  meaningfulTransactions,
  recentlyUpdatedColumns,
  recentlyUpdatedData,
  getRecentlyUpdatedCellData,
  statusOptions,
  selectedStatuses,
  onStatusFilter,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice,
  isGeneratingPackingList,
  isGeneratingDistribution,
  searchQuery,
  onSearch,
  stretchColumnId,
}: TransactionsTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onChange={(value) =>
        onTabChange((value as TransactionsTabValue) ?? 'main')
      }
      defaultValue="main"
    >
      <TransactionsStatsSection statistics={statistics} />

      <Tabs.List mt="sm">
        <Tabs.Tab value="main">Main Transactions</Tabs.Tab>
        <Tabs.Tab value="packing-list">Packing List</Tabs.Tab>
        <Tabs.Tab value="packed">Packed</Tabs.Tab>
        <Tabs.Tab value="due-dates">Due Dates</Tabs.Tab>
        <Tabs.Tab value="recently-updated">Recently Updated</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="main" pt="md">
        <MainTransactionsTab
          transactions={transactions}
          filteredData={cappedFilteredTransactions}
          columns={columns}
          getCellData={getCellData}
          onCellEdited={onCellEdited}
          statusOptions={statusOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={onStatusFilter}
          searchQuery={searchQuery}
          onSearch={onSearch}
          onGenerateInvoice={onGenerateInvoice}
          onGeneratePackingList={onGeneratePackingList}
          onGenerateDistribution={onGenerateDistribution}
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="packing-list" pt="md">
        <ReadOnlyTransactionsTab<TransactionData>
          data={packingListEligibleData}
          filteredData={packingListEligibleData}
          columns={packingListColumns}
          getCellData={getCellData}
          searchQuery={searchQuery}
          onSearch={onSearch}
          searchPlaceholder="Search packing list eligible transactions..."
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="packed" pt="md">
        <ReadOnlyTransactionsTab<TransactionData>
          data={packedTransactionsData}
          filteredData={packedTransactionsData}
          columns={packingListColumns}
          getCellData={getCellData}
          searchQuery={searchQuery}
          onSearch={onSearch}
          searchPlaceholder="Search packed transactions..."
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="due-dates" pt="md">
        <DueDatesTab
          data={dueDatesData}
          filteredData={filteredDueDatesData}
          columns={dueDateColumns}
          getCellData={getDueDateCellData}
          dueDateFilters={dueDateFilters}
          onDueDateFilter={onDueDateFilter}
          statusOptions={Array.from(DUE_DATE_FILTER_OPTIONS)}
          searchQuery={searchQuery}
          onSearch={onSearch}
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="recently-updated" pt="md">
        <RecentlyUpdatedTab
          data={meaningfulTransactions}
          filteredData={recentlyUpdatedData}
          columns={recentlyUpdatedColumns}
          getCellData={getRecentlyUpdatedCellData}
          statusOptions={statusOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={onStatusFilter}
          onGenerateInvoice={onGenerateInvoice}
          onGeneratePackingList={onGeneratePackingList}
          onGenerateDistribution={onGenerateDistribution}
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          searchQuery={searchQuery}
          onSearch={onSearch}
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>
    </Tabs>
  );
});
