#!/usr/bin/env node
/**
 * Bulk Payroll Generation Script
 * Generates payroll for specified employees across multiple pay periods
 *
 * Usage: node scripts/generate-bulk-payroll.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMPLOYEES = ['EMP-0004', 'EMP-0005', 'EMP-0006'];

// Generate pay periods from January to October 2025
function generatePayPeriods(startMonth, endMonth, year) {
  const periods = [];

  for (let month = startMonth; month <= endMonth; month++) {
    const monthStr = String(month).padStart(2, '0');

    // First half (1-15)
    periods.push({
      start: `${year}-${monthStr}-01`,
      end: `${year}-${monthStr}-15`,
      label: `${year}-${monthStr}-01 to ${year}-${monthStr}-15`,
    });

    // Second half (16-end)
    const lastDay = new Date(year, month, 0).getDate();
    periods.push({
      start: `${year}-${monthStr}-16`,
      end: `${year}-${monthStr}-${lastDay}`,
      label: `${year}-${monthStr}-16 to ${year}-${monthStr}-${lastDay}`,
    });
  }

  return periods;
}

function buildAttendanceSummary(records) {
  const grouped = new Map();

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

async function getEmployeeDetailsForPeriod(employeeId, periodEnd) {
  // Get employee base info
  const employee = await prisma.employee.findFirst({
    where: { employeeId, deletedAt: null },
    select: {
      employeeId: true,
      name: true,
      hireDate: true,
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

  if (!employee) {
    return null;
  }

  // Get salary history to find applicable salary for this period
  const salaryHistory = await prisma.salaryHistory.findMany({
    where: {
      employeeId,
      deletedAt: null,
      effectiveDate: { lte: periodEnd },
    },
    orderBy: { effectiveDate: 'desc' },
    take: 1,
  });

  // Use salary from history if available, otherwise use current salary
  const applicableSalary =
    salaryHistory.length > 0
      ? {
          basicSalary: Number(salaryHistory[0].basicSalary),
          allowance: Number(salaryHistory[0].allowance),
          reason: salaryHistory[0].reason,
        }
      : {
          basicSalary: employee.basicSalary ?? 0, // Use basicSalary field, NOT currentSalary (which includes allowance)
          allowance: employee.allowance ?? 0,
          reason: null,
        };

  return {
    ...employee,
    ...applicableSalary,
    salaryReason: applicableSalary.reason,
  };
}

async function generatePayrollForPeriod(period) {
  console.log(`\n📅 Processing period: ${period.label}`);

  // Check if payroll already exists
  const existing = await prisma.payroll.findFirst({
    where: {
      deletedAt: null,
      periodStart: period.start,
      periodEnd: period.end,
    },
    select: { id: true },
  });

  if (existing) {
    console.log(`   ⏭️  Payroll already exists, skipping...`);
    return { skipped: true, reason: 'already exists' };
  }

  // Get attendance for this period
  const attendance = await prisma.attendance.findMany({
    where: {
      deletedAt: null,
      employeeId: { in: EMPLOYEES },
      status: { in: ['present', 'late'] },
      date: {
        gte: period.start,
        lte: period.end,
      },
    },
    select: {
      employeeId: true,
      employeeName: true,
      totalHours: true,
    },
  });

  if (attendance.length === 0) {
    console.log(`   ⚠️  No attendance records found`);
    return { skipped: true, reason: 'no attendance' };
  }

  const attendanceSummaries = buildAttendanceSummary(attendance);
  console.log(
    `   👥 Found ${attendanceSummaries.length} employees with attendance`
  );

  // Get 13th month pay records
  const payPeriodYear = new Date(period.end).getFullYear();
  const thirteenthMonthRecords = await prisma.thirteenthMonthPayRecord.findMany(
    {
      where: {
        year: payPeriodYear,
        employeeId: { in: EMPLOYEES },
      },
      select: {
        employeeId: true,
        status: true,
        thirteenthMonthPay: true,
      },
    }
  );

  const thirteenthMonthByEmployee = new Map(
    thirteenthMonthRecords
      .filter((record) => record.employeeId)
      .map((record) => [
        record.employeeId,
        {
          amount: Number(record.thirteenthMonthPay) || 0,
          isPaid: record.status === 'paid',
        },
      ])
  );

  // Build payroll records
  const payrollRecords = [];

  for (const summary of attendanceSummaries) {
    const employee = await getEmployeeDetailsForPeriod(
      summary.employeeId,
      period.end
    );

    if (!employee) {
      console.log(`   ⚠️  Employee ${summary.employeeId} not found`);
      continue;
    }

    // Check if employee was hired before or during this period
    if (employee.hireDate && employee.hireDate > period.end) {
      console.log(
        `   ⏭️  ${employee.name} not yet hired (hire date: ${employee.hireDate})`
      );
      continue;
    }

    const baseSalary = employee.basicSalary;
    const allowance = (employee.allowance ?? 0) / 2; // Half-month allowance
    const hourlyRate = baseSalary > 0 ? baseSalary / 26 / 8 : 0;

    // For stay-in employees, standard workday is 13 hours (not 8)
    const standardHours = summary.daysWorked * 13;
    const overtimeHours = Math.max(0, summary.totalHours - standardHours);
    const overtimePay = overtimeHours * hourlyRate * 1.25;

    const basicSalaryHalf = baseSalary / 2;
    const bonuses = 0;

    const thirteenthMonthData = thirteenthMonthByEmployee.get(
      summary.employeeId
    );
    const thirteenthMonth =
      thirteenthMonthData && !thirteenthMonthData.isPaid
        ? thirteenthMonthData.amount
        : 0;

    const grossPay =
      basicSalaryHalf + allowance + overtimePay + bonuses + thirteenthMonth;

    const sss = employee.sssMonthlyContribution ?? 0;
    const philHealth = employee.philHealthMonthlyContribution ?? 0;
    const pagIbig = employee.pagibigMonthlyContribution ?? 0;
    const tax = employee.taxMonthlyContribution ?? 0;
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

    payrollRecords.push({
      employeeId: summary.employeeId,
      employeeName: employee.name,
      payPeriod: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      basicSalary: basicSalaryHalf,
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
      bankGcash: employee.gcashAccount ?? employee.bankAccount ?? '',
    });

    console.log(
      `   ✅ ${employee.name}: ₱${netPay.toFixed(2)} (${summary.daysWorked} days, ${summary.totalHours}hrs${employee.salaryReason ? ', ' + employee.salaryReason : ''})`
    );
  }

  if (payrollRecords.length === 0) {
    console.log(`   ⚠️  No eligible employees for payroll`);
    return { skipped: true, reason: 'no eligible employees' };
  }

  // Create payroll records
  const created = await prisma.payroll.createMany({ data: payrollRecords });
  console.log(`   💰 Created ${created.count} payroll records`);

  return { success: true, count: created.count };
}

async function main() {
  console.log('🚀 Bulk Payroll Generation');
  console.log('='.repeat(50));
  console.log(`Employees: ${EMPLOYEES.join(', ')}`);
  console.log(`Period: January - October 2025`);
  console.log('='.repeat(50));

  // Generate pay periods
  const periods = generatePayPeriods(1, 10, 2025);
  console.log(`\n📊 Total pay periods to process: ${periods.length}`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const period of periods) {
    try {
      const result = await generatePayrollForPeriod(period);
      if (result.success) {
        successCount++;
      } else if (result.skipped) {
        skippedCount++;
      }
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📈 Summary:');
  console.log(`   ✅ Successfully generated: ${successCount} periods`);
  console.log(`   ⏭️  Skipped: ${skippedCount} periods`);
  console.log(`   ❌ Errors: ${errorCount} periods`);
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
