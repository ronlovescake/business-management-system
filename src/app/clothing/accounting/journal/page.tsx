'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { ManualJournalEntryModal } from '../components/ManualJournalEntryModal';
import { JournalStatsCards } from './components/JournalStatsCards';
import { JournalControls } from './components/JournalControls';
import { JournalListTable } from './components/JournalListTable';
import { useJournal } from './hooks/useJournal';

export default function JournalPage() {
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
  } = useJournal();

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
