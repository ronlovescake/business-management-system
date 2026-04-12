import type { Prisma } from '@prisma/client';

import type { CashAdvanceCycle } from './cashAdvanceSchedule';
import {
  advanceCycleByOneMonth,
  determineCycleFromDate,
  ensureNextPayday,
} from './cashAdvanceSchedule';
import { mergeCashAdvanceUpdate } from './deductionUpdateHelpers';
import {
  DEFAULT_SHIFT_END,
  DEFAULT_SHIFT_START,
  MINUTES_PER_DAY,
  formatDate,
  getOverlapScheduledDays,
  normalizeIdentifier,
  parseDate,
  parseTimeToMinutes,
  roundToCents,
  sumPayrollDeductions,
  syncPayrollAttendanceDeductionsGeneric,
  syncPayrollDeductionsGeneric,
  syncPayrollLwopGeneric,
  toDateOnlyUtc,
  toDecimalValue,
} from './deductionsShared';
import {
  applyAttendanceAdjustmentsGeneric,
  applyLwopAdjustmentsGeneric,
  applyStatutoryContributionAdjustmentsGeneric,
  applyThirteenthMonthAdjustmentsGeneric,
} from './payrollDeductionAdjustments';

type PayrollLike = {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  periodStart: string | null;
  periodEnd: string | null;
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
  unpaidDays?: number | null;
  dailyRate?: number | null;
  deduction?: number | null;
};

type MinimalEmployee = {
  employeeId: string;
  basicSalary: number | null;
  currentSalary: number | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
};

type MinimalLeaveRequest = {
  id: number;
  employeeId: string | null;
  startDate: string;
  endDate: string;
  numberOfDays: number;
};

type EmployeeMapEntry = {
  employee: MinimalEmployee;
  leaves: MinimalLeaveRequest[];
};

type MinimalAttendance = {
  id: string;
  employeeId: string;
  date: string;
  timeIn: string;
  timeOut: string;
  totalHours: number;
  status: string;
};

type MinimalSchedule = {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  shiftType: string | null;
};

type AttendanceDataIndex = {
  attendanceByEmployee: Map<string, MinimalAttendance[]>;
  schedulesByEmployee: Map<string, MinimalSchedule[]>;
};

type MinimalCashAdvanceRecord = {
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
};

type CashAdvanceIndex = {
  byEmployeeId: Map<string, MinimalCashAdvanceRecord[]>;
  byEmployeeName: Map<string, MinimalCashAdvanceRecord[]>;
};

type ThirteenthMonthRecord = {
  employeeId: string | null;
  employeeName: string | null;
  year: number;
  status: string;
  thirteenthMonthPay: number | { toString(): string };
  approvedDate: string | Date | null;
  paidDate: string | Date | null;
};

type PayrollPeriodRange = {
  start: Date | null;
  end: Date | null;
};

type PayrollCycleMetadata = {
  payDate: Date;
  cycle: CashAdvanceCycle;
};

type ThirteenthMonthUpdateValues = {
  thirteenthMonth: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
};

type StatutoryUpdateValues = {
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  totalDeductions: number;
  netPay: number;
};

type LwopUpdateValues = {
  lwop: number;
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
  totalDeductions: number;
  netPay: number;
};

type AttendanceUpdateValues = {
  absentsLates: number;
  totalDeductions: number;
  netPay: number;
};

type CashAdvancePayrollUpdateValues = {
  cashAdvance: number;
  totalDeductions: number;
  netPay: number;
};

type CashAdvanceRecordUpdateValues = {
  remainingBalance?: Prisma.Decimal;
  settledAmount?: Prisma.Decimal;
  status?: string;
  nextDeductionDate?: Date | null;
  deductionCycle?: CashAdvanceCycle | null;
  lastDeductedDate?: Date;
};

type CashAdvanceDeductionLogValues = {
  cashAdvanceId: string;
  employeeId: string;
  payrollId: string;
  payPeriod: string;
  deductionDate: Date;
  amount: Prisma.Decimal;
};

