import { useCallback, useMemo } from 'react';
import { Badge, Group, Text } from '@mantine/core';
import {
  IconCash,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconCurrencyPeso,
  IconEdit,
  IconFileText,
  IconTrash,
} from '@tabler/icons-react';
import type { StatCard } from '@/components/ui';
import type {
  TableAction,
  TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import { usePayroll } from './usePayroll';
import type { Payroll, PayrollColumnTotals } from '../types';
import { useEmployeeStatusMap } from '@/hooks/useEmployeeStatusMap';
import { EmploymentStatusBadge } from '@/components/ui/EmploymentStatusBadge';

const INITIAL_TOTALS: PayrollColumnTotals = {
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
};

type ContributionField = 'sss' | 'philHealth' | 'pagIbig' | 'tax';

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

export function usePayrollPage(apiBasePath?: string) {
  const payrollStore = usePayroll(apiBasePath);
  const { getStatus } = useEmployeeStatusMap(apiBasePath);
  const {
    payrolls,
    totalPayrolls,
    pendingPayrolls,
    approvedPayrolls,
    totalNetPay,
    formatCurrency,
    formatDate,
    getStatusColor,
    getEmployeeMonthlyContributions,
    handleApprove,
    handleMarkAsPaid,
    handleEditPayroll,
    handleDeletePayroll,
  } = payrollStore;

  const stats = useMemo<StatCard[]>(
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

  const resolveContributionValue = useCallback(
    (item: Payroll, field: ContributionField) => {
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

  const columnTotals = useMemo(() => {
    return payrolls.reduce<PayrollColumnTotals>(
      (acc, item) => {
        acc.basicSalary += item.basicSalary ?? 0;
        acc.allowance += item.allowance ?? 0;
        acc.overtime += item.overtime ?? 0;
        acc.bonuses += item.bonuses ?? 0;
        acc.thirteenthMonth += item.thirteenthMonth ?? 0;
        acc.grossPay += item.grossPay ?? 0;

        acc.sss += resolveContributionValue(item, 'sss') ?? 0;
        acc.philHealth += resolveContributionValue(item, 'philHealth') ?? 0;
        acc.pagIbig += resolveContributionValue(item, 'pagIbig') ?? 0;
        acc.tax += resolveContributionValue(item, 'tax') ?? 0;

        acc.loans += item.loans ?? 0;
        acc.cashAdvance += item.cashAdvance ?? 0;
        acc.lwop += item.lwop ?? 0;
        acc.absentsLates += item.absentsLates ?? 0;
        acc.totalDeductions += item.totalDeductions ?? 0;
        acc.netPay += item.netPay ?? 0;

        return acc;
      },
      { ...INITIAL_TOTALS }
    );
  }, [payrolls, resolveContributionValue]);

  const columns = useMemo<TableColumn<Payroll>[]>(
    () => [
      {
        key: 'employee',
        label: 'EMPLOYEE NAME',
        align: 'left',
        render: (item) => (
          <Group gap="xs">
            <Text fw={500}>{item.employee}</Text>
            <EmploymentStatusBadge
              status={getStatus(item.employee, item.employeeId ?? undefined)}
            />
          </Group>
        ),
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
    [formatCurrency, formatDate, getStatus, getStatusColor, resolveContributionValue]
  );

  const actions = useMemo<TableAction<Payroll>[]>(
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
    [handleApprove, handleDeletePayroll, handleEditPayroll, handleMarkAsPaid]
  );

  return {
    ...payrollStore,
    stats,
    columns,
    actions,
    columnTotals,
  };
}
