import type { AttendanceRecord, AttendanceStatus } from '../types';

type ScheduleSource = {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  date: string;
  startTime: string;
  break1?: string | null;
  lunch?: string | null;
  break2?: string | null;
  endTime: string;
  status: string;
  notes?: string;
};

type ExistingAttendanceSource = {
  employeeId: string;
  date: string;
};

type LeaveRequestSource = {
  employeeId: string;
  status: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
};

const normalizeEmployeeId = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase();

const addMinutesToTime = (time: string, minutesToAdd: number) => {
  if (!time) {
    return undefined;
  }

  const [hourStr, minuteStr] = time.split(':');
  const hours = Number(hourStr);
  const minutes = Number(minuteStr);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return undefined;
  }

  let totalMinutes = hours * 60 + minutes + minutesToAdd;
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;

  const nextHours = Math.floor(totalMinutes / 60);
  const nextMinutes = totalMinutes % 60;

  return `${String(nextHours).padStart(2, '0')}:${String(nextMinutes).padStart(2, '0')}`;
};

const resolveBreakWindow = (
  value: string | null | undefined,
  fallback: string,
  durationMinutes: number
) => {
  const normalized = value?.trim() || '';
  const start = normalized || fallback;
  if (!start) {
    return {
      start: undefined as string | undefined,
      end: undefined as string | undefined,
      minutes: 0,
    };
  }
  const end = addMinutesToTime(start, durationMinutes);
  return {
    start,
    end,
    minutes: end ? durationMinutes : 0,
  };
};

const calculateHours = (
  startTime: string,
  endTime: string,
  breakMinutes = 0
) => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }
  const totalMinutes = endMinutes - startMinutes;
  const workMinutes = totalMinutes - breakMinutes;
  return Math.max(0, workMinutes / 60);
};

const DEFAULT_BREAKS = {
  break1: '09:00',
  lunch: '12:00',
  break2: '15:00',
} as const;

const BREAK_DURATIONS = {
  break1: 15,
  lunch: 60,
  break2: 15,
} as const;

export const prepareAutoRecordAttendance = ({
  allSchedules,
  existingAttendance,
  allLeaveRequests,
  dateRange,
}: {
  allSchedules: ScheduleSource[];
  existingAttendance: ExistingAttendanceSource[];
  allLeaveRequests: LeaveRequestSource[];
  dateRange: string[];
}) => {
  const recentDateSet = new Set(dateRange);
  const todayISO = dateRange[0];
  const oldestDateISO = dateRange[dateRange.length - 1];

  const relevantSchedules = allSchedules.filter(
    (schedule) =>
      recentDateSet.has(schedule.date) && schedule.status !== 'cancelled'
  );

  if (relevantSchedules.length === 0) {
    return {
      kind: 'no-schedules' as const,
      oldestDateISO,
      todayISO,
    };
  }

  const existingAttendanceMap = new Map<string, Set<string>>();
  existingAttendance.forEach((entry) => {
    if (!existingAttendanceMap.has(entry.employeeId)) {
      existingAttendanceMap.set(entry.employeeId, new Set());
    }
    existingAttendanceMap.get(entry.employeeId)?.add(entry.date);
  });

  const schedulesNeedingAttendance = relevantSchedules.filter((schedule) => {
    const employeeDates = existingAttendanceMap.get(schedule.employeeId);
    return !employeeDates || !employeeDates.has(schedule.date);
  });

  if (schedulesNeedingAttendance.length === 0) {
    return {
      kind: 'already-recorded' as const,
      oldestDateISO,
      todayISO,
    };
  }

  const isOnLeave = (employeeId: string, date: string) => {
    return allLeaveRequests.some((request) => {
      const requestId = normalizeEmployeeId(request.employeeId);
      const scheduleId = normalizeEmployeeId(employeeId);
      return (
        requestId === scheduleId &&
        request.status === 'approved' &&
        date >= request.startDate &&
        date <= request.endDate
      );
    });
  };

  const getLeaveInfo = (employeeId: string, date: string) => {
    return allLeaveRequests.find((request) => {
      const requestId = normalizeEmployeeId(request.employeeId);
      const scheduleId = normalizeEmployeeId(employeeId);
      return (
        requestId === scheduleId &&
        request.status === 'approved' &&
        date >= request.startDate &&
        date <= request.endDate
      );
    });
  };

  const newAttendanceRecords: Array<Omit<AttendanceRecord, 'id'>> =
    schedulesNeedingAttendance.map((schedule) => {
      const onLeave = isOnLeave(schedule.employeeId, schedule.date);
      const leaveInfo = getLeaveInfo(schedule.employeeId, schedule.date);

      let status: AttendanceStatus = 'present';
      if (onLeave || schedule.status === 'on-leave') {
        status = 'on-leave';
      }

      const break1Window = resolveBreakWindow(
        schedule.break1,
        DEFAULT_BREAKS.break1,
        BREAK_DURATIONS.break1
      );
      const lunchWindow = resolveBreakWindow(
        schedule.lunch,
        DEFAULT_BREAKS.lunch,
        BREAK_DURATIONS.lunch
      );
      const break2Window = resolveBreakWindow(
        schedule.break2,
        DEFAULT_BREAKS.break2,
        BREAK_DURATIONS.break2
      );

      const totalBreakMinutes = [
        break1Window,
        lunchWindow,
        break2Window,
      ].reduce((sum, window) => sum + window.minutes, 0);

      return {
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        department: schedule.department,
        position: schedule.position,
        date: schedule.date,
        timeIn: schedule.startTime,
        timeOut: schedule.endTime,
        break1Start: break1Window.start,
        break1End: break1Window.end,
        lunchStart: lunchWindow.start,
        lunchEnd: lunchWindow.end,
        break2Start: break2Window.start,
        break2End: break2Window.end,
        totalHours: calculateHours(
          schedule.startTime,
          schedule.endTime,
          totalBreakMinutes
        ),
        status,
        details: leaveInfo ? `On ${leaveInfo.leaveType}` : '',
        notes: leaveInfo
          ? `Leave period: ${leaveInfo.startDate} to ${leaveInfo.endDate}. Reason: ${leaveInfo.reason}`
          : schedule.notes || '',
      };
    });

  return {
    kind: 'ready' as const,
    oldestDateISO,
    todayISO,
    newAttendanceRecords,
  };
};
