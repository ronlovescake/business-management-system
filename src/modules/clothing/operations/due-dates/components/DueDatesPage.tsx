/**
 * Due Dates Page Component
 *
 * Shows customers with unpaid invoices grouped by customer.
 * Double-click customer to see all their orders.
 *
 * ✅ Updated to use StandardDataTable components!
 */

'use client';

import { useMemo, useState, useCallback, memo } from 'react';
import {
  Stack,
  Text,
  Group,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconPhone,
  IconMail,
  IconMessageCircle,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { useDueDateData } from '../hooks/useDueDateData';
import { DueDateService } from '../services/DueDateService';
import type { DueDateItem } from '../types/dueDate.types';
import { api } from '@/lib/api/client';

// Transaction type (same as in DueDateService)
interface Transaction {
  'Invoice Date': string;
  'Line Total': number;
  'Order Status': string;
  Customers: string;
  'Product Code'?: string;
  Quantity?: number;
  'Unit Price'?: number;
  'Order Date'?: string;
  Notes?: string;
}

// Memoized table row component for performance
const DueDateRow = memo(
  ({
    item,
    onToggleExpand,
    isExpanded,
    facebookLink,
    customerOrders,
  }: {
    item: DueDateItem;
    onToggleExpand: (customer: string) => void;
    isExpanded: boolean;
    facebookLink: string;
    customerOrders: Transaction[];
  }) => {
    return (
      <>
        <Table.Tr style={{ cursor: 'pointer' }}>
          <Table.Td
            onClick={() => onToggleExpand(item.customer)}
            style={{ textAlign: 'left' }}
          >
            <Group gap="xs">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(item.customer);
                }}
              >
                {isExpanded ? (
                  <IconChevronDown size={16} />
                ) : (
                  <IconChevronRight size={16} />
                )}
              </ActionIcon>
              <Text fw={500} size="sm" c="#495057">
                {item.customer}
              </Text>
            </Group>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Badge variant="light" color="gray">
              {customerOrders.length}{' '}
              {customerOrders.length === 1 ? 'item' : 'items'}
            </Badge>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Text fw={600} size="sm" c="#495057">
              {DueDateService.formatCurrency(item.lineTotal)}
            </Text>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Text size="sm" c="#495057">
              {DueDateService.formatDate(item.invoiceDate)}
            </Text>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Text size="sm" c="#495057">
              {item.dueDate ? DueDateService.formatDate(item.dueDate) : 'N/A'}
            </Text>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Badge
              color={
                item.dueIn < 0 ? 'red' : item.dueIn <= 168 ? 'orange' : 'green'
              }
              variant="light"
            >
              {item.dueIn === 0
                ? 'Due now'
                : `${Math.abs(item.dueIn)} ${Math.abs(item.dueIn) === 1 ? 'hour' : 'hours'}`}
            </Badge>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Text size="sm" c="dimmed" lineClamp={1}>
              {customerOrders[0]?.Notes || '-'}
            </Text>
          </Table.Td>
          <Table.Td style={{ textAlign: 'center' }}>
            <Group gap="xs" justify="center">
              <Tooltip
                label={facebookLink ? 'Message customer' : 'No Facebook link'}
              >
                <ActionIcon
                  variant="light"
                  color="blue"
                  component="a"
                  href={facebookLink || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message customer"
                  disabled={!facebookLink}
                  style={{
                    cursor: facebookLink ? 'pointer' : 'not-allowed',
                    opacity: facebookLink ? 1 : 0.5,
                  }}
                >
                  <IconMessageCircle size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Email (Coming Soon)">
                <ActionIcon variant="light" color="gray" disabled>
                  <IconMail size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Call (Coming Soon)">
                <ActionIcon variant="light" color="gray" disabled>
                  <IconPhone size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Table.Td>
        </Table.Tr>

        {/* Expanded row showing customer orders */}
        {isExpanded && (
          <Table.Tr>
            <Table.Td
              colSpan={8}
              style={{ backgroundColor: '#f8f9fa', padding: 0 }}
            >
              <Stack gap="xs" p="md">
                {customerOrders.length === 0 ? (
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No orders found for this customer
                  </Text>
                ) : (
                  <Table
                    striped
                    highlightOnHover
                    withTableBorder
                    style={{ tableLayout: 'fixed', width: '100%' }}
                  >
                    <colgroup>
                      <col style={{ width: '12.5%' }} /> {/* Customer spacer */}
                      <col style={{ width: '12.5%' }} /> {/* Product Code */}
                      <col style={{ width: '10%' }} /> {/* Order Date */}
                      <col style={{ width: '10%' }} /> {/* Quantity */}
                      <col style={{ width: '10%' }} /> {/* Unit Price */}
                      <col style={{ width: '12.5%' }} /> {/* Line Total */}
                      <col style={{ width: '12.5%' }} /> {/* Invoice Date */}
                      <col style={{ width: '12.5%' }} /> {/* Due Date */}
                      <col style={{ width: '12.5%' }} /> {/* Due In */}
                    </colgroup>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ textAlign: 'center' }}>
                          {/* Empty spacer for Customer column */}
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Product Code
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Order Date
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Quantity
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Unit Price
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Line Total
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Invoice Date
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Due Date
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          Due In
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {customerOrders.map((order) => {
                        // Calculate due date and remaining hours for this order
                        const dueDate = DueDateService.calculateDueDate(
                          order['Invoice Date']
                        );
                        const dueInHours =
                          DueDateService.calculateHoursUntilDue(dueDate);

                        return (
                          <Table.Tr
                            key={`${order['Product Code']}-${order['Order Date']}-${order['Invoice Date']}-${order['Line Total']}`}
                          >
                            <Table.Td style={{ textAlign: 'center' }}>
                              {/* Empty spacer for Customer column */}
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge variant="light" color="blue">
                                {order['Product Code']}
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {DueDateService.formatDate(
                                  order['Order Date'] || ''
                                )}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {(order.Quantity || 0).toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {DueDateService.formatCurrency(
                                  order['Unit Price'] || 0
                                )}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text fw={600} size="sm">
                                {DueDateService.formatCurrency(
                                  order['Line Total']
                                )}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {DueDateService.formatDate(
                                  order['Invoice Date']
                                )}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Text size="sm">
                                {DueDateService.formatDate(dueDate)}
                              </Text>
                            </Table.Td>
                            <Table.Td style={{ textAlign: 'center' }}>
                              <Badge
                                color={
                                  dueInHours < 0
                                    ? 'red'
                                    : dueInHours <= 168
                                      ? 'orange'
                                      : 'green'
                                }
                                variant="light"
                              >
                                {dueInHours === 0
                                  ? 'Due now'
                                  : `${Math.abs(dueInHours)} ${Math.abs(dueInHours) === 1 ? 'hour' : 'hours'}`}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                )}
              </Stack>
            </Table.Td>
          </Table.Tr>
        )}
      </>
    );
  }
);

DueDateRow.displayName = 'DueDateRow';

export function DueDatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(
    new Set()
  );

  // ✅ Use our custom hook (which uses abstraction layer!)
  const { dueDateItems, stats, isLoading, transactions } = useDueDateData();

  // Fetch customers with Facebook links
  const { data: customersData = [] } = useQuery({
    queryKey: ['customers-facebook-links'],
    queryFn: async () => {
      const response = await api.get<
        Array<{
          id: number;
          'Customer Name': string;
          'Business Name': string;
          Facebook: string;
        }>
      >('/api/customers');

      // The API returns the array directly
      return Array.isArray(response) ? response : [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Create a map of customer names to Facebook links
  const customerFacebookMap = useMemo(() => {
    const map = new Map<string, string>();

    customersData.forEach((customer) => {
      if (customer.Facebook) {
        // Map both customerName and businessName | customerName format
        map.set(customer['Customer Name'].toLowerCase(), customer.Facebook);
        if (customer['Business Name']) {
          const combinedName =
            `${customer['Customer Name']} | ${customer['Business Name']}`.toLowerCase();
          map.set(combinedName, customer.Facebook);
        }
      }
    });

    return map;
  }, [customersData]);

  // Lookup function for Facebook link
  const getFacebookLink = useCallback(
    (customerName: string): string => {
      if (!customerName) {
        return '';
      }
      return customerFacebookMap.get(customerName.toLowerCase()) || '';
    },
    [customerFacebookMap]
  );

  // Handle customer row expansion toggle
  const handleToggleExpand = useCallback((customer: string) => {
    setExpandedCustomers((prev) => {
      const next = new Set(prev);
      if (next.has(customer)) {
        next.delete(customer);
      } else {
        next.add(customer);
      }
      return next;
    });
  }, []);

  // Get orders for a specific customer
  const getCustomerOrders = useCallback(
    (customerName: string) => {
      if (!transactions) {
        return [];
      }
      return DueDateService.getCustomerOrders(transactions, customerName);
    },
    [transactions]
  );

  // ✅ Filter items using service
  const filteredItems = useMemo(() => {
    return DueDateService.filterDueDateItems(
      dueDateItems,
      searchQuery,
      null // No status filter anymore
    );
  }, [dueDateItems, searchQuery]);

  // Render optimized rows using memoized component
  const rows = useMemo(
    () =>
      filteredItems.map((item) => (
        <DueDateRow
          key={item.id}
          item={item}
          onToggleExpand={handleToggleExpand}
          isExpanded={expandedCustomers.has(item.customer)}
          facebookLink={getFacebookLink(item.customer)}
          customerOrders={getCustomerOrders(item.customer)}
        />
      )),
    [
      filteredItems,
      handleToggleExpand,
      expandedCustomers,
      getFacebookLink,
      getCustomerOrders,
    ]
  );

  const headers = [
    'CUSTOMER',
    'PRODUCT CODE',
    'LINE TOTAL',
    'INVOICE DATE',
    'DUE DATE',
    'DUE IN',
    'NOTES',
    'CONTACT BUYER',
  ];

  const emptyStateMessage = searchQuery
    ? `No due dates match "${searchQuery}".`
    : 'No due dates found matching your criteria';

  // Show loading state
  if (isLoading) {
    return (
      <Stack gap="md">
        <StandardTableControls
          searchPlaceholder="Search by customer or product code..."
          onSearch={setSearchQuery}
          hideImport
          hideExport
          hideAddNew
        />
        <StandardTableContainer>
          <StandardDataTable
            headers={headers}
            emptyState="Loading due dates..."
            colSpan={headers.length}
            height="86vh"
          >
            {[]}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    );
  }

  return (
    <>
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="nowrap">
          <StandardTableControls
            searchPlaceholder="Search by customer or product code..."
            onSearch={setSearchQuery}
            hideImport
            hideExport
            hideAddNew
          />
          <Group gap="xs">
            <Badge color="red" variant="light">
              {stats.overdue} Overdue
            </Badge>
            <Badge color="orange" variant="light">
              {stats.dueSoon} Due Soon
            </Badge>
            <Badge color="green" variant="light">
              {stats.onTrack} On Track
            </Badge>
          </Group>
        </Group>

        <StandardTableContainer
          summary={
            <Text size="sm" c="dimmed">
              Showing {filteredItems.length} of {dueDateItems.length} due dates
            </Text>
          }
        >
          <StandardDataTable
            headers={headers}
            emptyState={emptyStateMessage}
            colSpan={headers.length}
            height="86vh"
          >
            {rows}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    </>
  );
}
