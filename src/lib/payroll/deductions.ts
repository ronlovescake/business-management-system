import { Prisma } from '@prisma/client';
import type { Payroll } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CashAdvanceCycle } from './cashAdvanceSchedule';
import {
  advanceCycleByOneMonth,
  determineCycleFromDate,
  ensureNextPayday,
} from './cashAdvanceSchedule';

const roundToCents = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const normalizeIdentifier = (value?: string | null): string =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

const toDecimalValue = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(roundToCents(value).toFixed(2));

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

const getPayrollCycleMetadata = (
  payroll: Payroll
): { payDate: Date; cycle: CashAdvanceCycle } | null => {
  const { end } = getPayrollPeriodRange(payroll);
  if (!end) {
    return null;
  }

  const payDate = toDateOnlyUtc(end);
  return {
    payDate,
    cycle: determineCycleFromDate(payDate),
  };
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

/**
 * Count scheduled working days for an employee within a date range
 * @param employeeId - The employee ID
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive)
 * @param schedules - Array of schedule records for the employee
 * @returns Number of days the employee has schedules
 */
const countScheduledDays = (
  employeeId: string,
  start: Date,
  end: Date,
  schedules: MinimalSchedule[]
): number => {
  if (start > end) {
    return 0;
  }

  const startStr = formatDate(start);
  const endStr = formatDate(end);

  // Filter schedules within the date range
  const scheduledDates = new Set(
    schedules
      .filter(
        (schedule) =>
          schedule.employeeId === employeeId &&
          schedule.date >= startStr &&
          schedule.date <= endStr
      )
      .map((schedule) => schedule.date)
  );

  return scheduledDates.size;
};

const getOverlapScheduledDays = (
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  leaveStart: Date,
  leaveEnd: Date,
  schedules: MinimalSchedule[]
): number => {
  const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
  const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return countScheduledDays(employeeId, overlapStart, overlapEnd, schedules);
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

interface MinimalCashAdvanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  status: string;
  amount: Prisma.Decimal;
  monthlyPayment: Prisma.Decimal | null;
  settledAmount: Prisma.Decimal | null;
  remainingBalance: Prisma.Decimal | null;
  deductionCycle: CashAdvanceCycle | null;
  nextDeductionDate: Date | null;
  lastDeductedDate: Date | null;
  approvedDate: Date | null;
  createdAt: Date;
  termsMonths: number | null;
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
    if (!leave.employeeId) {
      return acc;
    }

    const normalized: MinimalLeaveRequest = {
      id: leave.id,
      employeeId: leave.employeeId,
      startDate: leave.startDate,
      endDate: leave.endDate,
      numberOfDays: leave.numberOfDays,
    };

    const list = acc.get(normalized.employeeId) ?? [];
    list.push(normalized);
    acc.set(normalized.employeeId, list);
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

interface CashAdvanceIndex {
  byEmployeeId: Map<string, MinimalCashAdvanceRecord[]>;
  byEmployeeName: Map<string, MinimalCashAdvanceRecord[]>;
}

const buildCashAdvanceIndex = async (
  payrolls: Payroll[]
): Promise<CashAdvanceIndex> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  const employeeNames = Array.from(
    new Set(
      payrolls
        .map((payroll) => payroll.employeeName)
        .filter((value): value is string => Boolean(value))
    )
  );

  if (employeeIds.length === 0 && employeeNames.length === 0) {
    return {
      byEmployeeId: new Map(),
      byEmployeeName: new Map(),
    };
  }

  const records = await prisma.cashAdvanceRecord.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
      OR: [
        employeeIds.length > 0
          ? { employeeId: { in: employeeIds } }
          : undefined,
        employeeNames.length > 0
          ? { employeeName: { in: employeeNames } }
          : undefined,
      ].filter(Boolean) as [
        { employeeId: { in: string[] } } | { employeeName: { in: string[] } },
      ],
    },
    orderBy: [{ createdAt: 'asc' }],
    select: {
      id: true,
      employeeId: true,
      employeeName: true,
      status: true,
      amount: true,
      monthlyPayment: true,
      settledAmount: true,
      remainingBalance: true,
      deductionCycle: true,
      nextDeductionDate: true,
      lastDeductedDate: true,
      approvedDate: true,
      createdAt: true,
      termsMonths: true,
    },
  });

  const byEmployeeId = new Map<string, MinimalCashAdvanceRecord[]>();
  const byEmployeeName = new Map<string, MinimalCashAdvanceRecord[]>();

  for (const record of records) {
    const listById = byEmployeeId.get(record.employeeId) ?? [];
    listById.push(record);
    byEmployeeId.set(record.employeeId, listById);

    const nameKey = normalizeIdentifier(record.employeeName);
    if (nameKey) {
      const listByName = byEmployeeName.get(nameKey) ?? [];
      listByName.push(record);
      byEmployeeName.set(nameKey, listByName);
    }
  }

  return { byEmployeeId, byEmployeeName };
};

