'use client';

import { memo } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Group,
  Indicator,
  Menu,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBell,
  IconLogout,
  IconSettings,
  IconUser,
  IconUsers,
} from '@tabler/icons-react';
import type { Session } from 'next-auth';
import { formatBadgeCount } from '../headerQuickActionsUtils';

interface NotificationsMenuProps {
  unreadNotifications: number;
}

export const NotificationsMenu = memo(function NotificationsMenu({
  unreadNotifications,
}: NotificationsMenuProps) {
  return (
    <Tooltip label="Notifications" withArrow>
      <Indicator
        inline
        label={formatBadgeCount(unreadNotifications)}
        size={16}
        disabled={unreadNotifications <= 0}
        color="red"
        offset={4}
      >
        <ActionIcon
          variant="subtle"
          radius="xl"
          size={46}
          aria-label="Open notifications"
        >
          <IconBell size={20} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
});

export const SettingsButton = memo(function SettingsButton() {
  return (
    <Tooltip label="Settings" withArrow>
      <ActionIcon
        variant="subtle"
        radius="xl"
        size={46}
        aria-label="Open settings"
      >
        <IconSettings size={20} />
      </ActionIcon>
    </Tooltip>
  );
});

interface ProfileMenuProps {
  session: Session | null | undefined;
  mounted: boolean;
  userInitials: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

export const ProfileMenu = memo(function ProfileMenu({
  session,
  mounted,
  userInitials,
  onNavigate,
  onSignOut,
}: ProfileMenuProps) {
  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <UnstyledButton
          aria-label="Open profile menu"
          style={{
            padding: '6px 12px',
            borderRadius: '24px',
            transition: 'background-color 0.2s',
          }}
          styles={{
            root: {
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
              },
            },
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <Avatar
              radius="xl"
              size={40}
              alt="Current user"
              src={session?.user?.photoUrl || undefined}
            >
              {session?.user?.name
                ? session.user.name.charAt(0).toUpperCase()
                : session?.user?.email?.charAt(0).toUpperCase() || userInitials}
            </Avatar>
            {session?.user ? (
              <Stack gap={4} style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} lineClamp={1}>
                  {session.user.name || 'User'}
                </Text>
                {session.user.role === 'SUPER_ADMIN' ? (
                  <Badge
                    variant="filled"
                    color="red"
                    size="sm"
                    styles={{
                      root: {
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                      },
                    }}
                  >
                    SUPER ADMIN
                  </Badge>
                ) : (
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {session.user.role.replace('_', ' ')}
                  </Text>
                )}
              </Stack>
            ) : null}
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {session?.user?.email || 'User'}
          </Text>
        </Menu.Label>
        <Menu.Item
          leftSection={<IconUser size={16} />}
          onClick={() => onNavigate('/profile')}
        >
          My Profile
        </Menu.Item>
        {mounted && session?.user?.role === 'SUPER_ADMIN' ? (
          <Menu.Item
            leftSection={<IconUsers size={16} />}
            onClick={() => onNavigate('/clothing/users')}
          >
            User Management
          </Menu.Item>
        ) : null}
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconLogout size={16} />}
          color="red"
          onClick={onSignOut}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
});
