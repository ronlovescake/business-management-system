import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

// GET - Get user permissions
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (
      !currentUser ||
      (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const permissions = await prisma.userPermission.findMany({
      where: { userId: params.id },
      include: {
        module: true,
      },
    });

    return NextResponse.json(permissions);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch user permissions' },
      { status: 500 }
    );
  }
}

// POST - Update user permissions
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (
      !currentUser ||
      (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'ADMIN')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { moduleIds } = await request.json();

    if (!Array.isArray(moduleIds)) {
      return NextResponse.json(
        { error: 'moduleIds must be an array' },
        { status: 400 }
      );
    }

    // Remove all existing permissions
    await prisma.userPermission.deleteMany({
      where: { userId: params.id },
    });

    // Create new permissions
    if (moduleIds.length > 0) {
      await prisma.userPermission.createMany({
        data: moduleIds.map((moduleId: string) => ({
          userId: params.id,
          moduleId,
          canAccess: true,
        })),
      });
    }

    const updatedPermissions = await prisma.userPermission.findMany({
      where: { userId: params.id },
      include: {
        module: true,
      },
    });

    return NextResponse.json({
      message: 'Permissions updated successfully',
      permissions: updatedPermissions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user permissions' },
      { status: 500 }
    );
  }
}
