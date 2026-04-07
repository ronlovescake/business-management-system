'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { LedgerStatsCards } from '@/app/clothing/accounting/ledger/components/LedgerStatsCards';
import { LedgerControls } from '@/app/clothing/accounting/ledger/components/LedgerControls';
import { LedgerListTable } from '@/app/clothing/accounting/ledger/components/LedgerListTable';
import { OpeningBalancePanel } from '@/app/clothing/accounting/ledger/components/OpeningBalancePanel';
import {
  RecurringPaymentsPanel,
  type RecurringPaymentService,
} from '@/app/clothing/accounting/ledger/components/RecurringPaymentsPanel';
import { OpeningBalanceEntryModal } from '@/app/clothing/accounting/ledger/components/OpeningBalanceEntryModal';
import { ManualJournalEntryModal } from '@/app/clothing/accounting/components/ManualJournalEntryModal';
import { LedgerHelpPanel } from '@/app/clothing/accounting/ledger/components/LedgerHelpPanel';
import { useLedger } from '@/app/clothing/accounting/ledger/hooks/useLedger';
import { AccountingLoadErrorAlert } from '@/app/accounting/_shared/AccountingLoadErrorAlert';

type LedgerRoutePageProps = {
  apiBasePath?: string;
  recurringPaymentService?: RecurringPaymentService;
};

export function LedgerRoutePage(props: LedgerRoutePageProps) {
  const { apiBasePath, recurringPaymentService } = props;
  const {
    entries,
    filteredEntries,
    loadError,
    stats,
    refreshLedger,
    period,
    setPeriod,
    openingBalancePeriod,
    setOpeningBalancePeriod,
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
    editTransitBuildEntry,
    deleteTransitBuildEntry,
  } = useLedger({ apiBasePath });

  const isOpeningBalanceTab = activeTab === 'opening-balance';
  const isHelpTab = activeTab === 'help';
  const isRecurringPaymentsTab = activeTab === 'recurring-payments';

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <AccountingLoadErrorAlert message={loadError} />

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
          openingBalancePeriod={openingBalancePeriod}
          onOpeningBalancePeriodChange={setOpeningBalancePeriod}
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
            service={recurringPaymentService}
          />
        ) : isOpeningBalanceTab ? (
          <OpeningBalancePanel
            onAddOpeningEntry={openOpeningEntryModal}
            cutoverDate={openingBalanceCutoverDate}
            entries={openingEntries}
            searchQuery={searchQuery}
            openingBalancePeriod={openingBalancePeriod}
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
            onEditTransitBuildEntry={editTransitBuildEntry}
            onDeleteTransitBuildEntry={deleteTransitBuildEntry}
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
