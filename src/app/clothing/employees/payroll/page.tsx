'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Box } from '@mantine/core';
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
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { PayrollControls } from './components/PayrollControls';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import type { Payroll as PayrollType } from './types';
import { PayrollErrorBoundary } from './components/PayrollErrorBoundary';
import { PayrollFormDialog } from './components/PayrollFormDialog';

function PayrollContent() {
  const [columnWidths, setColumnWidths] = React.useState<number[]>([]);

  const formatPayPeriodDisplay = React.useCallback((period: string) => {
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
  }, []);

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
    isFormOpen,
    editingPayroll,
    isGeneratingPayroll,
    isGeneratingPayslips,
    setSearchQuery,
    setStatusFilter,
    setPayPeriodFilter,
    setIsFormOpen,
    formatDate,
    formatCurrency,
    getStatusColor,
    calculateTotals,
    handleAddPayroll,
    handleGeneratePayslips,
    handleEditPayroll,
    handleDeletePayroll,
    handleSavePayroll,
    handleApprove,
    handleMarkAsPaid,
    handleImportCSV,
    handleExportCSV,
    getEmployeeMonthlyContributions,
  } = usePayroll();

  const resolveContributionValue = React.useCallback(
    (item: PayrollType, field: 'sss' | 'philHealth' | 'pagIbig' | 'tax') => {
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
    },
    [getEmployeeMonthlyContributions]
  );

  const columnTotals = React.useMemo(
    () =>
      payrolls.reduce(
        (acc, item) => {
          acc.basicSalary += item.basicSalary ?? 0;
          acc.allowance += item.allowance ?? 0;
          acc.overtime += item.overtime ?? 0;
          acc.bonuses += item.bonuses ?? 0;
          acc.thirteenthMonth += item.thirteenthMonth ?? 0;
          acc.grossPay += item.grossPay ?? 0;

          const resolvedSss = resolveContributionValue(item, 'sss') ?? 0;
          const resolvedPhilHealth =
            resolveContributionValue(item, 'philHealth') ?? 0;
          const resolvedPagIbig =
            resolveContributionValue(item, 'pagIbig') ?? 0;
          const resolvedTax = resolveContributionValue(item, 'tax') ?? 0;

          acc.sss += resolvedSss;
          acc.philHealth += resolvedPhilHealth;
          acc.pagIbig += resolvedPagIbig;
          acc.tax += resolvedTax;

          acc.loans += item.loans ?? 0;
          acc.cashAdvance += item.cashAdvance ?? 0;
          acc.lwop += item.lwop ?? 0;
          acc.absentsLates += item.absentsLates ?? 0;
          acc.totalDeductions += item.totalDeductions ?? 0;
          acc.netPay += item.netPay ?? 0;

          return acc;
        },
        {
          basicSalary: 0,
          allowance: 0,
          overtime: 0,
          bonuses: 0,
          thirteenthMonth: 0,
          grossPay: 0,
          sss: 0,
          philHealth: 0,
          pagIbig: 0,
          tax: 0,
          loans: 0,
          cashAdvance: 0,
          lwop: 0,
          absentsLates: 0,
          totalDeductions: 0,
          netPay: 0,
        }
      ),
    [payrolls, resolveContributionValue]
  );

  // Stats Configuration
  const stats: StatCard[] = React.useMemo(
    () => [
      {
        title: 'Total Records',
        value: totalPayrolls,
        icon: <IconFileText size={20} stroke={1.6} />,
        color: 'blue',
        backgroundColor: 'var(--mantine-color-blue-6)',
      },
      {
        title: 'Pending',
        value: pendingPayrolls,
        icon: <IconClock size={20} stroke={1.6} />,
        color: 'orange',
        backgroundColor: 'var(--mantine-color-orange-6)',
      },
      {
        title: 'Approved',
        value: approvedPayrolls,
        icon: <IconCheck size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'Total Paid',
        value: formatCurrency(totalNetPay),
        icon: <IconCurrencyPeso size={20} stroke={1.6} />,
        color: 'indigo',
        backgroundColor: 'var(--mantine-color-indigo-6)',
      },
    ],
    [
      approvedPayrolls,
      formatCurrency,
      pendingPayrolls,
      totalNetPay,
      totalPayrolls,
    ]
  );

  // Table Columns Configuration
  const columns: TableColumn<PayrollType>[] = React.useMemo(
    () => [
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
    ],
    [
      formatCurrency,
      formatDate,
      formatPayPeriodDisplay,
      getStatusColor,
      resolveContributionValue,
    ]
  );

  // Table Actions Configuration
  const actions: TableAction<PayrollType>[] = React.useMemo(
    () => [
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
    ],
    [handleApprove, handleMarkAsPaid, handleEditPayroll, handleDeletePayroll]
  );

  const summaryGridTemplate = React.useMemo(() => {
    if (columnWidths.length === 0) {
      const columnCount = columns.length + (actions.length > 0 ? 1 : 0);
      return `repeat(${columnCount}, minmax(0, 1fr))`;
    }

    return columnWidths.map((width) => `${width}px`).join(' ');
  }, [columnWidths, columns.length, actions.length]);

  const summaryCells = React.useMemo(() => {
    return columns.map((column) => {
      const alignment = column.align || 'center';
      let content: React.ReactNode = null;

      switch (column.key) {
        case 'employee':
          content = (
            <Stack gap={0} align="flex-start">
              <Text fw={600}>Totals</Text>
              <Text size="xs" c="dimmed">
                Showing {payrolls.length} of {totalPayrolls} records
              </Text>
            </Stack>
          );
          break;
        case 'basicSalary':
          content = formatCurrency(columnTotals.basicSalary);
          break;
        case 'allowance':
          content = formatCurrency(columnTotals.allowance);
          break;
        case 'overtime':
          content = formatCurrency(columnTotals.overtime);
          break;
        case 'bonuses':
          content = formatCurrency(columnTotals.bonuses);
          break;
        case 'thirteenthMonth':
          content = formatCurrency(columnTotals.thirteenthMonth);
          break;
        case 'grossPay':
          content = (
            <Text fw={700} c="green">
              {formatCurrency(columnTotals.grossPay)}
            </Text>
          );
          break;
        case 'sss':
          content = formatCurrency(columnTotals.sss);
          break;
        case 'philHealth':
          content = formatCurrency(columnTotals.philHealth);
          break;
        case 'pagIbig':
          content = formatCurrency(columnTotals.pagIbig);
          break;
        case 'tax':
          content = formatCurrency(columnTotals.tax);
          break;
        case 'loans':
          content = formatCurrency(columnTotals.loans);
          break;
        case 'cashAdvance':
          content = formatCurrency(columnTotals.cashAdvance);
          break;
        case 'lwop':
          content = formatCurrency(columnTotals.lwop);
          break;
        case 'absentsLates':
          content = formatCurrency(columnTotals.absentsLates);
          break;
        case 'totalDeductions':
          content = (
            <Text fw={700} c="red">
              {formatCurrency(columnTotals.totalDeductions)}
            </Text>
          );
          break;
        case 'netPay':
          content = (
            <Text fw={800} c="blue">
              {formatCurrency(columnTotals.netPay)}
            </Text>
          );
          break;
        default:
          content = null;
          break;
      }

      return (
        <Box
          key={`summary-${column.key}`}
          style={{
            padding: '8px 12px',
            textAlign: alignment,
            display: 'flex',
            alignItems: 'center',
            justifyContent:
              alignment === 'left'
                ? 'flex-start'
                : alignment === 'right'
                  ? 'flex-end'
                  : 'center',
          }}
        >
          {typeof content === 'string' ? <Text>{content}</Text> : content}
        </Box>
      );
    });
  }, [columns, payrolls.length, totalPayrolls, columnTotals, formatCurrency]);

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
        <PayrollControls
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          payPeriodFilter={payPeriodFilter}
          onPayPeriodFilterChange={setPayPeriodFilter}
          payPeriods={payPeriods}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddPayroll={handleAddPayroll}
          addButtonLabel="Generate Payroll"
          onGeneratePayslips={handleGeneratePayslips}
          isGeneratingPayroll={isGeneratingPayroll}
          isGeneratingPayslips={isGeneratingPayslips}
        />

        {/* Payroll Table */}
        <DataTable
          data={payrolls}
          columns={columns}
          actions={actions}
          emptyMessage="No payroll records found"
          showSummary
          summaryLeft={null}
          summaryRight={
            <Box
              style={{
                display: 'grid',
                gridTemplateColumns: summaryGridTemplate,
                width: '100%',
                borderTop: '1px solid var(--mantine-color-gray-3)',
              }}
            >
              {summaryCells}
              {actions.length > 0 && (
                <Box
                  key="summary-actions"
                  style={{ padding: '8px 12px' }}
                ></Box>
              )}
            </Box>
          }
          onColumnWidthsChange={setColumnWidths}
        />
      </Stack>

      {/* Payroll Form Dialog */}
      <PayrollFormDialog
        opened={isFormOpen}
        editingPayroll={editingPayroll}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSavePayroll}
        calculateTotals={calculateTotals}
      />
    </PageLayout>
  );
}

export default function Payroll() {
  return (
    <PayrollErrorBoundary>
      <PayrollContent />
    </PayrollErrorBoundary>
  );
}
