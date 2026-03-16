import {
  calculateAttendanceDeductionEngine,
  calculateLwopDeductionEngine,
} from './payrollDeductionCalculationEngine';
import { selectThirteenthMonthTarget } from './deductionUpdateHelpers';

type PayrollLike = {
  id: string;
  employeeId: string;
  employeeName: string;
  basicSalary: number | null;
  allowance: number | null;
  overtime: number | null;
  bonuses: number | null;
  thirteenthMonth: number | null;
  grossPay: number | null;
  sss: number | null;
  philHealth: number | null;
  pagIbig: number | null;
  tax: number | null;
  loans: number | null;
  cashAdvance: number | null;
  lwop: number | null;
  absentsLates: number | null;
  totalDeductions: number | null;
  netPay: number | null;
  status: string;
  payPeriod: string;
  unpaidDays?: number | null;
  dailyRate?: number | null;
  deduction?: number | null;
};

type PayrollPeriodRange = {
  start: Date | null;
  end: Date | null;
};

type EmployeeContributionLike = {
  basicSalary?: number | null;
  currentSalary?: number | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
};

type LeaveLike = {
  startDate: string;
  endDate: string;
};

type EmployeeMapEntryLike = {
  employee: EmployeeContributionLike;
  leaves: LeaveLike[];
};

type AttendanceRecordLike = {
  date: string;
  timeIn: string;
  timeOut: string;
  status: string;
};

type ScheduleRecordLike = {
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
};

type AttendanceDataIndexLike<
  TAttendance extends AttendanceRecordLike,
  TSchedule extends ScheduleRecordLike,
> = {
  attendanceByEmployee: Map<string, TAttendance[]>;
  schedulesByEmployee: Map<string, TSchedule[]>;
};

type ThirteenthMonthRecordLike = {
  employeeId: string | null;
  employeeName: string | null;
  year: number;
  status: string;
  thirteenthMonthPay: number | { toString(): string };
  approvedDate: string | Date | null;
  paidDate: string | Date | null;
};

type DeductionOverrides = {
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  tax?: number;
  loans?: number;
  cashAdvance?: number;
  absentsLates?: number;
  lwop?: number;
};

type PersistUpdates<TPayroll, TUpdate> = (
  updates: Array<{ id: string; data: TUpdate }>
) => Promise<TPayroll[]>;

type UpdateProjection = {
  thirteenthMonth?: number;
  grossPay?: number;
  sss?: number;
  philHealth?: number;
  pagIbig?: number;
  tax?: number;
  lwop?: number;
  unpaidDays?: number;
  dailyRate?: number;
  deduction?: number;
  absentsLates?: number;
  totalDeductions: number;
  netPay: number;
};

type CommonHelpers<TPayroll extends PayrollLike> = {
  getPayrollPeriodRange: (payroll: TPayroll) => PayrollPeriodRange;
  roundToCents: (value: number) => number;
  normalizeIdentifier: (value?: string | null) => string;
  parseDate: (value?: string | Date | null) => Date | null;
  sumPayrollDeductions: (
    payroll: TPayroll,
    overrides?: DeductionOverrides
  ) => number;
};

const mergeUpdatedPayroll = <TPayroll extends PayrollLike>(
  payroll: TPayroll,
  updates: UpdateProjection
) => {
  return {
    ...payroll,
    ...updates,
  } as TPayroll;
};

export async function applyThirteenthMonthAdjustmentsGeneric<
  TPayroll extends PayrollLike,
  TUpdate,
  TThirteenthMonthRecord extends ThirteenthMonthRecordLike,
