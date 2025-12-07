'use client';

import { Group, Text, Badge } from '@mantine/core';
import {
  DataTable,
  type TableColumn,
} from '@/components/shared/PageTemplates/DataTable';
import type { TemplateRecord, TemplateSummary } from '../types/template.types';

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

const baseColumns: TableColumn<TemplateRecord>[] = [
  { key: 'date', label: 'Date', render: (item) => formatDate(item.date) },
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'category', label: 'Category' },
  {
    key: 'metricIn',
    label: 'Metric In',
    align: 'right',
    render: (item) => formatCurrency(item.metricIn),
  },
  {
    key: 'metricOut',
    label: 'Metric Out',
    align: 'right',
    render: (item) => formatCurrency(item.metricOut),
  },
  {
    key: 'status',
    label: 'Status',
    render: (item) => (
      <Badge color="blue" variant="light">
        {item.status.replace('-', ' ')}
      </Badge>
    ),
  },
  { key: 'notes', label: 'Notes', align: 'left' },
];

interface TemplateTableProps {
  data: TemplateRecord[];
  emptyMessage?: string;
  height?: string;
  summary?: TemplateSummary & { formatCurrency: (value: number) => string };
}

export function TemplateTable({
  data,
  emptyMessage = 'No records yet',
  height = '74vh',
  summary,
}: TemplateTableProps) {
  const summaryLeft = summary ? (
    <Text size="sm" c="dimmed">
      Showing {summary.filteredCount} of {summary.totalCount} records
    </Text>
  ) : undefined;

  const summaryRight = summary ? (
    <Group gap="lg">
      <Text size="sm" fw={600}>
        Metric In: {summary.formatCurrency(summary.filteredMetricIn)}
      </Text>
      <Text size="sm" fw={600}>
        Metric Out: {summary.formatCurrency(summary.filteredMetricOut)}
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
      emptyMessage={emptyMessage}
      height={height}
      showSummary={Boolean(summary)}
      summaryLeft={summaryLeft}
      summaryRight={summaryRight}
    />
  );
}
