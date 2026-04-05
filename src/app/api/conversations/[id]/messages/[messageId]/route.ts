import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/conversations/[id]/messages/[messageId]
 * Sender: hard delete for everyone.
 * Receiver: delete only on the current user's end.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;
    const messageId = params.messageId;

    const participant = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deletedAt: null,
      },
      select: {
        id: true,
        senderId: true,
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.senderId === session.user.id) {
      await prisma.message.delete({
        where: {
          id: message.id,
        },
      });

      return NextResponse.json({
        messageId: message.id,
        mode: 'hard-delete',
      });
    }

    await prisma.messageHiddenForUser.upsert({
      where: {
        messageId_userId: {
          messageId: message.id,
          userId: session.user.id,
        },
      },
      update: {
        hiddenAt: new Date(),
      },
      create: {
        messageId: message.id,
        userId: session.user.id,
      },
    });

    return NextResponse.json({
      messageId: message.id,
      mode: 'hidden',
    });
  } catch (error) {
    logger.error('Error deleting message:', error);
    return NextResponse.json(
      { error: 'Failed to delete message' },
      { status: 500 }
    );
  }
}
