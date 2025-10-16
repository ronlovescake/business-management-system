const fs = require('fs');
const path = require('path');

/**
 * CSV Transformation Script for Old Attendance Records
 *
 * This script transforms your old attendance CSV format to match
 * your new attendance system structure.
 *
 * Usage:
 * node scripts/transform-attendance-csv.js
 */

// Employee lookup table (fill in missing employee details)
const employeeDetails = {
  'EMP-0003': {
    name: 'Arnel Ephraim Subia Aliangan',
    department: 'Operations',
    position: 'Warehouse POC',
  },
  'EMP-0004': {
    name: 'Rain Joel Subia Orong',
    department: 'Operations',
    position: 'Stay-in Employee',
  },
  'EMP-0005': {
    name: 'Joan Lacaulan Tapic',
    department: 'Operations',
    position: 'Warehouse Staff',
  },
  // Add more employees as needed
};

// Default department and position for unknown employees
const DEFAULT_DEPARTMENT = 'Operations';
const DEFAULT_POSITION = 'Staff';

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

function escapeCsvValue(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function transformRecord(oldRecord, index) {
  const {
    employee_id,
    employee,
    date,
    check_in,
    check_out,
    hours_worked,
    status,
    break_1_start,
    break_1_end,
    lunch_start,
    lunch_end,
    break_2_start,
    break_2_end,
    notes,
  } = oldRecord;

  // Skip records with missing critical data
  if (!date || (!employee_id && !employee)) {
    console.warn(
      `⚠️  Skipping record ${index + 1}: Missing employee_id or date`
    );
    return null;
  }

  // Get employee details
  const empId = employee_id || 'EMP-UNKNOWN';
  const empDetails = employeeDetails[empId] || {
    name: employee || 'Unknown Employee',
    department: DEFAULT_DEPARTMENT,
    position: DEFAULT_POSITION,
  };

  // Format time to HH:MM (24-hour format)
  const formatTime = (time) => {
    if (!time || time === '') {
      return '';
    }
    // Remove any extra characters and ensure HH:MM format
    const cleaned = time.trim().split(' ')[0]; // Remove timezone or extra info
    if (cleaned.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      const parts = cleaned.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1];
      return `${hours}:${minutes}`;
    }
    return '';
  };

  // Calculate total hours
  const calculateHours = (timeIn, timeOut, hoursWorked) => {
    if (hoursWorked && hoursWorked !== '0.00') {
      return parseFloat(hoursWorked);
    }
    if (timeIn && timeOut) {
      const [inHour, inMin] = timeIn.split(':').map(Number);
      const [outHour, outMin] = timeOut.split(':').map(Number);
      const totalMinutes = outHour * 60 + outMin - (inHour * 60 + inMin);
      return parseFloat((totalMinutes / 60).toFixed(2));
    }
    return 0;
  };

  const timeIn = formatTime(check_in);
  const timeOut = formatTime(check_out);
  const totalHours = calculateHours(timeIn, timeOut, hours_worked);

  // Map status
  const statusMap = {
    present: 'present',
    late: 'late',
    absent: 'absent',
    on_leave: 'on-leave',
  };
  const mappedStatus = statusMap[status] || status;

  return {
    id: generateId(),
    employeeId: empId,
    employeeName: empDetails.name,
    department: empDetails.department,
    position: empDetails.position,
    date: date,
    timeIn: timeIn,
    timeOut: timeOut,
    break1Start: formatTime(break_1_start),
    break1End: formatTime(break_1_end),
    lunchStart: formatTime(lunch_start),
    lunchEnd: formatTime(lunch_end),
    break2Start: formatTime(break_2_start),
    break2End: formatTime(break_2_end),
    totalHours: totalHours,
    status: mappedStatus,
    details: '',
    notes: notes || '',
  };
}

function transformCsv() {
  console.log('🚀 Starting CSV transformation...\n');

  const inputPath = path.join(__dirname, '..', 'Old Attendance Records.csv');
  const outputPath = path.join(
    __dirname,
    '..',
    'Transformed_Attendance_Records.csv'
  );

  // Read the old CSV
  let csvContent;
  try {
    csvContent = fs.readFileSync(inputPath, 'utf-8');
    console.log('✅ Successfully read old CSV file');
  } catch (error) {
    console.error('❌ Error reading CSV file:', error.message);
    process.exit(1);
  }

  // Parse CSV
  const lines = csvContent.split('\n').filter((line) => line.trim());
  const headers = parseCsvLine(lines[0]);

  console.log(`📊 Found ${lines.length - 1} records to process\n`);

  // Transform records
  const transformedRecords = [];
  let skippedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const record = {};

    headers.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    const transformed = transformRecord(record, i - 1);
    if (transformed) {
      transformedRecords.push(transformed);
    } else {
      skippedCount++;
    }
  }

  console.log(
    `✅ Successfully transformed ${transformedRecords.length} records`
  );
  if (skippedCount > 0) {
    console.log(`⚠️  Skipped ${skippedCount} records due to missing data\n`);
  }

  // Write new CSV
  const newHeaders = [
    'id',
    'employeeId',
    'employeeName',
    'department',
    'position',
    'date',
    'timeIn',
    'timeOut',
    'break1Start',
    'break1End',
    'lunchStart',
    'lunchEnd',
    'break2Start',
    'break2End',
    'totalHours',
    'status',
    'details',
    'notes',
  ];

  const csvLines = [newHeaders.join(',')];

  transformedRecords.forEach((record) => {
    const row = newHeaders.map((header) => escapeCsvValue(record[header]));
    csvLines.push(row.join(','));
  });

  try {
    fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');
    console.log(`✅ Successfully wrote transformed CSV to: ${outputPath}\n`);
  } catch (error) {
    console.error('❌ Error writing CSV file:', error.message);
    process.exit(1);
  }

  // Print summary
  console.log('📈 Transformation Summary:');
  console.log(`   Total records processed: ${transformedRecords.length}`);
  console.log(
    `   Records with breaks: ${transformedRecords.filter((r) => r.break1Start).length}`
  );
  console.log(
    `   Present status: ${transformedRecords.filter((r) => r.status === 'present').length}`
  );
  console.log(
    `   On-leave status: ${transformedRecords.filter((r) => r.status === 'on-leave').length}`
  );
  console.log(
    `   Absent status: ${transformedRecords.filter((r) => r.status === 'absent').length}`
  );
  console.log('\n✨ Transformation complete!');
  console.log(`\n📁 Import the file: Transformed_Attendance_Records.csv`);
  console.log(`   into your attendance page using the "Import CSV" button.\n`);
}

// Run the transformation
transformCsv();
