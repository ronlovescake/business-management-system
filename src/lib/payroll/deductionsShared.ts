import { Prisma } from '@prisma/client';

export const DEFAULT_SHIFT_START = '08:00';
export const DEFAULT_SHIFT_END = '17:00';
export const HOURS_PER_DAY = 8;
export const MINUTES_PER_DAY = HOURS_PER_DAY * 60;

export const roundToCents = (value: number): number =>
  Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

const DEDUCTION_COMPONENT_KEYS = [
  'sss',
  'philHealth',
  'pagIbig',
  'tax',
  'loans',
  'cashAdvance',
  'absentsLates',
  'lwop',
] as const;

type DeductionComponentKey = (typeof DEDUCTION_COMPONENT_KEYS)[number];

type DeductionComponentSource = Partial<
  Record<DeductionComponentKey, number | null | undefined>
>;

export const sumPayrollDeductions = (
  payroll: DeductionComponentSource,
  overrides: DeductionComponentSource = {}
): number =>
  roundToCents(
    DEDUCTION_COMPONENT_KEYS.reduce((total, key) => {
      const value = overrides[key] ?? payroll[key];
      return total + (Number.isFinite(value) ? Number(value) : 0);
    }, 0)
  );

export const normalizeIdentifier = (value?: string | null): string =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

export const toDecimalValue = (value: number): Prisma.Decimal =>
  new Prisma.Decimal(roundToCents(value).toFixed(2));

export const toDateOnlyUtc = (input: Date): Date =>
  new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));

export const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return toDateOnlyUtc(parsed);
};

export const parsePeriodDate = (
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

export const getPayrollPeriodRangeFromFields = (
  payPeriod: string | null | undefined,
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined
): { start: Date | null; end: Date | null } => {
  const periodFallback = extractPeriodBounds(payPeriod);
  const start = parsePeriodDate(periodStart, periodFallback.start);
  const end = parsePeriodDate(periodEnd, periodFallback.end);

  if (!start || !end || start > end) {
    return { start: null, end: null };
  }

  return { start, end };
};

export const getPayrollCycleMetadataFromFields = (
  payPeriod: string | null | undefined,
  periodStart: string | null | undefined,
  periodEnd: string | null | undefined,
  determineCycle: (payDate: Date) => string
): { payDate: Date; cycle: string } | null => {
  const { end } = getPayrollPeriodRangeFromFields(
    payPeriod,
    periodStart,
    periodEnd
  );
  if (!end) {
    return null;
  }

  const payDate = toDateOnlyUtc(end);
  return {
    payDate,
    cycle: determineCycle(payDate),
  };
};

type EmployeeSalaryLike = {
  currentSalary?: number | null;
  basicSalary?: number | null;
};

export const getEffectiveMonthlySalary = (
  payrollBasicSalary: number | null | undefined,
  employee?: EmployeeSalaryLike
): number => {
  if (!employee) {
    return Number(payrollBasicSalary ?? 0);
  }

  return Number(
    employee.currentSalary ?? employee.basicSalary ?? payrollBasicSalary ?? 0
  );
};

export const extractPeriodBounds = (
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

export const formatDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

export const parseTimeToMinutes = (value?: string | null): number | null => {
  if (!value) {
    return null;
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return hours * 60 + minutes;
};

type Schedulable = {
  employeeId: string;
  date: string;
};

export const countScheduledDays = <TSchedule extends Schedulable>(
  employeeId: string,
  start: Date,
  end: Date,
  schedules: TSchedule[]
): number => {
  if (start > end) {
    return 0;
  }

  const startStr = formatDate(start);
  const endStr = formatDate(end);

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

export const getOverlapScheduledDays = <TSchedule extends Schedulable>(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  leaveStart: Date,
  leaveEnd: Date,
  schedules: TSchedule[]
): number => {
  const overlapStart = leaveStart > periodStart ? leaveStart : periodStart;
  const overlapEnd = leaveEnd < periodEnd ? leaveEnd : periodEnd;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  return countScheduledDays(employeeId, overlapStart, overlapEnd, schedules);
};

export const syncPayrollLwopGeneric = async <TPayroll, TEmployeeMap>(
  payrolls: TPayroll[],
  buildEmployeeDataMap: (payrolls: TPayroll[]) => Promise<TEmployeeMap>,
  applyLwopAdjustments: (
    payrolls: TPayroll[],
    employeeDataMap: TEmployeeMap
  ) => Promise<TPayroll[]>
): Promise<TPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  return applyLwopAdjustments(payrolls, employeeDataMap);
};

export const syncPayrollAttendanceDeductionsGeneric = async <
  TPayroll,
  TEmployeeMap,
  TAttendanceIndex,
>(
  payrolls: TPayroll[],
  buildEmployeeDataMap: (payrolls: TPayroll[]) => Promise<TEmployeeMap>,
  buildAttendanceDataIndex: (payrolls: TPayroll[]) => Promise<TAttendanceIndex>,
  applyAttendanceAdjustments: (
    payrolls: TPayroll[],
    employeeDataMap: TEmployeeMap,
    attendanceIndex: TAttendanceIndex
  ) => Promise<TPayroll[]>
): Promise<TPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  const attendanceIndex = await buildAttendanceDataIndex(payrolls);

  return applyAttendanceAdjustments(payrolls, employeeDataMap, attendanceIndex);
};

export const syncPayrollDeductionsGeneric = async <
  TPayroll,
  TEmployeeMap,
  TAttendanceIndex,
>(
  payrolls: TPayroll[],
  buildEmployeeDataMap: (payrolls: TPayroll[]) => Promise<TEmployeeMap>,
  applyStatutoryContributionAdjustments: (
    payrolls: TPayroll[],
    employeeDataMap: TEmployeeMap
  ) => Promise<TPayroll[]>,
  applyThirteenthMonthAdjustments: (
    payrolls: TPayroll[]
  ) => Promise<TPayroll[]>,
  applyLwopAdjustments: (
    payrolls: TPayroll[],
    employeeDataMap: TEmployeeMap
  ) => Promise<TPayroll[]>,
  buildAttendanceDataIndex: (payrolls: TPayroll[]) => Promise<TAttendanceIndex>,
  applyAttendanceAdjustments: (
    payrolls: TPayroll[],
    employeeDataMap: TEmployeeMap,
    attendanceIndex: TAttendanceIndex
  ) => Promise<TPayroll[]>,
  applyCashAdvanceAdjustments: (payrolls: TPayroll[]) => Promise<TPayroll[]>
): Promise<TPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  const afterStatutory = await applyStatutoryContributionAdjustments(
    payrolls,
    employeeDataMap
  );
  const afterThirteenth = await applyThirteenthMonthAdjustments(afterStatutory);
  const afterLwop = await applyLwopAdjustments(
    afterThirteenth,
    employeeDataMap
  );
  const attendanceIndex = await buildAttendanceDataIndex(afterLwop);
  const afterAttendance = await applyAttendanceAdjustments(
    afterLwop,
    employeeDataMap,
    attendanceIndex
  );

  return applyCashAdvanceAdjustments(afterAttendance);
};
