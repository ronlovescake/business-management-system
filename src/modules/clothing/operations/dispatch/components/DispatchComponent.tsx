/**
 * Dispatch Component
 * Manage dispatch operations and order tracking
 */

'use client';

import { useState, useMemo, useCallback } from 'react';
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
  IconMessageCircle,
  IconLink,
  IconMapPin,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showInfo } from '@/lib/alerts';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { useDispatchCustomerLookup, usePossibleMatches } from '../hooks';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

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
  const [rawData, setRawData] = useState<RawOrderData[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [rawDataSearch, setRawDataSearch] = useState('');
  const [isImportingRawData, setIsImportingRawData] = useState(false);

  const queryClient = useQueryClient();

  // Fetch saved dispatch orders from database
  const {
    data: savedOrders,
    isLoading: loadingSavedOrders,
    error: fetchError,
  } = useQuery({
    queryKey: ['dispatch-orders'],
    queryFn: async () => {
      const response = (await apiClient.get('/api/dispatch/orders')) as {
        success: boolean;
        data: RawOrderData[];
        count: number;
      };
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
  });

  // Mutation to save orders to database
  const saveOrdersMutation = useMutation({
    mutationFn: async (orders: RawOrderData[]) => {
      const response = (await apiClient.post('/api/dispatch/orders', {
        orders,
      })) as {
        success: boolean;
        message: string;
        data: { deleted: number; created: number };
      };
      return response;
    },
    onSuccess: (response) => {
      logger.info('Orders saved to database', response.data);
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });
      showNotification({
        title: 'Success',
        message: `${response.data.created} orders saved to database (replaced ${response.data.deleted} previous orders)`,
        color: 'green',
      });
    },
    onError: (error) => {
      logger.error('Failed to save orders to database', error);
      showNotification({
        title: 'Error',
        message: 'Failed to save orders to database. Please try again.',
        color: 'red',
      });
    },
  });

  // Mutation to link customer (add Shopee username and optionally address)
  const linkCustomerMutation = useMutation({
    mutationFn: async ({
      customerId,
      username,
      deliveryAddress,
      addressScore,
    }: {
      customerId: number;
      username: string;
      deliveryAddress: string;
      addressScore: number;
    }) => {
      // Add Shopee username
      const usernameResponse = (await apiClient.post(
        `/api/customers/${customerId}/additional-info/add`,
        {
          type: 'shopee_username',
          value: username.toLowerCase().trim(),
        }
      )) as { alreadyExists: boolean; message: string };

      let addressResponse: { alreadyExists: boolean; message: string } | null =
        null;
      // If address match is 80% or below, also add the delivery address
      if (addressScore <= 80) {
        addressResponse = (await apiClient.post(
          `/api/customers/${customerId}/additional-info/add`,
          {
            type: 'address',
            value: deliveryAddress,
          }
        )) as { alreadyExists: boolean; message: string };
      }

      return {
        customerId,
        username,
        addressAdded: addressScore <= 80,
        usernameAlreadyExists: usernameResponse.alreadyExists || false,
        addressAlreadyExists: addressResponse?.alreadyExists || false,
      };
    },
    onSuccess: (data) => {
      logger.info('Customer linked successfully', data);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({
        queryKey: ['dispatch-customers-shopee'],
      });
      queryClient.invalidateQueries({
        queryKey: ['possible-match-customers-with-addresses'],
      });
      queryClient.invalidateQueries({ queryKey: ['dispatch-orders'] });

      showNotification({
        title: 'Customer Linked',
        message: data.addressAdded
          ? `Shopee username and delivery address added successfully!`
          : `Shopee username added successfully!`,
        color: 'green',
      });
    },
    onError: (error) => {
      logger.error('Failed to link customer', error);
      showNotification({
        title: 'Error',
        message: 'Failed to link customer. Please try again.',
        color: 'red',
      });
    },
  });

  // Use saved orders if available, otherwise use rawData
  const effectiveRawData =
    savedOrders && savedOrders.length > 0 ? savedOrders : rawData;

  // Customer lookup hook - always enabled to lookup Shopee usernames
  const {
    lookupCustomerName,
    lookupFacebookLink,
    lookupFacebookLinkById,
    isLoading: loadingCustomers,
  } = useDispatchCustomerLookup(true);

  // Sample test data - empty array, will use imported data from rawData
  const mockData: DispatchItem[] = useMemo(() => [], []);

  // Get unmatched orders for possible match tab
  const unmatchedOrders = useMemo(() => {
    return effectiveRawData
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
  }, [effectiveRawData, lookupCustomerName]);

  // Possible matches hook - enabled when either Dashboard or Possible Match tab is active
  const {
    getMatchesForOrder,
    stats,
    isLoading: loadingMatches,
  } = usePossibleMatches(
    unmatchedOrders,
    activeTab === 'possible-match' || activeTab === 'match'
  );

  // Helper function to extract carrier name from shipping option
  // "Standard Local-J&T Express" -> "J&T"
  const extractCarrierName = (shippingOption: string): string => {
    if (!shippingOption) {
      return '';
    }

    // Extract carrier name from format like "Standard Local-J&T Express"
    const match = shippingOption.match(/-([\w&]+)/);
    if (match && match[1]) {
      return match[1]; // Returns "J&T", "LBC", etc.
    }

    // If no match, return the original
    return shippingOption;
  };

  // Search filtering - use effectiveRawData (saved orders or imported data)
  const filteredData = useMemo(() => {
    // Transform raw data from database or XLSX import to DispatchItem format
    const dataSource: DispatchItem[] =
      effectiveRawData.length > 0
        ? effectiveRawData.map((row, index) => {
            const username = row['Username (Buyer)'] || '';
            const matchedCustomer = lookupCustomerName(username);
            const orderId = row['Order ID'] || `imported-${index}`;

            // If no direct match, check for possible matches
            let customerName = matchedCustomer || '';
            if (!matchedCustomer && activeTab === 'match') {
              const possibleMatches = getMatchesForOrder(orderId);
              if (possibleMatches && possibleMatches.length > 0) {
                // Get the highest scoring match
                const highestMatch = possibleMatches[0];
                const displayName = highestMatch.customer.businessName
                  ? `${highestMatch.customer.customerName} | ${highestMatch.customer.businessName}`
                  : highestMatch.customer.customerName;
                customerName = displayName;
              }
            }

            return {
              id: orderId,
              orderStatus: row['Order Status'] || '',
              shippingOptions: extractCarrierName(row['Shipping Option'] || ''),
              username,
              customerNames: customerName,
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
  }, [
    mockData,
    searchQuery,
    effectiveRawData,
    lookupCustomerName,
    activeTab,
    getMatchesForOrder,
  ]);

  // CSV export handler
  const handleExportCSV = async () => {
    await showInfo('Would export CSV file', 'Export Simulation');
  };

  // Add new handler
  const handleAddNew = async () => {
    await showInfo(
      'Would open form to create new dispatch order',
      'Add New Simulation'
    );
  };

  // Link customer to order handler
  const handleLinkCustomer = async (
    orderId: string,
    customerId: number,
    customerName: string,
    username: string,
    deliveryAddress: string,
    addressScore: number
  ) => {
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Link Customer?',
      html: `
        <div style="text-align: left; margin-top: 15px;">
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Shopee Username:</strong> ${username}</p>
          <p><strong>Match Score:</strong> ${addressScore.toFixed(1)}%</p>
          ${
            addressScore <= 80
              ? `<p style="color: #ff6b6b;"><strong>Note:</strong> Address will be saved (match ≤80%)</p>`
              : ''
          }
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#adb5bd',
      confirmButtonText: 'Yes, link customer',
      cancelButtonText: 'Cancel',
      allowOutsideClick: false,
    });

    if (result.isConfirmed) {
      // Call mutation to save Shopee username and optionally address
      linkCustomerMutation.mutate({
        customerId,
        username,
        deliveryAddress,
        addressScore,
      });
    }
  };

  // XLSX import handler for Raw Data tab
  const handleXlsxImport = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImportingRawData(true);
    try {
      // Validate file extension
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        throw new Error(
          'Invalid file format. Please upload an Excel file (.xlsx or .xls)'
        );
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB in bytes
      if (file.size > maxSize) {
        throw new Error(
          'File size exceeds 10MB limit. Please upload a smaller file.'
        );
      }

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      // Validate workbook has sheets
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error(
          'The Excel file appears to be empty or corrupted. No sheets found.'
        );
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Validate worksheet exists
      if (!worksheet) {
        throw new Error('Unable to read worksheet data from the Excel file.');
      }

      const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawOrderData[];

      // Validate data is not empty
      if (!jsonData || jsonData.length === 0) {
        throw new Error(
          'The Excel file contains no data rows. Please check the file and try again.'
        );
      }

      // Log imported data structure for debugging
      logger.info('XLSX import successful', {
        fileName: file.name,
        rowCount: jsonData.length,
        sheetName,
        sampleRow: jsonData[0],
      });

      // Update local state first for immediate UI feedback
      setRawData(jsonData);

      // Save to database (replaces previous data)
      await saveOrdersMutation.mutateAsync(jsonData);

      showNotification({
        title: 'Success',
        message: `Successfully imported and saved ${jsonData.length} rows from ${file.name}`,
        color: 'green',
      });
    } catch (error) {
      // Enhanced error logging
      logger.error('Failed to import XLSX file', {
        error,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Provide more specific error message
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to import XLSX file. Please ensure the file is a valid Excel file with data.';

      showNotification({
        title: 'Import Failed',
        message: errorMessage,
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsImportingRawData(false);
    }
  };

  // Copy to clipboard handler
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification({
        title: 'Copied!',
        message: `${label} copied to clipboard`,
        color: 'green',
        position: 'top-right',
        autoClose: 2000,
      });
    } catch (err) {
      showNotification({
        title: 'Failed to copy',
        message: 'Please try again',
        color: 'red',
        position: 'top-right',
        autoClose: 2000,
      });
    }
  };

  const navigateToPossibleMatchTab = useCallback(() => {
    setActiveTab('possible-match');
    window.setTimeout(() => {
      const tabElement = document.getElementById('dispatch-possible-match-tab');
      if (tabElement instanceof HTMLElement) {
        tabElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        tabElement.focus();
      }
    }, 0);
  }, [setActiveTab]);

  const headers = [
    'ORDER STATUS',
    'SHIPPING OPTIONS',
    'USERNAME (BUYER)',
    'CUSTOMER NAMES',
    'CUSTOMER MESSAGE',
    'ACTION',
  ];

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="match">Dashboard</Tabs.Tab>
          <Tabs.Tab value="possible-match" id="dispatch-possible-match-tab">
            Possible Match
          </Tabs.Tab>
          <Tabs.Tab value="raw-data">Raw Data</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="match" pt="md">
          <Stack gap="md">
            {/* Table Controls */}
            <StandardTableControls
              searchPlaceholder="Search dispatch orders..."
              onSearch={setSearchQuery}
              onImport={handleXlsxImport}
              onExport={handleExportCSV}
              onAddNew={handleAddNew}
              isImporting={isImportingRawData}
              acceptFileTypes=".xlsx,.xls"
            />

            {/* Table Container */}
            <StandardTableContainer
              summary={
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredData.length} of{' '}
                    {effectiveRawData.length > 0
                      ? effectiveRawData.length
                      : mockData.length}{' '}
                    dispatch orders
                    {savedOrders && savedOrders.length > 0 && (
                      <Text component="span" c="blue" fw={500} ml="xs">
                        (From Database)
                      </Text>
                    )}
                    {rawData.length > 0 &&
                      (!savedOrders || savedOrders.length === 0) && (
                        <Text component="span" c="orange" fw={500} ml="xs">
                          (Imported - Not Saved Yet)
                        </Text>
                      )}
                    {loadingCustomers && (
                      <Text component="span" c="grape" fw={500} ml="xs">
                        (Loading customer data...)
                      </Text>
                    )}
                    {loadingSavedOrders && (
                      <Text component="span" c="teal" fw={500} ml="xs">
                        (Loading saved orders...)
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
                {filteredData.map((item) => {
                  // Check if shipping option is NOT "J&T" to apply red background
                  const isNotJT = item.shippingOptions !== 'J&T';

                  return (
                    <Table.Tr
                      key={item.id}
                      style={{
                        backgroundColor: isNotJT
                          ? 'rgba(255, 107, 107, 0.1)'
                          : undefined,
                      }}
                    >
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
                      <Table.Td style={{ textAlign: 'left' }}>
                        {item.username}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'left' }}>
                        {item.customerNames ? (
                          <Group gap="xs">
                            <Text
                              onClick={() =>
                                copyToClipboard(
                                  item.customerNames,
                                  'Customer name'
                                )
                              }
                              style={{ cursor: 'pointer' }}
                            >
                              {item.customerNames}
                            </Text>
                            {lookupCustomerName(item.username) ? (
                              <Badge size="xs" color="green" variant="light">
                                Matched
                              </Badge>
                            ) : (
                              <Badge
                                size="xs"
                                color="orange"
                                variant="light"
                                onClick={navigateToPossibleMatchTab}
                                style={{ cursor: 'pointer' }}
                                aria-label="View possible matches"
                              >
                                Possible Match
                              </Badge>
                            )}
                          </Group>
                        ) : (
                          <Group gap="xs">
                            <Text c="dimmed" fs="italic">
                              No customer found
                            </Text>
                            <Badge size="xs" color="yellow" variant="light">
                              No Match
                            </Badge>
                          </Group>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'left' }}>
                        {item.messageCustomer}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Group gap="xs" justify="center">
                          <Tooltip
                            label={
                              lookupFacebookLink(item.username)
                                ? 'Message customer'
                                : 'No Facebook link available'
                            }
                          >
                            <ActionIcon
                              variant="light"
                              color="blue"
                              component="a"
                              href={lookupFacebookLink(item.username) || '#'}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Message customer"
                              disabled={!lookupFacebookLink(item.username)}
                              style={{
                                cursor: lookupFacebookLink(item.username)
                                  ? 'pointer'
                                  : 'not-allowed',
                                opacity: lookupFacebookLink(item.username)
                                  ? 1
                                  : 0.5,
                              }}
                            >
                              <IconMessageCircle size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
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
                  {effectiveRawData.length === 0
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
                                            <Text
                                              fw={600}
                                              onClick={() =>
                                                copyToClipboard(
                                                  match.customer.customerName,
                                                  'Customer name'
                                                )
                                              }
                                              style={{ cursor: 'pointer' }}
                                            >
                                              {index + 1}.{' '}
                                              {match.customer.customerName}
                                            </Text>
                                            <Tooltip
                                              label={
                                                lookupFacebookLinkById(
                                                  match.customer.id
                                                )
                                                  ? 'Message customer'
                                                  : 'No Facebook link available'
                                              }
                                            >
                                              <ActionIcon
                                                variant="light"
                                                color="blue"
                                                size="sm"
                                                component="a"
                                                href={
                                                  lookupFacebookLinkById(
                                                    match.customer.id
                                                  ) || '#'
                                                }
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                aria-label="Message customer"
                                                disabled={
                                                  !lookupFacebookLinkById(
                                                    match.customer.id
                                                  )
                                                }
                                                style={{
                                                  cursor:
                                                    lookupFacebookLinkById(
                                                      match.customer.id
                                                    )
                                                      ? 'pointer'
                                                      : 'not-allowed',
                                                  opacity:
                                                    lookupFacebookLinkById(
                                                      match.customer.id
                                                    )
                                                      ? 1
                                                      : 0.5,
                                                }}
                                              >
                                                <IconMessageCircle size={16} />
                                              </ActionIcon>
                                            </Tooltip>
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
                                          match.customer.customerName,
                                          order.username,
                                          order.deliveryAddress,
                                          match.addressScore
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
              onExport={async () => {
                await showInfo('Would export raw data', 'Export Simulation');
              }}
              onAddNew={async () => {
                await showInfo(
                  'Would add new raw data entry',
                  'Add New Simulation'
                );
              }}
              isImporting={isImportingRawData}
              acceptFileTypes=".xlsx,.xls"
            />

            {effectiveRawData.length > 0 && (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" fw={500}>
                    {savedOrders && savedOrders.length > 0
                      ? `Saved Data from Database (${effectiveRawData.length} rows)`
                      : `Imported Data Preview (${effectiveRawData.length} rows - Not saved yet)`}
                  </Text>
                  {savedOrders && savedOrders.length > 0 && (
                    <Badge color="blue" variant="light">
                      From Database
                    </Badge>
                  )}
                  {fetchError && (
                    <Badge color="red" variant="light">
                      Error loading from database
                    </Badge>
                  )}
                </Group>
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
                    {JSON.stringify(effectiveRawData, null, 2)}
                  </pre>
                </div>
              </Stack>
            )}

            {effectiveRawData.length === 0 && (
              <Card withBorder padding="xl">
                <Text ta="center" c="dimmed" size="lg">
                  {loadingSavedOrders
                    ? 'Loading saved orders from database...'
                    : 'No data available. Click Import to upload an XLSX file.'}
                </Text>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
