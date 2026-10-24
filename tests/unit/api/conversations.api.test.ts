import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockConversationFindMany,
  mockGetServerSession,
  mockLogger,
  mockMessageCount,
  mockParticipantFindUnique,
  mockMessageFindUnique,
  mockMessageFindFirst,
  mockMessageFindMany,
} = vi.hoisted(() => ({
  mockConversationFindMany: vi.fn(),
  mockGetServerSession: vi.fn(),
  mockLogger: {
    error: vi.fn(),
  },
  mockMessageCount: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
  mockMessageFindUnique: vi.fn(),
  mockMessageFindFirst: vi.fn(),
  mockMessageFindMany: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany,
    },
    message: {
      count: mockMessageCount,
      findUnique: mockMessageFindUnique,
      findFirst: mockMessageFindFirst,
      findMany: mockMessageFindMany,
    },
    conversationParticipant: { findUnique: mockParticipantFindUnique },
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
import { GET as GETMessages } from '@/app/api/conversations/[id]/messages/route';

describe('conversation message pagination', () => {
  const context = { params: { id: 'conversation-1' } };
  const createdAt = new Date('2026-10-25T00:00:00Z');
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockParticipantFindUnique.mockResolvedValue({ userId: 'user-1' });
    mockMessageFindMany.mockResolvedValue([]);
    mockMessageFindUnique.mockResolvedValue({ id: 'cursor', createdAt });
    mockMessageFindFirst.mockResolvedValue({ id: 'cursor', createdAt });
  });

  it.each(['-10', 'not-a-number', '0', '200000', '1.5'])(
    'rejects unsafe page limit %s before reading messages',
    async (limit) => {
      const response = await GETMessages(
        new NextRequest(
          `http://localhost/api/conversations/conversation-1/messages?limit=${limit}`
        ),
        context
      );
      expect(response.status).toBe(400);
      expect(mockMessageFindMany).not.toHaveBeenCalled();
    }
  );

  it('rejects a cursor outside the current visible conversation', async () => {
    mockMessageFindFirst.mockResolvedValue(null);
    const response = await GETMessages(
      new NextRequest(
        'http://localhost/api/conversations/conversation-1/messages?before=foreign'
      ),
      context
    );
    expect(response.status).toBe(404);
    expect(mockMessageFindMany).not.toHaveBeenCalled();
    expect(mockMessageFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'foreign',
          conversationId: 'conversation-1',
          deletedAt: null,
        }),
      })
    );
  });

  it('uses a stable timestamp and ID cursor so equal-time messages are not skipped', async () => {
    const response = await GETMessages(
      new NextRequest(
        'http://localhost/api/conversations/conversation-1/messages?before=cursor'
      ),
      context
    );
    expect(response.status).toBe(200);
    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: 'conversation-1',
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: 'cursor' } },
          ],
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
      })
    );
  });
});

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
