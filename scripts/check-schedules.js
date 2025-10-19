#!/usr/bin/env node

/**
 * Quick script to check schedules in database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSchedules() {
  try {
    console.log('🔍 Checking schedules in database...\n');

    // Total count
    const total = await prisma.schedule.count({
      where: { deletedAt: null },
    });

    // By status
    const byStatus = await prisma.schedule.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: true,
    });

    // By employee
    const byEmployee = await prisma.schedule.groupBy({
      by: ['employeeId', 'employeeName'],
      where: { deletedAt: null },
      _count: true,
    });

    // Date range
    const dateRange = await prisma.schedule.aggregate({
      where: { deletedAt: null },
      _min: { date: true },
      _max: { date: true },
    });

    console.log('📊 TOTAL SCHEDULES:', total);
    console.log('\n📈 BY STATUS:');
    byStatus.forEach((s) => {
      console.log(`   ${s.status}: ${s._count}`);
    });

    console.log('\n👥 BY EMPLOYEE:');
    byEmployee.forEach((e) => {
      console.log(
        `   ${e.employeeId} - ${e.employeeName}: ${e._count} schedules`
      );
    });

    console.log('\n📅 DATE RANGE:');
    console.log(`   From: ${dateRange._min.date}`);
    console.log(`   To: ${dateRange._max.date}`);

    console.log('\n✅ All data is in the database!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSchedules();
