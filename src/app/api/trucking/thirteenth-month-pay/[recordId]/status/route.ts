import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { thirteenthMonthPayService } from '@/modules/trucking/employees/thirteenth-month-pay/api';

/**
 * PATCH /api/trucking/thirteenth-month-pay/[recordId]/status
 *
 * Update the status of a 13th month pay record
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const { recordId } = params;
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid payload for updating status' },
        { status: 400 }
      );
    }

    const { status } = body;

    if (typeof status !== 'string') {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    // Update status using service
    const updated = await thirteenthMonthPayService.updateStatusByRecordId(
      recordId,
      status
    );

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update 13th month pay status', { error });
    return NextResponse.json(
      {
        error: 'Failed to update status',
        details: error instanceof Error ? error.message : String(error),
      },
      {
        status:
          error instanceof Error && error.message.includes('not found')
            ? 404
            : 500,
      }
    );
  }
}
