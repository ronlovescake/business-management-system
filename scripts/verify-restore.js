require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCounts() {
  const results = {
    attendance: await prisma.attendance.count(),
    cashAdvances: await prisma.cashAdvanceRecord.count(),
    customers: await prisma.customer.count(),
    employees: await prisma.employee.count(),
    leaveRequests: await prisma.leaveRequest.count(),
    payrolls: await prisma.payroll.count(),
    prices: await prisma.price.count(),
    products: await prisma.product.count(),
    schedules: await prisma.schedule.count(),
    shipments: await prisma.shipment.count(),
    transactions: await prisma.transaction.count(),
  };

  console.log('\n✅ DATABASE RECORD COUNTS:');
  console.log('═'.repeat(50));
  Object.entries(results).forEach(([table, count]) => {
    console.log(
      `${table.padEnd(20)} : ${count.toString().padStart(5)} records`
    );
  });
  console.log('═'.repeat(50));

  const total = Object.values(results).reduce((sum, count) => sum + count, 0);
  console.log(
    `${'TOTAL'.padEnd(20)} : ${total.toString().padStart(5)} records`
  );
  console.log();

  await prisma.$disconnect();
}

verifyCounts().catch(console.error);
