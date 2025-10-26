import { Skeleton, Stack, Group, Box } from '@mantine/core';

/**
 * ListSkeleton Component
 *
 * A reusable skeleton loader for list views that provides visual feedback
 * during data fetching.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings (5 items)
 * {isLoading && <ListSkeleton />}
 *
 * // Custom configuration
 * {isLoading && (
 *   <ListSkeleton
 *     items={10}
 *     hasAvatar
 *     hasSecondaryText
 *   />
 * )}
 * ```
 */

export interface ListSkeletonProps {
  /**
   * Number of list items to display
   * @default 5
   */
  items?: number;

  /**
   * Show avatar/icon on the left
   * @default false
   */
  hasAvatar?: boolean;

  /**
   * Show secondary text below primary text
   * @default false
   */
  hasSecondaryText?: boolean;

  /**
   * Show action icons on the right
   * @default false
   */
  hasActions?: boolean;

  /**
   * Number of action icons
   * @default 2
   */
  actionCount?: number;

  /**
   * Show dividers between items
   * @default true
   */
  showDividers?: boolean;

  /**
   * Animation speed for skeleton pulse effect
   * @default 'medium'
   */
  animationSpeed?: 'slow' | 'medium' | 'fast';

  /**
   * Spacing between items
   * @default 'md'
   */
  spacing?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  /**
   * Custom CSS styles
   */
  style?: React.CSSProperties;

  /**
   * Custom CSS class name
   */
  className?: string;
}

export function ListSkeleton({
  items = 5,
  hasAvatar = false,
  hasSecondaryText = false,
  hasActions = false,
  actionCount = 2,
  showDividers = true,
  animationSpeed = 'medium',
  spacing: _spacing = 'md',
  style,
  className,
}: ListSkeletonProps) {
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
      <Stack gap={0}>
        {Array.from({ length: items }, (_, index) => (
          <Box key={`list-item-${index}`}>
            <Group
              gap="md"
              wrap="nowrap"
              style={{
                padding: '12px 16px',
              }}
            >
              {/* Avatar */}
              {hasAvatar && (
                <Skeleton
                  height={40}
                  width={40}
                  circle
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${index * 50}ms`,
                    } as React.CSSProperties
                  }
                />
              )}

              {/* Content */}
              <Stack gap="xs" style={{ flex: 1 }}>
                {/* Primary Text */}
                <Skeleton
                  height={16}
                  width="70%"
                  radius="sm"
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${index * 50 + 20}ms`,
                    } as React.CSSProperties
                  }
                />

                {/* Secondary Text */}
                {hasSecondaryText && (
                  <Skeleton
                    height={14}
                    width="50%"
                    radius="sm"
                    animate
                    style={
                      {
                        animationDuration: `${getAnimationDuration()}ms`,
                        animationDelay: `${index * 50 + 40}ms`,
                      } as React.CSSProperties
                    }
                  />
                )}
              </Stack>

              {/* Actions */}
              {hasActions && (
                <Group gap="xs">
                  {Array.from({ length: actionCount }, (_, i) => (
                    <Skeleton
                      key={`action-${i}`}
                      height={32}
                      width={32}
                      circle
                      animate
                      style={
                        {
                          animationDuration: `${getAnimationDuration()}ms`,
                          animationDelay: `${index * 50 + 60 + i * 20}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </Group>
              )}
            </Group>

            {/* Divider */}
            {showDividers && index < items - 1 && (
              <Box
                style={{
                  height: 1,
                  backgroundColor: 'var(--mantine-color-gray-2)',
                }}
              />
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

/**
 * CompactListSkeleton Component
 *
 * A more compact version of ListSkeleton with tighter spacing,
 * ideal for dense list views or smaller viewports.
 */
export function CompactListSkeleton(props: Omit<ListSkeletonProps, 'spacing'>) {
  return <ListSkeleton {...props} spacing="sm" />;
}

/**
 * InlineListSkeleton Component
 *
 * A borderless version of ListSkeleton for inline lists,
 * ideal for embedding within other components.
 */
export function InlineListSkeleton(props: ListSkeletonProps) {
  return (
    <ListSkeleton
      {...props}
      style={{
        ...props.style,
        border: 'none',
        borderRadius: 0,
      }}
    />
  );
}
