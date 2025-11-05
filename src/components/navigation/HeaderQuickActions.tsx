import { ActionIcon, Avatar, Group, Indicator, Tooltip } from '@mantine/core';
import {
  IconBell,
  IconChevronDown,
  IconGridDots,
  IconMessageCircle,
  IconSettings,
} from '@tabler/icons-react';

interface HeaderQuickActionsProps {
  unreadMessages?: number;
  unreadNotifications?: number;
  userInitials?: string;
}

function formatBadgeCount(count: number | undefined): string {
  if (!count || count <= 0) {
    return '';
  }
  return count > 20 ? '20+' : String(count);
}

export function HeaderQuickActions({
  unreadMessages = 0,
  unreadNotifications = 0,
  userInitials = 'Y',
}: HeaderQuickActionsProps) {
  return (
    <Group gap="sm" align="center">
      <Tooltip label="Apps" withArrow>
        <ActionIcon
          variant="subtle"
          radius="xl"
          size={46}
          aria-label="Open apps menu"
        >
          <IconGridDots size={20} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Messages" withArrow>
        <Indicator
          inline
          label={formatBadgeCount(unreadMessages)}
          size={16}
          disabled={unreadMessages <= 0}
          color="blue"
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            radius="xl"
            size={46}
            aria-label="Open messages"
          >
            <IconMessageCircle size={20} />
          </ActionIcon>
        </Indicator>
      </Tooltip>

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

      <Group gap={6} align="center">
        <Avatar radius="xl" size={40} alt="Current user">
          {userInitials}
        </Avatar>
        <ActionIcon
          variant="subtle"
          radius="xl"
          size={32}
          aria-label="Open profile menu"
        >
          <IconChevronDown size={18} />
        </ActionIcon>
      </Group>
    </Group>
  );
}

export default HeaderQuickActions;
