# Attendance Generation from Schedules - Complete ✅

**Date**: October 22, 2025  
**Status**: Successfully Generated  
**Date Range**: January 1, 2025 - October 21, 2025

---

## Summary

Successfully generated **673 attendance records** based on actual employee schedules from the `schedules` table, ensuring that attendance is only created for days when employees have plotted schedules.

---

## Generation Results

### Overall Statistics

| Metric                       | Count                |
| ---------------------------- | -------------------- |
| **Total Attendance Records** | 673                  |
| **Present Status**           | 663 (98.5%)          |
| **On Leave Status**          | 10 (1.5%)            |
| **Date Range**               | Jan 1 - Oct 21, 2025 |
| **Source Schedules**         | 673 schedules        |
| **Approved Leave Requests**  | 2 requests           |

### Breakdown by Employee

#### EMP-0004 - Arnel Ephraim Subia Aliangan

- **Total Days**: 252
- **Present**: 242 (96.0%)
- **On Leave**: 10 (4.0%)
- **Position**: Warehouse POC
- **Department**: Operations

#### EMP-0005 - Rain Joel Orong Subia

- **Total Days**: 252
- **Present**: 252 (100%)
- **On Leave**: 0
- **Position**: Warehouse Staff
- **Department**: Operations

#### EMP-0006 - Joan Tapic Lacaulan

- **Total Days**: 169
- **Present**: 169 (100%)
- **On Leave**: 0
- **Position**: Warehouse Staff
- **Department**: Operations
- **Note**: Hired on April 8, 2025 (shorter period)

---

## Key Features Implemented

### ✅ Schedule-Based Generation

- Only generates attendance for days with actual plotted schedules
- No schedule = No attendance record
- Respects the business rule: attendance follows schedules

### ✅ Leave Integration

- Automatically detects approved leave requests
- Marks attendance as "on-leave" for approved leaves
- Includes leave details in notes:
  - Leave type (e.g., "Vacation Leave", "Other")
  - Leave period dates
  - Leave reason

### ✅ Smart Time Calculation

- Uses schedule's `startTime` and `endTime` for time-in/time-out
- Calculates total working hours
- Deducts standard breaks (90 minutes total):
  - Morning break: 15 minutes
  - Lunch break: 60 minutes
  - Afternoon break: 15 minutes

### ✅ Status Logic

```
IF employee has approved leave for date:
  status = "on-leave"
ELSE IF schedule status is "on-leave":
  status = "on-leave"
ELSE:
  status = "present"
```

### ✅ Exclusion Rules

- Cancelled schedules are excluded
- Soft-deleted schedules are excluded
- Only non-deleted schedules generate attendance

---

## Sample Data

### Present Attendance

```json
{
  "employeeId": "EMP-0004",
  "employeeName": "Arnel Ephraim Subia Aliangan",
  "date": "2025-01-04",
  "status": "present",
  "timeIn": "4:00",
  "timeOut": "17:00",
  "totalHours": 11.5,
  "department": "Operations",
  "position": "Warehouse POC"
}
```

### On-Leave Attendance

```json
{
  "employeeId": "EMP-0004",
  "employeeName": "Arnel Ephraim Subia Aliangan",
  "date": "2025-04-07",
  "status": "on-leave",
  "details": "On Vacation Leave",
  "notes": "Leave period: 2025-03-31 to 2025-04-07. Reason: Vacation",
  "timeIn": "4:00",
  "timeOut": "17:00",
  "totalHours": 11.5
}
```

---

## Files Created

### 1. Generation Script

**File**: `generate-attendance-from-schedules.js`

Features:

- Fetches all schedules from Jan 1 to Oct 21, 2025
- Fetches all approved leave requests
- Checks for existing attendance data
- Generates attendance based on schedules
- Handles leave status automatically
- Batch inserts (500 records per batch)
- Detailed statistics and reporting

### 2. Documentation

**File**: `ATTENDANCE_GENERATION_GUIDE.md`

Includes:

- Complete usage guide
- Logic flow explanation
- Verification queries
- Troubleshooting tips
- Manual cleanup instructions

---

## Verification Queries

### Check Total Records

```sql
SELECT COUNT(*) as total_records
FROM attendance
WHERE date >= '2025-01-01'
  AND date <= '2025-10-21'
  AND "deletedAt" IS NULL;
-- Result: 673 records
```

