/**
 * Test P2 Database Constraints
 * Verifies unique constraints and check constraints are working
 */

/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConstraints() {
  console.log('🧪 Testing P2 Database Constraints\n');

  let testsRun = 0;
  let testsPassed = 0;

  try {
    // ============================================================================
    // TEST 1: Duplicate Employee ID Prevention
    // ============================================================================
    testsRun++;
    console.log('1️⃣ Testing duplicate employeeId prevention...');

    try {
      await prisma.employee.create({
        data: {
          employeeId: 'TEST-001',
          firstName: 'Test',
          lastName: 'User',
          basicSalary: 5000,
        },
      });

      await prisma.employee.create({
        data: {
          employeeId: 'TEST-001', // Duplicate!
          firstName: 'Another',
          lastName: 'User',
          basicSalary: 6000,
        },
      });

      console.log('   ❌ FAIL: Should have blocked duplicate employeeId\n');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('   ✅ PASS: Duplicate employeeId blocked correctly\n');
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 2: Duplicate Attendance Prevention
    // ============================================================================
    testsRun++;
    console.log('2️⃣ Testing duplicate attendance prevention...');

    try {
      // Get an existing employee
      const employee = await prisma.employee.findFirst({
        where: { deletedAt: null },
      });
      if (!employee) {
        throw new Error('No employee found');
      }

      await prisma.attendance.create({
        data: {
          employeeId: employee.employeeId,
          date: new Date('2025-10-24'),
          status: 'present',
          totalHours: 8,
        },
      });

      await prisma.attendance.create({
        data: {
          employeeId: employee.employeeId,
          date: new Date('2025-10-24'), // Same date!
          status: 'present',
          totalHours: 9,
        },
      });

      console.log('   ❌ FAIL: Should have blocked duplicate attendance\n');
    } catch (error) {
      if (error.code === 'P2002') {
        console.log('   ✅ PASS: Duplicate attendance blocked correctly\n');
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 3: Negative Salary Prevention
    // ============================================================================
    testsRun++;
    console.log('3️⃣ Testing negative salary prevention...');

    try {
      await prisma.employee.create({
        data: {
          employeeId: 'TEST-002',
          firstName: 'Negative',
          lastName: 'Salary',
          basicSalary: -5000, // Negative!
        },
      });

      console.log('   ❌ FAIL: Should have blocked negative salary\n');
    } catch (error) {
      if (
        error.code === 'P2010' ||
        error.message.includes('employee_basic_salary_positive')
      ) {
        console.log('   ✅ PASS: Negative salary blocked correctly\n');
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 4: Invalid Hours Prevention (> 24)
    // ============================================================================
    testsRun++;
    console.log('4️⃣ Testing invalid hours (>24) prevention...');

    try {
      const employee = await prisma.employee.findFirst({
        where: { deletedAt: null },
      });
      if (!employee) {
        throw new Error('No employee found');
      }

      await prisma.attendance.create({
        data: {
          employeeId: employee.employeeId,
          date: new Date('2025-10-25'),
          status: 'present',
          totalHours: 30, // Invalid: > 24
        },
      });

      console.log('   ❌ FAIL: Should have blocked hours > 24\n');
    } catch (error) {
      if (
        error.code === 'P2010' ||
        error.message.includes('attendance_total_hours_valid')
      ) {
        console.log('   ✅ PASS: Hours > 24 blocked correctly\n');
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 5: Deductions > Gross Pay Prevention
    // ============================================================================
    testsRun++;
    console.log('5️⃣ Testing deductions > gross pay prevention...');

    try {
      const employee = await prisma.employee.findFirst({
        where: { deletedAt: null },
      });
      if (!employee) {
        throw new Error('No employee found');
      }

      await prisma.payroll.create({
        data: {
          employeeId: employee.employeeId,
          employeeName: employee.firstName + ' ' + employee.lastName,
          payPeriod: '2025-10-01 to 2025-10-15',
          periodStart: '2025-10-01',
          periodEnd: '2025-10-15',
          basicSalary: 5000,
          allowance: 0,
          overtime: 0,
          bonuses: 0,
          grossPay: 5000,
          sss: 500,
          philHealth: 100,
          pagIbig: 100,
          tax: 500,
          totalDeductions: 10000, // Invalid: > grossPay
          netPay: 0,
          status: 'pending',
        },
      });

      console.log('   ❌ FAIL: Should have blocked deductions > gross pay\n');
    } catch (error) {
      if (
        error.code === 'P2010' ||
        error.message.includes('payroll_deductions_valid')
      ) {
        console.log('   ✅ PASS: Deductions > gross pay blocked correctly\n');
        testsPassed++;
      } else {
        console.log(`   ❌ FAIL: Unexpected error: ${error.message}\n`);
      }
    }

    // ============================================================================
    // TEST 6: Soft Delete + Duplicate Prevention
    // ============================================================================
    testsRun++;
    console.log('6️⃣ Testing soft delete allows re-use of employeeId...');

    try {
      const employee1 = await prisma.employee.create({
        data: {
          employeeId: 'TEST-003',
          firstName: 'Original',
          lastName: 'Employee',
          basicSalary: 5000,
        },
      });

      // Soft delete
      await prisma.employee.update({
        where: { id: employee1.id },
        data: { deletedAt: new Date() },
      });

      // Should be able to create new employee with same employeeId
      await prisma.employee.create({
        data: {
          employeeId: 'TEST-003', // Same ID as deleted
          firstName: 'New',
          lastName: 'Employee',
          basicSalary: 6000,
        },
      });

      console.log('   ✅ PASS: Can reuse employeeId after soft delete\n');
      testsPassed++;
    } catch (error) {
      console.log(
        `   ❌ FAIL: Should allow reuse after soft delete: ${error.message}\n`
      );
    }

    // ============================================================================
    // CLEANUP
    // ============================================================================
    console.log('🧹 Cleaning up test data...');
    await prisma.employee.deleteMany({
      where: {
        employeeId: { in: ['TEST-001', 'TEST-002', 'TEST-003'] },
      },
    });
    await prisma.attendance.deleteMany({
      where: {
        date: { in: [new Date('2025-10-24'), new Date('2025-10-25')] },
      },
    });
    await prisma.payroll.deleteMany({
      where: {
        payPeriod: '2025-10-01 to 2025-10-15',
      },
    });

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(80));
    console.log(`\n✅ Passed: ${testsPassed}/${testsRun}`);
    console.log(
      `${testsPassed === testsRun ? '🎉' : '⚠️'} ${testsPassed === testsRun ? 'ALL TESTS PASSED!' : 'Some tests failed'}\n`
    );

    return testsPassed === testsRun;
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run tests
testConstraints()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
