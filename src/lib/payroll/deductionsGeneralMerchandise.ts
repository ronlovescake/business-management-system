import type { Prisma } from '@prisma/client';
import type { Payroll } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  MINUTES_PER_DAY,
  formatDate,
  getEffectiveMonthlySalary as getSharedEffectiveMonthlySalary,
  getOverlapScheduledDays,
  getPayrollCycleMetadataFromFields,
  getPayrollPeriodRangeFromFields,
  normalizeIdentifier,
  parseDate,
  parseTimeToMinutes,
  roundToCents,
  sumPayrollDeductions,
  toDateOnlyUtc,
  toDecimalValue,
} from './deductionsShared';
import type { CashAdvanceCycle } from './cashAdvanceSchedule';
import {
  advanceCycleByOneMonth,
  determineCycleFromDate,
  ensureNextPayday,
} from './cashAdvanceSchedule';
import { mergeCashAdvanceUpdate } from './deductionUpdateHelpers';
import {
  applyAttendanceAdjustmentsGeneric,
  applyLwopAdjustmentsGeneric,
  applyStatutoryContributionAdjustmentsGeneric,
  applyThirteenthMonthAdjustmentsGeneric,
} from './payrollDeductionAdjustments';

type GMDeductionsClient = Pick<
  typeof prisma,
  | 'generalMerchandiseEmployee'
  | 'generalMerchandiseLeaveRequest'
  | 'generalMerchandiseAttendance'
  | 'generalMerchandiseSchedule'
  | 'generalMerchandiseCashAdvanceRecord'
  | 'generalMerchandiseCashAdvanceDeduction'
  | 'generalMerchandisePayroll'
  | 'generalMerchandiseThirteenthMonthPayRecord'
>;

const gmPrisma: GMDeductionsClient = prisma;

const getPayrollPeriodRange = (
  payroll: Payroll
): { start: Date | null; end: Date | null } =>
  getPayrollPeriodRangeFromFields(
    payroll.payPeriod,
    payroll.periodStart,
    payroll.periodEnd
  );

const getPayrollCycleMetadata = (
  payroll: Payroll
): { payDate: Date; cycle: CashAdvanceCycle } | null => {
  return getPayrollCycleMetadataFromFields(
    payroll.payPeriod,
    payroll.periodStart,
    payroll.periodEnd,
    determineCycleFromDate
  ) as { payDate: Date; cycle: CashAdvanceCycle } | null;
};

