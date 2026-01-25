'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { useSchedules } from './hooks/useSchedules';
import { StatsCards } from './components/StatsCards';
import { ScheduleControls } from './components/ScheduleControls';
import { ScheduleListTable } from './components/ScheduleListTable';
import { CalendarView } from './components/CalendarView';
import { CalendarBulkActions } from './components/CalendarBulkActions';

/**
 * Schedules Page Component
 *
 * This is a thin orchestration layer that:
 * - Uses the useSchedules hook for all business logic
 * - Focuses solely on UI composition and layout
 * - Delegates rendering to specialized components
 *
 * Employee schedule management system with:
 * - Schedule list with filtering and search
 * - Add/Edit/Delete operations
 * - CSV import/export
 * - Status management (scheduled, completed, cancelled)
 * - Calendar view (placeholder)
 * - Stats dashboard
 */
export function EmployeesSchedulesPage({
  apiBasePath,
}: {
  apiBasePath?: string;
}) {
  const {
    // State
    schedules,
    searchQuery,
    setSearchQuery,
    filterShiftType,
    setFilterShiftType,
    filterStatus,
    setFilterStatus,
    activeTab,
    setActiveTab,
    isImporting,

    // Computed values
    totalSchedules,
    scheduledCount,
    completedCount,
    cancelledCount,

    // Utility functions
    formatDate,
    formatTime,
    getStatusColor,
    getShiftTypeColor,
    calculateDuration,
    getEmployeeLeaveForDate,

    // Event handlers
    handleEditSchedule,
    handleDeleteSchedule,
    handleMarkCompleted,
    handleMarkCancelled,
    handleImportCSV,
    handleExportCSV,

    // Bulk scheduling
    recurringRules,
    upsertRecurringRule,
    removeRecurringRule,

    // Shared data
    employees,
    isLoadingEmployees,
    shiftConfig,
    dayLabels,
  } = useSchedules(apiBasePath);

  const bulkActionProps = {
    recurringRules,
    onSaveRule: upsertRecurringRule,
    onDeleteRule: removeRecurringRule,
    employees,
    isLoadingEmployees,
    shiftConfig,
    dayLabels,
  } as const;

  const scheduleControlsBulkProps = {
    recurringRules: bulkActionProps.recurringRules,
    onSaveRecurringRule: bulkActionProps.onSaveRule,
    onDeleteRecurringRule: bulkActionProps.onDeleteRule,
    employees: bulkActionProps.employees,
    isLoadingEmployees: bulkActionProps.isLoadingEmployees,
    shiftConfig: bulkActionProps.shiftConfig,
    dayLabels: bulkActionProps.dayLabels,
  } as const;

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCards
          totalSchedules={totalSchedules}
          scheduledCount={scheduledCount}
          completedCount={completedCount}
          cancelledCount={cancelledCount}
        />

        {/* Controls - Tabs, Search, Filters, Actions */}
        <ScheduleControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterShiftType={filterShiftType}
          onShiftTypeFilterChange={setFilterShiftType}
          filterStatus={filterStatus}
          onStatusFilterChange={setFilterStatus}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          isImporting={isImporting}
          {...scheduleControlsBulkProps}
        />

        {/* Tables */}
        {activeTab === 'list' ? (
          <ScheduleListTable
            schedules={schedules}
            formatDate={formatDate}
            formatTime={formatTime}
            getStatusColor={getStatusColor}
            getShiftTypeColor={getShiftTypeColor}
            calculateDuration={calculateDuration}
            getEmployeeLeaveForDate={getEmployeeLeaveForDate}
            onEdit={handleEditSchedule}
            onDelete={handleDeleteSchedule}
            onMarkCompleted={handleMarkCompleted}
            onMarkCancelled={handleMarkCancelled}
          />
        ) : (
          <CalendarView
            schedules={schedules}
            getShiftTypeColor={getShiftTypeColor}
            getStatusColor={getStatusColor}
            onEditSchedule={handleEditSchedule}
            getEmployeeLeaveForDate={getEmployeeLeaveForDate}
            bulkActions={<CalendarBulkActions {...bulkActionProps} />}
          />
        )}
      </Stack>
    </PageLayout>
  );
}

export default function SchedulesPage() {
  return <EmployeesSchedulesPage />;
}
