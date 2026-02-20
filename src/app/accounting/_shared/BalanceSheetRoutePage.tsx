'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { BalanceSheetStatsCards } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetStatsCards';
import { BalanceSheetControls } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetControls';
import { BalanceSheetTable } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetTable';
import { useBalanceSheet } from '@/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet';

export function BalanceSheetRoutePage(props: { apiBasePath?: string }) {
  const { apiBasePath } = props;
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
    handleDownloadTemplate,
  } = useBalanceSheet({ apiBasePath });

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
          onDownloadTemplate={handleDownloadTemplate}
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
