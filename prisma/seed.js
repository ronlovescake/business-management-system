#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding baseline test data...');

  await prisma.healthCheck.create({
    data: { status: 'ok' },
  });

  await prisma.customer.createMany({
    skipDuplicates: true,
    data: [
      {
        date: '2025-10-15',
        customerName: 'Alice Johnson',
        phoneNumber: '+1-555-0100',
        address: '123 Main St, Springfield',
        facebook: 'alice.johnson',
        emailAddress: 'alice@example.com',
        businessName: 'Alice Apparel',
        taxNumber: 'TX-ALICE-001',
        businessAddress: '123 Warehouse Ave, Springfield',
        businessContactNumber: '+1-555-0110',
        customerStatus: 'active',
      },
      {
        date: '2025-10-10',
        customerName: 'Bob Smith',
        phoneNumber: '+1-555-0200',
        address: '456 Elm St, Centerville',
        facebook: 'bob.smith',
        emailAddress: 'bob@example.com',
        businessName: 'Bob Logistics',
        taxNumber: 'TX-BOB-002',
        businessAddress: '987 Distribution Rd, Centerville',
        businessContactNumber: '+1-555-0210',
        customerStatus: 'prospect',
      },
    ],
  });

  // Shipment seed data removed - SHIP-001 and SHIP-002 were deleted

  await prisma.transaction.createMany({
    skipDuplicates: true,
    data: [
      {
        orderDate: '2025-10-12',
        customers: 'Alice Johnson',
        productCode: 'SKU-1001',
        quantity: 12,
        unitPrice: 120,
        discount: 0,
        adjustment: 0,
        lineTotal: 1440,
        orderStatus: 'processing',
        notes: 'Priority order for launch event',
        invoiceDate: '2025-10-13',
        packedDate: null,
        shipmentCode: 'SHIP-001',
      },
      {
        orderDate: '2025-09-20',
        customers: 'Bob Smith',
        productCode: 'SKU-2040',
        quantity: 4,
        unitPrice: 260,
        discount: 10,
        adjustment: 0,
        lineTotal: 1040,
        orderStatus: 'shipped',
        notes: 'Includes promotional discount',
        invoiceDate: '2025-09-21',
        packedDate: '2025-09-22',
        shipmentCode: 'SHIP-002',
      },
      // Test data for Packing List (Prepared status, line total ≤ ₱50.00)
      {
        orderDate: '2025-10-14',
        customers: 'Alice Johnson',
        productCode: 'SKU-3001',
        quantity: 2,
        unitPrice: 20,
        discount: 0,
        adjustment: 0,
        lineTotal: 40,
        orderStatus: 'Prepared',
        notes: 'Small item for packing list test',
        invoiceDate: null,
        packedDate: null,
        shipmentCode: null,
      },
      {
        orderDate: '2025-10-14',
        customers: 'Bob Smith',
        productCode: 'SKU-3002',
        quantity: 1,
        unitPrice: 50,
        discount: 0,
        adjustment: 0,
        lineTotal: 50,
        orderStatus: 'Prepared',
        notes: 'Another item for packing list test',
        invoiceDate: null,
        packedDate: null,
        shipmentCode: null,
      },
      // Test data for Distribution (any status works)
      {
        orderDate: '2025-10-13',
        customers: 'Alice Johnson',
        productCode: 'SKU-4001',
        quantity: 5,
        unitPrice: 100,
        discount: 0,
        adjustment: 0,
        lineTotal: 500,
        orderStatus: 'processing',
        notes: 'Item for distribution test',
        invoiceDate: null,
        packedDate: null,
        shipmentCode: null,
      },
    ],
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
