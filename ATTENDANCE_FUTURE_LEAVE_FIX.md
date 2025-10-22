# Attendance Records - Future Leave Fix

## Issue

When creating a leave request that spans multiple days (e.g., Oct 22 - Oct 31, 2025), the system was creating attendance records for **all dates** in the leave period, including future dates beyond today's date.

### Problem Scenario

- Leave request: Oct 22 - Oct 31, 2025
- Today's date: Oct 22, 2025
- **Before Fix**: Attendance Records showed "ON LEAVE" for all dates (Oct 22 - Oct 31)
- **Desired**: Only show attendance records for dates up to today (Oct 22 only)

## Solution

Modified the `/api/attendance/apply-leave` endpoint to only create attendance records for dates **up to and including today**. This ensures:

1. ✅ Leave requests remain intact with full date range (Oct 22-31)
2. ✅ All leave tracking logic continues to work correctly
3. ✅ Attendance Records table only shows leave entries for past/current dates
4. ✅ Future leave dates won't appear in attendance until those dates arrive

## Changes Made

### File: `src/app/api/attendance/apply-leave/route.ts`

#### Change 1: Filter Date Range to Today

Added logic to filter the date range to only include dates up to today:

```typescript
// Filter to only include dates up to today (don't create future attendance records)
const today = dayjs().tz().format(DATE_STORAGE_FORMAT);
const dateRangeUpToToday = dateRange.filter((date) => date <= today);

// If there are no dates up to today, still return success (leave is in the future)
if (dateRangeUpToToday.length === 0) {
  return NextResponse.json({
    success: true,
    updatedCount: 0,
    createdCount: 0,
    totalAffected: 0,
    message:
      'Leave request is for future dates only. No attendance records created yet.',
  });
}
```

#### Change 2: Use Filtered Date Range

Updated queries to use `dateRangeUpToToday` instead of `dateRange`:

```typescript
// Query existing attendance only for dates up to today
prisma.attendance.findMany({
  where: {
    employeeId: employeeIdRaw,
    date: { in: dateRangeUpToToday }, // ← Changed from dateRange
    deletedAt: null,
  },
  select: { id: true, date: true },
});

// Filter missing dates from the filtered range
const missingDates = dateRangeUpToToday.filter(
  (date) => !existingDates.has(date)
);
```

## Benefits

### 1. Cleaner Attendance View

The Attendance Records table now only shows:

- Historical attendance (past dates)
- Current day attendance (today)
- No future predictions or "ghost" records

### 2. Preserves All Logic

- Leave request tracking: ✅ Works as before
- Leave balance calculations: ✅ Unchanged
- Calendar view: ✅ Still shows full leave period
- Payment status: ✅ Unaffected

### 3. Automatic Future Record Creation

When future dates become "today", the system will automatically create attendance records through:

- The daily auto-record attendance feature
- Manual attendance recording
- The leave application process (if triggered again)

## Example Behavior

### Scenario: Leave from Oct 22 - Oct 31, 2025 (Today is Oct 22)

#### Leave Tracker Page

```
Rain Joel Orong Subia
Start Date: Oct 22, 2025
End Date: Oct 31, 2025
Status: APPROVED
Days: 10 days
```

#### Attendance Records Page

```
Date         Employee                Status
Oct 22, 2025 Rain Joel Orong Subia   ON LEAVE
(No entries for Oct 23-31 until those dates arrive)
```

#### Calendar View

```
All dates from Oct 22-31 are marked with leave indicators
(Shows the full leave period for planning purposes)
```

## Testing Recommendations

1. **Create a multi-day leave request spanning today and future dates**
   - Verify only today's record appears in Attendance Records
   - Confirm full date range appears in Leave Tracker

2. **Check edge cases**
   - Leave request entirely in the future
   - Leave request entirely in the past
   - Leave request starting yesterday, ending in the future

3. **Verify auto-record attendance**
   - Ensure it respects leave requests for current day
   - Confirm it doesn't create duplicate records

## Notes

- This change only affects the **Attendance Records display**
- Leave request functionality remains **completely unchanged**
- All reporting and analytics continue to work as before
- The change is **backward compatible** with existing data
