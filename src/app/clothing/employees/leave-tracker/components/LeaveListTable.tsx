import React from 'react';
import { DataTable } from '@/components/shared/PageTemplates';
import type {
  TableColumn,
  TableAction,
} from '@/components/shared/PageTemplates';
import { Text, Badge, Group, Avatar } from '@mantine/core';
import { IconCheck, IconX, IconEdit, IconTrash } from '@tabler/icons-react';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../types';

interface LeaveListTableProps {
  leaveRequests: LeaveRequest[];
  filteredRequests: LeaveRequest[];
  formatDate: (date: string) => string;
  formatDateRange: (startDate: string, endDate: string) => string;
  getStatusColor: (status: LeaveStatus) => string;
  getLeaveTypeColor: (leaveType: LeaveType) => string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (request: LeaveRequest) => void;
  onDelete: (id: string) => void;
}

export function LeaveListTable({
  leaveRequests,
  filteredRequests,
  formatDate,
  formatDateRange,
  getStatusColor,
  getLeaveTypeColor,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: LeaveListTableProps) {
  const getInitials = (name: string) => {
    const [first = '', second = ''] = name.split(' ');
    const firstInitial = first.charAt(0);
    const secondInitial = second.charAt(0);
    return `${firstInitial}${secondInitial}`.toUpperCase();
  };

  const columns: TableColumn<LeaveRequest>[] = [
    {
      key: 'employeeName',
      label: 'EMPLOYEE',
      render: (item) => (
        <Group gap="sm">
          <Avatar size={36} radius="xl" color="blue">
            {getInitials(item.employeeName)}
          </Avatar>
          <div>
            <Text fw={600}>{item.employeeName}</Text>
            <Text size="xs" c="dimmed">
              {item.employeeId}
            </Text>
          </div>
        </Group>
      ),
    },
    {
      key: 'leaveType',
      label: 'LEAVE TYPE',
      render: (item) => (
        <Badge color={getLeaveTypeColor(item.leaveType)} variant="light">
          {item.leaveType.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'dateRange',
      label: 'DATE RANGE',
      render: (item) => (
        <div>
          <Text size="sm">{formatDateRange(item.startDate, item.endDate)}</Text>
          <Text size="xs" c="dimmed">
            {item.numberOfDays} {item.numberOfDays === 1 ? 'day' : 'days'}
          </Text>
        </div>
      ),
    },
    {
      key: 'appliedDate',
      label: 'APPLIED',
      render: (item) => <Text size="sm">{formatDate(item.appliedDate)}</Text>,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (item) => (
        <Badge color={getStatusColor(item.status)} variant="light">
          {item.status.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'reason',
      label: 'REASON',
      render: (item) => (
        <Text size="sm" c="dimmed" lineClamp={2}>
          {item.reason}
        </Text>
      ),
    },
  ];

  const actions: TableAction<LeaveRequest>[] = [
    {
      icon: <IconCheck size={16} />,
      label: 'Approve',
      color: 'green',
      onClick: (request) => onApprove(request.id),
      show: (request) => request.status === 'pending',
    },
    {
      icon: <IconX size={16} />,
      label: 'Reject',
      color: 'red',
      onClick: (request) => onReject(request.id),
      show: (request) => request.status === 'pending',
    },
    {
      icon: <IconEdit size={16} />,
      label: 'Edit',
      color: 'blue',
      onClick: (request) => onEdit(request),
    },
    {
      icon: <IconTrash size={16} />,
      label: 'Delete',
      color: 'red',
      onClick: (request) => onDelete(request.id),
    },
  ];

  return (
    <DataTable
      data={filteredRequests}
      columns={columns}
      actions={actions}
      emptyMessage="No leave requests found"
      showSummary
      summaryLeft={
        <Text size="sm" c="dimmed">
          Showing {filteredRequests.length} of {leaveRequests.length} requests
        </Text>
      }
      summaryRight={
        <Text size="sm" fw={600}>
          Total Days:{' '}
          {filteredRequests.reduce((sum, req) => sum + req.numberOfDays, 0)}
        </Text>
      }
    />
  );
}
