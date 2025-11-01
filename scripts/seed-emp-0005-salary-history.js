#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('📝 Adding salary history for EMP-0005...');

  // Get employee info
  const employee = await prisma.employee.findUnique({
    where: { employeeId: 'EMP-0005' },
    select: { name: true },
  });

  if (!employee) {
    console.error('❌ Employee EMP-0005 not found');
    process.exit(1);
  }

  // Delete existing salary history for EMP-0005
  await prisma.salaryHistory.deleteMany({
    where: { employeeId: 'EMP-0005' },
  });

  // Add salary records
  const salaryRecords = [
    {
      employeeId: 'EMP-0005',
      employeeName: employee.name,
      effectiveDate: '2025-01-01',
      basicSalary: 10000.0,
      allowance: 3000.0,
      totalSalary: 13000.0,
      reason: 'Initial Salary',
      notes: 'Starting salary as of hire date',
    },
    {
      employeeId: 'EMP-0005',
      employeeName: employee.name,
      effectiveDate: '2025-06-01',
      basicSalary: 12000.0,
      allowance: 3000.0,
      totalSalary: 15000.0,
      reason: 'Salary Increase',
      notes: 'Basic salary increased by ₱2,000.00',
    },
  ];

  for (const record of salaryRecords) {
    await prisma.salaryHistory.create({ data: record });
    console.log(
      `  ✓ Added: ${record.effectiveDate} - ₱${record.totalSalary.toLocaleString()} (${record.reason})`
    );
  }

  console.log('\n✅ Salary history added successfully!');
  console.log('\n13th Month Pay Calculation (Jan-Nov 2025):');
  console.log('  Jan-May (5 months): ₱13,000 × 5 = ₱65,000');
  console.log('  Jun-Nov (6 months): ₱15,000 × 6 = ₱90,000');
  console.log('  Total earned: ₱155,000');
  console.log('  13th month pay: ₱155,000 ÷ 12 = ₱12,916.67');
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
