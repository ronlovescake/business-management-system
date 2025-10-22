import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type PersistedStatus = 'pending' | 'calculated' | 'approved' | 'paid';

const isValidStatus = (status: unknown): status is PersistedStatus =>
  status === 'pending' ||
  status === 'calculated' ||
  status === 'approved' ||
  status === 'paid';

const toDecimal = (value: unknown): Prisma.Decimal => {
  if (value instanceof Prisma.Decimal) {
    return value;
  }

  const numeric =
    typeof value === 'string'
      ? Number.parseFloat(value)
      : typeof value === 'number'
        ? value
        : 0;

  if (!Number.isFinite(numeric)) {
    return new Prisma.Decimal(0);
  }

  return new Prisma.Decimal(numeric);
};

const toOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export async function GET() {
  try {
    const records = await prisma.thirteenthMonthPayRecord.findMany({
      orderBy: [{ employeeName: 'asc' }, { year: 'desc' }],
    });

    const formatted = records.map((record) => ({
      id: record.recordId,
      recordId: record.recordId,
      employeeId: record.employeeId,
      employee: record.employeeName,
      year: record.year,
      status: record.status as PersistedStatus,
      totalBasicSalary: Number(record.totalBasicSalary),
      totalLwop: Number(record.totalLwop),
      totalAbsencesLates: Number(record.totalAbsencesLates),
      netBasicSalary: Number(record.netBasicSalary),
      monthsWorked: record.monthsWorked,
      thirteenthMonthPay: Number(record.thirteenthMonthPay),
      notes: record.notes,
      calculatedDate: record.calculatedDate,
      approvedDate: record.approvedDate,
      paidDate: record.paidDate,
      updatedAt: record.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    logger.error('Failed to fetch 13th month pay statuses', error);
    return NextResponse.json(
      { error: 'Failed to load 13th month pay statuses' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid payload for updating 13th month pay record' },
        { status: 400 }
      );
    }

    const {
      id,
      employeeId,
      employee,
      year,
      status,
      totalBasicSalary,
      totalLwop,
      totalAbsencesLates,
      netBasicSalary,
      monthsWorked,
      thirteenthMonthPay,
      notes,
      calculatedDate,
      approvedDate,
      paidDate,
    } = body as Record<string, unknown>;

    if (typeof id !== 'string' || id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Record ID is required' },
        { status: 400 }
      );
    }

    if (typeof employee !== 'string' || employee.trim().length === 0) {
      return NextResponse.json(
        { error: 'Employee name is required' },
        { status: 400 }
      );
    }

    if (!isValidStatus(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      );
    }

    const parsedYear = Number.parseInt(String(year), 10);
    if (!Number.isFinite(parsedYear)) {
      return NextResponse.json(
        { error: 'Year must be a valid number' },
        { status: 400 }
      );
    }

    const safeMonthsWorked = Math.max(1, Math.trunc(toNumber(monthsWorked)));

    const payload = {
      employeeId: toOptionalString(employeeId),
      employeeName: employee.trim(),
      year: parsedYear,
      status,
      totalBasicSalary: toDecimal(totalBasicSalary),
      totalLwop: toDecimal(totalLwop),
      totalAbsencesLates: toDecimal(totalAbsencesLates),
      netBasicSalary: toDecimal(netBasicSalary),
      monthsWorked: safeMonthsWorked,
      thirteenthMonthPay: toDecimal(thirteenthMonthPay),
      notes: toOptionalString(notes),
      calculatedDate: toOptionalString(calculatedDate),
      approvedDate: toOptionalString(approvedDate),
      paidDate: toOptionalString(paidDate),
    };

    const persisted = await prisma.thirteenthMonthPayRecord.upsert({
      where: { recordId: id },
      update: payload,
      create: {
        recordId: id,
        ...payload,
      },
    });

    const result = {
      id: persisted.recordId,
      recordId: persisted.recordId,
      employeeId: persisted.employeeId,
      employee: persisted.employeeName,
      year: persisted.year,
      status: persisted.status as PersistedStatus,
      totalBasicSalary: Number(persisted.totalBasicSalary),
      totalLwop: Number(persisted.totalLwop),
      totalAbsencesLates: Number(persisted.totalAbsencesLates),
      netBasicSalary: Number(persisted.netBasicSalary),
      monthsWorked: persisted.monthsWorked,
      thirteenthMonthPay: Number(persisted.thirteenthMonthPay),
      notes: persisted.notes,
      calculatedDate: persisted.calculatedDate,
      approvedDate: persisted.approvedDate,
      paidDate: persisted.paidDate,
      updatedAt: persisted.updatedAt.toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to persist 13th month pay status', error);
    return NextResponse.json(
      { error: 'Failed to persist 13th month pay status' },
      { status: 500 }
    );
  }
}
