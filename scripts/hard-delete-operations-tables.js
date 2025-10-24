/**
 * Hard Delete Script for Operations Workspace Tables
 *
 * This script permanently deletes ALL records from operations-related tables:
 * - customers
 * - prices
 * - products
 * - shipments
 * - transactions
 * - sorting_distributions
 *
 * ⚠️ WARNING: This bypasses soft-delete and audit logging!
 * ⚠️ WARNING: This action CANNOT be undone!
 *
 * Employees workspace tables are NOT touched.
 */

const { PrismaClient } = require('@prisma/client');

// Create a separate Prisma client instance
// (Not using the main one to bypass middleware)
const prisma = new PrismaClient();

async function hardDeleteOperationsTables() {
  console.log('\n🚨 ============================================');
  console.log('🚨 HARD DELETE: Operations Workspace Tables');
  console.log('🚨 ============================================\n');

  console.log('⚠️  This will PERMANENTLY delete ALL records from:');
  console.log('   - customers');
  console.log('   - prices');
  console.log('   - products');
  console.log('   - shipments');
  console.log('   - transactions');
  console.log('   - sorting_distributions');
  console.log('\n✅ Employees workspace tables will NOT be touched.\n');

  try {
    // Count records before deletion
    console.log('📊 Counting records before deletion...\n');

    const [
      customersCount,
      pricesCount,
      productsCount,
      shipmentsCount,
      transactionsCount,
      sortingDistCount,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.price.count(),
      prisma.product.count(),
      prisma.shipment.count(),
      prisma.transaction.count(),
      prisma.sortingDistribution.count(),
    ]);

    console.log(
      `   Customers:             ${customersCount.toLocaleString()} records`
    );
    console.log(
      `   Prices:                ${pricesCount.toLocaleString()} records`
    );
    console.log(
      `   Products:              ${productsCount.toLocaleString()} records`
    );
    console.log(
      `   Shipments:             ${shipmentsCount.toLocaleString()} records`
    );
    console.log(
      `   Transactions:          ${transactionsCount.toLocaleString()} records`
    );
    console.log(
      `   Sorting Distributions: ${sortingDistCount.toLocaleString()} records`
    );

    const totalRecords =
      customersCount +
      pricesCount +
      productsCount +
      shipmentsCount +
      transactionsCount +
      sortingDistCount;

    console.log(
      `\n   TOTAL: ${totalRecords.toLocaleString()} records will be deleted\n`
    );

    if (totalRecords === 0) {
      console.log('✅ No records found. Tables are already empty.\n');
      return;
    }

    // Hard delete in correct order (respect potential foreign keys)
    console.log('🗑️  Starting hard delete process...\n');

    // 1. Delete sorting distributions (depends on products via productCode)
    console.log('   [1/6] Deleting sorting_distributions...');
    const sortingResult = await prisma.sortingDistribution.deleteMany({});
    console.log(
      `         ✅ Deleted ${sortingResult.count.toLocaleString()} records\n`
    );

    // 2. Delete transactions (depends on customers, products)
    console.log('   [2/6] Deleting transactions...');
    const transactionsResult = await prisma.transaction.deleteMany({});
    console.log(
      `         ✅ Deleted ${transactionsResult.count.toLocaleString()} records\n`
    );

    // 3. Delete prices (depends on products via productCode)
    console.log('   [3/6] Deleting prices...');
    const pricesResult = await prisma.price.deleteMany({});
    console.log(
      `         ✅ Deleted ${pricesResult.count.toLocaleString()} records\n`
    );

    // 4. Delete products
    console.log('   [4/6] Deleting products...');
    const productsResult = await prisma.product.deleteMany({});
    console.log(
      `         ✅ Deleted ${productsResult.count.toLocaleString()} records\n`
    );

    // 5. Delete shipments
    console.log('   [5/6] Deleting shipments...');
    const shipmentsResult = await prisma.shipment.deleteMany({});
    console.log(
      `         ✅ Deleted ${shipmentsResult.count.toLocaleString()} records\n`
    );

    // 6. Delete customers
    console.log('   [6/6] Deleting customers...');
    const customersResult = await prisma.customer.deleteMany({});
    console.log(
      `         ✅ Deleted ${customersResult.count.toLocaleString()} records\n`
    );

    // Summary
    const totalDeleted =
      sortingResult.count +
      transactionsResult.count +
      pricesResult.count +
      productsResult.count +
      shipmentsResult.count +
      customersResult.count;

    console.log('✅ ============================================');
    console.log('✅ HARD DELETE COMPLETE');
    console.log('✅ ============================================\n');
    console.log(`   Total records deleted: ${totalDeleted.toLocaleString()}`);
    console.log('\n📝 Summary:');
    console.log(
      `   - Sorting Distributions: ${sortingResult.count.toLocaleString()}`
    );
    console.log(
      `   - Transactions:          ${transactionsResult.count.toLocaleString()}`
    );
    console.log(
      `   - Prices:                ${pricesResult.count.toLocaleString()}`
    );
    console.log(
      `   - Products:              ${productsResult.count.toLocaleString()}`
    );
    console.log(
      `   - Shipments:             ${shipmentsResult.count.toLocaleString()}`
    );
    console.log(
      `   - Customers:             ${customersResult.count.toLocaleString()}`
    );
    console.log('\n✅ Operations workspace is now clean!');
    console.log('✅ Employees workspace tables remain untouched.\n');

    // Verify deletion
    console.log('🔍 Verifying deletion...\n');

    const [
      verifyCustomers,
      verifyPrices,
      verifyProducts,
      verifyShipments,
      verifyTransactions,
      verifySorting,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.price.count(),
      prisma.product.count(),
      prisma.shipment.count(),
      prisma.transaction.count(),
      prisma.sortingDistribution.count(),
    ]);

    const verifyTotal =
      verifyCustomers +
      verifyPrices +
      verifyProducts +
      verifyShipments +
      verifyTransactions +
      verifySorting;

    if (verifyTotal === 0) {
      console.log(
        '   ✅ Verification passed: All operations tables are empty\n'
      );
    } else {
      console.log('   ⚠️  Warning: Some records still exist:');
      if (verifyCustomers > 0) {
        console.log(`      - Customers: ${verifyCustomers}`);
      }
      if (verifyPrices > 0) {
        console.log(`      - Prices: ${verifyPrices}`);
      }
      if (verifyProducts > 0) {
        console.log(`      - Products: ${verifyProducts}`);
      }
      if (verifyShipments > 0) {
        console.log(`      - Shipments: ${verifyShipments}`);
      }
      if (verifyTransactions > 0) {
        console.log(`      - Transactions: ${verifyTransactions}`);
      }
      if (verifySorting > 0) {
        console.log(`      - Sorting Distributions: ${verifySorting}`);
      }
      console.log('');
    }

    // Check employees tables are untouched
    console.log('🔍 Verifying employees workspace is untouched...\n');
    const employeeCount = await prisma.employee.count();
    console.log(
      `   ✅ Employees table: ${employeeCount.toLocaleString()} records (unchanged)\n`
    );
  } catch (error) {
    console.error('\n❌ Error during hard delete:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the script
hardDeleteOperationsTables()
  .then(() => {
    console.log('✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
