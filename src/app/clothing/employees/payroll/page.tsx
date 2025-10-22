'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Table } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconFileText,
  IconClock,
  IconCheck,
  IconCurrencyPeso,
  IconEdit,
  IconTrash,
  IconCircleCheck,
  IconCash,
} from '@tabler/icons-react';
import { usePayroll } from './hooks/usePayroll';
// Direct imports for faster compilation (bypasses barrel export)
import { StatsCardGroup } from '@/components/shared/PageTemplates/StatsCardGroup';
import type { StatCard } from '@/components/shared/PageTemplates/StatsCardGroup';
import { PageControls } from '@/components/shared/PageTemplates/PageControls';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import type { Payroll as PayrollType } from './types';

export default function Payroll() {
  const formatPayPeriodDisplay = (period: string) => {
    if (!period) {
      return '';
    }

    const [startRaw, endRaw] = period.split(' to ');

    const formatDatePart = (value: string | undefined) => {
      if (!value) {
        return '';
      }
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return value;
      }
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const start = formatDatePart(startRaw);
    const end = formatDatePart(endRaw);

    return end ? `${start} - ${end}` : start;
  };

  const {
    payrolls,
    searchQuery,
    statusFilter,
    payPeriodFilter,
    payPeriods,
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleAddPayroll,
    handleEditPayroll,
    handleDeletePayroll,
    handleApprove,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
    getEmployeeMonthlyContributions,
  } = usePayroll();

  const resolveContributionValue = (
    item: PayrollType,
    field: 'sss' | 'philHealth' | 'pagIbig' | 'tax'
  ) => {
    const rawValue = item[field];
    if (rawValue > 0) {
      return rawValue;
    }

    const contributions = getEmployeeMonthlyContributions(
      item.employeeId ?? null,
      item.employee
    );

    if (!contributions) {
      return rawValue;
    }

    const fallback = contributions[field];
    return fallback !== null && fallback !== undefined ? fallback : rawValue;
  };

  // Stats Configuration
  const stats: StatCard[] = [
    {
      title: 'Total Records',
      value: totalPayrolls.toString(),
      icon: <IconFileText size={32} stroke={1.5} />,
    },
    {
      title: 'Pending',
      value: pendingPayrolls.toString(),
      icon: <IconClock size={32} stroke={1.5} />,
    },
    {
      title: 'Approved',
      value: approvedPayrolls.toString(),
      icon: <IconCheck size={32} stroke={1.5} />,
    },
    {
      title: 'Total Paid',
      value: formatCurrency(totalNetPay),
      icon: <IconCurrencyPeso size={32} stroke={1.5} />,
    },
  ];

  // Table Columns Configuration
  const columns: TableColumn<PayrollType>[] = [
    {
      key: 'employee',
      label: 'EMPLOYEE NAME',
      align: 'left',
      render: (item) => <Text fw={500}>{item.employee}</Text>,
    },
    {
      key: 'payPeriod',
      label: 'PAY PERIOD',
      render: (item) => (
        <Text size="sm">{formatPayPeriodDisplay(item.payPeriod)}</Text>
      ),
    },
    {
      key: 'basicSalary',
      label: 'BASIC SALARY',
      render: (item) => <Text>{formatCurrency(item.basicSalary)}</Text>,
    },
    {
      key: 'allowance',
      label: 'ALLOWANCE',
      render: (item) => <Text>{formatCurrency(item.allowance)}</Text>,
    },
    {
      key: 'overtime',
      label: 'OVERTIME',
      render: (item) => <Text>{formatCurrency(item.overtime)}</Text>,
    },
    {
      key: 'bonuses',
      label: 'BONUSES',
      render: (item) => <Text>{formatCurrency(item.bonuses)}</Text>,
    },
    {
      key: 'thirteenthMonth',
      label: '13TH MONTH',
      render: (item) => <Text>{formatCurrency(item.thirteenthMonth)}</Text>,
    },
    {
      key: 'grossPay',
      label: 'GROSS PAY',
      render: (item) => (
        <Text fw={600} c="green">
          {formatCurrency(item.grossPay)}
        </Text>
      ),
    },
    {
      key: 'sss',
      label: 'SSS',
      render: (item) => (
        <Text size="sm">
          {formatCurrency(resolveContributionValue(item, 'sss'))}
        </Text>
      ),
    },
    {
      key: 'philHealth',
      label: 'PHILHEALTH',
      render: (item) => (
        <Text size="sm">
          {formatCurrency(resolveContributionValue(item, 'philHealth'))}
        </Text>
      ),
    },
    {
      key: 'pagIbig',
      label: 'PAG-IBIG',
      render: (item) => (
        <Text size="sm">
          {formatCurrency(resolveContributionValue(item, 'pagIbig'))}
        </Text>
      ),
    },
    {
      key: 'tax',
      label: 'TAX',
      render: (item) => (
        <Text size="sm">
          {formatCurrency(resolveContributionValue(item, 'tax'))}
        </Text>
      ),
    },
    {
      key: 'loans',
      label: 'LOANS',
      render: (item) => <Text size="sm">{formatCurrency(item.loans)}</Text>,
    },
    {
      key: 'cashAdvance',
      label: 'CASH ADVANCE',
      render: (item) => (
        <Text size="sm">{formatCurrency(item.cashAdvance)}</Text>
      ),
    },
    {
      key: 'lwop',
      label: 'LWOP',
      render: (item) => <Text size="sm">{formatCurrency(item.lwop)}</Text>,
    },
    {
      key: 'absentsLates',
      label: 'ABSENCES/LATES',
      render: (item) => (
        <Text size="sm">{formatCurrency(item.absentsLates)}</Text>
      ),
    },
    {
      key: 'totalDeductions',
      label: 'TOTAL DEDUCTIONS',
      render: (item) => (
        <Text fw={600} c="red">
          {formatCurrency(item.totalDeductions)}
        </Text>
      ),
    },
    {
      key: 'netPay',
      label: 'NET PAY',
      render: (item) => (
        <Text fw={700} c="blue" size="lg">
          {formatCurrency(item.netPay)}
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
          {item.status === 'paid' && item.paidDate && (
            <Text size="xs" c="dimmed">
              on {formatDate(item.paidDate)}
            </Text>
          )}
        </Group>
      ),
    },
    {
      key: 'bankGcash',
      label: 'BANK/GCASH',
      render: (item) => <Text size="sm">{item.bankGcash}</Text>,
    },
  ];

  // Table Actions Configuration
  const actions: TableAction<PayrollType>[] = [
    {
      icon: <IconCircleCheck size={16} />,
      label: 'Approve',
      color: 'green',
      onClick: (item) => handleApprove(item.id),
      show: (item) => item.status === 'pending',
    },
    {
      icon: <IconCash size={16} />,
      label: 'Mark as Paid',
      color: 'blue',
      onClick: (item) => handleMarkAsPaid(item.id),
      show: (item) => item.status === 'approved',
    },
    {
      icon: <IconEdit size={16} />,
      label: 'Edit',
      color: 'blue',
      onClick: (item) => handleEditPayroll(item),
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (item) => handleDeletePayroll(item.id),
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <StatsCardGroup stats={stats} />

        {/* Controls */}
        <PageControls
          title="Payroll Records"
          searchPlaceholder="Search by employee, pay period, or bank..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              placeholder: 'Filter by status',
              data: ['All', 'pending', 'approved', 'paid'],
              value: statusFilter,
              onChange: (value: string | null) =>
                setStatusFilter(value === 'All' || !value ? 'all' : value),
            },
            {
              placeholder: 'Filter by pay period',
              data: payPeriods.map((p) => (p === 'all' ? 'All' : p)),
              value: payPeriodFilter,
              onChange: (value: string | null) =>
                setPayPeriodFilter(value === 'All' || !value ? 'all' : value),
            },
          ]}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAdd={handleAddPayroll}
          addButtonLabel="Generate Payroll"
        />

        {/* Payroll Table */}
        <DataTable
          data={payrolls}
          columns={columns}
          actions={actions}
          emptyMessage="No payroll records found"
          showFooter
          footerContent={
            <>
              <Table.Th>Total ({payrolls.length} records)</Table.Th>
              <Table.Th colSpan={5}></Table.Th>
              <Table.Th>
                <Text fw={700} c="green">
                  {formatCurrency(
                    payrolls.reduce((sum, p) => sum + p.grossPay, 0)
                  )}
                </Text>
              </Table.Th>
              <Table.Th colSpan={8}></Table.Th>
              <Table.Th>
                <Text fw={700} c="red">
                  {formatCurrency(
                    payrolls.reduce((sum, p) => sum + p.totalDeductions, 0)
                  )}
                </Text>
              </Table.Th>
              <Table.Th>
                <Text fw={900} c="blue" size="lg">
                  {formatCurrency(
                    payrolls.reduce((sum, p) => sum + p.netPay, 0)
                  )}
                </Text>
              </Table.Th>
              <Table.Th colSpan={3}></Table.Th>
            </>
          }
          showSummary
          summaryLeft={
            <Text size="sm" c="dimmed">
              Showing {payrolls.length} of {totalPayrolls} records
            </Text>
          }
          summaryRight={
            <Text size="sm" fw={600}>
              Total Net Pay: {formatCurrency(totalNetPay)}
            </Text>
          }
        />
      </Stack>
    </PageLayout>
  );
}
