'use client';

import { useMemo, useState } from 'react';
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
} from '@mantine/core';
import { IconSearch, IconSend } from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';

type Conversation = {
  id: string;
  title: string;
  participants: string[];
  unread: number;
  lastMessage: {
    author: string;
    preview: string;
    at: string;
  };
};

type Message = {
  id: string;
  author: {
    name: string;
    avatarInitials?: string;
  };
  body: string;
  sentAt: string;
  mine?: boolean;
};

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'team-admins',
    title: 'Admin Team',
    participants: ['You', 'Alex Ramos', 'Gia Martinez'],
    unread: 2,
    lastMessage: {
      author: 'Alex Ramos',
      preview: 'Inventory audit is ready to review…',
      at: '10:24 AM',
    },
  },
  {
    id: 'direct-gianna',
    title: 'Gianna Dela Cruz',
    participants: ['You', 'Gianna Dela Cruz'],
    unread: 0,
    lastMessage: {
      author: 'Gianna Dela Cruz',
      preview: 'Sent the customer handover file ✅',
      at: 'Yesterday',
    },
  },
  {
    id: 'managers',
    title: 'Store Managers',
    participants: ['You', 'Rex Perez', 'Mina Lopez', 'Carlos Velez'],
    unread: 4,
    lastMessage: {
      author: 'Mina Lopez',
      preview: 'Payroll adjustments look good from my side.',
      at: 'Mon',
    },
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  'team-admins': [
    {
      id: '1',
      author: { name: 'Alex Ramos', avatarInitials: 'AR' },
      body: 'Inventory audit is ready to review—let me know before we close today.',
      sentAt: '10:24 AM',
    },
    {
      id: '2',
      author: { name: 'You', avatarInitials: 'Y' },
      body: 'Great, I will check after lunch. Anything blocking payroll?',
      sentAt: '10:27 AM',
      mine: true,
    },
    {
      id: '3',
      author: { name: 'Gia Martinez', avatarInitials: 'GM' },
      body: 'Payroll is clear. I need updated delivery schedules before 2 PM.',
      sentAt: '10:32 AM',
    },
  ],
  'direct-gianna': [
    {
      id: '4',
      author: { name: 'Gianna Dela Cruz', avatarInitials: 'GD' },
      body: 'Sent the customer handover file ✅',
      sentAt: 'Yesterday · 5:11 PM',
    },
  ],
  managers: [
    {
      id: '5',
      author: { name: 'Mina Lopez', avatarInitials: 'ML' },
      body: 'Payroll adjustments look good from my side.',
      sentAt: 'Mon · 3:05 PM',
    },
    {
      id: '6',
      author: { name: 'You', avatarInitials: 'Y' },
      body: 'Thanks! Please double check attendance for Cebu branch.',
      sentAt: 'Mon · 3:07 PM',
      mine: true,
    },
  ],
};

