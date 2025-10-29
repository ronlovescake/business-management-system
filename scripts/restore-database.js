#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * DATABASE RESTORE SCRIPT
 *
 * Restores database from backup files created by backup-database.js
 *
 * ⚠️ WARNING: This will overwrite existing data!
 *
 * Usage:
 *   node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.sql
 *   node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.json
 *   node scripts/restore-database.js backups/2025-10-24T12-30-00/csv
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const readline = require('readline');

const execAsync = promisify(exec);

// Load environment variables
const envFile = process.env.RESTORE_ENV_FILE || '.env.local';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

/**
 * Extract database connection info from DATABASE_URL
 */
function parseDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment variables');
  }

  const match = dbUrl.match(
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
  );
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = match;
  return { user, password, host, port, database };
}

/**
 * Prompt user for confirmation
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Restore from SQL dump
 */
async function restoreFromSQL(filePath) {
  console.log('\n📦 Restoring from PostgreSQL dump...');

  try {
    const { user, password, host, port, database } = parseDatabaseUrl();

    // Use psql to restore
    const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -f "${filePath}"`;

    console.log('   ⏳ This may take a while...');
    await execAsync(command);

    console.log('   ✅ SQL restore completed');
  } catch (error) {
    console.error('   ❌ SQL restore failed:', error.message);
    throw error;
  }
}

/**
 * Restore from JSON backup
 */
async function restoreFromJSON(filePath) {
  console.log('\n📋 Restoring from JSON backup...');

  try {
    const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!backupData.tables) {
      throw new Error('Invalid backup file format');
    }

    console.log(`   📅 Backup created: ${backupData.metadata.createdAt}`);
    console.log(`   🗄️  Database: ${backupData.metadata.database}`);
    console.log('');

    const tableNames = Object.keys(backupData.tables);

    for (const tableName of tableNames) {
      const tableData = backupData.tables[tableName];

      if (!tableData.data || tableData.data.length === 0) {
        console.log(`   ⏭️  ${tableName}: No data to restore`);
        continue;
      }

      // Map table names to Prisma models
      const modelMap = {
        transactions: 'transaction',
        customers: 'customer',
        products: 'product',
        prices: 'price',
  shipments: 'shipment',
        employees: 'employee',
        schedules: 'schedule',
        attendance: 'attendance',
        payrolls: 'payroll',
        leave_requests: 'leaveRequest',
        expenses: 'expense',
        cash_advances: 'cashAdvanceRecord',
        cash_advance_deductions: 'cashAdvanceDeduction',
        thirteenth_month_pay_records: 'thirteenthMonthPayRecord',
      };

      const modelName = modelMap[tableName];
      if (!modelName) {
        console.log(`   ⚠️  ${tableName}: Unknown table, skipping`);
        continue;
      }

      try {
        // Create records
        const result = await prisma[modelName].createMany({
          data: tableData.data,
          skipDuplicates: true,
        });

        console.log(`   ✅ ${tableName}: Restored ${result.count} records`);
      } catch (error) {
        console.log(`   ⚠️  ${tableName}: ${error.message}`);
      }
    }

    console.log('\n   ✅ JSON restore completed');
  } catch (error) {
    console.error('   ❌ JSON restore failed:', error.message);
    throw error;
  }
}

/**
 * Main restore function
 */
async function restoreDatabase() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('❌ ERROR: No backup file specified');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/restore-database.js <backup-file>');
    console.log('');
    console.log('Examples:');
    console.log(
      '  node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.sql'
    );
    console.log(
      '  node scripts/restore-database.js backups/2025-10-24T12-30-00/backup-2025-10-24T12-30-00.json'
    );
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), args[0]);

  if (!fs.existsSync(filePath)) {
    console.log(`❌ ERROR: File not found: ${filePath}`);
    process.exit(1);
  }

  console.log('🔄 DATABASE RESTORE');
  console.log('===================');
  console.log(`📁 Backup file: ${filePath}`);
  console.log(`🗄️  Database: ${parseDatabaseUrl().database}`);
  console.log('');
  console.log('⚠️  WARNING: This will overwrite existing data!');
  console.log('');

  const confirmed = await askConfirmation(
    'Are you sure you want to continue? (yes/no): '
  );

  if (!confirmed) {
    console.log('❌ Restore cancelled by user');
    process.exit(0);
  }

  try {
    const ext = path.extname(filePath);

    if (ext === '.sql') {
      await restoreFromSQL(filePath);
    } else if (ext === '.json') {
      await restoreFromJSON(filePath);
    } else {
      throw new Error(`Unsupported file format: ${ext}`);
    }

    console.log('\n✅ RESTORE COMPLETED SUCCESSFULLY');
    console.log('==================================');
    console.log(
      '💡 Verify your data to ensure everything was restored correctly'
    );
  } catch (error) {
    console.error('\n❌ RESTORE FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run restore
restoreDatabase();
