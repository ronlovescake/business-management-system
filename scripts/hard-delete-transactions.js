/**
 * HARD DELETE ALL TRANSACTIONS
 *
 * ⚠️ WARNING: This script PERMANENTLY deletes all records from the Transaction table.
 * This operation CANNOT be undone.
 *
 * This script:
 * 1. Bypasses soft-delete middleware
 * 2. Permanently removes ALL transaction records
 * 3. Does NOT touch any other tables
 */

const { PrismaClient } = require('@prisma/client');

// Create a new Prisma client without middleware (bypasses soft-delete)
const prisma = new PrismaClient();

async function hardDeleteTransactions() {
  console.log('🗑️  Starting HARD DELETE of all transactions...\n');

  try {
    // Count transactions before deletion
    const countBefore = await prisma.transaction.count();
    console.log(`📊 Found ${countBefore} transaction records\n`);

    if (countBefore === 0) {
      console.log('✅ No transactions to delete. Table is already empty.');
      return;
    }

    // Confirm deletion
    console.log(
      '⚠️  WARNING: This will PERMANENTLY delete all transaction records!'
    );
    console.log('⚠️  This operation CANNOT be undone!\n');

    // Use raw SQL to bypass Prisma middleware completely
    // This directly deletes from the database without any soft-delete intervention
    // Note: PostgreSQL table name is lowercase 'transactions' not 'Transaction'
    await prisma.$executeRawUnsafe('DELETE FROM "transactions"');

    console.log(
      `\n✅ Successfully HARD DELETED ${countBefore} transaction records`
    );

    // Verify deletion
    const countAfter = await prisma.transaction.count();
    console.log(
      `\n📊 Verification: ${countAfter} transaction records remain (should be 0)`
    );

    if (countAfter === 0) {
      console.log('\n🎉 Transaction table successfully cleared!');
    } else {
      console.log(
        `\n⚠️  Warning: ${countAfter} records still remain in the table`
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
hardDeleteTransactions()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
