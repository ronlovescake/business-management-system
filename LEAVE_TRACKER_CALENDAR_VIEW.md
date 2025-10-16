# Leave Tracker - Calendar View Addition

## Overview

Added a third tab to the Leave Tracker module with a yearly calendar view showing all leave requests with visual indicators.

## Changes Made

### 1. New Component: `CalendarView.tsx`

**Location:** `src/app/clothing/employees/leave-tracker/components/CalendarView.tsx`

**Features:**

- **12-Month Yearly View**: Displays all 12 months of the current year in a responsive grid
- **Visual Indicators**: Shows colored dots on dates with leave requests
  - Each leave type has a unique color (matching the leave type badge colors)
  - Up to 3 dots per date (for overlapping leaves)
- **Interactive**: Click any date to see leave details for that day
- **Selected Date Panel**: Shows all leave requests for the clicked date with:
  - Employee name
  - Leave type badge
  - Number of days
  - Reason
- **Legend**: Color-coded legend showing leave types
- **Summary**: Total requests count

**Technical Details:**

- Uses `DatePicker` from `@mantine/dates` library
- Renders 12 DatePicker components in a responsive grid (1-4 columns based on screen size)
- Custom `renderDay` function adds dots for dates with leave requests
- Filters leave requests by date range (startDate to endDate)
- Responsive design with SimpleGrid

### 2. Updated: `LeaveControls.tsx`

**Changes:**

- Added `IconCalendar` import from `@tabler/icons-react`
- Added third tab configuration:
  ```typescript
  {
    value: 'calendar',
    label: 'Calendar View',
    icon: <IconCalendar size={16} />,
  }
  ```

### 3. Updated: `page.tsx`

**Changes:**

- Imported `CalendarView` component
- Updated tab rendering logic to include calendar view:
  ```typescript
  {activeTab === 'list' ? (
    <LeaveListTable ... />
  ) : activeTab === 'analytics' ? (
    <AnalyticsTable ... />
  ) : (
    <CalendarView ... />
  )}
  ```

## Visual Design

### Calendar Layout

```
┌─────────────────────────────────────────────────────┐
│ Leave Calendar - 2025                                │
├─────────────────────────────────────────────────────┤
│  Jan    Feb    Mar    Apr    May    Jun             │
│  [Cal]  [Cal]  [Cal]  [Cal]  [Cal]  [Cal]           │
│                                                       │
│  Jul    Aug    Sep    Oct    Nov    Dec             │
│  [Cal]  [Cal]  [Cal]  [Cal]  [Cal]  [Cal]           │
├─────────────────────────────────────────────────────┤
│ Leave Requests on Oct 15, 2025                      │
│ • Ronald Allan Balng - Sick Leave - 3 days          │
│ • Czarina Cortez Balng - Vacation - 5 days          │
├─────────────────────────────────────────────────────┤
│ Legend: • Sick  • Vacation  • Emergency  • Other    │
├─────────────────────────────────────────────────────┤
│ Click on any date to see leave details              │
└─────────────────────────────────────────────────────┘
```

### Leave Indicators

Each date with leave requests shows small colored dots:

- 🔴 Red dot = Sick Leave
- 🔵 Blue dot = Vacation Leave
- 🟠 Orange dot = Emergency Leave
- 🟣 Pink dot = Maternity Leave
- 🔵 Cyan dot = Paternity Leave
- ⚫ Gray dot = Bereavement Leave
- 🟣 Grape dot = Other

### Responsive Grid

- **Mobile (base)**: 1 column - stacked vertically
- **Small (sm)**: 2 columns - 6 rows
- **Medium (md)**: 3 columns - 4 rows
- **Large (lg)**: 4 columns - 3 rows

## User Experience

### Navigation

1. Click "Calendar View" tab
2. See all 12 months of the current year
3. Dates with leave requests have colored dots
4. Click any date to see details below the calendars

### Interactions

- **Click Date**: Select a date to view leave details
- **Visual Feedback**: Selected date is highlighted
- **Hover Effects**: Calendar dates respond to hover
- **Mobile Friendly**: Touch-friendly tap targets

### Information Display

- **At a Glance**: See which dates have leaves across the year
- **Color Coding**: Instantly identify leave types by dot colors
- **Details on Demand**: Click for full information
- **Multi-leave Dates**: Multiple dots show overlapping leaves

## Benefits

### For Managers

- **Quick Overview**: See leave distribution across the year
- **Conflict Detection**: Easily spot overlapping leaves
- **Planning**: Better workforce planning with visual calendar
- **Patterns**: Identify busy periods or leave patterns

### For HR

- **Visual Reports**: Calendar view for presentations
- **Resource Planning**: See staffing levels by date
- **Approval Context**: Understand leave conflicts before approval
- **Compliance**: Track leave balance visually

### For Employees

- **Team Calendar**: See when colleagues are on leave
- **Planning**: Choose dates without conflicts
- **Transparency**: Clear view of approved leaves

## Technical Notes

### DatePicker Configuration

```typescript
<DatePicker
  type="default"
  value={selectedDate}
  onChange={setSelectedDate}
  defaultDate={monthDate}
  size="xs"
  hideOutsideDates
  renderDay={(date: Date) => (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {renderDay(date)}
    </div>
  )}
/>
```

### Leave Request Filtering

- Checks if a date falls within leave request's startDate and endDate range
- Handles multi-day leaves spanning across dates
- Efficiently filters requests per date

### Performance

- Renders 12 DatePicker instances (manageable with React's optimization)
- Memoization possible for getLeaveRequestsForDate if needed
- Lazy rendering with visible area optimization available

## Future Enhancements

### Possible Additions

1. **Year Selector**: Switch between different years
2. **Export Calendar**: Download as PDF or image
3. **Print View**: Optimized print layout
4. **Tooltips**: Hover to see quick leave info without clicking
5. **Zoom**: Expand a single month for better detail
6. **Filters**: Apply leave type or status filters to calendar
7. **Team View**: Filter by department or team
8. **Availability**: Show available vs unavailable employees
9. **Color Customization**: User-defined colors per leave type
10. **Holiday Integration**: Overlay company holidays

### Advanced Features

- Drag and drop to reschedule leaves
- Multi-date selection for batch operations
- Recurring leave patterns
- Leave balance overlay
- Conflict warnings in real-time
- Manager approval directly from calendar

## Files Modified

1. `src/app/clothing/employees/leave-tracker/components/CalendarView.tsx` (NEW)
2. `src/app/clothing/employees/leave-tracker/components/LeaveControls.tsx` (UPDATED)
3. `src/app/clothing/employees/leave-tracker/page.tsx` (UPDATED)

## Testing Checklist

- [ ] All three tabs work correctly
- [ ] Calendar shows all 12 months
- [ ] Dates with leaves show colored dots
- [ ] Clicking a date shows leave details
- [ ] Selected date panel displays correct information
- [ ] Legend shows correct colors
- [ ] Responsive layout works on all screen sizes
- [ ] No console errors
- [ ] Leave type colors match across all views

## Usage

Navigate to `/clothing/employees/leave-tracker` and click the "Calendar View" tab to see the yearly calendar with all leave requests visualized!
