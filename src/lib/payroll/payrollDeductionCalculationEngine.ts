type PayrollPeriodRange = {
  start: Date | null;
  end: Date | null;
};

type LeaveRange = {
  startDate: string;
  endDate: string;
};

type EntryWithLeaves = {
  leaves: LeaveRange[];
};

type ScheduleRecordLike = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
};

type AttendanceRecordLike = {
  date: string;
  timeIn: string;
  timeOut: string;
  status: string;
};

type PayrollWithEmployee = {
  employeeId: string;
};

type RoundToCents = (value: number) => number;

export const calculateLwopDeductionEngine = <
  TPayroll extends PayrollWithEmployee,
  TEntry extends EntryWithLeaves,
  TSchedule extends ScheduleRecordLike,
>(params: {
  payroll: TPayroll;
  entry: TEntry | undefined;
  schedules?: TSchedule[];
  getPayrollPeriodRange: (payroll: TPayroll) => PayrollPeriodRange;
  getEffectiveMonthlySalary: (
    payroll: TPayroll,
    entry: TEntry | undefined
  ) => number;
  parseDate: (dateText: string) => Date | null;
  getOverlapScheduledDays: (
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    leaveStart: Date,
    leaveEnd: Date,
    schedules: TSchedule[]
  ) => number;
  roundToCents: RoundToCents;
}) => {
  const {
    payroll,
    entry,
    schedules = [],
    getPayrollPeriodRange,
    getEffectiveMonthlySalary,
    parseDate,
    getOverlapScheduledDays,
    roundToCents,
  } = params;

  const { start: periodStart, end: periodEnd } = getPayrollPeriodRange(payroll);

  if (!periodStart || !periodEnd || !entry) {
    return { unpaidDays: 0, dailyRate: 0, deduction: 0 };
  }

  const effectiveMonthlySalary = getEffectiveMonthlySalary(payroll, entry);
  if (effectiveMonthlySalary <= 0) {
    return { unpaidDays: 0, dailyRate: 0, deduction: 0 };
  }

  const dailyRate = roundToCents(effectiveMonthlySalary / 26);

  if (entry.leaves.length === 0) {
    return { unpaidDays: 0, dailyRate, deduction: 0 };
  }

  const unpaidDays = entry.leaves.reduce((total, leave) => {
    const leaveStart = parseDate(leave.startDate);
    const leaveEnd = parseDate(leave.endDate);

    if (!leaveStart || !leaveEnd) {
      return total;
    }

    return (
      total +
      getOverlapScheduledDays(
        payroll.employeeId,
        periodStart,
        periodEnd,
        leaveStart,
        leaveEnd,
        schedules
      )
    );
  }, 0);

  const deduction = unpaidDays > 0 ? roundToCents(dailyRate * unpaidDays) : 0;

  return { unpaidDays, dailyRate, deduction };
};

export const calculateAttendanceDeductionEngine = <
  TPayroll,
  TEntry,
  TAttendance extends AttendanceRecordLike,
  TSchedule extends ScheduleRecordLike,
