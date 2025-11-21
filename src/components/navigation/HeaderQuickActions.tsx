'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  ActionIcon,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Divider,
  Flex,
  Group,
  Indicator,
  Loader,
  Menu,
  Paper,
  Popover,
  Portal,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  UnstyledButton,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBell,
  IconDotsVertical,
  IconEdit,
  IconGridDots,
  IconMessages,
  IconMessageCircle,
  IconMoodSmile,
  IconMinus,
  IconPhone,
  IconSearch,
  IconSend,
  IconSettings,
  IconSquareRounded,
  IconUser,
  IconBellOff,
  IconThumbUp,
  IconVideo,
  IconX,
  IconLogout,
  IconUsers,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useBusinessStore } from '@/lib/store';
import {
  messagingService,
  type Conversation,
  type ConversationParticipant,
  type Message,
} from '@/services/messaging.service';
import {
  buildNavigationItems,
  type BusinessType,
  type WorkspaceType,
  type NavigationItem,
} from './navigationItems';

interface HeaderQuickActionsProps {
  unreadMessages?: number;
  unreadNotifications?: number;
  userInitials?: string;
}

type ChatWindowState = {
  id: string;
  minimized: boolean;
};

const STORAGE_KEY = 'bm-open-chat-windows';
const CHAT_WINDOW_WIDTH = 340;
const CHAT_WINDOW_GAP = 20;
const CHAT_WINDOW_HEIGHT = 600;
const MAX_CHAT_WINDOWS = 3;

const isBusiness = (value: string | null): value is BusinessType =>
  value === 'clothing' || value === 'trucking';

function formatBadgeCount(count: number | undefined): string {
  if (!count || count <= 0) {
    return '';
  }
  return count > 20 ? '20+' : String(count);
}

const getParticipantLabel = (participant: ConversationParticipant) =>
  participant.user.name || participant.user.email || 'Unknown';

const getConversationTitle = (
  conversation: Conversation,
  currentUserId?: string | null,
  currentUserEmail?: string | null
) => {
  const participants = conversation.participants;
  if (!participants.length) {
    return 'Conversation';
  }

  const normalizedCurrentIds = new Set<string>();
  if (currentUserId) {
    normalizedCurrentIds.add(currentUserId.toLowerCase());
  }
  if (currentUserEmail) {
    normalizedCurrentIds.add(currentUserEmail.toLowerCase());
  }

  const others = participants.filter((participant) => {
    const participantId = participant.userId?.toLowerCase?.();
    const participantEmail = participant.user.email?.toLowerCase?.();

    if (participantId && normalizedCurrentIds.has(participantId)) {
      return false;
    }

    if (participantEmail && normalizedCurrentIds.has(participantEmail)) {
      return false;
    }

    return true;
  });

  if (others.length === 1) {
    return getParticipantLabel(others[0]);
  }

  if (others.length > 1) {
    const names = others.map(getParticipantLabel);
    return names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : '');
  }

  const fallback =
    participants.find((participant) => participant.userId !== currentUserId) ||
    participants.find(
      (participant) =>
        participant.user.email &&
        participant.user.email.toLowerCase() !== currentUserEmail?.toLowerCase()
    ) ||
    participants[0];

  if (fallback) {
    return getParticipantLabel(fallback);
  }

  return conversation.title || 'Conversation';
};

const getConversationInitials = (
  conversation: Conversation,
  currentUserId?: string | null,
  currentUserEmail?: string | null
) => {
  const title = getConversationTitle(
    conversation,
    currentUserId,
    currentUserEmail
  );
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};

