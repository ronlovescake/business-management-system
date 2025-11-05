const { PrismaClient } = require('@prisma/client');

async function hardDeleteNotifications() {
  const prisma = new PrismaClient();

  try {
    console.log(
      '🗑️  Starting hard delete of operations_notifications table...\n'
    );

    // Count current records
    const count =
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM operations_notifications`;
    console.log(
      `📊 Current notifications in database: ${count[0].count} records\n`
    );

    if (count[0].count === 0) {
      console.log('✅ No notifications to delete. Table is already empty.\n');
      return;
    }

    // Confirm before deletion
    console.log(
      '⚠️  WARNING: This will PERMANENTLY delete all notification records!'
    );
    console.log('⚠️  This action CANNOT be undone!\n');

    // Hard delete all notifications using raw SQL
    await prisma.$executeRawUnsafe('DELETE FROM "operations_notifications"');

    console.log(
      `\n✅ Successfully HARD DELETED ${count[0].count} notification records`
    );

    // Verify deletion
    const countAfter =
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM operations_notifications`;
    console.log(
      `\n📊 Verification: ${countAfter[0].count} notification records remain (should be 0)`
    );

    if (countAfter[0].count === 0) {
      console.log('\n🎉 operations_notifications table successfully cleared!');
      console.log('All old IDs and timestamps have been removed.');
    } else {
      console.log(
        `\n⚠️  Warning: ${countAfter[0].count} records still remain in the table`
      );
    }
  } catch (error) {
    console.error('\n❌ Error during hard delete:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the deletion
hardDeleteNotifications()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
