'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { ProfitLossStatsCards } from './components/ProfitLossStatsCards';
import { ProfitLossControls } from './components/ProfitLossControls';
import { ProfitLossTable } from './components/ProfitLossTable';
import { useProfitLoss } from './hooks/useProfitLoss';

export default function ProfitLossPage() {
  const {
    rows,
    filteredRows,
    stats,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
    handleDownloadTemplate,
  } = useProfitLoss();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <ProfitLossStatsCards
          revenueTotal={stats.revenueTotal}
          cogsTotal={stats.cogsTotal}
          grossProfit={stats.grossProfit}
          expenseTotal={stats.expenseTotal}
          netProfit={stats.netProfit}
          period={stats.period}
          formatCurrency={formatCurrency}
        />

        <ProfitLossControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          period={period}
          onPeriodChange={setPeriod}
          onExportCSV={handleExportCSV}
          onDownloadTemplate={handleDownloadTemplate}
        />

        <ProfitLossTable
          rows={rows}
          filteredRows={filteredRows}
          formatCurrency={formatCurrency}
        />
      </Stack>
    </PageLayout>
  );
}
