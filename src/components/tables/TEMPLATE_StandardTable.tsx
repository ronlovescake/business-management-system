/**
 * TEMPLATE: Standard Data Table Component
 *
 * This is a template file showing how to create a new module using the reusable
 * StandardDataTable, StandardTableControls, and StandardTableContainer components.
 *
 * FEATURES INCLUDED:
 * - Auto-expanding search bar
 * - Import button (CSV) with loading state
 * - Export button (CSV)
 * - Add New button
 * - Standard table height (71vh) and styling
 * - Gray header background (#f1f3f5)
 * - Responsive layout
 * - All buttons are blue with white font
 *
 * HOW TO USE THIS TEMPLATE:
 * 1. Copy this entire file
 * 2. Rename it to match your module (e.g., YourModuleComponent.tsx)
 * 3. Replace 'YourModule' with your actual module name throughout
 * 4. Update the interface fields to match your data structure
 * 5. Update table headers array
 * 6. Implement the handler functions (import, export, add, delete, edit)
 * 7. Replace mockData with real data fetching
 */

'use client';

import { useState, useMemo } from 'react';
import { Stack, Text, Group, Table, ActionIcon, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';

// STEP 1: Define your data interface
interface YourModuleData {
  id: string;
  // Add your fields here
  field1: string;
  field2: string;
  field3: string;
  // ... more fields as needed
}

export function YourModuleComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // STEP 2: Define your data (replace with real data fetching)
  const mockData: YourModuleData[] = useMemo(
    () => [
      // Empty array or sample data
      // Example:
      // {
      //   id: '1',
      //   field1: 'Value 1',
      //   field2: 'Value 2',
      //   field3: 'Value 3',
      // },
    ],
    []
  );

  // STEP 3: Implement search filtering
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return mockData;
    }

    const query = searchQuery.toLowerCase();
    return mockData.filter((item) => {
      // Add all fields you want to search through
      return (
        item.field1.toLowerCase().includes(query) ||
        item.field2.toLowerCase().includes(query) ||
        item.field3.toLowerCase().includes(query)
        // ... add more fields as needed
      );
    });
  }, [mockData, searchQuery]);

  // STEP 4: Implement CSV import handler
  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    // TODO: Implement actual CSV import logic
    // Example:
    // - Parse CSV file
    // - Validate data
    // - Update state or send to API
    // - Show success/error notification

    // Simulate import delay (remove in production)
    setTimeout(() => {
      setIsImporting(false);
    }, 1500);
  };

  // STEP 5: Implement CSV export handler
  const handleExportCSV = () => {
    // TODO: Implement actual CSV export logic
    // Example:
    // - Convert filteredData to CSV format
    // - Create download link
    // - Trigger download
  };

  // STEP 6: Implement add new handler
  const handleAddNew = () => {
    // TODO: Implement add new functionality
    // Example:
    // - Open modal/form
    // - Collect user input
    // - Validate data
    // - Add to database
    // - Refresh data
  };

  // STEP 7: Implement edit handler
  const handleEdit = (_item: YourModuleData) => {
    // TODO: Implement edit functionality
    // Example:
    // - Open modal/form with existing data
    // - Allow user to modify
    // - Validate changes
    // - Update database
    // - Refresh data
  };

  // STEP 8: Implement delete handler
  const handleDelete = (_id: string) => {
    // TODO: Implement delete functionality
    // Example:
    // - Show confirmation dialog
    // - Delete from database
    // - Refresh data
    // - Show success notification
  };

  // STEP 9: Define table headers (update to match your data)
  const headers = [
    'FIELD 1',
    'FIELD 2',
    'FIELD 3',
    // ... add more headers as needed
    'ACTION',
  ];

  return (
    <Stack gap="md">
      {/* Standard Controls: Search + Action Buttons */}
      <StandardTableControls
        searchPlaceholder="Search your module..." // Update placeholder text
        onSearch={setSearchQuery}
        onImport={handleImportCSV}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImporting}
        // Optional: Hide specific buttons if not needed
        // hideImport={true}
        // hideExport={true}
        // hideAddNew={true}
        // hideSearch={true}
      />

      {/* Standard Table with Container */}
      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of {mockData.length} items
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={headers}
          emptyState={
            searchQuery
              ? `No items found matching "${searchQuery}"`
              : 'No items available. Click "Add New" to create one.'
          }
          colSpan={headers.length}
        >
          {filteredData.map((item) => (
            <Table.Tr key={item.id}>
              {/* STEP 10: Add table cells for each field */}
              <Table.Td style={{ textAlign: 'center' }}>{item.field1}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{item.field2}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{item.field3}</Table.Td>
              {/* ... add more cells as needed */}

              {/* Action buttons column */}
              <Table.Td style={{ textAlign: 'center' }}>
                <Group gap="xs" justify="center">
                  <Tooltip label="Edit item">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => handleEdit(item)}
                      aria-label="Edit item"
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete item">
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(item.id)}
                      aria-label="Delete item"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}

/**
 * SUMMARY OF WHAT YOU GET:
 *
 * ✅ Auto-expanding search bar that fills available space
 * ✅ Import button (blue) with CSV file selection and loading state
 * ✅ Export button (blue) for CSV export
 * ✅ Add New button (blue) for creating new items
 * ✅ Standard table height (71vh) with vertical scrolling
 * ✅ Gray header background (#f1f3f5) with centered text
 * ✅ Responsive layout that wraps buttons on small screens
 * ✅ All buttons are blue with white text for consistency
 * ✅ Edit and Delete actions for each row
 * ✅ Empty state messages (different for search vs no data)
 * ✅ Summary showing "X of Y items" when filtering
 * ✅ Hover effects on table rows
 * ✅ Border styling and consistent spacing
 *
 * OPTIONAL CUSTOMIZATIONS:
 *
 * - Hide buttons you don't need with hide* props
 * - Change table height with height prop on StandardDataTable
 * - Customize search placeholder text
 * - Add more action buttons in the ACTION column
 * - Add custom summary content in StandardTableContainer
 * - Modify filtering logic to include/exclude specific fields
 * - Add sorting, pagination, or other advanced features as needed
 */
