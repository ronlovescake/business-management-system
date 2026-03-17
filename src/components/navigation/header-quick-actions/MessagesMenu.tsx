'use client';

import { memo } from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Group,
  Indicator,
  Loader,
  Popover,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconDotsVertical,
  IconEdit,
  IconMessageCircle,
  IconSearch,
} from '@tabler/icons-react';
import { timeAgo } from '@/utils/date';
import type { Conversation } from '@/services/messaging.service';
import {
  getConversationInitials,
  getConversationTitle,
} from '../headerQuickActionsUtils';

interface MessagesMenuProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: () => void;
  unreadCount: number;
  badgeLabel: string;
  messageSearch: string;
  onSearchChange: (value: string) => void;
  loadingConversations: boolean;
  conversationsError: unknown;
  filteredConversations: Conversation[];
  totalConversations: number;
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  onConversationSelect: (conversationId: string) => void;
  onViewAll: () => void;
  messagingPath: string;
}

export const MessagesMenu = memo(function MessagesMenu({
  isOpen,
  onOpenChange,
  onToggle,
  unreadCount,
  badgeLabel,
  messageSearch,
  onSearchChange,
  loadingConversations,
  conversationsError,
  filteredConversations,
  totalConversations,
  currentUserId,
  currentUserEmail,
  onConversationSelect,
  onViewAll,
  messagingPath,
}: MessagesMenuProps) {
  const statusLabel = loadingConversations
    ? 'Loading conversations…'
    : conversationsError
      ? 'Unable to load conversations'
      : `${totalConversations} conversation${totalConversations === 1 ? '' : 's'}`;

  return (
    <Popover
      shadow="xl"
      radius="md"
      width={360}
      position="bottom-end"
      opened={isOpen}
      onChange={onOpenChange}
    >
      <Popover.Target>
        <Tooltip label="Messages" withArrow>
          <Indicator
            inline
            label={badgeLabel}
            size={16}
            disabled={unreadCount <= 0}
            color="blue"
            offset={4}
          >
            <ActionIcon
              variant="subtle"
              radius="xl"
              size={46}
              aria-label="Open messages"
              onClick={onToggle}
            >
              <IconMessageCircle size={20} />
            </ActionIcon>
          </Indicator>
        </Tooltip>
      </Popover.Target>

      <Popover.Dropdown p="sm">
        <Stack gap="xs" w="100%">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Messages</Text>
              <Text size="xs" c="dimmed">
                {statusLabel}
              </Text>
            </div>
            <Group gap={6}>
              <ActionIcon
                variant="subtle"
                radius="xl"
                aria-label="Start new message"
              >
                <IconEdit size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                radius="xl"
                aria-label="More message options"
              >
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Group>
          </Group>

          <TextInput
            value={messageSearch}
            onChange={(event) => onSearchChange(event.currentTarget.value)}
            placeholder="Search Messenger"
            leftSection={<IconSearch size={14} />}
            size="xs"
            radius="md"
          />

          <Divider my={4} />

          <ScrollArea h={320} offsetScrollbars>
            {loadingConversations ? (
              <Center py="lg">
                <Loader size="sm" />
              </Center>
            ) : conversationsError ? (
              <Box py="lg">
                <Text size="sm" c="red.6">
                  Unable to load conversations.
                </Text>
              </Box>
            ) : filteredConversations.length === 0 ? (
              <Box ta="center" py="lg">
                <Text size="sm" c="dimmed">
                  No conversations found
                </Text>
              </Box>
            ) : (
              <Stack gap="xs">
                {filteredConversations.map((conversation) => {
                  const title = getConversationTitle(
                    conversation,
                    currentUserId,
                    currentUserEmail
                  );
                  const initials = getConversationInitials(
                    conversation,
                    currentUserId,
                    currentUserEmail
                  );
                  const lastMessageTime = conversation.lastMessage?.createdAt
                    ? timeAgo(conversation.lastMessage.createdAt)
                    : '';
                  const preview =
                    conversation.lastMessage?.body || 'No messages yet';
                  const unreadConversationCount = conversation.unreadCount ?? 0;

                  return (
                    <UnstyledButton
                      key={conversation.id}
                      onClick={() => onConversationSelect(conversation.id)}
                      style={{
                        borderRadius: '12px',
                        padding: '0.5rem 0.75rem',
                        border: '1px solid var(--mantine-color-gray-3)',
                        backgroundColor: 'var(--mantine-color-gray-0)',
                      }}
                    >
                      <Group align="flex-start" gap="sm">
                        <Avatar radius="xl" size={36} variant="filled">
                          {initials}
                        </Avatar>
                        <Box style={{ flex: 1 }}>
                          <Group justify="space-between" align="baseline">
                            <Text size="sm" fw={600} lineClamp={1}>
                              {title}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {lastMessageTime}
                            </Text>
                          </Group>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {preview}
                          </Text>
                        </Box>
                        {unreadConversationCount > 0 ? (
                          <Badge color="blue" radius="xl" size="sm">
                            {unreadConversationCount}
                          </Badge>
                        ) : null}
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          <Button
            component="a"
            href={messagingPath}
            variant="light"
            size="xs"
            radius="md"
            onClick={onViewAll}
          >
            View All in Messenger
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
});
