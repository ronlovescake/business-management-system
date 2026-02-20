import type { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';

interface LeaveRequestRecord {
  id: number;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  paymentStatus: string;
  status: string;
  leaveType?: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  dailyRate: number | null;
  lwop: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  cashAdvance: number;
  absentsLates: number;
  grossPay: number;
}

interface PayrollPreviewRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  dailyRate: number | null;
  lwop: number;
  unpaidDays: number;
}

type SyncFilters = {
  payrollId?: string;
  payPeriod?: string;
  employeeId?: string;
  syncAll: boolean;
};

type PreviewFilters = Pick<SyncFilters, 'payrollId' | 'employeeId'>;

export const POST = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const filters = parseSyncFilters(searchParams);

  if (
    !filters.syncAll &&
    !filters.payrollId &&
    !filters.payPeriod &&
    !filters.employeeId
  ) {
    return ApiResponse.badRequest('Missing sync criteria', {
      payrollId: 'Provide payrollId, payPeriod, employeeId, or set all=true',
      payPeriod: 'Provide payrollId, payPeriod, employeeId, or set all=true',
      employeeId: 'Provide payrollId, payPeriod, employeeId, or set all=true',
    });
  }

  const payrollFilter = buildPayrollFilter(filters);
  const payrolls = (await prisma.generalMerchandisePayroll.findMany({
    where: payrollFilter,
    select: {
      id: true,
      employeeId: true,
      periodStart: true,
      periodEnd: true,
      basicSalary: true,
      dailyRate: true,
      lwop: true,
      sss: true,
      philHealth: true,
      pagIbig: true,
      tax: true,
      loans: true,
      cashAdvance: true,
      absentsLates: true,
      grossPay: true,
    },
  })) as PayrollRecord[];

  if (payrolls.length === 0) {
    return ApiResponse.error(
      'No payroll records found',
      HTTP_STATUS.NOT_FOUND,
      'No payroll records matched the provided filters.',
      { meta: { filters } }
    );
  }

  const leaveRequests = (await prisma.generalMerchandiseLeaveRequest.findMany({
    where: {
      status: 'approved',
      paymentStatus: 'unpaid',
    },
    select: {
      id: true,
      employeeId: true,
      employeeName: true,
      startDate: true,
      endDate: true,
      numberOfDays: true,
      paymentStatus: true,
      status: true,
    },
  })) as LeaveRequestRecord[];

  const updates: Array<{
    payrollId: string;
    employeeId: string;
    oldLwop: number;
    newLwop: number;
    unpaidDays: number;
    dailyRate: number;
  }> = [];

  for (const payroll of payrolls) {
    const totalUnpaidDays = sumUnpaidDays(leaveRequests, payroll);
    const dailyRate = payroll.dailyRate || payroll.basicSalary / 26;
    const calculatedLwop = totalUnpaidDays * dailyRate;

    if (Math.abs(calculatedLwop - payroll.lwop) <= 0.01) {
      continue;
    }

    const totalDeductions =
      payroll.sss +
      payroll.philHealth +
      payroll.pagIbig +
      payroll.tax +
      payroll.loans +
      payroll.cashAdvance +
      calculatedLwop +
      payroll.absentsLates;

    const netPay = Math.max(0, payroll.grossPay - totalDeductions);

    await prisma.generalMerchandisePayroll.update({
      where: { id: payroll.id },
      data: {
        lwop: calculatedLwop,
        unpaidDays: totalUnpaidDays,
        dailyRate,
        deduction: calculatedLwop,
        totalDeductions,
        netPay,
      },
    });

    updates.push({
      payrollId: payroll.id,
      employeeId: payroll.employeeId,
      oldLwop: payroll.lwop,
      newLwop: calculatedLwop,
      unpaidDays: totalUnpaidDays,
      dailyRate,
    });
  }

  return ApiResponse.success(
    {
      synced: updates.length,
      total: payrolls.length,
      updates,
    },
    `Successfully synced LWOP for ${updates.length} payroll record(s)`
  );
});

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const filters = parsePreviewFilters(searchParams);

  if (!filters.payrollId && !filters.employeeId) {
    return ApiResponse.badRequest('Missing preview criteria', {
      payrollId: 'Provide payrollId or employeeId to preview LWOP',
      employeeId: 'Provide payrollId or employeeId to preview LWOP',
    });
  }

  const payrollFilter: Prisma.GeneralMerchandisePayrollWhereInput = {
    deletedAt: null,
  };

  if (filters.payrollId) {
    payrollFilter.id = filters.payrollId;
  }

  if (filters.employeeId && !filters.payrollId) {
    payrollFilter.employeeId = filters.employeeId;
  }

  const payrolls = (await prisma.generalMerchandisePayroll.findMany({
    where: payrollFilter,
    select: {
      id: true,
      employeeId: true,
      employeeName: true,
      payPeriod: true,
      periodStart: true,
      periodEnd: true,
      basicSalary: true,
      dailyRate: true,
      lwop: true,
      unpaidDays: true,
    },
  })) as PayrollPreviewRecord[];

  if (payrolls.length === 0) {
    return ApiResponse.error(
      'No payroll records found',
      HTTP_STATUS.NOT_FOUND,
      'No payroll records matched the provided preview filters.',
      { meta: { filters } }
    );
  }

  const leaveRequests = (await prisma.generalMerchandiseLeaveRequest.findMany({
    where: {
      status: 'approved',
      paymentStatus: 'unpaid',
    },
    select: {
      id: true,
      employeeId: true,
      employeeName: true,
      leaveType: true,
      startDate: true,
      endDate: true,
      numberOfDays: true,
    },
  })) as Array<LeaveRequestRecord & { leaveType: string }>;

  const preview = payrolls.map((payroll) =>
    buildPreview(payroll, leaveRequests)
  );

  return ApiResponse.success(preview);
});

