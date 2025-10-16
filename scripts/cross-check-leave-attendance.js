#!/usr/bin/env node

/**
 * Cross-Check Leave Records with Attendance Logs
 *
 * This script validates that leave requests match with attendance records.
 * It checks if employees marked as "on-leave" in attendance have corresponding
 * approved leave requests, and vice versa.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const LEAVE_FILE = path.join(__dirname, '..', 'leave-records-transformed.csv');
const ATTENDANCE_FILE = path.join(
  __dirname,
  '..',
  'Transformed_Attendance_Records.csv'
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

function parseDate(dateStr) {
  // Parse YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }

  return new Date(
    parseInt(parts[0]),
    parseInt(parts[1]) - 1,
    parseInt(parts[2])
  );
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRange(startDate, endDate) {
  const dates = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) {
    return dates;
  }

  const current = new Date(start);
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// ============================================================================
// MAIN ANALYSIS LOGIC
// ============================================================================

function crossCheckLeaveAndAttendance() {
  console.log('🔍 Cross-Checking Leave Records with Attendance Logs...\n');

  // Read leave records
  let leaveData;
  try {
    leaveData = fs.readFileSync(LEAVE_FILE, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading leave file: ${error.message}`);
    process.exit(1);
  }

  // Read attendance records
  let attendanceData;
  try {
    attendanceData = fs.readFileSync(ATTENDANCE_FILE, 'utf-8');
  } catch (error) {
    console.error(`❌ Error reading attendance file: ${error.message}`);
    process.exit(1);
  }

  // Parse leave records
  const leaveLines = leaveData.split('\n').filter((line) => line.trim());
  const leaveHeaders = parseCSVLine(leaveLines[0]);
  const leaveRecords = [];

  for (let i = 1; i < leaveLines.length; i++) {
    const values = parseCSVLine(leaveLines[i]);
    const record = {};
    leaveHeaders.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    // Only include approved leave
    if (record.status === 'approved') {
      leaveRecords.push(record);
    }
  }

  console.log(`📋 Loaded ${leaveRecords.length} approved leave records`);

  // Parse attendance records
  const attendanceLines = attendanceData
    .split('\n')
    .filter((line) => line.trim());
  const attendanceHeaders = parseCSVLine(attendanceLines[0]);
  const attendanceRecords = [];

  for (let i = 1; i < attendanceLines.length; i++) {
    const values = parseCSVLine(attendanceLines[i]);
    const record = {};
    attendanceHeaders.forEach((header, index) => {
      record[header] = values[index] || '';
    });

    // Only include on-leave records
    if (record.status === 'on-leave') {
      attendanceRecords.push(record);
    }
  }

  console.log(
    `📋 Loaded ${attendanceRecords.length} on-leave attendance records\n`
  );

  // Build leave lookup by employee and date
  const leaveLookup = {};

  leaveRecords.forEach((leave) => {
    const employeeId = leave.employeeId;
    const dates = getDateRange(leave.startDate, leave.endDate);

    dates.forEach((date) => {
      const key = `${employeeId}:${date}`;
      if (!leaveLookup[key]) {
        leaveLookup[key] = [];
      }
      leaveLookup[key].push(leave);
    });
  });

  // Check: Do attendance on-leave records have corresponding leave requests?
  console.log('═══════════════════════════════════════════════════════════');
  console.log('CHECK 1: Attendance "on-leave" → Leave Request Match');
  console.log('═══════════════════════════════════════════════════════════\n');

  const attendanceMatches = [];
  const attendanceMismatches = [];

  attendanceRecords.forEach((att) => {
    const key = `${att.employeeId}:${att.date}`;
    const matchingLeave = leaveLookup[key];

    if (matchingLeave && matchingLeave.length > 0) {
      attendanceMatches.push({
        attendance: att,
        leave: matchingLeave[0],
      });
    } else {
      attendanceMismatches.push(att);
    }
  });

  console.log(
    `✅ Matched: ${attendanceMatches.length} attendance records have corresponding leave requests`
  );
  console.log(
    `❌ Mismatched: ${attendanceMismatches.length} attendance records have NO corresponding leave requests\n`
  );

  if (attendanceMismatches.length > 0) {
    console.log('⚠️  Attendance records with NO matching leave request:\n');
    attendanceMismatches.forEach((att, index) => {
      console.log(
        `   ${index + 1}. ${att.employeeName} (${att.employeeId}) on ${att.date}`
      );
      console.log(`      Notes: ${att.notes || 'No notes'}`);
    });
    console.log('');
  }

  // Check: Do leave requests have corresponding attendance records?
  console.log('═══════════════════════════════════════════════════════════');
  console.log('CHECK 2: Leave Request → Attendance "on-leave" Match');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Build attendance lookup
  const attendanceLookup = {};
  attendanceRecords.forEach((att) => {
    const key = `${att.employeeId}:${att.date}`;
    attendanceLookup[key] = att;
  });

  const leaveWithAttendance = [];
  const leaveWithoutAttendance = [];

  leaveRecords.forEach((leave) => {
    const dates = getDateRange(leave.startDate, leave.endDate);
    const missingDates = [];
    const foundDates = [];

    dates.forEach((date) => {
      const key = `${leave.employeeId}:${date}`;
      if (attendanceLookup[key]) {
        foundDates.push(date);
      } else {
        missingDates.push(date);
      }
    });

    if (missingDates.length === 0) {
      leaveWithAttendance.push(leave);
    } else {
      leaveWithoutAttendance.push({
        leave,
        missingDates,
        foundDates,
      });
    }
  });

  console.log(
    `✅ Complete: ${leaveWithAttendance.length} leave requests have full attendance coverage`
  );
  console.log(
    `⚠️  Incomplete: ${leaveWithoutAttendance.length} leave requests are missing attendance records\n`
  );

  if (leaveWithoutAttendance.length > 0) {
    console.log('⚠️  Leave requests with missing attendance records:\n');
    leaveWithoutAttendance.forEach((item, index) => {
      const leave = item.leave;
      console.log(
        `   ${index + 1}. ${leave.employeeName} (${leave.employeeId})`
      );
      console.log(
        `      Leave: ${leave.startDate} to ${leave.endDate} (${leave.leaveType})`
      );
      console.log(`      Missing: ${item.missingDates.length} days`);
      if (item.missingDates.length <= 5) {
        console.log(`      Dates: ${item.missingDates.join(', ')}`);
      } else {
        console.log(
          `      First 5 dates: ${item.missingDates.slice(0, 5).join(', ')}...`
        );
      }
      console.log('');
    });
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const totalLeaveDays = leaveRecords.reduce((sum, leave) => {
    return sum + getDateRange(leave.startDate, leave.endDate).length;
  }, 0);

  console.log(`📊 Statistics:`);
  console.log(`   • Total approved leave requests: ${leaveRecords.length}`);
  console.log(`   • Total expected leave days: ${totalLeaveDays}`);
  console.log(
    `   • Total on-leave attendance records: ${attendanceRecords.length}`
  );
  console.log(
    `   • Match rate: ${((attendanceMatches.length / attendanceRecords.length) * 100).toFixed(1)}%`
  );
  console.log('');

  if (
    attendanceMismatches.length === 0 &&
    leaveWithoutAttendance.length === 0
  ) {
    console.log(
      '✅ Perfect match! All leave requests and attendance records align correctly.'
    );
  } else {
    console.log(
      '⚠️  There are some discrepancies between leave requests and attendance records.'
    );
    console.log('   This might indicate:');
    console.log('   • Leave requests not yet imported into the system');
    console.log(
      '   • Attendance records marked as on-leave without formal leave requests'
    );
    console.log(
      '   • Data entry timing differences (legacy data from different systems)'
    );
  }

  console.log('\n🎉 Cross-check complete!\n');
}

// ============================================================================
// RUN SCRIPT
// ============================================================================

crossCheckLeaveAndAttendance();
