import { Skeleton, Stack, Group, Box } from '@mantine/core';

/**
 * CardSkeleton Component
 *
 * A reusable skeleton loader for card components that provides visual feedback
 * during data fetching.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings
 * {isLoading && <CardSkeleton />}
 *
 * // Custom configuration
 * {isLoading && (
 *   <CardSkeleton
 *     hasImage
 *     hasActions
 *     lines={4}
 *   />
 * )}
 *
 * // Grid of cards
 * <Grid>
 *   {isLoading ? (
 *     Array.from({ length: 6 }).map((_, i) => (
 *       <Grid.Col key={i} span={{ base: 12, sm: 6, md: 4 }}>
 *         <CardSkeleton hasImage />
 *       </Grid.Col>
 *     ))
 *   ) : (
 *     // Actual cards...
 *   )}
 * </Grid>
 * ```
 */

export interface CardSkeletonProps {
  /**
   * Show image/media section at the top
   * @default false
   */
  hasImage?: boolean;

  /**
   * Height of the image section in pixels
   * @default 160
   */
  imageHeight?: number;

  /**
   * Show title skeleton
   * @default true
   */
  hasTitle?: boolean;

  /**
   * Show subtitle skeleton
   * @default false
   */
  hasSubtitle?: boolean;

  /**
   * Number of content lines to display
   * @default 3
   */
  lines?: number;

  /**
   * Show action buttons at the bottom
   * @default false
   */
  hasActions?: boolean;

  /**
   * Number of action buttons
   * @default 2
   */
  actionCount?: number;

  /**
   * Card padding
   * @default 'md'
   */
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

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

export function CardSkeleton({
  hasImage = false,
  imageHeight = 160,
  hasTitle = true,
  hasSubtitle = false,
  lines = 3,
  hasActions = false,
  actionCount = 2,
  padding = 'md',
  animationSpeed = 'medium',
  style,
  className,
}: CardSkeletonProps) {
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

  // Convert padding to pixels
  const getPadding = () => {
    switch (padding) {
      case 'xs':
        return 8;
      case 'sm':
        return 12;
      case 'lg':
        return 24;
      case 'xl':
        return 32;
      case 'md':
      default:
        return 16;
    }
  };

  const paddingValue = getPadding();

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
      {/* Image Section */}
      {hasImage && (
        <Skeleton
          height={imageHeight}
          animate
          style={
            {
              animationDuration: `${getAnimationDuration()}ms`,
            } as React.CSSProperties
          }
        />
      )}

      {/* Content Section */}
      <Box style={{ padding: paddingValue }}>
        <Stack gap="md">
          {/* Title */}
          {hasTitle && (
            <Skeleton
              height={24}
              width="70%"
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                } as React.CSSProperties
              }
            />
          )}

          {/* Subtitle */}
          {hasSubtitle && (
            <Skeleton
              height={16}
              width="50%"
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                  animationDelay: '50ms',
                } as React.CSSProperties
              }
            />
          )}

          {/* Content Lines */}
          <Stack gap="xs">
            {Array.from({ length: lines }, (_, i) => (
              <Skeleton
                key={`line-${i}`}
                height={14}
                width={i === lines - 1 ? '80%' : '100%'}
                radius="sm"
                animate
                style={
                  {
                    animationDuration: `${getAnimationDuration()}ms`,
                    animationDelay: `${(i + 1) * 50}ms`,
                  } as React.CSSProperties
                }
              />
            ))}
          </Stack>

          {/* Action Buttons */}
          {hasActions && (
            <Group gap="sm" mt="md">
              {Array.from({ length: actionCount }, (_, i) => (
                <Skeleton
                  key={`action-${i}`}
                  height={32}
                  width={100}
                  radius="sm"
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${(lines + i + 1) * 50}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </Group>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

/**
 * CompactCardSkeleton Component
 *
 * A more compact version of CardSkeleton with tighter spacing,
 * ideal for smaller cards or grid layouts.
 */
export function CompactCardSkeleton(props: Omit<CardSkeletonProps, 'padding'>) {
  return <CardSkeleton {...props} padding="sm" />;
}

/**
 * StatCardSkeleton Component
 *
 * A specialized skeleton for statistic/metric cards,
 * with a large number display and small label.
 */
export function StatCardSkeleton({
  animationSpeed = 'medium',
  style,
  className,
}: Pick<CardSkeletonProps, 'animationSpeed' | 'style' | 'className'>) {
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

  return (
    <Box
      style={{
        width: '100%',
        padding: 20,
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
        backgroundColor: 'var(--mantine-color-white)',
        ...style,
      }}
      className={className}
    >
      <Stack gap="sm">
        {/* Label */}
        <Skeleton
          height={14}
          width="60%"
          radius="sm"
          animate
          style={
            {
              animationDuration: `${getAnimationDuration()}ms`,
            } as React.CSSProperties
          }
        />

        {/* Large Value */}
        <Skeleton
          height={36}
          width="80%"
          radius="sm"
          animate
          style={
            {
              animationDuration: `${getAnimationDuration()}ms`,
              animationDelay: '50ms',
            } as React.CSSProperties
          }
        />

        {/* Optional Trend/Change */}
        <Skeleton
          height={12}
          width="40%"
          radius="sm"
          animate
          style={
            {
              animationDuration: `${getAnimationDuration()}ms`,
              animationDelay: '100ms',
            } as React.CSSProperties
          }
        />
      </Stack>
    </Box>
  );
}
