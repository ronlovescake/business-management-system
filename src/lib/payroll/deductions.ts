import type { Payroll, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const WEEKEND_DAYS = new Set([0, 6]);

const roundToCents = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const toDateOnlyUtc = (input: Date): Date =>
  new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toDateOnlyUtc(parsed);
};

const parsePeriodDate = (
  value: string | null | undefined,
  fallback?: string
): Date | null => {
  const direct = parseDate(value ?? undefined);
  if (direct) {
    return direct;
  }

  if (!fallback) {
    return null;
  }

  return parseDate(fallback);
};

const extractPeriodBounds = (
  payPeriod: string | null | undefined
): {
  start?: string;
  end?: string;
} => {
  if (!payPeriod) {
    return {};
  }

  const [rawStart, rawEnd] = payPeriod
    .split(' to ')
    .map((part) => part?.trim());
  return { start: rawStart, end: rawEnd };
};

const formatDate = (date: Date): string => date.toISOString().slice(0, 10);

const getPayrollPeriodRange = (
  payroll: Payroll
): { start: Date | null; end: Date | null } => {
  const periodFallback = extractPeriodBounds(payroll.payPeriod);
  const start = parsePeriodDate(payroll.periodStart, periodFallback.start);
  const end = parsePeriodDate(payroll.periodEnd, periodFallback.end);

  if (!start || !end || start > end) {
    return { start: null, end: null };
  }

  return { start, end };
};

const getEffectiveMonthlySalary = (
  payroll: Payroll,
  entry: EmployeeMapEntry | undefined
): number => {
  if (!entry) {
    return Number(payroll.basicSalary ?? 0);
  }

  return Number(
    entry.employee.currentSalary ??
      entry.employee.basicSalary ??
      payroll.basicSalary ??
      0
  );
};

const DEFAULT_SHIFT_START = '08:00';
const DEFAULT_SHIFT_END = '17:00';
const HOURS_PER_DAY = 8;
const MINUTES_PER_DAY = HOURS_PER_DAY * 60;

const parseTimeToMinutes = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

const countWorkingDays = (start: Date, end: Date): number => {
  if (start > end) {
    return 0;
  }

  const cursor = new Date(start);
  let count = 0;

  while (cursor <= end) {
    if (!WEEKEND_DAYS.has(cursor.getUTCDay())) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return count;
};

const getOverlapWorkingDays = (
  periodStart: Date,
  periodEnd: Date,
  leaveStart: Date,
  leaveEnd: Date
): number => {
  const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
  const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return countWorkingDays(overlapStart, overlapEnd);
};

interface MinimalEmployee {
  employeeId: string;
  basicSalary: number | null;
  currentSalary: number | null;
}

interface MinimalLeaveRequest {
  id: number;
  employeeId: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
}

interface EmployeeMapEntry {
  employee: MinimalEmployee;
  leaves: MinimalLeaveRequest[];
}

interface MinimalAttendance {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string;
  timeOut: string;
  totalHours: number;
  status: string;
}

interface MinimalSchedule {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string | null;
}

interface AttendanceDataIndex {
  attendanceByEmployee: Map<string, MinimalAttendance[]>;
  schedulesByEmployee: Map<string, MinimalSchedule[]>;
}

const buildEmployeeDataMap = async (
  payrolls: Payroll[]
): Promise<Map<string, EmployeeMapEntry>> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  if (employeeIds.length === 0) {
    return new Map();
  }

  const [employees, leaveRequests] = await Promise.all([
    prisma.employee.findMany({
      where: { employeeId: { in: employeeIds } },
      select: {
        employeeId: true,
        basicSalary: true,
        currentSalary: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'approved',
        paymentStatus: 'unpaid',
      },
      select: {
        id: true,
        employeeId: true,
        startDate: true,
        endDate: true,
        numberOfDays: true,
      },
    }),
  ]);

  const leaveByEmployee = leaveRequests.reduce<
    Map<string, MinimalLeaveRequest[]>
  >((acc, leave) => {
    const list = acc.get(leave.employeeId) ?? [];
    list.push(leave);
    acc.set(leave.employeeId, list);
    return acc;
  }, new Map());

  return employees.reduce<Map<string, EmployeeMapEntry>>((acc, employee) => {
    acc.set(employee.employeeId, {
      employee,
      leaves: leaveByEmployee.get(employee.employeeId) ?? [],
    });
    return acc;
  }, new Map());
};

