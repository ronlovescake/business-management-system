import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockConversationFindMany,
  mockGetServerSession,
  mockLogger,
  mockMessageCount,
} = vi.hoisted(() => ({
  mockConversationFindMany: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockLogger: {
    error: vi.fn(),
  },
  mockMessageCount: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany,
    },
    message: {
      count: mockMessageCount,
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

import { GET } from '@/app/api/conversations/route';

describe('conversations API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns conversations with unreadCount and a full lastMessage sender payload', async () => {
    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'user-1',
      },
    });
    mockConversationFindMany.mockResolvedValue([
      {
        id: 'conversation-1',
        title: null,
        isGroup: false,
        createdAt: new Date('2026-04-06T01:00:00.000Z'),
        updatedAt: new Date('2026-04-06T02:00:00.000Z'),
        deletedAt: null,
        participants: [
          {
            id: 'participant-1',
            userId: 'user-1',
            joinedAt: new Date('2026-04-06T01:00:00.000Z'),
            lastReadAt: new Date('2026-04-06T01:30:00.000Z'),
            role: 'admin',
            user: {
              id: 'user-1',
              name: 'Ron',
              email: 'ron@example.com',
              photoUrl: 'ron.png',
            },
          },
          {
            id: 'participant-2',
            userId: 'user-2',
            joinedAt: new Date('2026-04-06T01:00:00.000Z'),
            lastReadAt: null,
            role: 'member',
            user: {
              id: 'user-2',
              name: 'Czar',
              email: 'czar@example.com',
              photoUrl: 'czar.png',
            },
          },
        ],
        messages: [
          {
            id: 'message-1',
            conversationId: 'conversation-1',
            senderId: 'user-2',
            body: 'hello',
            messageType: 'text',
            attachmentUrl: null,
            isEdited: false,
            createdAt: new Date('2026-04-06T01:45:00.000Z'),
            updatedAt: new Date('2026-04-06T01:45:00.000Z'),
            sender: {
              id: 'user-2',
              name: 'Czar',
              email: 'czar@example.com',
              photoUrl: 'czar.png',
            },
          },
        ],
      },
    ]);
    mockMessageCount.mockResolvedValue(3);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].unreadCount).toBe(3);
    expect(body[0].lastMessage.sender).toEqual({
      id: 'user-2',
      name: 'Czar',
      email: 'czar@example.com',
      photoUrl: 'czar.png',
    });
    expect(mockConversationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          messages: expect.objectContaining({
            where: expect.objectContaining({
              hiddenForUsers: {
                none: {
                  userId: 'user-1',
                },
              },
            }),
          }),
        }),
      })
    );
    expect(mockMessageCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          hiddenForUsers: {
            none: {
              userId: 'user-1',
            },
          },
        }),
      })
    );
  });

  it('returns 401 when no session user exists', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });
});
