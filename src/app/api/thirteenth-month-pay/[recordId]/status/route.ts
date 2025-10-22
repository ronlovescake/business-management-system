import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type PersistedStatus = 'pending' | 'calculated' | 'approved' | 'paid';

const isValidStatus = (status: unknown): status is PersistedStatus =>
  status === 'pending' ||
  status === 'calculated' ||
  status === 'approved' ||
  status === 'paid';

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
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

    const { status, paidDate } = body as Record<string, unknown>;

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    // Check if record exists
    // @ts-expect-error - Prisma client type not yet updated
    const existing = await prisma.thirteenthMonthPayRecord.findUnique({
      where: { recordId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }

    // Update only the status and paidDate
    // @ts-expect-error - Prisma client type not yet updated
    const updated = await prisma.thirteenthMonthPayRecord.update({
      where: { recordId },
      data: {
        status,
        paidDate: toOptionalString(paidDate),
      },
    });

    const result = {
      id: updated.recordId,
      recordId: updated.recordId,
      employeeId: updated.employeeId,
      employee: updated.employeeName,
      year: updated.year,
      status: updated.status as PersistedStatus,
      totalBasicSalary: Number(updated.totalBasicSalary),
      totalLwop: Number(updated.totalLwop),
      totalAbsencesLates: Number(updated.totalAbsencesLates),
      netBasicSalary: Number(updated.netBasicSalary),
      monthsWorked: updated.monthsWorked,
      thirteenthMonthPay: Number(updated.thirteenthMonthPay),
      notes: updated.notes,
      calculatedDate: updated.calculatedDate,
      approvedDate: updated.approvedDate,
      paidDate: updated.paidDate,
      updatedAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to update 13th month pay status', error);
    return NextResponse.json(
      { error: 'Failed to update 13th month pay status' },
      { status: 500 }
    );
  }
}
