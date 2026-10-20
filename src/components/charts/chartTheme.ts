export const CHART_PALETTE = {
  primary: '#4c6ef5',
  secondary: '#91a7ff',
  tertiary: '#bac8ff',
  soft: '#dbe4ff',
  grid: '#eef0f4',
  axisText: '#868e96',
} as const;

// Ordered dark-to-light for categorical series (donut slices, stacked bars).
export const CHART_SERIES_COLORS = [
  '#3b5bdb',
  '#4c6ef5',
  '#748ffc',
  '#91a7ff',
  '#bac8ff',
  '#dbe4ff',
] as const;

export const CHART_MARGIN = { top: 8, right: 8, left: 0, bottom: 0 };

export const chartGridProps = {
  stroke: CHART_PALETTE.grid,
  vertical: false,
} as const;

export const chartAxisProps = {
  axisLine: false,
  tickLine: false,
  tick: { fill: CHART_PALETTE.axisText, fontSize: 12 },
  tickMargin: 8,
} as const;

export function formatCompactPeso(value: number): string {
  return `₱${new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)}`;
}
