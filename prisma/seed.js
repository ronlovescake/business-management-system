#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding baseline test data...');

  await prisma.healthCheck.create({
    data: { status: 'ok' },
  });

  // Customer seed data removed - Alice Johnson and Bob Smith were deleted

  // Shipment seed data removed - SHIP-001 and SHIP-002 were deleted

  // Transaction seed data removed - Records for Alice Johnson and Bob Smith were deleted

  console.log('✅ Test data seeded.');
}

main()
  .catch((error) => {
    console.error('❌ Failed to seed database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
