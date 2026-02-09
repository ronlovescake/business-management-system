import { forwardRef } from 'react';
import { Button, Group, Stack, Text } from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';

import { PolishedFormStylesProvider } from './PolishedFormContext';
import './polishedFormTemplate.css';

type TextProps = React.ComponentProps<typeof Text>;

const PlainScrollArea = forwardRef<HTMLDivElement, React.ComponentProps<'div'>>(
  ({ children, ...rest }, ref) => (
    <div ref={ref} {...rest}>
      {children}
    </div>
  )
);

PlainScrollArea.displayName = 'PlainScrollArea';

const renderTextContent = (content: React.ReactNode, textProps: TextProps) => {
  if (content === null || content === undefined) {
    return null;
  }

  if (typeof content === 'string' || typeof content === 'number') {
    return <Text {...textProps}>{content}</Text>;
  }

  return content;
};

interface PolishedFormAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

type PolishedFieldHelpers = ReturnType<typeof usePolishedFieldStyles>;
type PolishedFormChildren =
  | React.ReactNode
  | ((helpers: PolishedFieldHelpers) => React.ReactNode);

interface PolishedFormTemplateProps
  extends Omit<
    React.ComponentProps<typeof UniversalModal>,
    'title' | 'children'
  > {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children: PolishedFormChildren;
  primaryAction: PolishedFormAction;
  secondaryAction?: PolishedFormAction;
  maxBodyHeight?: number | string;
  bodyClassName?: string;
}

/**
 * Renders a polished Mantine modal with the exact styling of the Trucking Add
 * Employee form so other teams can drop in the same look & feel without
 * rewiring every field. Consumers still render their own form content but get a
 * consistent header, scroll container, and footer action bar.
 */
export function PolishedFormTemplate({
  opened,
  onClose,
  title,
  subtitle,
  description,
  icon,
  children,
  primaryAction,
  secondaryAction,
  maxBodyHeight = '82vh',
  bodyClassName,
  ...modalProps
}: PolishedFormTemplateProps) {
  const fieldStyles = usePolishedFieldStyles(Boolean(opened));
  const scrollBodyClassName = ['polished-form-scroll', bodyClassName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const renderedChildren =
    typeof children === 'function'
      ? (children as (helpers: PolishedFieldHelpers) => React.ReactNode)(
          fieldStyles
        )
      : children;

  const headerContent = (
    <Stack
      gap="xs"
      align="center"
      style={{ textAlign: 'center', width: '100%' }}
    >
      {icon}
      {renderTextContent(title, {
        fw: 700,
        fz: '1.5rem',
        c: '#101828',
        ta: 'center',
      })}
      {renderTextContent(subtitle, { fz: 'sm', c: '#667085', ta: 'center' })}
      {renderTextContent(description, {
        fz: 'sm',
        c: '#98a2b3',
        ta: 'center',
      })}
    </Stack>
  );

  return (
    <PolishedFormStylesProvider value={fieldStyles}>
      <UniversalModal
        opened={opened}
        onClose={onClose}
        title={headerContent}
        scrollAreaComponent={PlainScrollArea}
        size={modalProps.size ?? 1750}
        radius={modalProps.radius ?? 8}
        {...modalProps}
      >
        <Stack gap="lg">
          <div
            className={scrollBodyClassName || undefined}
            style={{
              maxHeight: maxBodyHeight,
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
            }}
          >
            {renderedChildren}
          </div>
          <Group justify="flex-end" gap="sm">
            {secondaryAction && !secondaryAction.hidden ? (
              <Button
                radius={6}
                variant="default"
                onClick={secondaryAction.onClick}
                disabled={secondaryAction.disabled}
                loading={secondaryAction.loading}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            {!primaryAction.hidden ? (
              <Button
                radius={6}
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </Group>
        </Stack>
      </UniversalModal>
    </PolishedFormStylesProvider>
  );
}