### Check Status Distribution

```sql
SELECT status, COUNT(*) as count
FROM attendance
WHERE date >= '2025-01-01'
  AND date <= '2025-10-21'
  AND "deletedAt" IS NULL
GROUP BY status;
-- Result: present (663), on-leave (10)
```

### Verify Against Schedules

```sql
SELECT
  (SELECT COUNT(*) FROM schedules
   WHERE date >= '2025-01-01' AND date <= '2025-10-21'
   AND "deletedAt" IS NULL AND status != 'cancelled') as schedule_count,
  (SELECT COUNT(*) FROM attendance
   WHERE date >= '2025-01-01' AND date <= '2025-10-21'
   AND "deletedAt" IS NULL) as attendance_count;
-- Both should match: 673
```

---

## Technical Details

### Database Schema

**Table**: `attendance`

Key Fields:

- `id`: Unique identifier (CUID)
- `employeeId`: From schedule
- `employeeName`: From schedule
- `date`: Schedule date (YYYY-MM-DD)
- `timeIn`/`timeOut`: From schedule times
- `totalHours`: Calculated (schedule time - breaks)
- `status`: 'present' or 'on-leave'
- `details`: Leave type if applicable
- `notes`: Leave details or schedule notes
- `deletedAt`: Soft delete support

### API Endpoints

- `GET /api/attendance` - Fetch attendance records
- `POST /api/attendance` - Create attendance (single or bulk)
- `PATCH /api/attendance` - Update attendance
- `DELETE /api/attendance` - Soft delete attendance

---

## Business Rules Enforced

### 1. No Schedule = No Attendance ✅

If an employee doesn't have a plotted schedule for a day, no attendance record is generated for that day.

**Example**: Joan Tapic Lacaulan (EMP-0006)

- Hired: April 8, 2025
- Attendance records: Only from April 8 onwards (169 days)
- No attendance before hire date

### 2. Cancelled Schedules Excluded ✅

Schedules with status 'cancelled' do not generate attendance records.

### 3. Leave Status Priority ✅

Approved leave requests override the default 'present' status.

**Example**: EMP-0004 on April 7, 2025

- Has schedule: Yes
- Has approved leave: Yes (Vacation Leave, Mar 31 - Apr 7)
- Attendance status: 'on-leave'
- Details preserved: Leave type, period, reason

### 4. Soft Delete Support ✅

Only non-deleted schedules generate attendance records.

---

## Usage Instructions

### Run Generation Script

```bash
node generate-attendance-from-schedules.js
```

### Check Generated Data

```bash
# Via API
curl "http://localhost:3000/api/attendance?startDate=2025-01-01&endDate=2025-01-31"

# Via Database
npx prisma studio
```

### Clean Up (if needed)

```sql
-- Soft delete
UPDATE attendance
SET "deletedAt" = NOW()
WHERE date >= '2025-01-01' AND date <= '2025-10-21';

-- Hard delete
DELETE FROM attendance
WHERE date >= '2025-01-01' AND date <= '2025-10-21';
```

---

## Benefits

✅ **Accurate Attendance**: Based on actual work schedules  
✅ **Leave Integration**: Automatically reflects approved leaves  
✅ **No Manual Work**: Fully automated generation  
✅ **Audit Trail**: Preserves leave details in notes  
✅ **Flexible**: Easy to regenerate if schedules change  
✅ **Scalable**: Batch processing handles large datasets  
✅ **Safe**: Warns before overwriting existing data

---

## Next Steps (Optional)

1. **Recurring Generation**: Set up cron job for automatic daily generation
2. **Validation**: Add validation against expected work hours
3. **Late/Absent Detection**: Compare actual time-in with schedule time
4. **Reporting**: Generate attendance reports and analytics
5. **Mobile App**: Create mobile interface for viewing attendance

---

## Maintenance

### Re-run Generation

If schedules are updated, simply re-run the script:

```bash
node generate-attendance-from-schedules.js
```

The script will:

1. Detect existing attendance
2. Prompt for confirmation
3. Delete old records if confirmed
4. Generate fresh attendance from current schedules

### Add New Employees

When new employees are added with schedules, run the script again to generate their attendance records.

---

**Status**: ✅ Complete and Verified  
**Last Run**: October 22, 2025  
**Records Generated**: 673  
**Data Quality**: 100% accurate based on schedules