const buildAttendanceDataIndex = async (
  payrolls: Payroll[]
): Promise<AttendanceDataIndex> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  let globalStart: Date | null = null;
  let globalEnd: Date | null = null;

  for (const payroll of payrolls) {
    const { start, end } = getPayrollPeriodRange(payroll);
    if (!start || !end) {
      continue;
    }

    if (!globalStart || start < globalStart) {
      globalStart = start;
    }
    if (!globalEnd || end > globalEnd) {
      globalEnd = end;
    }
  }

  if (employeeIds.length === 0 || !globalStart || !globalEnd) {
    return {
      attendanceByEmployee: new Map(),
      schedulesByEmployee: new Map(),
    };
  }

  const startStr = formatDate(globalStart);
  const endStr = formatDate(globalEnd);

  const [attendance, schedules] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        deletedAt: null,
        date: {
          gte: startStr,
          lte: endStr,
        },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        timeIn: true,
        timeOut: true,
        totalHours: true,
        status: true,
      },
    }),
    prisma.schedule.findMany({
      where: {
        employeeId: { in: employeeIds },
        deletedAt: null,
        date: {
          gte: startStr,
          lte: endStr,
        },
      },
      select: {
        id: true,
        employeeId: true,
        date: true,
        startTime: true,
        endTime: true,
        shiftType: true,
      },
    }),
  ]);

  const attendanceByEmployee = attendance.reduce<
    Map<string, MinimalAttendance[]>
  >((acc, record) => {
    const list = acc.get(record.employeeId) ?? [];
    list.push(record);
    acc.set(record.employeeId, list);
    return acc;
  }, new Map());

  const schedulesByEmployee = schedules.reduce<Map<string, MinimalSchedule[]>>(
    (acc, schedule) => {
      const list = acc.get(schedule.employeeId) ?? [];
      list.push(schedule);
      acc.set(schedule.employeeId, list);
      return acc;
    },
    new Map()
  );

  return { attendanceByEmployee, schedulesByEmployee };
};

const sumDeductions = (
  payroll: Payroll,
  overrides: Partial<Pick<Payroll, 'lwop' | 'absentsLates'>> = {}
): number => {
  const lwopValue = overrides.lwop ?? payroll.lwop;
  const absentsLatesValue = overrides.absentsLates ?? payroll.absentsLates;

  const parts = [
    payroll.sss,
    payroll.philHealth,
    payroll.pagIbig,
    payroll.tax,
    payroll.loans,
    payroll.cashAdvance,
    absentsLatesValue,
    lwopValue,
  ];

  return roundToCents(
    parts.reduce(
      (total, value) => total + (Number.isFinite(value) ? Number(value) : 0),
      0
    )
  );
};

const calculateLwopForPayroll = (
  payroll: Payroll,
  entry: EmployeeMapEntry | undefined
): {
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
} => {
  const { start: periodStart, end: periodEnd } = getPayrollPeriodRange(payroll);

  if (!periodStart || !periodEnd) {
    return { unpaidDays: 0, dailyRate: 0, deduction: 0 };
  }

  if (!entry) {
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
      getOverlapWorkingDays(periodStart, periodEnd, leaveStart, leaveEnd)
    );
  }, 0);

  const deduction = unpaidDays > 0 ? roundToCents(dailyRate * unpaidDays) : 0;

  return { unpaidDays, dailyRate, deduction };
};

const applyLwopAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<Payroll[]> => {
  const updates: Array<{ id: string; data: Prisma.PayrollUpdateInput }> = [];

  const updatedResults = new Map<string, Payroll>();

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const { unpaidDays, dailyRate, deduction } = calculateLwopForPayroll(
      payroll,
      entry
    );

    const currentDeduction = roundToCents(payroll.lwop ?? 0);
    const needsUpdate =
      roundToCents(payroll.unpaidDays ?? 0) !== unpaidDays ||
      roundToCents(payroll.dailyRate ?? 0) !== dailyRate ||
      currentDeduction !== deduction;

    if (!needsUpdate) {
      continue;
    }

    const totalDeductions = sumDeductions(payroll, {
      lwop: deduction,
      absentsLates: payroll.absentsLates,
    });
    const netPay = roundToCents(
      Math.max(0, payroll.grossPay - totalDeductions)
    );

    const updateValues = {
      lwop: deduction,
      unpaidDays,
      dailyRate,
      deduction,
      totalDeductions,
      netPay,
    } satisfies Prisma.PayrollUpdateInput;

    updates.push({ id: payroll.id, data: updateValues });

    updatedResults.set(payroll.id, {
      ...payroll,
      ...(updateValues as Partial<Payroll>),
    });
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.payroll.update({
        where: { id },
        data,
      })
    )
  );

  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
};

export const syncPayrollLwop = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  return applyLwopAdjustments(payrolls, employeeDataMap);
};

interface AttendanceDeductionResult {
  absentDays: number;
  lateMinutes: number;
  undertimeMinutes: number;
  deduction: number;
}

