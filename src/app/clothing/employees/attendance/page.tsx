'use client';

import React from 'react';
import { Stack, Text, Badge, Group, Avatar } from '@mantine/core';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  IconUsers,
  IconUserCheck,
  IconAlertTriangle,
  IconUserX,
  IconClock,
  IconCircleCheck,
  IconUserMinus,
  IconTrash,
} from '@tabler/icons-react';
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
import { useAttendance } from './hooks/useAttendance';
import type { AttendanceRecord } from './types';
import { AttendanceFormDialog } from './components/AttendanceFormDialog';

export default function Attendance() {
  const {
    filteredRecords,
    searchQuery,
    statusFilter,
    totalRecords,
    presentCount,
    lateCount,
    absentCount,
    averageHours,
    setSearchQuery,
    setStatusFilter,
    formatDate,
    formatTime,
    formatHours,
    getStatusColor,
    handleDeleteRecord,
    handleMarkStatus,
    handleAddRecord,
    handleCloseRecordModal,
    handleSaveRecord,
    updateRecordForm,
    recordForm,
    isRecordModalOpen,
    handleImportCSV,
    handleExportCSV,
  } = useAttendance();

  const getInitials = (record: AttendanceRecord) => {
    const [first = '', second = ''] = record.employeeName.split(' ');
    const firstInitial = first.charAt(0);
    const secondInitial = second.charAt(0);
    return `${firstInitial}${secondInitial}`.toUpperCase();
  };

  const stats: StatCard[] = [
    {
      title: 'Total Records Today',
      value: totalRecords.toString(),
      icon: <IconUsers size={32} stroke={1.5} />,
    },
    {
      title: 'Present',
      value: presentCount.toString(),
      icon: <IconUserCheck size={32} stroke={1.5} />,
    },
    {
      title: 'Late',
      value: lateCount.toString(),
      icon: <IconAlertTriangle size={32} stroke={1.5} />,
    },
    {
      title: 'Absent',
      value: absentCount.toString(),
      icon: <IconUserX size={32} stroke={1.5} />,
    },
  ];

  const columns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'employeeName',
      label: 'EMPLOYEE',
      render: (item) => (
        <Group gap="sm">
          <Avatar size={36} radius="xl" color="blue">
            {getInitials(item)}
          </Avatar>
          <div>
            <Text fw={600}>{item.employeeName}</Text>
            <Text size="xs" c="dimmed">
              {item.employeeId} • {item.position}
            </Text>
          </div>
        </Group>
      ),
    },
    {
      key: 'date',
      label: 'DATE',
      render: (item) => <Text size="sm">{formatDate(item.date)}</Text>,
    },
    {
      key: 'timeIn',
      label: 'TIME IN',
      render: (item) => (
        <Text size="sm">
          {item.timeIn === '00:00' ? '—' : formatTime(item.timeIn)}
        </Text>
      ),
    },
    {
      key: 'timeOut',
      label: 'TIME OUT',
      render: (item) => (
        <Text size="sm">
          {item.timeOut === '00:00' ? '—' : formatTime(item.timeOut)}
        </Text>
      ),
    },
    {
      key: 'break1',
      label: 'BREAK 1 (15min)',
      render: (item) => (
        <Text size="sm" c="dimmed">
          {item.break1Start && item.break1End
            ? `${formatTime(item.break1Start)} - ${formatTime(item.break1End)}`
            : '—'}
        </Text>
      ),
    },
    {
      key: 'lunch',
      label: 'LUNCH (1hr)',
      render: (item) => (
        <Text size="sm" c="dimmed">
          {item.lunchStart && item.lunchEnd
            ? `${formatTime(item.lunchStart)} - ${formatTime(item.lunchEnd)}`
            : '—'}
        </Text>
      ),
    },
    {
      key: 'break2',
      label: 'BREAK 2 (15min)',
      render: (item) => (
        <Text size="sm" c="dimmed">
          {item.break2Start && item.break2End
            ? `${formatTime(item.break2Start)} - ${formatTime(item.break2End)}`
            : '—'}
        </Text>
      ),
    },
    {
      key: 'totalHours',
      label: 'HOURS',
      render: (item) => <Text fw={600}>{formatHours(item.totalHours)}</Text>,
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
      key: 'details',
      label: 'DETAILS',
      render: (item) => (
        <Text size="sm" c="dimmed">
          {item.details ?? '—'}
        </Text>
      ),
    },
  ];

  const actions: TableAction<AttendanceRecord>[] = [
    {
      icon: <IconCircleCheck size={16} />,
      label: 'Mark Present',
      color: 'green',
      onClick: (record) => handleMarkStatus(record.id, 'present'),
      show: (record) => record.status !== 'present',
    },
    {
      icon: <IconClock size={16} />,
      label: 'Mark Late',
      color: 'yellow',
      onClick: (record) => handleMarkStatus(record.id, 'late'),
      show: (record) => record.status !== 'late',
    },
    {
      icon: <IconUserMinus size={16} />,
      label: 'Mark Absent',
      color: 'orange',
      onClick: (record) => handleMarkStatus(record.id, 'absent'),
      show: (record) => record.status !== 'absent',
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (record) => handleDeleteRecord(record.id),
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <StatsCardGroup stats={stats} />

        <PageControls
          title="Attendance Records"
          searchPlaceholder="Search by employee, department, or details..."
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filters={[
            {
              placeholder: 'Filter by status',
              data: ['All', 'present', 'late', 'absent', 'on-leave'],
              value: statusFilter === 'all' ? 'All' : statusFilter,
              onChange: (value: string | null) =>
                setStatusFilter(
                  !value || value === 'All'
                    ? 'all'
                    : (value as AttendanceRecord['status'])
                ),
            },
          ]}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAdd={handleAddRecord}
          addButtonLabel="Record Attendance"
        />

        <DataTable
          data={filteredRecords}
          columns={columns}
          actions={actions}
          emptyMessage="No attendance records found"
          showSummary
          summaryLeft={
            <Text size="sm" c="dimmed">
              Showing {filteredRecords.length} of {totalRecords} records
            </Text>
          }
          summaryRight={
            <Text size="sm" fw={600}>
              Average Hours: {formatHours(averageHours)}
            </Text>
          }
        />

        <AttendanceFormDialog
          opened={isRecordModalOpen}
          onClose={handleCloseRecordModal}
          formValues={recordForm}
          onChange={updateRecordForm}
          onSubmit={handleSaveRecord}
        />
      </Stack>
    </PageLayout>
  );
}
