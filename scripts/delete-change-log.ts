import { prisma } from '@/lib/db';

async function deleteAllChangeLogs() {
  try {
    console.log('🗑️  Deleting all records from change_log table...');

    const result = await prisma.changeLog.deleteMany({});

    console.log(
      `✅ Successfully deleted ${result.count} records from change_log table`
    );
    console.log('✅ All other tables remain untouched');
  } catch (error) {
    console.error('❌ Error deleting change logs:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllChangeLogs();
