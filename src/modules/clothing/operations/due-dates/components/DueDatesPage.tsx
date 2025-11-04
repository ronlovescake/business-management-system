/**
 * Due Dates Page Component
 *
 * Shows customers with unpaid invoices grouped by customer.
 * Double-click customer to see all their orders.
 *
 * ✅ UI is IDENTICAL to original - only code organization changed!
 */

'use client';

import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import {
  Table,
  Badge,
  Group,
  Text,
  Paper,
  ActionIcon,
  Tooltip,
  TextInput,
  Select,
  Modal,
} from '@mantine/core';
import { IconPhone, IconMail, IconSearch } from '@tabler/icons-react';
import { useState, useMemo, useCallback, memo } from 'react';
import { useDueDateData } from '../hooks/useDueDateData';
import { DueDateService } from '../services/DueDateService';
import type { DueDateItem } from '../types/dueDate.types';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

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
          style={{ cursor: 'pointer' }}
        >
          <Text fw={500} size="sm">
            {item.customer}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'right' }}>
          <Text fw={600} size="sm">
            {DueDateService.formatCurrency(item.lineTotal)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm">{DueDateService.formatDate(item.invoiceDate)}</Text>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dimmed" fs="italic">
            {item.dueDate || 'Pending'}
          </Text>
        </Table.Td>
        <Table.Td>
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
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
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
      statusFilter
    );
  }, [dueDateItems, searchQuery, statusFilter]);

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

  useCtrlFFocus('[data-ctrlf-target="due-dates-search-input"]', true);

  // Show loading state (IDENTICAL to original!)
  if (isLoading) {
    return (
      <PageLayout title="Due Dates" fluid withPadding>
        <TableSkeleton rows={10} columns={6} />
      </PageLayout>
    );
  }

  // ✅ MAIN UI - IDENTICAL TO ORIGINAL!
  return (
    <PageLayout title="Due Dates" fluid withPadding={false}>
      <Paper
        shadow="sm"
        p="lg"
        radius="md"
        withBorder
        style={{ margin: '1rem' }}
      >
        <Group mb="lg" justify="space-between">
          <Group>
            <TextInput
              placeholder="Search by customer or product code..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ width: 300 }}
              data-ctrlf-target="due-dates-search-input"
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              data={[
                { value: 'all', label: 'All Status' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'due-soon', label: 'Due Soon (≤7 days)' },
                { value: 'on-track', label: 'On Track' },
              ]}
              style={{ width: 200 }}
            />
          </Group>
          <Group>
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

        <div
          style={{
            overflowX: 'auto',
            width: '100%',
            height: '85vh',
            overflowY: 'auto',
          }}
        >
          <Table
            striped
            highlightOnHover
            withTableBorder
            withColumnBorders
            style={{ width: '100%', minWidth: 800 }}
            stickyHeader
            stickyHeaderOffset={0}
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ textAlign: 'center' }}>Customer</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Line Total</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>
                  Invoice Date
                </Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Due Date</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>Due In</Table.Th>
                <Table.Th style={{ textAlign: 'center' }}>
                  Contact Buyer
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </div>

        {filteredItems.length === 0 && (
          <Text ta="center" py="xl" c="dimmed">
            No due dates found matching your criteria
          </Text>
        )}
      </Paper>

      {/* Customer Orders Modal - IDENTICAL! */}
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
    </PageLayout>
  );
}
