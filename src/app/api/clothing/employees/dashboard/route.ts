import type { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { dayjs } from '@/utils/date';

// Force dynamic rendering - API routes should not be statically generated
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

    const cashAdvanceWhere: Prisma.CashAdvanceRecordWhereInput = {
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
      prisma.attendance.count({ where: attendanceWhere }),
      prisma.attendance.groupBy({
        by: ['status'],
        where: attendanceWhere,
        _count: { _all: true },
      }),
      prisma.attendance.findMany({
        where: attendanceWhere,
        distinct: ['employeeId'],
        select: { employeeId: true },
      }),
      prisma.expense.aggregate({
        where: expensesWhere,
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: expensesWhere,
        _sum: { amount: true },
      }),
      prisma.payroll.aggregate({
        where: payrollWhere,
        _sum: {
          grossPay: true,
          netPay: true,
          totalDeductions: true,
          cashAdvance: true,
        },
        _count: { _all: true },
      }),
      prisma.payroll.groupBy({
        by: ['status'],
        where: payrollWhere,
        _count: { _all: true },
      }),
      prisma.leaveRequest.groupBy({
        by: ['status'],
        where: leaveWhere,
        _count: { _all: true },
      }),
      prisma.cashAdvanceRecord.aggregate({
        where: cashAdvanceWhere,
        _sum: { amount: true, remainingBalance: true },
        _count: { _all: true },
      }),
      prisma.cashAdvanceRecord.groupBy({
        by: ['status'],
        where: cashAdvanceWhere,
        _count: { _all: true },
      }),
      prisma.thirteenthMonthPayRecord.aggregate({
        where: thirteenthWhere,
        _sum: { thirteenthMonthPay: true },
        _count: { _all: true },
      }),
      prisma.thirteenthMonthPayRecord.aggregate({
        where: { ...thirteenthWhere, status: 'paid' },
        _sum: { thirteenthMonthPay: true },
      }),
      prisma.thirteenthMonthPayRecord.groupBy({
        by: ['status'],
        where: thirteenthWhere,
        _count: { _all: true },
      }),
      prisma.employee.findMany({
        where: { deletedAt: null },
        select: { department: true, status: true, hireDate: true },
      }),
    ]);

    const attendanceStatusMap = toStatusMap(attendanceStatuses);
    const payrollStatusMap = toStatusMap(payrollStatuses);
    const leaveStatusMap = toStatusMap(leaveStatuses);
    const cashAdvanceStatusMap = toStatusMap(cashAdvanceStatuses);
    const thirteenthStatusMap = toStatusMap(thirteenthStatuses);

    const totalExpenses = expenseTotals._sum.amount || 0;
    const expensesByCategory = toCategoryBreakdown(expenseCategories);

    const payrollProcessed = Object.entries(payrollStatusMap)
      .filter(([status]) => status !== 'pending')
      .reduce((sum, [, count]) => sum + count, 0);

    const leaveTotal = Object.values(leaveStatusMap).reduce(
      (sum, count) => sum + count,
      0
    );
    const cashAdvanceActive = Object.entries(cashAdvanceStatusMap)
      .filter(([status]) => status !== 'settled' && status !== 'rejected')
      .reduce((sum, [, count]) => sum + count, 0);

    const sanitizedRange = {
      from: range.from,
      to: range.to,
    };

    const teamStatusCounts: DashboardCounts = {};
    const departmentCounts: DashboardCounts = {};
    let newHires = 0;

    for (const employee of employees) {
      const status = (employee.status || 'unknown').toLowerCase();
      teamStatusCounts[status] = (teamStatusCounts[status] || 0) + 1;

      const department = employee.department || 'Unassigned';
      departmentCounts[department] = (departmentCounts[department] || 0) + 1;

      const hireDate = sanitizers.date(employee.hireDate);
      if (hireDate && hireDate >= range.from && hireDate <= range.to) {
        newHires += 1;
      }
    }

    const response = {
      range: sanitizedRange,
      attendance: {
        totalRecords: attendanceTotal,
        uniqueEmployees: attendanceEmployees.length,
        statusCounts: attendanceStatusMap,
      },
      expenses: {
        totalAmount: Number(totalExpenses),
        categories: expensesByCategory,
      },
      payroll: {
        totalGross: payrollTotals._sum.grossPay || 0,
        totalNet: payrollTotals._sum.netPay || 0,
        totalDeductions: payrollTotals._sum.totalDeductions || 0,
        totalRecords: payrollTotals._count._all,
        processedCount: payrollProcessed,
        statusCounts: payrollStatusMap,
      },
      leaves: {
        totalRequests: leaveTotal,
        statusCounts: leaveStatusMap,
      },
      cashAdvance: {
        totalRequested: Number(cashAdvanceTotals._sum.amount || 0),
        outstandingBalance: Number(
          cashAdvanceTotals._sum.remainingBalance || 0
        ),
        totalRecords: cashAdvanceTotals._count._all,
        activeCount: cashAdvanceActive,
        statusCounts: cashAdvanceStatusMap,
      },
      thirteenthMonth: {
        totalRecords: thirteenthTotals._count._all,
        totalAccrued: Number(thirteenthTotals._sum.thirteenthMonthPay || 0),
        totalPaid: Number(thirteenthPaidTotals._sum.thirteenthMonthPay || 0),
        statusCounts: thirteenthStatusMap,
      },
      team: {
        headcount: employees.length,
        newHires,
        statusCounts: teamStatusCounts,
        departments: Object.entries(departmentCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to load employee dashboard metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to load dashboard metrics' },
      { status: 500 }
    );
  }
}
