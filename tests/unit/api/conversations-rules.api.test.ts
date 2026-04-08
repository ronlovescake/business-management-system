/**
 * Conversations — Creation & Discovery API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/internal-messaging-and-conversations.md:
 *   #2  — User lookup returns active, non-deleted users except self
 *   #3  — User lookup ordered by name
 *   #5  — Soft-deleted conversations excluded from lists
 *   #8  — DM creation is deduplicated (returns existing for same pair)
 *   #9  — Creator is always included in participant set
 *   #10 — Creator gets admin role, others get member
 *   #11 — Title is group-only metadata (null for DMs)
 *   #13 — Message listing supports pagination by before + limit
 *   #14 — Messages returned in chronological order
 *   #15 — Sending requires non-empty trimmed body
 *   #17 — Sending bumps conversation updatedAt in transaction
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// ---- hoisted mocks ----

const {
  mockGetServerSession,
  mockConversationFindMany,
  mockConversationFindFirst,
  mockConversationCreate,
  mockParticipantFindUnique,
  mockMessageFindMany,
  mockMessageFindUnique,
  mockMessageCount,
  mockMessageCreate,
  mockConversationUpdate,
  mockTransaction,
  mockUserFindMany,
} = vi.hoisted(() => ({
  mockGetServerSession: vi.fn(),
  mockConversationFindMany: vi.fn(),
  mockConversationFindFirst: vi.fn(),
  mockConversationCreate: vi.fn(),
  mockParticipantFindUnique: vi.fn(),
  mockMessageFindMany: vi.fn(),
  mockMessageFindUnique: vi.fn(),
  mockMessageCount: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockConversationUpdate: vi.fn(),
  mockTransaction: vi.fn(),
  mockUserFindMany: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}));

vi.mock('@/lib/auth/auth', () => ({ authOptions: {} }));

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: mockConversationFindMany,
      findFirst: mockConversationFindFirst,
      create: mockConversationCreate,
      update: mockConversationUpdate,
    },
    conversationParticipant: {
      findUnique: mockParticipantFindUnique,
    },
    message: {
      findMany: mockMessageFindMany,
      findUnique: mockMessageFindUnique,
      count: mockMessageCount,
      create: mockMessageCreate,
    },
    user: {
      findMany: mockUserFindMany,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const authedSession = { user: { id: 'user-1', name: 'Test User' } };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue(authedSession);
});

// =========================================================================
// Rules #2, #3: User discovery for messaging
// =========================================================================

describe('Rules #2-#3: Messaging user lookup', () => {
  it('Rule #2: returns active, non-deleted users except self', async () => {
    mockUserFindMany.mockResolvedValue([
      { id: 'user-2', name: 'Alice', email: 'a@test.com' },
    ]);

    const { GET } = await import('@/app/api/users/messaging/route');
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    const where = mockUserFindMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
    expect(where.isActive).toBe(true);
    expect(where.id.not).toBe('user-1');
  });

  it('Rule #3: ordered by name ascending', async () => {
    mockUserFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/users/messaging/route');
    await GET();

    expect(mockUserFindMany.mock.calls[0][0].orderBy).toEqual({
      name: 'asc',
    });
  });

  it('returns 401 without session', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import('@/app/api/users/messaging/route');
    const res = await GET();

    expect(res.status).toBe(401);
  });
});

// =========================================================================
// Rules #5, #8, #9, #10, #11: Conversation creation
// =========================================================================

describe('Rules #5,#8-#11: Conversation creation', () => {
  it('Rule #5: GET excludes soft-deleted conversations', async () => {
    mockConversationFindMany.mockResolvedValue([]);

    const { GET } = await import('@/app/api/conversations/route');
    await GET();

    const where = mockConversationFindMany.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
  });

  it('Rule #8: DM creation returns existing conversation for same pair', async () => {
    const existing = {
      id: 'conv-1',
      isGroup: false,
      participants: [
        { userId: 'user-1', user: { id: 'user-1', name: 'Me' } },
        { userId: 'user-2', user: { id: 'user-2', name: 'Other' } },
      ],
    };
    mockConversationFindFirst.mockResolvedValue(existing);

    const { POST } = await import('@/app/api/conversations/route');
    const req = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantIds: ['user-2'],
        isGroup: false,
      }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(json.id).toBe('conv-1');
    expect(mockConversationCreate).not.toHaveBeenCalled();
  });

  it('Rule #9: creator is always included in participant set', async () => {
    mockConversationFindFirst.mockResolvedValue(null);
    mockConversationCreate.mockResolvedValue({
      id: 'new-conv',
      participants: [],
    });

    const { POST } = await import('@/app/api/conversations/route');
    const req = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantIds: ['user-2', 'user-3'],
        isGroup: true,
        title: 'Team Chat',
      }),
    });
    await POST(req);

    const createCall = mockConversationCreate.mock.calls[0][0];
    const createdIds = createCall.data.participants.create.map(
      (p: { userId: string }) => p.userId
    );
    expect(createdIds).toContain('user-1');
  });

  it('Rule #10: creator gets admin, others get member', async () => {
    mockConversationFindFirst.mockResolvedValue(null);
    mockConversationCreate.mockResolvedValue({
      id: 'new-conv',
      participants: [],
    });

    const { POST } = await import('@/app/api/conversations/route');
    const req = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantIds: ['user-2'],
        isGroup: true,
        title: 'Chat',
      }),
    });
    await POST(req);

    const created = mockConversationCreate.mock.calls[0][0].data.participants
      .create as Array<{ userId: string; role: string }>;
    const creatorRole = created.find((p) => p.userId === 'user-1')?.role;
    const otherRole = created.find((p) => p.userId === 'user-2')?.role;

    expect(creatorRole).toBe('admin');
    expect(otherRole).toBe('member');
  });

  it('Rule #11: title is null for DMs, set for groups', async () => {
    mockConversationFindFirst.mockResolvedValue(null);
    mockConversationCreate.mockResolvedValue({
      id: 'dm-conv',
      participants: [],
    });

    const { POST } = await import('@/app/api/conversations/route');
    const req = new NextRequest('http://localhost/api/conversations', {
      method: 'POST',
      body: JSON.stringify({
        participantIds: ['user-2'],
        isGroup: false,
        title: 'Should be ignored for DM',
      }),
    });
    await POST(req);

    const data = mockConversationCreate.mock.calls[0][0].data;
    expect(data.title).toBeNull();
  });
});

// =========================================================================
// Rules #13, #14: Message pagination and ordering
// =========================================================================

describe('Rules #13-#14: Message listing', () => {
  it('Rule #13: supports before cursor + limit pagination', async () => {
    mockParticipantFindUnique.mockResolvedValue({ userId: 'user-1' });
    mockMessageFindUnique.mockResolvedValue({
      createdAt: new Date('2026-04-01'),
    });
    mockMessageFindMany.mockResolvedValue([]);

    const { GET } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages?limit=20&before=msg-99'
    );
    const res = await GET(req, { params: { id: 'conv-1' } });

    expect(res.status).toBe(200);
    const findManyCall = mockMessageFindMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(20);
    expect(findManyCall.where.createdAt).toBeDefined();
  });

  it('Rule #14: returns messages in chronological order (reversed)', async () => {
    mockParticipantFindUnique.mockResolvedValue({ userId: 'user-1' });
    mockMessageFindMany.mockResolvedValue([
      { id: 'msg-2', createdAt: new Date('2026-04-02'), body: 'second' },
      { id: 'msg-1', createdAt: new Date('2026-04-01'), body: 'first' },
    ]);

    const { GET } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages'
    );
    const res = await GET(req, { params: { id: 'conv-1' } });
    const json = await res.json();

    // Messages should be reversed (from desc to asc for chronological)
    expect(json[0].id).toBe('msg-1');
    expect(json[1].id).toBe('msg-2');
  });

  it('Rule #12: returns 403 for non-participants', async () => {
    mockParticipantFindUnique.mockResolvedValue(null);

    const { GET } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages'
    );
    const res = await GET(req, { params: { id: 'conv-1' } });

    expect(res.status).toBe(403);
  });
});

// =========================================================================
// Rules #15, #17: Message sending
// =========================================================================

describe('Rules #15,#17: Message sending', () => {
  it('Rule #15: rejects empty message body', async () => {
    mockParticipantFindUnique.mockResolvedValue({ userId: 'user-1' });

    const { POST } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ body: '   ' }),
      }
    );
    const res = await POST(req, { params: { id: 'conv-1' } });

    expect(res.status).toBe(400);
  });

  it('Rule #15: rejects null/undefined body', async () => {
    const { POST } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const res = await POST(req, { params: { id: 'conv-1' } });

    expect(res.status).toBe(400);
  });

  it('Rule #17: creates message + bumps conversation via $transaction', async () => {
    mockParticipantFindUnique.mockResolvedValue({ userId: 'user-1' });
    const mockMessage = {
      id: 'msg-1',
      body: 'Hello',
      sender: { id: 'user-1', name: 'Test' },
    };
    mockTransaction.mockResolvedValue([mockMessage, {}]);

    const { POST } = await import(
      '@/app/api/conversations/[id]/messages/route'
    );
    const req = new NextRequest(
      'http://localhost/api/conversations/conv-1/messages',
      {
        method: 'POST',
        body: JSON.stringify({ body: 'Hello' }),
      }
    );
    const res = await POST(req, { params: { id: 'conv-1' } });

    expect(res.status).toBe(201);
    expect(mockTransaction).toHaveBeenCalled();
  });
});
