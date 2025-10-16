'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { StatsCards } from './components/StatsCards';
import { LeaveControls } from './components/LeaveControls';
import { LeaveListTable } from './components/LeaveListTable';
import { AnalyticsTable } from './components/AnalyticsTable';
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

    // Form state
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formLeaveType,
    setFormLeaveType,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,

    // Computed values
    leaveTypes,
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalDaysRequested,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatDateRange,
    getStatusColor,
    getLeaveTypeColor,
    calculateDays,

    // Event handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleApprove,
    handleReject,
    handleImportCSV,
    handleExportCSV,
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
            formatDateRange={formatDateRange}
            getStatusColor={getStatusColor}
            getLeaveTypeColor={getLeaveTypeColor}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={handleEditRequest}
            onDelete={handleDeleteRequest}
          />
        ) : (
          <AnalyticsTable
            monthlyBreakdown={monthlyBreakdown}
            totalDaysRequested={totalDaysRequested}
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
        formEmployeeName={formEmployeeName}
        setFormEmployeeName={setFormEmployeeName}
        formEmployeeId={formEmployeeId}
        setFormEmployeeId={setFormEmployeeId}
        formLeaveType={formLeaveType}
        setFormLeaveType={setFormLeaveType}
        formStartDate={formStartDate}
        setFormStartDate={setFormStartDate}
        formEndDate={formEndDate}
        setFormEndDate={setFormEndDate}
        formReason={formReason}
        setFormReason={setFormReason}
        formNotes={formNotes}
        setFormNotes={setFormNotes}
        onSave={handleSaveRequest}
        calculateDays={calculateDays}
      />
    </PageLayout>
  );
}
