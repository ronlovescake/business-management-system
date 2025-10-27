/* eslint-disable no-console */
/**
 * Generate Attendance Records from Actual Schedules
 * Date Range: January 1, 2025 to October 21, 2025
 *
 * Logic:
 * - Only generate attendance for days with actual schedules
 * - Check for approved leave requests and mark as "on-leave"
 * - Use schedule times for time-in and time-out
 * - Calculate total hours based on schedule
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Calculate total hours between two times (HH:mm format)
function calculateTotalHours(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight shifts (e.g., 23:00 to 07:00)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours
  }

  const totalMinutes = endMinutes - startMinutes;

  // Subtract break times (15 min morning break, 60 min lunch, 15 min afternoon break = 90 min total)
  const workMinutes = totalMinutes - 90;

  return Math.max(0, workMinutes / 60); // Return hours, minimum 0
}

// Check if employee is on leave for a specific date
function isOnLeave(employeeId, date, leaveRequests) {
  return leaveRequests.some((request) => {
    const requestId = String(request.employeeId || '')
      .trim()
      .toLowerCase();
    const scheduleId = String(employeeId || '')
      .trim()
      .toLowerCase();

    if (requestId !== scheduleId) {
      return false;
    }

    if (request.status !== 'approved') {
      return false;
    }

    return date >= request.startDate && date <= request.endDate;
  });
}

// Get leave info for a specific employee and date
function getLeaveInfo(employeeId, date, leaveRequests) {
  return leaveRequests.find((request) => {
    const requestId = String(request.employeeId || '')
      .trim()
      .toLowerCase();
    const scheduleId = String(employeeId || '')
      .trim()
      .toLowerCase();
    return (
      requestId === scheduleId &&
      request.status === 'approved' &&
      date >= request.startDate &&
      date <= request.endDate
    );
  });
}

async function generateAttendance() {
  try {
    console.log('🚀 Starting attendance generation from schedules...\n');

    // Fetch all schedules from Jan 1 to Oct 21, 2025
    console.log(
      '📅 Fetching schedules from January 1, 2025 to October 21, 2025...'
    );
    const schedules = await prisma.schedule.findMany({
      where: {
        date: {
          gte: '2025-01-01',
          lte: '2025-10-21',
        },
        deletedAt: null,
        status: {
          not: 'cancelled', // Don't generate attendance for cancelled schedules
        },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    console.log(`   Found ${schedules.length} schedules\n`);

    // Fetch all approved leave requests
    console.log('🏖️  Fetching approved leave requests...');
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        status: 'approved',
        startDate: {
          lte: '2025-10-21',
        },
        endDate: {
          gte: '2025-01-01',
        },
      },
    });

    console.log(`   Found ${leaveRequests.length} approved leave requests\n`);

    // Check if there's existing attendance data
    console.log('🔍 Checking for existing attendance records...');
    const existingAttendance = await prisma.attendance.findMany({
      where: {
        date: {
          gte: '2025-01-01',
          lte: '2025-10-21',
        },
        deletedAt: null,
      },
    });

    if (existingAttendance.length > 0) {
      console.log(
        `   ⚠️  Found ${existingAttendance.length} existing attendance records`
      );
      console.log(
        '   ⚠️  Please clear existing records first or modify the script to handle updates\n'
      );

      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const answer = await new Promise((resolve) => {
        readline.question(
          '   Do you want to DELETE all existing attendance and regenerate? (yes/no): ',
          resolve
        );
      });

      readline.close();

      if (answer.toLowerCase() === 'yes') {
        console.log('\n   🗑️  Deleting existing attendance records...');
        const deleted = await prisma.attendance.deleteMany({
          where: {
            date: {
              gte: '2025-01-01',
              lte: '2025-10-21',
            },
          },
        });
        console.log(`   ✅ Deleted ${deleted.count} records\n`);
      } else {
        console.log('\n   ❌ Operation cancelled by user');
        return;
      }
    }

    // Generate attendance records from schedules
    console.log('⚙️  Generating attendance records from schedules...');
    const attendanceRecords = [];

    for (const schedule of schedules) {
      const onLeave = isOnLeave(
        schedule.employeeId,
        schedule.date,
        leaveRequests
      );
      const leaveInfo = getLeaveInfo(
        schedule.employeeId,
        schedule.date,
        leaveRequests
      );

      // Determine status
      let status = 'present';
      if (onLeave) {
        status = 'on-leave';
      } else if (schedule.status === 'on-leave') {
        status = 'on-leave';
      }

      // Calculate total hours
      const totalHours = calculateTotalHours(
        schedule.startTime,
        schedule.endTime
      );

      const attendanceRecord = {
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        department: schedule.department,
        position: schedule.position,
        date: schedule.date,
        timeIn: schedule.startTime,
        timeOut: schedule.endTime,
        break1Start: '09:00',
        break1End: '09:15',
        lunchStart: '12:00',
        lunchEnd: '13:00',
        break2Start: '15:00',
        break2End: '15:15',
        totalHours: totalHours,
        status: status,
        details: leaveInfo ? `On ${leaveInfo.leaveType}` : null,
        notes: leaveInfo
          ? `Leave period: ${leaveInfo.startDate} to ${leaveInfo.endDate}. Reason: ${leaveInfo.reason}`
          : schedule.notes || null,
      };

      attendanceRecords.push(attendanceRecord);
    }

    console.log(
      `   Generated ${attendanceRecords.length} attendance records\n`
    );

    // Statistics
    const presentCount = attendanceRecords.filter(
      (r) => r.status === 'present'
    ).length;
    const onLeaveCount = attendanceRecords.filter(
      (r) => r.status === 'on-leave'
    ).length;

    console.log('📊 Statistics:');
    console.log(`   - Total Records: ${attendanceRecords.length}`);
    console.log(`   - Present: ${presentCount}`);
    console.log(`   - On Leave: ${onLeaveCount}\n`);

    // Breakdown by employee
    console.log('👥 Breakdown by Employee:');
    const employeeStats = {};
    for (const record of attendanceRecords) {
      if (!employeeStats[record.employeeId]) {
        employeeStats[record.employeeId] = {
          name: record.employeeName,
          total: 0,
          present: 0,
          onLeave: 0,
        };
      }
      employeeStats[record.employeeId].total++;
      if (record.status === 'present') {
        employeeStats[record.employeeId].present++;
      } else if (record.status === 'on-leave') {
        employeeStats[record.employeeId].onLeave++;
      }
    }

    for (const [empId, stats] of Object.entries(employeeStats)) {
      console.log(`   ${empId} (${stats.name}):`);
      console.log(
        `      Total: ${stats.total} | Present: ${stats.present} | On Leave: ${stats.onLeave}`
      );
    }

    // Insert into database
    if (attendanceRecords.length > 0) {
      console.log('\n💾 Inserting attendance records into database...');

      // Batch insert in chunks of 500 to avoid overwhelming the database
      const BATCH_SIZE = 500;
      let inserted = 0;

      for (let i = 0; i < attendanceRecords.length; i += BATCH_SIZE) {
        const batch = attendanceRecords.slice(i, i + BATCH_SIZE);
        const result = await prisma.attendance.createMany({
          data: batch,
          skipDuplicates: false,
        });
        inserted += result.count;
        console.log(
          `   Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.count} records`
        );
      }

      console.log(`\n✅ Successfully inserted ${inserted} attendance records!`);
    } else {
      console.log('\n⚠️  No attendance records to insert');
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateAttendance()
  .then(() => {
    console.log('\n🎉 Attendance generation complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
