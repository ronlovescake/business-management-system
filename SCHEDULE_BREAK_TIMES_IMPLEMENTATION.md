# Schedule Break Times Implementation

## Overview

This document describes the implementation of break time scheduling for employee schedules. The system now supports scheduling three types of breaks:

- **First Break**: 15 minutes
- **Lunch Break**: 1 hour
- **Second Break**: 15 minutes

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)

Added six new optional fields to the `Schedule` model:

```prisma
model Schedule {
  // ... existing fields ...
  break1Start  String?   @db.VarChar(10)
  break1End    String?   @db.VarChar(10)
  lunchStart   String?   @db.VarChar(10)
  lunchEnd     String?   @db.VarChar(10)
  break2Start  String?   @db.VarChar(10)
  break2End    String?   @db.VarChar(10)
  // ... remaining fields ...
}
```

**Migration**: `20251104131326_add_break_times_to_schedules`

- Safely adds nullable columns to existing schedules table
- No data loss or migration of existing records required

### 2. TypeScript Types (`src/app/clothing/employees/schedules/types.ts`)

#### Schedule Interface

Updated to include break time fields:

```typescript
export interface Schedule {
  // ... existing fields ...
  break1Start?: string;
  break1End?: string;
  lunchStart?: string;
  lunchEnd?: string;
  break2Start?: string;
  break2End?: string;
  // ... remaining fields ...
}
```

#### RecurringRule Interface

Updated to support break times in recurring schedule rules:

```typescript
export interface RecurringRule {
  // ... existing fields ...
  break1Start?: string;
  break1End?: string;
  lunchStart?: string;
  lunchEnd?: string;
  break2Start?: string;
  break2End?: string;
  // ... remaining fields ...
}
```

### 3. Validation Schema (`src/lib/validations/schedule.validation.ts`)

Added validation for all six break time fields with proper time format validation (HH:MM):

```typescript
export const scheduleSchema = z.object({
  // ... existing validations ...
  break1Start: z
    .string()
    .trim()
    .regex(timeRegex, 'Break 1 start time must be in HH:MM format')
    .optional()
    .nullable(),
  break1End: z
    .string()
    .trim()
    .regex(timeRegex, 'Break 1 end time must be in HH:MM format')
    .optional()
    .nullable(),
  // ... similar for lunch and break2 ...
});
```

### 4. API Route (`src/app/api/schedules/route.ts`)

#### Type Updates

- `ScheduleCreateInput`: Added all six break fields
- `ScheduleResponse`: Added all six break fields
- `ScheduleUpdateInput`: Inherited break fields via partial type

#### Function Updates

- `toCreateInput()`: Parses and sanitizes break time inputs from request payloads
- `toUpdateInput()`: Handles partial updates of break times
- `mapScheduleToResponse()`: Maps break times from database to response format

### 5. React Hook (`src/app/clothing/employees/schedules/hooks/useSchedules.ts`)

#### State Management

Added six new state variables:

```typescript
const [formBreak1Start, setFormBreak1Start] = useState('');
const [formBreak1End, setFormBreak1End] = useState('');
const [formLunchStart, setFormLunchStart] = useState('');
const [formLunchEnd, setFormLunchEnd] = useState('');
const [formBreak2Start, setFormBreak2Start] = useState('');
const [formBreak2End, setFormBreak2End] = useState('');
```

#### Handler Updates

- `handleAddSchedule()`: Resets break time fields when creating new schedule
- `handleEditSchedule()`: Populates break time fields when editing existing schedule
- `handleSaveSchedule()`: Includes break times in schedule data payload
- `_generateSchedulesForRule()`: Applies break times from recurring rules to generated schedules

### 6. UI Components

#### New Component: `ScheduleModal.tsx`

Created a dedicated modal component for individual schedule creation/editing with:

- Employee and shift selection
- Position and department (auto-filled from employee)
- Working day indicator
- Start and end date/time pickers
- **Three break time sections** with start/end time pickers:
  - First Break (15 minutes)
  - Lunch Break (1 hour)
  - Second Break (15 minutes)
- Notes field
- Save and Reset actions

#### Updated: `CalendarBulkActions.tsx`

Enhanced the recurring schedule modal to include:

- Break time scheduling for recurring rules
- Three separate sections for each break type
- Time inputs with HH:MM format
- Break times are inherited by all schedules generated from the rule

#### Updated: `ScheduleControls.tsx`

- Modified "Add Schedule" button to trigger individual schedule modal
- Preserved existing bulk scheduling functionality

#### Updated: `page.tsx`

- Integrated new `ScheduleModal` component
- Wired up all form state and handlers
- Connected modal to "Add Schedule" button

## User Interface

### Individual Schedule Modal

When clicking "Add Schedule", users see a form with:

