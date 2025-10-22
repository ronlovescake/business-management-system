'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { StatsCards } from './components/StatsCards';
import { LeaveControls } from './components/LeaveControls';
import { LeaveListTable } from './components/LeaveListTable';
import { AnalyticsTable } from './components/AnalyticsTable';
import { CalendarView } from './components/CalendarView';
import { LeaveFormDialog } from './components/LeaveFormDialog';
import { useLeaveTracker } from './hooks/useLeaveTracker';

/**
 * Leave Tracker Page Component
 *
 * This is a thin orchestration layer that:
 * - Uses the useLeaveTracker hook for all business logic
 * - Focuses solely on UI composition and layout
 * - Delegates rendering to specialized components
 *
 * Architecture Benefits:
 * - Business logic is testable in isolation (useLeaveTracker hook)
 * - Page component is clean and focused on composition
 * - UI can be easily swapped (e.g., switching from Mantine to another library)
 * - Clear separation of concerns
 */
export default function LeaveTracker() {
  // Use the custom hook for all business logic
  const {
    // State
    leaveRequests,
    filteredRequests,
    searchQuery,
    setSearchQuery,
    filterLeaveType,
    setFilterLeaveType,
    filterStatus,
    setFilterStatus,
    isModalOpen,
    setIsModalOpen,
    editingRequest,
    activeTab,
    setActiveTab,
    isImporting,
    employeeOptions,
    isLoadingEmployees,

    // Form state
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formLeaveType,
    setFormLeaveType,
    formPaymentStatus,
    setFormPaymentStatus,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,
    employeeLeaveAllocation,

    // Computed values
    leaveTypes,
    paymentStatuses,
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalDaysRequested,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatDateRange: _formatDateRange,
    getStatusColor,
    getLeaveTypeColor,
    getPaymentStatusColor,
    calculateDays,

    // Event handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleClearForm,
    handleApprove,
    handleReject,
    handleImportCSV,
    handleExportCSV,

    // Form helpers
    isClearDisabled,
  } = useLeaveTracker();

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCards
          totalRequests={totalRequests}
          pendingRequests={pendingRequests}
          approvedRequests={approvedRequests}
          totalDaysRequested={totalDaysRequested}
        />

        {/* Controls - Tabs, Search, Filters, Actions */}
        <LeaveControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterLeaveType={filterLeaveType}
          onLeaveTypeFilterChange={setFilterLeaveType}
          filterStatus={filterStatus}
          onStatusFilterChange={setFilterStatus}
          leaveTypes={leaveTypes}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddRequest={handleAddRequest}
          isImporting={isImporting}
        />

        {/* Tables */}
        {activeTab === 'list' ? (
          <LeaveListTable
            leaveRequests={leaveRequests}
            filteredRequests={filteredRequests}
            formatDate={formatDate}
            getStatusColor={getStatusColor}
            getLeaveTypeColor={getLeaveTypeColor}
            getPaymentStatusColor={getPaymentStatusColor}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEditRequest}
            onDelete={handleDeleteRequest}
          />
        ) : activeTab === 'analytics' ? (
          <AnalyticsTable
            monthlyBreakdown={monthlyBreakdown}
            totalDaysRequested={totalDaysRequested}
            getLeaveTypeColor={getLeaveTypeColor}
          />
        ) : (
          <CalendarView
            leaveRequests={leaveRequests}
            formatDate={formatDate}
            getLeaveTypeColor={getLeaveTypeColor}
          />
        )}
      </Stack>

      {/* Add/Edit Leave Request Dialog */}
      <LeaveFormDialog
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingRequest={editingRequest}
        leaveTypes={leaveTypes}
        paymentStatuses={paymentStatuses}
        employeeOptions={employeeOptions}
        isLoadingEmployees={isLoadingEmployees}
        formEmployeeName={formEmployeeName}
        setFormEmployeeName={setFormEmployeeName}
        formEmployeeId={formEmployeeId}
        setFormEmployeeId={setFormEmployeeId}
        formLeaveType={formLeaveType}
        setFormLeaveType={setFormLeaveType}
        formPaymentStatus={formPaymentStatus}
        setFormPaymentStatus={setFormPaymentStatus}
        formStartDate={formStartDate}
        setFormStartDate={setFormStartDate}
        formEndDate={formEndDate}
        setFormEndDate={setFormEndDate}
        formReason={formReason}
        setFormReason={setFormReason}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        onSave={handleSaveRequest}
        onClear={handleClearForm}
        isClearDisabled={isClearDisabled}
        calculateDays={calculateDays}
        employeeLeaveAllocation={employeeLeaveAllocation}
      />
    </PageLayout>
  );
}
