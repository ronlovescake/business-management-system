/**
 * Verify Database State Script
 *
 * Checks that:
 * - Operations workspace tables are empty
 * - Employees workspace tables are intact
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyDatabaseState() {
  console.log('\n🔍 ============================================');
  console.log('🔍 DATABASE STATE VERIFICATION');
  console.log('🔍 ============================================\n');

  try {
    // Check Operations Workspace
    console.log('📊 Operations Workspace Tables:\n');

    const [customers, prices, products, shipments, transactions] =
      await Promise.all([
        prisma.customer.count(),
        prisma.price.count(),
        prisma.product.count(),
        prisma.shipment.count(),
        prisma.transaction.count(),
      ]);

    console.log(
      `   Customers:             ${customers.toLocaleString()} records`
    );
    console.log(`   Prices:                ${prices.toLocaleString()} records`);
    console.log(
      `   Products:              ${products.toLocaleString()} records`
    );
    console.log(
      `   Shipments:             ${shipments.toLocaleString()} records`
    );
    console.log(
      `   Transactions:          ${transactions.toLocaleString()} records`
    );
    const operationsTotal =
      customers + prices + products + shipments + transactions;
    console.log(`\n   Total: ${operationsTotal.toLocaleString()} records`);

    if (operationsTotal === 0) {
      console.log('   ✅ Operations workspace is CLEAN\n');
    } else {
      console.log('   ⚠️  Operations workspace has data\n');
    }

    // Check Employees Workspace
    console.log('📊 Employees Workspace Tables:\n');

    const [employees, attendance, schedules, leaveRequests] = await Promise.all(
      [
        prisma.employee.count(),
        prisma.attendance.count(),
        prisma.schedule.count(),
        prisma.leaveRequest.count(),
      ]
    );

    console.log(`   Employees:      ${employees.toLocaleString()} records`);
    console.log(`   Attendance:     ${attendance.toLocaleString()} records`);
    console.log(`   Schedules:      ${schedules.toLocaleString()} records`);
    console.log(`   Leave Requests: ${leaveRequests.toLocaleString()} records`);

    const employeesTotal = employees + attendance + schedules + leaveRequests;
    console.log(`\n   Total: ${employeesTotal.toLocaleString()} records`);

    if (employeesTotal > 0) {
      console.log('   ✅ Employees workspace is INTACT\n');
    } else {
      console.log('   ⚠️  Employees workspace is empty\n');
    }

    // Summary
    console.log('✅ ============================================');
    console.log('✅ VERIFICATION COMPLETE');
    console.log('✅ ============================================\n');
    console.log('   Database is ready for protection layer implementation!\n');
  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabaseState()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  });
