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
  Modal,
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
import type { DueDateItem } from '../types/dueDate.types';
import { api } from '@/lib/api/client';

// Memoized table row component for performance
const DueDateRow = memo(
  ({
    item,
    onCustomerDoubleClick,
    facebookLink,
  }: {
    item: DueDateItem;
    onCustomerDoubleClick: (customer: string) => void;
    facebookLink: string;
  }) => {
    return (
      <Table.Tr>
        <Table.Td
          onDoubleClick={() => onCustomerDoubleClick(item.customer)}
          style={{ cursor: 'pointer', textAlign: 'left' }}
        >
          <Text fw={500} size="sm" c="#495057">
            {item.customer}
          </Text>
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
    );
  }
);

DueDateRow.displayName = 'DueDateRow';

export function DueDatesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

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

  // Get all orders for selected customer
  const customerOrders = useMemo(() => {
    if (!selectedCustomer || !transactions) {
      return [];
    }
    return DueDateService.getCustomerOrders(transactions, selectedCustomer);
  }, [selectedCustomer, transactions]);

  // Handle customer double-click
  const handleCustomerDoubleClick = useCallback((customer: string) => {
    setSelectedCustomer(customer);
    setModalOpened(true);
  }, []);

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
          onCustomerDoubleClick={handleCustomerDoubleClick}
          facebookLink={getFacebookLink(item.customer)}
        />
      )),
    [filteredItems, handleCustomerDoubleClick, getFacebookLink]
  );

  const headers = [
    'CUSTOMER',
    'LINE TOTAL',
    'INVOICE DATE',
    'DUE DATE',
    'DUE IN',
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

      {/* Customer Orders Modal */}
      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={`Orders for ${selectedCustomer}`}
        size="90%"
        centered
      >
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Order Date</Table.Th>
              <Table.Th>Product Code</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Line Total</Table.Th>
              <Table.Th>Invoice Date</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {customerOrders.map((order) => (
              <Table.Tr
                key={`${order['Product Code']}-${order['Order Date']}-${order['Invoice Date']}`}
              >
                <Table.Td>
                  <Text size="sm">
                    {DueDateService.formatDate(order['Order Date'] || '')}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="blue">
                    {order['Product Code']}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {(order.Quantity || 0).toLocaleString()}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {DueDateService.formatCurrency(order['Unit Price'] || 0)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {DueDateService.formatCurrency(order['Line Total'])}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {DueDateService.formatDate(order['Invoice Date'])}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {customerOrders.length === 0 && (
          <Text ta="center" py="xl" c="dimmed">
            No orders found for this customer
          </Text>
        )}
      </Modal>
    </>
  );
}
