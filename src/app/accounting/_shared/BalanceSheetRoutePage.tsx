'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { BalanceSheetStatsCards } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetStatsCards';
import { BalanceSheetControls } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetControls';
import { BalanceSheetCashTable } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetCashTable';
import { BalanceSheetStockTable } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetStockTable';
import { BalanceSheetTransitTable } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetTransitTable';
import { BalanceSheetTable } from '@/app/clothing/accounting/balance-sheet/components/BalanceSheetTable';
import { useBalanceSheet } from '@/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet';

export function BalanceSheetRoutePage(props: { apiBasePath?: string }) {
  const { apiBasePath } = props;
  const {
    rows,
    filteredRows,
    cashBreakdownRows,
    cashBreakdownTotalRows,
    cashBreakdownSummary,
    stockBreakdownRows,
    stockBreakdownTotalRows,
    stockBreakdownSummary,
    transitBreakdownRows,
    transitBreakdownTotalRows,
    transitBreakdownSummary,
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

        {activeTab === 'cash' && (
          <BalanceSheetCashTable
            rows={cashBreakdownRows}
            totalRows={cashBreakdownTotalRows}
            summary={cashBreakdownSummary}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'stock' && (
          <BalanceSheetStockTable
            rows={stockBreakdownRows}
            totalRows={stockBreakdownTotalRows}
            summary={stockBreakdownSummary}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab === 'transit' && (
          <BalanceSheetTransitTable
            rows={transitBreakdownRows}
            totalRows={transitBreakdownTotalRows}
            summary={transitBreakdownSummary}
            formatCurrency={formatCurrency}
          />
        )}
        {activeTab !== 'cash' &&
          activeTab !== 'stock' &&
          activeTab !== 'transit' && (
            <BalanceSheetTable
              rows={rows}
              filteredRows={filteredRows}
              formatCurrency={formatCurrency}
            />
          )}
      </Stack>
    </PageLayout>
  );
}
