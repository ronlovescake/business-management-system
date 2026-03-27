'use client';

import {
  ActionIcon,
  Avatar,
  Box,
  Center,
  Divider,
  Flex,
  Group,
  Loader,
  Menu,
  Paper,
  Portal,
  ScrollArea,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  IconBellOff,
  IconDotsVertical,
  IconMessages,
  IconMinus,
  IconMoodSmile,
  IconPhone,
  IconSend,
  IconSquareRounded,
  IconThumbUp,
  IconUser,
  IconVideo,
  IconX,
} from '@tabler/icons-react';
import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { timeAgo } from '@/utils/date';
import {
  messagingService,
  type Conversation,
  type Message,
} from '@/services/messaging.service';
import {
  getConversationInitials,
  getConversationTitle,
} from '../headerQuickActionsUtils';
import type { ChatWindowState } from './types';

const CHAT_WINDOW_WIDTH = 340;
const CHAT_WINDOW_GAP = 20;
const CHAT_WINDOW_HEIGHT = 600;

interface ChatWindowProps {
  conversation: Conversation;
  title: string;
  initials: string;
  offsetIndex: number;
  minimized: boolean;
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  onClose: (conversationId: string) => void;
  onToggleMinimize: (conversationId: string) => void;
  messagingPath: string;
}

