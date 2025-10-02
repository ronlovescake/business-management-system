'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageLayout } from '../../../../../components/layout/PageLayout';
import {
  Stack,
  Text,
  Card,
  Group,
  Button,
  Title,
  SimpleGrid,
  Badge,
  ThemeIcon,
  Tabs,
  Table,
  ActionIcon,
  Modal,
  TextInput,
  Textarea,
  Select,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBuildingStore,
  IconReceipt,
  IconX,
  IconEdit,
  IconAlertCircle,
  IconPackage,
  IconTruck,
  IconClock,
  IconCheck,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface CustomerData {
  id: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
}

interface Order {
  id: number;
  orderDate: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  totalAmount: number;
  items: OrderItem[];
  notes?: string;
}

interface OrderItem {
  id: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Transaction {
  id: number;
  orderDate: string | null;
  customers: string | null;
  productCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  adjustment: number | null;
  lineTotal: number | null;
  orderStatus: string | null;
  notes: string | null;
  invoiceDate: string | null;
  packedDate: string | null;
  shipmentCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CustomerDetails() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerData>>({});

  // Load customer data
  useEffect(() => {
    const loadCustomerData = async () => {
      try {
        setLoading(true);

        // Load customer details
        const customerRes = await fetch(`/api/customers/${customerId}`);
        if (!customerRes.ok) {
          throw new Error('Customer not found');
        }
        const customerData = await customerRes.json();
        setCustomer(customerData);
        setEditForm(customerData);

        // Load orders
        const ordersRes = await fetch(`/api/customers/${customerId}/orders`);
        if (ordersRes.ok) {
          const ordersData = await ordersRes.json();
          setOrders(ordersData);
        }

        // Load transactions
        const transactionsRes = await fetch(
          `/api/customers/${customerId}/transactions`
        );
        if (transactionsRes.ok) {
          const transactionsData = await transactionsRes.json();
          setTransactions(transactionsData);
        }
      } catch (error) {
        console.error('Error loading customer data:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load customer details',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    if (customerId) {
      loadCustomerData();
    }
  }, [customerId]);

  const handleUpdateCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        throw new Error('Failed to update customer');
      }

      const updatedCustomer = await res.json();
      setCustomer(updatedCustomer);
      setEditModalOpen(false);

      notifications.show({
        title: '✅ Customer Updated Successfully!',
        message: `${updatedCustomer?.['Customer Name'] || 'Customer'} information has been saved`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to update customer',
        color: 'red',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'processing':
        return 'blue';
      case 'shipped':
        return 'grape';
      case 'delivered':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <IconClock size={14} />;
      case 'processing':
        return <IconPackage size={14} />;
      case 'shipped':
        return <IconTruck size={14} />;
      case 'delivered':
        return <IconCheck size={14} />;
      case 'cancelled':
        return <IconX size={14} />;
      default:
        return <IconClock size={14} />;
    }
  };

  if (loading) {
    return (
      <PageLayout fluid withPadding>
        <LoadingOverlay visible />
      </PageLayout>
    );
  }

  if (!customer) {
    return (
      <PageLayout fluid withPadding>
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Customer Not Found"
          color="red"
        >
          The customer you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </Alert>
        <Button
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
          mt="md"
        >
          Go Back
        </Button>
      </PageLayout>
    );
  }

  // Calculate stats from transactions (not orders)
  const totalTransactions = transactions.length;
  const totalSpent = transactions.reduce(
    (sum, t) => sum + (t.lineTotal || 0),
    0
  );
  const recentTransactions = transactions.filter(
    (t) =>
      t.orderDate &&
      new Date(t.orderDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  ).length;
  const cancelledTransactions = transactions.filter((t) =>
    t.orderStatus?.toLowerCase().includes('cancel')
  ).length;
  const completedTransactions = transactions.filter(
    (t) =>
      t.orderStatus?.toLowerCase().includes('shipped') ||
      t.orderStatus?.toLowerCase().includes('delivered')
  ).length;

  // Calculate rates based on transactions
  const completionRate =
    totalTransactions > 0
      ? Math.round((completedTransactions / totalTransactions) * 100)
      : 0;
  const cancellationRate =
    totalTransactions > 0
      ? Math.round((cancelledTransactions / totalTransactions) * 100)
      : 0;
  const averageTransactionValue =
    completedTransactions > 0
      ? Math.round(
          transactions
            .filter(
              (t) =>
                t.orderStatus?.toLowerCase().includes('shipped') ||
                t.orderStatus?.toLowerCase().includes('delivered')
            )
            .reduce((sum, t) => sum + (t.lineTotal || 0), 0) /
            completedTransactions
        )
      : 0;

  // Keep orders for backward compatibility (if needed)
  const totalOrders = orders.length;
  const cancelledOrders = orders.filter(
    (order) => order.status === 'cancelled'
  ).length;
  const completedOrders = orders.filter(
    (order) => order.status === 'delivered'
  ).length;
  const processingOrders = orders.filter((order) =>
    ['pending', 'processing', 'shipped'].includes(order.status)
  ).length;

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="light" onClick={() => router.back()} size="lg">
              <IconArrowLeft size={18} />
            </ActionIcon>
            <div>
              <Group gap="sm">
                <Title order={2}>{customer['Customer Name']}</Title>
                {customer['Customer Status'] && (
                  <Badge
                    color={
                      customer['Customer Status'] === 'Active'
                        ? 'green'
                        : 'gray'
                    }
                    size="lg"
                  >
                    {customer['Customer Status']}
                  </Badge>
                )}
              </Group>
              <Text size="sm" c="dimmed">
                Customer since {customer.Date}
              </Text>
            </div>
          </Group>
          <Group>
            <Button
              leftSection={<IconEdit size={16} />}
              variant="light"
              onClick={() => setEditModalOpen(true)}
            >
              Edit Customer
            </Button>
          </Group>
        </Group>

        {/* Stats Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-blue-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Total Transactions
                </Text>
                <Title order={3} c="white">
                  {totalTransactions}
                </Title>
                <Text c="white" size="xs" style={{ opacity: 0.7 }}>
                  {recentTransactions} in last 30 days
                </Text>
              </div>
              <ThemeIcon variant="white" color="blue" size="lg" radius="md">
                <IconReceipt size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-green-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Completion Rate
                </Text>
                <Title order={3} c="white">
                  {completionRate}%
                </Title>
                <Text c="white" size="xs" style={{ opacity: 0.7 }}>
                  {completedOrders} completed
                </Text>
              </div>
              <ThemeIcon variant="white" color="green" size="lg" radius="md">
                <IconCheck size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{ background: 'var(--mantine-color-red-6)', color: 'white' }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Cancellation Rate
                </Text>
                <Title order={3} c="white">
                  {cancellationRate}%
                </Title>
                <Text c="white" size="xs" style={{ opacity: 0.7 }}>
                  {cancelledOrders} cancelled
                </Text>
              </div>
              <ThemeIcon variant="white" color="red" size="lg" radius="md">
                <IconX size={18} />
              </ThemeIcon>
            </Group>
          </Card>

          <Card
            shadow="sm"
            padding="md"
            radius="md"
            style={{
              background: 'var(--mantine-color-yellow-6)',
              color: 'white',
            }}
          >
            <Group justify="space-between" align="flex-start">
              <div>
                <Text c="white" size="xs" style={{ opacity: 0.85 }}>
                  Avg Transaction Value
                </Text>
                <Title order={3} c="white">
                  ₱{averageTransactionValue.toLocaleString()}
                </Title>
                <Text c="white" size="xs" style={{ opacity: 0.7 }}>
                  From {completedTransactions} completed
                </Text>
              </div>
              <ThemeIcon variant="white" color="yellow" size="lg" radius="md">
                <IconReceipt size={18} />
              </ThemeIcon>
            </Group>
          </Card>
        </SimpleGrid>

        {/* Customer Analytics */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Customer Analytics</Title>

            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
              {/* Order Status Breakdown */}
              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Order Status Breakdown
                </Text>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-green-6)',
                        }}
                      />
                      <Text size="xs">Completed</Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {completedOrders}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-blue-6)',
                        }}
                      />
                      <Text size="xs">Processing</Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {processingOrders}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Group gap="xs">
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-red-6)',
                        }}
                      />
                      <Text size="xs">Cancelled</Text>
                    </Group>
                    <Text size="xs" fw={500}>
                      {cancelledOrders}
                    </Text>
                  </Group>
                </Stack>
              </Stack>

              {/* Performance Metrics */}
              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Performance Metrics
                </Text>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs">Success Rate</Text>
                    <Text
                      size="xs"
                      fw={500}
                      c={
                        completionRate >= 80
                          ? 'green'
                          : completionRate >= 60
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {completionRate}%
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Failure Rate</Text>
                    <Text
                      size="xs"
                      fw={500}
                      c={
                        cancellationRate <= 10
                          ? 'green'
                          : cancellationRate <= 20
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {cancellationRate}%
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Recent Activity</Text>
                    <Text size="xs" fw={500}>
                      {recentTransactions} transactions (30d)
                    </Text>
                  </Group>
                </Stack>
              </Stack>

              {/* Financial Summary */}
              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Financial Summary
                </Text>
                <Stack gap={4}>
                  <Group justify="space-between">
                    <Text size="xs">Total Revenue</Text>
                    <Text size="xs" fw={500}>
                      ₱{totalSpent.toLocaleString()}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Avg Transaction Value</Text>
                    <Text size="xs" fw={500}>
                      ₱{averageTransactionValue.toLocaleString()}
                    </Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="xs">Customer Value</Text>
                    <Text
                      size="xs"
                      fw={500}
                      c={
                        totalSpent >= 10000
                          ? 'green'
                          : totalSpent >= 5000
                            ? 'yellow'
                            : 'gray'
                      }
                    >
                      {totalSpent >= 10000
                        ? 'High'
                        : totalSpent >= 5000
                          ? 'Medium'
                          : 'Standard'}
                    </Text>
                  </Group>
                </Stack>
              </Stack>

              {/* Customer Health Score */}
              <Stack gap="xs">
                <Text size="sm" fw={500} c="dimmed">
                  Customer Health Score
                </Text>
                <Stack gap={4} align="center">
                  {(() => {
                    const healthScore = Math.round(
                      completionRate * 0.4 +
                        (100 - cancellationRate) * 0.3 +
                        Math.min(recentTransactions * 10, 100) * 0.2 +
                        Math.min(totalOrders * 5, 100) * 0.1
                    );
                    const healthColor =
                      healthScore >= 80
                        ? 'green'
                        : healthScore >= 60
                          ? 'yellow'
                          : healthScore >= 40
                            ? 'orange'
                            : 'red';
                    const healthLabel =
                      healthScore >= 80
                        ? 'Excellent'
                        : healthScore >= 60
                          ? 'Good'
                          : healthScore >= 40
                            ? 'Fair'
                            : 'Poor';

                    return (
                      <>
                        <Title order={2} c={healthColor}>
                          {healthScore}
                        </Title>
                        <Text size="xs" fw={500} c={healthColor}>
                          {healthLabel}
                        </Text>
                        <Text size="xs" c="dimmed" ta="center">
                          Based on completion rate, activity, and order history
                        </Text>
                      </>
                    );
                  })()}
                </Stack>
              </Stack>
            </SimpleGrid>
          </Stack>
        </Card>

        {/* Customer Details and Orders/Transactions */}
        <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
          {/* Customer Info */}
          <Card shadow="sm" padding="lg" radius="md" withBorder>
            <Stack gap="sm">
              <Title order={4}>Customer Information</Title>

              <Group>
                <ThemeIcon variant="light" size="sm">
                  <IconUser size={14} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    Name
                  </Text>
                  <Text size="sm">{customer['Customer Name']}</Text>
                </div>
              </Group>

              {customer['Phone Number'] && (
                <Group>
                  <ThemeIcon variant="light" size="sm">
                    <IconPhone size={14} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">
                      Phone
                    </Text>
                    <Text size="sm">{customer['Phone Number']}</Text>
                  </div>
                </Group>
              )}

              {customer['Email Address'] && (
                <Group>
                  <ThemeIcon variant="light" size="sm">
                    <IconMail size={14} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">
                      Email
                    </Text>
                    <Text size="sm">{customer['Email Address']}</Text>
                  </div>
                </Group>
              )}

              {customer.Address && (
                <Group>
                  <ThemeIcon variant="light" size="sm">
                    <IconMapPin size={14} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">
                      Address
                    </Text>
                    <Text size="sm">{customer.Address}</Text>
                  </div>
                </Group>
              )}

              {customer['Business Name'] && (
                <Group>
                  <ThemeIcon variant="light" size="sm">
                    <IconBuildingStore size={14} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">
                      Business
                    </Text>
                    <Text size="sm">{customer['Business Name']}</Text>
                  </div>
                </Group>
              )}
            </Stack>
          </Card>

          {/* Orders and Transactions */}
          <Card
            shadow="sm"
            padding="lg"
            radius="md"
            withBorder
            style={{ gridColumn: 'span 2' }}
          >
            <Tabs defaultValue="orders" keepMounted={false}>
              <Tabs.List grow>
                <Tabs.Tab value="orders">
                  <Stack gap={2} align="center">
                    <Text size="sm">Orders ({totalOrders})</Text>
                    <Group gap="xs">
                      <Text size="xs" c="green">
                        {completionRate}% completed
                      </Text>
                      <Text size="xs" c="dimmed">
                        •
                      </Text>
                      <Text size="xs" c="red">
                        {cancellationRate}% cancelled
                      </Text>
                    </Group>
                  </Stack>
                </Tabs.Tab>
                <Tabs.Tab value="transactions">
                  <Stack gap={2} align="center">
                    <Text size="sm">Transactions ({transactions.length})</Text>
                    <Text size="xs" c="dimmed">
                      ₱{totalSpent.toLocaleString()} total
                    </Text>
                  </Stack>
                </Tabs.Tab>
              </Tabs.List>

              <Tabs.Panel value="orders" pt="md">
                {orders.length === 0 ? (
                  <Text ta="center" c="dimmed" py="xl">
                    No orders found for this customer
                  </Text>
                ) : (
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table striped highlightOnHover>
                      <Table.Thead
                        style={{
                          position: 'sticky',
                          top: 0,
                          backgroundColor: 'var(--mantine-color-body)',
                          zIndex: 1,
                        }}
                      >
                        <Table.Tr>
                          <Table.Th>Order #</Table.Th>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Amount</Table.Th>
                          <Table.Th>Items</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {orders.map((order) => (
                          <Table.Tr key={order.id}>
                            <Table.Td>
                              <Text fw={500}>{order.orderNumber}</Text>
                              {order.notes && (
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  truncate="end"
                                  maw={200}
                                >
                                  {order.notes}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {new Date(order.orderDate).toLocaleDateString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={getStatusColor(order.status)}
                                leftSection={getStatusIcon(order.status)}
                                variant="light"
                              >
                                {order.status}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text
                                fw={500}
                                c={
                                  order.status === 'cancelled' ? 'red' : 'dark'
                                }
                              >
                                ₱{order.totalAmount.toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {order.items.length} item
                                {order.items.length !== 1 ? 's' : ''}
                              </Text>
                              {order.items.length > 0 && (
                                <Text
                                  size="xs"
                                  c="dimmed"
                                  truncate="end"
                                  maw={150}
                                >
                                  {order.items[0].productName}
                                  {order.items.length > 1 &&
                                    ` +${order.items.length - 1} more`}
                                </Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                )}
              </Tabs.Panel>

              <Tabs.Panel value="transactions" pt="md">
                {transactions.length === 0 ? (
                  <Text ta="center" c="dimmed" py="xl">
                    No transactions found for this customer
                  </Text>
                ) : (
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table striped highlightOnHover>
                      <Table.Thead
                        style={{
                          position: 'sticky',
                          top: 0,
                          backgroundColor: 'var(--mantine-color-body)',
                          zIndex: 1,
                        }}
                      >
                        <Table.Tr>
                          <Table.Th>Order Date</Table.Th>
                          <Table.Th>Product Code</Table.Th>
                          <Table.Th>Quantity</Table.Th>
                          <Table.Th>Unit Price</Table.Th>
                          <Table.Th>Line Total</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {transactions.map((transaction) => (
                          <Table.Tr key={transaction.id}>
                            <Table.Td>
                              <Text size="sm">
                                {transaction.orderDate || '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {transaction.productCode || '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{transaction.quantity || 0}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                ₱{(transaction.unitPrice || 0).toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={500}>
                                ₱{(transaction.lineTotal || 0).toLocaleString()}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={
                                  transaction.orderStatus
                                    ?.toLowerCase()
                                    .includes('shipped') ||
                                  transaction.orderStatus
                                    ?.toLowerCase()
                                    .includes('delivered')
                                    ? 'green'
                                    : transaction.orderStatus
                                          ?.toLowerCase()
                                          .includes('cancel')
                                      ? 'red'
                                      : 'blue'
                                }
                                variant="light"
                              >
                                {transaction.orderStatus || 'Pending'}
                              </Badge>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </div>
                )}
              </Tabs.Panel>
            </Tabs>
          </Card>
        </SimpleGrid>

        {/* Edit Customer Modal - Enhanced Modern Design */}
        <Modal
          opened={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          closeOnClickOutside={false}
          closeOnEscape={false}
          withCloseButton={true}
          size="xl"
          radius="lg"
          shadow="xl"
          centered
          padding="xl"
          styles={{
            header: {
              backgroundColor: 'var(--mantine-color-orange-0)',
              borderRadius: '12px 12px 0 0',
              padding: '24px 32px 16px 32px',
              borderBottom: '1px solid var(--mantine-color-gray-2)',
            },
            title: {
              fontSize: '24px',
              fontWeight: 600,
              color: 'var(--mantine-color-orange-8)',
            },
            body: {
              padding: '32px',
              backgroundColor: 'var(--mantine-color-gray-0)',
            },
            close: {
              color: 'var(--mantine-color-orange-6)',
              '&:hover': {
                backgroundColor: 'var(--mantine-color-orange-1)',
              },
            },
          }}
          title={
            <Group gap="sm">
              <ThemeIcon size="lg" radius="md" variant="light" color="orange">
                <IconEdit size={20} />
              </ThemeIcon>
              <div>
                <Text size="xl" fw={600} c="orange.8">
                  Edit Customer
                </Text>
                <Text size="sm" c="dimmed">
                  Update {customer?.['Customer Name'] || 'customer'} information
                </Text>
              </div>
            </Group>
          }
        >
          <Stack gap="lg">
            {/* Personal Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="orange">
                  <IconUser size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="orange.7">
                  Personal Information
                </Text>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Customer Name"
                  placeholder="e.g. Jane Doe"
                  withAsterisk
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-orange-5)',
                      },
                    },
                  }}
                  value={editForm['Customer Name'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Customer Name': e.target.value,
                    }))
                  }
                />

                <TextInput
                  label="Phone Number"
                  placeholder="e.g. 09171234567"
                  size="md"
                  radius="md"
                  leftSection={<IconPhone size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-orange-5)',
                      },
                    },
                  }}
                  value={editForm['Phone Number'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Phone Number': e.target.value,
                    }))
                  }
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <TextInput
                  label="Email Address"
                  placeholder="name@email.com"
                  size="md"
                  radius="md"
                  leftSection={<IconMail size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-orange-5)',
                      },
                    },
                  }}
                  value={editForm['Email Address'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Email Address': e.target.value,
                    }))
                  }
                />

                <Select
                  label="Customer Status"
                  placeholder="Select status"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-orange-5)',
                      },
                    },
                  }}
                  data={[
                    { label: '✅ Active', value: 'Active' },
                    { label: '⏸️ Inactive', value: 'Inactive' },
                    { label: '🎯 Prospect', value: 'Prospect' },
                    { label: '⭐ VIP', value: 'VIP' },
                  ]}
                  allowDeselect
                  clearable
                  value={editForm['Customer Status'] || ''}
                  onChange={(value) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Customer Status': value || '',
                    }))
                  }
                />
              </SimpleGrid>

              <Textarea
                label="Address"
                placeholder="Street, City, Province"
                size="md"
                radius="md"
                mt="md"
                minRows={2}
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-orange-5)' },
                  },
                }}
                value={editForm.Address || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, Address: e.target.value }))
                }
              />

              <TextInput
                label="Facebook Profile"
                placeholder="https://facebook.com/username"
                size="md"
                radius="md"
                mt="md"
                styles={{
                  label: { fontWeight: 500, marginBottom: 8 },
                  input: {
                    borderWidth: 2,
                    '&:focus': { borderColor: 'var(--mantine-color-orange-5)' },
                  },
                }}
                value={editForm.Facebook || ''}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, Facebook: e.target.value }))
                }
              />
            </div>

            {/* Business Information Section */}
            <div>
              <Group mb="md">
                <ThemeIcon size="sm" radius="md" variant="light" color="green">
                  <IconBuildingStore size={14} />
                </ThemeIcon>
                <Text size="lg" fw={500} c="green.7">
                  Business Information
                </Text>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <TextInput
                  label="Business Name"
                  placeholder="e.g. ABC Company Inc."
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-green-5)',
                      },
                    },
                  }}
                  value={editForm['Business Name'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Business Name': e.target.value,
                    }))
                  }
                />

                <TextInput
                  label="Tax Number"
                  placeholder="e.g. 123-456-789"
                  size="md"
                  radius="md"
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-green-5)',
                      },
                    },
                  }}
                  value={editForm['Tax Number'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Tax Number': e.target.value,
                    }))
                  }
                />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
                <Textarea
                  label="Business Address"
                  placeholder="Business location"
                  size="md"
                  radius="md"
                  minRows={2}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-green-5)',
                      },
                    },
                  }}
                  value={editForm['Business Address'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Business Address': e.target.value,
                    }))
                  }
                />

                <TextInput
                  label="Business Contact Number"
                  placeholder="e.g. 02-123-4567"
                  size="md"
                  radius="md"
                  leftSection={<IconPhone size={16} />}
                  styles={{
                    label: { fontWeight: 500, marginBottom: 8 },
                    input: {
                      borderWidth: 2,
                      '&:focus': {
                        borderColor: 'var(--mantine-color-green-5)',
                      },
                    },
                  }}
                  value={editForm['Business Contact Number'] || ''}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      'Business Contact Number': e.target.value,
                    }))
                  }
                />
              </SimpleGrid>
            </div>

            {/* Action Buttons */}
            <Group
              justify="flex-end"
              mt="xl"
              pt="md"
              style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
            >
              <Button
                variant="subtle"
                size="md"
                radius="md"
                onClick={() => setEditModalOpen(false)}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-1)',
                    },
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                size="md"
                radius="md"
                gradient={{ from: 'orange', to: 'orange.6', deg: 45 }}
                disabled={!editForm['Customer Name']?.trim()}
                leftSection={<IconCheck size={18} />}
                styles={{
                  root: {
                    boxShadow: '0 4px 12px rgba(253, 126, 20, 0.2)',
                    '&:hover': {
                      boxShadow: '0 6px 16px rgba(253, 126, 20, 0.3)',
                      transform: 'translateY(-1px)',
                    },
                    transition: 'all 0.2s ease',
                  },
                }}
                onClick={handleUpdateCustomer}
              >
                Update Customer
              </Button>
            </Group>
          </Stack>
        </Modal>
      </Stack>
    </PageLayout>
  );
}
