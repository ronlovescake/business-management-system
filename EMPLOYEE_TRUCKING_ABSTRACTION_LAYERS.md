# Employee & Trucking Abstraction Layers

## 🎯 Overview

Abstraction layers for **future employee management and trucking pages** are now ready! These components follow the same clean architecture pattern as your operational pages.

## 📦 Components Created

### Employee Management (Clothing & Trucking)

| Component                    | Purpose                                   | Usage                                        |
| ---------------------------- | ----------------------------------------- | -------------------------------------------- |
| **EmployeeManagementLayout** | General employee data management          | Team, Employee Loans, Cash Advance, Expenses |
| **AttendanceLayout**         | Attendance tracking with date filters     | Attendance pages                             |
| **PayrollLayout**            | Payroll processing and payslip generation | Payroll pages                                |

### Trucking-Specific

| Component       | Purpose                              | Usage               |
| --------------- | ------------------------------------ | ------------------- |
| **TripsLayout** | Trip management with status tracking | Trucking trips page |

## 🏗️ Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│  Page Component (page.tsx)                              │
│  ✅ Business Logic (calculations, validations)         │
│  ✅ State Management (hooks, state)                    │
│  ✅ API Calls (data fetching)                          │
│  ✅ Event Handlers (onClick, onChange)                 │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  Layout Component (*Layout.tsx)                         │
│  ✅ UI Structure (buttons, filters, cards)             │
│  ✅ Stats Cards Display                                │
│  ✅ Action Buttons                                     │
│  ✅ Search & Filters                                   │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│  DataTable Component (Swappable!)                       │
│  ✅ Grid rendering                                     │
│  ✅ Can be replaced with any grid library              │
└─────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
src/components/features/
├── employees/
│   ├── EmployeeManagementLayout.tsx    # General employee management
│   ├── AttendanceLayout.tsx            # Attendance tracking
│   ├── PayrollLayout.tsx               # Payroll processing
│   └── index.ts                        # Exports
└── trucking/
    ├── TripsLayout.tsx                 # Trips management
    └── index.ts                        # Exports
```

## 🎨 Component Features

### 1. EmployeeManagementLayout

**Perfect for:**

- Team/Employee Directory
- Employee Loans Management
- Cash Advance Tracking
- Expense Reports
- Schedules
- Leave Tracker
- Thirteenth Month Pay

**Features:**

- ✅ Stats cards (configurable)
- ✅ Search bar
- ✅ Add Employee button
- ✅ CSV import
- ✅ Custom action buttons support
- ✅ DataTable integration

**Usage Example:**

```tsx
// In team/page.tsx
import { EmployeeManagementLayout } from '@/components/features/employees';

export default function TeamPage() {
  // ... your business logic ...

  return (
    <PageLayout fluid withPadding>
      <EmployeeManagementLayout
        data={employees}
        filteredData={filteredEmployees}
        columns={columns}
        statsCards={statsCards}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        getCellContent={getCellContent}
        onCellEdited={handleCellEdited}
        onAddEmployee={() => setModalOpen(true)}
        addButtonLabel="Add Employee"
        enableCSVImport={true}
      />
    </PageLayout>
  );
}
```

### 2. AttendanceLayout

**Perfect for:**

- Daily attendance tracking
- Time-in/Time-out records
- Overtime tracking
- Attendance reports

**Features:**

- ✅ Stats cards (present, absent, late, etc.)
- ✅ Date range filters (start/end date)
- ✅ Add attendance button
- ✅ Export report button with loading state
- ✅ CSV import
- ✅ DataTable integration

**Unique Features:**

- Date range filtering with DateInput components
- Export functionality for reports
- Specialized for time-based data

**Usage Example:**

```tsx
// In attendance/page.tsx
import { AttendanceLayout } from '@/components/features/employees';

