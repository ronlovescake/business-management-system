import type { Attendance } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  getEmployeeAutomationSettings,
  getDefaultEmployeeAutomationSettings,
  type EmployeeAutomationSettings,
} from '@/lib/settings/employeeAutomation';
import { dayjs } from '@/utils/date';
import { logger } from '@/lib/logger';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MINUTES_PER_DAY = 24 * 60;

interface StayInEmployee {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
}

interface ScheduleSnapshot {
  employeeId: string;
  startTime: string | null;
  endTime: string | null;
  department: string | null;
  position: string | null;
}

type SkipReason = 'already-recorded' | 'on-leave' | 'no-schedule';

const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  'already-recorded': 'already recorded',
  'on-leave': 'on approved leave',
  'no-schedule': 'no schedule on file',
};

export interface StayInAutomationResult {
  processed: number;
  inserted: number;
  skipped: number;
  targetDate: string;
  message?: string;
  createdRecords?: Attendance[];
  skippedDetails?: Array<{ employeeId: string; reason: SkipReason }>;
}

const buildResult = (override?: Partial<StayInAutomationResult>) => ({
  processed: 0,
  inserted: 0,
  skipped: 0,
  targetDate: dayjs().format('YYYY-MM-DD'),
  ...override,
});

const parseTimeToMinutes = (
  value: string | null | undefined
): number | null => {
  if (!value || !TIME_PATTERN.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(':').map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return hour * 60 + minute;
};

const normaliseTime = (
  value: string | null | undefined,
  fallback: string
): string => {
  if (value && TIME_PATTERN.test(value)) {
    return value;
  }
  if (TIME_PATTERN.test(fallback)) {
    return fallback;
  }
  return '00:00';
};

const calculateDurationHours = (start: string, end: string): number => {
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);

  if (startMinutes === null || endMinutes === null) {
    return 0;
  }

  const rawDiff =
    endMinutes <= startMinutes
      ? endMinutes + MINUTES_PER_DAY - startMinutes
      : endMinutes - startMinutes;

  return Math.max(0, Math.round((rawDiff / 60) * 100) / 100);
};

const determineTargetDate = (
  timezone: string,
  scheduledTime: string,
  graceMinutes: number
): { date: string; runTimestamp: string } => {
  const now = dayjs().tz(timezone);

  const [hourStr, minuteStr] = scheduledTime.split(':');
  const hour = Number.parseInt(hourStr ?? '0', 10);
  const minute = Number.parseInt(minuteStr ?? '0', 10);

  const scheduled = now
    .clone()
    .hour(Number.isNaN(hour) ? 0 : hour)
    .minute(Number.isNaN(minute) ? 0 : minute)
    .second(0)
    .millisecond(0);

  const graceWindowStart = scheduled.clone().subtract(graceMinutes, 'minute');
  const targetMoment = now.isBefore(graceWindowStart)
    ? scheduled.clone().subtract(1, 'day')
    : scheduled;

  return {
    date: targetMoment.format('YYYY-MM-DD'),
    runTimestamp: now.format('YYYY-MM-DD HH:mm'),
  };
};

const groupSchedulesByEmployee = (snapshots: ScheduleSnapshot[]) =>
  snapshots.reduce<Map<string, ScheduleSnapshot[]>>((acc, snapshot) => {
    const list = acc.get(snapshot.employeeId) ?? [];
    list.push(snapshot);
    acc.set(snapshot.employeeId, list);
    return acc;
  }, new Map());

const buildAttendancePayload = (
  employee: StayInEmployee,
  targetDate: string,
  runTimestamp: string,
  timezone: string,
  defaultTime: string,
  scheduleEntries: ScheduleSnapshot[]
) => {
  const sortedSchedules = [...scheduleEntries].sort((a, b) => {
    const aStart = parseTimeToMinutes(a.startTime);
    const bStart = parseTimeToMinutes(b.startTime);

    if (aStart === null && bStart === null) {
      return 0;
    }
    if (aStart === null) {
      return 1;
    }
    if (bStart === null) {
      return -1;
    }
    return aStart - bStart;
  });

  const firstSchedule = sortedSchedules[0];
  const lastSchedule = sortedSchedules[sortedSchedules.length - 1];

  const timeIn = normaliseTime(firstSchedule?.startTime ?? null, defaultTime);
  const timeOutCandidate = normaliseTime(lastSchedule?.endTime ?? null, timeIn);
  const timeOut = timeOutCandidate || timeIn;
  const totalHours = calculateDurationHours(timeIn, timeOut);

  const department =
    firstSchedule?.department ??
    employee.department ??
    scheduleEntries[0]?.department ??
    '';
  const position =
    firstSchedule?.position ??
    employee.position ??
    scheduleEntries[0]?.position ??
    '';

  return {
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    department,
    position,
    date: targetDate,
    timeIn,
    timeOut,
    break1Start: null,
    break1End: null,
    lunchStart: null,
    lunchEnd: null,
    break2Start: null,
    break2End: null,
    totalHours,
    status: 'present' as const,
    details: 'Auto-recorded stay-in presence entry.',
    notes: `Generated by stay-in automation on ${runTimestamp} (${timezone}).`,
  } satisfies Omit<Attendance, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
};