>(params: {
  payroll: TPayroll;
  entry: TEntry | undefined;
  attendanceRecords?: TAttendance[];
  scheduleRecords?: TSchedule[];
  getPayrollPeriodRange: (payroll: TPayroll) => PayrollPeriodRange;
  getEffectiveMonthlySalary: (
    payroll: TPayroll,
    entry: TEntry | undefined
  ) => number;
  parseDate: (dateText: string) => Date | null;
  parseTimeToMinutes: (timeText: string | undefined | null) => number | null;
  roundToCents: RoundToCents;
  toDateOnlyUtc: (date: Date) => Date;
  minutesPerDay: number;
  defaultShiftStart: string;
  defaultShiftEnd: string;
  exemptStatuses?: Set<string>;
}) => {
  const {
    payroll,
    entry,
    attendanceRecords = [],
    scheduleRecords = [],
    getPayrollPeriodRange,
    getEffectiveMonthlySalary,
    parseDate,
    parseTimeToMinutes,
    roundToCents,
    toDateOnlyUtc,
    minutesPerDay,
    defaultShiftStart,
    defaultShiftEnd,
    exemptStatuses = new Set(['on-leave']),
  } = params;

  const { start: periodStart, end: periodEnd } = getPayrollPeriodRange(payroll);
  if (!periodStart || !periodEnd) {
    return { absentDays: 0, lateMinutes: 0, undertimeMinutes: 0, deduction: 0 };
  }

  const effectiveMonthlySalary = getEffectiveMonthlySalary(payroll, entry);
  if (effectiveMonthlySalary <= 0) {
    return { absentDays: 0, lateMinutes: 0, undertimeMinutes: 0, deduction: 0 };
  }

  const dailyRate = roundToCents(effectiveMonthlySalary / 26);
  const ratePerMinute = dailyRate / minutesPerDay;

  const isWithinPeriod = (dateText: string) => {
    const parsedDate = parseDate(dateText);
    if (!parsedDate) {
      return false;
    }
    return parsedDate >= periodStart && parsedDate <= periodEnd;
  };

  const attendanceInPeriod = attendanceRecords.filter((record) =>
    isWithinPeriod(record.date)
  );
  const schedulesInPeriod = scheduleRecords.filter((record) =>
    isWithinPeriod(record.date)
  );

  const attendanceByDate = attendanceInPeriod.reduce<
    Map<string, TAttendance[]>
  >((acc, record) => {
    const list = acc.get(record.date) ?? [];
    list.push(record);
    acc.set(record.date, list);
    return acc;
  }, new Map());

  const scheduleByDate = schedulesInPeriod.reduce<Map<string, TSchedule[]>>(
    (acc, record) => {
      const list = acc.get(record.date) ?? [];
      list.push(record);
      acc.set(record.date, list);
      return acc;
    },
    new Map()
  );

  const absenceDates = new Set<string>();
  const today = toDateOnlyUtc(new Date());

  for (const schedule of schedulesInPeriod) {
    const scheduleDate = parseDate(schedule.date);
    if (!scheduleDate || scheduleDate > today) {
      continue;
    }

    const dayAttendance = attendanceByDate.get(schedule.date);
    if (!dayAttendance || dayAttendance.length === 0) {
      absenceDates.add(schedule.date);
      continue;
    }

    const hasNonAbsentRecord = dayAttendance.some(
      (record) => record.status !== 'absent'
    );
    if (!hasNonAbsentRecord) {
      absenceDates.add(schedule.date);
    }
  }

  for (const record of attendanceInPeriod) {
    const recordDate = parseDate(record.date);
    if (record.status === 'absent' && recordDate && recordDate <= today) {
      absenceDates.add(record.date);
    }
  }

  let lateMinutes = 0;
  let undertimeMinutes = 0;

  for (const record of attendanceInPeriod) {
    if (record.status === 'absent' || exemptStatuses.has(record.status)) {
      continue;
    }

    const scheduleForDay = scheduleByDate.get(record.date)?.[0];
    const scheduledStart = parseTimeToMinutes(
      scheduleForDay?.startTime ?? defaultShiftStart
    );
    const scheduledEnd = parseTimeToMinutes(
      scheduleForDay?.endTime ?? defaultShiftEnd
    );

    const actualIn = parseTimeToMinutes(record.timeIn);
    const actualOut = parseTimeToMinutes(record.timeOut);

    if (actualIn !== null && scheduledStart !== null) {
      const diff = actualIn - scheduledStart;
      if (diff > 0) {
        lateMinutes += diff;
      }
    }

    if (actualOut !== null && scheduledEnd !== null) {
      const diff = scheduledEnd - actualOut;
      if (diff > 0) {
        undertimeMinutes += diff;
      }
    }
  }

  const absentDays = absenceDates.size;
  const absenceDeduction =
    absentDays > 0 ? roundToCents(dailyRate * absentDays) : 0;
  const lateDeductionMinutes = lateMinutes + undertimeMinutes;
  const lateDeduction =
    lateDeductionMinutes > 0
      ? roundToCents(ratePerMinute * lateDeductionMinutes)
      : 0;
  const deduction = roundToCents(absenceDeduction + lateDeduction);

  return {
    absentDays,
    lateMinutes,
    undertimeMinutes,
    deduction,
  };
};
