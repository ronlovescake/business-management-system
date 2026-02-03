import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';

/**
 * POST /api/conversations/[id]/read
 * Mark conversation as read for the authenticated user
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversationId = params.id;

    // Update lastReadAt timestamp
    await prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId: session.user.id,
        },
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Error marking conversation as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