export default function AttendancePage() {
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null,
  });

  return (
    <PageLayout fluid withPadding>
      <AttendanceLayout
        data={attendanceRecords}
        filteredData={filteredRecords}
        columns={columns}
        statsCards={statsCards}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        getCellContent={getCellContent}
        dateRange={dateRange}
        onDateRangeChange={(start, end) => setDateRange({ start, end })}
        onAddAttendance={() => setModalOpen(true)}
        onExportReport={handleExportReport}
        isExporting={isExporting}
      />
    </PageLayout>
  );
}
```

### 3. PayrollLayout

**Perfect for:**

- Payroll processing
- Salary calculations
- Payslip generation
- Tax and deductions management

**Features:**

- ✅ Stats cards (total payroll, deductions, net pay, etc.)
- ✅ Pay period selector
- ✅ Process Payroll button
- ✅ Generate Payslips button
- ✅ Export button
- ✅ Loading states for all actions
- ✅ CSV import
- ✅ DataTable integration

**Unique Features:**

- Pay period dropdown selector
- Multiple action buttons for different payroll operations
- Processing/generating/exporting states

**Usage Example:**

```tsx
// In payroll/page.tsx
import { PayrollLayout } from '@/components/features/employees';

export default function PayrollPage() {
  const payPeriods = [
    { value: '2024-01', label: 'January 2024' },
    { value: '2024-02', label: 'February 2024' },
    // ...
  ];

  return (
    <PageLayout fluid withPadding>
      <PayrollLayout
        data={payrollRecords}
        filteredData={filteredRecords}
        columns={columns}
        statsCards={statsCards}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        getCellContent={getCellContent}
        payPeriods={payPeriods}
        selectedPayPeriod={selectedPeriod}
        onPayPeriodChange={setSelectedPeriod}
        onProcessPayroll={handleProcessPayroll}
        onGeneratePayslips={handleGeneratePayslips}
        onExportPayroll={handleExport}
        isProcessing={isProcessing}
        isGenerating={isGenerating}
        isExporting={isExporting}
      />
    </PageLayout>
  );
}
```

### 4. TripsLayout (Trucking-Specific)

**Perfect for:**

- Trip scheduling and tracking
- Route management
- Driver assignments
- Delivery status tracking

**Features:**

- ✅ Stats cards (total trips, in progress, completed, etc.)
- ✅ Trip status badges (Scheduled, In Progress, Completed, Cancelled)
- ✅ Add trip button
- ✅ Export report button
- ✅ CSV import
- ✅ Cell click support (for trip details)
- ✅ DataTable integration

**Unique Features:**

- Status badges with color coding
- Specialized for trip/route tracking
- Click handler for viewing trip details

**Usage Example:**

```tsx
// In trucking/employees/trips/page.tsx
import { TripsLayout } from '@/components/features/trucking';

