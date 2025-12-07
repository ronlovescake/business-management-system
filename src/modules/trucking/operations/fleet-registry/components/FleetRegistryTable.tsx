'use client';

import { useMemo } from 'react';
import { Badge, Button, Group, Text } from '@mantine/core';
import {
  DataTable,
  type TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import type {
  FleetRegistryRecord,
  FleetRegistrySummary,
  FleetStatus,
} from '../types/fleetRegistry.types';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

interface FleetRegistryTableProps {
  data: FleetRegistryRecord[];
  emptyMessage?: string;
  height?: string;
  summary?: FleetRegistrySummary;
  getStatusColor: (status: FleetStatus) => string;
  onView?: (record: FleetRegistryRecord) => void;
  onEdit?: (record: FleetRegistryRecord) => void;
  onRetire?: (record: FleetRegistryRecord) => void;
}

export function FleetRegistryTable({
  data,
  emptyMessage = 'No fleet units found',
  height = '74vh',
  summary,
  getStatusColor,
  onView,
  onEdit,
  onRetire,
}: FleetRegistryTableProps) {
  const columns: TableColumn<FleetRegistryRecord>[] = useMemo(
    () => [
      { key: 'truckId', label: 'Truck ID' },
      { key: 'maker', label: 'Maker' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Year' },
      { key: 'plateNo', label: 'Plate No.' },
      { key: 'bodyNo', label: 'Body No.' },
      { key: 'chassisNo', label: 'Chassis No.' },
      { key: 'orCrInfo', label: 'OR/CR Info' },
      {
        key: 'ltoRegisterDate',
        label: 'LTO Register Date',
        render: (item) => formatDate(item.ltoRegisterDate),
      },
      { key: 'engineNo', label: 'Engine No.' },
      { key: 'capacity', label: 'Capacity' },
      { key: 'fuelType', label: 'Fuel Type' },
      {
        key: 'status',
        label: 'Status',
        render: (item) => (
          <Badge color={getStatusColor(item.status)} variant="light">
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Badge>
        ),
      },
      { key: 'remarks', label: 'Remarks' },
      {
        key: 'actions',
        label: 'Action',
        render: (item) => (
          <Group gap={6} wrap="wrap">
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
              color="red"
              onClick={() => onRetire?.(item)}
            >
              Retire
            </Button>
          </Group>
        ),
      },
    ],
    [getStatusColor, onEdit, onRetire, onView]
  );

  const summaryLeft = summary ? (
    <Text size="sm" c="dimmed">
      Showing {summary.filteredCount} of {summary.totalCount} units
    </Text>
  ) : undefined;

  const summaryRight = summary ? (
    <Group gap="lg">
      <Text size="sm" fw={600}>
        Active: {summary.activeCount}
      </Text>
      <Text size="sm" fw={600}>
        Maintenance: {summary.maintenanceCount}
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
