'use client';

import { memo, useId } from 'react';
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
import {
  CHART_MARGIN,
  CHART_PALETTE,
  chartAxisProps,
  chartGridProps,
  formatCompactPeso,
} from './chartTheme';

interface RankedBarChartProps<T extends object> {
  data: T[];
  labelKey: keyof T & string;
  valueKey: keyof T & string;
  seriesName: string;
  valueFormatter: (value: number) => string;
  axisFormatter?: (value: number) => string;
  extraRows?: (
    datum: Record<string, unknown>
  ) => Array<{ label: string; value: string }>;
  height?: number;
  maxLabelLength?: number;
}

function RankedBarChartInner<T extends object>({
  data,
  labelKey,
  valueKey,
  seriesName,
  valueFormatter,
  axisFormatter = formatCompactPeso,
  extraRows,
  height = 300,
  maxLabelLength = 14,
}: RankedBarChartProps<T>) {
  const gradientId = `${useId().replace(/:/g, '')}-ranked`;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={CHART_MARGIN}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_PALETTE.primary} />
            <stop offset="100%" stopColor={CHART_PALETTE.secondary} />
          </linearGradient>
        </defs>
        <CartesianGrid {...chartGridProps} />
        <XAxis
          dataKey={labelKey}
          {...chartAxisProps}
          interval={0}
          tickFormatter={(label: string) =>
            label.length > maxLabelLength
              ? `${label.slice(0, maxLabelLength - 1)}…`
              : label
          }
        />
        <YAxis {...chartAxisProps} width={56} tickFormatter={axisFormatter} />
        <Tooltip
          cursor={{ fill: 'rgba(76, 110, 245, 0.06)' }}
          content={
            <ChartTooltip
              valueFormatter={(value) => valueFormatter(value)}
              extraRows={extraRows}
            />
          }
        />
        <Bar
          dataKey={valueKey}
          name={seriesName}
          fill={`url(#${gradientId})`}
          radius={[6, 6, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export const RankedBarChart = memo(
  RankedBarChartInner
) as typeof RankedBarChartInner;
