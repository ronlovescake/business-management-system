'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { useSchedules } from './hooks/useSchedules';
import { StatsCards } from './components/StatsCards';
import { ScheduleControls } from './components/ScheduleControls';
import { ScheduleListTable } from './components/ScheduleListTable';
import { ScheduleFormDialog } from './components/ScheduleFormDialog';
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
export default function SchedulesPage() {
  const {
    // State
    schedules,
    searchQuery,
    setSearchQuery,
    filterShiftType,
    setFilterShiftType,
    filterStatus,
    setFilterStatus,
    isModalOpen,
    setIsModalOpen,
    editingSchedule,
    activeTab,
    setActiveTab,
    isImporting,

    // Form state
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formDate,
    setFormDate,
    formShiftType,
    setFormShiftType,
    formStartTime,
    setFormStartTime,
    formEndTime,
    setFormEndTime,
    formPosition,
    setFormPosition,
    formDepartment,
    setFormDepartment,
    formNotes,
    setFormNotes,

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

    // Event handlers
    handleAddSchedule,
    handleEditSchedule,
    handleDeleteSchedule,
    handleSaveSchedule,
    handleMarkCompleted,
    handleMarkCancelled,
    handleImportCSV,
    handleExportCSV,

    // Bulk scheduling
    weeklyTemplates,
    recurringRules,
    upsertWeeklyTemplate,
    deleteWeeklyTemplate,
    applyWeeklyTemplateToWeek,
    upsertRecurringRule,
    removeRecurringRule,

    // Shared data
    employees,
    isLoadingEmployees,
    shiftConfig,
    dayLabels,
  } = useSchedules();

  const bulkActionProps = {
    templates: weeklyTemplates,
    recurringRules,
    onSaveTemplate: upsertWeeklyTemplate,
    onDeleteTemplate: deleteWeeklyTemplate,
    onApplyTemplate: applyWeeklyTemplateToWeek,
    onSaveRule: upsertRecurringRule,
    onDeleteRule: removeRecurringRule,
    employees,
    isLoadingEmployees,
    shiftConfig,
    dayLabels,
  } as const;

  const scheduleControlsBulkProps = {
    templates: bulkActionProps.templates,
    recurringRules: bulkActionProps.recurringRules,
    onSaveTemplate: bulkActionProps.onSaveTemplate,
    onDeleteTemplate: bulkActionProps.onDeleteTemplate,
    onApplyTemplate: bulkActionProps.onApplyTemplate,
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
          onAddSchedule={handleAddSchedule}
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
            onAddSchedule={handleAddSchedule}
            onEditSchedule={handleEditSchedule}
            bulkActions={<CalendarBulkActions {...bulkActionProps} />}
          />
        )}
      </Stack>

      {/* Add/Edit Schedule Dialog */}
      <ScheduleFormDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        isEditing={!!editingSchedule}
        formEmployeeName={formEmployeeName}
        setFormEmployeeName={setFormEmployeeName}
        formEmployeeId={formEmployeeId}
        setFormEmployeeId={setFormEmployeeId}
        formDate={formDate}
        setFormDate={setFormDate}
        formShiftType={formShiftType}
        setFormShiftType={setFormShiftType}
        formStartTime={formStartTime}
        setFormStartTime={setFormStartTime}
        formEndTime={formEndTime}
        setFormEndTime={setFormEndTime}
        formPosition={formPosition}
        setFormPosition={setFormPosition}
        formDepartment={formDepartment}
        setFormDepartment={setFormDepartment}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        onSave={handleSaveSchedule}
        employees={employees}
        isLoadingEmployees={isLoadingEmployees}
        shiftConfig={shiftConfig}
      />
    </PageLayout>
  );
}
