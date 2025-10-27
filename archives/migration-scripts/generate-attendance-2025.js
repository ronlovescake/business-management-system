/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateAttendance() {
  console.log('🚀 Starting attendance generation...\n');

  try {
    // Fetch schedules for the three employees from Jan 1 to today
    const schedules = await prisma.schedule.findMany({
      where: {
        employeeId: {
          in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
        },
        date: {
          gte: '2025-01-01',
          lte: '2025-10-19',
        },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    console.log(`📅 Found ${schedules.length} schedules to process\n`);

    // Fetch leave requests
    const leaveRequests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: {
          in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
        },
        status: 'approved',
        startDate: {
          lte: '2025-10-19',
        },
        endDate: {
          gte: '2025-01-01',
        },
      },
    });

    console.log(`🏖️  Found ${leaveRequests.length} approved leave requests\n`);

    // Create a map of leave dates per employee
    const leaveMap = {};
    leaveRequests.forEach((leave) => {
      const employeeId = leave.employeeId.trim().toLowerCase();
      if (!leaveMap[employeeId]) {
        leaveMap[employeeId] = [];
      }

      // Generate all dates in the leave period
      const startDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        leaveMap[employeeId].push(dateStr);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Generate attendance records
    const attendanceRecords = [];
    let presentCount = 0;
    let onLeaveCount = 0;

    for (const schedule of schedules) {
      const employeeId = schedule.employeeId.trim().toLowerCase();
      const isOnLeave = leaveMap[employeeId]?.includes(schedule.date);

      // Stay-in employees are always present unless on leave
      const status = isOnLeave ? 'on-leave' : 'present';

      // Calculate total hours (4:00 AM to 5:00 PM = 13 hours)
      const totalHours = 13.0;

      const attendance = {
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        department: schedule.department,
        position: schedule.position,
        date: schedule.date,
        timeIn: schedule.startTime, // 04:00
        timeOut: schedule.endTime, // 17:00
        totalHours: totalHours,
        status: status,
        notes: isOnLeave ? 'Employee on approved leave' : 'Regular attendance',
      };

      attendanceRecords.push(attendance);

      if (status === 'present') {
        presentCount++;
      } else {
        onLeaveCount++;
      }
    }

    console.log('📊 Attendance Summary:');
    console.log(`   - Present: ${presentCount}`);
    console.log(`   - On Leave: ${onLeaveCount}`);
    console.log(`   - Total: ${attendanceRecords.length}\n`);

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < attendanceRecords.length; i += batchSize) {
      const batch = attendanceRecords.slice(i, i + batchSize);

      await prisma.attendance.createMany({
        data: batch,
        skipDuplicates: true,
      });

      inserted += batch.length;
      console.log(
        `✅ Inserted batch ${Math.floor(i / batchSize) + 1}: ${inserted}/${attendanceRecords.length}`
      );
    }

    console.log('\n✨ Attendance generation completed successfully!');

    // Show breakdown by employee
    const breakdown = await prisma.attendance.groupBy({
      by: ['employeeId', 'status'],
      _count: true,
      where: {
        employeeId: {
          in: ['EMP-0004', 'EMP-0005', 'EMP-0006'],
        },
      },
    });

    console.log('\n👥 Employee Breakdown:');
    breakdown.forEach((item) => {
      console.log(
        `   ${item.employeeId} - ${item.status}: ${item._count} days`
      );
    });
  } catch (error) {
    console.error('❌ Error generating attendance:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

generateAttendance();