type PersistUpdate<TPayrollUpdateInput> = {
  id: string;
  data: TPayrollUpdateInput;
};

type PayrollDeductionsClientConfig<
  TPayroll extends PayrollLike,
  TPayrollUpdateInput,
  TCashAdvanceRecordUpdateInput,
  TCashAdvanceDeductionCreateManyInput,
> = {
  getPayrollPeriodRange: (payroll: TPayroll) => PayrollPeriodRange;
  getPayrollCycleMetadata: (payroll: TPayroll) => PayrollCycleMetadata | null;
  getEffectiveMonthlySalary: (
    payroll: TPayroll,
    entry: EmployeeMapEntry | undefined
  ) => number;
  findEmployees: (employeeIds: string[]) => Promise<MinimalEmployee[]>;
  findLeaveRequests: (
    employeeIds: string[]
  ) => Promise<MinimalLeaveRequest[]>;
  findAttendance: (
    employeeIds: string[],
    start: string,
    end: string
  ) => Promise<MinimalAttendance[]>;
  findSchedules: (
    employeeIds: string[],
    start: string,
    end: string
  ) => Promise<MinimalSchedule[]>;
  findCashAdvanceRecords: (
    employeeIds: string[],
    employeeNames: string[]
  ) => Promise<MinimalCashAdvanceRecord[]>;
  findThirteenthMonthRecords: (
    relevantYears: number[]
  ) => Promise<ThirteenthMonthRecord[]>;
  persistPayrollUpdates: (
    updates: Array<PersistUpdate<TPayrollUpdateInput>>
  ) => Promise<TPayroll[]>;
  createThirteenthMonthUpdate: (
    values: ThirteenthMonthUpdateValues
  ) => TPayrollUpdateInput;
  createStatutoryUpdate: (
    values: StatutoryUpdateValues
  ) => TPayrollUpdateInput;
  createLwopUpdate: (values: LwopUpdateValues) => TPayrollUpdateInput;
  createAttendanceUpdate: (
    values: AttendanceUpdateValues
  ) => TPayrollUpdateInput;
  createCashAdvancePayrollUpdate: (
    values: CashAdvancePayrollUpdateValues
  ) => TPayrollUpdateInput;
  createCashAdvanceRecordUpdate: (
    values: CashAdvanceRecordUpdateValues
  ) => TCashAdvanceRecordUpdateInput;
  createCashAdvanceDeductionLog: (
    values: CashAdvanceDeductionLogValues
  ) => TCashAdvanceDeductionCreateManyInput;
  persistCashAdvanceEffects: (params: {
    recordUpdates: Map<string, TCashAdvanceRecordUpdateInput>;
    deductionLogs: TCashAdvanceDeductionCreateManyInput[];
  }) => Promise<void>;
};

export function createPayrollDeductionsClient<
  TPayroll extends PayrollLike,
  TPayrollUpdateInput,
  TCashAdvanceRecordUpdateInput,
  TCashAdvanceDeductionCreateManyInput,
