'use client';

import { useMemo } from 'react';
import { Badge, Group, Text } from '@mantine/core';
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
}

export function FleetRegistryTable({
  data,
  emptyMessage = 'No fleet units found',
  height = '74vh',
  summary,
  getStatusColor,
}: FleetRegistryTableProps) {
  const columns: TableColumn<FleetRegistryRecord>[] = useMemo(
    () => [
      { key: 'truckId', label: 'Truck ID' },
      { key: 'maker', label: 'Maker' },
      { key: 'model', label: 'Model' },
      { key: 'year', label: 'Year' },
      { key: 'plateNo', label: 'Plate No.' },
      { key: 'engineNo', label: 'Engine No.' },
      { key: 'bodyNo', label: 'Body No.' },
      { key: 'chassisNo', label: 'Chassis No.' },
      { key: 'orCrInfo', label: 'OR/CR Info' },
      {
        key: 'ltoRegisterDate',
        label: 'LTO Register Date',
        render: (item) => formatDate(item.ltoRegisterDate),
      },
      { key: 'capacity', label: 'Capacity' },
      { key: 'passengerCapacity', label: 'Passenger Capacity' },
      { key: 'grossWeight', label: 'Gross Weight' },
      { key: 'netWeight', label: 'Net Weight' },
      { key: 'bodyType', label: 'Body Type' },
      { key: 'series', label: 'Series' },
      { key: 'classification', label: 'Classification' },
      { key: 'vehicleType', label: 'Vehicle Type' },
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
    ],
    [getStatusColor]
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
