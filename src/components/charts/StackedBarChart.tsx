'use client';

import { memo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { CHART_MARGIN, chartAxisProps, chartGridProps } from './chartTheme';

export interface StackedBarSeries {
  dataKey: string;
  name: string;
  color: string;
}

interface StackedBarChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: StackedBarSeries[];
  height?: number;
  valueFormatter?: (value: number, dataKey: string) => string;
  axisFormatter?: (value: number) => string;
  allowDecimals?: boolean;
}

function StackedBarChartInner<T extends object>({
  data,
  xKey,
  series,
  height = 300,
  valueFormatter,
  axisFormatter,
  allowDecimals = false,
}: StackedBarChartProps<T>) {
  const lastKey = series[series.length - 1]?.dataKey;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey={xKey} {...chartAxisProps} minTickGap={8} />
        <YAxis
          {...chartAxisProps}
          width={44}
          allowDecimals={allowDecimals}
          tickFormatter={axisFormatter}
        />
        <Tooltip
          cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        {series.map((entry) => (
          <Bar
            key={entry.dataKey}
            dataKey={entry.dataKey}
            name={entry.name}
            stackId="stack"
            fill={entry.color}
            maxBarSize={28}
            radius={entry.dataKey === lastKey ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const StackedBarChart = memo(
  StackedBarChartInner
) as typeof StackedBarChartInner;
