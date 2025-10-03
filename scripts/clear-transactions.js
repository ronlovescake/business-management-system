import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearTransactions() {
  try {
    console.log('Deleting all transactions...');
    const result = await prisma.transaction.deleteMany();
    console.log(`✅ Successfully deleted ${result.count} transaction records`);
  } catch (error) {
    console.error('❌ Error deleting transactions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearTransactions();
