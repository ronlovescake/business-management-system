'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { LedgerStatsCards } from './components/LedgerStatsCards';
import { LedgerControls } from './components/LedgerControls';
import { LedgerListTable } from './components/LedgerListTable';
import { useLedger } from './hooks/useLedger';

export default function LedgerPage() {
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
    handleExportCSV,
  } = useLedger();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <LedgerStatsCards
          totalDebits={stats.totalDebits}
          totalCredits={stats.totalCredits}
          netChange={stats.netChange}
          accounts={stats.accounts}
          formatCurrency={formatCurrency}
        />

        <LedgerControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterAccount={filterAccount}
          onAccountFilterChange={setFilterAccount}
          accounts={accounts}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddEntry={handleAddEntry}
        />

        <LedgerListTable
          entries={entries}
          filteredEntries={filteredEntries}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
        />
      </Stack>
    </PageLayout>
  );
}