const sumDeductions = (
  payroll: Payroll,
  overrides: Partial<
    Pick<Payroll, 'lwop' | 'absentsLates' | 'cashAdvance'>
  > = {}
): number => {
  const lwopValue = overrides.lwop ?? payroll.lwop;
  const absentsLatesValue = overrides.absentsLates ?? payroll.absentsLates;
  const cashAdvanceValue = overrides.cashAdvance ?? payroll.cashAdvance;

  const parts = [
    payroll.sss,
    payroll.philHealth,
    payroll.pagIbig,
    payroll.tax,
    payroll.loans,
    cashAdvanceValue,
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

const mergeCashAdvanceUpdate = (
  store: Map<string, Prisma.CashAdvanceRecordUpdateInput>,
  id: string,
  update: Prisma.CashAdvanceRecordUpdateInput
) => {
  const existing = store.get(id);
  if (existing) {
    store.set(id, { ...existing, ...update });
    return;
  }
  store.set(id, update);
};

const calculateLwopForPayroll = (
  payroll: Payroll,
  entry: EmployeeMapEntry | undefined,
  schedules: MinimalSchedule[] = []
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

const applyLwopAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<Payroll[]> => {
  const updates: Array<{ id: string; data: Prisma.PayrollUpdateInput }> = [];
  const updatedResults = new Map<string, Payroll>();

  // Fetch schedules for all employees and date ranges
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

  // Fetch all schedules for the period
  const schedules =
    employeeIds.length > 0 && globalStart && globalEnd
      ? await prisma.schedule.findMany({
          where: {
            employeeId: { in: employeeIds },
            deletedAt: null,
            date: {
              gte: formatDate(globalStart),
              lte: formatDate(globalEnd),
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
        })
      : [];

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const employeeSchedules = schedules.filter(
      (s) => s.employeeId === payroll.employeeId
    );
    const { unpaidDays, dailyRate, deduction } = calculateLwopForPayroll(
      payroll,
      entry,
      employeeSchedules
    );

    // Always recalculate totalDeductions to ensure statutory deductions are included
    const totalDeductions = sumDeductions(payroll, {
      lwop: deduction,
      absentsLates: payroll.absentsLates,
    });
    const netPay = roundToCents(
      Math.max(0, payroll.grossPay - totalDeductions)
    );

    const currentDeduction = roundToCents(payroll.lwop ?? 0);
    const currentTotal = roundToCents(payroll.totalDeductions ?? 0);
    const currentNetPay = roundToCents(payroll.netPay ?? 0);

    const needsUpdate =
      roundToCents(payroll.unpaidDays ?? 0) !== unpaidDays ||
      roundToCents(payroll.dailyRate ?? 0) !== dailyRate ||
      currentDeduction !== deduction ||
      currentTotal !== totalDeductions ||
      currentNetPay !== netPay;

    if (!needsUpdate) {
      continue;
    }

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

// Attendance statuses that should never trigger late/undertime penalties.
const DEDUCTION_EXEMPT_ATTENDANCE_STATUSES = new Set(['on-leave']);

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

    if (DEDUCTION_EXEMPT_ATTENDANCE_STATUSES.has(record.status)) {
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

    // Always recalculate totalDeductions to ensure statutory deductions are included
    const totalDeductions = sumDeductions(payroll, {
      absentsLates: deduction,
      lwop: payroll.lwop,
    });
    const netPay = roundToCents(
      Math.max(0, payroll.grossPay - totalDeductions)
    );

    const currentAbsentsLates = roundToCents(payroll.absentsLates ?? 0);
    const currentTotal = roundToCents(payroll.totalDeductions ?? 0);
    const currentNetPay = roundToCents(payroll.netPay ?? 0);

    const needsUpdate =
      currentAbsentsLates !== deduction ||
      currentTotal !== totalDeductions ||
      currentNetPay !== netPay;

    if (!needsUpdate) {
      continue;
    }

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

const applyCashAdvanceAdjustments = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const cashAdvanceIndex = await buildCashAdvanceIndex(payrolls);

  if (
    cashAdvanceIndex.byEmployeeId.size === 0 &&
    cashAdvanceIndex.byEmployeeName.size === 0
  ) {
    return payrolls;
  }

  const cashAdvanceUpdates = new Map<
    string,
    Prisma.CashAdvanceRecordUpdateInput
  >();
  const deductionLogs: Prisma.CashAdvanceDeductionCreateManyInput[] = [];
  const payrollUpdates: Array<{ id: string; data: Prisma.PayrollUpdateInput }> =
    [];
  const updatedPayrolls = new Map<string, Payroll>();

  for (const payroll of payrolls) {
    const cycleMeta = getPayrollCycleMetadata(payroll);
    if (!cycleMeta) {
      continue;
    }

    const idAdvances = payroll.employeeId
      ? (cashAdvanceIndex.byEmployeeId.get(payroll.employeeId) ?? [])
      : [];
    const nameKey = normalizeIdentifier(payroll.employeeName);
    const nameAdvances = nameKey
      ? (cashAdvanceIndex.byEmployeeName.get(nameKey) ?? [])
      : [];

    const advances = idAdvances.length > 0 ? idAdvances : nameAdvances;
    if (advances.length === 0) {
      continue;
    }

    const { payDate, cycle } = cycleMeta;
    let totalDeduction = 0;
    const isPaid = payroll.status === 'paid';

    for (const advance of advances) {
      let remaining = advance.remainingBalance
        ? Number(advance.remainingBalance)
        : Math.max(
            Number(advance.amount) -
              (advance.settledAmount ? Number(advance.settledAmount) : 0),
            0
          );

      if (remaining <= 0) {
        if (isPaid && advance.status !== 'paid') {
          mergeCashAdvanceUpdate(cashAdvanceUpdates, advance.id, {
            status: 'paid',
            remainingBalance: toDecimalValue(0),
            nextDeductionDate: null,
            deductionCycle: null,
          });
          advance.status = 'paid';
        }
        continue;
      }

      let scheduledDate = advance.nextDeductionDate
        ? toDateOnlyUtc(advance.nextDeductionDate)
        : null;
      let scheduledCycle = advance.deductionCycle;

      if (!scheduledDate && advance.status === 'approved') {
        const reference = advance.approvedDate ?? advance.createdAt;
        const schedule = ensureNextPayday(reference);
        scheduledDate = schedule.date;
        scheduledCycle = schedule.cycle;

        if (isPaid) {
          mergeCashAdvanceUpdate(cashAdvanceUpdates, advance.id, {
            nextDeductionDate: schedule.date,
            deductionCycle: schedule.cycle,
          });
        }

        advance.nextDeductionDate = schedule.date;
        advance.deductionCycle = schedule.cycle;
      }

      const effectiveCycle = scheduledCycle ?? determineCycleFromDate(payDate);

      if (scheduledCycle && scheduledCycle !== cycle) {
        continue;
      }

      if (!scheduledDate || payDate < scheduledDate) {
        continue;
      }

      const lastDeducted = advance.lastDeductedDate
        ? toDateOnlyUtc(advance.lastDeductedDate)
        : null;

      if (lastDeducted && lastDeducted.getTime() === payDate.getTime()) {
        continue;
      }

      const baseMonthly = advance.monthlyPayment
        ? Number(advance.monthlyPayment)
        : advance.termsMonths && advance.termsMonths > 0
          ? roundToCents(Number(advance.amount) / advance.termsMonths)
          : remaining;

      const monthlyPaymentValue =
        baseMonthly > 0 ? roundToCents(baseMonthly) : remaining;

      const deduction = Math.min(remaining, monthlyPaymentValue);

      if (deduction <= 0) {
        continue;
      }

      totalDeduction = roundToCents(totalDeduction + deduction);

      if (isPaid) {
        remaining = roundToCents(remaining - deduction);
        const settled = roundToCents(
          (advance.settledAmount ? Number(advance.settledAmount) : 0) +
            deduction
        );

        let nextScheduleDate: Date | null = null;
        let nextCycle: CashAdvanceCycle | null = effectiveCycle;

        if (remaining > 0) {
          const referenceDate = advance.nextDeductionDate
            ? toDateOnlyUtc(advance.nextDeductionDate)
            : payDate;
          nextScheduleDate = advanceCycleByOneMonth(
            referenceDate,
            effectiveCycle
          );
        } else {
          nextScheduleDate = null;
          nextCycle = null;
        }

        const nextStatus = remaining > 0 ? 'approved' : 'paid';

        mergeCashAdvanceUpdate(cashAdvanceUpdates, advance.id, {
          remainingBalance: toDecimalValue(remaining),
          settledAmount: toDecimalValue(settled),
          status: nextStatus,
          nextDeductionDate: nextScheduleDate,
          deductionCycle: nextCycle ?? null,
          lastDeductedDate: payDate,
        });

        deductionLogs.push({
          cashAdvanceId: advance.id,
          employeeId: advance.employeeId,
          payrollId: payroll.id,
          payPeriod: payroll.payPeriod,
          deductionDate: payDate,
          amount: toDecimalValue(deduction),
        });

        advance.remainingBalance = toDecimalValue(remaining);
        advance.settledAmount = toDecimalValue(settled);
        advance.status = nextStatus;
        advance.nextDeductionDate = nextScheduleDate;
        advance.deductionCycle = nextCycle;
        advance.lastDeductedDate = payDate;
      }
    }

    const currentCashAdvance = roundToCents(payroll.cashAdvance ?? 0);
    const roundedTotal = roundToCents(totalDeduction);

    if (currentCashAdvance !== roundedTotal) {
      const totalDeductions = sumDeductions(payroll, {
        cashAdvance: roundedTotal,
        absentsLates: payroll.absentsLates,
        lwop: payroll.lwop,
      });
      const netPay = roundToCents(
        Math.max(0, payroll.grossPay - totalDeductions)
      );

      payrollUpdates.push({
        id: payroll.id,
        data: {
          cashAdvance: roundedTotal,
          totalDeductions,
          netPay,
        },
      });

      updatedPayrolls.set(payroll.id, {
        ...payroll,
        cashAdvance: roundedTotal,
        totalDeductions,
        netPay,
      });
    }
  }

  if (cashAdvanceUpdates.size > 0 || deductionLogs.length > 0) {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    cashAdvanceUpdates.forEach((data, id) => {
      operations.push(
        prisma.cashAdvanceRecord.update({
          where: { id },
          data,
        })
      );
    });

    if (deductionLogs.length > 0) {
      operations.push(
        prisma.cashAdvanceDeduction.createMany({
          data: deductionLogs,
        })
      );
    }

    if (operations.length > 0) {
      await prisma.$transaction(operations);
    }
  }

  if (payrollUpdates.length > 0) {
    const persisted = await prisma.$transaction(
      payrollUpdates.map(({ id, data }) =>
        prisma.payroll.update({
          where: { id },
          data,
        })
      )
    );

    for (const record of persisted) {
      updatedPayrolls.set(record.id, record);
    }
  }

  return payrolls.map((payroll) => updatedPayrolls.get(payroll.id) ?? payroll);
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

  return applyCashAdvanceAdjustments(afterAttendance);
};