```
┌─────────────────────────────────────────┐
│ Add Schedule                      [X]   │
├─────────────────────────────────────────┤
│ Employee: [Select]    Shift: [Select]  │
│ Position: [Auto]      Department: [Auto]│
│                                         │
│ Working day: [Day indicator]            │
│                                         │
│ Start date: [Date]                      │
│ Start Time: [HH:MM]  End Time: [HH:MM] │
│                                         │
│ ──── Break Schedules ────               │
│                                         │
│ First Break (15 minutes)                │
│ Start: [HH:MM]       End: [HH:MM]      │
│                                         │
│ Lunch Break (1 hour)                    │
│ Start: [HH:MM]       End: [HH:MM]      │
│                                         │
│ Second Break (15 minutes)               │
│ Start: [HH:MM]       End: [HH:MM]      │
│                                         │
│ ──────────────────────                  │
│                                         │
│ Notes: [Text area]                      │
│                                         │
│ [Reset]              [Save Rule]        │
└─────────────────────────────────────────┘
```

### Recurring Schedule Modal

The bulk scheduling modal has similar break time fields that apply to all generated schedules.

## Data Flow

### Creating a Schedule

1. User opens modal via "Add Schedule" button
2. Selects employee (auto-fills position/department)
3. Sets shift type and times
4. **Optionally** sets break times for each break period
5. Saves schedule
6. Break times stored in database alongside other schedule fields

### Editing a Schedule

1. User clicks edit on existing schedule
2. Modal pre-populates all fields including break times
3. User modifies any fields including break times
4. Saves changes
5. Updated break times persisted to database

### Recurring Schedules

1. User creates recurring rule with break times
2. System generates individual schedules based on rule
3. Each generated schedule inherits break times from rule
4. Break times can be edited individually on each generated schedule

## API Integration

### POST /api/schedules

Create schedule with break times:

```typescript
{
  employeeId: "EMP-0001",
  date: "2025-11-04",
  startTime: "08:00",
  endTime: "17:00",
  break1Start: "10:00",
  break1End: "10:15",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  break2Start: "15:00",
  break2End: "15:15",
  // ... other fields
}
```

### PATCH /api/schedules

Update schedule break times:

```typescript
{
  id: "schedule-id",
  break1Start: "10:30",
  break1End: "10:45",
  // ... other fields to update
}
```

### GET /api/schedules

Response includes break times:

```typescript
{
  id: "schedule-id",
  employeeId: "EMP-0001",
  break1Start: "10:00",
  break1End: "10:15",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  break2Start: "15:00",
  break2End: "15:15",
  // ... other fields
}
```

## Validation

### Time Format

All break times must follow HH:MM format (24-hour):

- Valid: "08:00", "13:30", "23:59"
- Invalid: "8:00", "1:30 PM", "25:00"

### Optional Fields

All break time fields are optional - schedules can be created without specifying breaks.

### Consistency

No validation enforced that break times fall within shift times - this allows flexibility for edge cases like overnight shifts.

## Database Considerations

### Backward Compatibility

- Existing schedules without break times continue to work
- Break fields are nullable and default to NULL
- No migration of existing data required

### Storage

- Break times stored as VARCHAR(10) in HH:MM format
- Minimal storage overhead (60 bytes per schedule)
- Indexed by existing schedule indices

## Testing Recommendations

### Unit Tests

- [ ] Validate break time format (HH:MM)
- [ ] Test optional break time fields
- [ ] Test schedule creation with all break times
- [ ] Test schedule creation with no break times
- [ ] Test schedule creation with partial break times

### Integration Tests

- [ ] Create schedule via API with break times
- [ ] Update schedule break times via API
- [ ] Generate recurring schedules with break times
- [ ] Edit individual schedule from recurring rule

### UI Tests

- [ ] Modal opens with empty break time fields
- [ ] Modal pre-populates break times when editing
- [ ] Time inputs accept valid HH:MM format
- [ ] Break times save correctly
- [ ] Reset button clears break time fields

## Future Enhancements

### Potential Improvements

1. **Break Duration Validation**: Verify break durations match expected lengths (15 min, 1 hour)
2. **Break Time Suggestions**: Auto-suggest break times based on shift duration
3. **Break Overlap Detection**: Warn if breaks overlap or fall outside shift hours
4. **Break Templates**: Save common break schedules as templates
5. **Break Reports**: Analytics on break utilization and patterns
6. **Attendance Integration**: Link break times with actual attendance check-ins/outs

## Migration Notes

### Rolling Out

1. Deploy database migration first
2. Deploy backend API changes
3. Deploy frontend changes
4. Communicate new feature to users

### Rollback Plan

If issues arise:

1. Frontend can be rolled back independently (breaks won't be editable)
2. Backend can be rolled back (breaks will be ignored)
3. Database columns can remain (nullable columns have no impact)

## Support

### Common Questions

**Q: Are break times required?**
A: No, all break time fields are optional. You can create schedules without specifying breaks.

**Q: Can I edit break times on existing schedules?**
A: Yes, you can edit any schedule and add or modify break times.

**Q: Do break times from recurring rules apply to all schedules?**
A: Yes, but you can override them by editing individual schedules.

**Q: What time format should I use?**
A: Use 24-hour format HH:MM (e.g., 14:30 for 2:30 PM).

**Q: Can breaks overlap with shift times?**
A: Currently yes - the system doesn't enforce that breaks fall within shift hours to allow flexibility.

## Conclusion

The break time scheduling feature provides comprehensive support for managing employee breaks within their work schedules. The implementation is backward compatible, fully integrated with existing scheduling workflows, and provides flexibility for various break patterns and durations.
