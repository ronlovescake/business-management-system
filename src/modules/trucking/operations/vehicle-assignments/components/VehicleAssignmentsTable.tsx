'use client';

import { useMemo } from 'react';
import { Badge, Button, Group, Text } from '@mantine/core';
import {
  DataTable,
  type TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import type {
  VehicleAssignmentRecord,
  VehicleAssignmentStatus,
  VehicleAssignmentSummary,
} from '../types/vehicleAssignments.types';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

interface VehicleAssignmentsTableProps {
  data: VehicleAssignmentRecord[];
  emptyMessage?: string;
  height?: string;
  summary?: VehicleAssignmentSummary;
  getStatusColor: (status: VehicleAssignmentStatus) => string;
  onView?: (record: VehicleAssignmentRecord) => void;
  onEdit?: (record: VehicleAssignmentRecord) => void;
  onMarkComplete?: (record: VehicleAssignmentRecord) => void;
  onCancel?: (record: VehicleAssignmentRecord) => void;
}

export function VehicleAssignmentsTable({
  data,
  emptyMessage = 'No assignments found',
  height = '74vh',
  summary,
  getStatusColor,
  onView,
  onEdit,
  onMarkComplete,
  onCancel,
}: VehicleAssignmentsTableProps) {
  const columns: TableColumn<VehicleAssignmentRecord>[] = useMemo(
    () => [
      { key: 'vehicleId', label: 'Vehicle ID' },
      { key: 'plateNo', label: 'Plate No.' },
      { key: 'driver', label: 'Driver' },
      { key: 'helper', label: 'Helper' },
      {
        key: 'startDate',
        label: 'Start Date',
        render: (item) => formatDate(item.startDate),
      },
      {
        key: 'endDate',
        label: 'End Date',
        render: (item) => formatDate(item.endDate),
      },
      {
        key: 'status',
        label: 'Status',
        render: (item) => (
          <Badge color={getStatusColor(item.status)} variant="light">
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Badge>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        width: '9%',
        align: 'center',
        render: (item) => (
          <Group
            gap={6}
            wrap="wrap"
            justify="center"
            style={{ width: 'fit-content', margin: '0 auto' }}
          >
            <Button size="xs" variant="light" onClick={() => onView?.(item)}>
              View
            </Button>
            <Button
              size="xs"
              variant="light"
              color="blue"
              onClick={() => onEdit?.(item)}
            >
              Edit
            </Button>
            <Button
              size="xs"
              variant="light"
              color="green"
              onClick={() => onMarkComplete?.(item)}
            >
              Complete
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              onClick={() => onCancel?.(item)}
            >
              Cancel
            </Button>
          </Group>
        ),
      },
    ],
    [getStatusColor, onCancel, onEdit, onMarkComplete, onView]
  );

  const summaryLeft = summary ? (
    <Text size="sm" c="dimmed">
      Showing {summary.filteredCount} of {summary.totalCount} assignments
    </Text>
  ) : undefined;

  const summaryRight = summary ? (
    <Group gap="lg">
      <Text size="sm" fw={600}>
        Active: {summary.filteredActiveCount}
      </Text>
      <Text size="sm" fw={600}>
        Scheduled: {summary.filteredScheduledCount}
      </Text>
      <Text size="sm" fw={600}>
        Ending Soon (7d): {summary.filteredEndingSoonCount}
      </Text>
    </Group>
  ) : undefined;

  return (
    <DataTable
      data={data}
      columns={columns}
      emptyMessage={emptyMessage}
      height={height}
      showSummary={Boolean(summary)}
      summaryLeft={summaryLeft}
      summaryRight={summaryRight}
    />
  );
}