>({
  payrolls,
  getPayrollPeriodRange,
  roundToCents,
  normalizeIdentifier,
  parseDate,
  sumPayrollDeductions,
  findThirteenthMonthRecords,
  persistUpdates,
  createUpdateValues,
}: CommonHelpers<TPayroll> & {
  payrolls: TPayroll[];
  findThirteenthMonthRecords: (
    relevantYears: number[]
  ) => Promise<TThirteenthMonthRecord[]>;
  persistUpdates: PersistUpdates<TPayroll, TUpdate>;
  createUpdateValues: (
    values: Required<
      Pick<
        UpdateProjection,
        'thirteenthMonth' | 'grossPay' | 'totalDeductions' | 'netPay'
      >
    >
  ) => TUpdate;
}) {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const payrollMeta = payrolls.map((payroll) => {
    const { start, end } = getPayrollPeriodRange(payroll);
    const periodYear = end?.getUTCFullYear() ?? start?.getUTCFullYear() ?? null;
    return { payroll, start, end, periodYear };
  });

  const relevantYears = Array.from(
    new Set(
      payrollMeta
        .map((meta) => meta.periodYear)
        .filter((year): year is number => year !== null)
    )
  );

  if (relevantYears.length === 0) {
    return payrolls;
  }

  const thirteenthRecords = await findThirteenthMonthRecords(relevantYears);
  if (thirteenthRecords.length === 0) {
    return payrolls;
  }

  const updates: Array<{ id: string; data: TUpdate }> = [];
  const updatedResults = new Map<string, TPayroll>();

  for (const record of thirteenthRecords) {
    if (record.status === 'paid') {
      continue;
    }

    const normalizedId = normalizeIdentifier(record.employeeId);
    const normalizedName = normalizeIdentifier(record.employeeName);

    const candidates = payrollMeta.filter(({ payroll, periodYear }) => {
      if (periodYear === null || periodYear !== record.year) {
        return false;
      }
      if (payroll.status === 'paid') {
        return false;
      }

      const payrollId = normalizeIdentifier(payroll.employeeId);
      const payrollName = normalizeIdentifier(payroll.employeeName);

      if (normalizedId && payrollId && normalizedId === payrollId) {
        return true;
      }

      if (!normalizedId && normalizedName && payrollName) {
        return normalizedName === payrollName;
      }

      if (normalizedId && !payrollId && normalizedName && payrollName) {
        return normalizedName === payrollName;
      }

      return false;
    });

    if (candidates.length === 0) {
      continue;
    }

    const target = selectThirteenthMonthTarget(
      candidates,
      parseDate(record.approvedDate),
      parseDate(record.paidDate)
    );
    if (!target) {
      continue;
    }

    const amount = roundToCents(Number(record.thirteenthMonthPay));

    for (const candidate of candidates) {
      const payroll =
        updatedResults.get(candidate.payroll.id) ?? candidate.payroll;
      const desiredAmount = candidate === target ? amount : 0;
      const currentAmount = roundToCents(payroll.thirteenthMonth ?? 0);

      if (candidate !== target && currentAmount === 0) {
        continue;
      }

      const grossPay = roundToCents(
        Number(payroll.basicSalary ?? 0) +
          Number(payroll.allowance ?? 0) +
          Number(payroll.overtime ?? 0) +
          Number(payroll.bonuses ?? 0) +
          desiredAmount
      );
      const totalDeductions = sumPayrollDeductions(payroll);
      const netPay = roundToCents(Math.max(0, grossPay - totalDeductions));

      const currentGross = roundToCents(payroll.grossPay ?? 0);
      const currentTotal = roundToCents(payroll.totalDeductions ?? 0);
      const currentNet = roundToCents(payroll.netPay ?? 0);

      const needsUpdate =
        currentAmount !== desiredAmount ||
        currentGross !== grossPay ||
        currentTotal !== totalDeductions ||
        currentNet !== netPay;

      if (!needsUpdate) {
        continue;
      }

      const nextValues = {
        thirteenthMonth: desiredAmount,
        grossPay,
        totalDeductions,
        netPay,
      };

      updates.push({
        id: payroll.id,
        data: createUpdateValues(nextValues),
      });

      updatedResults.set(payroll.id, mergeUpdatedPayroll(payroll, nextValues));
    }
  }

  if (updates.length === 0) {
    return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
  }

  const persisted = await persistUpdates(updates);
  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
}

export async function applyStatutoryContributionAdjustmentsGeneric<
  TPayroll extends PayrollLike,
  TUpdate,
