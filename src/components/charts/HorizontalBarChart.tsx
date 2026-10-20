'use client';

import { memo } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import { CHART_PALETTE, chartAxisProps, formatCompactPeso } from './chartTheme';

export interface HorizontalBarDatum {
  name: string;
  value: number;
  color?: string;
}

interface HorizontalBarChartProps {
  data: HorizontalBarDatum[];
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  height?: number;
  labelWidth?: number;
  seriesName?: string;
}

export const HorizontalBarChart = memo(function HorizontalBarChart({
  data,
  valueFormatter,
  axisFormatter = formatCompactPeso,
  height = 170,
  labelWidth = 84,
  seriesName = 'Amount',
}: HorizontalBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          {...chartAxisProps}
          tickFormatter={axisFormatter}
        />
        <YAxis
          type="category"
          dataKey="name"
          {...chartAxisProps}
          width={labelWidth}
        />
        <Tooltip
          cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
          content={
            <ChartTooltip valueFormatter={(value) => valueFormatter(value)} />
          }
        />
        <Bar
          dataKey="value"
          name={seriesName}
          radius={[0, 6, 6, 0]}
          barSize={14}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.color ?? CHART_PALETTE.primary}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});
