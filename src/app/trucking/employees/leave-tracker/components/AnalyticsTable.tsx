import React from 'react';
import { DataTable } from '@/components/shared/PageTemplates';
import type { TableColumn } from '@/components/shared/PageTemplates';
import { Text, Badge, Progress } from '@mantine/core';
import type { LeaveType, MonthlyBreakdownItem } from '../types';

interface AnalyticsTableProps {
  monthlyBreakdown: MonthlyBreakdownItem[];
  totalDaysRequested: number;
  getLeaveTypeColor: (leaveType: LeaveType) => string;
}

export const AnalyticsTable = React.memo(function AnalyticsTable({
  monthlyBreakdown,
  totalDaysRequested,
  getLeaveTypeColor,
}: AnalyticsTableProps) {
  // Add id to each item for DataTable compatibility
  // Cast to any to work around index signature limitations
  const dataWithIds = monthlyBreakdown.map((item, index) => ({
    ...item,
    id: index,
  })) as (MonthlyBreakdownItem & { id: number })[];

  const columns: TableColumn<(typeof dataWithIds)[0]>[] = [
    {
      key: 'leaveType',
      label: 'LEAVE TYPE',
      render: (item) => (
        <div>
          <Badge
            color={getLeaveTypeColor(item.leaveType as LeaveType)}
            variant="light"
          >
            {(item.leaveType as string).toUpperCase()}
          </Badge>
        </div>
      ),
    },
    {
      key: 'total',
      label: 'TOTAL DAYS',
      render: (item) => (
        <div>
          <Text fw={600} size="sm">
            {item.total} days
          </Text>
          <Progress
            value={item.percentage as number}
            color={getLeaveTypeColor(item.leaveType as LeaveType)}
            size="xs"
            mt={4}
          />
        </div>
      ),
    },
    {
      key: 'percentage',
      label: 'PERCENTAGE',
      render: (item) => (
        <Text size="sm" fw={600}>
          {(item.percentage as number).toFixed(1)}%
        </Text>
      ),
    },
    {
      key: 'January',
      label: 'JAN',
      render: (item) => <Text size="sm">{item.January || ''}</Text>,
    },
    {
      key: 'February',
      label: 'FEB',
      render: (item) => <Text size="sm">{item.February || ''}</Text>,
    },
    {
      key: 'March',
      label: 'MAR',
      render: (item) => <Text size="sm">{item.March || ''}</Text>,
    },
    {
      key: 'April',
      label: 'APR',
      render: (item) => <Text size="sm">{item.April || ''}</Text>,
    },
    {
      key: 'May',
      label: 'MAY',
      render: (item) => <Text size="sm">{item.May || ''}</Text>,
    },
    {
      key: 'June',
      label: 'JUN',
      render: (item) => <Text size="sm">{item.June || ''}</Text>,
    },
    {
      key: 'July',
      label: 'JUL',
      render: (item) => <Text size="sm">{item.July || ''}</Text>,
    },
    {
      key: 'August',
      label: 'AUG',
      render: (item) => <Text size="sm">{item.August || ''}</Text>,
    },
    {
      key: 'September',
      label: 'SEP',
      render: (item) => <Text size="sm">{item.September || ''}</Text>,
    },
    {
      key: 'October',
      label: 'OCT',
      render: (item) => <Text size="sm">{item.October || ''}</Text>,
    },
    {
      key: 'November',
      label: 'NOV',
      render: (item) => <Text size="sm">{item.November || ''}</Text>,
    },
    {
      key: 'December',
      label: 'DEC',
      render: (item) => <Text size="sm">{item.December || ''}</Text>,
    },
  ];

  return (
    <DataTable
      data={dataWithIds}
      columns={columns}
      emptyMessage="No leave data available for analytics"
      showSummary
      summaryLeft={
        <Text size="sm" c="dimmed">
          Showing {monthlyBreakdown.length} leave types
        </Text>
      }
      summaryRight={
        <Text size="sm" fw={600}>
          Total Days Requested: {totalDaysRequested}
        </Text>
      }
    />
  );
});