export default function MessagingPage() {
  const [searchValue, setSearchValue] = useState('');
  const [activeConversationId, setActiveConversationId] = useState(
    MOCK_CONVERSATIONS[0]?.id ?? ''
  );

  const filteredConversations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return MOCK_CONVERSATIONS;
    }

    return MOCK_CONVERSATIONS.filter((conversation) =>
      [conversation.title, ...conversation.participants]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [searchValue]);

  const activeConversation = useMemo(() => {
    return (
      MOCK_CONVERSATIONS.find(
        (conversation) => conversation.id === activeConversationId
      ) ??
      filteredConversations[0] ??
      null
    );
  }, [activeConversationId, filteredConversations]);

  const activeMessages = useMemo(() => {
    if (!activeConversation) {
      return [];
    }
    return MOCK_MESSAGES[activeConversation.id] ?? [];
  }, [activeConversation]);

  return (
    <PageLayout fluid>
      <Flex gap="lg" mih="90vh" align="stretch">
        <Paper
          withBorder
          radius="md"
          p="md"
          style={{ width: 320, display: 'flex', flexDirection: 'column' }}
        >
          <Title order={4} mb="sm">
            Conversations
          </Title>

          <TextInput
            value={searchValue}
            onChange={(event) => setSearchValue(event.currentTarget.value)}
            placeholder="Search people or channels"
            leftSection={<IconSearch size={16} />}
            mb="md"
          />

          <ScrollArea style={{ flex: 1 }} offsetScrollbars>
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
                        {conversation.title
                          .split(' ')
                          .map((word: string) => word[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </Avatar>
                      <Stack gap={4} style={{ flex: 1 }}>
                        <Group justify="space-between" gap="xs">
                          <Text fw={600}>{conversation.title}</Text>
                          <Text size="xs" c="gray.6">
                            {conversation.lastMessage.at}
                          </Text>
                        </Group>
                        <Text size="sm" c="gray.7" lineClamp={1}>
                          {conversation.lastMessage.author}:{' '}
                          {conversation.lastMessage.preview}
                        </Text>
                        <Group gap={6}>
                          <Text size="xs" c="gray.5">
                            {conversation.participants.join(', ')}
                          </Text>
                          {conversation.unread > 0 && (
                            <Badge size="sm" radius="xl" color="blue">
                              {conversation.unread}
                            </Badge>
                          )}
                        </Group>
                      </Stack>
                    </Group>
                  </UnstyledButton>
                );
              })}
              {filteredConversations.length === 0 && (
                <Box p="sm">
                  <Text size="sm" c="gray.6">
                    No conversations matched your search.
                  </Text>
                </Box>
              )}
            </Stack>
          </ScrollArea>

          <Button mt="md" radius="xl" variant="light">
            New Message
          </Button>
        </Paper>

        <Paper
          withBorder
          radius="md"
          p={0}
          style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          {activeConversation ? (
            <>
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
                  <Text fw={600}>{activeConversation.title}</Text>
                  <Text size="sm" c="gray.6">
                    {activeConversation.participants.join(', ')}
                  </Text>
                </Stack>
                <Group gap="xs">
                  <Button variant="light" radius="xl">
                    Add People
                  </Button>
                  <Button variant="default" radius="xl">
                    View Details
                  </Button>
                </Group>
              </Flex>

              <ScrollArea
                style={{ flex: 1 }}
                scrollbarSize={6}
                offsetScrollbars
              >
                <Stack p="lg" gap="md">
                  {activeMessages.map((message) => (
                    <Group
                      key={message.id}
                      justify={message.mine ? 'flex-end' : 'flex-start'}
                      align="flex-end"
                      gap="sm"
                    >
                      {!message.mine && (
                        <Avatar radius="xl" size={36}>
                          {(
                            message.author.avatarInitials ??
                            message.author.name.charAt(0)
                          ).toUpperCase()}
                        </Avatar>
                      )}
                      <Stack
                        gap={6}
                        style={{
                          maxWidth: 440,
                          backgroundColor: message.mine
                            ? 'var(--mantine-color-blue-0)'
                            : 'var(--mantine-color-white)',
                          border: '1px solid var(--mantine-color-gray-3)',
                          borderRadius: 16,
                          padding: '12px 16px',
                        }}
                      >
                        <Text
                          size="sm"
                          fw={600}
                          ta={message.mine ? 'right' : 'left'}
                        >
                          {message.author.name}
                        </Text>
                        <Text size="sm" ta={message.mine ? 'right' : 'left'}>
                          {message.body}
                        </Text>
                        <Text
                          size="xs"
                          c="gray.5"
                          ta={message.mine ? 'right' : 'left'}
                        >
                          {message.sentAt}
                        </Text>
                      </Stack>
                    </Group>
                  ))}
                  {activeMessages.length === 0 && (
                    <Box py="lg">
                      <Text size="sm" c="gray.6">
                        No messages yet. Send the first message to start the
                        conversation.
                      </Text>
                    </Box>
                  )}
                </Stack>
              </ScrollArea>

              <Box
                px="lg"
                py="md"
                style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}
              >
                <Stack gap="sm">
                  <Textarea
                    placeholder="Write a message…"
                    minRows={3}
                    autosize
                  />
                  <Flex justify="space-between" align="center">
                    <Group gap="xs">
                      <Button variant="subtle">Upload</Button>
                      <Button variant="subtle">Templates</Button>
                    </Group>
                    <Button radius="xl" rightSection={<IconSend size={16} />}>
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
                <Text fw={600}>Pick a conversation</Text>
                <Text size="sm" c="gray.6" ta="center">
                  Nothing selected yet. Choose a conversation on the left to
                  view the thread and start messaging.
                </Text>
              </Stack>
            </Flex>
          )}
        </Paper>

        <Paper
          withBorder
          radius="md"
          p="md"
          style={{
            width: 260,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <Title order={5}>Conversation Info</Title>
          {activeConversation ? (
            <Stack gap="sm">
              <Box>
                <Text fw={600} size="sm">
                  Members
                </Text>
                <Stack gap={6} mt={6}>
                  {activeConversation.participants.map(
                    (participant: string) => (
                      <Group key={participant} gap="sm">
                        <Avatar radius="xl" size={28}>
                          {participant
                            .split(' ')
                            .map((word: string) => word[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </Avatar>
                        <Text size="sm">{participant}</Text>
                      </Group>
                    )
                  )}
                </Stack>
              </Box>
              <Box>
                <Text fw={600} size="sm">
                  Recent Activity
                </Text>
                <Text size="sm" c="gray.6" mt={6}>
                  {activeConversation.lastMessage.author} ·{' '}
                  {activeConversation.lastMessage.at}
                </Text>
              </Box>
            </Stack>
          ) : (
            <Text size="sm" c="gray.6">
              Select a conversation to view participants and details.
            </Text>
          )}
        </Paper>
      </Flex>
    </PageLayout>
  );
}