export function HeaderQuickActions({
  unreadMessages = 0,
  unreadNotifications = 0,
  userInitials = 'Y',
}: HeaderQuickActionsProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [openChats, setOpenChats] = useState<ChatWindowState[]>([]);
  const hasHydratedRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const { selectedBusiness, selectedWorkspace, initializeFromPath } =
    useBusinessStore();
  const currentUserId = session?.user?.id ?? null;
  const currentUserEmail = session?.user?.email ?? null;

  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingService.getConversations(),
    refetchInterval: 5000,
  });

  const totalUnreadFromApi = useMemo(() => {
    if (!conversations?.length) {
      return undefined;
    }
    return conversations.reduce(
      (sum, conversation) => sum + (conversation.unreadCount ?? 0),
      0
    );
  }, [conversations]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const operationsNavItems = useMemo(() => {
    if (!isBusiness(selectedBusiness)) {
      return [];
    }
    return buildNavigationItems(selectedBusiness, 'operations');
  }, [selectedBusiness]);

  const employeesNavItems = useMemo(() => {
    if (!isBusiness(selectedBusiness)) {
      return [];
    }
    return buildNavigationItems(selectedBusiness, 'employees');
  }, [selectedBusiness]);

  const handleNavigate = (path: string) => {
    setAppsOpen(false);
    setMessagesOpen(false);
    router.push(path);
  };

  const renderNavSection = (
    title: string,
    items: NavigationItem[],
    workspace: WorkspaceType
  ) => {
    const accentColor = workspace === 'operations' ? 'blue' : 'green';

    return (
      <Stack key={workspace} gap="xs">
        <Group justify="space-between" align="center">
          <Text fw={600} size="sm">
            {title}
          </Text>
          <Badge size="xs" variant="light" color={accentColor}>
            {workspace === 'operations' ? 'Operations' : 'Employees'}
          </Badge>
        </Group>
        {items.length > 0 ? (
          <Stack gap={4}>
            {items.map((item) => {
              const isActive = pathname === item.path;
              const IconComponent = item.icon;

              return (
                <UnstyledButton
                  key={`${workspace}-${item.path}`}
                  onClick={() => handleNavigate(item.path)}
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      hasHydratedRef.current = true;
      return;
    }

    let restoredChats: ChatWindowState[] | null = null;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const legacy = window.localStorage.getItem('bm-open-chat-ids');
        if (legacy) {
          const legacyParsed = JSON.parse(legacy);
          if (Array.isArray(legacyParsed)) {
            restoredChats = legacyParsed
              .filter((id: unknown): id is string => typeof id === 'string')
              .map((id) => ({ id, minimized: false }));
          }
        }
      } else {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          restoredChats = parsed
            .map((item) => {
              if (typeof item === 'string') {
                return { id: item, minimized: false } satisfies ChatWindowState;
              }
              if (
                item &&
                typeof item === 'object' &&
                typeof item.id === 'string'
              ) {
                return {
                  id: item.id,
                  minimized: Boolean(
                    (item as { minimized?: boolean }).minimized
                  ),
                } satisfies ChatWindowState;
              }
              return null;
            })
            .filter((item): item is ChatWindowState => item !== null);
        }
      }
    } catch (error) {
      showNotification({
        title: 'Messaging state',
        message: 'Failed to restore chat windows.',
        color: 'red',
      });
    }

    if (Array.isArray(restoredChats) && restoredChats.length > 0) {
      setOpenChats(restoredChats);
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openChats));
    } catch (error) {
      showNotification({
        title: 'Messaging state',
        message: 'Failed to save chat windows.',
        color: 'red',
      });
    }
  }, [openChats]);

  const filteredConversations = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = getConversationTitle(
        conversation,
        currentUserId,
        currentUserEmail
      ).toLowerCase();
      const participants = conversation.participants
        .map((participant) => getParticipantLabel(participant).toLowerCase())
        .join(' ');
      return `${title} ${participants}`.includes(query);
    });
  }, [conversations, messageSearch, currentUserId, currentUserEmail]);

  const handleOpenConversation = (conversationId: string) => {
    setMessagesOpen(false);
    setOpenChats((current) => {
      const withoutDuplicate = current.filter(
        (chat) => chat.id !== conversationId
      );
      const next = [
        ...withoutDuplicate,
        { id: conversationId, minimized: false },
      ];
      if (next.length <= MAX_CHAT_WINDOWS) {
        return next;
      }
      return next.slice(next.length - MAX_CHAT_WINDOWS);
    });
  };

  const handleCloseConversation = (conversationId: string) => {
    setOpenChats((current) =>
      current.filter((chat) => chat.id !== conversationId)
    );
  };

  const handleToggleMinimize = (conversationId: string) => {
    setOpenChats((current) =>
      current.map((chat) =>
        chat.id === conversationId
          ? { ...chat, minimized: !chat.minimized }
          : chat
      )
    );
  };

  return (
    <Group gap="sm" align="center">
      <Popover
        shadow="xl"
        radius="md"
        width={340}
        position="bottom-start"
        opened={appsOpen}
        onChange={setAppsOpen}
      >
        <Popover.Target>
          <Tooltip label="Apps" withArrow>
            <ActionIcon
              variant="subtle"
              radius="xl"
              size={46}
              aria-label="Open workspace navigator"
              onClick={() => setAppsOpen((open) => !open)}
            >
              <IconGridDots size={20} />
            </ActionIcon>
          </Tooltip>
        </Popover.Target>

        <Popover.Dropdown p="sm">
          {isBusiness(selectedBusiness) ? (
            <Stack gap="sm" w="100%">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={600}>Workspace navigator</Text>
                  <Text size="xs" c="dimmed">
                    Switch between operations and employees
                  </Text>
                </div>
              </Group>

              <ScrollArea h={720} offsetScrollbars>
                <Stack gap="md">
                  {renderNavSection(
                    'Operations workspace',
                    operationsNavItems,
                    'operations'
                  )}
                  {renderNavSection(
                    'Employees workspace',
                    employeesNavItems,
                    'employees'
                  )}
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

      <Popover
        shadow="xl"
        radius="md"
        width={360}
        position="bottom-end"
        opened={messagesOpen}
        onChange={setMessagesOpen}
      >
        <Popover.Target>
          <Tooltip label="Messages" withArrow>
            <Indicator
              inline
              label={formatBadgeCount(totalUnreadFromApi ?? unreadMessages)}
              size={16}
              disabled={(totalUnreadFromApi ?? unreadMessages) <= 0}
              color="blue"
              offset={4}
            >
              <ActionIcon
                variant="subtle"
                radius="xl"
                size={46}
                aria-label="Open messages"
                onClick={() => setMessagesOpen((open) => !open)}
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
                  {loadingConversations
                    ? 'Loading conversations…'
                    : conversationsError
                      ? 'Unable to load conversations'
                      : `${conversations.length} conversation${
                          conversations.length === 1 ? '' : 's'
                        }`}
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
              onChange={(event) => setMessageSearch(event.currentTarget.value)}
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
                      ? formatDistanceToNow(
                          new Date(conversation.lastMessage.createdAt),
                          { addSuffix: true }
                        )
                      : '';
                    const preview =
                      conversation.lastMessage?.body || 'No messages yet';
                    const unreadCount = conversation.unreadCount ?? 0;

                    return (
                      <UnstyledButton
                        key={conversation.id}
                        onClick={() => handleOpenConversation(conversation.id)}
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
                          {unreadCount > 0 && (
                            <Badge color="blue" radius="xl" size="sm">
                              {unreadCount}
                            </Badge>
                          )}
                        </Group>
                      </UnstyledButton>
                    );
                  })}
                </Stack>
              )}
            </ScrollArea>

            <Button
              component="a"
              href="/clothing/operations/messaging"
              variant="light"
              size="xs"
              radius="md"
              onClick={() => setMessagesOpen(false)}
            >
              View All in Messenger
            </Button>
          </Stack>
        </Popover.Dropdown>
      </Popover>

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
                  : session?.user?.email?.charAt(0).toUpperCase() ||
                    userInitials}
              </Avatar>
              {session?.user && (
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
              )}
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
            onClick={() => router.push('/profile')}
          >
            My Profile
          </Menu.Item>
          {mounted && session?.user?.role === 'SUPER_ADMIN' && (
            <Menu.Item
              leftSection={<IconUsers size={16} />}
              onClick={() => router.push('/clothing/users')}
            >
              User Management
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item
            leftSection={<IconLogout size={16} />}
            color="red"
            onClick={() => signOut({ callbackUrl: '/login' })}
          >
            Logout
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Portal>
        {openChats.map((chat, index) => {
          const conversation = conversations.find(
            (item) => item.id === chat.id
          );

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
              onClose={handleCloseConversation}
              onToggleMinimize={handleToggleMinimize}
            />
          );
        })}
      </Portal>
    </Group>
  );
}

export default HeaderQuickActions;

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
}

function ChatWindow({
  conversation,
  title,
  initials,
  offsetIndex,
  minimized,
  currentUserId,
  currentUserEmail,
  onClose,
  onToggleMinimize,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const messagesQueryKey = useMemo(
    () => ['header-messages', conversation.id] as const,
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
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
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [conversation.id, minimized, queryClient]);

  // Scroll to bottom when messages change or when window is expanded
  useEffect(() => {
    if (!minimized && messages.length > 0) {
      // Use scrollIntoView on the dummy div at the bottom
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
                    window.location.href = '/clothing/operations/messaging';
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

      {!minimized && (
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
                  const timestamp = formatDistanceToNow(
                    new Date(message.createdAt),
                    { addSuffix: true }
                  );

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
                        {!isMine && (
                          <Text size="xs" fw={600} c="dimmed">
                            {senderLabel}
                          </Text>
                        )}
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
                {/* Dummy div for auto-scroll */}
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
      )}
    </Paper>
  );
}
