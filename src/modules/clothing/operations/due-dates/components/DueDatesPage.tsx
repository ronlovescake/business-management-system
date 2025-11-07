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
import { IconPhone, IconMail } from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { useDueDateData } from '../hooks/useDueDateData';
import { DueDateService } from '../services/DueDateService';
import type { DueDateItem } from '../types/dueDate.types';

// Memoized table row component for performance
const DueDateRow = memo(
  ({
    item,
    onCustomerDoubleClick,
  }: {
    item: DueDateItem;
    onCustomerDoubleClick: (customer: string) => void;
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
          <Text size="sm" c="dimmed" fs="italic">
            {item.dueDate || 'Pending'}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Badge color="gray" variant="light">
            {item.dueIn === 0 ? 'Pending' : `${item.dueIn} days`}
          </Badge>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Group gap="xs" justify="center">
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
        />
      )),
    [filteredItems, handleCustomerDoubleClick]
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
            height="87vh"
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
            height="87vh"
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
