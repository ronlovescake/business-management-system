import { NextResponse, type NextRequest } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { sanitizers } from '@/lib/security/sanitize';
import { dayjs, DATE_STORAGE_FORMAT } from '@/utils/date';

interface ApplyLeavePayload {
  employeeId?: unknown;
  employeeName?: unknown;
  leaveType?: unknown;
  startDate?: unknown;
  endDate?: unknown;
}

type EmployeeRecordLike = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  department?: string | null;
  position?: string | null;
};

type ExistingAttendanceRecord = {
  id: string | number;
  date: string;
};

type ApplyLeaveAttendanceRecord = {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  date: string;
  timeIn: '00:00';
  timeOut: '00:00';
  break1Start: null;
  break1End: null;
  lunchStart: null;
  lunchEnd: null;
  break2Start: null;
  break2End: null;
  totalHours: 0;
  status: 'on-leave';
  details: string;
  notes: null;
};

type ApplyLeaveUpdateData = Omit<
  ApplyLeaveAttendanceRecord,
  'employeeId' | 'employeeName' | 'department' | 'position' | 'date' | 'notes'
>;

interface ApplyLeaveRouteConfig<TEmployee extends EmployeeRecordLike> {
  employeeModel: {
    findFirst: (args: {
      where: { employeeId: string; deletedAt: null };
    }) => Promise<TEmployee | null>;
  };
  attendanceModel: {
    findMany: (args: {
      where: {
        employeeId: string;
        date: { in: string[] };
        deletedAt: null;
      };
      select: { id: true; date: true };
    }) => Promise<ExistingAttendanceRecord[]>;
    updateMany: (args: {
      where: {
        employeeId: string;
        date: { in: string[] };
        deletedAt: null;
      };
      data: ApplyLeaveUpdateData;
    }) => Promise<{ count: number }>;
    createMany: (args: {
      data: ApplyLeaveAttendanceRecord[];
    }) => Promise<{ count: number }>;
  };
}

function normalizeEmployeeId(value: unknown) {
  return typeof value === 'string' && value ? sanitizers.name(value) || '' : '';
}

function normalizeTrimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toStorageDate(value: unknown) {
  if (typeof value !== 'string' || !value) {
    return '';
  }

  const sanitized = sanitizers.date(value);
  const parsed = dayjs(sanitized).tz();
  return parsed.isValid() ? parsed.format(DATE_STORAGE_FORMAT) : '';
}

function enumerateDateRange(start: string, end: string): string[] {
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
}

function buildDisplayName(
  payloadEmployeeName: unknown,
  employeeRecord: EmployeeRecordLike | null,
  employeeId: string
) {
  const payloadName = normalizeTrimmedString(payloadEmployeeName);
  if (payloadName) {
    return payloadName;
  }

  if (employeeRecord?.name?.trim()) {
    return employeeRecord.name.trim();
  }

  const firstName = employeeRecord?.firstName?.trim() ?? '';
  const lastName = employeeRecord?.lastName?.trim() ?? '';
  const fullName = `${firstName} ${lastName}`.trim();

  return fullName || employeeId;
}

function buildLeaveLabel(value: unknown) {
  const leaveType = normalizeTrimmedString(value);
  return leaveType ? `On ${leaveType}` : 'On Leave';
}

function toApplyLeaveErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      error: 'Failed to apply leave to attendance records',
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

export function createAttendanceApplyLeaveRoute<
  TEmployee extends EmployeeRecordLike,
>(config: ApplyLeaveRouteConfig<TEmployee>) {
  const POST = withErrorHandler(
    async (request: NextRequest) => {
      const body = (await request.json()) as ApplyLeavePayload;

      const employeeId = normalizeEmployeeId(body.employeeId);
      const startDateStorage = toStorageDate(body.startDate);
      const endDateStorage = toStorageDate(body.endDate);

      if (!employeeId) {
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

      const today = dayjs().tz().format(DATE_STORAGE_FORMAT);
      const dateRangeUpToToday = dateRange.filter((date) => date <= today);

      if (dateRangeUpToToday.length === 0) {
        return NextResponse.json({
          success: true,
          updatedCount: 0,
          createdCount: 0,
          totalAffected: 0,
          message:
            'Leave request is for future dates only. No attendance records created yet.',
        });
      }

      const [employeeRecord, existingAttendance] = await Promise.all([
        config.employeeModel.findFirst({
          where: {
            employeeId,
            deletedAt: null,
          },
        }),
        config.attendanceModel.findMany({
          where: {
            employeeId,
            date: { in: dateRangeUpToToday },
            deletedAt: null,
          },
          select: { id: true, date: true },
        }),
      ]);

      const leaveLabel = buildLeaveLabel(body.leaveType);
      const displayName = buildDisplayName(
        body.employeeName,
        employeeRecord,
        employeeId
      );
      const department = employeeRecord?.department?.trim() || 'N/A';
      const position = employeeRecord?.position?.trim() || 'N/A';

      const existingDates = new Set(
        existingAttendance.map((item) => item.date)
      );
      let updatedCount = 0;

      if (existingDates.size > 0) {
        const updateResult = await config.attendanceModel.updateMany({
          where: {
            employeeId,
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

      const missingDates = dateRangeUpToToday.filter(
        (date) => !existingDates.has(date)
      );
      let createdCount = 0;

      if (missingDates.length > 0) {
        const createResult = await config.attendanceModel.createMany({
          data: missingDates.map((date) => ({
            employeeId,
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
    },
    {
      onError: (error) => toApplyLeaveErrorResponse(error),
    }
  );

  return { POST };
}
