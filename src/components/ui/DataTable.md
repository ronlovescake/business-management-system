# DataTable Template - Usage Guide

This is the standardized DataTable component based on your Products page formatting. It provides:

- ✅ **Consistent 20px font size** throughout the table
- ✅ **Centered, bold headers** with perfect alignment  
- ✅ **83vh height** by default (customizable)
- ✅ **Search bar positioned on the left** with Ctrl+F support
- ✅ **Pagination counter at the bottom** 
- ✅ **Professional color scheme** matching your preferred style
- ✅ **Optional stats cards** at the top
- ✅ **CSV import functionality** (optional)
- ✅ **Action buttons** (customizable)

## Basic Usage

```tsx
import { DataTable, StatCard } from '../../../components/ui/DataTable';
import { useDataTable } from '../../../hooks/useDataTable';
import { GridColumn } from '@glideapps/glide-data-grid';
import { IconUser, IconMail } from '@tabler/icons-react';

interface YourDataType {
  id: number;
  name: string;
  email: string;
  status: string;
}

export default function YourPage() {
  const [data, setData] = useState<YourDataType[]>([]);
  
  // Define columns
  const columns: GridColumn[] = [
    { title: 'Name', width: 200, id: 'name' },
    { title: 'Email', width: 250, id: 'email' },
    { title: 'Status', width: 150, id: 'status' },
  ];

  // Map column IDs to data keys
  const idToKey: Record<string, keyof YourDataType> = {
    name: 'name',
    email: 'email', 
    status: 'status',
  };

  // Use the data table hook
  const {
    searchQuery,
    filteredData,
    handleSearch,
    getCellContent,
    stats
  } = useDataTable({
    data,
    searchFields: ['name', 'email', 'status'],
  });

  // Create cell content getter
  const cellContentGetter = (cell: Item) => 
    getCellContent(cell, columns, idToKey);

  // Define stats cards (optional)
  const statsCards: StatCard[] = [
    {
      title: 'Total Users',
      value: stats.total,
      icon: <IconUser size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Active Users', 
      value: data.filter(u => u.status === 'active').length,
      icon: <IconMail size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
  ];

  return (
    <PageLayout fluid withPadding>
      <DataTable
        data={data}
        filteredData={filteredData}
        columns={columns}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchPlaceholder="Search users by name, email, or status..."
        getCellContent={cellContentGetter}
        statsCards={statsCards}
        footerLeft={`Showing ${filteredData.length} of ${data.length} users`}
        actionButtons={
          <Button leftSection={<IconPlus size={16} />} color="green">
            Add User
          </Button>
        }
      />
    </PageLayout>
  );
}
```

## Advanced Usage with CSV Import

```tsx
const [csvFile, setCsvFile] = useState<File | null>(null);

const handleCSVImport = async (file: File) => {
  // Your CSV import logic here
  const text = await file.text();
  // Parse and process CSV...
  
  notifications.show({
    title: '🎉 Import Successful!',
    message: `Successfully imported data`,
    color: 'green',
  });
};

return (
  <DataTable
    // ... other props
    enableCSVImport={true}
    csvFile={csvFile}
    onFileChange={setCsvFile}
    onCSVImport={handleCSVImport}
  />
);
```

## Customization Options

### StatCard Interface
```tsx
interface StatCard {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  backgroundColor?: string; // Will use color if not specified
}
```

### DataTable Props
```tsx
interface DataTableProps<T> {
  // Required
  data: T[];
  filteredData: T[];
  columns: GridColumn[];
  searchQuery: string;
  onSearch: (query: string) => void;
  getCellContent: (cell: Item) => any;
  
  // Optional customization
  statsCards?: StatCard[];
  searchPlaceholder?: string;
  enableCtrlF?: boolean;
  enableCSVImport?: boolean;
  csvFile?: File | null;
  onFileChange?: (file: File | null) => void;
  onCSVImport?: (file: File) => Promise<void>;
  actionButtons?: React.ReactNode;
  onCellClick?: (cell: Item, data: T) => void;
  showFooter?: boolean;
  footerLeft?: string;
  footerRight?: string;
  gridHeight?: number; // Defaults to 83vh
  enableClickableCursor?: boolean;
  className?: string;
}
```

## Pre-configured Colors for Stats Cards

Use these exact colors to match your Products page theme:

```tsx
const statsCards: StatCard[] = [
  {
    title: 'Primary Metric',
    value: 123,
    icon: <IconCurrencyDollar size={18} />,
    color: 'blue',
    backgroundColor: 'var(--mantine-color-blue-6)',
  },
  {
    title: 'Success Metric',
    value: 456,
    icon: <IconTrendingUp size={18} />,
    color: 'green', 
    backgroundColor: 'var(--mantine-color-green-6)',
  },
  {
    title: 'Warning Metric',
    value: 789,
    icon: <IconAdjustments size={18} />,
    color: 'orange',
    backgroundColor: '#fd7e14', // Orange
  },
  {
    title: 'Info Metric',
    value: 101,
    icon: <IconTrendingUp size={18} />,
    color: 'purple',
    backgroundColor: '#9775fa', // Purple
  },
];
```

## Features Included

✅ **Responsive Design**: Adapts to different screen sizes
✅ **Keyboard Shortcuts**: Ctrl+F focuses the search bar
✅ **Professional Typography**: Inter font family, optimized sizes
✅ **Smooth Scrolling**: Horizontal and vertical smooth scrolling
✅ **Row Markers**: Numbered rows on the left
✅ **Hover Effects**: Subtle hover states on headers
✅ **Loading States**: Built-in loading spinner during SSR
✅ **Error Handling**: Graceful error handling for imports
✅ **Accessibility**: Proper ARIA labels and keyboard navigation

This template ensures all your future tables will have the exact same professional look and behavior as your Products page!