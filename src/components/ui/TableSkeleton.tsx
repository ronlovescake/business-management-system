import { Skeleton, Stack, Group, Box } from '@mantine/core';

/**
 * TableSkeleton Component
 *
 * A reusable skeleton loader for data tables that provides visual feedback
 * during data fetching. Compatible with both DataGrid and HandsontableGrid.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings (10 rows, 5 columns)
 * {isLoading && <TableSkeleton />}
 *
 * // Custom configuration
 * {isLoading && (
 *   <TableSkeleton
 *     rows={15}
 *     columns={8}
 *     headerHeight={45}
 *     rowHeight={38}
 *   />
 * )}
 *
 * // With custom styling
 * {isLoading && (
 *   <TableSkeleton
 *     rows={12}
 *     style={{ borderRadius: 8 }}
 *   />
 * )}
 * ```
 */

export interface TableSkeletonProps {
  /**
   * Number of skeleton rows to display
   * @default 10
   */
  rows?: number;

  /**
   * Number of skeleton columns to display
   * @default 5
   */
  columns?: number;

  /**
   * Height of the header row in pixels
   * @default 40
   */
  headerHeight?: number;

  /**
   * Height of each data row in pixels
   * @default 36
   */
  rowHeight?: number;

  /**
   * Show alternating row colors for better readability
   * @default true
   */
  striped?: boolean;

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

export function TableSkeleton({
  rows = 10,
  columns = 5,
  headerHeight = 40,
  rowHeight = 36,
  striped = true,
  animationSpeed = 'medium',
  style,
  className,
}: TableSkeletonProps) {
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

  // Generate unique IDs for skeleton elements (prevents ESLint array-index-key warning)
  const headerIds = Array.from(
    { length: columns },
    (_, i) => `header-${Date.now()}-${i}`
  );
  const rowIds = Array.from(
    { length: rows },
    (_, i) => `row-${Date.now()}-${i}`
  );
  const getCellId = (rowId: string, colIndex: number) =>
    `${rowId}-cell-${colIndex}`;

  return (
    <Box
      style={{
        width: '100%',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: 'var(--mantine-color-white)',
        ...style,
      }}
      className={className}
    >
      {/* Header Row */}
      <Group
        gap="xs"
        wrap="nowrap"
        style={{
          height: headerHeight,
          padding: '0 12px',
          borderBottom: '2px solid var(--mantine-color-gray-3)',
          backgroundColor: 'var(--mantine-color-gray-0)',
        }}
      >
        {headerIds.map((headerId) => (
          <Skeleton
            key={headerId}
            height={20}
            width={`${100 / columns}%`}
            radius="sm"
            animate
            style={
              {
                animationDuration: `${getAnimationDuration()}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      </Group>

      {/* Data Rows */}
      <Stack gap={0}>
        {rowIds.map((rowId, rowIndex) => (
          <Group
            key={rowId}
            gap="xs"
            wrap="nowrap"
            style={{
              height: rowHeight,
              padding: '0 12px',
              borderBottom:
                rowIndex < rows - 1
                  ? '1px solid var(--mantine-color-gray-2)'
                  : 'none',
              backgroundColor:
                striped && rowIndex % 2 === 1
                  ? 'var(--mantine-color-gray-0)'
                  : 'transparent',
            }}
          >
            {headerIds.map((_, colIndex) => (
              <Skeleton
                key={getCellId(rowId, colIndex)}
                height={16}
                width={`${100 / columns}%`}
                radius="sm"
                animate
                style={
                  {
                    animationDuration: `${getAnimationDuration()}ms`,
                    // Stagger animation slightly for visual interest
                    animationDelay: `${(rowIndex * 50 + colIndex * 20) % 500}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </Group>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * CompactTableSkeleton Component
 *
 * A more compact version of TableSkeleton with tighter spacing,
 * ideal for dense data tables or smaller viewports.
 */
export function CompactTableSkeleton(
  props: Omit<TableSkeletonProps, 'headerHeight' | 'rowHeight'>
) {
  return <TableSkeleton {...props} headerHeight={32} rowHeight={28} />;
}

/**
 * LargeTableSkeleton Component
 *
 * A larger version of TableSkeleton with more generous spacing,
 * ideal for less dense data tables or when more breathing room is desired.
 */
export function LargeTableSkeleton(
  props: Omit<TableSkeletonProps, 'headerHeight' | 'rowHeight'>
) {
  return <TableSkeleton {...props} headerHeight={48} rowHeight={44} />;
}
