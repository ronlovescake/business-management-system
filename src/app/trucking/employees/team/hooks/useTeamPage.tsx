import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Group, Text } from '@mantine/core';
import {
  IconCurrencyPeso,
  IconUserCheck,
  IconUserPause,
  IconUsers,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { useTeam } from './useTeam';
import type { Employee } from '../types';
import type { StatCard } from '@/components/ui';
import type {
  TableAction,
  TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import { getEmployeeInitials, formatEmployeeType } from '../lib/teamFormatters';

export function useTeamPage() {
  const router = useRouter();
  const teamStore = useTeam();
  const {
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    totalSalary,
    formatCurrency,
    formatDate,
    getStatusColor,
    handleEditEmployee,
    handleDeleteEmployee,
  } = teamStore;

  const stats = useMemo<StatCard[]>(
    () => [
      {
        title: 'Total Employees',
        value: totalEmployees,
        icon: <IconUsers size={20} stroke={1.6} />,
        color: 'indigo',
        backgroundColor: 'var(--mantine-color-indigo-6)',
      },
      {
        title: 'Active',
        value: activeEmployees,
        icon: <IconUserCheck size={20} stroke={1.6} />,
        color: 'green',
        backgroundColor: 'var(--mantine-color-green-6)',
      },
      {
        title: 'On Leave',
        value: onLeaveEmployees,
        icon: <IconUserPause size={20} stroke={1.6} />,
        color: 'orange',
        backgroundColor: 'var(--mantine-color-orange-6)',
      },
      {
        title: 'Total Salary',
        value: formatCurrency(totalSalary),
        icon: <IconCurrencyPeso size={20} stroke={1.6} />,
        color: 'teal',
        backgroundColor: 'var(--mantine-color-teal-6)',
      },
    ],
    [
      activeEmployees,
      formatCurrency,
      onLeaveEmployees,
      totalEmployees,
      totalSalary,
    ]
  );

  const handleRowDoubleClick = useCallback(
    (employee: Employee) => {
      router.push(`/trucking/employees/team/${employee.employeeId}`);
    },
    [router]
  );

  const columns = useMemo<TableColumn<Employee>[]>(
    () => [
      {
        key: 'employeeId',
        label: 'EMPLOYEE ID',
        render: (item) => <Text fw={500}>{item.employeeId}</Text>,
      },
      {
        key: 'name',
        label: 'EMPLOYEE NAME',
        render: (item) => (
          <Group gap="sm">
            <Avatar size={36} color="blue" src={item.profilePhoto || undefined}>
              {getEmployeeInitials(item)}
            </Avatar>
            <div>
              <Text fw={600}>{item.name}</Text>
              {item.email && (
                <Text size="xs" c="dimmed">
                  {item.email}
                </Text>
              )}
            </div>
          </Group>
        ),
      },
      {
        key: 'department',
        label: 'DEPARTMENT',
        render: (item) => <Text>{item.department}</Text>,
      },
      {
        key: 'jobTitle',
        label: 'JOB TITLE',
        render: (item) => (
          <Text size="sm">{item.jobTitle || item.position || 'N/A'}</Text>
        ),
      },
      {
        key: 'employeeType',
        label: 'EMPLOYEE TYPE',
        render: (item) => (
          <Text size="sm">{formatEmployeeType(item.employeeType)}</Text>
        ),
      },
      {
        key: 'status',
        label: 'STATUS',
        render: (item) => (
          <Badge color={getStatusColor(item.status)} variant="light">
            {item.status === 'on-leave'
              ? 'ON LEAVE'
              : item.status.toUpperCase()}
          </Badge>
        ),
      },
      {
        key: 'hireDate',
        label: 'HIRE DATE',
        render: (item) => <Text size="sm">{formatDate(item.hireDate)}</Text>,
      },
      {
        key: 'basicSalary',
        label: 'BASIC SALARY',
        render: (item) => (
          <Text fw={600} c="green">
            {formatCurrency(item.basicSalary)}
          </Text>
        ),
      },
      {
        key: 'allowance',
        label: 'ALLOWANCE',
        render: (item) => (
          <Text fw={600} c={item.allowance ? 'green' : 'dimmed'}>
            {item.allowance ? formatCurrency(item.allowance) : 'N/A'}
          </Text>
        ),
      },
      {
        key: 'contact',
        label: 'CONTACT',
        render: (item) => <Text size="sm">{item.contact}</Text>,
      },
    ],
    [formatCurrency, formatDate, getStatusColor]
  );

  const actions = useMemo<TableAction<Employee>[]>(
    () => [
      {
        icon: <IconEdit size={16} />,
        label: 'Edit',
        color: 'blue',
        onClick: (item) => handleEditEmployee(item),
      },
      {
        icon: <IconTrash size={16} />,
        label: 'Delete',
        color: 'red',
        onClick: (item) => handleDeleteEmployee(item.id),
      },
    ],
    [handleDeleteEmployee, handleEditEmployee]
  );

  return {
    ...teamStore,
    stats,
    columns,
    actions,
    handleRowDoubleClick,
  };
}
