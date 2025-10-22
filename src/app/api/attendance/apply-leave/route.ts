import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { dayjs, DATE_STORAGE_FORMAT } from '@/utils/date';

interface ApplyLeavePayload {
  employeeId?: string;
  employeeName?: string;
  leaveType?: string;
  startDate?: string;
  endDate?: string;
}

const normaliseEmployeeId = (value?: string) => (value ? value.trim() : '');

const toStorageDate = (value?: string) => {
  if (!value) {
    return '';
  }

  const parsed = dayjs(value).tz();
  return parsed.isValid() ? parsed.format(DATE_STORAGE_FORMAT) : '';
};

const enumerateDateRange = (start: string, end: string): string[] => {
  const startDate = dayjs(start).tz();
  const endDate = dayjs(end).tz();

  if (!startDate.isValid() || !endDate.isValid()) {
    return [];
  }

  const [minDate, maxDate] = startDate.isAfter(endDate)
    ? [endDate.startOf('day'), startDate.startOf('day')]
    : [startDate.startOf('day'), endDate.startOf('day')];

  const dates: string[] = [];
  let cursor = minDate.clone();

  while (!cursor.isAfter(maxDate, 'day')) {
    dates.push(cursor.format(DATE_STORAGE_FORMAT));
    cursor = cursor.add(1, 'day');
  }

  return dates;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ApplyLeavePayload;

    const employeeIdRaw = normaliseEmployeeId(body.employeeId);
    const startDateStorage = toStorageDate(body.startDate);
    const endDateStorage = toStorageDate(body.endDate);

    if (!employeeIdRaw) {
      return NextResponse.json(
        { error: 'Employee ID is required' },
        { status: 400 }
      );
    }

    if (!startDateStorage || !endDateStorage) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const dateRange = enumerateDateRange(startDateStorage, endDateStorage);

    if (dateRange.length === 0) {
      return NextResponse.json(
        { error: 'Date range is invalid' },
        { status: 400 }
      );
    }

    const [employeeRecord, existingAttendance] = await Promise.all([
      prisma.employee.findFirst({
        where: {
          employeeId: employeeIdRaw,
          deletedAt: null,
        },
      }),
      prisma.attendance.findMany({
        where: {
          employeeId: employeeIdRaw,
          date: { in: dateRange },
          deletedAt: null,
        },
        select: { id: true, date: true },
      }),
    ]);

    const displayName =
      body.employeeName?.trim() ||
      employeeRecord?.name ||
      `${employeeRecord?.firstName ?? ''} ${employeeRecord?.lastName ?? ''}`.trim() ||
      employeeIdRaw;

    const department = employeeRecord?.department || 'N/A';
    const position = employeeRecord?.position || 'N/A';

    const leaveLabel = body.leaveType ? `On ${body.leaveType}` : 'On Leave';

    const existingDates = new Set(existingAttendance.map((item) => item.date));

    let updatedCount = 0;

    if (existingDates.size > 0) {
      const updateResult = await prisma.attendance.updateMany({
        where: {
          employeeId: employeeIdRaw,
          date: { in: Array.from(existingDates) },
          deletedAt: null,
        },
        data: {
          status: 'on-leave',
          timeIn: '00:00',
          timeOut: '00:00',
          break1Start: null,
          break1End: null,
          lunchStart: null,
          lunchEnd: null,
          break2Start: null,
          break2End: null,
          totalHours: 0,
          details: leaveLabel,
        },
      });

      updatedCount = updateResult.count;
    }

    const missingDates = dateRange.filter((date) => !existingDates.has(date));
    let createdCount = 0;

    if (missingDates.length > 0) {
      const createResult = await prisma.attendance.createMany({
        data: missingDates.map((date) => ({
          employeeId: employeeIdRaw,
          employeeName: displayName,
          department,
          position,
          date,
          timeIn: '00:00',
          timeOut: '00:00',
          break1Start: null,
          break1End: null,
          lunchStart: null,
          lunchEnd: null,
          break2Start: null,
          break2End: null,
          totalHours: 0,
          status: 'on-leave',
          details: leaveLabel,
          notes: null,
        })),
      });

      createdCount = createResult.count;
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      createdCount,
      totalAffected: updatedCount + createdCount,
    });
  } catch (error) {
    logger.error('Failed to apply leave to attendance:', error);
    return NextResponse.json(
      {
        error: 'Failed to apply leave to attendance records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
