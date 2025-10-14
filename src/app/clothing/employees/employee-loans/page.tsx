'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Table } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconPigMoney,
  IconClock,
  IconCheck,
  IconCurrencyDollar,
  IconEdit,
  IconTrash,
  IconX,
  IconCheckbox,
} from '@tabler/icons-react';
import { useEmployeeLoans } from './hooks/useEmployeeLoans';
import {
  StatsCardGroup,
  PageControls,
  DataTable,
} from '@/components/shared/PageTemplates';
import type {
  StatCard,
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates';
import { LoanFormDialog } from './components/LoanFormDialog';
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
    formatPercent,
    getStatusColor,
    getLoanTypeColor,

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
      value: totalLoans.toString(),
      icon: <IconPigMoney size={32} stroke={1.5} />,
    },
    {
      title: 'Pending',
      value: pendingLoans.toString(),
      icon: <IconClock size={32} stroke={1.5} />,
    },
    {
      title: 'Active',
      value: activeLoans.toString(),
      icon: <IconCheck size={32} stroke={1.5} />,
    },
    {
      title: 'Outstanding',
      value: formatCurrency(totalOutstanding),
      icon: <IconCurrencyDollar size={32} stroke={1.5} />,
    },
  ];

  // Table Columns Configuration (11 columns as requested)
  const columns: TableColumn<EmployeeLoan>[] = [
    {
      key: 'employee',
      label: 'EMPLOYEE',
      render: (item) => (
        <div>
          <Text fw={500}>{item.employee}</Text>
          {item.notes && (
            <Text size="xs" c="dimmed">
              {item.notes}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'loanType',
      label: 'LOAN TYPE',
      render: (item) => (
        <Badge color={getLoanTypeColor(item.loanType)} variant="light">
          {item.loanType.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      render: (item) => <Text fw={600}>{formatCurrency(item.amount)}</Text>,
    },
    {
      key: 'interestRate',
      label: 'INTEREST RATE',
      render: (item) => <Text>{formatPercent(item.interestRate)}</Text>,
    },
    {
      key: 'termMonths',
      label: 'TERM (MONTHS)',
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
    {
      key: 'applicationDate',
      label: 'APPLICATION DATE',
      render: (item) => formatDate(item.applicationDate),
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
      icon: <IconCurrencyDollar size={16} />,
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
        <StatsCardGroup stats={stats} />

        {/* Controls */}
        <PageControls
          title="Employee Loan Records"
          searchPlaceholder="Search by employee, purpose, or loan type..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              placeholder: 'Filter by type',
              data: [
                'All',
                'personal',
                'emergency',
                'educational',
                'housing',
                'vehicle',
              ],
              value: loanTypeFilter,
              onChange: setLoanTypeFilter,
            },
            {
              placeholder: 'Filter by status',
              data: [
                'All',
                'pending',
                'approved',
                'active',
                'completed',
                'rejected',
              ],
              value: statusFilter,
              onChange: (value: string | null) =>
                setStatusFilter(value === 'All' || !value ? 'all' : value),
            },
          ]}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAdd={handleAddLoan}
          addButtonLabel="Add Loan"
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
              <Table.Th colSpan={2}>
                <Text fw={700}>
                  Disbursed: {formatCurrency(totalDisbursed)}
                </Text>
              </Table.Th>
              <Table.Th colSpan={3}>
                <Text fw={700}>
                  Outstanding: {formatCurrency(totalOutstanding)}
                </Text>
              </Table.Th>
              <Table.Th colSpan={5}></Table.Th>
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
