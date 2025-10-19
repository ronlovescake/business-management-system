/**
 * Direct Database Insert for Attendance Records
 * Uses Prisma Client directly instead of going through the API
 */

const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const EMPLOYEES = ['EMP-0004', 'EMP-0005', 'EMP-0006'];

// Fetch all schedules
async function fetchSchedules() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/schedules', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Fetch all leave requests
async function fetchLeaveRequests() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000/api/leave-requests', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Check if employee is on leave for a specific date
function isOnLeave(employeeId, date, leaveRequests) {
  return leaveRequests.some(request => {
    const requestId = String(request.employeeId || '').trim().toLowerCase();
    const scheduleId = String(employeeId || '').trim().toLowerCase();
    
    if (requestId !== scheduleId) {
      return false;
    }
    
    if (request.status !== 'approved') {
      return false;
    }
    
    return date >= request.startDate && date <= request.endDate;
  });
}

function calculateTotalHours() {
  return 11.5;
}

async function generateAttendance() {
  try {
    console.log('Fetching schedules and leave requests...');
    
    const [schedules, leaveRequests] = await Promise.all([
      fetchSchedules(),
      fetchLeaveRequests()
    ]);
    
    console.log(`Found ${schedules.length} schedules`);
    console.log(`Found ${leaveRequests.length} leave requests`);
    
    // Filter schedules for stay-in employees from Jan 1 to Oct 19, 2025
    const relevantSchedules = schedules.filter(schedule => {
      if (!EMPLOYEES.includes(schedule.employeeId)) {
        return false;
      }
      return schedule.date >= '2025-01-01' && schedule.date <= '2025-10-19';
    });
    
    console.log(`\nFound ${relevantSchedules.length} relevant schedules for stay-in employees`);
    
    // Generate attendance records
    const attendanceRecords = [];
    
    for (const schedule of relevantSchedules) {
      const onLeave = isOnLeave(schedule.employeeId, schedule.date, leaveRequests);
      const status = onLeave ? 'on-leave' : 'present';
      
      const leaveInfo = leaveRequests.find(request => {
        const requestId = String(request.employeeId || '').trim().toLowerCase();
        const scheduleId = String(schedule.employeeId || '').trim().toLowerCase();
        return requestId === scheduleId && 
               request.status === 'approved' &&
               schedule.date >= request.startDate && 
               schedule.date <= request.endDate;
      });
      
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
        totalHours: calculateTotalHours(),
        status: status,
        details: onLeave && leaveInfo ? `On ${leaveInfo.leaveType}` : null,
        notes: onLeave && leaveInfo ? `Leave period: ${leaveInfo.startDate} to ${leaveInfo.endDate}` : null
      };
      
      attendanceRecords.push(attendanceRecord);
    }
    
    console.log(`\nGenerated ${attendanceRecords.length} attendance records`);
    
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const onLeaveCount = attendanceRecords.filter(r => r.status === 'on-leave').length;
    
    console.log(`- Present: ${presentCount}`);
    console.log(`- On Leave: ${onLeaveCount}`);
    
    console.log('\nBreakdown by employee:');
    for (const empId of EMPLOYEES) {
      const empRecords = attendanceRecords.filter(r => r.employeeId === empId);
      const empPresent = empRecords.filter(r => r.status === 'present').length;
      const empLeave = empRecords.filter(r => r.status === 'on-leave').length;
      console.log(`  ${empId}: ${empRecords.length} total (${empPresent} present, ${empLeave} on leave)`);
    }
    
    // Insert directly using Prisma
    console.log(`\nInserting attendance records into database...`);
    
    const result = await prisma.attendance.createMany({
      data: attendanceRecords,
      skipDuplicates: false,
    });
    
    console.log(`✅ Successfully inserted ${result.count} attendance records!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
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
