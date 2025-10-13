/**
 * DialogHeader Component
 *
 * Reusable header component for dialogs with optional icon,
 * subtitle, and close button.
 */

import { Group, Text, Stack, CloseButton } from '@mantine/core';
import { DialogHeaderProps } from './Dialog.types';

export function DialogHeader({
  title,
  subtitle,
  withCloseButton = true,
  onClose,
  icon,
  iconColor,
  className,
}: DialogHeaderProps) {
  return (
    <Group justify="space-between" align="flex-start" className={className}>
      <Group gap="sm" align="flex-start" style={{ flex: 1 }}>
        {icon && <div style={{ color: iconColor, paddingTop: 2 }}>{icon}</div>}
        <Stack gap={4} style={{ flex: 1 }}>
          <Text size="lg" fw={600} c="#495057">
            {title}
          </Text>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>
      {withCloseButton && onClose && (
        <CloseButton onClick={onClose} size="md" iconSize={20} />
      )}
    </Group>
  );
}
