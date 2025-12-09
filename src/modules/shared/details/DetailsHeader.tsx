import React from 'react';
import { ActionIcon, Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { getIconButtonLabel } from '@/lib/accessibility';

interface DetailsHeaderProps {
  title: string;
  subtitle?: string;
  backAction?: {
    label?: string;
    onClick: () => void;
  };
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  actions?: React.ReactNode;
}

export function DetailsHeader({
  title,
  subtitle,
  backAction,
  primaryAction,
  actions,
}: DetailsHeaderProps) {
  return (
    <Group justify="space-between" align="center">
      <Group gap="sm" align="center">
        {backAction && (
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={backAction.onClick}
            {...getIconButtonLabel(backAction.label ?? 'Go back')}
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
        )}
        <Stack gap={2}>
          <Title order={2}>{title}</Title>
          {subtitle && (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          )}
        </Stack>
      </Group>

      <Group gap="xs">
        {actions}
        {primaryAction && (
          <Button
            leftSection={primaryAction.icon}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        )}
      </Group>
    </Group>
  );
}
