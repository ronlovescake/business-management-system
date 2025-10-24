/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Clear All Tables Script
 *
 * This script clears:
 * - Transactions table
 * - Prices table
 * - Products table
 * - Customers table
 *
 * Order matters due to foreign key constraints.
 */
async function clearAllTables() {
  try {
    console.log('🚨 CLEARING ALL TABLES');
    console.log('='.repeat(50));
    console.log('This will delete all records from:');
    console.log('  - Transactions');
    console.log('  - Prices');
    console.log('  - Products');
    console.log('  - Customers');
    console.log('='.repeat(50));

    // Delete in order to respect foreign key constraints

    // 1. Delete transactions first (may reference products/customers)
    console.log('\n🗑️  Clearing transactions table...');
    const transactionsResult = await prisma.transaction.deleteMany({});
    console.log(`✅ Deleted ${transactionsResult.count} transactions`);

    // 2. Delete prices (references products)
    console.log('\n🗑️  Clearing prices table...');
    const pricesResult = await prisma.price.deleteMany({});
    console.log(`✅ Deleted ${pricesResult.count} prices`);

    // 3. Delete products
    console.log('\n🗑️  Clearing products table...');
    const productsResult = await prisma.product.deleteMany({});
    console.log(`✅ Deleted ${productsResult.count} products`);

    // 4. Delete customers
    console.log('\n🗑️  Clearing customers table...');
    const customersResult = await prisma.customer.deleteMany({});
    console.log(`✅ Deleted ${customersResult.count} customers`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL TABLES CLEARED SUCCESSFULLY');
    console.log('='.repeat(50));
    console.log('\nSummary:');
    console.log(`  - Transactions: ${transactionsResult.count}`);
    console.log(`  - Prices: ${pricesResult.count}`);
    console.log(`  - Products: ${productsResult.count}`);
    console.log(`  - Customers: ${customersResult.count}`);
    console.log(
      `  TOTAL: ${transactionsResult.count + pricesResult.count + productsResult.count + customersResult.count} records deleted`
    );
  } catch (error) {
    console.error('\n❌ Error clearing tables:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearAllTables();
