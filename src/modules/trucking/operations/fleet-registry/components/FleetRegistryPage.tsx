'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { FleetRegistryStatsCards } from './FleetRegistryStatsCards';
import { FleetRegistryControlPanel } from './FleetRegistryControlPanel';
import { FleetRegistryTable } from './FleetRegistryTable';
import { useFleetRegistryDashboard } from '../hooks/useFleetRegistryDashboard';

export function FleetRegistryPage() {
  const {
    records,
    stats,
    summary,
    filters,
    collections,
    actions,
    getStatusColor,
  } = useFleetRegistryDashboard();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <FleetRegistryStatsCards
          activeUnits={stats.activeUnits}
          inMaintenance={stats.inMaintenance}
          registeredThisYear={stats.registeredThisYear}
          retiredUnits={stats.retiredUnits}
        />

        <FleetRegistryControlPanel
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
          fuelFilter={filters.fuelFilter}
          onFuelFilterChange={filters.setFuelFilter}
          makerFilter={filters.makerFilter}
          onMakerFilterChange={filters.setMakerFilter}
          yearFilter={filters.yearFilter}
          onYearFilterChange={filters.setYearFilter}
          makers={collections.makers}
          fuels={collections.fuels}
          onImport={actions.handleImport}
          onExport={actions.handleExport}
          onAdd={actions.handleAdd}
          isImporting={filters.isImporting}
        />

        <FleetRegistryTable
          data={records}
          summary={summary}
          height="74vh"
          getStatusColor={getStatusColor}
          onView={actions.handleView}
          onEdit={actions.handleEdit}
          onRetire={actions.handleRetire}
        />
      </Stack>
    </PageLayout>
  );
}
