'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Flex,
  Group,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  UnstyledButton,
  LoadingOverlay,
  Alert,
  Center,
  Loader,
  Modal,
  MultiSelect,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import {
  IconSearch,
  IconSend,
  IconAlertCircle,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { useSession } from 'next-auth/react';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  messagingService,
  type Conversation,
  type ConversationParticipant,
  type Message,
} from '@/services/messaging.service';
import { formatDistanceToNow } from 'date-fns';
import { playMessageSound } from '@/lib/notificationSound';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

export function MessagingClientPage() {
  const { data: session } = useSession();
  const { preferences, setSoundEnabled } = useNotificationPreferences();
  const [searchValue, setSearchValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messageInput, setMessageInput] = useState('');
  const [newMessageModalOpen, setNewMessageModalOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [conversationTitle, setConversationTitle] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const previousMessagesRef = useRef<Message[]>([]);
  const queryClient = useQueryClient();

  // Fetch conversations with polling
  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingService.getConversations(),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch available users for new conversations
  const { data: availableUsers = [] } = useQuery({
    queryKey: ['users-messaging'],
    queryFn: () => messagingService.getUsers(),
  });

  // Set active conversation when data loads
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Fetch messages for active conversation with faster polling
  const {
    data: messages = [],
    isLoading: loadingMessages,
    error: messagesError,
  } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) {
        return [];
      }
      return messagingService.getMessages(activeConversationId);
    },
    enabled: !!activeConversationId,
    refetchInterval: 3000, // Poll every 3 seconds when chat is open
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: ({
      conversationId,
      body,
    }: {
      conversationId: string;
      body: string;
    }) => messagingService.sendMessage(conversationId, { body }),
    onSuccess: (newMessage) => {
      // Optimistically update the messages cache
      queryClient.setQueryData(
        ['messages', activeConversationId],
        (oldMessages: Message[] = []) => {
          // Check if message already exists (avoid duplicates)
          const exists = oldMessages.some((msg) => msg.id === newMessage.id);
          if (exists) {
            return oldMessages;
          }
          return [...oldMessages, newMessage];
        }
      );

      queryClient.invalidateQueries({
        queryKey: ['messages', activeConversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMessageInput('');

      // Scroll to bottom
      setTimeout(() => {
        if (scrollAreaRef.current) {
          const viewport = scrollAreaRef.current.querySelector(
            '[data-radix-scroll-area-viewport]'
          );
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
          }
        }
      }, 100);
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to send message',
        color: 'red',
      });
    },
  });

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: (payload: {
      participantIds: string[];
      title?: string;
      isGroup?: boolean;
    }) => messagingService.createConversation(payload),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setActiveConversationId(conversation.id);
      setNewMessageModalOpen(false);
      setSelectedUserIds([]);
      setConversationTitle('');
      notifications.show({
        title: 'Success',
        message: 'Conversation created successfully',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to create conversation',
        color: 'red',
      });
    },
  });

  // Mark as read when conversation is opened
  useEffect(() => {
    if (activeConversationId) {
      messagingService.markAsRead(activeConversationId).catch(() => {
        // Silently fail - not critical
      });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages-global'] });
    }
  }, [activeConversationId, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && scrollAreaRef.current) {
      setTimeout(() => {
        const viewport = scrollAreaRef.current?.querySelector(
          '[data-radix-scroll-area-viewport]'
        );
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      }, 100);
    }
  }, [messages]);

  // Show toast notification for new messages
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (!currentUserId || messages.length === 0) {
      return;
    }

    // Find new messages that are not from the current user
    const newMessages = messages.filter(
      (message) =>
        message.senderId !== currentUserId &&
        !previousMessagesRef.current.some((prev) => prev.id === message.id)
    );

    // Show notification and play sound for each new message
    newMessages.forEach((message) => {
      const senderName =
        message.sender.name || message.sender.email || 'Someone';

      // Show visual notification
      notifications.show({
        title: senderName,
        message: message.body,
        color: 'blue',
        position: 'top-right',
        autoClose: 4000,
      });

      // Play notification sound if enabled
      if (preferences.soundEnabled) {
        playMessageSound();
      }
    });

    // Update the previous messages ref
    previousMessagesRef.current = messages;
  }, [messages, session?.user?.id, preferences.soundEnabled]);

  const filteredConversations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = conversation.title || '';
      const participants = conversation.participants
        .map((p) => p.user.name || p.user.email)
        .join(' ');
      return [title, participants].join(' ').toLowerCase().includes(query);
    });
  }, [conversations, searchValue]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conv) => conv.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const handleSendMessage = () => {
    if (!activeConversationId || !messageInput.trim()) {
      return;
    }

    sendMessageMutation.mutate({
      conversationId: activeConversationId,
      body: messageInput.trim(),
    });
  };

  const handleCreateConversation = () => {
    if (selectedUserIds.length === 0) {
      notifications.show({
        title: 'Error',
        message: 'Please select at least one recipient',
        color: 'red',
      });
      return;
    }

    const isGroup = selectedUserIds.length > 1;
    createConversationMutation.mutate({
      participantIds: selectedUserIds,
      title: isGroup && conversationTitle ? conversationTitle : undefined,
      isGroup,
    });
  };

  const getConversationTitle = (conversation: Conversation) => {
    const currentUserId = session?.user?.id;
    const participants = conversation.participants;

    if (!participants.length) {
      return 'Conversation';
    }

    // Filter out the current user to get other participants
    const others = currentUserId
      ? participants.filter(
          (participant) => participant.userId !== currentUserId
        )
      : participants;

    // For direct messages (not a group), show the other participant's name
    if (!conversation.isGroup && others.length === 1) {
      return others[0]?.user.name || others[0]?.user.email || 'Unknown';
    }

    // If there's a custom title, use it for groups
    if (conversation.title) {
      return conversation.title;
    }

    // For groups without a title, show participant names (excluding current user)
    const names = others.map((p) => p.user.name || p.user.email);
    return names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : '');
  };

  const getConversationInitials = (conversation: Conversation) => {
    const title = getConversationTitle(conversation);
    return title
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const getParticipantLabel = (participant: ConversationParticipant) => {
    return participant.user.name || participant.user.email || 'Unknown';
  };

  const getInitialsFromLabel = (label: string) => {
    return label
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  if (conversationsError) {
    return (
      <PageLayout>
        <Alert color="red" icon={<IconAlertCircle />}>
          Failed to load conversations. Please try refreshing the page.
        </Alert>
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid>
      <Flex gap="lg" mih="90vh" align="stretch">
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ width: 320, display: 'flex', flexDirection: 'column' }}
        >
          <Group justify="space-between" mb="sm">
            <Title order={4}>Conversations</Title>
            <Tooltip
              label={
                preferences.soundEnabled
                  ? 'Mute notifications'
                  : 'Unmute notifications'
              }
            >
              <ActionIcon
                variant="subtle"
                color={preferences.soundEnabled ? 'blue' : 'gray'}
                onClick={() => setSoundEnabled(!preferences.soundEnabled)}
              >
                {preferences.soundEnabled ? (
                  <IconVolume size={18} />
                ) : (
                  <IconVolumeOff size={18} />
                )}
              </ActionIcon>
            </Tooltip>
          </Group>

          <TextInput
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
            placeholder="Search conversations"
            leftSection={<IconSearch size={16} />}
            mb="md"
          />

          <ScrollArea style={{ flex: 1 }} offsetScrollbars>
            {loadingConversations ? (
              <Center py="xl">
                <Loader size="sm" />
              </Center>
            ) : filteredConversations.length === 0 ? (
              <Box p="sm">
                <Text size="sm" c="dimmed">
                  {searchValue
                    ? 'No conversations found'
                    : 'No conversations yet'}
                </Text>
              </Box>
            ) : (
              <Stack gap="xs">
                {filteredConversations.map((conversation) => {
                  const isActive = conversation.id === activeConversation?.id;
                  return (
                    <UnstyledButton
                      key={conversation.id}
                      onClick={() => setActiveConversationId(conversation.id)}
                      style={{
                        borderRadius: '12px',
                        border: isActive
                          ? '1px solid var(--mantine-color-blue-5)'
                          : '1px solid var(--mantine-color-gray-3)',
                        backgroundColor: isActive
                          ? 'var(--mantine-color-blue-0)'
                          : 'var(--mantine-color-white)',
                        padding: '12px',
                      }}
                    >
                      <Group align="flex-start" gap="sm" wrap="nowrap">
                        <Avatar radius="xl" size={40}>
                          {getConversationInitials(conversation)}
                        </Avatar>
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group justify="space-between" gap="xs">
                            <Text fw={600} lineClamp={1}>
                              {getConversationTitle(conversation)}
                            </Text>
                            {conversation.lastMessage && (
                              <Text size="xs" c="gray.6">
                                {formatDistanceToNow(
                                  new Date(conversation.lastMessage.createdAt),
                                  { addSuffix: true }
                                )}
                              </Text>
                            )}
                          </Group>
                          <Group gap={6} justify="space-between">
                            <Text size="sm" c="gray.7" lineClamp={1}>
                              {conversation.lastMessage?.body ||
                                'No messages yet'}
                            </Text>
                            {(conversation.unreadCount || 0) > 0 && (
                              <Badge size="sm" radius="xl" color="blue">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </Group>
                        </Stack>
                      </Group>
                    </UnstyledButton>
                  );
                })}
              </Stack>
            )}
          </ScrollArea>

          <Button
            mt="md"
            radius="xl"
            variant="light"
            fullWidth
            onClick={() => setNewMessageModalOpen(true)}
          >
            New Message
          </Button>
        </Paper>

        {/* Messages Area */}
        <Paper
          withBorder
          radius="md"
          p={0}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          pos="relative"
        >
          {activeConversation ? (
            <>
              {/* Header */}
              <Flex
                justify="space-between"
                align="center"
                px="lg"
                py="md"
                style={{
                  borderBottom: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                <Stack gap={2}>
                  <Text fw={600}>
                    {getConversationTitle(activeConversation)}
                  </Text>
                  <Text size="sm" c="gray.6">
                    {activeConversation.participants.length} participants
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button variant="light" radius="xl" disabled>
                    Add People
                  </Button>
                  <Button variant="default" radius="xl" disabled>
                    View Details
                  </Button>
                </Group>
              </Flex>

              {/* Messages */}
              <ScrollArea
                ref={scrollAreaRef}
                style={{ flex: 1, height: 0 }}
                scrollbarSize={6}
                offsetScrollbars
              >
                <Stack p="lg" gap="md">
                  {loadingMessages ? (
                    <Center style={{ flex: 1 }}>
                      <Loader size="sm" />
                    </Center>
                  ) : messagesError ? (
                    <Alert color="red" icon={<IconAlertCircle />}>
                      Failed to load messages
                    </Alert>
                  ) : messages.length === 0 ? (
                    <Center style={{ flex: 1 }}>
                      <Text size="sm" c="dimmed">
                        No messages yet. Send the first message!
                      </Text>
                    </Center>
                  ) : (
                    messages.map((message) => {
                      const isMyMessage =
                        message.senderId === session?.user?.id;
                      return (
                        <Group
                          key={message.id}
                          justify={isMyMessage ? 'flex-end' : 'flex-start'}
                          align="flex-end"
                          gap="sm"
                        >
                          {!isMyMessage && (
                            <Avatar radius="xl" size={36}>
                              {(message.sender.name?.[0] || 'U').toUpperCase()}
                            </Avatar>
                          )}
                          <Stack
                            gap={6}
                            style={{
                              maxWidth: 440,
                              backgroundColor: isMyMessage
                                ? 'var(--mantine-color-blue-5)'
                                : 'var(--mantine-color-white)',
                              color: isMyMessage ? 'white' : 'inherit',
                              border: isMyMessage
                                ? 'none'
                                : '1px solid var(--mantine-color-gray-3)',
                              borderRadius: 16,
                              padding: '12px 16px',
                            }}
                          >
                            {!isMyMessage && (
                              <Text size="sm" fw={600}>
                                {message.sender.name || message.sender.email}
                              </Text>
                            )}
                            <Text size="sm">{message.body}</Text>
                            <Text
                              size="xs"
                              c={
                                isMyMessage ? 'rgba(255,255,255,0.7)' : 'gray.5'
                              }
                              ta={isMyMessage ? 'right' : 'left'}
                            >
                              {formatDistanceToNow(
                                new Date(message.createdAt),
                                {
                                  addSuffix: true,
                                }
                              )}
                            </Text>
                          </Stack>
                          {isMyMessage && (
                            <Avatar radius="xl" size={36}>
                              {(session?.user?.name?.[0] || 'U').toUpperCase()}
                            </Avatar>
                          )}
                        </Group>
                      );
                    })
                  )}
                </Stack>
              </ScrollArea>

              {/* Message Input */}
              <Box
                px="lg"
                py="md"
                style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
              >
                <Stack gap="sm">
                  <Textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.currentTarget.value)}
                    placeholder="Write a message…"
                    minRows={2}
                    autosize
                    maxRows={4}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                  />
                  <Flex
                    justify="space-between"
                    align="center"
                    wrap="wrap"
                    gap="sm"
                  >
                    <Group gap="xs">
                      <Button variant="subtle" radius="xl" size="sm" disabled>
                        Upload
                      </Button>
                      <Button variant="subtle" radius="xl" size="sm" disabled>
                        Templates
                      </Button>
                    </Group>
                    <Button
                      radius="xl"
                      rightSection={<IconSend size={16} />}
                      onClick={handleSendMessage}
                      loading={sendMessageMutation.isPending}
                      disabled={!messageInput.trim()}
                    >
                      Send
                    </Button>
                  </Flex>
                </Stack>
              </Box>
            </>
          ) : (
            <Flex
              justify="center"
              align="center"
              style={{ flex: 1 }}
              px="xl"
              py="xl"
            >
              <Stack align="center" gap="sm">
                <Text fw={600}>Select a conversation</Text>
                <Text size="sm" c="gray.6" ta="center">
                  Choose a conversation on the left to view messages.
                </Text>
              </Stack>
            </Flex>
          )}

          <LoadingOverlay
            visible={sendMessageMutation.isPending}
            overlayProps={{ blur: 1 }}
          />
        </Paper>

        <Paper
          withBorder
          radius="md"
          p="md"
          style={{
            width: 280,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <Title order={5}>Conversation Info</Title>
          {activeConversation ? (
            <Stack gap="md">
              <Box>
                <Text fw={600} size="sm">
                  Members
                </Text>
                <Stack gap={6} mt={6}>
                  {activeConversation.participants.map((participant) => {
                    const label = getParticipantLabel(participant);
                    return (
                      <Group key={participant.id} gap="sm" align="center">
                        <Avatar radius="xl" size={28}>
                          {getInitialsFromLabel(label)}
                        </Avatar>
                        <Stack gap={0} style={{ minWidth: 0 }}>
                          <Text size="sm" lineClamp={1}>
                            {label}
                          </Text>
                          {participant.user.email && participant.user.name && (
                            <Text size="xs" c="gray.6" lineClamp={1}>
                              {participant.user.email}
                            </Text>
                          )}
                        </Stack>
                      </Group>
                    );
                  })}
                </Stack>
              </Box>

              <Box>
                <Text fw={600} size="sm">
                  Recent Activity
                </Text>
                {activeConversation.lastMessage ? (
                  <Stack gap={4} mt={6}>
                    <Text size="sm" c="gray.7" lineClamp={3}>
                      {activeConversation.lastMessage.body}
                    </Text>
                    <Text size="xs" c="gray.6">
                      {formatDistanceToNow(
                        new Date(activeConversation.lastMessage.createdAt),
                        { addSuffix: true }
                      )}
                    </Text>
                  </Stack>
                ) : (
                  <Text size="sm" c="gray.6" mt={6}>
                    No messages yet.
                  </Text>
                )}
              </Box>
            </Stack>
          ) : (
            <Text size="sm" c="gray.6">
              Select a conversation to view participants and details.
            </Text>
          )}
        </Paper>
      </Flex>

      {/* New Message Modal */}
      <Modal
        opened={newMessageModalOpen}
        onClose={() => {
          setNewMessageModalOpen(false);
          setSelectedUserIds([]);
          setConversationTitle('');
        }}
        title="New Message"
        size="md"
      >
        <Stack gap="md">
          <MultiSelect
            label="Recipients"
            placeholder="Select recipients"
            data={availableUsers.map((user) => ({
              value: user.id,
              label: user.name || user.email,
            }))}
            value={selectedUserIds}
            onChange={setSelectedUserIds}
            searchable
            required
          />

          {selectedUserIds.length > 1 && (
            <TextInput
              label="Group Name (optional)"
              placeholder="Enter group name"
              value={conversationTitle}
              onChange={(e) => setConversationTitle(e.currentTarget.value)}
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => {
                setNewMessageModalOpen(false);
                setSelectedUserIds([]);
                setConversationTitle('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateConversation}
              loading={createConversationMutation.isPending}
              disabled={selectedUserIds.length === 0}
            >
              Create Conversation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageLayout>
  );
}
