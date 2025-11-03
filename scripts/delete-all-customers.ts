/**
 * Script to hard delete all customers from the database
 *
 * WARNING: This will permanently delete ALL customer records and their associated data.
 * This action cannot be undone.
 *
 * Usage: npx tsx scripts/delete-all-customers.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllCustomers() {
  try {
    console.log('🗑️  Starting customer deletion process...\n');

    // First, delete all AdditionalCustomerInfo records (child records)
    console.log('Step 1: Deleting additional customer info records...');
    const deletedAdditionalInfo =
      await prisma.additionalCustomerInfo.deleteMany({});
    console.log(
      `✅ Deleted ${deletedAdditionalInfo.count} additional info records\n`
    );

    // Then, delete all Customer records
    console.log('Step 2: Deleting customer records...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`✅ Deleted ${deletedCustomers.count} customer records\n`);

    // Verify deletion
    const remainingCustomers = await prisma.customer.count();
    const remainingAdditionalInfo = await prisma.additionalCustomerInfo.count();

    console.log('📊 Verification:');
    console.log(`   Remaining customers: ${remainingCustomers}`);
    console.log(`   Remaining additional info: ${remainingAdditionalInfo}\n`);

    if (remainingCustomers === 0 && remainingAdditionalInfo === 0) {
      console.log(
        '✅ SUCCESS: All customers and related data have been deleted.'
      );
    } else {
      console.log('⚠️  WARNING: Some records may not have been deleted.');
    }
  } catch (error) {
    console.error('❌ Error deleting customers:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Confirmation prompt
console.log(
  '\n⚠️  WARNING: This will permanently delete ALL customers from the database!'
);
console.log('⚠️  This action CANNOT be undone.\n');

// Check if --confirm flag is passed
const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('To proceed, run this script with the --confirm flag:');
  console.log('npx tsx scripts/delete-all-customers.ts --confirm\n');
  process.exit(0);
}

console.log('🔴 Confirmation received. Proceeding with deletion...\n');
deleteAllCustomers()
  .then(() => {
    console.log('\n✅ Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
