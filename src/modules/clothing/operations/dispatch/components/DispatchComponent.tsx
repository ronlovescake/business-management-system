/**
 * Dispatch Component
 * Manage dispatch operations and order tracking
 */

'use client';

import { useState, useMemo } from 'react';
import {
  Stack,
  Text,
  Group,
  Table,
  ActionIcon,
  Tooltip,
  Tabs,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';

interface DispatchItem {
  id: string;
  orderStatus: string;
  shippingOptions: string;
  username: string;
  customerNames: string;
  messageCustomer: string;
}

interface RawOrderData {
  'Order ID'?: string;
  'Order Status'?: string;
  'Shipping Option'?: string;
  'Username (Buyer)'?: string;
  'Receiver Name'?: string;
  'Remark from buyer'?: string;
  [key: string]: unknown; // Allow other fields
}

export function DispatchComponent() {
  const [activeTab, setActiveTab] = useState<string | null>('match');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [rawData, setRawData] = useState<RawOrderData[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rawDataSearch, setRawDataSearch] = useState('');
  const [isImportingRawData, setIsImportingRawData] = useState(false);

  // Sample test data - empty array, will use imported data from rawData
  const mockData: DispatchItem[] = useMemo(() => [], []);

  // Search filtering - use rawData if available, otherwise use mockData
  const filteredData = useMemo(() => {
    // Transform raw data from XLSX import to DispatchItem format
    const dataSource: DispatchItem[] =
      rawData.length > 0
        ? rawData.map((row, index) => ({
            id: row['Order ID'] || `imported-${index}`,
            orderStatus: row['Order Status'] || '',
            shippingOptions: row['Shipping Option'] || '',
            username: row['Username (Buyer)'] || '',
            customerNames: row['Receiver Name'] || '',
            messageCustomer: row['Remark from buyer'] || '',
          }))
        : mockData;

    if (!searchQuery.trim()) {
      return dataSource;
    }

    const query = searchQuery.toLowerCase();
    return dataSource.filter((item) => {
      return (
        item.orderStatus.toLowerCase().includes(query) ||
        item.shippingOptions.toLowerCase().includes(query) ||
        item.username.toLowerCase().includes(query) ||
        item.customerNames.toLowerCase().includes(query) ||
        item.messageCustomer.toLowerCase().includes(query)
      );
    });
  }, [mockData, searchQuery, rawData]);

  // CSV import handler
  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    // Simulate import delay
    setTimeout(() => {
      setIsImporting(false);
      alert(`Import simulation: Would import file "${file.name}"`);
    }, 1500);
  };

  // CSV export handler
  const handleExportCSV = () => {
    alert('Export simulation: Would export CSV file');
  };

  // Add new handler
  const handleAddNew = () => {
    alert('Add New simulation: Would open form to create new dispatch order');
  };

  // Edit handler
  const handleEdit = (item: DispatchItem) => {
    alert(`Edit simulation: Would edit order for "${item.customerNames}"`);
  };

  // Delete handler
  const handleDelete = (id: string, customerName: string) => {
    alert(
      `Delete simulation: Would delete order for "${customerName}" (ID: ${id})`
    );
  };

  // XLSX import handler for Raw Data tab
  const handleXlsxImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImportingRawData(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawOrderData[];

      setRawData(jsonData);
      notifications.show({
        title: 'Success',
        message: `Successfully imported ${jsonData.length} rows from ${file.name}`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to import XLSX file. Please check the file format.',
        color: 'red',
      });
    } finally {
      setIsImportingRawData(false);
    }
  };

  const headers = [
    'ORDER STATUS',
    'SHIPPING OPTIONS',
    'USERNAME (BUYER)',
    'CUSTOMER NAMES',
    'MESSAGE CUSTOMER',
    'ACTION',
  ];

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="match">Dashboard</Tabs.Tab>
          <Tabs.Tab value="possible-match">Possible Match</Tabs.Tab>
          <Tabs.Tab value="raw-data">Raw Data</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="match" pt="md">
          <Stack gap="md">
            {/* Table Controls */}
            <StandardTableControls
              searchPlaceholder="Search dispatch orders..."
              onSearch={setSearchQuery}
              onImport={handleImportCSV}
              onExport={handleExportCSV}
              onAddNew={handleAddNew}
              isImporting={isImporting}
            />

            {/* Table Container */}
            <StandardTableContainer
              summary={
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredData.length} of{' '}
                    {rawData.length > 0 ? rawData.length : mockData.length}{' '}
                    dispatch orders
                    {rawData.length > 0 && (
                      <Text component="span" c="blue" fw={500} ml="xs">
                        (Imported from XLSX)
                      </Text>
                    )}
                  </Text>
                </Group>
              }
            >
              <StandardDataTable
                headers={headers}
                emptyState={
                  searchQuery
                    ? `No orders found matching "${searchQuery}"`
                    : rawData.length > 0
                      ? 'No imported orders to display.'
                      : 'No dispatch orders available. Import XLSX file from Raw Data tab or click "Add New" to create one.'
                }
                colSpan={headers.length}
              >
                {filteredData.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text
                        c={
                          item.orderStatus === 'Shipped'
                            ? 'green'
                            : item.orderStatus === 'Processing'
                              ? 'blue'
                              : 'orange'
                        }
                        fw={500}
                      >
                        {item.orderStatus}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {item.shippingOptions}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {item.username}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {item.customerNames}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {item.messageCustomer}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit order">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => handleEdit(item)}
                            aria-label="Edit order"
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete order">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() =>
                              handleDelete(item.id, item.customerNames)
                            }
                            aria-label="Delete order"
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
        </Tabs.Panel>

        <Tabs.Panel value="possible-match" pt="md">
          <Stack gap="md">
            <Text size="lg" fw={500}>
              Possible Match Content
            </Text>
            <Text c="dimmed">Content for Possible Match tab will go here.</Text>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="raw-data" pt="md">
          <Stack gap="md">
            {/* Table Controls for Raw Data */}
            <StandardTableControls
              searchPlaceholder="Search raw data..."
              onSearch={setRawDataSearch}
              onImport={handleXlsxImport}
              onExport={() => {
                alert('Export simulation: Would export raw data');
              }}
              onAddNew={() => {
                alert('Add New simulation: Would add new raw data entry');
              }}
              isImporting={isImportingRawData}
              acceptFileTypes=".xlsx,.xls"
            />

            {rawData.length > 0 && (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Imported Data Preview ({rawData.length} rows)
                </Text>
                <div
                  style={{
                    maxHeight: '86vh',
                    overflow: 'auto',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    padding: '12px',
                  }}
                >
                  <pre
                    style={{
                      fontSize: '12px',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {JSON.stringify(rawData, null, 2)}
                  </pre>
                </div>
              </Stack>
            )}

            {rawData.length === 0 && (
              <Text c="dimmed" ta="center" py="xl">
                No data imported yet. Click Import to upload an XLSX file.
              </Text>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
