import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

function parseString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function getLeaveRequestClient() {
  return prisma.generalMerchandiseLeaveRequest;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const id = parseString(params.id);
    if (!id) {
      return NextResponse.json(
        { error: 'Leave request ID is required' },
        { status: 400 }
      );
    }

    const leaveRequestClient = getLeaveRequestClient();
    const numericId = parseInt(id, 10);
    const leaveRequest = await leaveRequestClient.findFirst({
      where: { id: numericId, deletedAt: null },
    });

    if (!leaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...leaveRequest,
      id: String(leaveRequest.id),
    });
  } catch (error) {
    logger.error('Failed to fetch GM leave request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave request' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const id = parseString(params.id);
    if (!id) {
      return NextResponse.json(
        { error: 'Leave request ID is required' },
        { status: 400 }
      );
    }

    const leaveRequestClient = getLeaveRequestClient();
    const numericId = parseInt(id, 10);
    const existingLeaveRequest = await leaveRequestClient.findFirst({
      where: { id: numericId, deletedAt: null },
    });

    if (!existingLeaveRequest) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    await leaveRequestClient.update({
      where: { id: numericId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({
      message: 'Leave request deleted successfully',
      id,
    });
  } catch (error) {
    logger.error('Failed to delete GM leave request:', error);

    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Leave request not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete leave request' },
      { status: 500 }
    );
  }
}
