'use client';

import React, { useMemo, useState } from 'react';
import {
  Card,
  Group,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Dayjs } from 'dayjs';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { dayjs } from '@/utils/date';
import type { ProfitLossDetailRow } from '../hooks/useProfitLoss';

type BreakdownView = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type ChartMode = 'stacked' | 'grouped';

type BreakdownRow = {
  label: string;
  key: string;
  timestamp: number;
  revenue: number;
  cogs: number;
  expenses: number;
  netProfit: number;
  prevNetProfit?: number | null;
};

const VIEW_OPTIONS: Array<{ value: BreakdownView; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: '3 Months' },
  { value: 'yearly', label: 'Yearly' },
];

const formatBucketLabel = (view: BreakdownView, value: Dayjs) => {
  switch (view) {
    case 'daily':
      return value.format('MMM D, YYYY');
    case 'weekly':
      return `Week of ${value.format('MMM D, YYYY')}`;
    case 'monthly':
      return value.format('MMM YYYY');
    case 'quarterly':
      return value.format('MMM YYYY');
    case 'yearly':
      return value.format('YYYY');
    default:
      return value.format('MMM D, YYYY');
  }
};

const bucketStart = (view: BreakdownView, value: Dayjs) => {
  switch (view) {
    case 'daily':
      return value.startOf('day');
    case 'weekly':
      return value.startOf('week');
    case 'monthly':
      return value.startOf('month');
    case 'quarterly':
      return value.month(value.month() - (value.month() % 3)).startOf('month');
    case 'yearly':
      return value.startOf('year');
    default:
      return value.startOf('day');
  }
};

