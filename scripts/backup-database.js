#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * DATABASE BACKUP SCRIPT
 *
 * Creates a complete backup of all database tables in multiple formats:
 * 1. PostgreSQL dump file (.sql) - Full restore capability
 * 2. JSON export - Human-readable format
 * 3. CSV exports - Individual table exports
 *
 * Usage:
 *   node scripts/backup-database.js
 *   node scripts/backup-database.js --format=sql
 *   node scripts/backup-database.js --format=json
 *   node scripts/backup-database.js --format=csv
 *   node scripts/backup-database.js --format=all
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

const execAsync = promisify(exec);

// Load environment variables
const envFile = process.env.BACKUP_ENV_FILE || '.env.local';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const formatArg = args.find((arg) => arg.startsWith('--format='));
const format = formatArg ? formatArg.split('=')[1] : 'all';

// Backup directory
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

// Tables to backup
const TABLES = [
  { name: 'transactions', model: 'transaction' },
  { name: 'customers', model: 'customer' },
  { name: 'products', model: 'product' },
  { name: 'prices', model: 'price' },
  { name: 'shipments', model: 'shipment' },
  { name: 'sorting_distributions', model: 'sortingDistribution' },
  { name: 'employees', model: 'employee' },
  { name: 'schedules', model: 'schedule' },
  { name: 'attendance', model: 'attendance' },
  { name: 'payrolls', model: 'payroll' },
  { name: 'leave_requests', model: 'leaveRequest' },
  { name: 'expenses', model: 'expense' },
  { name: 'cash_advances', model: 'cashAdvanceRecord' },
  { name: 'cash_advance_deductions', model: 'cashAdvanceDeduction' },
  { name: 'thirteenth_month_pay_records', model: 'thirteenthMonthPayRecord' },
  { name: 'installed_modules', model: 'installedModule' },
  { name: 'module_marketplace', model: 'moduleMarketplace' },
  { name: 'audit_logs', model: 'auditLog' },
];

/**
 * Create backup directory structure
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestampDir = path.join(BACKUP_DIR, timestamp);
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  return timestampDir;
}

/**
 * Extract database connection info from DATABASE_URL
 */
function parseDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found in environment variables');
  }

  // Parse: postgresql://user:password@host:port/database
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
 * Backup 1: PostgreSQL dump (Full backup with structure + data)
 */
