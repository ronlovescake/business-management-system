# Attendance Generation from Schedules Guide

This guide explains how to generate attendance records based on actual employee schedules.

## Overview

The script `generate-attendance-from-schedules.js` creates attendance records for the period **January 1, 2025 to October 21, 2025** based on:

1. **Actual employee schedules** from the `schedules` table
2. **Approved leave requests** from the `leave_requests` table
3. **Schedule status** (cancelled schedules are excluded)

## Key Features

✅ **Schedule-Based Generation**: Only generates attendance for days with actual schedules
✅ **Leave Integration**: Automatically marks attendance as "on-leave" for approved leave requests
✅ **Smart Time Calculation**: Calculates total hours based on schedule times (minus breaks)
✅ **Duplicate Prevention**: Checks for existing attendance and prompts before overwriting
✅ **Batch Processing**: Inserts records in batches of 500 for optimal performance
✅ **Detailed Statistics**: Shows breakdown by employee and status

## How It Works

### Logic Flow

1. **Fetch Schedules**: Retrieves all non-cancelled, non-deleted schedules from Jan 1 to Oct 21, 2025
2. **Fetch Leave Requests**: Gets all approved leave requests that overlap with the date range
3. **Check Existing Data**: Warns if attendance records already exist for this period
4. **Generate Records**: For each schedule:
   - Check if employee is on approved leave
   - Set status: `present` or `on-leave`
   - Use schedule's `startTime` and `endTime` for time-in/time-out
   - Calculate total working hours (minus standard breaks)
   - Include leave details in notes if applicable
5. **Insert to Database**: Batch insert all records into the `attendance` table

### Break Time Deductions

The script automatically deducts 90 minutes of breaks from the total hours:

- Morning break: 9:00 AM - 9:15 AM (15 min)
- Lunch break: 12:00 PM - 1:00 PM (60 min)
- Afternoon break: 3:00 PM - 3:15 PM (15 min)

### Attendance Status Logic

| Condition                                        | Status     |
| ------------------------------------------------ | ---------- |
| Employee has approved leave request for the date | `on-leave` |
| Schedule status is 'on-leave'                    | `on-leave` |
| Otherwise                                        | `present`  |

## Usage

### Prerequisites

1. Ensure your development server is running (for database access)
2. Make sure you have schedules in the database for the date range
3. Backup your database if needed

### Run the Script

```bash
node generate-attendance-from-schedules.js
```

### Interactive Prompts

If existing attendance records are found, you'll be prompted:

```
⚠️  Found X existing attendance records
⚠️  Please clear existing records first or modify the script to handle updates

Do you want to DELETE all existing attendance and regenerate? (yes/no):
```

- Type `yes` to delete existing records and regenerate
- Type `no` to cancel the operation

## Output Example

```
🚀 Starting attendance generation from schedules...

📅 Fetching schedules from January 1, 2025 to October 21, 2025...
   Found 856 schedules

🏖️  Fetching approved leave requests...
   Found 12 approved leave requests

🔍 Checking for existing attendance records...

⚙️  Generating attendance records from schedules...
   Generated 856 attendance records

📊 Statistics:
   - Total Records: 856
   - Present: 844
   - On Leave: 12

👥 Breakdown by Employee:
   EMP-0004 (ARNEL EPHRAIM SUBIA ALIANGAN):
      Total: 294 | Present: 290 | On Leave: 4
   EMP-0005 (RAIN JOEL ORONG SUBIA):
      Total: 294 | Present: 288 | On Leave: 6
   EMP-0006 (Joan Tapic Lacaulan):
      Total: 268 | Present: 266 | On Leave: 2

💾 Inserting attendance records into database...
   Inserted batch 1: 500 records
   Inserted batch 2: 356 records

✅ Successfully inserted 856 attendance records!

🎉 Attendance generation complete!
```

## Database Schema

### Attendance Record Structure

```typescript
{
  id: string(auto - generated);
  employeeId: string; // From schedule
  employeeName: string; // From schedule
  department: string; // From schedule
  position: string; // From schedule
  date: string; // From schedule (YYYY-MM-DD)
  timeIn: string; // From schedule.startTime (HH:mm)
  timeOut: string; // From schedule.endTime (HH:mm)
  break1Start: '09:00'; // Standard
  break1End: '09:15'; // Standard
  lunchStart: '12:00'; // Standard
  lunchEnd: '13:00'; // Standard
  break2Start: '15:00'; // Standard
  break2End: '15:15'; // Standard
  totalHours: number; // Calculated (schedule time - breaks)
  status: string; // 'present' or 'on-leave'
  details: string | null; // Leave type if on leave
  notes: string | null; // Leave details or schedule notes
  createdAt: DateTime; // Auto
  updatedAt: DateTime; // Auto
  deletedAt: DateTime | null; // Soft delete support
}
```

## Important Notes

### What Gets Generated

✅ Attendance for days with actual schedules only
✅ All non-cancelled schedules
✅ Proper status based on leave requests
✅ Accurate time-in/time-out from schedules

### What Gets Excluded

❌ Cancelled schedules (status: 'cancelled')
❌ Soft-deleted schedules (deletedAt is not null)
❌ Days without schedules
❌ Dates outside the Jan 1 - Oct 21, 2025 range

### No Schedule = No Attendance

**Key Principle**: If an employee doesn't have a plotted schedule for a particular day, NO attendance record will be generated for that day. This ensures attendance is only created for actual work schedules.

## Verification Queries

### Check Generated Attendance

```sql
-- Count total attendance records
SELECT COUNT(*) FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL;

-- Count by status
SELECT status, COUNT(*)
FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL
GROUP BY status;

-- Employee breakdown
SELECT "employeeId", "employeeName", COUNT(*) as days_count,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
       SUM(CASE WHEN status = 'on-leave' THEN 1 ELSE 0 END) as leave_days
FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL
GROUP BY "employeeId", "employeeName"
ORDER BY "employeeId";
```

### Verify Against Schedules

```sql
-- Should match the number of non-cancelled schedules
SELECT COUNT(*) as schedule_count
FROM schedules
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL
AND status != 'cancelled';

SELECT COUNT(*) as attendance_count
FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL;
```

## Troubleshooting

### Issue: No Records Generated

**Solution**: Check if you have schedules in the database:

```sql
SELECT COUNT(*) FROM schedules
WHERE date >= '2025-01-01' AND date <= '2025-10-21'
AND "deletedAt" IS NULL;
```

### Issue: Database Connection Error

**Solution**: Ensure your development server is running and DATABASE_URL is configured in `.env`

### Issue: Duplicate Key Error

**Solution**: Clear existing attendance first:

```sql
DELETE FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21';
```

Or run the script and answer "yes" when prompted to delete existing records.

## Manual Cleanup

If you need to remove all generated attendance:

```sql
-- Soft delete (recommended)
UPDATE attendance
SET "deletedAt" = NOW()
WHERE date >= '2025-01-01' AND date <= '2025-10-21';

-- Hard delete (permanent)
DELETE FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21';
```

## Related Files

- `generate-attendance-from-schedules.js` - Main generation script
- `src/app/api/attendance/route.ts` - Attendance API endpoints
- `prisma/schema.prisma` - Database schema
- `generate-attendance-direct.js` - Legacy script (for reference)

---

**Status**: ✅ Ready to Use
**Last Updated**: October 22, 2025
**Date Range**: January 1, 2025 - October 21, 2025
