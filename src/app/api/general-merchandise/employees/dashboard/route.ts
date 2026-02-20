import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { dayjs } from '@/utils/date';

export const dynamic = 'force-dynamic';

const DATE_FORMAT = 'YYYY-MM-DD';

type StatusCount<T extends string> = Record<T, number>;

type DashboardCounts = Record<string, number>;

function getRange(params: URLSearchParams) {
  const fromParam = sanitizers.date(params.get('from'));
  const toParam = sanitizers.date(params.get('to'));
  const today = dayjs().tz();
  let from = fromParam || today.startOf('month').format(DATE_FORMAT);
  let to = toParam || today.format(DATE_FORMAT);

  if (from > to) {
    [from, to] = [to, from];
  }

  return {
    from,
    to,
    fromDateTime: dayjs(from).tz().startOf('day').toDate(),
    toDateTime: dayjs(to).tz().endOf('day').toDate(),
  };
}

function toStatusMap<T extends string>(
  rows: Array<{ status: T; _count: { _all: number } }>
): StatusCount<T> {
  return rows.reduce((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {} as StatusCount<T>);
}

function toCategoryBreakdown(
  rows: Array<{ category: string | null; _sum: { amount: number | null } }>
) {
  return rows
    .map((row) => ({
      category: row.category || 'Uncategorized',
      amount: row._sum.amount ? Number(row._sum.amount) : 0,
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export async function GET(request: NextRequest) {
  try {
    const params = new URL(request.url).searchParams;
    const range = getRange(params);

    const attendanceWhere = {
      deletedAt: null,
      date: {
        gte: range.from,
        lte: range.to,
      },
    } as const;

    const expensesWhere = {
      date: {
        gte: range.from,
        lte: range.to,
      },
    } as const;

    const payrollWhere = {
      deletedAt: null,
      periodStart: {
        gte: range.from,
        lte: range.to,
      },
    } as const;

    const leaveWhere = {
      startDate: {
        lte: range.to,
      },
      endDate: {
        gte: range.from,
      },
    } as const;

    const cashAdvanceWhere: Prisma.GeneralMerchandiseCashAdvanceRecordWhereInput =
      {
        OR: [
          {
            requestDate: {
              gte: range.fromDateTime,
              lte: range.toDateTime,
            },
          },
          {
            createdAt: {
              gte: range.fromDateTime,
              lte: range.toDateTime,
            },
          },
        ],
      };

    const startYear = dayjs(range.from).tz().year();
    const endYear = dayjs(range.to).tz().year();
    const thirteenthWhere = {
      year: {
        gte: startYear,
        lte: endYear,
      },
    } as const;

    const [
      attendanceTotal,
      attendanceStatuses,
      attendanceEmployees,
      expenseTotals,
      expenseCategories,
      payrollTotals,
      payrollStatuses,
      leaveStatuses,
      cashAdvanceTotals,
      cashAdvanceStatuses,
      thirteenthTotals,
      thirteenthPaidTotals,
      thirteenthStatuses,
      employees,
    ] = await Promise.all([
      prisma.generalMerchandiseAttendance.count({ where: attendanceWhere }),
      prisma.generalMerchandiseAttendance.groupBy({
        by: ['status'],
        where: attendanceWhere,
        _count: { _all: true },
      }),
      prisma.generalMerchandiseAttendance.findMany({
        where: attendanceWhere,
        distinct: ['employeeId'],
        select: { employeeId: true },
      }),
      prisma.generalMerchandiseExpense.aggregate({
        where: expensesWhere,
        _sum: { amount: true },
      }),
      prisma.generalMerchandiseExpense.groupBy({
        by: ['category'],
        where: expensesWhere,
        _sum: { amount: true },
      }),
      prisma.generalMerchandisePayroll.aggregate({
        where: payrollWhere,
        _sum: {
          grossPay: true,
          netPay: true,
          totalDeductions: true,
          cashAdvance: true,
        },
        _count: { _all: true },
      }),
      prisma.generalMerchandisePayroll.groupBy({
        by: ['status'],
        where: payrollWhere,
        _count: { _all: true },
      }),
      prisma.generalMerchandiseLeaveRequest.groupBy({
        by: ['status'],
        where: leaveWhere,
        _count: { _all: true },
      }),
      prisma.generalMerchandiseCashAdvanceRecord.aggregate({
        where: cashAdvanceWhere,
        _sum: { amount: true, remainingBalance: true },
        _count: { _all: true },
      }),
      prisma.generalMerchandiseCashAdvanceRecord.groupBy({
        by: ['status'],
        where: cashAdvanceWhere,
        _count: { _all: true },
      }),
      prisma.generalMerchandiseThirteenthMonthPayRecord.aggregate({
        where: thirteenthWhere,
        _sum: { thirteenthMonthPay: true },
        _count: { _all: true },
      }),
      prisma.generalMerchandiseThirteenthMonthPayRecord.aggregate({
        where: { ...thirteenthWhere, status: 'paid' },
        _sum: { thirteenthMonthPay: true },
      }),
      prisma.generalMerchandiseThirteenthMonthPayRecord.groupBy({
        by: ['status'],
        where: thirteenthWhere,
        _count: { _all: true },
      }),
      prisma.generalMerchandiseEmployee.count({
        where: { deletedAt: null },
      }),
    ]);

    const attendanceStatusCounts = toStatusMap(
      attendanceStatuses as Array<{ status: string; _count: { _all: number } }>
    );
    const leaveStatusCounts = toStatusMap(
      leaveStatuses as Array<{ status: string; _count: { _all: number } }>
    );
    const payrollStatusCounts = toStatusMap(
      payrollStatuses as Array<{ status: string; _count: { _all: number } }>
    );
    const cashAdvanceStatusCounts = toStatusMap(
      cashAdvanceStatuses as Array<{ status: string; _count: { _all: number } }>
    );
    const thirteenthStatusCounts = toStatusMap(
      thirteenthStatuses as Array<{ status: string; _count: { _all: number } }>
    );

    const cashAdvanceCountAll = Number(cashAdvanceTotals._count?._all ?? 0);

    const attendanceCounts: DashboardCounts = {
      totalRecords: attendanceTotal,
      uniqueEmployees: attendanceEmployees.length,
      ...attendanceStatusCounts,
    };

    const payrollCounts: DashboardCounts = {
      totalRecords: payrollTotals._count._all ?? 0,
      ...payrollStatusCounts,
    };

    const cashAdvanceCounts: DashboardCounts = {
      totalRecords: cashAdvanceCountAll,
      ...cashAdvanceStatusCounts,
    };

    const leaveCounts: DashboardCounts = {
      totalRecords: leaveStatuses.reduce(
        (sum, row) => sum + row._count._all,
        0
      ),
      ...leaveStatusCounts,
    };

    const thirteenthCounts: DashboardCounts = {
      totalRecords: thirteenthTotals._count._all ?? 0,
      ...thirteenthStatusCounts,
    };

    return NextResponse.json({
      range: {
        from: range.from,
        to: range.to,
      },
      attendance: {
        totalRecords: attendanceCounts.totalRecords ?? 0,
        statusCounts: attendanceStatusCounts,
        uniqueEmployees: attendanceCounts.uniqueEmployees ?? 0,
      },
      expenses: {
        totalAmount: Number(expenseTotals._sum.amount || 0),
        categories: toCategoryBreakdown(
          expenseCategories as Array<{
            category: string | null;
            _sum: { amount: number | null };
          }>
        ),
      },
      payroll: {
        totalRecords: payrollCounts.totalRecords ?? 0,
        totalGross: Number(payrollTotals._sum.grossPay || 0),
        totalNet: Number(payrollTotals._sum.netPay || 0),
        totalDeductions: Number(payrollTotals._sum.totalDeductions || 0),
        totalCashAdvance: Number(payrollTotals._sum.cashAdvance || 0),
        statusCounts: payrollStatusCounts,
      },
      leaveRequests: {
        totalRecords: leaveCounts.totalRecords ?? 0,
        statusCounts: leaveStatusCounts,
      },
      cashAdvance: {
        totalRecords: cashAdvanceCounts.totalRecords ?? 0,
        totalAmount: Number(cashAdvanceTotals._sum?.amount || 0),
        remainingBalance: Number(cashAdvanceTotals._sum?.remainingBalance || 0),
        statusCounts: cashAdvanceStatusCounts,
      },
      thirteenthMonth: {
        totalRecords: thirteenthCounts.totalRecords ?? 0,
        totalAmount: Number(thirteenthTotals._sum.thirteenthMonthPay || 0),
        totalPaid: Number(thirteenthPaidTotals._sum.thirteenthMonthPay || 0),
        statusCounts: thirteenthStatusCounts,
      },
      employees: {
        totalRecords: employees,
      },
    });
  } catch (error) {
    logger.error('Failed to load GM employee dashboard metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to load dashboard metrics' },
      { status: 500 }
    );
  }
}
