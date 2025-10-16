#!/usr/bin/env node

/**
 * Transform Old Leave Records CSV to New Format
 *
 * This script transforms the old leave records CSV format to the new format
 * expected by the leave tracker import functionality.
 *
 * Usage: node scripts/transform-leave-csv.js
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const INPUT_FILE = path.join(__dirname, '..', 'old leave record.csv');
const OUTPUT_FILE = path.join(__dirname, '..', 'leave-records-transformed.csv');

// Leave type mapping from old system to new system
const LEAVE_TYPE_MAP = {
  sil: 'Sick Leave',
  vl: 'Vacation Leave',
  vacation: 'Vacation Leave',
  sick: 'Sick Leave',
  emergency: 'Emergency Leave',
  lwop: 'Other', // Leave Without Pay -> Other
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  bereavement: 'Bereavement Leave',
};

// Status mapping (old system uses 'approved', 'pending', 'rejected')
const STATUS_MAP = {
  approved: 'approved',
  pending: 'pending',
  rejected: 'rejected',
  cancelled: 'rejected', // Map cancelled to rejected
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse CSV line handling quoted fields
 */
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

/**
 * Map old leave type codes to new leave type names
 */
function mapLeaveType(oldType) {
  if (!oldType) {
    return 'Other';
  }

  const normalized = oldType.toLowerCase().trim();
  return LEAVE_TYPE_MAP[normalized] || 'Other';
}

/**
 * Map old status to new status
 */
function mapStatus(oldStatus) {
  if (!oldStatus) {
    return 'pending';
  }

  const normalized = oldStatus.toLowerCase().trim();
  return STATUS_MAP[normalized] || 'pending';
}

/**
 * Format date from YYYY-MM-DD format (keep as is)
 */
function formatDate(dateString) {
  if (!dateString) {
    return '';
  }

  // If already in YYYY-MM-DD format, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString.trim())) {
    return dateString.trim();
  }

  // Try to parse and format
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString.trim();
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  } catch (error) {
    return dateString.trim();
  }
}

/**
 * Extract applied date from created_at timestamp
 */
function extractAppliedDate(createdAt) {
  if (!createdAt) {
    // Default to today's date if not available
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  // Extract date portion from timestamp like "2025-09-04 23:24:25.349977"
  const datePart = createdAt.split(' ')[0];
  return formatDate(datePart);
}

/**
 * Escape CSV field (wrap in quotes if contains comma, quote, or newline)
 */
function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }

  const stringField = String(field);

  if (
    stringField.includes(',') ||
    stringField.includes('"') ||
    stringField.includes('\n')
  ) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }

  return stringField;
}

// ============================================================================
// MAIN TRANSFORMATION LOGIC
// ============================================================================

function transformLeaveCSV() {
  console.log('🔄 Starting leave records CSV transformation...\n');

  // Read input file
  let inputData;
  try {
    inputData = fs.readFileSync(INPUT_FILE, 'utf-8');
    console.log(`✅ Read input file: ${INPUT_FILE}`);
  } catch (error) {
    console.error(`❌ Error reading input file: ${error.message}`);
    process.exit(1);
  }

  // Parse CSV
  const lines = inputData.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    console.error('❌ CSV file is empty or has no data rows');
    process.exit(1);
  }

  const headers = parseCSVLine(lines[0]);
  console.log(`📋 Found ${lines.length - 1} records to transform\n`);
  console.log('Old CSV Columns:', headers.join(', '));

  // Create column index map
  const columnIndex = {};
  headers.forEach((header, index) => {
    columnIndex[header.toLowerCase().trim()] = index;
  });

  // New CSV headers
  const newHeaders = [
    'employeeId',
    'employeeName',
    'leaveType',
    'startDate',
    'endDate',
    'reason',
    'status',
    'appliedDate',
    'approvedBy',
    'notes',
  ];

  // Transform data
  const transformedRows = [newHeaders];
  let successCount = 0;
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Create row object
    const row = {};
    headers.forEach((header, index) => {
      row[header.toLowerCase().trim()] = values[index] || '';
    });

    // Skip rows with missing critical data
    if (!row.employee_id || !row.employee || !row.start_date || !row.end_date) {
      console.log(`⚠️  Row ${i}: Skipped - Missing critical data`);
      skippedCount++;
      continue;
    }

    try {
      // Build notes from additional fields
      const notesParts = [];

      if (row.is_paid === 't' || row.is_paid === 'true') {
        notesParts.push('Paid leave');
      } else if (row.is_paid === 'f' || row.is_paid === 'false') {
        notesParts.push('Unpaid leave');
      }

      if (row.cost_center && row.cost_center !== '') {
        notesParts.push(`Cost center: ${row.cost_center}`);
      }

      if (row.allocation_year && row.allocation_year !== '') {
        notesParts.push(`Year: ${row.allocation_year}`);
      }

      if (row.department && row.department !== '') {
        notesParts.push(`Dept: ${row.department}`);
      }

      if (row.position && row.position !== '') {
        notesParts.push(`Position: ${row.position}`);
      }

      // Transform row
      const transformedRow = [
        escapeCSVField(row.employee_id),
        escapeCSVField(row.employee),
        escapeCSVField(mapLeaveType(row.leave_type)),
        escapeCSVField(formatDate(row.start_date)),
        escapeCSVField(formatDate(row.end_date)),
        escapeCSVField(row.reason || 'Leave request'),
        escapeCSVField(mapStatus(row.status)),
        escapeCSVField(extractAppliedDate(row.created_at)),
        escapeCSVField(row.approved_by || ''),
        escapeCSVField(notesParts.join(' | ')),
      ];

      transformedRows.push(transformedRow);
      successCount++;

      // Log first few transformations as examples
      if (i <= 3) {
        console.log(`\n✨ Row ${i} transformed:`);
        console.log(`   Employee: ${row.employee} (${row.employee_id})`);
        console.log(
          `   Leave Type: ${row.leave_type} → ${mapLeaveType(row.leave_type)}`
        );
        console.log(
          `   Dates: ${formatDate(row.start_date)} to ${formatDate(row.end_date)} (${row.days_requested} days)`
        );
        console.log(`   Status: ${mapStatus(row.status)}`);
        console.log(`   Reason: ${row.reason}`);
      }
    } catch (error) {
      console.error(`❌ Row ${i}: Error - ${error.message}`);
      skippedCount++;
    }
  }

  // Write output file
  const outputCSV = transformedRows.map((row) => row.join(',')).join('\n');

  try {
    fs.writeFileSync(OUTPUT_FILE, outputCSV, 'utf-8');
    console.log(`\n✅ Transformation complete!`);
    console.log(`   📊 Successfully transformed: ${successCount} records`);
    console.log(`   ⚠️  Skipped: ${skippedCount} records`);
    console.log(`   📁 Output file: ${OUTPUT_FILE}`);
    console.log(
      `\n🎉 You can now import "${path.basename(OUTPUT_FILE)}" into the leave tracker!\n`
    );
  } catch (error) {
    console.error(`❌ Error writing output file: ${error.message}`);
    process.exit(1);
  }
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

transformLeaveCSV();
