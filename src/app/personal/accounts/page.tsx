'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { usePersonalAccountsView } from '@/app/personal/hooks/usePersonalAccountsView';
import { AccountFormDialog } from './components/AccountFormDialog';
import { AccountsListTable } from './components/AccountsListTable';
import { AccountsControls } from './components/AccountsControls';
import { AccountsStatsCards } from './components/AccountsStatsCards';
import { AccountsAnalyticsTable } from './components/AccountsAnalyticsTable';

function formatCurrencyPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

export default function PersonalAccountsPage() {
  const {
    accounts,
    filteredAccounts,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterInstitution,
    setFilterInstitution,
    isModalOpen,
    setIsModalOpen,
    editingAccount,
    draft,
    setDraft,
    isImporting,
    types,
    institutions,
    totals,
    handleAddAccount,
    handleEditAccount,
    handleDeleteAccount,
    handleSaveAccount,
    handleImportCSV,
    handleExportCSV,
    handleDownloadCSVTemplate,
  } = usePersonalAccountsView();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <AccountsStatsCards
          totalAccounts={totals.totalAccounts}
          activeAccounts={totals.activeAccounts}
          totalBalance={totals.totalBalance}
          thisMonthChange={totals.thisMonthChange}
          formatCurrency={formatCurrencyPhp}
        />

        <AccountsControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onTypeFilterChange={(val) => setFilterType(val as typeof filterType)}
          filterStatus={filterStatus}
          onStatusFilterChange={setFilterStatus}
          filterInstitution={filterInstitution}
          onInstitutionFilterChange={setFilterInstitution}
          types={types}
          institutions={institutions}
          onImportCSV={handleImportCSV}
          onDownloadTemplate={handleDownloadCSVTemplate}
          onExportCSV={handleExportCSV}
          onAddAccount={handleAddAccount}
          isImporting={isImporting}
        />

        {activeTab === 'list' ? (
          <AccountsListTable
            accounts={accounts}
            filteredAccounts={filteredAccounts}
            formatCurrency={formatCurrencyPhp}
            onEdit={handleEditAccount}
            onDelete={handleDeleteAccount}
          />
        ) : (
          <AccountsAnalyticsTable
            accounts={filteredAccounts}
            formatCurrency={formatCurrencyPhp}
          />
        )}
      </Stack>

      <AccountFormDialog
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingAccount ? 'EDIT PERSONAL ACCOUNT' : 'ADD PERSONAL ACCOUNT'
        }
        description={
          editingAccount
            ? 'Update this account’s details.'
            : 'Add an account to track where money lives (cash, bank, e-wallet, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={handleSaveAccount}
      />
    </PageLayout>
  );
}