const ChatWindow = memo(function ChatWindow({
  conversation,
  title,
  initials,
  offsetIndex,
  minimized,
  currentUserId,
  currentUserEmail,
  onClose,
  onToggleMinimize,
  messagingPath,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const messagesQueryKey = useMemo(
    () => queryKeys.messaging.messages.headerDetail(conversation.id),
    [conversation.id]
  );

  const {
    data: messages = [],
    isLoading: loadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => messagingService.getMessages(conversation.id),
    refetchInterval: minimized ? false : 3000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: (body: string) =>
      messagingService.sendMessage(conversation.id, { body }),
    onSuccess: (newMessage) => {
      queryClient.setQueryData<Message[]>(messagesQueryKey, (old = []) => {
        const exists = old.some((message) => message.id === newMessage.id);
        if (exists) {
          return old;
        }
        return [...old, newMessage];
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversations.list(),
      });
      setDraft('');
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector(
          '[data-radix-scroll-area-viewport]'
        ) as HTMLDivElement | null;
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    },
    onError: () => {
      showNotification({
        title: 'Error',
        message: 'Failed to send message',
        color: 'red',
      });
    },
  });

  useEffect(() => {
    if (!minimized) {
      messagingService.markAsRead(conversation.id).catch(() => {});
      queryClient.invalidateQueries({
        queryKey: queryKeys.messaging.conversations.list(),
      });
    }
  }, [conversation.id, minimized, queryClient]);

  useEffect(() => {
    if (!minimized && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, minimized]);

  const windowStyle: CSSProperties = {
    position: 'fixed',
    right: 16 + offsetIndex * (CHAT_WINDOW_WIDTH + CHAT_WINDOW_GAP),
    bottom: 16,
    width: CHAT_WINDOW_WIDTH,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 4000,
    backgroundColor: 'var(--mantine-color-white)',
  };

  if (!minimized) {
    windowStyle.height = CHAT_WINDOW_HEIGHT;
    windowStyle.maxHeight = '70vh';
  }

  const unread = conversation.unreadCount ?? 0;

  const handleSend = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    sendMessageMutation.mutate(trimmed);
  };

  return (
    <Paper withBorder shadow="xl" radius="lg" style={windowStyle}>
      <Flex
        align="center"
        justify="space-between"
        px="sm"
        py="xs"
        style={{
          background: 'linear-gradient(135deg, #ffb562, #ff8a4c)',
          color: 'white',
        }}
      >
        <Stack gap={0} style={{ flex: 1 }}>
          <Group gap={6} align="center">
            <Avatar size={28} radius="xl" color="orange.7">
              {initials}
            </Avatar>
            <Text fw={600} size="sm" lineClamp={1}>
              {title}
            </Text>
          </Group>
          <Text size="xs" c="rgba(255,255,255,0.85)">
            {unread > 0
              ? `${unread} new message${unread > 1 ? 's' : ''}`
              : `${conversation.participants.length} participants`}
          </Text>
        </Stack>
        <Group gap={6}>
          <ActionIcon variant="subtle" color="white" radius="xl">
            <IconPhone size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="white" radius="xl">
            <IconVideo size={16} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="white"
            radius="xl"
            aria-label={minimized ? 'Expand chat' : 'Minimize chat'}
            onClick={() => onToggleMinimize(conversation.id)}
          >
            {minimized ? (
              <IconSquareRounded size={16} />
            ) : (
              <IconMinus size={16} />
            )}
          </ActionIcon>
          <Menu withinPortal position="bottom-end" shadow="md" zIndex={5000}>
            <Menu.Target>
              <ActionIcon variant="subtle" color="white" radius="xl">
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconMessages size={16} />}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = messagingPath;
                  }
                }}
              >
                Open in Messenger
              </Menu.Item>
              <Menu.Item
                leftSection={<IconUser size={16} />}
                onClick={() =>
                  showNotification({
                    title: 'Profile info',
                    message: 'Profile view is coming soon.',
                    color: 'blue',
                  })
                }
              >
                View user profile
              </Menu.Item>
              <Menu.Item
                leftSection={<IconBellOff size={16} />}
                onClick={() =>
                  showNotification({
                    title: 'Notifications muted',
                    message: 'You will stop receiving alerts for this chat.',
                    color: 'yellow',
                  })
                }
              >
                Mute notifications
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <ActionIcon
            variant="subtle"
            color="white"
            radius="xl"
            aria-label="Close chat"
            onClick={() => onClose(conversation.id)}
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
      </Flex>

      {!minimized ? (
        <>
          <ScrollArea ref={scrollAreaRef} style={{ flex: 1 }} px="sm" py="md">
            {loadingMessages ? (
              <Center py="md">
                <Loader size="sm" />
              </Center>
            ) : messagesError ? (
              <Text size="sm" c="red.6" ta="center">
                Failed to load messages.
              </Text>
            ) : messages.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center">
                No messages yet. Say hello!
              </Text>
            ) : (
              <Stack gap="xs">
                {messages.map((message) => {
                  const senderId = message.senderId?.toLowerCase?.();
                  const senderEmail = message.sender.email?.toLowerCase?.();
                  const normalizedUserId = currentUserId?.toLowerCase?.();
                  const normalizedUserEmail = currentUserEmail?.toLowerCase?.();
                  const isMine =
                    (senderId &&
                      normalizedUserId &&
                      senderId === normalizedUserId) ||
                    (senderEmail &&
                      normalizedUserEmail &&
                      senderEmail === normalizedUserEmail);
                  const senderLabel =
                    message.sender.name || message.sender.email || 'User';
                  const timestamp = timeAgo(message.createdAt);

                  return (
                    <Flex
                      key={message.id}
                      justify={isMine ? 'flex-end' : 'flex-start'}
                    >
                      <Box
                        style={{
                          maxWidth: '80%',
                          backgroundColor: isMine
                            ? 'var(--mantine-color-blue-5)'
                            : 'var(--mantine-color-gray-1)',
                          color: isMine
                            ? 'var(--mantine-color-white)'
                            : 'var(--mantine-color-black)',
                          borderRadius: 16,
                          padding: '0.5rem 0.75rem',
                        }}
                      >
                        {!isMine ? (
                          <Text size="xs" fw={600} c="dimmed">
                            {senderLabel}
                          </Text>
                        ) : null}
                        <Text size="sm" mt={isMine ? 0 : 4}>
                          {message.body}
                        </Text>
                        <Text size="xs" c="dimmed" ta="right" mt={4}>
                          {timestamp}
                        </Text>
                      </Box>
                    </Flex>
                  );
                })}
                <div ref={messagesEndRef} />
              </Stack>
            )}
          </ScrollArea>

          <Divider />

          <Stack gap={6} px="sm" py="xs">
            <Group gap={6}>
              <ActionIcon variant="subtle" radius="xl" disabled>
                <IconMoodSmile size={18} />
              </ActionIcon>
              <ActionIcon variant="subtle" radius="xl" disabled>
                <IconThumbUp size={18} />
              </ActionIcon>
            </Group>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder="Aa"
              autosize
              minRows={1}
              maxRows={3}
              styles={{ input: { paddingRight: 40 } }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <Group justify="flex-end">
              <ActionIcon
                color="blue"
                radius="xl"
                variant="filled"
                aria-label="Send message"
                onClick={handleSend}
                disabled={!draft.trim() || sendMessageMutation.isPending}
              >
                <IconSend size={18} />
              </ActionIcon>
            </Group>
          </Stack>
        </>
      ) : null}
    </Paper>
  );
});

ChatWindow.displayName = 'ChatWindow';

interface ChatWindowsProps {
  openChats: ChatWindowState[];
  conversations: Conversation[];
  currentUserId?: string | null;
  currentUserEmail?: string | null;
  onClose: (conversationId: string) => void;
  onToggleMinimize: (conversationId: string) => void;
  messagingPath: string;
}

export const ChatWindows = memo(function ChatWindows({
  openChats,
  conversations,
  currentUserId,
  currentUserEmail,
  onClose,
  onToggleMinimize,
  messagingPath,
}: ChatWindowsProps) {
  if (openChats.length === 0) {
    return null;
  }

  return (
    <Portal>
      {openChats.map((chat, index) => {
        const conversation = conversations.find((item) => item.id === chat.id);
        if (!conversation) {
          return null;
        }

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

        return (
          <ChatWindow
            key={conversation.id}
            conversation={conversation}
            title={title}
            initials={initials}
            offsetIndex={index}
            minimized={chat.minimized}
            currentUserId={currentUserId}
            currentUserEmail={currentUserEmail}
            onClose={onClose}
            onToggleMinimize={onToggleMinimize}
            messagingPath={messagingPath}
          />
        );
      })}
    </Portal>
  );
});

ChatWindows.displayName = 'ChatWindows';
