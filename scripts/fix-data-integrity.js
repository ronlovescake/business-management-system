/**
 * Fix Data Integrity Issues
 * Fixes issues found by validate-data-integrity.js
 */

/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDataIntegrityIssues() {
  console.log('🔧 Starting data integrity fixes...\n');

  try {
    // ============================================================================
    // FIX 1: Invalid Payroll (Deductions > Gross Pay)
    // ============================================================================
    console.log('1️⃣ Fixing invalid payroll calculations...');

    const invalidPayrolls = await prisma.$queryRaw`
      SELECT id, "employeeId", "grossPay", "totalDeductions", "netPay"
      FROM payrolls
      WHERE "deletedAt" IS NULL
      AND (
        "netPay" < 0
        OR "totalDeductions" > "grossPay"
        OR "grossPay" < 0
      )
    `;

    if (invalidPayrolls.length > 0) {
      console.log(
        `   Found ${invalidPayrolls.length} invalid payroll record(s)`
      );

      for (const payroll of invalidPayrolls) {
        console.log(`   Fixing payroll for ${payroll.employeeId}:`);
        console.log(
          `     Before: GP=${payroll.grossPay} TD=${payroll.totalDeductions} NP=${payroll.netPay}`
        );

        // Recalculate net pay correctly
        const correctNetPay = Math.max(
          0,
          payroll.grossPay - payroll.totalDeductions
        );

        await prisma.payroll.update({
          where: { id: payroll.id },
          data: {
            netPay: correctNetPay,
            updatedAt: new Date(),
          },
        });

        console.log(
          `     After:  GP=${payroll.grossPay} TD=${payroll.totalDeductions} NP=${correctNetPay}`
        );
        console.log(`     ✅ Fixed\n`);
      }
    } else {
      console.log('   ✅ No invalid payrolls found\n');
    }

    // ============================================================================
    // FIX 2: Duplicate Emails
    // ============================================================================
    console.log('2️⃣ Fixing duplicate emails...');

    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, array_agg(id) as ids, array_agg("employeeId") as employee_ids
      FROM employees
      WHERE "deletedAt" IS NULL
      AND email IS NOT NULL
      AND email != ''
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    if (duplicateEmails.length > 0) {
      console.log(`   Found ${duplicateEmails.length} duplicate email(s)`);

      for (const emailGroup of duplicateEmails) {
        console.log(`\n   Email: ${emailGroup.email}`);
        console.log(`   Employees: ${emailGroup.employee_ids.join(', ')}`);

        // Keep first employee's email, make others unique
        const ids = emailGroup.ids;
        for (let i = 1; i < ids.length; i++) {
          const newEmail = `${emailGroup.email.split('@')[0]}_${i}@${emailGroup.email.split('@')[1]}`;

          await prisma.employee.update({
            where: { id: ids[i] },
            data: {
              email: newEmail,
              updatedAt: new Date(),
            },
          });

          console.log(
            `     Updated employee ${emailGroup.employee_ids[i]}: ${emailGroup.email} → ${newEmail}`
          );
        }

        console.log(`   ✅ Fixed`);
      }
    } else {
      console.log('   ✅ No duplicate emails found\n');
    }

    // ============================================================================
    // FIX 3: Negative Salaries (if any)
    // ============================================================================
    console.log('\n3️⃣ Checking for negative salaries...');

    const negativeSalaries = await prisma.employee.findMany({
      where: {
        deletedAt: null,
        basicSalary: { lt: 0 },
      },
    });

    if (negativeSalaries.length > 0) {
      console.log(
        `   Found ${negativeSalaries.length} employee(s) with negative salary`
      );

      for (const employee of negativeSalaries) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: {
            basicSalary: Math.abs(employee.basicSalary),
            updatedAt: new Date(),
          },
        });

        console.log(
          `   Fixed ${employee.employeeId}: ${employee.basicSalary} → ${Math.abs(employee.basicSalary)}`
        );
      }

      console.log('   ✅ Fixed\n');
    } else {
      console.log('   ✅ No negative salaries found\n');
    }

    // ============================================================================
    // FIX 4: Invalid Hours (if any)
    // ============================================================================
    console.log('4️⃣ Checking for invalid attendance hours...');

    const invalidHours = await prisma.attendance.findMany({
      where: {
        deletedAt: null,
        OR: [{ totalHours: { lt: 0 } }, { totalHours: { gt: 24 } }],
      },
    });

    if (invalidHours.length > 0) {
      console.log(
        `   Found ${invalidHours.length} attendance record(s) with invalid hours`
      );

      for (const attendance of invalidHours) {
        // Cap hours at 24, floor at 0
        const correctedHours = Math.max(0, Math.min(24, attendance.totalHours));

        await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            totalHours: correctedHours,
            updatedAt: new Date(),
          },
        });

        console.log(
          `   Fixed ${attendance.employeeId} on ${attendance.date}: ${attendance.totalHours} → ${correctedHours} hours`
        );
      }

      console.log('   ✅ Fixed\n');
    } else {
      console.log('   ✅ No invalid hours found\n');
    }

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL FIXES COMPLETE!');
    console.log('='.repeat(80));
    console.log('\n📝 Next steps:');
    console.log(
      '   1. Run validation again: node scripts/validate-data-integrity.js'
    );
    console.log('   2. If validation passes, run migration:');
    console.log(
      '      npx prisma migrate dev --name add_foreign_keys_and_unique_constraints'
    );
    console.log('   3. Test the new constraints\n');
  } catch (error) {
    console.error('❌ Fix failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run fixes
fixDataIntegrityIssues()
  .then(() => {
    console.log('✨ Fix script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
