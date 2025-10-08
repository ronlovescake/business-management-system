# Team Page Implementation Example

## 🎯 How to Add Abstraction Layer to Team Page

The `EmployeeManagementLayout` component is **ready**, but you need to **implement it** in your page. Here's exactly how:

## 📝 Step-by-Step Implementation

### Current State (Empty Shell)

```tsx
// src/app/clothing/employees/team/page.tsx
import { PageLayout } from '../../../../components/layout/PageLayout';

export default function Team() {
  return (
    <PageLayout title="Team">
      <div>{/* Empty shell - content will be added later */}</div>
    </PageLayout>
  );
}
```

### After Implementation (With Abstraction Layer)

```tsx
'use client';

import { useState, useMemo } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmployeeManagementLayout } from '@/components/features/employees';
import {
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconClock,
} from '@tabler/icons-react';
import type { GridColumn } from 'glide-data-grid';

interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  status: 'Active' | 'Inactive' | 'On Leave';
  hireDate: string;
  salary: number;
}

export default function TeamPage() {
  // ==========================================
  // STATE MANAGEMENT (Business Logic)
  // ==========================================
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      name: 'Juan Dela Cruz',
      position: 'Senior Developer',
      department: 'IT',
      email: 'juan@example.com',
      phone: '09123456789',
      status: 'Active',
      hireDate: '2023-01-15',
      salary: 50000,
    },
    // ... more employees
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ==========================================
  // DATA FILTERING (Business Logic)
  // ==========================================
  const filteredEmployees = useMemo(() => {
    if (!searchQuery) return employees;

    const query = searchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        emp.name.toLowerCase().includes(query) ||
        emp.position.toLowerCase().includes(query) ||
        emp.department.toLowerCase().includes(query) ||
        emp.email.toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  // ==========================================
  // STATS CALCULATION (Business Logic)
  // ==========================================
  const statsCards = useMemo(
    () => [
      {
        title: 'Total Employees',
        value: employees.length.toString(),
        icon: <IconUsers size={24} />,
        color: 'blue' as const,
      },
      {
        title: 'Active',
        value: employees.filter((e) => e.status === 'Active').length.toString(),
        icon: <IconUserCheck size={24} />,
        color: 'green' as const,
      },
      {
        title: 'On Leave',
        value: employees
          .filter((e) => e.status === 'On Leave')
          .length.toString(),
        icon: <IconClock size={24} />,
        color: 'yellow' as const,
      },
      {
        title: 'Inactive',
        value: employees
          .filter((e) => e.status === 'Inactive')
          .length.toString(),
        icon: <IconUserX size={24} />,
        color: 'red' as const,
      },
    ],
    [employees]
  );

  // ==========================================
  // GRID CONFIGURATION (Business Logic)
  // ==========================================
  const columns: GridColumn[] = [
    { id: 'name', title: 'Name', width: 200 },
    { id: 'position', title: 'Position', width: 180 },
    { id: 'department', title: 'Department', width: 150 },
    { id: 'email', title: 'Email', width: 220 },
    { id: 'phone', title: 'Phone', width: 140 },
    { id: 'status', title: 'Status', width: 120 },
    { id: 'hireDate', title: 'Hire Date', width: 140 },
    { id: 'salary', title: 'Salary', width: 140 },
  ];

  // ==========================================
  // EVENT HANDLERS (Business Logic)
  // ==========================================
  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleAddEmployee = () => {
    setIsModalOpen(true);
  };

  const getCellContent = ([col, row]: readonly [number, number]) => {
    const employee = filteredEmployees[row];
    const columnId = columns[col].id as keyof Employee;
    const value = employee[columnId];

    return {
      kind: 'text' as const,
      data: String(value ?? ''),
      displayData: String(value ?? ''),
      allowOverlay: true,
    };
  };

  const handleCellEdited = (
    [col, row]: readonly [number, number],
    newValue: { data: string }
  ) => {
    const columnId = columns[col].id as keyof Employee;
    const updatedEmployees = [...employees];
    const employeeIndex = employees.findIndex(
      (e) => e.id === filteredEmployees[row].id
    );

    if (employeeIndex !== -1) {
      updatedEmployees[employeeIndex] = {
        ...updatedEmployees[employeeIndex],
        [columnId]: newValue.data,
      };
      setEmployees(updatedEmployees);
    }
  };

  // ==========================================
  // RENDER (Uses Abstraction Layer!)
  // ==========================================
  return (
    <PageLayout fluid withPadding>
      <EmployeeManagementLayout
        // Data props
        data={employees}
        filteredData={filteredEmployees}
        columns={columns}
        // Stats props
        statsCards={statsCards}
        // Search props
        searchQuery={searchQuery}
        onSearch={handleSearch}
        // Grid props
        getCellContent={getCellContent}
        onCellEdited={handleCellEdited}
        // Action props
        onAddEmployee={handleAddEmployee}
        addButtonLabel="Add Employee"
        enableCSVImport={true}
      />

      {/* Your modals, dialogs, etc. */}
      {isModalOpen && <div>Add Employee Modal (implement your modal here)</div>}
    </PageLayout>
  );
}
```

