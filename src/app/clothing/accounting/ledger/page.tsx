'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { LedgerStatsCards } from './components/LedgerStatsCards';
import { LedgerControls } from './components/LedgerControls';
import { LedgerListTable } from './components/LedgerListTable';
import { OpeningBalancePanel } from './components/OpeningBalancePanel';
import { OpeningBalanceEntryModal } from './components/OpeningBalanceEntryModal';
import { useLedger } from './hooks/useLedger';

export default function LedgerPage() {
  const {
    entries,
    filteredEntries,
    stats,
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
    handleExportCSV,
    openingEntries,
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

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {!isOpeningBalanceTab && (
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
          onExportCSV={handleExportCSV}
          onAddEntry={handleAddEntry}
          onAddOpeningEntry={openOpeningEntryModal}
        />

        {isOpeningBalanceTab ? (
          <OpeningBalancePanel
            onAddOpeningEntry={openOpeningEntryModal}
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
      </Stack>
    </PageLayout>
  );
}
