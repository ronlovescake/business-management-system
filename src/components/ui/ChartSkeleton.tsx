import { Skeleton, Stack, Group, Box } from '@mantine/core';

/**
 * ChartSkeleton Component
 *
 * A reusable skeleton loader for chart/graph components that provides visual feedback
 * during data fetching or chart rendering.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings (bar chart)
 * {isLoading && <ChartSkeleton />}
 *
 * // Line chart
 * {isLoading && <ChartSkeleton type="line" />}
 *
 * // Pie chart
 * {isLoading && <ChartSkeleton type="pie" />}
 *
 * // Custom configuration
 * {isLoading && (
 *   <ChartSkeleton
 *     type="bar"
 *     height={400}
 *     hasLegend
 *     hasTitle
 *   />
 * )}
 * ```
 */

export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'area';

export interface ChartSkeletonProps {
  /**
   * Type of chart to simulate
   * @default 'bar'
   */
  type?: ChartType;

  /**
   * Height of the chart in pixels
   * @default 300
   */
  height?: number;

  /**
   * Show title above chart
   * @default false
   */
  hasTitle?: boolean;

  /**
   * Show legend
   * @default false
   */
  hasLegend?: boolean;

  /**
   * Number of data points/bars to display
   * @default 6
   */
  dataPoints?: number;

  /**
   * Animation speed for skeleton pulse effect
   * @default 'medium'
   */
  animationSpeed?: 'slow' | 'medium' | 'fast';

  /**
   * Custom CSS styles
   */
  style?: React.CSSProperties;

  /**
   * Custom CSS class name
   */
  className?: string;
}

export function ChartSkeleton({
  type = 'bar',
  height = 300,
  hasTitle = false,
  hasLegend = false,
  dataPoints = 6,
  animationSpeed = 'medium',
  style,
  className,
}: ChartSkeletonProps) {
  // Calculate animation duration based on speed
  const getAnimationDuration = () => {
    switch (animationSpeed) {
      case 'slow':
        return 2000;
      case 'fast':
        return 800;
      case 'medium':
      default:
        return 1400;
    }
  };

  const renderBarChart = () => (
    <Group
      gap="xs"
      align="flex-end"
      style={{ height: height - 60, padding: '0 20px' }}
    >
      {Array.from({ length: dataPoints }, (_, i) => {
        // Random heights for more realistic skeleton
        const heightPercent = 40 + Math.random() * 60;
        return (
          <Skeleton
            key={`bar-${i}`}
            height={`${heightPercent}%`}
            style={
              {
                flex: 1,
                animationDuration: `${getAnimationDuration()}ms`,
                animationDelay: `${i * 80}ms`,
              } as React.CSSProperties
            }
            animate
          />
        );
      })}
    </Group>
  );

  const renderLineChart = () => (
    <Box style={{ height: height - 60, padding: '20px', position: 'relative' }}>
      {/* Y-axis */}
      <Stack
        gap="md"
        justify="space-between"
        style={{ height: '100%', width: 40 }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton
            key={`y-${i}`}
            height={12}
            width={30}
            radius="sm"
            animate
            style={
              {
                animationDuration: `${getAnimationDuration()}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </Stack>

      {/* Chart area */}
      <Box
        style={{
          position: 'absolute',
          top: 20,
          left: 60,
          right: 20,
          bottom: 40,
        }}
      >
        <Skeleton
          height="100%"
          width="100%"
          animate
          style={
            {
              animationDuration: `${getAnimationDuration()}ms`,
              animationDelay: '100ms',
            } as React.CSSProperties
          }
        />
      </Box>

      {/* X-axis labels */}
      <Group
        gap="md"
        justify="space-between"
        style={{ position: 'absolute', bottom: 10, left: 60, right: 20 }}
      >
        {Array.from({ length: dataPoints }, (_, i) => (
          <Skeleton
            key={`x-${i}`}
            height={12}
            width={40}
            radius="sm"
            animate
            style={
              {
                animationDuration: `${getAnimationDuration()}ms`,
                animationDelay: `${i * 50}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </Group>
    </Box>
  );

  const renderPieChart = () => (
    <Group
      justify="center"
      align="center"
      style={{ height: height - 60, padding: 20 }}
    >
      <Skeleton
        height={Math.min(height - 80, 250)}
        width={Math.min(height - 80, 250)}
        circle
        animate
        style={
          {
            animationDuration: `${getAnimationDuration()}ms`,
          } as React.CSSProperties
        }
      />
    </Group>
  );

  const renderDonutChart = () => (
    <Group
      justify="center"
      align="center"
      style={{ height: height - 60, padding: 20, position: 'relative' }}
    >
      <Skeleton
        height={Math.min(height - 80, 250)}
        width={Math.min(height - 80, 250)}
        circle
        animate
        style={
          {
            animationDuration: `${getAnimationDuration()}ms`,
          } as React.CSSProperties
        }
      />
      {/* Inner circle for donut effect */}
      <Box
        style={{
          position: 'absolute',
          height: Math.min(height - 80, 250) * 0.5,
          width: Math.min(height - 80, 250) * 0.5,
          borderRadius: '50%',
          backgroundColor: 'var(--mantine-color-white)',
        }}
      />
    </Group>
  );

  const renderChart = () => {
    switch (type) {
      case 'line':
      case 'area':
        return renderLineChart();
      case 'pie':
        return renderPieChart();
      case 'donut':
        return renderDonutChart();
      case 'bar':
      default:
        return renderBarChart();
    }
  };

  return (
    <Box
      style={{
        width: '100%',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: 'var(--mantine-color-white)',
        ...style,
      }}
      className={className}
    >
      <Stack gap="md" style={{ padding: 16 }}>
        {/* Title */}
        {hasTitle && (
          <Skeleton
            height={20}
            width="40%"
            radius="sm"
            animate
            style={
              {
                animationDuration: `${getAnimationDuration()}ms`,
              } as React.CSSProperties
            }
          />
        )}

        {/* Chart */}
        <Box style={{ height }}>{renderChart()}</Box>

        {/* Legend */}
        {hasLegend && (
          <Group gap="md" justify="center">
            {Array.from({ length: Math.min(dataPoints, 4) }, (_, i) => (
              <Group key={`legend-${i}`} gap="xs">
                <Skeleton
                  height={12}
                  width={12}
                  radius="sm"
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${i * 50}ms`,
                    } as React.CSSProperties
                  }
                />
                <Skeleton
                  height={14}
                  width={60}
                  radius="sm"
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${i * 50 + 25}ms`,
                    } as React.CSSProperties
                  }
                />
              </Group>
            ))}
          </Group>
        )}
      </Stack>
    </Box>
  );
}

/**
 * CompactChartSkeleton Component
 *
 * A more compact version of ChartSkeleton with reduced height,
 * ideal for dashboard cards or smaller viewports.
 */
export function CompactChartSkeleton(
  props: Omit<ChartSkeletonProps, 'height'>
) {
  return <ChartSkeleton {...props} height={200} />;
}
