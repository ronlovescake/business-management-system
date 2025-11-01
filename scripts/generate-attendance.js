#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const EMPLOYEES = ['EMP-0004', 'EMP-0005', 'EMP-0006'];
const START_DATE = '2025-01-01';
const END_DATE = '2025-11-01';

const HIRE_DATES = {
  'EMP-0004': '2025-01-01',
  'EMP-0005': '2025-01-01',
  'EMP-0006': '2025-04-08',
};

const EMPLOYEE_INFO = {
  'EMP-0004': {
    name: 'Arnel Ephraim',
    department: 'Operations',
    position: 'Staff',
  },
  'EMP-0005': {
    name: 'Rain Joel',
    department: 'Operations',
    position: 'Staff',
  },
  'EMP-0006': { name: 'Joan', department: 'Operations', position: 'Staff' },
};

async function main() {
  console.log('🔍 Fetching schedules and leaves...');

  // Get all schedules
  const schedules = await prisma.schedule.findMany({
    where: {
      employeeId: { in: EMPLOYEES },
      date: { gte: START_DATE, lte: END_DATE },
    },
    orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
  });

  // Get approved leaves
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      employeeId: { in: EMPLOYEES },
      status: 'approved',
    },
  });

  console.log(`📅 Found ${schedules.length} schedule records`);
  console.log(`🏖️  Found ${leaves.length} approved leaves`);

  // Create a map of leave dates
  const leaveDates = new Map();
  leaves.forEach((leave) => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateKey = `${leave.employeeId}-${d.toISOString().split('T')[0]}`;
      leaveDates.set(dateKey, true);
    }
  });

  console.log('📝 Generating attendance records...');

  const attendanceRecords = [];
  const processedDates = new Set();

  for (const schedule of schedules) {
    const empId = schedule.employeeId;
    const scheduleDate = schedule.date;
    const hireDate = HIRE_DATES[empId];

    // Skip if before hire date
    if (scheduleDate < hireDate) {
      continue;
    }

    const dateKey = `${empId}-${schedule.date}`;

    // Skip duplicates
    if (processedDates.has(dateKey)) {
      continue;
    }
    processedDates.add(dateKey);

    // Check if on leave
    const isOnLeave = leaveDates.has(dateKey);

    // Only create attendance for scheduled days
    if (schedule.status === 'scheduled') {
      const empInfo = EMPLOYEE_INFO[empId];

      // Use actual schedule times, or -- for leave days
      const timeIn = isOnLeave ? '--' : schedule.startTime || '4:00';
      const timeOut = isOnLeave ? '--' : schedule.endTime || '17:00';

      // Calculate total hours
      let totalHours = 0;
      if (!isOnLeave && schedule.startTime && schedule.endTime) {
        const startHour = parseFloat(schedule.startTime.replace(':', '.'));
        const endHour = parseFloat(schedule.endTime.replace(':', '.'));
        totalHours = endHour - startHour;
      }

      attendanceRecords.push({
        employeeId: empId,
        employeeName: empInfo.name,
        department: empInfo.department,
        position: empInfo.position,
        date: schedule.date,
        timeIn: timeIn,
        timeOut: timeOut,
        totalHours: totalHours,
        status: isOnLeave ? 'on-leave' : 'present',
        details: isOnLeave ? 'Approved leave' : null,
      });
    }
  }

  console.log(`✨ Generated ${attendanceRecords.length} attendance records`);
  console.log('💾 Inserting into database...');

  // Delete existing attendance for these employees
  await prisma.attendance.deleteMany({
    where: {
      employeeId: { in: EMPLOYEES },
      date: { gte: START_DATE, lte: END_DATE },
    },
  });

  // Insert in batches
  const BATCH_SIZE = 500;
  for (let i = 0; i < attendanceRecords.length; i += BATCH_SIZE) {
    const batch = attendanceRecords.slice(i, i + BATCH_SIZE);
    await prisma.attendance.createMany({
      data: batch,
      skipDuplicates: true,
    });
    console.log(
      `  ✓ Inserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(attendanceRecords.length / BATCH_SIZE)}`
    );
  }

  console.log('✅ Attendance generation complete!');
  console.log('\nSummary:');
  EMPLOYEES.forEach((empId) => {
    const count = attendanceRecords.filter(
      (r) => r.employeeId === empId
    ).length;
    const onLeave = attendanceRecords.filter(
      (r) => r.employeeId === empId && r.status === 'on-leave'
    ).length;
    const present = count - onLeave;
    console.log(
      `  ${empId}: ${count} total (${present} present, ${onLeave} on leave)`
    );
  });
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
