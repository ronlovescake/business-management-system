'use client';

import { useEffect, useState } from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { VehicleAssignmentsStatsCards } from './VehicleAssignmentsStatsCards';
import { VehicleAssignmentsControlPanel } from './VehicleAssignmentsControlPanel';
import { VehicleAssignmentsTable } from './VehicleAssignmentsTable';
import { useVehicleAssignmentsDashboard } from '../hooks/useVehicleAssignmentsDashboard';
import { VehicleAssignmentDialog } from './VehicleAssignmentDialog';
import type { VehicleAssignmentDraft } from '../types/vehicleAssignments.types';

export function VehicleAssignmentsPage() {
  const {
    records,
    stats,
    summary,
    filters,
    collections,
    actions,
    getStatusColor,
  } = useVehicleAssignmentsDashboard();

  const [isAssignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleOpenAssignmentDialog = () => setAssignmentDialogOpen(true);
  const handleCloseAssignmentDialog = () => setAssignmentDialogOpen(false);

  const handleSaveAssignment = (assignment: VehicleAssignmentDraft) => {
    actions.handleCreateAssignment(assignment);
    setAssignmentDialogOpen(false);
  };

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <VehicleAssignmentsStatsCards
          activeCount={hasMounted ? stats.activeCount : 0}
          scheduledThisWeek={hasMounted ? stats.scheduledThisWeek : 0}
          endingSoon={hasMounted ? stats.endingSoon : 0}
          completedThisMonth={hasMounted ? stats.completedThisMonth : 0}
        />

        <VehicleAssignmentsControlPanel
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
          onAdd={handleOpenAssignmentDialog}
          isImporting={filters.isImporting}
        />

        <VehicleAssignmentsTable
          data={records}
          summary={summary}
          emptyMessage="No vehicle assignments yet"
          height="74vh"
          getStatusColor={getStatusColor}
          onView={actions.handleView}
          onEdit={actions.handleEdit}
          onMarkComplete={actions.handleMarkComplete}
          onCancel={actions.handleCancel}
        />
      </Stack>

      <VehicleAssignmentDialog
        opened={isAssignmentDialogOpen}
        onClose={handleCloseAssignmentDialog}
        onSubmit={handleSaveAssignment}
        drivers={collections.drivers}
        helpers={collections.helpers}
        vehicles={collections.vehicles}
      />
    </PageLayout>
  );
}
