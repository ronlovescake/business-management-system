/**
 * Clear all products from the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearProducts() {
  try {
    console.log('🗑️  Clearing all products from database...');
    
    const result = await prisma.product.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.count} products`);
    console.log('📊 Products table is now empty and ready for fresh import');
  } catch (error) {
    console.error('❌ Error clearing products:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearProducts();
