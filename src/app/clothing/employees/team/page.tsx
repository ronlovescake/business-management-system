'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Stack, Text, Badge, Tabs, Paper, Group, Avatar } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconUsers,
  IconUserCheck,
  IconUserPause,
  IconCurrencyPeso,
  IconEdit,
  IconTrash,
  IconList,
  IconChartBar,
} from '@tabler/icons-react';
import { useTeam } from './hooks/useTeam';
// Direct imports for faster compilation (bypasses barrel export)
import { StatsCardGrid, type StatCard } from '@/components/ui';
import { PageControls } from '@/components/shared/PageTemplates/PageControls';
import { DataTable } from '@/components/shared/PageTemplates/DataTable';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import { EmployeeFormDialog } from './components/EmployeeFormDialog';
import type { Employee as EmployeeType } from './types';

export default function Team() {
  const router = useRouter();
  const {
    // State
    employees,
    searchQuery,
    departmentFilter,
    statusFilter,
    isFormOpen,
    editingEmployee,
    activeTab,
    departments,

    // Computed Values
    totalEmployees,
    activeEmployees,
    onLeaveEmployees,
    totalSalary,

    // Setters
    setSearchQuery,
    setDepartmentFilter,
    setStatusFilter,
    setIsFormOpen,
    setActiveTab,

    // Utility Functions
    formatDate,
    formatCurrency,
    getStatusColor,

    // Event Handlers
    handleAddEmployee,
    handleEditEmployee,
    handleDeleteEmployee,
    handleSaveEmployee,
    handleImportCSV,
    handleExportCSV,
  } = useTeam();

  const getInitials = (employee: EmployeeType) => {
    const firstInitial =
      employee.firstName?.[0] || employee.name?.split(' ')[0]?.[0] || '';
    const lastInitial =
      employee.lastName?.[0] || employee.name?.split(' ')[1]?.[0] || '';
    return `${firstInitial}${lastInitial}`.toUpperCase();
  };

  // Stats Configuration
  const stats: StatCard[] = [
    {
      title: 'Total Employees',
      value: totalEmployees,
      icon: <IconUsers size={20} stroke={1.6} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
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
  ];

  // Table Columns Configuration
  const columns: TableColumn<EmployeeType>[] = [
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
            {getInitials(item)}
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
        <Text size="sm">
          {item.employeeType
            ? item.employeeType
                .split('-')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join('-')
            : 'N/A'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (item) => (
        <Badge color={getStatusColor(item.status)} variant="light">
          {item.status === 'on-leave' ? 'ON LEAVE' : item.status.toUpperCase()}
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
  ];

  // Handle double-click on employee row
  const handleRowDoubleClick = (employee: EmployeeType) => {
    router.push(`/clothing/employees/team/${employee.employeeId}`);
  };

  // Table Actions Configuration
  const actions: TableAction<EmployeeType>[] = [
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
        <PageControls
          title="Team Management"
          searchPlaceholder="Search by name, ID, department, or contact..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              placeholder: 'Filter by department',
              data: departments.map((d) => (d === 'all' ? 'All' : d)),
              value: departmentFilter,
              onChange: (value: string | null) =>
                setDepartmentFilter(value === 'All' || !value ? 'all' : value),
            },
            {
              placeholder: 'Filter by status',
              data: ['All', 'active', 'inactive', 'on-leave'],
              value: statusFilter,
              onChange: (value: string | null) =>
                setStatusFilter(value === 'All' || !value ? 'all' : value),
            },
          ]}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAdd={handleAddEmployee}
          addButtonLabel="Add Employee"
        />

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="employees" leftSection={<IconList size={16} />}>
              Employees
            </Tabs.Tab>
            <Tabs.Tab
              value="analytics"
              leftSection={<IconChartBar size={16} />}
            >
              Analytics
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="employees" pt="lg">
            {/* Employee Table */}
            <DataTable
              data={employees}
              columns={columns}
              actions={actions}
              emptyMessage="No employees found"
              onRowDoubleClick={handleRowDoubleClick}
            />
          </Tabs.Panel>

          <Tabs.Panel value="analytics" pt="lg">
            {/* Analytics Placeholder */}
            <Paper
              p="xl"
              withBorder
              style={{
                textAlign: 'center',
                backgroundColor: '#f8f9fa',
                minHeight: '400px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div>
                <IconChartBar size={64} stroke={1.5} color="#adb5bd" />
                <Text size="xl" fw={600} c="dimmed" mt="md">
                  Analytics Coming Soon
                </Text>
                <Text size="sm" c="dimmed" mt="xs">
                  Employee analytics and insights will be displayed here
                </Text>
              </div>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Form Dialog */}
      <EmployeeFormDialog
        opened={isFormOpen}
        editingEmployee={editingEmployee}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveEmployee}
      />
    </PageLayout>
  );
}
