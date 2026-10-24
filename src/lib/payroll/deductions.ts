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
): number =>
  getSharedEffectiveMonthlySalary(payroll.basicSalary, entry?.employee);

export function createClothingPayrollDeductions(
  client: Prisma.TransactionClient = prisma
) {
  return createPayrollDeductionsClient<
    Payroll,
    Prisma.PayrollUpdateInput,
    Prisma.CashAdvanceRecordUpdateInput,
    Prisma.CashAdvanceDeductionCreateManyInput
  >({
    getPayrollPeriodRange,
    getPayrollCycleMetadata,
    getEffectiveMonthlySalary,
    findEmployees: (employeeIds) =>
      client.employee.findMany({
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
      client.leaveRequest.findMany({
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
      client.attendance.findMany({
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
      client.schedule.findMany({
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
      client.cashAdvanceRecord.findMany({
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
            | { employeeId: { in: string[] } }
            | { employeeName: { in: string[] } },
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
    findThirteenthMonthRecords: async (relevantYears) => {
      const thirteenthMonthDelegate = client.thirteenthMonthPayRecord;
      if (!thirteenthMonthDelegate?.findMany) {
        return [];
      }

      return thirteenthMonthDelegate.findMany({
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
    },
    persistPayrollUpdates: (updates) => {
      const operations = updates.map(({ id, data }) =>
        client.payroll.update({
          where: client === prisma ? { id, status: { not: 'paid' } } : { id },
          data,
        })
      );
      return client === prisma
        ? prisma.$transaction(operations)
        : Promise.all(operations);
    },
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
          client.cashAdvanceRecord.update({
            where: { id },
            data,
          })
        );
      });

      if (deductionLogs.length > 0) {
        operations.push(
          client.cashAdvanceDeduction.createMany({
            data: deductionLogs,
          })
        );
      }

      if (operations.length > 0) {
        if (client === prisma) {
          await prisma.$transaction(operations);
        } else {
          await Promise.all(operations);
        }
      }
    },
  });
}

const clothingDeductionsClient = createClothingPayrollDeductions();

export const syncPayrollLwop = clothingDeductionsClient.syncPayrollLwop;

export const syncPayrollAttendanceDeductions =
  clothingDeductionsClient.syncPayrollAttendanceDeductions;

export const syncPayrollDeductions =
  clothingDeductionsClient.syncPayrollDeductions;