export async function runStayInAutoPresenceAutomation(options?: {
  settings?: EmployeeAutomationSettings;
  targetDate?: string;
  runTimestamp?: string;
}): Promise<StayInAutomationResult> {
  let settings: EmployeeAutomationSettings;
  if (options?.settings) {
    settings = options.settings;
  } else {
    try {
      settings = await getEmployeeAutomationSettings();
    } catch (error) {
      logger.warn('Failed to get automation settings, using defaults', error);
      settings = getDefaultEmployeeAutomationSettings();
    }
  }

  if (!settings.stayInAutoPresenceEnabled) {
    return buildResult({
      message: 'Automation disabled. No records generated.',
    });
  }

  const timezone = settings.stayInAutoPresenceTimezone || 'Asia/Manila';
  const graceMinutes = Math.max(
    0,
    Math.min(settings.stayInAutoPresenceGraceMinutes ?? 0, 720)
  );
  const targetDate = options?.targetDate;
  const runTimestamp =
    options?.runTimestamp ?? dayjs().tz(timezone).format('YYYY-MM-DD HH:mm');
  const resolvedTargetDate = targetDate
    ? targetDate
    : determineTargetDate(
        timezone,
        settings.stayInAutoPresenceTime,
        graceMinutes
      ).date;

  const stayInEmployees = await prisma.employee.findMany({
    where: {
      deletedAt: null,
      status: 'active',
      employeeType: 'stay-in',
    },
    select: {
      employeeId: true,
      name: true,
      department: true,
      position: true,
    },
  });

  const employees = stayInEmployees
    .filter((employee) => Boolean(employee.employeeId && employee.name))
    .map((employee) => ({
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      position: employee.position,
    })) as StayInEmployee[];

  if (employees.length === 0) {
    return buildResult({
      targetDate,
      message: 'No stay-in employees found to process.',
    });
  }

  const employeeIds = employees.map((employee) => employee.employeeId);

  const [existingAttendance, scheduleSnapshots, approvedLeaves] =
    await Promise.all([
      prisma.attendance.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: resolvedTargetDate,
          deletedAt: null,
        },
        select: { employeeId: true },
      }),
      prisma.schedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: resolvedTargetDate,
          deletedAt: null,
          status: { notIn: ['cancelled', 'on-leave'] },
        },
        select: {
          employeeId: true,
          startTime: true,
          endTime: true,
          department: true,
          position: true,
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'approved',
          startDate: { lte: resolvedTargetDate },
          endDate: { gte: resolvedTargetDate },
        },
        select: { employeeId: true },
      }),
    ]);

  const existingAttendanceSet = new Set(
    existingAttendance.map((record) => record.employeeId)
  );
  const schedulesByEmployee = groupSchedulesByEmployee(scheduleSnapshots);
  const onLeaveSet = new Set(approvedLeaves.map((leave) => leave.employeeId));

  const skippedDetails: Array<{ employeeId: string; reason: SkipReason }> = [];
  const recordsToCreate: Array<ReturnType<typeof buildAttendancePayload>> = [];

  for (const employee of employees) {
    if (existingAttendanceSet.has(employee.employeeId)) {
      skippedDetails.push({
        employeeId: employee.employeeId,
        reason: 'already-recorded',
      });
      continue;
    }

    if (onLeaveSet.has(employee.employeeId)) {
      skippedDetails.push({
        employeeId: employee.employeeId,
        reason: 'on-leave',
      });
      continue;
    }

    const employeeSchedules =
      schedulesByEmployee.get(employee.employeeId) ?? [];

    if (employeeSchedules.length === 0) {
      skippedDetails.push({
        employeeId: employee.employeeId,
        reason: 'no-schedule',
      });
      continue;
    }

    const payload = buildAttendancePayload(
      employee,
      resolvedTargetDate,
      runTimestamp,
      timezone,
      settings.stayInAutoPresenceTime,
      employeeSchedules
    );

    recordsToCreate.push(payload);
  }

  const createdRecords = recordsToCreate.length
    ? await prisma.$transaction(
        recordsToCreate.map((data) =>
          prisma.attendance.create({
            data,
          })
        )
      )
    : [];

  const processed = employees.length;
  const inserted = createdRecords.length;
  const skipped = processed - inserted;

  const summaryParts = [`${inserted} recorded`, `${skipped} skipped`];

  const skippedSummary = skippedDetails.length
    ? (() => {
        const counts = skippedDetails.reduce<Map<SkipReason, number>>(
          (acc, detail) =>
            acc.set(detail.reason, (acc.get(detail.reason) ?? 0) + 1),
          new Map()
        );

        return Array.from(counts.entries())
          .map(([reason, count]) => `${count} ${SKIP_REASON_LABEL[reason]}`)
          .join(', ');
      })()
    : '';

  const message =
    inserted > 0
      ? `Auto-recorded stay-in attendance for ${resolvedTargetDate}: ${summaryParts.join(', ')}.${skippedSummary ? ` Skipped reasons: ${skippedSummary}.` : ''}`
      : `No attendance entries created for ${resolvedTargetDate}. ${skipped} employee(s) skipped.${skippedSummary ? ` Reasons: ${skippedSummary}.` : ''}`;

  return {
    processed,
    inserted,
    skipped,
    targetDate: resolvedTargetDate,
    message,
    createdRecords,
    skippedDetails,
  };
}
