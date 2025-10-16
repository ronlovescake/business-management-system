# Attendance Time Columns Update

## Change Summary

Modified the attendance page to display separate **TIME IN** and **TIME OUT** columns instead of a single **TIME** column that showed the time range.

## Files Modified

### 1. `/src/app/clothing/employees/attendance/hooks/useAttendance.ts`

**Change:** Exported the `formatTime` function

```typescript
// Added to return statement
return {
  // ... other exports

  // Utility functions
  formatDate,
  formatTime, // ← Added this
  formatTimeRange,
  formatHours,
  getStatusColor,

  // ... other exports
};
```

### 2. `/src/app/clothing/employees/attendance/page.tsx`

**Changes:**

#### a. Updated imports from hook

```typescript
const {
  // ...
  formatDate,
  formatTime, // ← Added this
  // formatTimeRange - Removed (no longer needed)
  formatHours,
  // ...
} = useAttendance();
```

#### b. Replaced single TIME column with two columns

**Before:**

```typescript
{
  key: 'time',
  label: 'TIME',
  render: (item) => (
    <Text size="sm">{formatTimeRange(item.timeIn, item.timeOut)}</Text>
  ),
},
```

**After:**

```typescript
{
  key: 'timeIn',
  label: 'TIME IN',
  render: (item) => (
    <Text size="sm">{item.timeIn === '00:00' ? '—' : formatTime(item.timeIn)}</Text>
  ),
},
{
  key: 'timeOut',
  label: 'TIME OUT',
  render: (item) => (
    <Text size="sm">{item.timeOut === '00:00' ? '—' : formatTime(item.timeOut)}</Text>
  ),
},
```

## Visual Changes

### Before

| EMPLOYEE | DATE         | TIME              | HOURS    | STATUS  | DETAILS | ACTION |
| -------- | ------------ | ----------------- | -------- | ------- | ------- | ------ |
| John Doe | Oct 15, 2025 | 8:00 AM - 5:00 PM | 8.50 hrs | PRESENT | ...     | ...    |

### After

| EMPLOYEE | DATE         | TIME IN | TIME OUT | HOURS    | STATUS  | DETAILS | ACTION |
| -------- | ------------ | ------- | -------- | -------- | ------- | ------- | ------ |
| John Doe | Oct 15, 2025 | 8:00 AM | 5:00 PM  | 8.50 hrs | PRESENT | ...     | ...    |

## Features

### Time Formatting

- Uses 12-hour format (e.g., "8:00 AM", "5:00 PM")
- Displays "—" (em dash) when time is "00:00" (indicating absent or no time recorded)
- Consistent formatting across both columns

### Benefits

1. **Clearer Data Display**: Separate columns make it easier to scan specific time in/out values
2. **Better Alignment**: Each column can be independently sized and aligned
3. **Improved Sorting**: Users can potentially sort by time in or time out separately (if sorting is added)
4. **More Professional**: Matches standard attendance reporting formats

## Testing

To verify the changes:

1. Navigate to `/clothing/employees/attendance`
2. Verify that TIME IN and TIME OUT appear as separate columns
3. Check that times are formatted correctly (12-hour format)
4. Verify absent records show "—" for both time columns
5. Ensure the table layout looks clean and aligned

## Notes

- The `formatTimeRange` function is still available in the hook for other potential uses
- Times stored in the database remain in 24-hour format (HH:MM)
- Only the display format is changed to 12-hour format for better readability
