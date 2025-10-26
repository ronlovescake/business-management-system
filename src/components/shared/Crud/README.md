# Generic CRUD Components

Reusable, type-safe components for Create, Read, Update, Delete operations across the application.

## 📦 Components

### CrudTable

A data table with built-in search, filtering, and CRUD actions.

### CrudForm

An auto-generating form based on field configuration with validation.

### CrudModal

A modal dialog that combines CrudForm for create/edit operations.

## 🚀 Quick Start

### Example: Leave Requests CRUD

```tsx
import { useState } from 'react';
import { CrudTable, CrudModal } from '@/components/shared/Crud';
import type { CrudTableColumn, CrudFormField } from '@/components/shared/Crud';
import { IconCalendar, IconUser } from '@tabler/icons-react';

interface LeaveRequest {
  id: number;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
}

export function LeaveRequestsPage() {
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LeaveRequest | null>(null);

  // Define table columns
  const columns: CrudTableColumn<LeaveRequest>[] = [
    {
      key: 'employeeName',
      label: 'Employee',
      width: 200,
      sortable: true,
    },
    {
      key: 'leaveType',
      label: 'Leave Type',
      width: 150,
    },
    {
      key: 'startDate',
      label: 'Start Date',
      width: 150,
    },
    {
      key: 'status',
      label: 'Status',
      width: 120,
      render: (item) => (
        <Badge color={item.status === 'approved' ? 'green' : 'yellow'}>
          {item.status}
        </Badge>
      ),
    },
  ];

  // Define form fields
  const formFields: CrudFormField<LeaveRequest>[] = [
    {
      name: 'employeeName',
      label: 'Employee Name',
      type: 'text',
      required: true,
      span: 6,
    },
    {
      name: 'leaveType',
      label: 'Leave Type',
      type: 'select',
      options: ['Sick Leave', 'Vacation', 'Personal'],
      required: true,
      span: 6,
    },
    {
      name: 'startDate',
      label: 'Start Date',
      type: 'date',
      required: true,
      span: 6,
    },
    {
      name: 'endDate',
      label: 'End Date',
      type: 'date',
      required: true,
      span: 6,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: ['pending', 'approved', 'rejected'],
      required: true,
      span: 12,
    },
  ];

  // CRUD handlers
  const handleEdit = (item: LeaveRequest) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (item: LeaveRequest) => {
    if (confirm('Are you sure you want to delete this leave request?')) {
      // Call API to delete
      setData(data.filter((d) => d.id !== item.id));
    }
  };

  const handleSubmit = async (values: LeaveRequest) => {
    if (editingItem) {
      // Update existing
      setData(data.map((d) => (d.id === editingItem.id ? values : d)));
    } else {
      // Create new
      setData([...data, { ...values, id: Date.now() }]);
    }
    setIsModalOpen(false);
    setEditingItem(null);
  };

  return (
    <>
      <CrudTable
        data={data}
        columns={columns}
        searchFields={['employeeName', 'leaveType']}
        searchPlaceholder="Search by employee or leave type..."
        onEdit={handleEdit}
        onDelete={handleDelete}
        statsCards={[
          {
            title: 'Total Requests',
            value: data.length,
            icon: <IconCalendar />,
            color: 'blue',
          },
          {
            title: 'Pending',
            value: data.filter((d) => d.status === 'pending').length,
            icon: <IconUser />,
            color: 'orange',
          },
        ]}
        actionButtons={
          <Button onClick={() => setIsModalOpen(true)}>
            Create Leave Request
          </Button>
        }
      />

      <CrudModal
        opened={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Edit Leave Request' : 'Create Leave Request'}
        fields={formFields}
        initialValues={editingItem || {}}
        onSubmit={handleSubmit}
        submitLabel={editingItem ? 'Update' : 'Create'}
      />
    </>
  );
}
```

## 📖 Component Reference

### CrudTable Props

```typescript
interface CrudTableProps<T> {
  // Required
  data: T[];
  columns: CrudTableColumn<T>[];
  searchFields: (keyof T)[];

  // Optional
  searchPlaceholder?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onView?: (item: T) => void;
  customActions?: CrudTableAction<T>[];
  statsCards?: StatCard[];
  actionButtons?: ReactNode;
  enableCSVImport?: boolean;
  onCSVImport?: (file: File) => Promise<void>;
  gridHeight?: number;
  onCellClick?: (item: T) => void;
  className?: string;
}
```

### CrudForm Props

```typescript
interface CrudFormProps<T> {
  // Required
  fields: CrudFormField<T>[];
  onSubmit: (values: T) => void | Promise<void>;

  // Optional
  initialValues?: Partial<T>;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  validate?: (values: T) => Record<string, string>;
  hideActions?: boolean;
  customActions?: ReactNode;
}
```

### CrudModal Props

```typescript
interface CrudModalProps<T> extends CrudFormProps<T> {
  // Required
  opened: boolean;
  onClose: () => void;
  title: string;

  // Optional
  subtitle?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  centered?: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
}
```

## 🎨 Field Types

Supported field types in CrudForm:

- `text` - Text input
- `number` - Number input with optional min/max/step
- `textarea` - Multi-line text area
- `select` - Dropdown select with options
- `checkbox` - Checkbox
- `switch` - Toggle switch
- `date` - Date picker
- `email` - Email input with validation
- `password` - Password input
- `tel` - Telephone input
- `url` - URL input with validation

## ✨ Features

### Type Safety

All components are fully typed with TypeScript generics, providing compile-time type checking and IntelliSense support.

### Automatic Validation

Forms include built-in validation for required fields, with support for custom validation functions.

### Responsive Grid

Form fields support grid layout with configurable span (1-12 columns).

### Custom Rendering

Both table columns and form fields support custom render functions for complex UI needs.

### Search & Filter

CrudTable includes built-in search functionality across specified fields.

### CRUD Actions

Built-in support for Edit, Delete, and View actions with customizable icons and handlers.

## 🔧 Advanced Usage

### Custom Validation

```typescript
<CrudForm
  fields={fields}
  onSubmit={handleSubmit}
  validate={(values) => {
    const errors: Record<string, string> = {};
    if (values.endDate < values.startDate) {
      errors.endDate = 'End date must be after start date';
    }
    return errors;
  }}
/>
```

### Custom Field Renderer

```typescript
const fields: CrudFormField<MyType>[] = [
  {
    name: 'customField',
    label: 'Custom Field',
    type: 'text',
    render: (value, onChange) => (
      <CustomComponent value={value} onChange={onChange} />
    ),
  },
];
```

### Custom Table Actions

```typescript
<CrudTable
  data={data}
  columns={columns}
  customActions={[
    {
      icon: <IconDownload />,
      label: 'Export',
      onClick: (item) => exportItem(item),
      color: 'green',
    },
  ]}
/>
```

## 🎯 Benefits

- **DRY**: Write once, use everywhere
- **Consistency**: Uniform UI/UX across all CRUD operations
- **Type Safety**: Full TypeScript support with generics
- **Maintainability**: Centralized component logic
- **Flexibility**: Highly customizable through props and custom renders
- **Performance**: Optimized with React hooks and memoization
