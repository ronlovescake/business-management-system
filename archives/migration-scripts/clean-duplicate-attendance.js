/* eslint-disable no-console */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanDuplicates() {
  console.log('🧹 Cleaning duplicate attendance records...\n');

  try {
    // Get all attendance records for these employees
    const allRecords = await prisma.attendance.findMany({
      where: {
        employeeId: {
          in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    console.log(`📋 Found ${allRecords.length} total records\n`);

    // Group by employeeId + date
    const groups = {};
    for (const record of allRecords) {
      const key = `${record.employeeId}|${record.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    }

    // Find duplicates and keep the oldest (first created)
    const toDelete = [];
    let duplicateCount = 0;

    for (const [_key, records] of Object.entries(groups)) {
      if (records.length > 1) {
        duplicateCount++;
        // Keep the first one (oldest), delete the rest
        const [_keep, ...deleteRecords] = records;
        toDelete.push(...deleteRecords.map((r) => r.id));
      }
    }

    console.log(`🔍 Found ${duplicateCount} dates with duplicates`);
    console.log(`🗑️  Deleting ${toDelete.length} duplicate records\n`);

    if (toDelete.length > 0) {
      const result = await prisma.attendance.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });

      console.log(`✅ Deleted ${result.count} duplicate records`);

      // Verify final count
      const finalCount = await prisma.attendance.count({
        where: {
          employeeId: {
            in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
          },
        },
      });

      console.log(`\n📊 Final count: ${finalCount} attendance records`);

      // Show breakdown
      const breakdown = await prisma.attendance.groupBy({
        by: ['employeeId', 'status'],
        where: {
          employeeId: {
            in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
          },
        },
        _count: {
          _all: true,
        },
      });

      console.log('\n👥 Employee Breakdown:');
      breakdown.forEach((item) => {
        console.log(
          `   ${item.employeeId} - ${item.status}: ${item._count._all} days`
        );
      });
    } else {
      console.log('✨ No duplicates found!');
    }
  } catch (error) {
    console.error('❌ Error cleaning duplicates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanDuplicates();
