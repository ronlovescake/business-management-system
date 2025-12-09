import { Button, Group, Stack, Text } from '@mantine/core';
import { PolishedModal } from '@/components/modals/PolishedModal';
import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { polishedPrimaryButtonStyles } from '@/components/modals/polishedModalTheme';
import { PolishedFormStylesProvider } from './PolishedFormContext';

interface PolishedFormAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  hidden?: boolean;
}

interface PolishedFormTemplateProps
  extends Omit<
    React.ComponentProps<typeof PolishedModal>,
    'title' | 'children'
  > {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
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

  const headerContent = (
    <Group gap="sm" align="center">
      {icon}
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {title}
        </Text>
        {subtitle ? (
          <Text fz="sm" c="#667085">
            {subtitle}
          </Text>
        ) : null}
        {description ? (
          <Text fz="sm" c="#98a2b3">
            {description}
          </Text>
        ) : null}
      </Stack>
    </Group>
  );

  return (
    <PolishedFormStylesProvider value={fieldStyles}>
      <PolishedModal
        opened={opened}
        onClose={onClose}
        title={headerContent}
        size={modalProps.size ?? 1750}
        radius={modalProps.radius ?? 8}
        {...modalProps}
      >
        <Stack gap="lg">
          <div
            className={bodyClassName}
            style={{
              maxHeight: maxBodyHeight,
              overflowY: 'auto',
              overflowX: 'hidden',
              width: '100%',
            }}
          >
            {children}
          </div>
          <Group justify="flex-end" gap="sm">
            {secondaryAction && !secondaryAction.hidden ? (
              <Button
                radius="md"
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
                radius="md"
                onClick={primaryAction.onClick}
                disabled={primaryAction.disabled}
                loading={primaryAction.loading}
                styles={polishedPrimaryButtonStyles}
              >
                {primaryAction.label}
              </Button>
            ) : null}
          </Group>
        </Stack>
      </PolishedModal>
    </PolishedFormStylesProvider>
  );
}