>(
  config: PayrollDeductionsClientConfig<
    TPayroll,
    TPayrollUpdateInput,
    TCashAdvanceRecordUpdateInput,
    TCashAdvanceDeductionCreateManyInput
  >
) {
  const buildEmployeeDataMap = async (
    payrolls: TPayroll[]
  ): Promise<Map<string, EmployeeMapEntry>> => {
    const employeeIds = Array.from(
      new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
    );

    if (employeeIds.length === 0) {
      return new Map();
    }

    const [employees, leaveRequests] = await Promise.all([
      config.findEmployees(employeeIds),
      config.findLeaveRequests(employeeIds),
    ]);

    const leaveByEmployee = leaveRequests.reduce<
      Map<string, MinimalLeaveRequest[]>
    >((acc, leave) => {
      if (!leave.employeeId) {
        return acc;
      }

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
    payrolls: TPayroll[]
  ): Promise<AttendanceDataIndex> => {
    const employeeIds = Array.from(
      new Set(payrolls.map((payroll) => payroll.employeeId).filter(Boolean))
    );

    let globalStart: Date | null = null;
    let globalEnd: Date | null = null;

    for (const payroll of payrolls) {
      const { start, end } = config.getPayrollPeriodRange(payroll);
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
      config.findAttendance(employeeIds, startStr, endStr),
      config.findSchedules(employeeIds, startStr, endStr),
    ]);

    const attendanceByEmployee = attendance.reduce<
      Map<string, MinimalAttendance[]>
    >((acc, record) => {
      const list = acc.get(record.employeeId) ?? [];
      list.push(record);
      acc.set(record.employeeId, list);
      return acc;
    }, new Map());

    const schedulesByEmployee = schedules.reduce<
      Map<string, MinimalSchedule[]>
    >((acc, schedule) => {
      const list = acc.get(schedule.employeeId) ?? [];
      list.push(schedule);
      acc.set(schedule.employeeId, list);
      return acc;
    }, new Map());

    return { attendanceByEmployee, schedulesByEmployee };
  };

  const buildCashAdvanceIndex = async (
    payrolls: TPayroll[]
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

    const records = await config.findCashAdvanceRecords(employeeIds, employeeNames);

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
    payrolls: TPayroll[]
  ): Promise<TPayroll[]> =>
    applyThirteenthMonthAdjustmentsGeneric({
      payrolls,
      getPayrollPeriodRange: config.getPayrollPeriodRange,
      roundToCents,
      normalizeIdentifier,
      parseDate: (value?: string | Date | null) =>
        value instanceof Date ? value : parseDate(value),
      sumPayrollDeductions,
      findThirteenthMonthRecords: config.findThirteenthMonthRecords,
      persistUpdates: config.persistPayrollUpdates,
      createUpdateValues: config.createThirteenthMonthUpdate,
    });

  const applyStatutoryContributionAdjustments = async (
    payrolls: TPayroll[],
    employeeDataMap: Map<string, EmployeeMapEntry>
  ): Promise<TPayroll[]> =>
    applyStatutoryContributionAdjustmentsGeneric({
      payrolls,
      employeeDataMap,
      roundToCents,
      sumPayrollDeductions,
      persistUpdates: config.persistPayrollUpdates,
      createUpdateValues: config.createStatutoryUpdate,
    });

  const applyLwopAdjustments = async (
    payrolls: TPayroll[],
    employeeDataMap: Map<string, EmployeeMapEntry>
  ): Promise<TPayroll[]> =>
    applyLwopAdjustmentsGeneric({
      payrolls,
      employeeDataMap,
      getPayrollPeriodRange: config.getPayrollPeriodRange,
      getEffectiveMonthlySalary: (payroll, entry) =>
        config.getEffectiveMonthlySalary(
          payroll,
          entry as EmployeeMapEntry | undefined
        ),
      fetchSchedules: ({ employeeIds, start, end }) =>
        config.findSchedules(employeeIds, start, end),
      formatDate,
      getOverlapScheduledDays,
      parseDate: (value?: string | Date | null) =>
        value instanceof Date ? value : parseDate(value),
      roundToCents,
      sumPayrollDeductions,
      persistUpdates: config.persistPayrollUpdates,
      createUpdateValues: config.createLwopUpdate,
    });

  const applyAttendanceAdjustments = async (
    payrolls: TPayroll[],
    employeeDataMap: Map<string, EmployeeMapEntry>,
    attendanceIndex: AttendanceDataIndex
  ): Promise<TPayroll[]> =>
    applyAttendanceAdjustmentsGeneric({
      payrolls,
      employeeDataMap,
      attendanceIndex,
      getPayrollPeriodRange: config.getPayrollPeriodRange,
      getEffectiveMonthlySalary: (payroll, entry) =>
        config.getEffectiveMonthlySalary(
          payroll,
          entry as EmployeeMapEntry | undefined
        ),
      parseDate: (value?: string | Date | null) =>
        value instanceof Date ? value : parseDate(value),
      parseTimeToMinutes,
      roundToCents,
      toDateOnlyUtc,
      minutesPerDay: MINUTES_PER_DAY,
      defaultShiftStart: DEFAULT_SHIFT_START,
      defaultShiftEnd: DEFAULT_SHIFT_END,
      sumPayrollDeductions,
      persistUpdates: config.persistPayrollUpdates,
      createUpdateValues: config.createAttendanceUpdate,
    });

  const applyCashAdvanceAdjustments = async (
    payrolls: TPayroll[]
  ): Promise<TPayroll[]> => {
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

    const cashAdvanceUpdates = new Map<string, TCashAdvanceRecordUpdateInput>();
    const deductionLogs: TCashAdvanceDeductionCreateManyInput[] = [];
    const payrollUpdates: Array<PersistUpdate<TPayrollUpdateInput>> = [];
    const updatedPayrolls = new Map<string, TPayroll>();

    for (const payroll of payrolls) {
      const cycleMeta = config.getPayrollCycleMetadata(payroll);
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
            mergeCashAdvanceUpdate(
              cashAdvanceUpdates,
              advance.id,
              config.createCashAdvanceRecordUpdate({
                status: 'paid',
                remainingBalance: toDecimalValue(0),
                nextDeductionDate: null,
                deductionCycle: null,
              })
            );
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
            mergeCashAdvanceUpdate(
              cashAdvanceUpdates,
              advance.id,
              config.createCashAdvanceRecordUpdate({
                nextDeductionDate: schedule.date,
                deductionCycle: schedule.cycle,
              })
            );
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

          mergeCashAdvanceUpdate(
            cashAdvanceUpdates,
            advance.id,
            config.createCashAdvanceRecordUpdate({
              remainingBalance: toDecimalValue(remaining),
              settledAmount: toDecimalValue(settled),
              status: nextStatus,
              nextDeductionDate: nextScheduleDate,
              deductionCycle: nextCycle ?? null,
              lastDeductedDate: payDate,
            })
          );

          deductionLogs.push(
            config.createCashAdvanceDeductionLog({
              cashAdvanceId: advance.id,
              employeeId: advance.employeeId,
              payrollId: payroll.id,
              payPeriod: payroll.payPeriod,
              deductionDate: payDate,
              amount: toDecimalValue(deduction),
            })
          );

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
          Math.max(0, Number(payroll.grossPay ?? 0) - totalDeductions)
        );

        payrollUpdates.push({
          id: payroll.id,
          data: config.createCashAdvancePayrollUpdate({
            cashAdvance: roundedTotal,
            totalDeductions,
            netPay,
          }),
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
      await config.persistCashAdvanceEffects({
        recordUpdates: cashAdvanceUpdates,
        deductionLogs,
      });
    }

    if (payrollUpdates.length > 0) {
      const persisted = await config.persistPayrollUpdates(payrollUpdates);

      for (const record of persisted) {
        updatedPayrolls.set(record.id, record);
      }
    }

    return payrolls.map((payroll) => updatedPayrolls.get(payroll.id) ?? payroll);
  };

  return {
    syncPayrollLwop: (payrolls: TPayroll[]) =>
      syncPayrollLwopGeneric(payrolls, buildEmployeeDataMap, applyLwopAdjustments),
    syncPayrollAttendanceDeductions: (payrolls: TPayroll[]) =>
      syncPayrollAttendanceDeductionsGeneric(
        payrolls,
        buildEmployeeDataMap,
        buildAttendanceDataIndex,
        applyAttendanceAdjustments
      ),
    syncPayrollDeductions: (payrolls: TPayroll[]) =>
      syncPayrollDeductionsGeneric(
        payrolls,
        buildEmployeeDataMap,
        applyStatutoryContributionAdjustments,
        applyThirteenthMonthAdjustments,
        applyLwopAdjustments,
        buildAttendanceDataIndex,
        applyAttendanceAdjustments,
        applyCashAdvanceAdjustments
      ),
  };
}