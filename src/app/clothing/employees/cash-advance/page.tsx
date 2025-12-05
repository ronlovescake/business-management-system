'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Table } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconCash,
  IconClock,
  IconCheck,
  IconCurrencyPeso,
  IconEdit,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useCashAdvance } from './hooks/useCashAdvance';
// Direct imports for faster compilation (bypasses barrel export)
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { CashAdvanceControls } from './components/CashAdvanceControls';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import { RequestFormDialog } from './components/RequestFormDialog';
import type { CashAdvance as CashAdvanceType } from './types';
import { CashAdvanceErrorBoundary } from './components/CashAdvanceErrorBoundary';

function CashAdvance() {
  const {
    // State
    cashAdvances,
    searchQuery,
    statusFilter,
    isFormOpen,
    editingRequest,
    employeeOptions,
    isLoadingEmployees,

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
    handleImportCSV,
    handleExportCSV,
  } = useCashAdvance();

  const getResolvedSettledAmount = (item: CashAdvanceType) => {
    if (typeof item.settledAmount === 'number') {
      return Math.max(item.settledAmount, 0);
    }

    const remaining =
      typeof item.remainingBalance === 'number'
        ? item.remainingBalance
        : item.amount;

    return Math.max(item.amount - remaining, 0);
  };

  const getResolvedRemainingBalance = (item: CashAdvanceType) => {
    if (typeof item.remainingBalance === 'number') {
      return Math.max(item.remainingBalance, 0);
    }

    const settled = getResolvedSettledAmount(item);
    return Math.max(item.amount - settled, 0);
  };

  // Stats Configuration
  const stats: StatCard[] = [
    {
      title: 'Total Requests',
      value: totalRequests,
      icon: <IconCash size={20} stroke={1.6} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Pending',
      value: pendingRequests,
      icon: <IconClock size={20} stroke={1.6} />,
      color: 'orange',
      backgroundColor: 'var(--mantine-color-orange-6)',
    },
    {
      title: 'Approved',
      value: approvedRequests,
      icon: <IconCheck size={20} stroke={1.6} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'Total Amount',
      value: formatCurrency(totalAmount),
      icon: <IconCurrencyPeso size={20} stroke={1.6} />,
      color: 'teal',
      backgroundColor: 'var(--mantine-color-teal-6)',
    },
  ];

  // Table Columns Configuration
  const columns: TableColumn<CashAdvanceType>[] = [
    {
      key: 'employee',
      label: 'EMPLOYEE NAME',
      render: (item) => (
        <Text fw={500} ta="left">
          {item.employee}
        </Text>
      ),
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
        <Text
          size="sm"
          style={{ maxWidth: 200 }}
          lineClamp={2}
          c={item.purpose ? undefined : 'dimmed'}
        >
          {item.purpose || ''}
        </Text>
      ),
    },
    {
      key: 'terms',
      label: 'TERMS (MONTHS)',
      render: (item) => <Text size="sm">{item.terms || 'N/A'}</Text>,
    },
    {
      key: 'monthlyPayment',
      label: 'MONTHLY PAYMENT',
      render: (item) => {
        if (typeof item.monthlyPayment !== 'number') {
          return <Text c="dimmed">N/A</Text>;
        }
        return <Text fw={500}>{formatCurrency(item.monthlyPayment)}</Text>;
      },
    },
    {
      key: 'settledAmount',
      label: 'SETTLED AMOUNT',
      render: (item) => {
        const settled = getResolvedSettledAmount(item);
        if (settled <= 0) {
          return <Text c="dimmed">--</Text>;
        }
        return <Text fw={500}>{formatCurrency(settled)}</Text>;
      },
    },
    {
      key: 'remainingBalance',
      label: 'REMAINING BALANCE',
      render: (item) => {
        const remaining = getResolvedRemainingBalance(item);
        const isCleared = remaining <= 0;
        return (
          <Text fw={600} c={isCleared ? 'green' : 'blue'}>
            {formatCurrency(remaining)}
          </Text>
        );
      },
    },
    {
      key: 'requestDate',
      label: 'REQUEST DATE',
      render: (item) => formatDate(item.requestDate),
    },
    {
      key: 'notes',
      label: 'NOTES',
      render: (item) => (
        <Text size="sm" c={item.notes ? undefined : 'dimmed'} lineClamp={2}>
          {item.notes || ''}
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
  const actions: TableAction<CashAdvanceType>[] = [
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
      icon: <IconEdit size={16} />,
      label: 'Edit',
      color: 'blue',
      onClick: (item) => handleEditRequest(item),
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (item) => handleDeleteRequest(item.id),
      disabled: (item) => getResolvedSettledAmount(item) > 0,
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
        <CashAdvanceControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddRequest={handleAddRequest}
        />

        {/* Request List Table */}
        <DataTable
          height="73vh"
          data={cashAdvances}
          columns={columns}
          actions={actions}
          emptyMessage="No cash advance requests found"
          showFooter
          footerContent={
            <>
              <Table.Th>Total ({cashAdvances.length} requests)</Table.Th>
              <Table.Th>
                <Text fw={700}>
                  {formatCurrency(
                    cashAdvances.reduce((sum, r) => sum + r.amount, 0)
                  )}
                </Text>
              </Table.Th>
              <Table.Th colSpan={9}></Table.Th>
            </>
          }
          showSummary
          summaryLeft={
            <Text size="sm" c="dimmed">
              Showing {cashAdvances.length} of {totalRequests} requests
            </Text>
          }
          summaryRight={
            <Text size="sm" fw={600}>
              Total Amount: {formatCurrency(totalAmount)}
            </Text>
          }
        />
      </Stack>

      {/* Form Dialog */}
      <RequestFormDialog
        opened={isFormOpen}
        editingRequest={editingRequest}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveRequest}
        employeeOptions={employeeOptions}
        isLoadingEmployees={isLoadingEmployees}
      />
    </PageLayout>
  );
}

function CashAdvanceWrapper() {
  return (
    <CashAdvanceErrorBoundary>
      <CashAdvance />
    </CashAdvanceErrorBoundary>
  );
}

export { CashAdvanceWrapper as default };
