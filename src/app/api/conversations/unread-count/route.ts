import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/conversations/unread-count
 * Get total unread message count for the authenticated user
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all conversations where user is a participant
    const participations = await prisma.conversationParticipant.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        conversationId: true,
        lastReadAt: true,
      },
    });

    // Count unread messages across all conversations
    const unreadCount = await prisma.message.count({
      where: {
        conversationId: {
          in: participations.map((p) => p.conversationId),
        },
        senderId: {
          not: session.user.id,
        },
        deletedAt: null,
        OR: participations.map((p) => ({
          conversationId: p.conversationId,
          createdAt: {
            gt: p.lastReadAt || new Date(0),
          },
        })),
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    logger.error('Error fetching unread count:', error);
    return NextResponse.json(
      { error: 'Failed to fetch unread count' },
      { status: 500 }
    );
  }
}
