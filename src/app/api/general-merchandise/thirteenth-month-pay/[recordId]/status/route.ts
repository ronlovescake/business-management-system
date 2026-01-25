import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const gmPrisma = prisma as unknown as {
  generalMerchandiseThirteenthMonthPayRecord: typeof prisma.thirteenthMonthPayRecord;
};

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

    const { status } = body as { status?: unknown };

    if (typeof status !== 'string') {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const record =
      await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.findFirst({
        where: { recordId },
      });

    if (!record) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    const updateData: Record<string, string> = { status };

    if (status === 'approved' && !record.approvedDate) {
      updateData.approvedDate = new Date().toISOString();
    } else if (status === 'paid' && !record.paidDate) {
      updateData.paidDate = new Date().toISOString();
    }

    const updated =
      await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.update({
        where: { id: record.id },
        data: updateData,
      });

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Failed to update GM 13th month pay status', { error });
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
