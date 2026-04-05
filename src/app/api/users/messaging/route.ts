import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/messaging
 * Get all active users for messaging (authenticated users only)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all active users except the current user
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        id: {
          not: session.user.id,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        photoUrl: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    logger.error('Error fetching users for messaging:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
