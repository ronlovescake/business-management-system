import { Skeleton, Stack, Group, Box } from '@mantine/core';

/**
 * FormSkeleton Component
 *
 * A reusable skeleton loader for forms that provides visual feedback
 * during data fetching or form initialization.
 *
 * @example
 * ```tsx
 * // Basic usage with default settings (5 fields)
 * {isLoading && <FormSkeleton />}
 *
 * // Custom configuration with mixed field types
 * {isLoading && (
 *   <FormSkeleton
 *     fields={[
 *       { type: 'text', label: true },
 *       { type: 'select', label: true },
 *       { type: 'textarea', label: true, rows: 3 },
 *       { type: 'checkbox', label: true },
 *       { type: 'group', items: 2 },
 *     ]}
 *   />
 * )}
 * ```
 */

export type FormFieldType =
  | 'text'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'group';

export interface FormFieldConfig {
  /**
   * Type of form field
   */
  type: FormFieldType;

  /**
   * Show label above field
   * @default true
   */
  label?: boolean;

  /**
   * Number of rows for textarea
   * @default 3
   */
  rows?: number;

  /**
   * Number of items in a group (for type='group')
   * @default 2
   */
  items?: number;

  /**
   * Width of the field (percentage)
   * @default 100
   */
  width?: number;
}

export interface FormSkeletonProps {
  /**
   * Configuration for form fields. If not provided, uses default configuration.
   */
  fields?: FormFieldConfig[];

  /**
   * Number of default text fields to display
   * @default 5
   */
  fieldCount?: number;

  /**
   * Show submit button at the bottom
   * @default true
   */
  showButton?: boolean;

  /**
   * Animation speed for skeleton pulse effect
   * @default 'medium'
   */
  animationSpeed?: 'slow' | 'medium' | 'fast';

  /**
   * Spacing between fields
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

export function FormSkeleton({
  fields,
  fieldCount = 5,
  showButton = true,
  animationSpeed = 'medium',
  spacing = 'md',
  style,
  className,
}: FormSkeletonProps) {
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

  // Default field configuration if not provided
  const defaultFields: FormFieldConfig[] = Array.from(
    { length: fieldCount },
    () => ({
      type: 'text',
      label: true,
    })
  );

  const formFields = fields || defaultFields;

  const renderField = (field: FormFieldConfig, index: number) => {
    const fieldWidth = field.width ? `${field.width}%` : '100%';

    switch (field.type) {
      case 'text':
      case 'select':
      case 'date':
        return (
          <Box key={`field-${index}`} style={{ width: fieldWidth }}>
            {field.label !== false && (
              <Skeleton
                height={16}
                width="30%"
                radius="sm"
                mb={8}
                animate
                style={
                  {
                    animationDuration: `${getAnimationDuration()}ms`,
                  } as React.CSSProperties
                }
              />
            )}
            <Skeleton
              height={36}
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                  animationDelay: `${index * 50}ms`,
                } as React.CSSProperties
              }
            />
          </Box>
        );

      case 'textarea':
        const rows = field.rows || 3;
        return (
          <Box key={`field-${index}`} style={{ width: fieldWidth }}>
            {field.label !== false && (
              <Skeleton
                height={16}
                width="30%"
                radius="sm"
                mb={8}
                animate
                style={
                  {
                    animationDuration: `${getAnimationDuration()}ms`,
                  } as React.CSSProperties
                }
              />
            )}
            <Skeleton
              height={36 * rows}
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                  animationDelay: `${index * 50}ms`,
                } as React.CSSProperties
              }
            />
          </Box>
        );

      case 'checkbox':
      case 'radio':
        return (
          <Group
            key={`field-${index}`}
            gap="sm"
            align="center"
            style={{ width: fieldWidth }}
          >
            <Skeleton
              height={20}
              width={20}
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                  animationDelay: `${index * 50}ms`,
                } as React.CSSProperties
              }
            />
            {field.label !== false && (
              <Skeleton
                height={16}
                width="40%"
                radius="sm"
                animate
                style={
                  {
                    animationDuration: `${getAnimationDuration()}ms`,
                    animationDelay: `${index * 50}ms`,
                  } as React.CSSProperties
                }
              />
            )}
          </Group>
        );

      case 'group':
        const items = field.items || 2;
        return (
          <Group
            key={`field-${index}`}
            gap="md"
            align="flex-start"
            style={{ width: fieldWidth }}
          >
            {Array.from({ length: items }, (_, i) => (
              <Box key={`group-item-${i}`} style={{ flex: 1 }}>
                <Skeleton
                  height={16}
                  width="50%"
                  radius="sm"
                  mb={8}
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                    } as React.CSSProperties
                  }
                />
                <Skeleton
                  height={36}
                  radius="sm"
                  animate
                  style={
                    {
                      animationDuration: `${getAnimationDuration()}ms`,
                      animationDelay: `${index * 50 + i * 30}ms`,
                    } as React.CSSProperties
                  }
                />
              </Box>
            ))}
          </Group>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      style={{
        width: '100%',
        padding: '20px',
        backgroundColor: 'var(--mantine-color-white)',
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
        ...style,
      }}
      className={className}
    >
      <Stack gap={spacing}>
        {formFields.map((field, index) => renderField(field, index))}

        {showButton && (
          <Group justify="flex-end" mt="md">
            <Skeleton
              height={36}
              width={120}
              radius="sm"
              animate
              style={
                {
                  animationDuration: `${getAnimationDuration()}ms`,
                } as React.CSSProperties
              }
            />
          </Group>
        )}
      </Stack>
    </Box>
  );
}

/**
 * CompactFormSkeleton Component
 *
 * A more compact version of FormSkeleton with tighter spacing,
 * ideal for smaller forms or modal dialogs.
 */
export function CompactFormSkeleton(props: Omit<FormSkeletonProps, 'spacing'>) {
  return <FormSkeleton {...props} spacing="sm" />;
}

/**
 * InlineFormSkeleton Component
 *
 * A borderless version of FormSkeleton for inline forms,
 * ideal for embedding within other components.
 */
export function InlineFormSkeleton(props: FormSkeletonProps) {
  return (
    <FormSkeleton
      {...props}
      style={{
        ...props.style,
        border: 'none',
        padding: 0,
      }}
    />
  );
}
