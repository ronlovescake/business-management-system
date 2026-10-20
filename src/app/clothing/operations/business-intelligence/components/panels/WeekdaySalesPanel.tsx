import { memo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  formatCompactPeso,
} from '@/components/charts/chartTheme';
import type { WeekdaySales } from '../../types';

interface WeekdaySalesPanelProps {
  days: WeekdaySales[];
  formatCurrency: (value: number) => string;
}

export const WeekdaySalesPanel = memo(function WeekdaySalesPanel({
  days,
  formatCurrency,
}: WeekdaySalesPanelProps) {
  const best = days.reduce<WeekdaySales | null>(
    (top, day) => (day.revenue > (top?.revenue ?? 0) ? day : top),
    null
  );

  return (
    <ChartCard
      title="Sales by day of week"
      subtitle={best ? `Busiest day: ${best.day}` : 'No sales in this period'}
    >
      <ResponsiveContainer width="100%" height={288}>
        <BarChart data={days} margin={CHART_MARGIN}>
          <CartesianGrid {...chartGridProps} />
          <XAxis dataKey="day" {...chartAxisProps} />
          <YAxis
            {...chartAxisProps}
            width={56}
            tickFormatter={formatCompactPeso}
          />
          <Tooltip
            cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
            content={
              <ChartTooltip
                valueFormatter={(value) => formatCurrency(value)}
                extraRows={(datum) => [
                  { label: 'Orders', value: String(datum.orders ?? 0) },
                ]}
              />
            }
          />
          <Bar
            dataKey="revenue"
            name="Revenue"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
          >
            {days.map((day) => (
              <Cell
                key={day.day}
                fill={
                  best && day.day === best.day
                    ? CHART_PALETTE.primary
                    : CHART_PALETTE.tertiary
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
});
