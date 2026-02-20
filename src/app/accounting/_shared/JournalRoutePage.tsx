'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { ManualJournalEntryModal } from '@/app/clothing/accounting/components/ManualJournalEntryModal';
import { JournalStatsCards } from '@/app/clothing/accounting/journal/components/JournalStatsCards';
import { JournalControls } from '@/app/clothing/accounting/journal/components/JournalControls';
import { JournalListTable } from '@/app/clothing/accounting/journal/components/JournalListTable';
import { useJournal } from '@/app/clothing/accounting/journal/hooks/useJournal';

type JournalRoutePageProps = {
  apiBasePath?: string;
};

export function JournalRoutePage(props: JournalRoutePageProps) {
  const { apiBasePath } = props;
  const {
    entries,
    filteredEntries,
    stats,
    accounts,
    searchQuery,
    setSearchQuery,
    filterAccount,
    setFilterAccount,
    activeTab,
    setActiveTab,
    formatCurrency,
    formatDate,
    handleAddEntry,
    handleImportCSV,
    handleDownloadTemplate,
    handleExportCSV,
    editingManualSourceId,
    openManualEntryModalForEdit,
    deleteManualEntry,
    isManualEntryModalOpen,
    closeManualEntryModal,
    saveManualEntry,
    isSavingManualEntry,
    manualEntryForm,
    handleManualEntryFieldChange,
    period,
    setPeriod,
  } = useJournal({ apiBasePath });

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <JournalStatsCards
          totalDebits={stats.totalDebits}
          totalCredits={stats.totalCredits}
          netChange={stats.netChange}
          entriesThisMonth={stats.entriesThisMonth}
          formatCurrency={formatCurrency}
        />

        <JournalControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterAccount={filterAccount}
          onAccountFilterChange={setFilterAccount}
          period={period}
          onPeriodChange={setPeriod}
          accounts={accounts}
          onImportCSV={handleImportCSV}
          onDownloadTemplate={handleDownloadTemplate}
          onExportCSV={handleExportCSV}
          onAddEntry={handleAddEntry}
        />

        <JournalListTable
          entries={entries}
          filteredEntries={filteredEntries}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          onEditManualEntry={openManualEntryModalForEdit}
          onDeleteManualEntry={deleteManualEntry}
        />

        <ManualJournalEntryModal
          opened={isManualEntryModalOpen}
          onClose={closeManualEntryModal}
          onSubmit={saveManualEntry}
          isSaving={isSavingManualEntry}
          form={manualEntryForm}
          onChange={handleManualEntryFieldChange}
          accounts={accounts}
          title={
            editingManualSourceId ? 'Edit Journal Entry' : 'Add Journal Entry'
          }
        />
      </Stack>
    </PageLayout>
  );
}