const buildBreakdownRows = (
  rows: ProfitLossDetailRow[],
  view: BreakdownView
) => {
  const buckets = new Map<string, BreakdownRow>();

  rows.forEach((row) => {
    if (!row.date) {
      return;
    }

    const parsed = dayjs(row.date);
    if (!parsed.isValid()) {
      return;
    }

    const start = bucketStart(view, parsed);
    const key = start.format('YYYY-MM-DD');
    const current = buckets.get(key) ?? {
      label: formatBucketLabel(view, start),
      key,
      timestamp: start.valueOf(),
      revenue: 0,
      cogs: 0,
      expenses: 0,
      netProfit: 0,
    };

    if (row.type === 'Revenue') {
      current.revenue += row.amount;
    } else if (row.category === 'COGS') {
      current.cogs += row.amount;
    } else {
      current.expenses += row.amount;
    }

    buckets.set(key, current);
  });

  const result = Array.from(buckets.values())
    .map((bucket) => ({
      ...bucket,
      netProfit: bucket.revenue - bucket.cogs - bucket.expenses,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  return result;
};

const clampDateRange = (
  range: [Date | null, Date | null]
): { start: Dayjs | null; end: Dayjs | null } => {
  const [start, end] = range;
  return {
    start: start ? dayjs(start).startOf('day') : null,
    end: end ? dayjs(end).endOf('day') : null,
  };
};

const filterRowsByRange = (
  rows: ProfitLossDetailRow[],
  range: [Date | null, Date | null]
) => {
  const { start, end } = clampDateRange(range);

  if (!start && !end) {
    return rows;
  }

  return rows.filter((row) => {
    if (!row.date) {
      return false;
    }
    const parsed = dayjs(row.date);
    if (!parsed.isValid()) {
      return false;
    }
    if (start && parsed.isBefore(start)) {
      return false;
    }
    if (end && parsed.isAfter(end)) {
      return false;
    }
    return true;
  });
};

export function ProfitLossBreakdownsPanel({
  rows,
  formatCurrency,
}: {
  rows: ProfitLossDetailRow[];
  formatCurrency: (value: number) => string;
}) {
  const [view, setView] = useState<BreakdownView>('weekly');
  const [mode, setMode] = useState<ChartMode>('stacked');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([
    null,
    null,
  ]);
  const [comparePrev, setComparePrev] = useState(false);
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(
    null
  );

  const filteredRows = useMemo(
    () => filterRowsByRange(rows, dateRange),
    [dateRange, rows]
  );

  const chartData = useMemo(
    () => buildBreakdownRows(filteredRows, view),
    [filteredRows, view]
  );

  const compareRows = useMemo(() => {
    if (!comparePrev) {
      return [];
    }

    const { start, end } = clampDateRange(dateRange);
    const hasExplicitRange = Boolean(start && end);
    const minDate = filteredRows.reduce<Dayjs | null>((acc, row) => {
      if (!row.date) {
        return acc;
      }
      const parsed = dayjs(row.date);
      if (!parsed.isValid()) {
        return acc;
      }
      if (!acc || parsed.isBefore(acc)) {
        return parsed;
      }
      return acc;
    }, null);
    const maxDate = filteredRows.reduce<Dayjs | null>((acc, row) => {
      if (!row.date) {
        return acc;
      }
      const parsed = dayjs(row.date);
      if (!parsed.isValid()) {
        return acc;
      }
      if (!acc || parsed.isAfter(acc)) {
        return parsed;
      }
      return acc;
    }, null);

    const rangeStart = hasExplicitRange ? start : minDate;
    const rangeEnd = hasExplicitRange ? end : maxDate;

    if (!rangeStart || !rangeEnd) {
      return [];
    }

    const durationDays = rangeEnd.diff(rangeStart, 'day') + 1;
    const prevEnd = rangeStart.subtract(1, 'day').endOf('day');
    const prevStart = prevEnd.subtract(durationDays - 1, 'day').startOf('day');

    return rows.filter((row) => {
      if (!row.date) {
        return false;
      }
      const parsed = dayjs(row.date);
      if (!parsed.isValid()) {
        return false;
      }
      return (
        (parsed.isAfter(prevStart) || parsed.isSame(prevStart)) &&
        (parsed.isBefore(prevEnd) || parsed.isSame(prevEnd))
      );
    });
  }, [comparePrev, dateRange, filteredRows, rows]);

  const compareChartData = useMemo(
    () => buildBreakdownRows(compareRows, view),
    [compareRows, view]
  );

  const combinedChartData = useMemo(() => {
    if (!comparePrev) {
      return chartData;
    }

    return chartData.map((row, index) => ({
      ...row,
      prevNetProfit: compareChartData[index]?.netProfit ?? null,
    }));
  }, [chartData, compareChartData, comparePrev]);

  const resolvedSelectedKey = useMemo(() => {
    if (
      selectedBucketKey &&
      chartData.some((row) => row.key === selectedBucketKey)
    ) {
      return selectedBucketKey;
    }
    return chartData[0]?.key ?? null;
  }, [chartData, selectedBucketKey]);

  const selectedBucketSummary = useMemo(() => {
    if (!resolvedSelectedKey) {
      return [] as Array<{
        category: string;
        type: string;
        amount: number;
      }>;
    }

    const grouped = new Map<
      string,
      { category: string; type: string; amount: number }
    >();

    filteredRows.forEach((row) => {
      if (!row.date) {
        return;
      }
      const parsed = dayjs(row.date);
      if (!parsed.isValid()) {
        return;
      }
      const start = bucketStart(view, parsed).format('YYYY-MM-DD');
      if (start !== resolvedSelectedKey) {
        return;
      }
      const key = `${row.type}::${row.category}`;
      const current = grouped.get(key) ?? {
        category: row.category,
        type: row.type,
        amount: 0,
      };
      current.amount += row.amount;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.amount - a.amount);
  }, [filteredRows, resolvedSelectedKey, view]);

  const totals = useMemo(() => {
    return chartData.reduce(
      (acc, row) => {
        acc.revenue += row.revenue;
        acc.cogs += row.cogs;
        acc.expenses += row.expenses;
        acc.netProfit += row.netProfit;
        return acc;
      },
      { revenue: 0, cogs: 0, expenses: 0, netProfit: 0 }
    );
  }, [chartData]);

  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Title order={4}>P&L Breakdowns</Title>
            <Text size="sm" c="dimmed">
              Revenue vs COGS vs Expenses over time.
            </Text>
          </div>
          <Group align="flex-end" gap="sm" wrap="wrap">
            <DatePickerInput
              type="range"
              label="Date range"
              placeholder="Select range"
              value={dateRange}
              onChange={setDateRange}
              valueFormat="YYYY-MM-DD"
              w={240}
              clearable
              {...COMMON_DATE_INPUT_PROPS}
            />
            <Select
              label="View"
              data={VIEW_OPTIONS}
              value={view}
              onChange={(value) =>
                setView((value as BreakdownView) || 'weekly')
              }
              w={180}
            />
            <SegmentedControl
              data={[
                { label: 'Stacked', value: 'stacked' },
                { label: 'Grouped', value: 'grouped' },
              ]}
              value={mode}
              onChange={(value) => setMode(value as ChartMode)}
            />
            <Switch
              label="Compare previous"
              checked={comparePrev}
              onChange={(event) => setComparePrev(event.currentTarget.checked)}
            />
          </Group>
        </Group>
      </Card>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            Revenue
          </Text>
          <Text fw={600}>{formatCurrency(totals.revenue)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            COGS
          </Text>
          <Text fw={600}>{formatCurrency(totals.cogs)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            Expenses
          </Text>
          <Text fw={600}>{formatCurrency(totals.expenses)}</Text>
        </Card>
        <Card withBorder padding="md">
          <Text size="xs" c="dimmed">
            Net Profit
          </Text>
          <Text fw={600}>{formatCurrency(totals.netProfit)}</Text>
        </Card>
      </SimpleGrid>

      <Card withBorder padding="lg">
        {combinedChartData.length === 0 ? (
          <Text size="sm" c="dimmed">
            No breakdown data available for the selected period.
          </Text>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <ComposedChart
              data={combinedChartData}
              margin={{ top: 10, right: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(value: number) =>
                  `₱${(value / 1000).toFixed(0)}k`
                }
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name,
                ]}
              />
              <Legend />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="#228be6"
                stackId={mode === 'stacked' ? 'pl' : undefined}
                onClick={(data) =>
                  setSelectedBucketKey(
                    (data?.payload as BreakdownRow | undefined)?.key ?? null
                  )
                }
              />
              <Bar
                dataKey="cogs"
                name="COGS"
                fill="#fa5252"
                stackId={mode === 'stacked' ? 'pl' : undefined}
                onClick={(data) =>
                  setSelectedBucketKey(
                    (data?.payload as BreakdownRow | undefined)?.key ?? null
                  )
                }
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="#fab005"
                stackId={mode === 'stacked' ? 'pl' : undefined}
                onClick={(data) =>
                  setSelectedBucketKey(
                    (data?.payload as BreakdownRow | undefined)?.key ?? null
                  )
                }
              />
              <Line
                type="monotone"
                dataKey="netProfit"
                name="Net Profit"
                stroke="#40c057"
                strokeWidth={2}
                dot={false}
              />
              {comparePrev && (
                <Line
                  type="monotone"
                  dataKey="prevNetProfit"
                  name="Prev Net Profit"
                  stroke="#4dabf7"
                  strokeDasharray="6 4"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card withBorder padding="lg">
        <Group justify="space-between" align="center" mb="md" wrap="wrap">
          <Title order={5}>Breakdown by Category</Title>
          <Text size="sm" c="dimmed">
            {resolvedSelectedKey
              ? `Bucket: ${resolvedSelectedKey}`
              : 'Select a bar to drill down'}
          </Text>
        </Group>
        {selectedBucketSummary.length === 0 ? (
          <Text size="sm" c="dimmed">
            No rows available for the selected bucket.
          </Text>
        ) : (
          <Table withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Type</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Amount</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {selectedBucketSummary.map((row) => (
                <Table.Tr key={`${row.type}-${row.category}`}>
                  <Table.Td>{row.type}</Table.Td>
                  <Table.Td>{row.category}</Table.Td>
                  <Table.Td ta="right">{formatCurrency(row.amount)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
