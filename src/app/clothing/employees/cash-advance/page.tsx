'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconCash,
  IconClock,
  IconCheck,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import { useCashAdvance } from './hooks/useCashAdvance';
import { StatsCards } from './components/StatsCards';
import { RequestControls } from './components/RequestControls';
import { RequestListTable } from './components/RequestListTable';
import { RequestFormDialog } from './components/RequestFormDialog';

export default function CashAdvance() {
  const {
    // State
    cashAdvances,
    searchQuery,
    statusFilter,
    isFormOpen,
    editingRequest,

    // Computed Values
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalAmount,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleApprove,
    handleReject,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
  } = useCashAdvance();

  // Stats Configuration
  const stats = [
    {
      icon: <IconCash size={24} />,
      title: 'Total Requests',
      value: totalRequests.toString(),
      description: 'All cash advance requests',
      color: '#85bd3a',
    },
    {
      icon: <IconClock size={24} />,
      title: 'Pending',
      value: pendingRequests.toString(),
      description: 'Awaiting approval',
      color: '#ffa726',
    },
    {
      icon: <IconCheck size={24} />,
      title: 'Approved',
      value: approvedRequests.toString(),
      description: 'Approved requests',
      color: '#66bb6a',
    },
    {
      icon: <IconCurrencyDollar size={24} />,
      title: 'Total Amount',
      value: formatCurrency(totalAmount),
      description: 'Approved & paid out',
      color: '#42a5f5',
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCards stats={stats} />

        {/* Controls */}
        <RequestControls
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onSearchChange={setSearchQuery}
          onStatusFilterChange={(value) => setStatusFilter(value || 'all')}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddRequest={handleAddRequest}
        />

        {/* Request List Table */}
        <RequestListTable
          requests={cashAdvances}
          formatDate={formatDate}
          formatCurrency={formatCurrency}
          getStatusColor={getStatusColor}
          onEdit={handleEditRequest}
          onDelete={handleDeleteRequest}
          onApprove={handleApprove}
          onReject={handleReject}
          onMarkAsPaid={handleMarkAsPaid}
        />
      </Stack>

      {/* Form Dialog */}
      <RequestFormDialog
        opened={isFormOpen}
        editingRequest={editingRequest}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRequest}
      />
    </PageLayout>
  );
}
