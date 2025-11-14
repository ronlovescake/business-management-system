#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding baseline test data...');

  await prisma.healthCheck.create({
    data: { status: 'ok' },
  });

  // Baseline customer to satisfy integration checks
  await prisma.customer.deleteMany({
    where: {
      customerName: { in: ['Alice Johnson'] },
    },
  });

  await prisma.customer.create({
    data: {
      date: '2025-01-01',
      customerName: 'Alice Johnson',
      phoneNumber: '09171234567',
      address: '123 Main Street, Quezon City',
      facebook: 'alice.johnson',
      emailAddress: 'alice.johnson@example.com',
      businessName: 'AJ Trading',
      taxNumber: 'TIN-123456789',
      businessAddress: 'Unit 10, Business Park, Quezon City',
      businessContactNumber: '0287654321',
      customerStatus: 'active',
    },
  });

  // Baseline shipment for integrity tests
  await prisma.shipment.deleteMany({
    where: { shipmentCode: { in: ['SHIP-001'] } },
  });

  await prisma.shipment.create({
    data: {
      shipmentCode: 'SHIP-001',
      cvNumber: 'CV-001',
      noOfSacks: 10,
      totalCBM: 2.5,
      weight: 150,
      fee: 1200,
      shipmentStatus: 'in_transit',
      dateCreated: '2025-01-05',
      dateDelivered: null,
      duration: null,
      notes: 'Seed shipment record',
    },
  });

  // Baseline transaction to validate soft-delete behaviour
  await prisma.transaction.deleteMany({
    where: { customers: { in: ['Alice Johnson'] } },
  });

  await prisma.transaction.create({
    data: {
      orderDate: '2025-01-10',
      customers: 'Alice Johnson',
      productCode: 'PROD-001',
      quantity: 5,
      unitPrice: 199.99,
      discount: 0,
      adjustment: 0,
      lineTotal: 999.95,
      orderStatus: 'processing',
      notes: 'Seed order for integration test',
      invoiceDate: '2025-01-11',
      packedDate: null,
      shipmentCode: 'SHIP-001',
    },
  });

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
