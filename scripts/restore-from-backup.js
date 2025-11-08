#!/usr/bin/env node
/**
 * Emergency Database Restore Script
 * Restores data from CSV backup files
 */

require('dotenv').config({ path: '.env.local' });
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

const prisma = new PrismaClient();

async function restoreFromBackup(backupDir) {
  console.log(`🔄 Starting restore from ${backupDir}...`);

  const files = fs.readdirSync(backupDir).filter((f) => f.endsWith('.csv'));

  for (const file of files) {
    const tableName = file.split('-')[0]; // Extract table name from filename
    const filePath = path.join(backupDir, file);
    const csvContent = fs.readFileSync(filePath, 'utf-8');

    const { data } = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (data.length === 0) {
      console.log(`⏭️  Skipping ${tableName} - no data`);
      continue;
    }

    console.log(`📥 Restoring ${tableName} - ${data.length} records...`);

    try {
      // Convert CSV data to match database schema
      const records = data.map((row) => {
        const record = {};
        for (const [key, value] of Object.entries(row)) {
          // Skip auto-increment id fields
          if (key === 'id') {
            continue;
          }

          // Handle empty strings and nulls - for required fields, use empty string
          const requiredStringFields = [
            'businessName',
            'taxNumber',
            'businessAddress',
            'businessContactNumber',
            'emailAddress',
            'facebook',
            'address',
            'phoneNumber',
            'customerName',
            'date',
          ];
          if (value === '' || value === 'null' || value === 'NULL') {
            record[key] = requiredStringFields.includes(key) ? '' : null;
          } else if (value === 'true') {
            record[key] = true;
          } else if (value === 'false') {
            record[key] = false;
          } else if (value && value.startsWith('"') && value.endsWith('"')) {
            // Remove quotes from quoted values and try to parse as number
            const unquoted = value.slice(1, -1);
            const num = parseFloat(unquoted);
            record[key] = isNaN(num) ? unquoted : num;
          } else if (
            !isNaN(value) &&
            value !== '' &&
            key !== 'phoneNumber' &&
            key !== 'phone' &&
            key !== 'contact' &&
            key !== 'bankGcash' &&
            key !== 'gcashAccount' &&
            key !== 'duration' &&
            key !== 'emergencyContactNumber' &&
            key !== 'emergencyContact' &&
            key !== 'sssNumber' &&
            key !== 'philHealthNumber' &&
            key !== 'hdmfNumber' &&
            key !== 'tinNumber' &&
            key !== 'businessContactNumber'
          ) {
            // Parse as number, except for phone/contact/ID fields which should stay as strings
            record[key] = parseFloat(value);
          } else {
            record[key] = value;
          }
        }
        return record;
      });

      // Use raw SQL to insert data
      if (tableName === 'customers') {
        await prisma.$executeRawUnsafe(`DELETE FROM "Customer"`);
        for (const record of records) {
          await prisma.customer.create({ data: record });
        }
      } else if (tableName === 'employees') {
        await prisma.employee.deleteMany({});
        for (const record of records) {
          await prisma.employee.create({ data: record });
        }
      } else if (tableName === 'products') {
        await prisma.product.deleteMany({});
        for (const record of records) {
          await prisma.product.create({ data: record });
        }
      } else if (tableName === 'transactions') {
        await prisma.transaction.deleteMany({});
        for (const record of records) {
          await prisma.transaction.create({ data: record });
        }
      } else if (tableName === 'attendance') {
        await prisma.attendance.deleteMany({});
        for (const record of records) {
          await prisma.attendance.create({ data: record });
        }
      } else if (tableName === 'schedules') {
        await prisma.schedule.deleteMany({});
        for (const record of records) {
          await prisma.schedule.create({ data: record });
        }
      } else if (tableName === 'payrolls') {
        await prisma.payroll.deleteMany({});
        for (const record of records) {
          await prisma.payroll.create({ data: record });
        }
      } else if (tableName === 'shipments') {
        await prisma.shipment.deleteMany({});
        for (const record of records) {
          await prisma.shipment.create({ data: record });
        }
      } else if (tableName === 'prices') {
        await prisma.price.deleteMany({});
        for (const record of records) {
          await prisma.price.create({ data: record });
        }
      } else if (tableName === 'cash_advances') {
        await prisma.cashAdvanceRecord.deleteMany({});
        for (const record of records) {
          await prisma.cashAdvanceRecord.create({ data: record });
        }
      } else if (tableName === 'leave_requests') {
        await prisma.leaveRequest.deleteMany({});
        for (const record of records) {
          await prisma.leaveRequest.create({ data: record });
        }
      }

      console.log(`✅ Restored ${tableName}`);
    } catch (error) {
      console.error(`❌ Error restoring ${tableName}:`, error.message);
    }
  }

  console.log('🎉 Restore complete!');
}

const backupPath = process.argv[2] || 'backups/2025-11-08T15-54-14';

restoreFromBackup(backupPath)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
