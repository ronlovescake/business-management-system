'use client';

import { Group, Text } from '@mantine/core';
import {
  DataTable,
  type TableColumn,
  type TableAction,
} from '@/components/shared/PageTemplates/DataTable';
import { IconPencil, IconTrash } from '@tabler/icons-react';

export interface TripRecord {
  id: string;
  date: string;
  truckId: string;
  destination: string;
  grossRevenue: number;
  fuelLiters: number;
  fuelCost: number;
  maintenance: number;
  tollFees: number;
  driver: string;
  helper: string;
  miscExpenses: number;
  totalExpenses: number;
  remarks: string;
}

interface TripsTableProps {
  data: TripRecord[];
  emptyMessage?: string;
  height?: string;
  summary?: {
    totalCount: number;
    filteredCount: number;
    filteredRevenue: number;
    filteredExpenses: number;
    filteredNet: number;
    formatCurrency: (value: number) => string;
  };
  onEditTrip?: (trip: TripRecord) => void;
  onDeleteTrip?: (trip: TripRecord) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const baseColumns: TableColumn<TripRecord>[] = [
  { key: 'date', label: 'Date', render: (item) => formatDate(item.date) },
  { key: 'truckId', label: 'Vehicle ID' },
  { key: 'destination', label: 'Destination' },
  {
    key: 'grossRevenue',
    label: 'Gross Revenue',
    align: 'right',
    render: (item) => formatCurrency(item.grossRevenue),
  },
  {
    key: 'fuelLiters',
    label: 'Fuel (Liters)',
    align: 'right',
    render: (item) =>
      `${item.fuelLiters.toLocaleString('en-US', { maximumFractionDigits: 2 })} L`,
  },
  {
    key: 'fuelCost',
    label: 'Fuel Cost',
    align: 'right',
    render: (item) => formatCurrency(item.fuelCost),
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    align: 'right',
    render: (item) => formatCurrency(item.maintenance),
  },
  {
    key: 'tollFees',
    label: 'Toll Fees',
    align: 'right',
    render: (item) => formatCurrency(item.tollFees),
  },
  { key: 'driver', label: 'Driver' },
  { key: 'helper', label: 'Helper' },
  {
    key: 'miscExpenses',
    label: 'Misc. Expenses',
    align: 'right',
    render: (item) => formatCurrency(item.miscExpenses),
  },
  {
    key: 'totalExpenses',
    label: 'Total Expenses',
    align: 'right',
    render: (item) => formatCurrency(item.totalExpenses),
  },
  { key: 'remarks', label: 'Remarks', align: 'left' },
];

export function TripsTable({
  data,
  emptyMessage = 'No trips logged yet',
  height = '74vh',
  summary,
  onEditTrip,
  onDeleteTrip,
}: TripsTableProps) {
  const actions: TableAction<TripRecord>[] = [];

  if (onEditTrip) {
    actions.push({
      icon: <IconPencil size={16} />,
      label: 'Edit trip',
      onClick: (item) => onEditTrip(item),
    });
  }

  if (onDeleteTrip) {
    actions.push({
      icon: <IconTrash size={16} />,
      label: 'Delete trip',
      color: 'red',
      onClick: (item) => onDeleteTrip(item),
    });
  }

  const summaryLeft = summary ? (
    <Text size="sm" c="dimmed">
      Showing {summary.filteredCount} of {summary.totalCount} trips
    </Text>
  ) : undefined;

  const summaryRight = summary ? (
    <Group gap="lg">
      <Text size="sm" fw={600}>
        Revenue: {summary.formatCurrency(summary.filteredRevenue)}
      </Text>
      <Text size="sm" fw={600}>
        Expenses: {summary.formatCurrency(summary.filteredExpenses)}
      </Text>
      <Text size="sm" fw={600}>
        Net: {summary.formatCurrency(summary.filteredNet)}
      </Text>
    </Group>
  ) : undefined;

  return (
    <DataTable
      data={data}
      columns={baseColumns}
      actions={actions}
      emptyMessage={emptyMessage}
      height={height}
      showSummary={Boolean(summary)}
      summaryLeft={summaryLeft}
      summaryRight={summaryRight}
    />
  );
}
