const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function clearCustomers() {
  try {
    console.log('🗑️  Clearing customers table...');

    const result = await prisma.customer.deleteMany({});

    console.log(`✅ Deleted ${result.count} customers`);
    console.log('✅ Customers table is now empty');
  } catch (error) {
    console.error('❌ Error clearing customers:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearCustomers();
