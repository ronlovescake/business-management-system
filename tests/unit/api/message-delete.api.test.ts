import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetServerSession,
  mockConversationParticipantFindUnique,
  mockMessageFindFirst,
  mockMessageDelete,
  mockMessageHiddenForUserUpsert,
  mockLogger,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockConversationParticipantFindUnique: vi.fn(),
  mockMessageFindFirst: vi.fn(),
  mockMessageDelete: vi.fn(),
  mockMessageHiddenForUserUpsert: vi.fn(),
  mockLogger: {
    error: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    conversationParticipant: {
      findUnique: mockConversationParticipantFindUnique,
    },
    message: {
      findFirst: mockMessageFindFirst,
      delete: mockMessageDelete,
    },
    messageHiddenForUser: {
      upsert: mockMessageHiddenForUserUpsert,
    },
  },
}));

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/auth/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

import { DELETE } from '@/app/api/conversations/[id]/messages/[messageId]/route';

describe('message delete API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hard deletes sender-owned messages', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockConversationParticipantFindUnique.mockResolvedValue({
      id: 'participant-1',
    });
    mockMessageFindFirst.mockResolvedValue({
      id: 'message-1',
      senderId: 'user-1',
    });

    const response = await DELETE({} as never, {
      params: { id: 'conversation-1', messageId: 'message-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockMessageDelete).toHaveBeenCalledWith({
      where: { id: 'message-1' },
    });
    expect(mockMessageHiddenForUserUpsert).not.toHaveBeenCalled();
    expect(body).toEqual({ messageId: 'message-1', mode: 'hard-delete' });
  });

  it('hides received messages only for the current user', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-2' } });
    mockConversationParticipantFindUnique.mockResolvedValue({
      id: 'participant-2',
    });
    mockMessageFindFirst.mockResolvedValue({
      id: 'message-1',
      senderId: 'user-1',
    });

    const response = await DELETE({} as never, {
      params: { id: 'conversation-1', messageId: 'message-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockMessageDelete).not.toHaveBeenCalled();
    expect(mockMessageHiddenForUserUpsert).toHaveBeenCalledWith({
      where: {
        messageId_userId: {
          messageId: 'message-1',
          userId: 'user-2',
        },
      },
      update: {
        hiddenAt: expect.any(Date),
      },
      create: {
        messageId: 'message-1',
        userId: 'user-2',
      },
    });
    expect(body).toEqual({ messageId: 'message-1', mode: 'hidden' });
  });
});