## 🎯 Key Points

### ✅ What the Layout Handles (UI)

- Stats cards display
- Search bar UI
- "Add Employee" button
- CSV import button
- DataTable grid
- Loading states
- Layout structure

### ✅ What YOU Handle (Business Logic)

- Data fetching/state (`useState`)
- Filtering logic (`useMemo`)
- Stats calculations
- Event handlers (`handleSearch`, `handleAddEmployee`)
- Grid configuration (`columns`)
- Cell editing logic
- Modal management
- API calls (when you add them)

## 🚀 Implementation Checklist

When building the team page:

- [ ] Change `'use client'` directive (for hooks)
- [ ] Import `EmployeeManagementLayout`
- [ ] Add state management (`useState`)
- [ ] Define Employee interface
- [ ] Create sample/real data
- [ ] Implement search filtering
- [ ] Calculate stats cards
- [ ] Configure grid columns
- [ ] Add event handlers
- [ ] Implement `getCellContent`
- [ ] Implement `onCellEdited`
- [ ] Pass all props to layout
- [ ] Test functionality

## 💡 Minimal Example (Quick Start)

If you just want to see it working first:

```tsx
'use client';

import { useState } from 'react';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmployeeManagementLayout } from '@/components/features/employees';

export default function TeamPage() {
  const [employees] = useState([
    { id: '1', name: 'Test Employee', position: 'Developer' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');

  const columns = [
    { id: 'name', title: 'Name', width: 200 },
    { id: 'position', title: 'Position', width: 200 },
  ];

  const getCellContent = ([col, row]) => ({
    kind: 'text',
    data: employees[row][columns[col].id] || '',
    displayData: employees[row][columns[col].id] || '',
    allowOverlay: true,
  });

  return (
    <PageLayout fluid withPadding>
      <EmployeeManagementLayout
        data={employees}
        filteredData={employees}
        columns={columns}
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        getCellContent={getCellContent}
        onAddEmployee={() => alert('Add employee clicked!')}
      />
    </PageLayout>
  );
}
```

## 🔄 The Flow

```
1. Visit http://localhost:3000/clothing/employees/team
   ↓
2. Page component runs (your business logic)
   ↓
3. State initialized, data prepared
   ↓
4. Props passed to EmployeeManagementLayout
   ↓
5. Layout renders UI (stats, search, buttons, grid)
   ↓
6. User interacts (search, click, edit)
   ↓
7. Events trigger YOUR handlers
   ↓
8. State updates, layout re-renders
   ✓ Clean separation maintained!
```

## 📦 What's Already Ready

✅ `EmployeeManagementLayout` component (in `src/components/features/employees/`)
✅ TypeScript interfaces
✅ Proper exports
✅ Documentation

## ❌ What's NOT Automatic

❌ Data doesn't magically appear
❌ Business logic doesn't write itself
❌ Page doesn't update automatically
❌ You still need to code the implementation

## 🎯 Summary

**The abstraction layer is a TOOL, not magic.**

Think of it like:

- 🏗️ You have the **blueprint** (layout component)
- 🔨 You still need to **build the house** (implement the page)
- ✅ But the **architecture is already designed** (no UI code in page!)

**When you're ready to build:**

1. Copy the example above
2. Customize for your needs
3. Add real data (API calls, database)
4. Enjoy the clean architecture! ✨

---

**Bottom line:** The layout components make your job **easier**, but you still need to implement them. They're **ready-to-use building blocks**, not automatic features.
