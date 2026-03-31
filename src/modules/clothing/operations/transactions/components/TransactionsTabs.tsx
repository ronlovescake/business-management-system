'use client';

import React, { memo, useMemo } from 'react';
import { Tabs, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { TransactionsLayout } from '@/components/features/transactions';
import type {
  HandsontableColumn,
  GetCellData,
  CellClickEvent,
} from '@/components/ui/HandsontableGrid';
import type { TransactionData } from '../types/transaction.types';
import type { DueDateGridRow } from '@/lib/transactions';
import { DUE_DATE_FILTER_OPTIONS } from '@/lib/transactions';
import type { CellEditEvent } from '@/components/ui/HandsontableGrid';
import { TransactionsStatsSection } from './TransactionsStatsSection';
import type { TransactionStatistics } from '../types/transaction.types';

export type TransactionsTabValue =
  | 'main'
  | 'invoicing'
  | 'warehouse-prepared'
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
  onCellEdited: (
    event: CellEditEvent<TransactionData>
  ) => void | boolean | Promise<void | boolean>;
  onCellClick?: (event: CellClickEvent<TransactionData>) => void;
  statusOptions: string[];
  selectedStatuses: Set<string>;
  onStatusFilter: (status: string) => void;
  onGenerateInvoice: (data: TransactionData[]) => void | Promise<void>;
  onGeneratePackingList: (data: TransactionData[]) => void | Promise<void>;
  onGenerateDistribution: (data: TransactionData[]) => void | Promise<void>;
  isGeneratingInvoice: boolean;
  isGeneratingPackingList: boolean;
  isGeneratingDistribution: boolean;
  extraActionButtons?: React.ReactNode;
  productSearchQuery: string;
  onProductSearch: (query: string) => void;
}

