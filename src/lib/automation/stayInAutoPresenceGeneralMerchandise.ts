import { prisma } from '@/lib/db';
import {
  getGeneralMerchandiseEmployeeAutomationSettings,
  getDefaultGeneralMerchandiseEmployeeAutomationSettings,
  type GeneralMerchandiseEmployeeAutomationSettings,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
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

type GeneralMerchandiseAttendanceRecord = Record<string, unknown>;

export interface GeneralMerchandiseStayInAutomationResult {
  processed: number;
  inserted: number;
  skipped: number;
  targetDate: string;
  message?: string;
  createdRecords?: GeneralMerchandiseAttendanceRecord[];
  skippedDetails?: Array<{ employeeId: string; reason: SkipReason }>;
}

type GMStayInAutomationClient = Pick<
  typeof prisma,
  | 'generalMerchandiseAttendance'
  | 'generalMerchandiseEmployee'
  | 'generalMerchandiseSchedule'
  | 'generalMerchandiseLeaveRequest'
>;

const gmClient: GMStayInAutomationClient = prisma;

const buildResult = (
  override?: Partial<GeneralMerchandiseStayInAutomationResult>
) => ({
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
  } satisfies Omit<
    GeneralMerchandiseAttendanceRecord,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  >;
};

export async function runGeneralMerchandiseStayInAutoPresenceAutomation(options?: {
  settings?: GeneralMerchandiseEmployeeAutomationSettings;
  targetDate?: string;
  runTimestamp?: string;
}): Promise<GeneralMerchandiseStayInAutomationResult> {
  let settings: GeneralMerchandiseEmployeeAutomationSettings;
  if (options?.settings) {
    settings = options.settings;
  } else {
    try {
      settings = await getGeneralMerchandiseEmployeeAutomationSettings();
    } catch (error) {
      logger.warn('Failed to get automation settings, using defaults', error);
      settings = getDefaultGeneralMerchandiseEmployeeAutomationSettings();
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

  const stayInEmployees = await gmClient.generalMerchandiseEmployee.findMany({
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
      targetDate: resolvedTargetDate,
      message: 'No stay-in employees found to process.',
    });
  }

  const employeeIds = employees.map((employee) => employee.employeeId);

  const [existingAttendance, scheduleSnapshots, approvedLeaves] =
    await Promise.all([
      gmClient.generalMerchandiseAttendance.findMany({
        where: {
          deletedAt: null,
          date: resolvedTargetDate,
          employeeId: { in: employeeIds },
        },
        select: { employeeId: true },
      }),
      gmClient.generalMerchandiseSchedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          date: resolvedTargetDate,
          deletedAt: null,
        },
        select: {
          employeeId: true,
          startTime: true,
          endTime: true,
          department: true,
          position: true,
        },
      }),
      gmClient.generalMerchandiseLeaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          status: 'approved',
          startDate: { lte: resolvedTargetDate },
          endDate: { gte: resolvedTargetDate },
        },
        select: { employeeId: true },
      }),
    ]);

  const scheduleIndex = groupSchedulesByEmployee(scheduleSnapshots);
  const attendanceIndex = new Set(
    existingAttendance.map((record) => record.employeeId)
  );
  const leaveIndex = new Set(approvedLeaves.map((leave) => leave.employeeId));

  const skippedDetails: Array<{ employeeId: string; reason: SkipReason }> = [];
  const createdRecords: GeneralMerchandiseAttendanceRecord[] = [];

  for (const employee of employees) {
    if (attendanceIndex.has(employee.employeeId)) {
      skippedDetails.push({
        employeeId: employee.employeeId,
        reason: 'already-recorded',
      });
      continue;
    }

    if (leaveIndex.has(employee.employeeId)) {
      skippedDetails.push({
        employeeId: employee.employeeId,
        reason: 'on-leave',
      });
      continue;
    }

    const scheduleEntries = scheduleIndex.get(employee.employeeId) ?? [];
    if (scheduleEntries.length === 0) {
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
      scheduleEntries
    );

    const created = await gmClient.generalMerchandiseAttendance.create({
      data: payload,
    });

    createdRecords.push(created as GeneralMerchandiseAttendanceRecord);
  }

  const skipped = skippedDetails.length;
  const inserted = createdRecords.length;
  const processed = employees.length;

  const messageParts = [
    `Processed ${processed} stay-in employees`,
    `inserted ${inserted} attendance record(s)`,
    `skipped ${skipped}`,
  ];

  return buildResult({
    processed,
    inserted,
    skipped,
    targetDate: resolvedTargetDate,
    createdRecords,
    skippedDetails,
    message: messageParts.join(', '),
  });
}

export function formatGeneralMerchandiseAutomationSummary(
  skippedDetails: Array<{ employeeId: string; reason: SkipReason }> = []
): Record<string, number> {
  return skippedDetails.reduce<Record<string, number>>((acc, entry) => {
    const key = SKIP_REASON_LABEL[entry.reason];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
