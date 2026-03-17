'use client';

import { memo } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  Popover,
  ScrollArea,
  Stack,
  Text,
  ThemeIcon,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconGridDots } from '@tabler/icons-react';
import type { WorkspaceNavSection } from './types';

interface AppsMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  workspaceSections: WorkspaceNavSection[];
  onNavigate: (path: string) => void;
  activePath: string | null;
}

export const AppsMenu = memo(function AppsMenu({
  isOpen,
  onOpenChange,
  onToggle,
  workspaceSections,
  onNavigate,
  activePath,
}: AppsMenuProps) {
  const renderNavSection = ({ workspace, items }: WorkspaceNavSection) => {
    const accentColor = workspace.color || 'blue';

    return (
      <Stack key={workspace.value} gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            {workspace.label} workspace
          </Text>
          <Badge size="xs" variant="light" color={accentColor}>
            {workspace.label}
          </Badge>
        </Group>
        {items.length > 0 ? (
          <Stack gap={4}>
            {items.map((item) => {
              const isActive = activePath === item.path;
              const IconComponent = item.icon;

              return (
                <UnstyledButton
                  key={`${workspace.value}-${item.path}`}
                  onClick={() => onNavigate(item.path)}
                  style={{
                    borderRadius: 10,
                    padding: '0.45rem 0.6rem',
                    backgroundColor: isActive
                      ? 'rgba(59, 130, 246, 0.12)'
                      : 'transparent',
                    border: isActive
                      ? '1px solid rgba(59, 130, 246, 0.35)'
                      : '1px solid transparent',
                  }}
                >
                  <Group gap="sm">
                    <ThemeIcon
                      size="sm"
                      radius="md"
                      variant={isActive ? 'filled' : 'light'}
                      color={accentColor}
                    >
                      <IconComponent size={18} />
                    </ThemeIcon>
                    <Text size="sm" fw={isActive ? 600 : 500}>
                      {item.label}
                    </Text>
                  </Group>
                </UnstyledButton>
              );
            })}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No pages available yet.
          </Text>
        )}
      </Stack>
    );
  };

  return (
    <Popover
      shadow="xl"
      radius="md"
      width={340}
      position="bottom-start"
      opened={isOpen}
      onChange={onOpenChange}
    >
      <Popover.Target>
        <Tooltip label="Apps" withArrow>
          <ActionIcon
            variant="subtle"
            radius="xl"
            size={46}
            aria-label="Open workspace navigator"
            onClick={onToggle}
          >
            <IconGridDots size={20} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p="sm">
        {workspaceSections.length > 0 ? (
          <Stack gap="sm" w="100%">
            <Group justify="space-between" align="flex-start">
              <div>
                <Text fw={600}>Workspace navigator</Text>
                <Text size="xs" c="dimmed">
                  Switch between available workspaces
                </Text>
              </div>
            </Group>

            <ScrollArea h={720} offsetScrollbars>
              <Stack gap="md">
                {workspaceSections.map((section) => renderNavSection(section))}
              </Stack>
            </ScrollArea>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Navigate to a workspace to load shortcuts.
          </Text>
        )}
      </Popover.Dropdown>
    </Popover>
  );
});
