import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

interface LeaveRequestRecord {
  id: number;
}

interface LeaveRequestDelegate {
  findUnique(args: {
    where: { id: number };
  }): Promise<LeaveRequestRecord | null>;
  delete(args: { where: { id: number } }): Promise<LeaveRequestRecord>;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseLeaveRequest: LeaveRequestDelegate;
};

function parseString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function getLeaveRequestClient(): LeaveRequestDelegate {
  return gmPrisma.generalMerchandiseLeaveRequest;
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
    const leaveRequest = await leaveRequestClient.findUnique({
      where: { id: parseInt(id, 10) },
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
    await leaveRequestClient.delete({ where: { id: parseInt(id, 10) } });

    return NextResponse.json({
      message: 'Leave request deleted successfully',
      id,
    });
  } catch (error) {
    logger.error('Failed to delete GM leave request:', error);
    return NextResponse.json(
      { error: 'Failed to delete leave request' },
      { status: 500 }
    );
  }
}
