/**
 * Data Integrity Validation Script
 * Run BEFORE applying migration to ensure data quality
 */

/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateDataIntegrity() {
  const issues = [];

  console.log('🔍 Starting data integrity validation...\n');

  try {
    // ============================================================================
    // CHECK 1: Duplicate employeeIds
    // ============================================================================
    console.log('1️⃣ Checking for duplicate employeeIds...');
    const duplicateEmployeeIds = await prisma.$queryRaw`
      SELECT "employeeId", COUNT(*) as count
      FROM employees
      WHERE "deletedAt" IS NULL
      GROUP BY "employeeId"
      HAVING COUNT(*) > 1
    `;

    if (duplicateEmployeeIds.length > 0) {
      issues.push({
        severity: 'CRITICAL',
        category: 'Duplicate Employees',
        count: duplicateEmployeeIds.length,
        details: duplicateEmployeeIds.map(
          (d) => `${d.employeeId} (${d.count} records)`
        ),
        solution: 'Run: node scripts/merge-duplicate-employees.js',
      });
    } else {
      console.log('   ✅ No duplicate employeeIds found\n');
    }

    // ============================================================================
    // CHECK 2: Orphaned attendance records
    // ============================================================================
    console.log('2️⃣ Checking for orphaned attendance records...');
    const orphanedAttendance = await prisma.$queryRaw`
      SELECT a.id, a."employeeId", a.date
      FROM attendance a
      WHERE a."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM employees e
        WHERE e."employeeId" = a."employeeId"
        AND e."deletedAt" IS NULL
      )
      LIMIT 10
    `;

    if (orphanedAttendance.length > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Orphaned Attendance',
        count: orphanedAttendance.length,
        details: orphanedAttendance.map((r) => `${r.employeeId} on ${r.date}`),
        solution: 'Soft delete orphaned records or link to valid employee',
      });
    } else {
      console.log('   ✅ No orphaned attendance records\n');
    }

    // ============================================================================
    // CHECK 3: Duplicate attendance records
    // ============================================================================
    console.log('3️⃣ Checking for duplicate attendance records...');
    const duplicateAttendance = await prisma.$queryRaw`
      SELECT "employeeId", date, COUNT(*) as count
      FROM attendance
      WHERE "deletedAt" IS NULL
      GROUP BY "employeeId", date
      HAVING COUNT(*) > 1
    `;

    if (duplicateAttendance.length > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Duplicate Attendance',
        count: duplicateAttendance.length,
        details: duplicateAttendance
          .slice(0, 10)
          .map((d) => `${d.employeeId} on ${d.date} (${d.count} records)`),
        solution: 'Keep most recent record, soft delete others',
      });
    } else {
      console.log('   ✅ No duplicate attendance records\n');
    }

    // ============================================================================
    // CHECK 4: Orphaned schedules
    // ============================================================================
    console.log('4️⃣ Checking for orphaned schedules...');
    const orphanedSchedules = await prisma.$queryRaw`
      SELECT s.id, s."employeeId", s.date
      FROM schedules s
      WHERE s."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM employees e
        WHERE e."employeeId" = s."employeeId"
        AND e."deletedAt" IS NULL
      )
      LIMIT 10
    `;

    if (orphanedSchedules.length > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Orphaned Schedules',
        count: orphanedSchedules.length,
        details: orphanedSchedules.map((r) => `${r.employeeId} on ${r.date}`),
        solution: 'Soft delete orphaned schedules',
      });
    } else {
      console.log('   ✅ No orphaned schedules\n');
    }

    // ============================================================================
    // CHECK 5: Duplicate schedules
    // ============================================================================
    console.log('5️⃣ Checking for duplicate schedules...');
    const duplicateSchedules = await prisma.$queryRaw`
      SELECT "employeeId", date, "shiftType", COUNT(*) as count
      FROM schedules
      WHERE "deletedAt" IS NULL
      GROUP BY "employeeId", date, "shiftType"
      HAVING COUNT(*) > 1
    `;

    if (duplicateSchedules.length > 0) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Duplicate Schedules',
        count: duplicateSchedules.length,
        details: duplicateSchedules
          .slice(0, 10)
          .map(
            (d) =>
              `${d.employeeId} on ${d.date} ${d.shiftType} (${d.count} records)`
          ),
        solution: 'Keep most recent record, soft delete others',
      });
    } else {
      console.log('   ✅ No duplicate schedules\n');
    }

    // ============================================================================
    // CHECK 6: Orphaned payrolls
    // ============================================================================
    console.log('6️⃣ Checking for orphaned payrolls...');
    const orphanedPayrolls = await prisma.$queryRaw`
      SELECT p.id, p."employeeId", p."periodStart"
      FROM payrolls p
      WHERE p."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM employees e
        WHERE e."employeeId" = p."employeeId"
        AND e."deletedAt" IS NULL
      )
      LIMIT 10
    `;

    if (orphanedPayrolls.length > 0) {
      issues.push({
        severity: 'CRITICAL',
        category: 'Orphaned Payrolls',
        count: orphanedPayrolls.length,
        details: orphanedPayrolls.map(
          (r) => `${r.employeeId} period ${r.periodStart}`
        ),
        solution: 'Review and link to valid employee or soft delete',
      });
    } else {
      console.log('   ✅ No orphaned payrolls\n');
    }

    // ============================================================================
    // CHECK 7: Invalid attendance hours
    // ============================================================================
    console.log('7️⃣ Checking for invalid attendance hours...');
    const invalidHours = await prisma.attendance.count({
      where: {
        deletedAt: null,
        OR: [{ totalHours: { lt: 0 } }, { totalHours: { gt: 24 } }],
      },
    });

    if (invalidHours > 0) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Invalid Hours',
        count: invalidHours,
        details: ['Hours outside 0-24 range'],
        solution: 'Correct invalid hour values',
      });
    } else {
      console.log('   ✅ All attendance hours valid\n');
    }

    // ============================================================================
    // CHECK 8: Invalid payroll calculations
    // ============================================================================
    console.log('8️⃣ Checking for invalid payroll calculations...');
    const invalidPayrolls = await prisma.$queryRaw`
      SELECT id, "employeeId", "grossPay", "totalDeductions", "netPay"
      FROM payrolls
      WHERE "deletedAt" IS NULL
      AND (
        "netPay" < 0
        OR "totalDeductions" > "grossPay"
        OR "grossPay" < 0
      )
      LIMIT 10
    `;

    if (invalidPayrolls.length > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Invalid Payroll',
        count: invalidPayrolls.length,
        details: invalidPayrolls.map(
          (p) =>
            `${p.employeeId}: GP=${p.grossPay} TD=${p.totalDeductions} NP=${p.netPay}`
        ),
        solution: 'Recalculate invalid payroll records',
      });
    } else {
      console.log('   ✅ All payroll calculations valid\n');
    }

    // ============================================================================
    // CHECK 9: Invalid employee data
    // ============================================================================
    console.log('9️⃣ Checking for invalid employee data...');
    const invalidEmployees = await prisma.employee.count({
      where: {
        deletedAt: null,
        basicSalary: { lt: 0 },
      },
    });

    if (invalidEmployees > 0) {
      issues.push({
        severity: 'HIGH',
        category: 'Invalid Employee',
        count: invalidEmployees,
        details: ['Negative salary values'],
        solution: 'Correct negative salary values',
      });
    } else {
      console.log('   ✅ All employee data valid\n');
    }

    // ============================================================================
    // CHECK 10: Duplicate emails
    // ============================================================================
    console.log('🔟 Checking for duplicate emails...');
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM employees
      WHERE "deletedAt" IS NULL
      AND email IS NOT NULL
      AND email != ''
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    if (duplicateEmails.length > 0) {
      issues.push({
        severity: 'MEDIUM',
        category: 'Duplicate Emails',
        count: duplicateEmails.length,
        details: duplicateEmails
          .slice(0, 10)
          .map((d) => `${d.email} (${d.count} employees)`),
        solution: 'Update duplicate emails to be unique',
      });
    } else {
      console.log('   ✅ No duplicate emails\n');
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 VALIDATION SUMMARY');
    console.log('='.repeat(80) + '\n');

    if (issues.length === 0) {
      console.log('✅ ✅ ✅ ALL CHECKS PASSED! ✅ ✅ ✅');
      console.log('\n✨ Your database is ready for the P2 migration!');
      console.log('\n📝 Next steps:');
      console.log(
        '   1. Run: npx prisma migrate dev --name add_foreign_keys_and_unique_constraints'
      );
      console.log('   2. Test foreign key constraints');
      console.log('   3. Implement upsert/restore pattern\n');
      return true;
    }

    console.log(`❌ Found ${issues.length} issue category(ies):\n`);

    const critical = issues.filter((i) => i.severity === 'CRITICAL');
    const high = issues.filter((i) => i.severity === 'HIGH');
    const medium = issues.filter((i) => i.severity === 'MEDIUM');

    if (critical.length > 0) {
      console.log('🔴 CRITICAL ISSUES (must fix):');
      critical.forEach((issue, idx) => {
        console.log(
          `\n   ${idx + 1}. ${issue.category} (${issue.count} records)`
        );
        console.log(`      ${issue.details.slice(0, 3).join(', ')}`);
        console.log(`      💡 ${issue.solution}`);
      });
    }

    if (high.length > 0) {
      console.log('\n\n🟠 HIGH PRIORITY (should fix):');
      high.forEach((issue, idx) => {
        console.log(
          `\n   ${idx + 1}. ${issue.category} (${issue.count} records)`
        );
        console.log(`      ${issue.details.slice(0, 3).join(', ')}`);
        console.log(`      💡 ${issue.solution}`);
      });
    }

    if (medium.length > 0) {
      console.log('\n\n🟡 MEDIUM PRIORITY (recommended):');
      medium.forEach((issue, idx) => {
        console.log(
          `\n   ${idx + 1}. ${issue.category} (${issue.count} records)`
        );
        console.log(`      ${issue.details.slice(0, 3).join(', ')}`);
        console.log(`      💡 ${issue.solution}`);
      });
    }

    console.log('\n\n⚠️  DO NOT RUN MIGRATION until issues are resolved!');
    console.log(
      '💾 Backup recommendation: Run database snapshot before fixing\n'
    );

    return false;
  } catch (error) {
    console.error('❌ Validation failed with error:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run validation
validateDataIntegrity()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
