'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { BalanceSheetStatsCards } from './components/BalanceSheetStatsCards';
import { BalanceSheetControls } from './components/BalanceSheetControls';
import { BalanceSheetTable } from './components/BalanceSheetTable';
import { useBalanceSheet } from './hooks/useBalanceSheet';

export default function BalanceSheetPage() {
  const {
    rows,
    filteredRows,
    stats,
    asOf,
    setAsOf,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
  } = useBalanceSheet();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <BalanceSheetStatsCards
          assets={stats.assets}
          liabilities={stats.liabilities}
          equity={stats.equity}
          balance={stats.balance}
          asOf={stats.asOf}
          formatCurrency={formatCurrency}
        />

        <BalanceSheetControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          asOf={asOf}
          onAsOfChange={setAsOf}
          onExportCSV={handleExportCSV}
        />

        <BalanceSheetTable
          rows={rows}
          filteredRows={filteredRows}
          formatCurrency={formatCurrency}
        />
      </Stack>
    </PageLayout>
  );
}
