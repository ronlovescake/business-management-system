import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

const gmPrisma = prisma as unknown as {
  generalMerchandiseThirteenthMonthPayRecord: typeof prisma.thirteenthMonthPayRecord;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const employeeIdParam = searchParams.get('employeeId');
    const yearParam = searchParams.get('year');
    const statusParam = searchParams.get('status');

    const where: Record<string, unknown> = {};

    if (employeeIdParam) {
      where.employeeId = sanitizers.name(employeeIdParam);
    }

    if (yearParam) {
      const year = sanitizers.number(yearParam, { min: 2000, max: 2100 });
      if (year !== null) {
        where.year = year;
      }
    }

    if (statusParam) {
      where.status = sanitizers.name(statusParam);
    }

    const records =
      await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
      });

    return NextResponse.json(records);
  } catch (error) {
    logger.error('Failed to fetch GM 13th month pay records', { error });
    return NextResponse.json(
      {
        error: 'Failed to load 13th month pay records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const { id: recordId, ...data } = body as Record<string, unknown>;

    if (typeof recordId !== 'string' || recordId.trim().length === 0) {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    const existing =
      await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.findFirst({
        where: { recordId },
      });

    let result;
    if (existing) {
      result = await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.update(
        {
          where: { id: existing.id },
          data,
        }
      );
    } else {
      result = await gmPrisma.generalMerchandiseThirteenthMonthPayRecord.create(
        {
          data: {
            recordId,
            ...data,
          } as Prisma.ThirteenthMonthPayRecordCreateInput,
        }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to persist GM 13th month pay record', { error });
    return NextResponse.json(
      {
        error: 'Failed to persist record',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
