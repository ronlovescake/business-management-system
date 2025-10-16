# Leave Tracker Module - Complete Implementation

## Overview

Built a comprehensive leave tracker module for `/clothing/employees/leave-tracker` following the same architecture pattern as the expenses page.

## Directory Structure

```
src/app/clothing/employees/leave-tracker/
├── types.ts                          # Type definitions
├── hooks/
│   └── useLeaveTracker.ts           # Business logic hook
├── components/
│   ├── StatsCards.tsx               # Stats display component
│   ├── LeaveControls.tsx            # Controls with tabs, filters, actions
│   ├── LeaveListTable.tsx           # Main leave requests table
│   ├── AnalyticsTable.tsx           # Monthly breakdown by leave type
│   └── LeaveFormDialog.tsx          # Add/Edit leave request form
└── page.tsx                          # Main page orchestrator
```

## Features Implemented

### 1. **Leave Request Management**

- Add new leave requests
- Edit existing requests
- Delete requests
- Approve/Reject requests
- Track status: Pending, Approved, Rejected

### 2. **Leave Types Supported**

- Sick Leave
- Vacation Leave
- Emergency Leave
- Maternity Leave
- Paternity Leave
- Bereavement Leave
- Other

### 3. **Stats Dashboard**

- Total Requests
- Pending Requests
- Approved Requests
- Total Days Requested

### 4. **Search & Filters**

- Search by employee name, ID, leave type, reason, or notes
- Filter by leave type
- Filter by status

### 5. **Two View Modes**

#### Leave Requests Tab

- Lists all leave requests with:
  - Employee info (name, ID, avatar)
  - Leave type (color-coded badges)
  - Date range with number of days
  - Applied date
  - Status badge
  - Reason
- Actions per row:
  - Approve (for pending requests)
  - Reject (for pending requests)
  - Edit
  - Delete

#### Analytics by Type Tab

- Monthly breakdown of leave days by type
- Shows:
  - Leave type badges (color-coded)
  - Total days with progress bar
  - Percentage of total
  - Days per month (Jan-Dec)

### 6. **CSV Import/Export**

- **Import**: Upload CSV files with leave requests
  - Required columns: employeeId, employeeName, leaveType, startDate, endDate, reason
  - Optional columns: status, appliedDate, approvedBy, notes
  - Validates data and shows success/error messages

- **Export**: Download filtered leave requests as CSV
  - Includes all columns
  - File named: `leave_requests_YYYY-MM-DD.csv`

### 7. **Leave Request Form Dialog**

- Fields:
  - Employee Name (required)
  - Employee ID (required)
  - Leave Type dropdown (required)
  - Start Date (required)
  - End Date (required)
  - Number of Days (auto-calculated, read-only)
  - Reason (required, textarea)
  - Notes (optional, textarea)
- Validates all required fields
- Auto-calculates number of days based on date range

## Technical Implementation

### Type Definitions (`types.ts`)

```typescript
- LeaveStatus: 'pending' | 'approved' | 'rejected'
- LeaveType: 7 different types
- LeaveRequest: Complete interface with all fields
```

### Business Logic Hook (`useLeaveTracker.ts`)

- **State Management**: All state in one place
- **Form State**: Separate state for form fields
- **Computed Values**:
  - Filtered requests
  - Statistics
  - Monthly breakdown
- **Utility Functions**:
  - Date formatting
  - Color getters for status/type
  - Days calculation
- **Event Handlers**:
  - CRUD operations
  - CSV import/export
  - Approval/rejection

### Components

#### StatsCards

- Reuses `StatsCardGroup` from shared templates
- Displays 4 key metrics with icons

#### LeaveControls

- Reuses `PageControls` from shared templates
- Provides tabs, search, filters, and action buttons
- Handles Import CSV, Export, and Add Leave Request

#### LeaveListTable

- Reuses `DataTable` from shared templates
- Custom columns with badges and avatars
- Conditional actions based on status

#### AnalyticsTable

- Reuses `DataTable` from shared templates
- Shows monthly breakdown with progress bars
- Adds `id` field for DataTable compatibility

#### LeaveFormDialog

- Modal form with Mantine components
- Auto-calculates days between dates
- Validates required fields

### Main Page (`page.tsx`)

- Thin orchestration layer (~170 lines)
- Imports and uses all components
- Passes props from hook to components
- Clean, readable structure

## Sample Data

Includes 4 sample leave requests:

1. Ronald Allan Balng - Sick Leave (Approved)
2. Czarina Cortez Balng - Vacation Leave (Pending)
3. Arnel Ephraim Subia Aliangan - Emergency Leave (Approved)
4. Joan Lacualan Tapic - Sick Leave (Rejected)

## Architecture Benefits

### 1. **Separation of Concerns**

- Business logic in hook (testable)
- UI in components (swappable)
- Page is just composition

### 2. **Reusability**

- Uses shared PageTemplates components
- Components can be reused elsewhere
- Hook can be used in different UIs

### 3. **Maintainability**

- Easy to find and fix bugs
- Clear file structure
- Well-documented code

### 4. **Extensibility**

- Easy to add new leave types
- Easy to add new features
- Database integration ready

## Next Steps

### Database Integration

- Connect to backend API
- Replace mock data with real data
- Add authentication for approvals

### Enhanced Features

- Employee leave balance tracking
- Email notifications for approvals
- Calendar view of leave requests
- Conflict detection (overlapping leaves)
- Manager approval workflow
- Leave policy rules engine

### UI Enhancements

- Loading states
- Error boundaries
- Toast notifications
- Confirmation dialogs
- Bulk operations

## Usage

Navigate to: `/clothing/employees/leave-tracker`

The page is fully functional with:

- ✅ Stats cards showing key metrics
- ✅ Search and filtering
- ✅ Two tab views (List and Analytics)
- ✅ Add/Edit/Delete operations
- ✅ Approve/Reject functionality
- ✅ CSV import/export
- ✅ Responsive design
- ✅ Color-coded visual feedback

All features work with mock data and are ready for backend integration!