export default function TripsPage() {
  const [selectedStatus, setSelectedStatus] = useState('All');

  return (
    <PageLayout fluid withPadding>
      <TripsLayout
        data={trips}
        filteredData={filteredTrips}
        columns={columns}
        statsCards={statsCards}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        getCellContent={getCellContent}
        onCellClick={handleTripClick}
        tripStatuses={[
          'All',
          'Scheduled',
          'In Progress',
          'Completed',
          'Cancelled',
        ]}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        onAddTrip={() => setModalOpen(true)}
        onExportReport={handleExport}
        isExporting={isExporting}
      />
    </PageLayout>
  );
}
```

## 🎯 Pages Ready for Implementation

### Clothing/Employees

- [ ] **team** → Use `EmployeeManagementLayout`
- [ ] **attendance** → Use `AttendanceLayout`
- [ ] **payroll** → Use `PayrollLayout`
- [ ] **employee-loans** → Use `EmployeeManagementLayout`
- [ ] **cash-advance** → Use `EmployeeManagementLayout`
- [ ] **expenses** → Use `EmployeeManagementLayout`
- [ ] **schedules** → Use `EmployeeManagementLayout`
- [ ] **leave-tracker** → Use `EmployeeManagementLayout`
- [ ] **thirteenth-month-pay** → Use `PayrollLayout`

### Trucking/Employees

- [ ] **team** → Use `EmployeeManagementLayout`
- [ ] **attendance** → Use `AttendanceLayout`
- [ ] **payroll** → Use `PayrollLayout`
- [ ] **trips** → Use `TripsLayout` ⭐ (Trucking-specific)
- [ ] **employee-loans** → Use `EmployeeManagementLayout`
- [ ] **cash-advance** → Use `EmployeeManagementLayout`
- [ ] **expenses** → Use `EmployeeManagementLayout`
- [ ] **schedules** → Use `EmployeeManagementLayout`
- [ ] **leave-tracker** → Use `EmployeeManagementLayout`
- [ ] **thirteenth-month-pay** → Use `PayrollLayout`

## 🚀 Benefits

### 1. Future-Proof Architecture ✅

- When you build these pages, the architecture is already in place
- No need to refactor later
- Start with clean separation from day one

### 2. Consistent Patterns ✅

- All pages follow the same structure
- Easy to understand and maintain
- Predictable code organization

### 3. Flexibility ✅

- Swap grid implementations anytime
- Modify UI without touching business logic
- Add features safely

### 4. Reusable Components ✅

- Same layout for Clothing and Trucking divisions
- Specialized layouts for specific needs
- DRY (Don't Repeat Yourself) principle

## 💡 Implementation Strategy

### When You Build a New Page:

1. **Choose the Right Layout**
   - General employee data? → `EmployeeManagementLayout`
   - Attendance tracking? → `AttendanceLayout`
   - Payroll processing? → `PayrollLayout`
   - Trucking trips? → `TripsLayout`

2. **Set Up Page Component**

   ```tsx
   'use client';

   import { useState, useEffect } from 'react';
   import { PageLayout } from '@/components/layout/PageLayout';
   import { AttendanceLayout } from '@/components/features/employees';

   export default function AttendancePage() {
     // Your business logic here
     const [data, setData] = useState([]);
     // ... state, handlers, calculations ...

     return (
       <PageLayout fluid withPadding>
         <AttendanceLayout
           data={data}
           // ... pass props ...
         />
       </PageLayout>
     );
   }
   ```

3. **Focus on Business Logic**
   - Data fetching
   - Calculations
   - Validations
   - Event handlers
   - **No UI code in page.tsx!**

4. **Let Layout Handle UI**
   - Stats cards
   - Buttons
   - Filters
   - Search bars
   - All handled by layout component

## 🎨 Customization

All layouts support:

- ✅ Custom stats cards
- ✅ Custom action buttons
- ✅ CSV import
- ✅ Search functionality
- ✅ Cell editing
- ✅ Custom renderers

### Adding Custom Action Buttons

```tsx
<EmployeeManagementLayout
  // ... other props ...
  customActionButtons={
    <Group>
      <Button onClick={handleCustomAction}>Custom Action</Button>
      <Button onClick={handleAnotherAction}>Another Action</Button>
    </Group>
  }
/>
```

## 🔄 Grid Swapping

All employee/trucking layouts use DataTable, which can be swapped:

**Edit the layout component:**

```tsx
// Before: DataTable
<DataTable {...props} />

// After: AG Grid
<AgGridReact {...convertedProps} />

// Or: Any other grid
<YourGridLibrary {...props} />
```

**Business logic in page.tsx?** → **Untouched!** ✅

## 📊 Stats Cards Examples

### Team/Employee Directory

```tsx
const statsCards = [
  {
    title: 'Total Employees',
    value: employees.length,
    icon: <IconUsers />,
    color: 'blue',
  },
  {
    title: 'Active',
    value: activeEmployees.length,
    icon: <IconCheck />,
    color: 'green',
  },
  // ...
];
```

### Attendance

```tsx
const statsCards = [
  {
    title: 'Present Today',
    value: presentCount,
    icon: <IconCheck />,
    color: 'green',
  },
  {
    title: 'Late',
    value: lateCount,
    icon: <IconClock />,
    color: 'yellow',
  },
  // ...
];
```

### Payroll

```tsx
const statsCards = [
  {
    title: 'Total Payroll',
    value: `₱${totalPayroll.toLocaleString()}`,
    icon: <IconCurrencyPeso />,
    color: 'green',
  },
  {
    title: 'Employees',
    value: employeeCount,
    icon: <IconUsers />,
    color: 'blue',
  },
  // ...
];
```

## ✅ Zero Breaking Changes

- All layouts are **new components**
- No existing pages affected
- Ready to use when you build new features
- Can be adopted gradually

## 🎉 Conclusion

You now have **production-ready abstraction layers** for all future employee management and trucking pages!

**When you're ready to build:**

1. Choose the appropriate layout
2. Focus on business logic
3. Pass props to layout
4. Everything just works! ✨

**Architecture benefits:**

- ✅ Clean separation of concerns
- ✅ Swappable grid implementations
- ✅ Consistent patterns
- ✅ Future-proof design
- ✅ Reusable across divisions

---

_Start building with confidence knowing the architecture is already professional-grade!_ 🚀
