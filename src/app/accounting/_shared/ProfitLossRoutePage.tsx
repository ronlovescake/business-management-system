'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { ProfitLossStatsCards } from '@/app/clothing/accounting/profit-loss/components/ProfitLossStatsCards';
import { ProfitLossControls } from '@/app/clothing/accounting/profit-loss/components/ProfitLossControls';
import { ProfitLossTable } from '@/app/clothing/accounting/profit-loss/components/ProfitLossTable';
import { ProfitLossDetailsTable } from '@/app/clothing/accounting/profit-loss/components/ProfitLossDetailsTable';
import { ProfitLossBreakdownsPanel } from '@/app/clothing/accounting/profit-loss/components/ProfitLossBreakdownsPanel';
import { useProfitLoss } from '@/app/clothing/accounting/profit-loss/hooks/useProfitLoss';

type ProfitLossRoutePageProps = {
  apiBasePath?: string;
  showBreakdownsTab?: boolean;
};

export function ProfitLossRoutePage(props: ProfitLossRoutePageProps) {
  const { apiBasePath, showBreakdownsTab = true } = props;
  const {
    rows,
    filteredRows,
    detailRows,
    filteredDetailRows,
    stats,
    period,
    setPeriod,
    searchQuery,
    setSearchQuery,
    activeTab,
    setActiveTab,
    formatCurrency,
    handleExportCSV,
    handleExportDetailsCSV,
    handleDownloadTemplate,
  } = useProfitLoss({ apiBasePath });

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
          onExportDetailsCSV={handleExportDetailsCSV}
          onDownloadTemplate={handleDownloadTemplate}
        />

        {activeTab === 'details' ? (
          <ProfitLossDetailsTable
            rows={detailRows}
            filteredRows={filteredDetailRows}
            formatCurrency={formatCurrency}
          />
        ) : activeTab === 'breakdowns' && showBreakdownsTab ? (
          <ProfitLossBreakdownsPanel
            rows={detailRows}
            formatCurrency={formatCurrency}
          />
        ) : (
          <ProfitLossTable
            rows={rows}
            filteredRows={filteredRows}
            formatCurrency={formatCurrency}
          />
        )}
      </Stack>
    </PageLayout>
  );
}
