'use client';

import React from 'react';
import { Group, Stack, Text } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { LedgerStatsCards } from '@/app/clothing/accounting/ledger/components/LedgerStatsCards';
import { LedgerControls } from '@/app/clothing/accounting/ledger/components/LedgerControls';
import { LedgerListTable } from '@/app/clothing/accounting/ledger/components/LedgerListTable';
import { OpeningBalancePanel } from '@/app/clothing/accounting/ledger/components/OpeningBalancePanel';
import {
  RecurringPaymentsPanel,
  type RecurringGenerateResult,
  type RecurringPaymentService,
} from '@/app/clothing/accounting/components/RecurringPaymentsPanel';
import { OpeningBalanceEntryModal } from '@/app/clothing/accounting/ledger/components/OpeningBalanceEntryModal';
import { ManualJournalEntryModal } from '@/app/clothing/accounting/components/ManualJournalEntryModal';
import { LedgerHelpPanel } from '@/app/clothing/accounting/ledger/components/LedgerHelpPanel';
import { useLedger } from '@/app/clothing/accounting/ledger/hooks/useLedger';
import { AccountingLoadErrorAlert } from '@/app/accounting/_shared/AccountingLoadErrorAlert';
import { showNotification } from '@mantine/notifications';
import { formatDateForInput } from '@/lib/dateInputConfig';
import { logger } from '@/lib/logger';
import { ClothingRecurringPaymentService } from '@/services/ClothingRecurringPaymentService';

type LedgerRoutePageProps = {
  apiBasePath?: string;
  recurringPaymentService?: RecurringPaymentService;
  manualEntryGuidance?: boolean;
  showRecurringPaymentsTab?: boolean;
};

export function LedgerRoutePage(props: LedgerRoutePageProps) {
  const {
    apiBasePath,
    recurringPaymentService,
    manualEntryGuidance = false,
    showRecurringPaymentsTab = true,
  } = props;
  const {
    entries,
    filteredEntries,
    accountBalance,
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
    manualEntryPreset,
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
  const isBusinessGuideTab = activeTab === 'business-guide';
  const isRecurringPaymentsTab =
    showRecurringPaymentsTab && activeTab === 'recurring-payments';

  const [recurringSearchQuery, setRecurringSearchQuery] = React.useState('');
  const [recurringAddOpened, setRecurringAddOpened] = React.useState(false);
  const [isGeneratingRecurring, setIsGeneratingRecurring] =
    React.useState(false);
  const [recurringRefreshToken, setRecurringRefreshToken] = React.useState(0);
  const [lastRecurringGenerateResult, setLastRecurringGenerateResult] =
    React.useState<RecurringGenerateResult | null>(null);

  const handleGenerateRecurring = async () => {
    setIsGeneratingRecurring(true);
    try {
      const result = await (
        recurringPaymentService ?? ClothingRecurringPaymentService
      ).generate({
        upToDate: formatDateForInput(new Date()),
      });
      setLastRecurringGenerateResult(result);
      setRecurringRefreshToken((token) => token + 1);
    } catch (error) {
      logger.error('Failed to generate recurring drafts', { error });
      showNotification({
        title: 'Recurring payments',
        message:
          error instanceof Error ? error.message : 'Failed to generate drafts',
        color: 'red',
      });
    } finally {
      setIsGeneratingRecurring(false);
    }
  };

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <AccountingLoadErrorAlert message={loadError} />

        {!isOpeningBalanceTab &&
          !isHelpTab &&
          !isBusinessGuideTab &&
          !isRecurringPaymentsTab && (
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
          manualEntryGuidance={manualEntryGuidance}
          onStartGuidedEntry={handleAddEntry}
          onAddOpeningEntry={openOpeningEntryModal}
          showRecurringPaymentsTab={showRecurringPaymentsTab}
          recurringSearchQuery={recurringSearchQuery}
          onRecurringSearchChange={setRecurringSearchQuery}
          onGenerateRecurring={() => void handleGenerateRecurring()}
          isGeneratingRecurring={isGeneratingRecurring}
          onAddRecurring={() => setRecurringAddOpened(true)}
        />

        {isHelpTab ? (
          <LedgerHelpPanel />
        ) : isBusinessGuideTab ? null : isRecurringPaymentsTab ? (
          <RecurringPaymentsPanel
            accounts={accounts}
            onLedgerUpdated={refreshLedger}
            service={recurringPaymentService}
            searchQuery={recurringSearchQuery}
            opened={recurringAddOpened}
            setOpened={setRecurringAddOpened}
            refreshToken={recurringRefreshToken}
            lastGenerateResult={lastRecurringGenerateResult}
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
          <Stack gap="sm">
            {accountBalance && (
              <Group gap="xl" wrap="wrap" aria-label="Account balances">
                <Text size="sm" fw={600}>
                  {accountBalance.account}
                </Text>
                <Text size="sm">
                  Brought Forward: {formatCurrency(accountBalance.opening)}
                </Text>
                <Text size="sm">
                  Period Movement: {formatCurrency(accountBalance.movement)}
                </Text>
                <Text size="sm" fw={600}>
                  Closing Balance: {formatCurrency(accountBalance.closing)}
                </Text>
              </Group>
            )}
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
          </Stack>
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
          clothingGuided={manualEntryGuidance}
          isEditing={Boolean(editingManualSourceId)}
          presetId={manualEntryPreset}
          title={
            editingManualSourceId ? 'Edit Ledger Entry' : 'ADD LEDGER ENTRY'
          }
        />
      </Stack>
    </PageLayout>
  );
}