const MainTransactionsTab = memo(function MainTransactionsTab({
  transactions,
  filteredData,
  columns,
  getCellData,
  onCellEdited,
  onCellClick,
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
  extraActionButtons,
  productSearchQuery,
  onProductSearch,
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
      secondarySearchControl={
        <TextInput
          placeholder="Search product code..."
          leftSection={<IconSearch size={16} />}
          value={productSearchQuery}
          onChange={(event) => onProductSearch(event.currentTarget.value)}
          style={{ flex: 1, minWidth: 0, width: '100%' }}
          size="md"
          radius="md"
        />
      }
      getCellData={getCellData}
      onCellEdited={onCellEdited}
      onCellClick={onCellClick}
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
      extraActionButtons={extraActionButtons}
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
  onCellClick?: (event: CellClickEvent<T>) => void;
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
  onCellClick,
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
      onCellClick={onCellClick}
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
  onCellClick?: (event: CellClickEvent<DueDateGridRow>) => void;
  dueDateFilters: Set<string>;
  onDueDateFilter: (filter: string) => void;
  statusOptions: string[];
}

const DueDatesTab = memo(function DueDatesTab({
  data,
  filteredData,
  columns,
  getCellData,
  onCellClick,
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
      onCellClick={onCellClick}
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

interface TransactionsTabsProps {
  activeTab: TransactionsTabValue;
  onTabChange: (value: TransactionsTabValue) => void;
  statistics: TransactionStatistics;
  transactions: TransactionData[];
  cappedFilteredTransactions: TransactionData[];
  onhandEligibleTransactions: TransactionData[];
  onhandEligibleFilteredTransactions: TransactionData[];
  warehousePreparedTransactions: TransactionData[];
  warehousePreparedFilteredTransactions: TransactionData[];
  onWarehousePreparedCustomerClick?: (
    event: CellClickEvent<TransactionData>
  ) => void;
  onMainCustomerClick?: (event: CellClickEvent<TransactionData>) => void;
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
  onDueDatesCustomerClick?: (event: CellClickEvent<DueDateGridRow>) => void;
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
  extraActionButtons?: React.ReactNode;
  searchQueries: Record<TransactionsTabValue, string>;
  onTabSearch: (tab: TransactionsTabValue, query: string) => void;
  productSearchQueries: Record<TransactionsTabValue, string>;
  onTabProductSearch: (tab: TransactionsTabValue, query: string) => void;
  stretchColumnId?: string;
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
  onDueDatesCustomerClick,
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
  extraActionButtons,
  searchQueries,
  onTabSearch,
  productSearchQueries,
  onTabProductSearch,
  stretchColumnId,
  onhandEligibleTransactions,
  onhandEligibleFilteredTransactions,
  warehousePreparedTransactions,
  warehousePreparedFilteredTransactions,
  onWarehousePreparedCustomerClick,
  onMainCustomerClick,
}: TransactionsTabsProps) {
  const readOnlyTransactionsColumns = useMemo(
    () => columns.map((column) => ({ ...column, readOnly: true })),
    [columns]
  );

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
        <Tabs.Tab value="invoicing">Invoicing</Tabs.Tab>
        <Tabs.Tab value="warehouse-prepared">Warehouse + Prepared</Tabs.Tab>
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
          onCellClick={onMainCustomerClick}
          statusOptions={statusOptions}
          selectedStatuses={selectedStatuses}
          onStatusFilter={onStatusFilter}
          searchQuery={searchQueries.main}
          onSearch={(query) => onTabSearch('main', query)}
          productSearchQuery={productSearchQueries.main}
          onProductSearch={(query) => onTabProductSearch('main', query)}
          onGenerateInvoice={onGenerateInvoice}
          onGeneratePackingList={onGeneratePackingList}
          onGenerateDistribution={onGenerateDistribution}
          isGeneratingInvoice={isGeneratingInvoice}
          isGeneratingPackingList={isGeneratingPackingList}
          isGeneratingDistribution={isGeneratingDistribution}
          extraActionButtons={extraActionButtons}
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="invoicing" pt="md">
        <ReadOnlyTransactionsTab<TransactionData>
          data={onhandEligibleTransactions}
          filteredData={onhandEligibleFilteredTransactions}
          columns={readOnlyTransactionsColumns}
          getCellData={getCellData}
          searchQuery={searchQueries.invoicing}
          onSearch={(query) => onTabSearch('invoicing', query)}
          searchPlaceholder="Search invoicing-ready transactions..."
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>

      <Tabs.Panel value="warehouse-prepared" pt="md">
        <ReadOnlyTransactionsTab<TransactionData>
          data={warehousePreparedTransactions}
          filteredData={warehousePreparedFilteredTransactions}
          columns={readOnlyTransactionsColumns}
          getCellData={getCellData}
          searchQuery={searchQueries['warehouse-prepared']}
          onSearch={(query) => onTabSearch('warehouse-prepared', query)}
          searchPlaceholder="Search Warehouse + Prepared customers..."
          stretchColumnId={stretchColumnId}
          onCellClick={onWarehousePreparedCustomerClick}
        />
      </Tabs.Panel>

      <Tabs.Panel value="packing-list" pt="md">
        <ReadOnlyTransactionsTab<TransactionData>
          data={packingListEligibleData}
          filteredData={packingListEligibleData}
          columns={packingListColumns}
          getCellData={getCellData}
          searchQuery={searchQueries['packing-list']}
          onSearch={(query) => onTabSearch('packing-list', query)}
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
          searchQuery={searchQueries.packed}
          onSearch={(query) => onTabSearch('packed', query)}
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
          onCellClick={onDueDatesCustomerClick}
          dueDateFilters={dueDateFilters}
          onDueDateFilter={onDueDateFilter}
          statusOptions={Array.from(DUE_DATE_FILTER_OPTIONS)}
          searchQuery={searchQueries['due-dates']}
          onSearch={(query) => onTabSearch('due-dates', query)}
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
          searchQuery={searchQueries['recently-updated']}
          onSearch={(query) => onTabSearch('recently-updated', query)}
          stretchColumnId={stretchColumnId}
        />
      </Tabs.Panel>
    </Tabs>
  );
});
