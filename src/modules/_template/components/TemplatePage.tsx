'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { TemplateStatsCards } from './TemplateStatsCards';
import { TemplateControlPanel } from './TemplateControlPanel';
import { TemplateTable } from './TemplateTable';
import { useTemplateDashboard } from '../hooks/useTemplateDashboard';

export function TemplatePage() {
  const {
    records,
    stats,
    summary,
    filters,
    collections,
    actions,
    formatCurrency,
  } = useTemplateDashboard();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <TemplateStatsCards
          totalIn={stats.totalIn}
          totalOut={stats.totalOut}
          net={stats.net}
          recordsThisMonth={stats.recordsThisMonth}
          formatCurrency={formatCurrency}
        />

        <TemplateControlPanel
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          categoryFilter={filters.categoryFilter}
          onCategoryFilterChange={filters.setCategoryFilter}
          statusFilter={
            filters.statusFilter === 'all' ? null : filters.statusFilter
          }
          onStatusFilterChange={(value) =>
            filters.setStatusFilter(
              (value as typeof filters.statusFilter) || 'all'
            )
          }
          dateRangeFilter={filters.dateRange}
          onDateRangeFilterChange={filters.setDateRange}
          categories={collections.categories}
          onImport={actions.handleImport}
          onExport={actions.handleExport}
          onAdd={actions.handleAdd}
          isImporting={filters.isImporting}
        />

        <TemplateTable
          data={records}
          summary={{
            ...summary,
            formatCurrency,
          }}
          emptyMessage="No template records yet"
          height="74vh"
        />
      </Stack>
    </PageLayout>
  );
}
