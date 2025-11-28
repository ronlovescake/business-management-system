'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Table } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconPigMoney,
  IconClock,
  IconCheck,
  IconCurrencyPeso,
  IconEdit,
  IconTrash,
  IconX,
  IconCheckbox,
} from '@tabler/icons-react';
import { useEmployeeLoans } from './hooks/useEmployeeLoans';
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import { LoanFormDialog } from './components/LoanFormDialog';
import { LoanControls } from './components/LoanControls';
import type { EmployeeLoan } from './types';

export default function EmployeeLoans() {
  const {
    // State
    loans,
    searchQuery,
    statusFilter,
    loanTypeFilter,
    isFormOpen,
    editingLoan,

    // Computed Values
    totalLoans,
    pendingLoans,
    activeLoans,
    totalDisbursed,
    totalOutstanding,

    // Setters
    setSearchQuery,
    setStatusFilter,
    setLoanTypeFilter,
    setIsFormOpen,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddLoan,
    handleEditLoan,
    handleDeleteLoan,
    handleSaveLoan,
    handleApprove,
    handleActivate,
    handleReject,
    handleMarkCompleted,
    handleImportCSV,
    handleExportCSV,
  } = useEmployeeLoans();

  // Stats Configuration
  const stats: StatCard[] = [
    {
      title: 'Total Loans',
      value: totalLoans,
      icon: <IconPigMoney size={20} stroke={1.6} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Pending',
      value: pendingLoans,
      icon: <IconClock size={20} stroke={1.6} />,
      color: 'orange',
      backgroundColor: 'var(--mantine-color-orange-6)',
    },
    {
      title: 'Active',
      value: activeLoans,
      icon: <IconCheck size={20} stroke={1.6} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(totalOutstanding),
      icon: <IconCurrencyPeso size={20} stroke={1.6} />,
      color: 'teal',
      backgroundColor: 'var(--mantine-color-teal-6)',
    },
  ];

  // Table Columns Configuration
  const columns: TableColumn<EmployeeLoan>[] = [
    {
      key: 'employee',
      label: 'EMPLOYEE',
      render: (item) => <Text fw={500}>{item.employee}</Text>,
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      render: (item) => <Text fw={600}>{formatCurrency(item.amount)}</Text>,
    },
    {
      key: 'purpose',
      label: 'PURPOSE',
      render: (item) => (
        <Text size="sm" style={{ maxWidth: 200 }} lineClamp={2}>
          {item.purpose}
        </Text>
      ),
    },
    {
      key: 'interestRate',
      label: 'INTEREST RATE',
      render: (item) => <Text>{item.interestRate.toFixed(2)}%</Text>,
    },
    {
      key: 'termMonths',
      label: 'TERMS (MONTHS)',
      render: (item) => <Text>{item.termMonths}</Text>,
    },
    {
      key: 'monthlyPayment',
      label: 'MONTHLY PAYMENT',
      render: (item) => (
        <Text fw={500}>{formatCurrency(item.monthlyPayment)}</Text>
      ),
    },
    {
      key: 'remainingBalance',
      label: 'REMAINING BALANCE',
      render: (item) => (
        <Text fw={600} c={item.remainingBalance === 0 ? 'green' : 'blue'}>
          {formatCurrency(item.remainingBalance)}
        </Text>
      ),
    },
    {
      key: 'applicationDate',
      label: 'REQUEST DATE',
      render: (item) => formatDate(item.applicationDate),
    },
    {
      key: 'notes',
      label: 'NOTES',
      render: (item) => (
        <Text size="sm" c={item.notes ? undefined : 'dimmed'} lineClamp={2}>
          {item.notes || 'N/A'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (item) => (
        <Group gap={4} justify="center">
          <Badge color={getStatusColor(item.status)} variant="light">
            {item.status.toUpperCase()}
          </Badge>
          {item.status === 'approved' && item.approvedBy && (
            <Text size="xs" c="dimmed">
              by {item.approvedBy}
            </Text>
          )}
          {item.status === 'rejected' && item.rejectedBy && (
            <Text size="xs" c="dimmed">
              by {item.rejectedBy}
            </Text>
          )}
          {item.rejectionReason && (
            <Text size="xs" c="red">
              {item.rejectionReason}
            </Text>
          )}
        </Group>
      ),
    },
  ];

  // Table Actions Configuration
  const actions: TableAction<EmployeeLoan>[] = [
    {
      icon: <IconCheck size={16} />,
      label: 'Approve',
      color: 'green',
      onClick: (item) => handleApprove(item.id),
      show: (item) => item.status === 'pending',
    },
    {
      icon: <IconX size={16} />,
      label: 'Reject',
      color: 'red',
      onClick: (item) => handleReject(item.id),
      show: (item) => item.status === 'pending',
    },
    {
      icon: <IconCheckbox size={16} />,
      label: 'Activate',
      color: 'blue',
      onClick: (item) => handleActivate(item.id),
      show: (item) => item.status === 'approved',
    },
    {
      icon: <IconCurrencyPeso size={16} />,
      label: 'Mark Completed',
      color: 'teal',
      onClick: (item) => handleMarkCompleted(item.id),
      show: (item) => item.status === 'active',
    },
    {
      icon: <IconEdit size={16} />,
      label: 'Edit',
      color: 'blue',
      onClick: (item) => handleEditLoan(item),
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (item) => handleDeleteLoan(item.id),
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCardGrid
          cards={stats}
          variant="vibrant"
          minCardWidth={220}
          spacing="md"
        />

        {/* Controls */}
        <LoanControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loanTypeFilter={loanTypeFilter}
          onLoanTypeFilterChange={(value) => setLoanTypeFilter(value)}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddLoan={handleAddLoan}
        />

        {/* Loan List Table */}
        <DataTable
          data={loans}
          columns={columns}
          actions={actions}
          emptyMessage="No loan applications found"
          showFooter
          footerContent={
            <>
              <Table.Th>Total ({loans.length} loans)</Table.Th>
              <Table.Th>
                <Text fw={700}>
                  Disbursed: {formatCurrency(totalDisbursed)}
                </Text>
              </Table.Th>
              <Table.Th>
                <Text fw={700}>
                  Outstanding: {formatCurrency(totalOutstanding)}
                </Text>
              </Table.Th>
              <Table.Th colSpan={8}></Table.Th>
            </>
          }
          showSummary
          summaryLeft={
            <Text size="sm" c="dimmed">
              Showing {loans.length} of {totalLoans} loans
            </Text>
          }
          summaryRight={
            <Text size="sm" fw={600}>
              Total Outstanding: {formatCurrency(totalOutstanding)}
            </Text>
          }
        />
      </Stack>

      {/* Form Dialog */}
      <LoanFormDialog
        opened={isFormOpen}
        editingLoan={editingLoan}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveLoan}
      />
    </PageLayout>
  );
}
