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
import { IconPhone, IconMail, IconMessageCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { useDueDateData } from '../hooks/useDueDateData';
import { DueDateService } from '../services/DueDateService';
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

// Memoized table row component for each individual order
const DueDateOrderRow = memo(
  ({
    order,
    customerName,
    isFirstRow,
    rowSpan,
    facebookLink,
  }: {
    order: Transaction;
    customerName: string;
    isFirstRow: boolean;
    rowSpan: number;
    facebookLink: string;
  }) => {
    const dueDate = DueDateService.calculateDueDate(order['Invoice Date']);
    const dueInHours = DueDateService.calculateHoursUntilDue(dueDate);

    return (
      <Table.Tr>
        {isFirstRow && (
          <Table.Td
            rowSpan={rowSpan}
            style={{ textAlign: 'left', verticalAlign: 'top' }}
          >
            <Text fw={500} size="sm" c="#495057">
              {customerName}
            </Text>
          </Table.Td>
        )}
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {order['Product Code']}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {(order.Quantity || 0).toLocaleString()}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {DueDateService.formatCurrency(order['Unit Price'] || 0)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text fw={600} size="sm" c="#495057">
            {DueDateService.formatCurrency(order['Line Total'])}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {DueDateService.formatDate(order['Invoice Date'])}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="#495057">
            {DueDateService.formatDate(dueDate)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Badge
            color={
              dueInHours < 0 ? 'red' : dueInHours <= 168 ? 'orange' : 'green'
            }
            variant="light"
          >
            {dueInHours === 0
              ? 'Due now'
              : `${Math.abs(dueInHours)} ${Math.abs(dueInHours) === 1 ? 'hour' : 'hours'}`}
          </Badge>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm" c="dimmed" lineClamp={1}>
            {order.Notes || '-'}
          </Text>
        </Table.Td>
        {isFirstRow && (
          <Table.Td
            rowSpan={rowSpan}
            style={{ textAlign: 'center', verticalAlign: 'top' }}
          >
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
        )}
      </Table.Tr>
    );
  }
);

DueDateOrderRow.displayName = 'DueDateOrderRow';

export function DueDatesPage() {
  const [searchQuery, setSearchQuery] = useState('');

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

  // Render individual order rows grouped by customer
  const rows = useMemo(() => {
    const allRows: JSX.Element[] = [];

    filteredItems.forEach((item) => {
      const customerOrders = getCustomerOrders(item.customer);
      const facebookLink = getFacebookLink(item.customer);

      customerOrders.forEach((order, index) => {
        const uniqueKey = `${item.customer}-${order['Product Code']}-${order['Invoice Date']}-${order['Line Total']}-${order.Quantity}-${order['Order Date'] || 'no-date'}`;
        allRows.push(
          <DueDateOrderRow
            key={uniqueKey}
            order={order}
            customerName={item.customer}
            isFirstRow={index === 0}
            rowSpan={customerOrders.length}
            facebookLink={facebookLink}
          />
        );
      });
    });

    return allRows;
  }, [filteredItems, getCustomerOrders, getFacebookLink]);

  const headers = [
    'CUSTOMER',
    'PRODUCT CODE',
    'QUANTITY',
    'UNIT PRICE',
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
            withColumnBorders
          >
            {rows}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    </>
  );
}
