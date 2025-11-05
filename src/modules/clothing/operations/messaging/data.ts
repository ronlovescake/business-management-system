export type Conversation = {
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

export type Message = {
  id: string;
  author: {
    name: string;
    avatarInitials?: string;
  };
  body: string;
  sentAt: string;
  mine?: boolean;
};

export const MOCK_CONVERSATIONS: Conversation[] = [
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

export const MOCK_MESSAGES: Record<string, Message[]> = {
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

export function getConversationById(id: string): Conversation | undefined {
  return MOCK_CONVERSATIONS.find((conversation) => conversation.id === id);
}

export function getMessagesByConversationId(id: string): Message[] {
  return MOCK_MESSAGES[id] ?? [];
}
