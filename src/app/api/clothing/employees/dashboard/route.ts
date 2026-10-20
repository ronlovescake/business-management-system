import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  DASHBOARD_SELECTS,
  buildEmployeeDashboard,
  getDashboardFilters,
  getDashboardRange,
} from '@/lib/employees/dashboard/buildEmployeeDashboard';

// Force dynamic rendering - API routes should not be statically generated
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const range = getDashboardRange(new URL(request.url).searchParams);
    const where = getDashboardFilters(range);

    const [
      attendance,
      payroll,
      leaves,
      cashAdvancesInRange,
      openCashAdvances,
      thirteenthMonth,
      employees,
    ] = await Promise.all([
      prisma.attendance.findMany({
        where: where.attendance,
        select: DASHBOARD_SELECTS.attendance,
      }),
      prisma.payroll.findMany({
        where: where.payroll,
        select: DASHBOARD_SELECTS.payroll,
      }),
      prisma.leaveRequest.findMany({
        where: where.leaves,
        select: DASHBOARD_SELECTS.leaves,
      }),
      prisma.cashAdvanceRecord.findMany({
        where: where.cashAdvancesInRange,
        select: DASHBOARD_SELECTS.cashAdvances,
      }),
      prisma.cashAdvanceRecord.findMany({
        where: where.openCashAdvances,
        select: DASHBOARD_SELECTS.cashAdvances,
      }),
      prisma.thirteenthMonthPayRecord.findMany({
        where: where.thirteenthMonth,
        select: DASHBOARD_SELECTS.thirteenthMonth,
      }),
      prisma.employee.findMany({
        where: where.employees,
        select: DASHBOARD_SELECTS.employees,
      }),
    ]);

    return NextResponse.json(
      buildEmployeeDashboard(
        {
          attendance,
          payroll,
          leaves,
          cashAdvancesInRange,
          openCashAdvances,
          thirteenthMonth,
          employees,
        },
        range
      )
    );
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
