import type { Payroll, Prisma } from '@prisma/client';

import { prisma } from '@/lib/db';

import type { CashAdvanceCycle } from './cashAdvanceSchedule';
import { determineCycleFromDate } from './cashAdvanceSchedule';
import {
  getEffectiveMonthlySalary as getSharedEffectiveMonthlySalary,
  getPayrollCycleMetadataFromFields,
  getPayrollPeriodRangeFromFields,
} from './deductionsShared';
import { createPayrollDeductionsClient } from './deductionsClientFactory';

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
  entry:
    | {
        employee: {
          basicSalary?: number | null;
          currentSalary?: number | null;
        };
      }
    | undefined
): number => getSharedEffectiveMonthlySalary(payroll.basicSalary, entry?.employee);

const gmDeductionsClient = createPayrollDeductionsClient<
  Payroll,
  Prisma.GeneralMerchandisePayrollUpdateInput,
  Prisma.GeneralMerchandiseCashAdvanceRecordUpdateInput,
  Prisma.GeneralMerchandiseCashAdvanceDeductionCreateManyInput
>({
  getPayrollPeriodRange,
  getPayrollCycleMetadata,
  getEffectiveMonthlySalary,
  findEmployees: (employeeIds) =>
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
  findLeaveRequests: (employeeIds) =>
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
  findAttendance: (employeeIds, start, end) =>
    gmPrisma.generalMerchandiseAttendance.findMany({
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
        timeIn: true,
        timeOut: true,
        totalHours: true,
        status: true,
      },
    }),
  findSchedules: (employeeIds, start, end) =>
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
  findCashAdvanceRecords: (employeeIds, employeeNames) =>
    gmPrisma.generalMerchandiseCashAdvanceRecord.findMany({
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
    }),
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
  persistPayrollUpdates: (updates) =>
    prisma.$transaction(
      updates.map(({ id, data }) =>
        gmPrisma.generalMerchandisePayroll.update({
          where: { id },
          data,
        })
      )
    ),
  createThirteenthMonthUpdate: (values) => ({
    thirteenthMonth: values.thirteenthMonth,
    grossPay: values.grossPay,
    totalDeductions: values.totalDeductions,
    netPay: values.netPay,
  }),
  createStatutoryUpdate: (values) => ({
    sss: values.sss,
    philHealth: values.philHealth,
    pagIbig: values.pagIbig,
    tax: values.tax,
    totalDeductions: values.totalDeductions,
    netPay: values.netPay,
  }),
  createLwopUpdate: (values) => ({
    lwop: values.lwop,
    unpaidDays: values.unpaidDays,
    dailyRate: values.dailyRate,
    deduction: values.deduction,
    totalDeductions: values.totalDeductions,
    netPay: values.netPay,
  }),
  createAttendanceUpdate: (values) => ({
    absentsLates: values.absentsLates,
    totalDeductions: values.totalDeductions,
    netPay: values.netPay,
  }),
  createCashAdvancePayrollUpdate: (values) => ({
    cashAdvance: values.cashAdvance,
    totalDeductions: values.totalDeductions,
    netPay: values.netPay,
  }),
  createCashAdvanceRecordUpdate: (values) => values,
  createCashAdvanceDeductionLog: (values) => values,
  persistCashAdvanceEffects: async ({ recordUpdates, deductionLogs }) => {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    recordUpdates.forEach((data, id) => {
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
  },
});

export const syncPayrollLwopGeneralMerchandise =
  gmDeductionsClient.syncPayrollLwop;

export const syncPayrollAttendanceDeductionsGeneralMerchandise =
  gmDeductionsClient.syncPayrollAttendanceDeductions;

export const syncPayrollDeductionsGeneralMerchandise =
  gmDeductionsClient.syncPayrollDeductions;