const calculateAbsentsLatesForPayroll = (
  payroll: Payroll,
  entry: EmployeeMapEntry | undefined,
  attendanceRecords: MinimalAttendance[] = [],
  scheduleRecords: MinimalSchedule[] = []
): AttendanceDeductionResult => {
  const { start: periodStart, end: periodEnd } = getPayrollPeriodRange(payroll);

  if (!periodStart || !periodEnd) {
    return { absentDays: 0, lateMinutes: 0, undertimeMinutes: 0, deduction: 0 };
  }

  const effectiveMonthlySalary = getEffectiveMonthlySalary(payroll, entry);

  if (effectiveMonthlySalary <= 0) {
    return { absentDays: 0, lateMinutes: 0, undertimeMinutes: 0, deduction: 0 };
  }

  const dailyRate = roundToCents(effectiveMonthlySalary / 26);
  const ratePerMinute = dailyRate / MINUTES_PER_DAY;

  const isWithinPeriod = (dateStr: string) => {
    const dateValue = parseDate(dateStr);
    if (!dateValue) {
      return false;
    }
    return dateValue >= periodStart && dateValue <= periodEnd;
  };

  const attendanceInPeriod = attendanceRecords.filter((record) =>
    isWithinPeriod(record.date)
  );

  const schedulesInPeriod = scheduleRecords.filter((record) =>
    isWithinPeriod(record.date)
  );

  const attendanceByDate = attendanceInPeriod.reduce<
    Map<string, MinimalAttendance[]>
  >((acc, record) => {
    const list = acc.get(record.date) ?? [];
    list.push(record);
    acc.set(record.date, list);
    return acc;
  }, new Map());

  const scheduleByDate = schedulesInPeriod.reduce<
    Map<string, MinimalSchedule[]>
  >((acc, record) => {
    const list = acc.get(record.date) ?? [];
    list.push(record);
    acc.set(record.date, list);
    return acc;
  }, new Map());

  const absenceDates = new Set<string>();

  // Only count absences for dates up to today (don't penalize future scheduled days without attendance)
  const today = toDateOnlyUtc(new Date());

  for (const schedule of schedulesInPeriod) {
    const scheduleDate = parseDate(schedule.date);

    // Skip future dates - can't be absent from something that hasn't happened yet
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

    // Only count absences for dates up to today
    if (record.status === 'absent' && recordDate && recordDate <= today) {
      absenceDates.add(record.date);
    }
  }

  let lateMinutes = 0;
  let undertimeMinutes = 0;

  for (const record of attendanceInPeriod) {
    if (record.status === 'absent') {
      continue;
    }

    const scheduleForDay = scheduleByDate.get(record.date)?.[0];
    const scheduledStart = parseTimeToMinutes(
      scheduleForDay?.startTime ?? DEFAULT_SHIFT_START
    );
    const scheduledEnd = parseTimeToMinutes(
      scheduleForDay?.endTime ?? DEFAULT_SHIFT_END
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

  return { absentDays, lateMinutes, undertimeMinutes, deduction };
};

const applyAttendanceAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>,
  attendanceIndex: AttendanceDataIndex
): Promise<Payroll[]> => {
  const updates: Array<{ id: string; data: Prisma.PayrollUpdateInput }> = [];
  const updatedResults = new Map<string, Payroll>();

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const attendanceRecords =
      attendanceIndex.attendanceByEmployee.get(payroll.employeeId) ?? [];
    const scheduleRecords =
      attendanceIndex.schedulesByEmployee.get(payroll.employeeId) ?? [];

    const { deduction } = calculateAbsentsLatesForPayroll(
      payroll,
      entry,
      attendanceRecords,
      scheduleRecords
    );

    const currentAbsentsLates = roundToCents(payroll.absentsLates ?? 0);

    if (currentAbsentsLates === deduction) {
      continue;
    }

    const totalDeductions = sumDeductions(payroll, {
      absentsLates: deduction,
      lwop: payroll.lwop,
    });
    const netPay = roundToCents(
      Math.max(0, payroll.grossPay - totalDeductions)
    );

    const updateValues = {
      absentsLates: deduction,
      totalDeductions,
      netPay,
    } satisfies Prisma.PayrollUpdateInput;

    updates.push({ id: payroll.id, data: updateValues });

    updatedResults.set(payroll.id, {
      ...payroll,
      ...(updateValues as Partial<Payroll>),
    });
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.payroll.update({
        where: { id },
        data,
      })
    )
  );

  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
};

export const syncPayrollAttendanceDeductions = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  const attendanceIndex = await buildAttendanceDataIndex(payrolls);

  return applyAttendanceAdjustments(payrolls, employeeDataMap, attendanceIndex);
};

export const syncPayrollDeductions = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  const afterLwop = await applyLwopAdjustments(payrolls, employeeDataMap);
  const attendanceIndex = await buildAttendanceDataIndex(afterLwop);
  const afterAttendance = await applyAttendanceAdjustments(
    afterLwop,
    employeeDataMap,
    attendanceIndex
  );

  return afterAttendance;
};
