const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearTransactions() {
  try {
    console.log('🗑️  Clearing transactions table...');

    const result = await prisma.transaction.deleteMany({});

    console.log(`✅ Deleted ${result.count} transactions`);
    console.log('✅ Transactions table is now empty');
  } catch (error) {
    console.error('❌ Error clearing transactions:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearTransactions();