function calculateUnpaidDaysInPeriod(
  leaveStart: string,
  leaveEnd: string,
  periodStart: string,
  periodEnd: string
): number {
  const leave1 = new Date(leaveStart);
  const leave2 = new Date(leaveEnd);
  const period1 = new Date(periodStart);
  const period2 = new Date(periodEnd);

  const overlapStart = leave1 > period1 ? leave1 : period1;
  const overlapEnd = leave2 < period2 ? leave2 : period2;

  if (overlapStart > overlapEnd) {
    return 0;
  }

  const diffTime = overlapEnd.getTime() - overlapStart.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

function sanitizeQueryValue(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseSyncFilters(searchParams: URLSearchParams): SyncFilters {
  return {
    payrollId: sanitizeQueryValue(searchParams.get('payrollId')),
    payPeriod: sanitizeQueryValue(searchParams.get('payPeriod')),
    employeeId: sanitizeQueryValue(searchParams.get('employeeId')),
    syncAll: searchParams.get('all') === 'true',
  };
}

function parsePreviewFilters(searchParams: URLSearchParams): PreviewFilters {
  return {
    payrollId: sanitizeQueryValue(searchParams.get('payrollId')),
    employeeId: sanitizeQueryValue(searchParams.get('employeeId')),
  };
}

function buildPayrollFilter(
  filters: SyncFilters
): Prisma.GeneralMerchandisePayrollWhereInput {
  const payrollFilter: Prisma.GeneralMerchandisePayrollWhereInput = {
    deletedAt: null,
  };

  if (filters.payrollId) {
    payrollFilter.id = filters.payrollId;
    return payrollFilter;
  }

  if (filters.payPeriod) {
    payrollFilter.payPeriod = filters.payPeriod;
    return payrollFilter;
  }

  if (filters.employeeId) {
    payrollFilter.employeeId = filters.employeeId;
  }

  return payrollFilter;
}

function sumUnpaidDays(
  leaveRequests: LeaveRequestRecord[],
  payroll: PayrollRecord
): number {
  const relevantLeaves = leaveRequests.filter((leave) => {
    const leaveEmpId = leave.employeeId.trim().toLowerCase();
    const payrollEmpId = payroll.employeeId.trim().toLowerCase();
    if (leaveEmpId !== payrollEmpId) {
      return false;
    }

    const daysInPeriod = calculateUnpaidDaysInPeriod(
      leave.startDate,
      leave.endDate,
      payroll.periodStart,
      payroll.periodEnd
    );

    return daysInPeriod > 0;
  });

  return relevantLeaves.reduce((total, leave) => {
    const daysInPeriod = calculateUnpaidDaysInPeriod(
      leave.startDate,
      leave.endDate,
      payroll.periodStart,
      payroll.periodEnd
    );
    return total + daysInPeriod;
  }, 0);
}

function buildPreview(
  payroll: PayrollPreviewRecord,
  leaveRequests: Array<LeaveRequestRecord & { leaveType?: string }>
): {
  payrollId: string;
  employeeName: string;
  payPeriod: string;
  currentLwop: number;
  currentUnpaidDays: number;
  calculatedUnpaidDays: number;
  dailyRate: number;
  calculatedLwop: number;
  willUpdate: boolean;
  leaveBreakdown: Array<{
    leaveType?: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    daysInThisPeriod: number;
  }>;
} {
  const relevantLeaves = leaveRequests.filter((leave) => {
    const leaveEmpId = leave.employeeId.trim().toLowerCase();
    const payrollEmpId = payroll.employeeId.trim().toLowerCase();
    if (leaveEmpId !== payrollEmpId) {
      return false;
    }

    const daysInPeriod = calculateUnpaidDaysInPeriod(
      leave.startDate,
      leave.endDate,
      payroll.periodStart,
      payroll.periodEnd
    );

    return daysInPeriod > 0;
  });

  let totalUnpaidDays = 0;
  const leaveBreakdown = relevantLeaves.map((leave) => {
    const daysInPeriod = calculateUnpaidDaysInPeriod(
      leave.startDate,
      leave.endDate,
      payroll.periodStart,
      payroll.periodEnd
    );
    totalUnpaidDays += daysInPeriod;

    return {
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays: leave.numberOfDays,
      daysInThisPeriod: daysInPeriod,
    };
  });

  const dailyRate = payroll.dailyRate || payroll.basicSalary / 26;
  const calculatedLwop = totalUnpaidDays * dailyRate;

  return {
    payrollId: payroll.id,
    employeeName: payroll.employeeName,
    payPeriod: payroll.payPeriod,
    currentLwop: payroll.lwop,
    currentUnpaidDays: payroll.unpaidDays,
    calculatedUnpaidDays: totalUnpaidDays,
    dailyRate,
    calculatedLwop,
    willUpdate: Math.abs(calculatedLwop - payroll.lwop) > 0.01,
    leaveBreakdown,
  };
}