const getEffectiveMonthlySalary = (
  payroll: Payroll,
  entry: EmployeeMapEntry | undefined
): number =>
  getSharedEffectiveMonthlySalary(payroll.basicSalary, entry?.employee);

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
  payrolls: Payroll[]
): Promise<Map<string, EmployeeMapEntry>> => {
  const employeeIds = Array.from(
    new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
  );

  if (employeeIds.length === 0) {
    return new Map();
  }

  const [employees, leaveRequests] = await Promise.all([
    gmPrisma.generalMerchandiseEmployee.findMany({
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
    gmPrisma.generalMerchandiseLeaveRequest.findMany({
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
    gmPrisma.generalMerchandiseAttendance.findMany({
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
    gmPrisma.generalMerchandiseSchedule.findMany({
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

  const records = await gmPrisma.generalMerchandiseCashAdvanceRecord.findMany({
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

const applyThirteenthMonthAdjustments = async (
  payrolls: Payroll[]
): Promise<Payroll[]> =>
  applyThirteenthMonthAdjustmentsGeneric({
    payrolls,
    getPayrollPeriodRange,
    roundToCents,
    normalizeIdentifier,
    parseDate: (value?: string | Date | null) =>
      value instanceof Date ? value : parseDate(value),
    sumPayrollDeductions,
    findThirteenthMonthRecords: (relevantYears) =>
      gmPrisma.generalMerchandiseThirteenthMonthPayRecord.findMany({
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
      }),
    persistUpdates: async (
      updates: Array<{
        id: string;
        data: Prisma.GeneralMerchandisePayrollUpdateInput;
      }>
    ) =>
      prisma.$transaction(
        updates.map(({ id, data }) =>
          gmPrisma.generalMerchandisePayroll.update({
            where: { id },
            data,
          })
        )
      ),
    createUpdateValues: (
      values
    ): Prisma.GeneralMerchandisePayrollUpdateInput => {
      return {
        thirteenthMonth: values.thirteenthMonth,
        grossPay: values.grossPay,
        totalDeductions: values.totalDeductions,
        netPay: values.netPay,
      } satisfies Prisma.PayrollUpdateInput;
    },
  });

const applyStatutoryContributionAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<Payroll[]> =>
  applyStatutoryContributionAdjustmentsGeneric({
    payrolls,
    employeeDataMap,
    roundToCents,
    sumPayrollDeductions,
    persistUpdates: async (
      updates: Array<{
        id: string;
        data: Prisma.GeneralMerchandisePayrollUpdateInput;
      }>
    ) =>
      prisma.$transaction(
        updates.map(({ id, data }) =>
          gmPrisma.generalMerchandisePayroll.update({
            where: { id },
            data,
          })
        )
      ),
    createUpdateValues: (
      values
    ): Prisma.GeneralMerchandisePayrollUpdateInput => {
      return {
        sss: values.sss,
        philHealth: values.philHealth,
        pagIbig: values.pagIbig,
        tax: values.tax,
        totalDeductions: values.totalDeductions,
        netPay: values.netPay,
      } satisfies Prisma.PayrollUpdateInput;
    },
  });

const applyLwopAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>
): Promise<Payroll[]> =>
  applyLwopAdjustmentsGeneric({
    payrolls,
    employeeDataMap,
    getPayrollPeriodRange,
    getEffectiveMonthlySalary: (payroll, entry) =>
      getEffectiveMonthlySalary(payroll, entry as EmployeeMapEntry | undefined),
    fetchSchedules: ({ employeeIds, start, end }) =>
      gmPrisma.generalMerchandiseSchedule.findMany({
        where: {
          employeeId: { in: employeeIds },
          deletedAt: null,
          date: {
            gte: start,
            lte: end,
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
    formatDate,
    getOverlapScheduledDays,
    parseDate: (value?: string | Date | null) =>
      value instanceof Date ? value : parseDate(value),
    roundToCents,
    sumPayrollDeductions,
    persistUpdates: async (
      updates: Array<{
        id: string;
        data: Prisma.GeneralMerchandisePayrollUpdateInput;
      }>
    ) =>
      prisma.$transaction(
        updates.map(({ id, data }) =>
          gmPrisma.generalMerchandisePayroll.update({
            where: { id },
            data,
          })
        )
      ),
    createUpdateValues: (
      values
    ): Prisma.GeneralMerchandisePayrollUpdateInput => {
      return {
        lwop: values.lwop,
        unpaidDays: values.unpaidDays,
        dailyRate: values.dailyRate,
        deduction: values.deduction,
        totalDeductions: values.totalDeductions,
        netPay: values.netPay,
      } satisfies Prisma.PayrollUpdateInput;
    },
  });

export const syncPayrollLwopGeneralMerchandise = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
  if (payrolls.length === 0) {
    return payrolls;
  }

  const employeeDataMap = await buildEmployeeDataMap(payrolls);
  return applyLwopAdjustments(payrolls, employeeDataMap);
};

const applyAttendanceAdjustments = async (
  payrolls: Payroll[],
  employeeDataMap: Map<string, EmployeeMapEntry>,
  attendanceIndex: AttendanceDataIndex
): Promise<Payroll[]> =>
  applyAttendanceAdjustmentsGeneric({
    payrolls,
    employeeDataMap,
    attendanceIndex,
    getPayrollPeriodRange,
    getEffectiveMonthlySalary: (payroll, entry) =>
      getEffectiveMonthlySalary(payroll, entry as EmployeeMapEntry | undefined),
    parseDate: (value?: string | Date | null) =>
      value instanceof Date ? value : parseDate(value),
    parseTimeToMinutes,
    roundToCents,
    toDateOnlyUtc,
    minutesPerDay: MINUTES_PER_DAY,
    defaultShiftStart: DEFAULT_SHIFT_START,
    defaultShiftEnd: DEFAULT_SHIFT_END,
    sumPayrollDeductions,
    persistUpdates: async (
      updates: Array<{
        id: string;
        data: Prisma.GeneralMerchandisePayrollUpdateInput;
      }>
    ) =>
      prisma.$transaction(
        updates.map(({ id, data }) =>
          gmPrisma.generalMerchandisePayroll.update({
            where: { id },
            data,
          })
        )
      ),
    createUpdateValues: (
      values
    ): Prisma.GeneralMerchandisePayrollUpdateInput => {
      return {
        absentsLates: values.absentsLates,
        totalDeductions: values.totalDeductions,
        netPay: values.netPay,
      } satisfies Prisma.PayrollUpdateInput;
    },
  });

export const syncPayrollAttendanceDeductionsGeneralMerchandise = async (
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
    Prisma.GeneralMerchandiseCashAdvanceRecordUpdateInput
  >();
  const deductionLogs: Prisma.GeneralMerchandiseCashAdvanceDeductionCreateManyInput[] =
    [];
  const payrollUpdates: Array<{
    id: string;
    data: Prisma.GeneralMerchandisePayrollUpdateInput;
  }> = [];
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
      const totalDeductions = sumPayrollDeductions(payroll, {
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
        gmPrisma.generalMerchandiseCashAdvanceRecord.update({
          where: { id },
          data,
        })
      );
    });

    if (deductionLogs.length > 0) {
      operations.push(
        gmPrisma.generalMerchandiseCashAdvanceDeduction.createMany({
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
        gmPrisma.generalMerchandisePayroll.update({
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

export const syncPayrollDeductionsGeneralMerchandise = async (
  payrolls: Payroll[]
): Promise<Payroll[]> => {
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
