'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HouseholdBudgetComparison } from '@/modules/household/dashboard/api';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import {
  CHART_PALETTE,
  CHART_SERIES_COLORS,
  chartAxisProps,
  chartGridProps,
  formatCompactPeso,
} from '@/components/charts/chartTheme';

export function PersonalBudgetComparisonChart({
  data,
}: {
  data: HouseholdBudgetComparison[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
        barGap={4}
      >
        <CartesianGrid {...chartGridProps} />
        <XAxis
          dataKey="category"
          {...chartAxisProps}
          interval={0}
          angle={-15}
          textAnchor="end"
          height={54}
        />
        <YAxis
          {...chartAxisProps}
          width={56}
          tickFormatter={formatCompactPeso}
        />
        <Tooltip
          cursor={{ fill: CHART_PALETTE.soft, fillOpacity: 0.35 }}
          content={<ChartTooltip valueFormatter={formatCompactPeso} />}
        />
        <Legend />
        <Bar
          dataKey="planned"
          name="Planned average"
          fill={CHART_SERIES_COLORS[1]}
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
        <Bar
          dataKey="actual"
          name="This month"
          fill="#20c997"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
