'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { LedgerStatsCards } from './components/LedgerStatsCards';
import { LedgerControls } from './components/LedgerControls';
import { LedgerListTable } from './components/LedgerListTable';
import { OpeningBalancePanel } from './components/OpeningBalancePanel';
import { RecurringPaymentsPanel } from './components/RecurringPaymentsPanel';
import { OpeningBalanceEntryModal } from './components/OpeningBalanceEntryModal';
import { ManualJournalEntryModal } from '../components/ManualJournalEntryModal';
import { useLedger } from './hooks/useLedger';
import { LedgerHelpPanel } from './components/LedgerHelpPanel';

export default function LedgerPage() {
  const {
    entries,
    filteredEntries,
    stats,
    refreshLedger,
    period,
    setPeriod,
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
    openingEntries,
    openingBalanceCutoverDate,
    isLoadingOpeningEntries,
    isOpeningEntryModalOpen,
    isSavingOpeningEntry,
    openingEntryForm,
    handleOpeningEntryFieldChange,
    openOpeningEntryModal,
    closeOpeningEntryModal,
    saveOpeningEntry,
    openOpeningEntryModalForEdit,
    deleteOpeningEntry,
    editingOpeningEntryId,
  } = useLedger();

  const isOpeningBalanceTab = activeTab === 'opening-balance';
  const isHelpTab = activeTab === 'help';
  const isRecurringPaymentsTab = activeTab === 'recurring-payments';

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {!isOpeningBalanceTab && !isHelpTab && !isRecurringPaymentsTab && (
          <LedgerStatsCards
            totalDebits={stats.totalDebits}
            totalCredits={stats.totalCredits}
            netChange={stats.netChange}
            accounts={stats.accounts}
            formatCurrency={formatCurrency}
          />
        )}

        <LedgerControls
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
          onAddOpeningEntry={openOpeningEntryModal}
        />

        {isHelpTab ? (
          <LedgerHelpPanel />
        ) : isRecurringPaymentsTab ? (
          <RecurringPaymentsPanel
            accounts={accounts}
            onLedgerUpdated={refreshLedger}
          />
        ) : isOpeningBalanceTab ? (
          <OpeningBalancePanel
            onAddOpeningEntry={openOpeningEntryModal}
            cutoverDate={openingBalanceCutoverDate}
            entries={openingEntries}
            isLoading={isLoadingOpeningEntries}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onEditEntry={openOpeningEntryModalForEdit}
            onDeleteEntry={(entry) => deleteOpeningEntry(entry.id)}
            isSaving={isSavingOpeningEntry}
          />
        ) : (
          <LedgerListTable
            entries={entries}
            filteredEntries={filteredEntries}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            onEditManualEntry={openManualEntryModalForEdit}
            onDeleteManualEntry={deleteManualEntry}
          />
        )}

        <OpeningBalanceEntryModal
          opened={isOpeningEntryModalOpen}
          onClose={closeOpeningEntryModal}
          onSubmit={saveOpeningEntry}
          isSaving={isSavingOpeningEntry}
          form={openingEntryForm}
          onChange={handleOpeningEntryFieldChange}
          accounts={accounts}
          isEditing={Boolean(editingOpeningEntryId)}
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
            editingManualSourceId ? 'Edit Ledger Entry' : 'ADD LEDGER ENTRY'
          }
        />
      </Stack>
    </PageLayout>
  );
}
