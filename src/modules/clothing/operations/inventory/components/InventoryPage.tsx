'use client';

import { Stack } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
import { useInventoryPage } from '../hooks/useInventoryPage';
import { InventoryTableControls } from './InventoryTableControls';
import { InventorySummary } from './InventorySummary';
import { InventoryTable } from './InventoryTable';

export function InventoryPage() {
  const {
    setSearchQuery,
    isImporting,
    isLoading,
    headers,
    totalItemCount,
    filteredData,
    totals,
    emptyStateMessage,
    handleImportCSV,
    handleExportCSV,
    handleAddNew,
  } = useInventoryPage();

  if (isLoading) {
    return (
      <Stack gap="md">
        <InventoryTableControls
          onSearch={setSearchQuery}
          onImport={handleImportCSV}
          onExport={handleExportCSV}
          onAddNew={handleAddNew}
          isImporting={isImporting}
          showActions={false}
        />
        <StandardTableContainer>
          <StandardDataTable
            headers={headers}
            emptyState="Loading inventory data..."
            colSpan={headers.length}
          >
            {[]}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <InventoryTableControls
        onSearch={setSearchQuery}
        onImport={handleImportCSV}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImporting}
      />

      <StandardTableContainer
        summary={
          <InventorySummary
            filteredCount={filteredData.length}
            totalCount={totalItemCount}
            totals={totals}
          />
        }
      >
        <InventoryTable
          headers={headers}
          data={filteredData}
          emptyState={emptyStateMessage}
        />
      </StandardTableContainer>
    </Stack>
  );
}
