'use client';

import { memo, useId } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartTooltip } from './ChartTooltip';
import {
  CHART_MARGIN,
  CHART_PALETTE,
  chartAxisProps,
  chartGridProps,
  formatCompactPeso,
} from './chartTheme';

export interface TrendAreaSeries {
  dataKey: string;
  name: string;
  color: string;
  strokeWidth?: number;
}

interface TrendAreaChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: TrendAreaSeries[];
  height?: number;
  valueFormatter?: (value: number, dataKey: string) => string;
  axisFormatter?: (value: number) => string;
}

function TrendAreaChartInner<T extends object>({
  data,
  xKey,
  series,
  height = 300,
  valueFormatter,
  axisFormatter = formatCompactPeso,
}: TrendAreaChartProps<T>) {
  // Gradient ids must be unique per chart instance to avoid clashing defs.
  const gradientPrefix = useId().replace(/:/g, '');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={CHART_MARGIN}>
        <defs>
          {series.map((entry) => (
            <linearGradient
              key={entry.dataKey}
              id={`${gradientPrefix}-${entry.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={entry.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={entry.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...chartGridProps} />
        <XAxis dataKey={xKey} {...chartAxisProps} />
        <YAxis {...chartAxisProps} width={56} tickFormatter={axisFormatter} />
        <ReferenceLine y={0} stroke={CHART_PALETTE.grid} />
        <Tooltip
          cursor={{ stroke: CHART_PALETTE.soft, strokeWidth: 2 }}
          content={<ChartTooltip valueFormatter={valueFormatter} />}
        />
        {series.map((entry) => (
          <Area
            key={entry.dataKey}
            type="monotone"
            dataKey={entry.dataKey}
            name={entry.name}
            stroke={entry.color}
            strokeWidth={entry.strokeWidth ?? 2}
            fill={`url(#${gradientPrefix}-${entry.dataKey})`}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const TrendAreaChart = memo(
  TrendAreaChartInner
) as typeof TrendAreaChartInner;
