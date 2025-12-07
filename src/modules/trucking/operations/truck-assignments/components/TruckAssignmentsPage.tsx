'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { TruckAssignmentsStatsCards } from './TruckAssignmentsStatsCards';
import { TruckAssignmentsControlPanel } from './TruckAssignmentsControlPanel';
import { TruckAssignmentsTable } from './TruckAssignmentsTable';
import { useTruckAssignmentsDashboard } from '../hooks/useTruckAssignmentsDashboard';

export function TruckAssignmentsPage() {
  const {
    records,
    stats,
    summary,
    filters,
    collections,
    actions,
    getStatusColor,
  } = useTruckAssignmentsDashboard();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <TruckAssignmentsStatsCards
          activeCount={stats.activeCount}
          scheduledThisWeek={stats.scheduledThisWeek}
          endingSoon={stats.endingSoon}
          completedThisMonth={stats.completedThisMonth}
        />

        <TruckAssignmentsControlPanel
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          statusFilter={
            filters.statusFilter === 'all' ? null : filters.statusFilter
          }
          onStatusFilterChange={(value) =>
            filters.setStatusFilter(
              (value as typeof filters.statusFilter) || 'all'
            )
          }
          driverFilter={filters.driverFilter}
          onDriverFilterChange={filters.setDriverFilter}
          dateRangeFilter={filters.dateRange}
          onDateRangeFilterChange={filters.setDateRange}
          drivers={collections.drivers}
          onImport={actions.handleImport}
          onExport={actions.handleExport}
          onAdd={actions.handleAdd}
          isImporting={filters.isImporting}
        />

        <TruckAssignmentsTable
          data={records}
          summary={summary}
          emptyMessage="No truck assignments yet"
          height="74vh"
          getStatusColor={getStatusColor}
          onView={actions.handleView}
          onEdit={actions.handleEdit}
          onMarkComplete={actions.handleMarkComplete}
          onCancel={actions.handleCancel}
        />
      </Stack>
    </PageLayout>
  );
}
