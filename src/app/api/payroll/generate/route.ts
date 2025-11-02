import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const normalizeKey = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

type AttendanceSummary = {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  daysWorked: number;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentPayPeriod(referenceDate: Date): {
  start: string;
  end: string;
  label: string;
} {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  const startDate =
    day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
  const endDate =
    day <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);

  const start = formatLocalDate(startDate);
  const end = formatLocalDate(endDate);

  return {
    start,
    end,
    label: `${start} to ${end}`,
  };
}

function buildAttendanceSummary(
  records: Array<{
    employeeId: string;
    employeeName: string;
    totalHours: number | null;
  }>
): AttendanceSummary[] {
  const grouped = new Map<string, AttendanceSummary>();

  for (const record of records) {
    const totalHours = record.totalHours ?? 0;
    const existing = grouped.get(record.employeeId);

    if (existing) {
      existing.totalHours += totalHours;
      existing.daysWorked += 1;
      continue;
    }

    grouped.set(record.employeeId, {
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      totalHours,
      daysWorked: 1,
    });
  }

  return Array.from(grouped.values());
}

export async function POST() {
  try {
    const currentPeriod = getCurrentPayPeriod(new Date());

    // Check for existing payroll (including soft-deleted ones)
    const existingRecords = await prisma.payroll.findMany({
      where: {
        periodStart: currentPeriod.start,
        periodEnd: currentPeriod.end,
      },
      select: {
        id: true,
        deletedAt: true,
        employeeId: true,
        employeeName: true,
      },
    });

    const softDeletedRecords = existingRecords.filter(
      (record) => record.deletedAt !== null
    );
    const activeRecords = existingRecords.filter(
      (record) => record.deletedAt === null
    );

    const activeEmployeeIds = new Set(
      activeRecords
        .map((record) => record.employeeId)
        .filter((id): id is string => Boolean(id))
    );
    const activeEmployeeNames = new Set(
      activeRecords
        .map((record) => normalizeKey(record.employeeName))
        .filter((name) => name.length > 0)
    );

    const softDeletedEmployeeIds = new Set(
      softDeletedRecords
        .map((record) => record.employeeId)
        .filter((id): id is string => Boolean(id))
    );
    const softDeletedEmployeeNames = new Set(
      softDeletedRecords
        .map((record) => normalizeKey(record.employeeName))
        .filter((name) => name.length > 0)
    );

    const attendance = await prisma.attendance.findMany({
      where: {
        deletedAt: null,
        status: { in: ['present', 'late'] },
        date: {
          gte: currentPeriod.start,
          lte: currentPeriod.end,
        },
      },
      select: {
        employeeId: true,
        employeeName: true,
        totalHours: true,
      },
    });

    if (attendance.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No attendance records found for ${currentPeriod.label}`,
        period: currentPeriod,
      });
    }

    const attendanceSummaries = buildAttendanceSummary(attendance);
    if (attendanceSummaries.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No eligible employees with attendance found for ${currentPeriod.label}`,
        period: currentPeriod,
      });
    }

    const eligibleSummaries = attendanceSummaries.filter((summary) => {
      if (summary.employeeId && activeEmployeeIds.has(summary.employeeId)) {
        return false;
      }

      const nameKey = normalizeKey(summary.employeeName);
      if (nameKey && activeEmployeeNames.has(nameKey)) {
        return false;
      }

      return true;
    });

    if (eligibleSummaries.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Payroll already exists for period ${currentPeriod.label}`,
        period: currentPeriod,
      });
    }

    const softConflictSummaries = eligibleSummaries.filter((summary) => {
      if (
        summary.employeeId &&
        softDeletedEmployeeIds.has(summary.employeeId)
      ) {
        return true;
      }

      const nameKey = normalizeKey(summary.employeeName);
      return nameKey ? softDeletedEmployeeNames.has(nameKey) : false;
    });

    if (softConflictSummaries.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Deleted payroll exists for ${softConflictSummaries.length} employee${softConflictSummaries.length === 1 ? '' : 's'} in period ${currentPeriod.label}. Please clean up the deleted records before generating new payroll.`,
        period: currentPeriod,
        action: 'cleanup_soft_deleted',
        conflicts: softConflictSummaries.map((summary) => ({
          employeeId: summary.employeeId,
          employeeName: summary.employeeName,
        })),
      });
    }

    const employeeIds = Array.from(
      new Set(eligibleSummaries.map((summary) => summary.employeeId))
    );
    const employees = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        employeeId: { in: employeeIds },
      },
      select: {
        employeeId: true,
        name: true,
        basicSalary: true,
        currentSalary: true,
        allowance: true,
        sssMonthlyContribution: true,
        philHealthMonthlyContribution: true,
        pagibigMonthlyContribution: true,
        taxMonthlyContribution: true,
        bankAccount: true,
        gcashAccount: true,
      },
    });

    const employeesById = new Map(
      employees.map((employee) => [employee.employeeId, employee])
    );

    // ============================================================================
    // FETCH 13TH MONTH PAY RECORDS TO PREVENT DUPLICATE PAYMENTS
    // ============================================================================
    // Get the year from the pay period to check 13th month pay status
    const payPeriodYear = new Date(currentPeriod.end).getFullYear();

    // Fetch all 13th month records for this year to check payment status
    // This prevents including 13th month pay in payroll after it's already been paid
    const thirteenthMonthRecords =
      await prisma.thirteenthMonthPayRecord.findMany({
        where: {
          year: payPeriodYear,
          employeeId: { in: employeeIds },
        },
        select: {
          employeeId: true,
          recordId: true,
          status: true,
          thirteenthMonthPay: true,
        },
      });

    // Create a map: employeeId -> { amount, isPaid }
    // This allows us to check if 13th month has been paid and exclude it from new payrolls
    const thirteenthMonthByEmployee = new Map(
      thirteenthMonthRecords
        .filter((record) => record.employeeId)
        .map((record) => [
          record.employeeId as string,
          {
            amount: Number(record.thirteenthMonthPay) || 0,
            isPaid: record.status === 'paid',
          },
        ])
    );

    const payrollRecords = eligibleSummaries.map(
      ({ employeeId, employeeName, totalHours, daysWorked }) => {
        const employee = employeesById.get(employeeId);
        const resolvedName =
          employee?.name ?? employeeName ?? 'Unknown Employee';

        const monthlySalary = employee?.basicSalary ?? 0; // Use basicSalary field, NOT currentSalary (which includes allowance)
        const allowance = (employee?.allowance ?? 0) / 2; // Half-month allowance
        const hourlyRate = monthlySalary > 0 ? monthlySalary / 26 / 8 : 0;

        // For stay-in employees, standard workday is 13 hours (not 8)
        const standardHours = daysWorked * 13;
        const overtimeHours = Math.max(0, totalHours - standardHours);
        const overtimePay = overtimeHours * hourlyRate * 1.25;

        const basicSalary = monthlySalary / 2;
        const bonuses = 0;

        // Check if 13th month pay should be included in this payroll
        // Logic: Only include if there's a calculated/approved record that hasn't been paid yet
        // Common scenario: Include in 1st December payroll, mark as paid, then exclude from 2nd December payroll
        const thirteenthMonthData = thirteenthMonthByEmployee.get(employeeId);
        const thirteenthMonth =
          thirteenthMonthData && !thirteenthMonthData.isPaid
            ? thirteenthMonthData.amount
            : 0;

        const grossPay =
          basicSalary + allowance + overtimePay + bonuses + thirteenthMonth;

        const sss = employee?.sssMonthlyContribution ?? 0;
        const philHealth = employee?.philHealthMonthlyContribution ?? 0;
        const pagIbig = employee?.pagibigMonthlyContribution ?? 0;
        const tax = employee?.taxMonthlyContribution ?? 0;
        const loans = 0;
        const cashAdvance = 0;
        const lwop = 0;
        const absentsLates = 0;

        const totalDeductions =
          sss +
          philHealth +
          pagIbig +
          tax +
          loans +
          cashAdvance +
          lwop +
          absentsLates;
        const netPay = Math.max(0, grossPay - totalDeductions);

        return {
          employeeId,
          employeeName: resolvedName,
          payPeriod: currentPeriod.label,
          periodStart: currentPeriod.start,
          periodEnd: currentPeriod.end,
          basicSalary,
          allowance,
          overtime: overtimePay,
          bonuses,
          thirteenthMonth,
          grossPay,
          sss,
          philHealth,
          pagIbig,
          tax,
          loans,
          cashAdvance,
          lwop,
          absentsLates,
          totalDeductions,
          netPay,
          status: 'pending',
          bankGcash: employee?.gcashAccount ?? employee?.bankAccount ?? '',
        };
      }
    );

    const created = await prisma.payroll.createMany({ data: payrollRecords });

    return NextResponse.json({
      success: true,
      message: `Successfully generated payroll for ${created.count} employees`,
      period: currentPeriod,
      count: created.count,
    });
  } catch (error) {
    logger.error('Error generating payroll:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate payroll',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
