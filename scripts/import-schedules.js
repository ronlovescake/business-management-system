#!/usr/bin/env node

/**
 * Import Schedules from CSV to Database
 *
 * Usage: node scripts/import-schedules.js <path-to-csv>
 * Example: node scripts/import-schedules.js analysis/stay_in_schedules_2025.csv
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeStatus(status) {
  const normalized = status.toLowerCase().trim();

  if (normalized.includes('leave')) {
    return 'cancelled';
  }

  if (['scheduled', 'completed', 'cancelled'].includes(normalized)) {
    return normalized;
  }

  return 'scheduled';
}

function normalizeShiftType(shiftType) {
  const normalized = shiftType.toLowerCase().trim();

  if (['morning', 'afternoon', 'night', 'full-day'].includes(normalized)) {
    return normalized;
  }

  return 'full-day';
}

async function importSchedules(csvPath) {
  try {
    console.log('📁 Reading CSV file:', csvPath);

    const fullPath = path.resolve(process.cwd(), csvPath);
    if (!fs.existsSync(fullPath)) {
      console.error('❌ File not found:', fullPath);
      process.exit(1);
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      console.error('❌ CSV file is empty or invalid');
      process.exit(1);
    }

    console.log('📊 Total lines:', lines.length);

    const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
    console.log('📋 Headers:', headers);

    const schedules = [];
    let skipped = 0;
    let errors = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const row = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Skip empty rows
        if (!row.employeeid && !row.employeename && !row.date) {
          skipped++;
          continue;
        }

        // Validate required fields
        if (
          !row.employeeid ||
          !row.employeename ||
          !row.date ||
          !row.starttime ||
          !row.endtime
        ) {
          console.warn(`⚠️  Row ${i + 1}: Missing required fields, skipping`);
          skipped++;
          continue;
        }

        const schedule = {
          employeeId: row.employeeid,
          employeeName: row.employeename,
          date: row.date,
          shiftType: normalizeShiftType(row.shifttype),
          startTime: row.starttime,
          endTime: row.endtime,
          position: row.position || '',
          department: row.department || 'Operations',
          status: normalizeStatus(row.status),
          notes: row.notes || null,
          source: 'manual',
          isOverride: false,
        };

        schedules.push(schedule);
      } catch (error) {
        console.error(`❌ Row ${i + 1}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`   Valid records: ${schedules.length}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Errors: ${errors}`);

    if (schedules.length === 0) {
      console.log('\n⚠️  No valid schedules to import');
      return;
    }

    console.log('\n💾 Saving to database...');

    // Clear existing schedules
    console.log('🗑️  Clearing existing schedules...');
    await prisma.schedule.deleteMany({});

    // Import in batches
    const batchSize = 100;
    let imported = 0;

    for (let i = 0; i < schedules.length; i += batchSize) {
      const batch = schedules.slice(i, i + batchSize);

      await prisma.schedule.createMany({
        data: batch,
        skipDuplicates: true,
      });

      imported += batch.length;
      console.log(`   Imported ${imported}/${schedules.length}...`);
    }

    console.log('\n✅ Import completed successfully!');
    console.log(`   Total schedules in database: ${imported}`);

    // Show some stats
    const stats = await prisma.schedule.groupBy({
      by: ['status'],
      _count: true,
    });

    console.log('\n📊 Database Statistics:');
    stats.forEach((stat) => {
      console.log(`   ${stat.status}: ${stat._count}`);
    });
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get CSV path from command line arguments
const csvPath = process.argv[2];

if (!csvPath) {
  console.error('❌ Please provide a CSV file path');
  console.error('Usage: node scripts/import-schedules.js <path-to-csv>');
  console.error(
    'Example: node scripts/import-schedules.js analysis/stay_in_schedules_2025.csv'
  );
  process.exit(1);
}

importSchedules(csvPath);
