'use client';

import { PageLayout } from '../../../../components/layout/PageLayout';
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
import { useTransactionData } from '../../../../hooks/useSheetData';

interface DueDateItem {
  id: string;
  customer: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  invoiceDate: string;
  dueDate: string;
  dueIn: number;
  contactBuyer: string;
}

// Memoized table row component for performance
const DueDateRow = memo(
  ({
    item,
    formatCurrency,
    formatDate,
    onCustomerDoubleClick,
  }: {
    item: DueDateItem;
    formatCurrency: (amount: number) => string;
    formatDate: (dateString: string) => string;
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
            {formatCurrency(item.lineTotal)}
          </Text>
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>
          <Text size="sm">{formatDate(item.invoiceDate)}</Text>
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

export default function DueDates() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>('all');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  // Fetch transactions data
  const { data: transactions, isLoading } = useTransactionData();

  // Memoized formatters for performance
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  // Process transactions: filter by invoice date and group by customer
  // OPTIMIZED: Only recompute when transactions change
  const dueDateItems = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    // Filter transactions that have an invoice date (optimized with early return)
    const transactionsWithInvoice = transactions.filter(
      (t) =>
        t['Invoice Date'] &&
        t['Invoice Date'].trim() !== '' &&
        t['Line Total'] > 0 &&
        t['Order Status'] === 'Prepared'
    );

    if (transactionsWithInvoice.length === 0) return [];

    // Group by customer and sum line totals
    const customerMap = new Map<
      string,
      {
        customer: string;
        lineTotal: number;
        invoiceDate: string;
        count: number;
      }
    >();

    transactionsWithInvoice.forEach((txn) => {
      const customer = txn.Customers;
      if (!customer) return;

      if (customerMap.has(customer)) {
        const existing = customerMap.get(customer)!;
        existing.lineTotal += txn['Line Total'];
        existing.count += 1;
        // Keep the earliest invoice date
        if (txn['Invoice Date'] < existing.invoiceDate) {
          existing.invoiceDate = txn['Invoice Date'];
        }
      } else {
        customerMap.set(customer, {
          customer: customer,
          lineTotal: txn['Line Total'],
          invoiceDate: txn['Invoice Date'],
          count: 1,
        });
      }
    });

    // Convert to array and sort alphabetically
    const items = Array.from(customerMap.values()).map((data, index) => ({
      id: `customer-${index}`,
      customer: data.customer,
      productCode: '',
      quantity: 0,
      unitPrice: 0,
      lineTotal: data.lineTotal,
      invoiceDate: data.invoiceDate,
      dueDate: '', // Will be calculated later
      dueIn: 0, // Will be calculated later
      contactBuyer: '', // Will be added later
    }));

    // Sort by customer name alphabetically
    return items.sort((a, b) => a.customer.localeCompare(b.customer));
  }, [transactions]);

  // Get all orders for selected customer
  const customerOrders = useMemo(() => {
    if (!selectedCustomer || !transactions) return [];

    return transactions.filter(
      (t) =>
        t.Customers === selectedCustomer &&
        t['Invoice Date'] &&
        t['Invoice Date'].trim() !== '' &&
        t['Line Total'] > 0 &&
        t['Order Status'] === 'Prepared'
    );
  }, [selectedCustomer, transactions]);

  // Handle customer double-click
  const handleCustomerDoubleClick = useCallback((customer: string) => {
    setSelectedCustomer(customer);
    setModalOpened(true);
  }, []);

  const filteredItems = useMemo(() => {
    return dueDateItems.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productCode.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'all') return matchesSearch;
      if (statusFilter === 'overdue') return matchesSearch && item.dueIn < 0;
      if (statusFilter === 'due-soon')
        return matchesSearch && item.dueIn >= 0 && item.dueIn <= 7;
      if (statusFilter === 'on-track') return matchesSearch && item.dueIn > 7;

      return matchesSearch;
    });
  }, [dueDateItems, searchQuery, statusFilter]);

  // Render optimized rows using memoized component
  const rows = useMemo(
    () =>
      filteredItems.map((item) => (
        <DueDateRow
          key={item.id}
          item={item}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          onCustomerDoubleClick={handleCustomerDoubleClick}
        />
      )),
    [filteredItems, formatCurrency, formatDate, handleCustomerDoubleClick]
  );

  // Show loading state
  if (isLoading) {
    return (
      <PageLayout title="Due Dates" fluid withPadding={false}>
        <Paper
          shadow="sm"
          p="lg"
          radius="md"
          withBorder
          style={{ margin: '1rem' }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '50vh',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #3498db',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 1rem',
                }}
              />
              <Text size="sm" c="dimmed">
                Loading due dates...
              </Text>
            </div>
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Paper>
      </PageLayout>
    );
  }

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
              {dueDateItems.filter((i) => i.dueIn < 0).length} Overdue
            </Badge>
            <Badge color="orange" variant="light">
              {dueDateItems.filter((i) => i.dueIn >= 0 && i.dueIn <= 7).length}{' '}
              Due Soon
            </Badge>
            <Badge color="green" variant="light">
              {dueDateItems.filter((i) => i.dueIn > 7).length} On Track
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
            {customerOrders.map((order, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Text size="sm">{formatDate(order['Order Date'])}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color="blue">
                    {order['Product Code']}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{order.Quantity.toLocaleString()}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatCurrency(order['Unit Price'])}</Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={600} size="sm">
                    {formatCurrency(order['Line Total'])}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{formatDate(order['Invoice Date'])}</Text>
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
