import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations
 * Get all conversations for the authenticated user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: session.user.id,
          },
        },
        deletedAt: null,
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          where: {
            deletedAt: null,
            hiddenForUsers: {
              none: {
                userId: session.user.id,
              },
            },
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conversation) => {
        const participant = conversation.participants.find(
          (p) => p.userId === session.user.id
        );

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: session.user.id },
            createdAt: {
              gt: participant?.lastReadAt || new Date(0),
            },
            deletedAt: null,
            hiddenForUsers: {
              none: {
                userId: session.user.id,
              },
            },
          },
        });

        return {
          ...conversation,
          unreadCount,
          lastMessage: conversation.messages[0] || null,
        };
      })
    );

    return NextResponse.json(conversationsWithUnread);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/conversations
 * Create a new conversation
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { participantIds, title, isGroup } = body;

    if (!participantIds || !Array.isArray(participantIds)) {
      return NextResponse.json(
        { error: 'participantIds array is required' },
        { status: 400 }
      );
    }

    // Add current user to participants if not already included
    const allParticipantIds = Array.from(
      new Set([...participantIds, session.user.id])
    );

    // For direct messages (2 participants), check if conversation already exists
    if (!isGroup && allParticipantIds.length === 2) {
      const existingConversation = await prisma.conversation.findFirst({
        where: {
          isGroup: false,
          deletedAt: null,
          // Ensure the conversation contains exactly this pair of participants
          participants: {
            every: {
              userId: {
                in: allParticipantIds,
              },
            },
          },
          AND: allParticipantIds.map((userId) => ({
            participants: {
              some: {
                userId,
              },
            },
          })),
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  photoUrl: true,
                },
              },
            },
          },
        },
      });

      if (existingConversation) {
        return NextResponse.json(existingConversation);
      }
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        title: isGroup ? title : null,
        isGroup: isGroup || false,
        participants: {
          create: allParticipantIds.map((userId) => ({
            userId,
            role: userId === session.user.id ? 'admin' : 'member',
          })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                photoUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    logger.error('Error creating conversation:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
