import { memo } from 'react';
import { Badge, Group } from '@mantine/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartCard } from '@/components/charts/ChartCard';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHART_MARGIN,
  CHART_PALETTE,
  chartAxisProps,
  chartGridProps,
} from '@/components/charts/chartTheme';
import type { CustomerMixMonth } from '../../types';

interface CustomerMixPanelProps {
  months: CustomerMixMonth[];
  repeatRate: number | null;
}

export const CustomerMixPanel = memo(function CustomerMixPanel({
  months,
  repeatRate,
}: CustomerMixPanelProps) {
  return (
    <ChartCard
      title="New vs returning customers"
      subtitle="Buyers per month"
      actions={
        repeatRate !== null ? (
          <Badge variant="light" color="indigo" radius="sm">
            {`${repeatRate.toFixed(0)}% repeat`}
          </Badge>
        ) : null
      }
    >
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={months} margin={CHART_MARGIN}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="month" {...chartAxisProps} />
          <YAxis {...chartAxisProps} width={32} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
            content={<ChartTooltip />}
          />
          <Bar
            dataKey="newCustomers"
            name="New"
            stackId="mix"
            fill={CHART_PALETTE.primary}
            maxBarSize={22}
          />
          <Bar
            dataKey="returningCustomers"
            name="Returning"
            stackId="mix"
            fill={CHART_PALETTE.tertiary}
            radius={[4, 4, 0, 0]}
            maxBarSize={22}
          />
        </BarChart>
      </ResponsiveContainer>
      <Group gap="md" mt="xs" justify="center">
        <Badge
          variant="dot"
          color="indigo.6"
          size="sm"
          styles={{ root: { textTransform: 'none', border: 'none' } }}
        >
          New
        </Badge>
        <Badge
          variant="dot"
          color="indigo.2"
          size="sm"
          styles={{ root: { textTransform: 'none', border: 'none' } }}
        >
          Returning
        </Badge>
      </Group>
    </ChartCard>
  );
});
