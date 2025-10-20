import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LeaveRequestRecord {
  id: number;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  paymentStatus: string;
  status: string;
}

interface PayrollRecord {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  dailyRate: number;
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
  dailyRate: number;
  lwop: number;
  unpaidDays: number;
}

/**
 * Calculate how many unpaid leave days fall within a pay period
 */
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

  // Find the overlap between leave and period
  const overlapStart = leave1 > period1 ? leave1 : period1;
  const overlapEnd = leave2 < period2 ? leave2 : period2;

  // No overlap
  if (overlapStart > overlapEnd) {
    return 0;
  }

  // Calculate days (inclusive)
  const diffTime = overlapEnd.getTime() - overlapStart.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  return diffDays;
}

/**
 * Sync LWOP from leave requests to payroll records
 *
 * Query params:
 * - payrollId: Sync specific payroll record
 * - payPeriod: Sync all records in a pay period
 * - employeeId: Sync all records for an employee
 * - all: Sync all payroll records
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('payrollId');
    const payPeriod = searchParams.get('payPeriod');
    const employeeId = searchParams.get('employeeId');
    const syncAll = searchParams.get('all') === 'true';

    // Build payroll query filter
    const payrollFilter: Record<string, unknown> = {
      deletedAt: null,
    };

    if (payrollId) {
      payrollFilter.id = payrollId;
    } else if (payPeriod) {
      payrollFilter.payPeriod = payPeriod;
    } else if (employeeId) {
      payrollFilter.employeeId = employeeId;
    } else if (!syncAll) {
      return NextResponse.json(
        {
          error: 'Please specify payrollId, payPeriod, employeeId, or all=true',
        },
        { status: 400 }
      );
    }

    // Fetch payroll records
    const payrolls = (await prisma.payroll.findMany({
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
      return NextResponse.json({
        message: 'No payroll records found',
        synced: 0,
      });
    }

    // Fetch all approved unpaid leave requests
    const leaveRequests = (await prisma.leaveRequest.findMany({
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

    // Process each payroll record
    for (const payroll of payrolls) {
      // Find all unpaid leaves for this employee that overlap with pay period
      const relevantLeaves = leaveRequests.filter((leave) => {
        // Match employee (normalize IDs)
        const leaveEmpId = leave.employeeId.trim().toLowerCase();
        const payrollEmpId = payroll.employeeId.trim().toLowerCase();
        if (leaveEmpId !== payrollEmpId) {
          return false;
        }

        // Check if leave overlaps with pay period
        const daysInPeriod = calculateUnpaidDaysInPeriod(
          leave.startDate,
          leave.endDate,
          payroll.periodStart,
          payroll.periodEnd
        );

        return daysInPeriod > 0;
      });

      // Calculate total unpaid days in this pay period
      let totalUnpaidDays = 0;
      for (const leave of relevantLeaves) {
        const daysInPeriod = calculateUnpaidDaysInPeriod(
          leave.startDate,
          leave.endDate,
          payroll.periodStart,
          payroll.periodEnd
        );
        totalUnpaidDays += daysInPeriod;
      }

      // Calculate LWOP deduction
      const dailyRate = payroll.dailyRate || payroll.basicSalary / 26;
      const calculatedLwop = totalUnpaidDays * dailyRate;

      // Only update if LWOP changed
      if (Math.abs(calculatedLwop - payroll.lwop) > 0.01) {
        // Recalculate total deductions and net pay
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

        // Update payroll record
        await prisma.payroll.update({
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
    }

    return NextResponse.json({
      message: `Successfully synced LWOP for ${updates.length} payroll record(s)`,
      synced: updates.length,
      total: payrolls.length,
      updates,
    });
  } catch (error) {
    console.error('Error syncing LWOP:', error);
    return NextResponse.json(
      { error: 'Failed to sync LWOP', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to preview LWOP calculations without updating
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const payrollId = searchParams.get('payrollId');
    const employeeId = searchParams.get('employeeId');

    if (!payrollId && !employeeId) {
      return NextResponse.json(
        { error: 'Please specify payrollId or employeeId' },
        { status: 400 }
      );
    }

    const payrollFilter: Record<string, unknown> = {
      deletedAt: null,
    };

    if (payrollId) {
      payrollFilter.id = payrollId;
    } else if (employeeId) {
      payrollFilter.employeeId = employeeId;
    }

    const payrolls = (await prisma.payroll.findMany({
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

    const leaveRequests = (await prisma.leaveRequest.findMany({
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

    const preview = payrolls.map((payroll) => {
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
    });

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Error previewing LWOP:', error);
    return NextResponse.json(
      { error: 'Failed to preview LWOP', details: String(error) },
      { status: 500 }
    );
  }
}