>({
  payrolls,
  employeeDataMap,
  roundToCents,
  sumPayrollDeductions,
  persistUpdates,
  createUpdateValues,
}: Pick<CommonHelpers<TPayroll>, 'roundToCents' | 'sumPayrollDeductions'> & {
  payrolls: TPayroll[];
  employeeDataMap: Map<string, EmployeeMapEntryLike>;
  persistUpdates: PersistUpdates<TPayroll, TUpdate>;
  createUpdateValues: (
    values: Required<
      Pick<
        UpdateProjection,
        'sss' | 'philHealth' | 'pagIbig' | 'tax' | 'totalDeductions' | 'netPay'
      >
    >
  ) => TUpdate;
}) {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const updates: Array<{ id: string; data: TUpdate }> = [];
  const updatedResults = new Map<string, TPayroll>();

  for (const payroll of payrolls) {
    if (payroll.status === 'paid' || payroll.status === 'approved') {
      continue;
    }

    const employee = employeeDataMap.get(payroll.employeeId)?.employee;
    const desiredSss = roundToCents(
      Number(employee?.sssMonthlyContribution ?? payroll.sss ?? 0)
    );
    const desiredPhilHealth = roundToCents(
      Number(employee?.philHealthMonthlyContribution ?? payroll.philHealth ?? 0)
    );
    const desiredPagIbig = roundToCents(
      Number(employee?.pagibigMonthlyContribution ?? payroll.pagIbig ?? 0)
    );
    const desiredTax = roundToCents(
      Number(employee?.taxMonthlyContribution ?? payroll.tax ?? 0)
    );

    const totalDeductions = sumPayrollDeductions(payroll, {
      sss: desiredSss,
      philHealth: desiredPhilHealth,
      pagIbig: desiredPagIbig,
      tax: desiredTax,
    });
    const netPay = roundToCents(
      Math.max(0, Number(payroll.grossPay ?? 0) - totalDeductions)
    );

    const needsUpdate =
      roundToCents(Number(payroll.sss ?? 0)) !== desiredSss ||
      roundToCents(Number(payroll.philHealth ?? 0)) !== desiredPhilHealth ||
      roundToCents(Number(payroll.pagIbig ?? 0)) !== desiredPagIbig ||
      roundToCents(Number(payroll.tax ?? 0)) !== desiredTax ||
      roundToCents(Number(payroll.totalDeductions ?? 0)) !== totalDeductions ||
      roundToCents(Number(payroll.netPay ?? 0)) !== netPay;

    if (!needsUpdate) {
      continue;
    }

    const nextValues = {
      sss: desiredSss,
      philHealth: desiredPhilHealth,
      pagIbig: desiredPagIbig,
      tax: desiredTax,
      totalDeductions,
      netPay,
    };

    updates.push({
      id: payroll.id,
      data: createUpdateValues(nextValues),
    });

    updatedResults.set(payroll.id, mergeUpdatedPayroll(payroll, nextValues));
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await persistUpdates(updates);
  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
}

export async function applyLwopAdjustmentsGeneric<
  TPayroll extends PayrollLike,
  TUpdate,
  TSchedule extends ScheduleRecordLike,
>({
  payrolls,
  employeeDataMap,
  getPayrollPeriodRange,
  getEffectiveMonthlySalary,
  fetchSchedules,
  formatDate,
  getOverlapScheduledDays,
  parseDate,
  roundToCents,
  sumPayrollDeductions,
  persistUpdates,
  createUpdateValues,
}: Pick<
  CommonHelpers<TPayroll>,
  | 'getPayrollPeriodRange'
  | 'parseDate'
  | 'roundToCents'
  | 'sumPayrollDeductions'
> & {
  payrolls: TPayroll[];
  employeeDataMap: Map<string, EmployeeMapEntryLike>;
  getEffectiveMonthlySalary: (
    payroll: TPayroll,
    entry: EmployeeMapEntryLike | undefined
  ) => number;
  fetchSchedules: (params: {
    employeeIds: string[];
    start: string;
    end: string;
  }) => Promise<TSchedule[]>;
  formatDate: (date: Date) => string;
  getOverlapScheduledDays: (
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    leaveStart: Date,
    leaveEnd: Date,
    schedules: TSchedule[]
  ) => number;
  persistUpdates: PersistUpdates<TPayroll, TUpdate>;
  createUpdateValues: (
    values: Required<
      Pick<
        UpdateProjection,
        | 'lwop'
        | 'unpaidDays'
        | 'dailyRate'
        | 'deduction'
        | 'totalDeductions'
        | 'netPay'
      >
    >
  ) => TUpdate;
}) {
  const updates: Array<{ id: string; data: TUpdate }> = [];
  const updatedResults = new Map<string, TPayroll>();

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

  const schedules =
    employeeIds.length > 0 && globalStart && globalEnd
      ? await fetchSchedules({
          employeeIds,
          start: formatDate(globalStart),
          end: formatDate(globalEnd),
        })
      : [];

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const employeeSchedules = schedules.filter(
      (schedule) => schedule.employeeId === payroll.employeeId
    );
    const { unpaidDays, dailyRate, deduction } = calculateLwopDeductionEngine({
      payroll,
      entry,
      schedules: employeeSchedules,
      getPayrollPeriodRange,
      getEffectiveMonthlySalary,
      parseDate,
      getOverlapScheduledDays,
      roundToCents,
    });

    const totalDeductions = sumPayrollDeductions(payroll, {
      lwop: deduction,
      absentsLates: Number(payroll.absentsLates ?? 0),
    });
    const netPay = roundToCents(
      Math.max(0, Number(payroll.grossPay ?? 0) - totalDeductions)
    );

    const needsUpdate =
      roundToCents(Number(payroll.unpaidDays ?? 0)) !== unpaidDays ||
      roundToCents(Number(payroll.dailyRate ?? 0)) !== dailyRate ||
      roundToCents(Number(payroll.lwop ?? 0)) !== deduction ||
      roundToCents(Number(payroll.totalDeductions ?? 0)) !== totalDeductions ||
      roundToCents(Number(payroll.netPay ?? 0)) !== netPay;

    if (!needsUpdate) {
      continue;
    }

    const nextValues = {
      lwop: deduction,
      unpaidDays,
      dailyRate,
      deduction,
      totalDeductions,
      netPay,
    };

    updates.push({
      id: payroll.id,
      data: createUpdateValues(nextValues),
    });

    updatedResults.set(payroll.id, mergeUpdatedPayroll(payroll, nextValues));
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await persistUpdates(updates);
  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
}

export async function applyAttendanceAdjustmentsGeneric<
  TPayroll extends PayrollLike,
  TUpdate,
  TAttendance extends AttendanceRecordLike,
  TSchedule extends ScheduleRecordLike,
>({
  payrolls,
  employeeDataMap,
  attendanceIndex,
  getPayrollPeriodRange,
  getEffectiveMonthlySalary,
  parseDate,
  parseTimeToMinutes,
  roundToCents,
  toDateOnlyUtc,
  minutesPerDay,
  defaultShiftStart,
  defaultShiftEnd,
  sumPayrollDeductions,
  persistUpdates,
  createUpdateValues,
}: Pick<
  CommonHelpers<TPayroll>,
  | 'getPayrollPeriodRange'
  | 'parseDate'
  | 'roundToCents'
  | 'sumPayrollDeductions'
> & {
  payrolls: TPayroll[];
  employeeDataMap: Map<string, EmployeeMapEntryLike>;
  attendanceIndex: AttendanceDataIndexLike<TAttendance, TSchedule>;
  getEffectiveMonthlySalary: (
    payroll: TPayroll,
    entry: EmployeeMapEntryLike | undefined
  ) => number;
  parseTimeToMinutes: (value?: string | null) => number | null;
  toDateOnlyUtc: (date: Date) => Date;
  minutesPerDay: number;
  defaultShiftStart: string;
  defaultShiftEnd: string;
  persistUpdates: PersistUpdates<TPayroll, TUpdate>;
  createUpdateValues: (
    values: Required<
      Pick<UpdateProjection, 'absentsLates' | 'totalDeductions' | 'netPay'>
    >
  ) => TUpdate;
}) {
  const updates: Array<{ id: string; data: TUpdate }> = [];
  const updatedResults = new Map<string, TPayroll>();

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const attendanceRecords =
      attendanceIndex.attendanceByEmployee.get(payroll.employeeId) ?? [];
    const scheduleRecords =
      attendanceIndex.schedulesByEmployee.get(payroll.employeeId) ?? [];

    const { deduction } = calculateAttendanceDeductionEngine({
      payroll,
      entry,
      attendanceRecords,
      scheduleRecords,
      getPayrollPeriodRange,
      getEffectiveMonthlySalary,
      parseDate,
      parseTimeToMinutes,
      roundToCents,
      toDateOnlyUtc,
      minutesPerDay,
      defaultShiftStart,
      defaultShiftEnd,
    });

    const totalDeductions = sumPayrollDeductions(payroll, {
      absentsLates: deduction,
      lwop: Number(payroll.lwop ?? 0),
    });
    const netPay = roundToCents(
      Math.max(0, Number(payroll.grossPay ?? 0) - totalDeductions)
    );

    const needsUpdate =
      roundToCents(Number(payroll.absentsLates ?? 0)) !== deduction ||
      roundToCents(Number(payroll.totalDeductions ?? 0)) !== totalDeductions ||
      roundToCents(Number(payroll.netPay ?? 0)) !== netPay;

    if (!needsUpdate) {
      continue;
    }

    const nextValues = {
      absentsLates: deduction,
      totalDeductions,
      netPay,
    };

    updates.push({
      id: payroll.id,
      data: createUpdateValues(nextValues),
    });

    updatedResults.set(payroll.id, mergeUpdatedPayroll(payroll, nextValues));
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await persistUpdates(updates);
  for (const record of persisted) {
    updatedResults.set(record.id, record);
  }

  return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
}
