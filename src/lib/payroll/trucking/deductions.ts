import type { Prisma } from '@prisma/client';
import type { TruckingPayroll } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  extractPeriodBounds,
  formatDate,
  getOverlapScheduledDays,
  normalizeIdentifier,
  parseDate,
  parsePeriodDate,
  parseTimeToMinutes,
  roundToCents,
  toDateOnlyUtc,
  toDecimalValue,
} from '../deductionsShared';
import type { CashAdvanceCycle } from '../cashAdvanceSchedule';
import {
  advanceCycleByOneMonth,
  determineCycleFromDate,
  ensureNextPayday,
} from '../cashAdvanceSchedule';

const getTruckingPayrollPeriodRange = (
  payroll: TruckingPayroll
): { start: Date | null; end: Date | null } => {
  const periodFallback = extractPeriodBounds(payroll.payPeriod);
  const start = parsePeriodDate(payroll.periodStart, periodFallback.start);
  const end = parsePeriodDate(payroll.periodEnd, periodFallback.end);

  if (!start || !end || start > end) {
    return { start: null, end: null };
  }

  return { start, end };
};

const getTruckingPayrollCycleMetadata = (
  payroll: TruckingPayroll
): { payDate: Date; cycle: CashAdvanceCycle } | null => {
  const { end } = getTruckingPayrollPeriodRange(payroll);
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
  payroll: TruckingPayroll,
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

/**
 * Count scheduled working days for an employee within a date range
 * @param employeeId - The employee ID
 * @param start - Start date (inclusive)
 * @param end - End date (inclusive)
 * @param schedules - Array of schedule records for the employee
 * @returns Number of days the employee has schedules
 */

interface MinimalEmployee {
  employeeId: string;
  basicSalary: number | null;
  currentSalary: number | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
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
  payrolls: TruckingPayroll[]
): Promise<Map<string, EmployeeMapEntry>> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  if (employeeIds.length === 0) {
    return new Map();
  }

  const [employees, leaveRequests] = await Promise.all([
    prisma.truckingEmployee.findMany({
      where: { employeeId: { in: employeeIds } },
      select: {
        employeeId: true,
        basicSalary: true,
        currentSalary: true,
        sssMonthlyContribution: true,
        philHealthMonthlyContribution: true,
        pagibigMonthlyContribution: true,
        taxMonthlyContribution: true,
      },
    }),
    prisma.truckingLeaveRequest.findMany({
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
  payrolls: TruckingPayroll[]
): Promise<AttendanceDataIndex> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  let globalStart: Date | null = null;
  let globalEnd: Date | null = null;

  for (const payroll of payrolls) {
    const { start, end } = getTruckingPayrollPeriodRange(payroll);
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
    prisma.truckingAttendance.findMany({
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
    prisma.truckingSchedule.findMany({
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
  payrolls: TruckingPayroll[]
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

  const records = await prisma.truckingCashAdvanceRecord.findMany({
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
  payroll: TruckingPayroll,
  overrides: Partial<
    Pick<
      TruckingPayroll,
      | 'sss'
      | 'philHealth'
      | 'pagIbig'
      | 'tax'
      | 'loans'
      | 'cashAdvance'
      | 'absentsLates'
      | 'lwop'
    >
  > = {}
): number => {
  const sssValue = overrides.sss ?? payroll.sss;
  const philHealthValue = overrides.philHealth ?? payroll.philHealth;
  const pagIbigValue = overrides.pagIbig ?? payroll.pagIbig;
  const taxValue = overrides.tax ?? payroll.tax;
  const loansValue = overrides.loans ?? payroll.loans;
  const cashAdvanceValue = overrides.cashAdvance ?? payroll.cashAdvance;
  const absentsLatesValue = overrides.absentsLates ?? payroll.absentsLates;
  const lwopValue = overrides.lwop ?? payroll.lwop;

  const parts = [
    sssValue,
    philHealthValue,
    pagIbigValue,
    taxValue,
    loansValue,
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
  store: Map<string, Prisma.TruckingCashAdvanceRecordUpdateInput>,
  id: string,
  update: Prisma.TruckingCashAdvanceRecordUpdateInput
) => {
  const existing = store.get(id);
  if (existing) {
    store.set(id, { ...existing, ...update });
    return;
  }
  store.set(id, update);
};

const selectThirteenthMonthTarget = (
  candidates: Array<{
    payroll: TruckingPayroll;
    start: Date | null;
    end: Date | null;
  }>,
  _approvedDate: Date | null,
  _paidDate: Date | null
) => {
  if (candidates.length === 0) {
    return null;
  }

  // Always select the latest (current) pay period only
  // Do NOT apply 13th month to previous/past periods
  const latest = candidates.reduce((latestCandidate, candidate) => {
    if (!latestCandidate.end) {
      return candidate;
    }
    if (!candidate.end) {
      return latestCandidate;
    }
    return candidate.end > latestCandidate.end ? candidate : latestCandidate;
  }, candidates[0]);

  return latest;
};

const applyThirteenthMonthAdjustments = async (
  payrolls: TruckingPayroll[]
): Promise<TruckingPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const payrollMeta = payrolls.map((payroll) => {
    const { start, end } = getTruckingPayrollPeriodRange(payroll);
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

  const thirteenthMonthDelegate = prisma.thirteenthMonthPayRecord;

  if (!thirteenthMonthDelegate?.findMany) {
    return payrolls;
  }

  const thirteenthRecords = await thirteenthMonthDelegate.findMany({
    where: {
      status: { in: ['approved', 'paid'] },
      year: { in: relevantYears },
    },
    select: {
      recordId: true,
      employeeId: true,
      employeeName: true,
      year: true,
      status: true,
      thirteenthMonthPay: true,
      approvedDate: true,
      paidDate: true,
    },
  });

  if (thirteenthRecords.length === 0) {
    return payrolls;
  }

  const updates: Array<{
    id: string;
    data: Prisma.TruckingPayrollUpdateInput;
  }> = [];
  const updatedResults = new Map<string, TruckingPayroll>();

  for (const record of thirteenthRecords) {
    // CRITICAL FIX: If 13th month is already marked as 'paid', NEVER apply it to any payroll
    // This prevents duplicate inclusion when payrolls are deleted/regenerated
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

    const approvedDate = parseDate(record.approvedDate);
    const paidDate = parseDate(record.paidDate);
    const target = selectThirteenthMonthTarget(
      candidates,
      approvedDate,
      paidDate
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

      // Avoid resetting other payrolls if they already match desired amount
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

      const totalDeductions = sumDeductions({
        ...payroll,
        thirteenthMonth: desiredAmount,
      } as TruckingPayroll);
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

      const updateValues = {
        thirteenthMonth: desiredAmount,
        grossPay,
        totalDeductions,
        netPay,
      } satisfies Prisma.TruckingPayrollUpdateInput;

      updates.push({ id: payroll.id, data: updateValues });

      updatedResults.set(payroll.id, {
        ...payroll,
        ...(updateValues as Partial<TruckingPayroll>),
      });
    }
  }

  if (updates.length === 0) {
    return payrolls.map((payroll) => updatedResults.get(payroll.id) ?? payroll);
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.truckingPayroll.update({
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

const applyStatutoryContributionAdjustments = async (
  payrolls: TruckingPayroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<TruckingPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const updates: Array<{
    id: string;
    data: Prisma.TruckingPayrollUpdateInput;
  }> = [];
  const updatedResults = new Map<string, TruckingPayroll>();

  for (const payroll of payrolls) {
    // CRITICAL FIX: Do NOT sync statutory contributions for paid or approved payrolls
    // These should retain their historical values as they were at the time of payment/approval
    if (payroll.status === 'paid' || payroll.status === 'approved') {
      continue;
    }

    const entry = employeeDataMap.get(payroll.employeeId);
    const employee = entry?.employee;

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

    const overrides = {
      sss: desiredSss,
      philHealth: desiredPhilHealth,
      pagIbig: desiredPagIbig,
      tax: desiredTax,
    } as Partial<TruckingPayroll>;

    const currentSss = roundToCents(Number(payroll.sss ?? 0));
    const currentPhilHealth = roundToCents(Number(payroll.philHealth ?? 0));
    const currentPagIbig = roundToCents(Number(payroll.pagIbig ?? 0));
    const currentTax = roundToCents(Number(payroll.tax ?? 0));

    const totalDeductions = sumDeductions(payroll, overrides);
    const netPay = roundToCents(
      Math.max(0, Number(payroll.grossPay ?? 0) - totalDeductions)
    );

    const currentTotal = roundToCents(Number(payroll.totalDeductions ?? 0));
    const currentNetPay = roundToCents(Number(payroll.netPay ?? 0));

    const needsUpdate =
      currentSss !== desiredSss ||
      currentPhilHealth !== desiredPhilHealth ||
      currentPagIbig !== desiredPagIbig ||
      currentTax !== desiredTax ||
      currentTotal !== totalDeductions ||
      currentNetPay !== netPay;

    if (!needsUpdate) {
      continue;
    }

    const updateValues = {
      sss: desiredSss,
      philHealth: desiredPhilHealth,
      pagIbig: desiredPagIbig,
      tax: desiredTax,
      totalDeductions,
      netPay,
    } satisfies Prisma.TruckingPayrollUpdateInput;

    updates.push({ id: payroll.id, data: updateValues });

    updatedResults.set(payroll.id, {
      ...payroll,
      ...(updateValues as Partial<TruckingPayroll>),
    });
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.truckingPayroll.update({
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

const calculateLwopForTruckingPayroll = (
  payroll: TruckingPayroll,
  entry: EmployeeMapEntry | undefined,
  schedules: MinimalSchedule[] = []
): {
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
} => {
  const { start: periodStart, end: periodEnd } =
    getTruckingPayrollPeriodRange(payroll);

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
  payrolls: TruckingPayroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<TruckingPayroll[]> => {
  const updates: Array<{
    id: string;
    data: Prisma.TruckingPayrollUpdateInput;
  }> = [];
  const updatedResults = new Map<string, TruckingPayroll>();

  // Fetch schedules for all employees and date ranges
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  let globalStart: Date | null = null;
  let globalEnd: Date | null = null;

  for (const payroll of payrolls) {
    const { start, end } = getTruckingPayrollPeriodRange(payroll);
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
      ? await prisma.truckingSchedule.findMany({
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
    const { unpaidDays, dailyRate, deduction } =
      calculateLwopForTruckingPayroll(payroll, entry, employeeSchedules);

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
    } satisfies Prisma.TruckingPayrollUpdateInput;

    updates.push({ id: payroll.id, data: updateValues });

    updatedResults.set(payroll.id, {
      ...payroll,
      ...(updateValues as Partial<TruckingPayroll>),
    });
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.truckingPayroll.update({
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

export const syncTruckingPayrollLwop = async (
  payrolls: TruckingPayroll[]
): Promise<TruckingPayroll[]> => {
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

const calculateAbsentsLatesForTruckingPayroll = (
  payroll: TruckingPayroll,
  entry: EmployeeMapEntry | undefined,
  attendanceRecords: MinimalAttendance[] = [],
  scheduleRecords: MinimalSchedule[] = []
): AttendanceDeductionResult => {
  const { start: periodStart, end: periodEnd } =
    getTruckingPayrollPeriodRange(payroll);

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
  payrolls: TruckingPayroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>,
  attendanceIndex: AttendanceDataIndex
): Promise<TruckingPayroll[]> => {
  const updates: Array<{
    id: string;
    data: Prisma.TruckingPayrollUpdateInput;
  }> = [];
  const updatedResults = new Map<string, TruckingPayroll>();

  for (const payroll of payrolls) {
    const entry = employeeDataMap.get(payroll.employeeId);
    const attendanceRecords =
      attendanceIndex.attendanceByEmployee.get(payroll.employeeId) ?? [];
    const scheduleRecords =
      attendanceIndex.schedulesByEmployee.get(payroll.employeeId) ?? [];

    const { deduction } = calculateAbsentsLatesForTruckingPayroll(
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
    } satisfies Prisma.TruckingPayrollUpdateInput;

    updates.push({ id: payroll.id, data: updateValues });

    updatedResults.set(payroll.id, {
      ...payroll,
      ...(updateValues as Partial<TruckingPayroll>),
    });
  }

  if (updates.length === 0) {
    return payrolls;
  }

  const persisted = await prisma.$transaction(
    updates.map(({ id, data }) =>
      prisma.truckingPayroll.update({
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

export const syncTruckingPayrollAttendanceDeductions = async (
  payrolls: TruckingPayroll[]
): Promise<TruckingPayroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  const attendanceIndex = await buildAttendanceDataIndex(payrolls);

  return applyAttendanceAdjustments(payrolls, employeeDataMap, attendanceIndex);
};

const applyCashAdvanceAdjustments = async (
  payrolls: TruckingPayroll[]
): Promise<TruckingPayroll[]> => {
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
    Prisma.TruckingCashAdvanceRecordUpdateInput
  >();
  const deductionLogs: Prisma.TruckingCashAdvanceDeductionCreateManyInput[] =
    [];
  const payrollUpdates: Array<{
    id: string;
    data: Prisma.TruckingPayrollUpdateInput;
  }> = [];
  const updatedTruckingPayrolls = new Map<string, TruckingPayroll>();

  for (const payroll of payrolls) {
    const cycleMeta = getTruckingPayrollCycleMetadata(payroll);
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

      updatedTruckingPayrolls.set(payroll.id, {
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
        prisma.truckingCashAdvanceRecord.update({
          where: { id },
          data,
        })
      );
    });

    if (deductionLogs.length > 0) {
      operations.push(
        prisma.truckingCashAdvanceDeduction.createMany({
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
        prisma.truckingPayroll.update({
          where: { id },
          data,
        })
      )
    );

    for (const record of persisted) {
      updatedTruckingPayrolls.set(record.id, record);
    }
  }

  return payrolls.map(
    (payroll) => updatedTruckingPayrolls.get(payroll.id) ?? payroll
  );
};

export const syncTruckingPayrollDeductions = async (
  payrolls: TruckingPayroll[]
): Promise<TruckingPayroll[]> => {
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
