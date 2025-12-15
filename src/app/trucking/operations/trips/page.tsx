'use client';

import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { TripsTable } from '@/modules/trucking/operations/trips/components/TripsTable';
import { TripsStatsCards } from '@/modules/trucking/operations/trips/components/TripsStatsCards';
import { TripsControlPanel } from '@/modules/trucking/operations/trips/components/TripsControlPanel';
import { useTripsDashboard } from '@/modules/trucking/operations/trips/hooks/useTripsDashboard';
import { LogTripModal } from '@/modules/trucking/operations/trips/components/LogTripModal';

export default function TripsPage() {
  const {
    filteredTrips,
    stats,
    summary,
    filters,
    collections,
    actions,
    modals,
    formatCurrency,
  } = useTripsDashboard();

  const analyticsSummary = {
    totalTrips: summary.totalCount,
    filteredTrips: summary.filteredCount,
    tripsThisMonth: stats.tripsThisMonth,
    totalRevenue: stats.totalRevenue,
    totalExpenses: stats.totalExpenses,
    netIncome: stats.netIncome,
    filteredRevenue: summary.filteredRevenue,
    filteredExpenses: summary.filteredExpenses,
    filteredNet: summary.filteredNet,
  } as const;

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <TripsStatsCards
          totalRevenue={stats.totalRevenue}
          totalExpenses={stats.totalExpenses}
          netIncome={stats.netIncome}
          tripsThisMonth={stats.tripsThisMonth}
          formatCurrency={formatCurrency}
        />

        <TripsControlPanel
          searchQuery={filters.searchQuery}
          onSearchChange={filters.setSearchQuery}
          driverFilter={filters.driverFilter}
          onDriverFilterChange={filters.setDriverFilter}
          truckFilter={filters.truckFilter}
          onTruckFilterChange={filters.setTruckFilter}
          dateRangeFilter={filters.dateRange}
          onDateRangeFilterChange={filters.setDateRange}
          drivers={collections.drivers}
          trucks={collections.trucks}
          onImportCSV={actions.handleImportTrips}
          onExportCSV={actions.handleExportTrips}
          onAddTrip={actions.handleLogTrip}
          isImporting={filters.isImporting}
          analyticsSummary={analyticsSummary}
          formatCurrency={formatCurrency}
        />

        <TripsTable
          data={filteredTrips}
          summary={{
            totalCount: summary.totalCount,
            filteredCount: summary.filteredCount,
            filteredRevenue: summary.filteredRevenue,
            filteredExpenses: summary.filteredExpenses,
            filteredNet: summary.filteredNet,
            formatCurrency,
          }}
        />

        <LogTripModal
          opened={modals.logTrip.opened}
          onClose={modals.logTrip.onClose}
          onSubmit={modals.logTrip.onSubmit}
          drivers={collections.drivers}
          trucks={collections.trucks}
        />
      </Stack>
    </PageLayout>
  );
}
