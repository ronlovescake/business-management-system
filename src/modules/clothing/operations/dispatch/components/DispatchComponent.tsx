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
  Badge,
  Card,
  Button,
  Progress,
  Accordion,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconLink,
  IconMapPin,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { useDispatchCustomerLookup, usePossibleMatches } from '../hooks';

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

  // Customer lookup hook
  const { lookupCustomerName, isLoading: loadingCustomers } =
    useDispatchCustomerLookup();

  // Sample test data - empty array, will use imported data from rawData
  const mockData: DispatchItem[] = useMemo(() => [], []);

  // Get unmatched orders for possible match tab
  const unmatchedOrders = useMemo(() => {
    return rawData
      .filter((row) => {
        const username = row['Username (Buyer)'] || '';
        const matchedCustomer = lookupCustomerName(username);
        return !matchedCustomer; // No match found
      })
      .map((row) => ({
        orderId: String(row['Order ID'] || ''),
        username: String(row['Username (Buyer)'] || ''),
        deliveryAddress: String(row['Delivery Address'] || ''),
        receiverName: String(row['Receiver Name'] || ''),
        phoneNumber: String(row['Phone Number'] || ''),
        city: String(row['City'] || ''),
        province: String(row['Province'] || ''),
        zipCode: String(row['Zip Code'] || ''),
      }));
  }, [rawData, lookupCustomerName]);

  // Possible matches hook
  const {
    getMatchesForOrder,
    stats,
    isLoading: loadingMatches,
  } = usePossibleMatches(unmatchedOrders);

  // Search filtering - use rawData if available, otherwise use mockData
  const filteredData = useMemo(() => {
    // Transform raw data from XLSX import to DispatchItem format
    const dataSource: DispatchItem[] =
      rawData.length > 0
        ? rawData.map((row, index) => {
            const username = row['Username (Buyer)'] || '';
            const matchedCustomer = lookupCustomerName(username);

            return {
              id: row['Order ID'] || `imported-${index}`,
              orderStatus: row['Order Status'] || '',
              shippingOptions: row['Shipping Option'] || '',
              username,
              customerNames: matchedCustomer || '', // Leave blank if no match
              messageCustomer: row['Remark from buyer'] || '',
            };
          })
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
  }, [mockData, searchQuery, rawData, lookupCustomerName]);

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

  // Link customer to order handler
  const handleLinkCustomer = (
    orderId: string,
    customerId: number,
    customerName: string
  ) => {
    // TODO: Implement actual linking logic (save to database or state)
    notifications.show({
      title: 'Customer Linked',
      message: `Order ${orderId} has been linked to ${customerName}`,
      color: 'green',
    });
    // In a real implementation, you would:
    // 1. Save the link to additional customer info (shopee username)
    // 2. Refresh the data
    // 3. Remove from unmatched list
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
                    {loadingCustomers && (
                      <Text component="span" c="orange" fw={500} ml="xs">
                        (Loading customer data...)
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
                      {item.customerNames ? (
                        <Group gap="xs" justify="center">
                          <Text>{item.customerNames}</Text>
                          {lookupCustomerName(item.username) && (
                            <Badge size="xs" color="green" variant="light">
                              Matched
                            </Badge>
                          )}
                        </Group>
                      ) : (
                        <Group gap="xs" justify="center">
                          <Text c="dimmed" fs="italic">
                            No customer found
                          </Text>
                          <Badge size="xs" color="yellow" variant="light">
                            No Match
                          </Badge>
                        </Group>
                      )}
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
            {/* Stats Card */}
            <Card withBorder padding="lg">
              <Stack gap="sm">
                <Text size="lg" fw={600}>
                  Possible Matches Overview
                </Text>
                <Group gap="xl">
                  <div>
                    <Text size="xs" c="dimmed">
                      Unmatched Orders
                    </Text>
                    <Text size="xl" fw={700} c="orange">
                      {stats.totalUnmatchedOrders}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      With Possible Matches
                    </Text>
                    <Text size="xl" fw={700} c="blue">
                      {stats.ordersWithPossibleMatches}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Without Matches
                    </Text>
                    <Text size="xl" fw={700} c="red">
                      {stats.ordersWithoutMatches}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Avg Matches/Order
                    </Text>
                    <Text size="xl" fw={700} c="teal">
                      {stats.averageMatchesPerOrder}
                    </Text>
                  </div>
                </Group>
                {loadingMatches && (
                  <Progress value={100} animated color="blue" size="sm" />
                )}
              </Stack>
            </Card>

            {/* Unmatched Orders List */}
            {unmatchedOrders.length === 0 ? (
              <Card withBorder padding="xl">
                <Text ta="center" c="dimmed" size="lg">
                  {rawData.length === 0
                    ? 'No data imported yet. Go to Raw Data tab to import orders.'
                    : 'All orders have been matched! 🎉'}
                </Text>
              </Card>
            ) : (
              <Accordion variant="separated">
                {unmatchedOrders.map((order) => {
                  const matches = getMatchesForOrder(order.orderId);

                  return (
                    <Accordion.Item key={order.orderId} value={order.orderId}>
                      <Accordion.Control>
                        <Group justify="space-between">
                          <div>
                            <Text fw={600}>{order.username}</Text>
                            <Text size="sm" c="dimmed">
                              Order: {order.orderId}
                            </Text>
                          </div>
                          <Badge
                            color={matches.length > 0 ? 'blue' : 'gray'}
                            variant="light"
                          >
                            {matches.length} possible match
                            {matches.length !== 1 ? 'es' : ''}
                          </Badge>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="md">
                          {/* Order Details */}
                          <Card withBorder padding="md" bg="gray.0">
                            <Stack gap="xs">
                              <Group gap="xs">
                                <IconMapPin size={16} />
                                <Text size="sm" fw={500}>
                                  Delivery Address:
                                </Text>
                              </Group>
                              <Text size="sm" pl="md">
                                {order.deliveryAddress}
                              </Text>

                              <Group gap="md" mt="xs">
                                <Group gap="xs">
                                  <IconPhone size={16} />
                                  <Text size="sm">{order.phoneNumber}</Text>
                                </Group>
                                <Group gap="xs">
                                  <IconUser size={16} />
                                  <Text size="sm">{order.receiverName}</Text>
                                </Group>
                              </Group>
                            </Stack>
                          </Card>

                          {/* Possible Matches */}
                          {matches.length === 0 ? (
                            <Text c="dimmed" ta="center" py="md">
                              No possible matches found for this order.
                            </Text>
                          ) : (
                            <Stack gap="sm">
                              <Text size="sm" fw={600} c="dimmed">
                                POSSIBLE MATCHES (Top {matches.length})
                              </Text>
                              {matches.map((match, index) => (
                                <Card
                                  key={match.customer.id}
                                  withBorder
                                  padding="md"
                                  style={{
                                    borderLeft: `4px solid ${
                                      match.similarityScore >= 80
                                        ? 'var(--mantine-color-green-6)'
                                        : match.similarityScore >= 60
                                          ? 'var(--mantine-color-blue-6)'
                                          : 'var(--mantine-color-yellow-6)'
                                    }`,
                                  }}
                                >
                                  <Group
                                    justify="space-between"
                                    align="flex-start"
                                  >
                                    <Stack gap="xs" style={{ flex: 1 }}>
                                      <Group justify="space-between">
                                        <div>
                                          <Group gap="xs">
                                            <Text fw={600}>
                                              {index + 1}.{' '}
                                              {match.customer.customerName}
                                            </Text>
                                            {match.customer.businessName && (
                                              <Badge
                                                variant="light"
                                                color="teal"
                                              >
                                                {match.customer.businessName}
                                              </Badge>
                                            )}
                                          </Group>
                                        </div>
                                        <Badge
                                          size="lg"
                                          color={
                                            match.similarityScore >= 80
                                              ? 'green'
                                              : match.similarityScore >= 60
                                                ? 'blue'
                                                : 'yellow'
                                          }
                                        >
                                          {match.similarityScore}% Match
                                        </Badge>
                                      </Group>

                                      <Text size="sm" c="dimmed">
                                        {match.details}
                                      </Text>

                                      <Stack gap={4} mt="xs">
                                        <Group gap="xs">
                                          <IconMapPin size={14} />
                                          <Text
                                            size="xs"
                                            c="dimmed"
                                            style={{ flex: 1 }}
                                          >
                                            {match.customer.address}
                                          </Text>
                                        </Group>
                                        {match.customer.phoneNumber && (
                                          <Group gap="xs">
                                            <IconPhone size={14} />
                                            <Text size="xs" c="dimmed">
                                              {match.customer.phoneNumber}
                                            </Text>
                                          </Group>
                                        )}
                                      </Stack>

                                      <Group gap="xs" mt="sm">
                                        <Progress
                                          value={match.addressScore}
                                          size="sm"
                                          color="blue"
                                          style={{ flex: 1 }}
                                        />
                                        <Text
                                          size="xs"
                                          c="dimmed"
                                          style={{ minWidth: '100px' }}
                                        >
                                          Address: {match.addressScore}%
                                        </Text>
                                      </Group>
                                    </Stack>

                                    <Button
                                      leftSection={<IconLink size={16} />}
                                      variant="light"
                                      color="green"
                                      onClick={() =>
                                        handleLinkCustomer(
                                          order.orderId,
                                          match.customer.id,
                                          match.customer.customerName
                                        )
                                      }
                                    >
                                      Link Customer
                                    </Button>
                                  </Group>
                                </Card>
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            )}
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