async function backupSQL(backupDir) {
  console.log('\n📦 Creating PostgreSQL dump...');

  try {
    const { user, password, host, port, database } = parseDatabaseUrl();
    const sqlFile = path.join(backupDir, `backup-${timestamp}.sql`);

    // Use pg_dump to create a complete backup
    const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${sqlFile}"`;

    await execAsync(command);

    const stats = fs.statSync(sqlFile);
    console.log(`   ✅ SQL backup created: ${sqlFile}`);
    console.log(`   📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return sqlFile;
  } catch (error) {
    console.error('   ❌ SQL backup failed:', error.message);
    if (error.message.includes('pg_dump')) {
      console.log(
        '   💡 Make sure PostgreSQL client tools (pg_dump) are installed'
      );
      console.log(
        '   💡 Install with: sudo apt-get install postgresql-client (Linux)'
      );
      console.log('   💡 Or: brew install postgresql (Mac)');
    }
    throw error;
  }
}

/**
 * Backup 2: JSON export (Human-readable, all tables)
 */
async function backupJSON(backupDir) {
  console.log('\n📋 Creating JSON backup...');

  const backup = {
    metadata: {
      createdAt: new Date().toISOString(),
      environment: envFile,
      database: parseDatabaseUrl().database,
      format: 'json',
      version: '1.0',
    },
    tables: {},
  };

  for (const { name, model } of TABLES) {
    try {
      // Check if model has deletedAt field
      const sampleRecord = await prisma[model].findFirst();
      const hasDeletedAt = sampleRecord && 'deletedAt' in sampleRecord;

      const data = await prisma[model].findMany({
        where: hasDeletedAt ? { deletedAt: null } : {}, // Only filter if deletedAt exists
      });

      backup.tables[name] = {
        count: data.length,
        data: data,
      };

      console.log(`   ✅ ${name}: ${data.length} records`);
    } catch (error) {
      console.log(`   ⚠️  ${name}: ${error.message}`);
      backup.tables[name] = {
        count: 0,
        error: error.message,
      };
    }
  }

  const jsonFile = path.join(backupDir, `backup-${timestamp}.json`);
  fs.writeFileSync(jsonFile, JSON.stringify(backup, null, 2));

  const stats = fs.statSync(jsonFile);
  console.log(`\n   ✅ JSON backup created: ${jsonFile}`);
  console.log(`   📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  return jsonFile;
}

/**
 * Backup 3: CSV exports (Individual table files)
 */
async function backupCSV(backupDir) {
  console.log('\n📊 Creating CSV backups...');

  const csvDir = path.join(backupDir, 'csv');
  if (!fs.existsSync(csvDir)) {
    fs.mkdirSync(csvDir, { recursive: true });
  }

  const csvFiles = [];

  for (const { name, model } of TABLES) {
    try {
      const data = await prisma[model].findMany({
        where: { deletedAt: null }, // Exclude soft-deleted records
      });

      if (data.length === 0) {
        console.log(`   ⏭️  ${name}: No data to export`);
        continue;
      }

      // Get column headers from first record
      const headers = Object.keys(data[0]);

      // Create CSV content
      const csvContent = [
        headers.join(','), // Header row
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              // Handle special characters and quotes
              if (value === null || value === undefined) {
                return '';
              }
              const stringValue = String(value);
              if (
                stringValue.includes(',') ||
                stringValue.includes('"') ||
                stringValue.includes('\n')
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(',')
        ),
      ].join('\n');

      const csvFile = path.join(csvDir, `${name}.csv`);
      fs.writeFileSync(csvFile, csvContent);
      csvFiles.push(csvFile);

      console.log(`   ✅ ${name}.csv: ${data.length} records`);
    } catch (error) {
      console.log(`   ⚠️  ${name}: ${error.message}`);
    }
  }

  console.log(`\n   ✅ CSV backups created in: ${csvDir}`);
  return csvFiles;
}

/**
 * Create backup manifest with metadata
 */
function createManifest(backupDir, files) {
  const manifest = {
    timestamp: new Date().toISOString(),
    environment: envFile,
    database: parseDatabaseUrl().database,
    format: format,
    files: files.map((file) => ({
      name: path.basename(file),
      size: fs.statSync(file).size,
      path: path.relative(BACKUP_DIR, file),
    })),
  };

  const manifestFile = path.join(backupDir, 'MANIFEST.json');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

  return manifestFile;
}

/**
 * Main backup function
 */
async function createBackup() {
  console.log('🔐 DATABASE BACKUP STARTED');
  console.log('===========================');
  console.log(`📅 Timestamp: ${timestamp}`);
  console.log(`🗄️  Database: ${parseDatabaseUrl().database}`);
  console.log(`📝 Format: ${format}`);
  console.log('');

  try {
    const backupDir = ensureBackupDir();
    const files = [];

    // Create backups based on format
    if (format === 'sql' || format === 'all') {
      try {
        const sqlFile = await backupSQL(backupDir);
        files.push(sqlFile);
      } catch (error) {
        console.log('   ⚠️  SQL backup skipped (pg_dump not available)');
      }
    }

    if (format === 'json' || format === 'all') {
      const jsonFile = await backupJSON(backupDir);
      files.push(jsonFile);
    }

    if (format === 'csv' || format === 'all') {
      const csvFiles = await backupCSV(backupDir);
      files.push(...csvFiles);
    }

    // Create manifest
    const manifestFile = createManifest(backupDir, files);

    console.log('\n✅ BACKUP COMPLETED SUCCESSFULLY');
    console.log('=================================');
    console.log(`📁 Backup location: ${backupDir}`);
    console.log(`📋 Manifest: ${manifestFile}`);
    console.log(`📦 Total files: ${files.length}`);

    // Calculate total size
    const totalSize = files.reduce((sum, file) => {
      return sum + fs.statSync(file).size;
    }, 0);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    console.log(
      '\n💡 TIP: Keep backups in a safe location outside your project folder!'
    );
    console.log(
      '💡 Consider uploading to cloud storage (Google Drive, Dropbox, etc.)'
    );
  } catch (error) {
    console.error('\n❌ BACKUP FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run backup
createBackup()
  .then(() => {
    console.log('\n✅ Backup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Backup script failed:', error);
    process.exit(1);
  });
