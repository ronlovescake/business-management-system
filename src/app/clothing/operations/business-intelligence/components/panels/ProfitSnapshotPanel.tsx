import { memo } from 'react';
import { Badge, Center, Group, Loader, SimpleGrid, Text } from '@mantine/core';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHART_PALETTE,
  chartAxisProps,
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import type { ProfitSnapshot } from '../../types';

interface ProfitSnapshotPanelProps {
  data: ProfitSnapshot | undefined;
  isLoading: boolean;
  isError: boolean;
  formatCurrency: (value: number) => string;
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative';
}) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text
        fw={600}
        c={
          tone === 'negative'
            ? 'red.7'
            : tone === 'positive'
              ? 'teal.7'
              : 'dark.7'
        }
      >
        {value}
      </Text>
    </div>
  );
}

export const ProfitSnapshotPanel = memo(function ProfitSnapshotPanel({
  data,
  isLoading,
  isError,
  formatCurrency,
}: ProfitSnapshotPanelProps) {
  const margin =
    data && data.revenueTotal !== 0
      ? (data.grossProfit / data.revenueTotal) * 100
      : null;

  return (
    <ChartCard
      title="Profit snapshot"
      subtitle="From accounting, selected period"
      actions={
        margin !== null ? (
          <Badge variant="light" color="indigo" radius="sm">
            {`${margin.toFixed(1)}% gross margin`}
          </Badge>
        ) : null
      }
    >
      {isLoading ? (
        <Center h={280}>
          <Loader size="sm" />
        </Center>
      ) : isError || !data ? (
        <Center h={280}>
          <Text size="sm" c="dimmed">
            Profit data is unavailable right now
          </Text>
        </Center>
      ) : (
        <>
          <SimpleGrid cols={2} spacing="md" verticalSpacing="sm" mb="md">
            <Figure label="Revenue" value={formatCurrency(data.revenueTotal)} />
            <Figure
              label="Gross profit"
              value={formatCurrency(data.grossProfit)}
              tone={data.grossProfit < 0 ? 'negative' : undefined}
            />
            <Figure
              label="Expenses"
              value={formatCurrency(data.expenseTotal)}
            />
            <Figure
              label="Net profit"
              value={formatCurrency(data.netProfit)}
              tone={data.netProfit < 0 ? 'negative' : 'positive'}
            />
          </SimpleGrid>
          <ResponsiveContainer width="100%" height={170}>
            <BarChart
              layout="vertical"
              data={[
                { name: 'Revenue', value: data.revenueTotal },
                { name: 'COGS', value: data.cogsTotal },
                { name: 'Expenses', value: data.expenseTotal },
                { name: 'Net profit', value: data.netProfit },
              ]}
              margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                {...chartAxisProps}
                tickFormatter={formatCompactPeso}
              />
              <YAxis
                type="category"
                dataKey="name"
                {...chartAxisProps}
                width={76}
              />
              <Tooltip
                cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
                content={
                  <ChartTooltip
                    valueFormatter={(value) => formatCurrency(value)}
                  />
                }
              />
              <Bar
                dataKey="value"
                name="Amount"
                radius={[0, 6, 6, 0]}
                barSize={14}
              >
                {['primary', 'secondary', 'tertiary', 'net'].map((key) => (
                  <Cell
                    key={key}
                    fill={
                      key === 'net'
                        ? data.netProfit < 0
                          ? 'var(--mantine-color-red-4)'
                          : 'var(--mantine-color-teal-5)'
                        : CHART_PALETTE[
                            key as 'primary' | 'secondary' | 'tertiary'
                          ]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <Group justify="flex-end">
            <Text size="xs" c="dimmed">
              COGS {formatCurrency(data.cogsTotal)}
            </Text>
          </Group>
        </>
      )}
    </ChartCard>
  );
});
