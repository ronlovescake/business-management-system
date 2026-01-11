'use client';

import { Stack, Text } from '@mantine/core';
import {
  IconAdjustments,
  IconChartPie,
  IconCurrencyPeso,
  IconList,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { ControlPanelCard } from '@/components/ui/ControlPanelCard';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  usePersonalBudgetsView,
  type BudgetStatus,
} from '../hooks/usePersonalBudgetsView';
import { BudgetFiltersPanel } from './components/BudgetFiltersPanel';
import { BudgetListTable } from './components/BudgetListTable';
import { BudgetAnalyticsTable } from './components/BudgetAnalyticsTable';

const statusColors: Record<BudgetStatus, string> = {
  over: 'red',
  under: 'teal',
  'on-track': 'blue',
};

export default function PersonalBudgetsPage() {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterPeriod,
    setFilterPeriod,
    filterStatus,
    setFilterStatus,
    categories,
    filteredBudgets,
    analyticsByCategory,
    stats,
    formatCurrency,
    handleImportCSV,
    handleExportCSV,
    handleAddBudget,
  } = usePersonalBudgetsView();

  const statCards: StatCard[] = [
    {
      title: 'Total Planned',
      value: formatCurrency(stats.totalPlanned),
      icon: <IconCurrencyPeso size={22} stroke={1.6} />,
      color: 'blue',
      backgroundColor:
        'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(99, 102, 241, 0.95))',
    },
    {
      title: 'Total Actual',
      value: formatCurrency(stats.totalActual),
      icon: <IconChartPie size={22} stroke={1.6} />,
      color: 'green',
      backgroundColor:
        'linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(34, 197, 94, 0.95))',
    },
    {
      title: 'Remaining',
      value: formatCurrency(stats.totalRemaining),
      icon: <IconAdjustments size={22} stroke={1.6} />,
      color: 'orange',
      backgroundColor:
        'linear-gradient(135deg, rgba(251, 146, 60, 0.95), rgba(249, 115, 22, 0.95))',
    },
    {
      title: 'This Month',
      value: formatCurrency(stats.thisMonthActual || stats.thisMonthPlanned),
      icon: <IconList size={22} stroke={1.6} />,
      color: 'teal',
      backgroundColor:
        'linear-gradient(135deg, rgba(20, 184, 166, 0.95), rgba(13, 148, 136, 0.95))',
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <StatsCardGrid cards={statCards} variant="vibrant" minCardWidth={240} />

        <ControlPanelCard
          title="Budget Records"
          activeTab={activeTab}
          onTabChange={setActiveTab}
          tabs={[
            {
              value: 'list',
              label: 'Budget List',
              leftSection: <IconList size={16} />,
              panel: (
                <BudgetFiltersPanel
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  categories={categories}
                  filterCategory={filterCategory}
                  onCategoryFilterChange={setFilterCategory}
                  filterPeriod={filterPeriod}
                  onPeriodFilterChange={setFilterPeriod}
                  filterStatus={filterStatus}
                  onStatusFilterChange={setFilterStatus}
                  onImportCSV={handleImportCSV}
                  onExportCSV={handleExportCSV}
                  onAddBudget={handleAddBudget}
                />
              ),
            },
            {
              value: 'analytics',
              label: 'Analytics',
              leftSection: <IconChartPie size={16} />,
              panel: (
                <Text size="sm" c="dimmed">
                  Category rollups and variance are displayed below.
                </Text>
              ),
            },
          ]}
        />

        {activeTab === 'list' ? (
          <BudgetListTable
            budgets={filteredBudgets}
            formatCurrency={formatCurrency}
            statusColors={statusColors}
          />
        ) : (
          <BudgetAnalyticsTable
            analytics={analyticsByCategory}
            formatCurrency={formatCurrency}
            statusColors={statusColors}
          />
        )}
      </Stack>
    </PageLayout>
  );
}
