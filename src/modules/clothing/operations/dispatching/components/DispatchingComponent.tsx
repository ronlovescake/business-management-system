/**
 * Dispatching Component
 * Manage dispatching operations and tracking
 */

'use client';

import { useState, useMemo } from 'react';
import { Stack, Text, Group, Table, ActionIcon, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { showInfo } from '@/lib/alerts';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';

interface TestItem {
  id: string;
  name: string;
  category: string;
  status: string;
  quantity: number;
}

export function DispatchingComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // Sample test data
  const mockData: TestItem[] = useMemo(
    () => [
      {
        id: '1',
        name: 'Test Item Alpha',
        category: 'Electronics',
        status: 'Active',
        quantity: 25,
      },
      {
        id: '2',
        name: 'Test Item Beta',
        category: 'Clothing',
        status: 'Active',
        quantity: 50,
      },
      {
        id: '3',
        name: 'Test Item Gamma',
        category: 'Food',
        status: 'Inactive',
        quantity: 10,
      },
      {
        id: '4',
        name: 'Sample Product Delta',
        category: 'Electronics',
        status: 'Active',
        quantity: 75,
      },
      {
        id: '5',
        name: 'Sample Product Epsilon',
        category: 'Toys',
        status: 'Active',
        quantity: 100,
      },
    ],
    []
  );

  // Search filtering
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return mockData;
    }

    const query = searchQuery.toLowerCase();
    return mockData.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query) ||
        item.quantity.toString().includes(query)
      );
    });
  }, [mockData, searchQuery]);

  // CSV import handler
  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    // Simulate import delay
    setTimeout(async () => {
      setIsImporting(false);
      await showInfo(`Would import file "${file.name}"`, 'Import Simulation');
    }, 1500);
  };

  // CSV export handler
  const handleExportCSV = async () => {
    await showInfo('Would export CSV file', 'Export Simulation');
  };

  // Add new handler
  const handleAddNew = async () => {
    await showInfo('Would open form to create new item', 'Add New Simulation');
  };

  // Edit handler
  const handleEdit = async (item: TestItem) => {
    await showInfo(`Would edit item "${item.name}"`, 'Edit Simulation');
  };

  // Delete handler
  const handleDelete = async (id: string, name: string) => {
    await showInfo(
      `Would delete item "${name}" (ID: ${id})`,
      'Delete Simulation'
    );
  };

  const headers = ['NAME', 'CATEGORY', 'STATUS', 'QUANTITY', 'ACTION'];

  return (
    <Stack gap="md">
      {/* Testing StandardTableControls */}
      <StandardTableControls
        searchPlaceholder="Search test items..."
        onSearch={setSearchQuery}
        onImport={handleImportCSV}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImporting}
      />

      {/* Testing StandardTableContainer and StandardDataTable */}
      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of {mockData.length} test items
            </Text>
            <Text size="sm" c="dimmed">
              Total Quantity:{' '}
              {filteredData.reduce((sum, item) => sum + item.quantity, 0)}
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={headers}
          emptyState={
            searchQuery
              ? `No items found matching "${searchQuery}"`
              : 'No test items available. Click "Add New" to create one.'
          }
          colSpan={headers.length}
        >
          {filteredData.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td style={{ textAlign: 'center' }}>{item.name}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {item.category}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text c={item.status === 'Active' ? 'green' : 'gray'} fw={500}>
                  {item.status}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {item.quantity}
              </Table.Td>
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
                      onClick={() => handleDelete(item.id, item.name)}
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
