import { memo } from 'react';
import { Card, Tabs, Stack, Text, Table, Group, Badge } from '@mantine/core';
import type { Order, Transaction, CustomerStats } from '../types';
import {
  getStatusColor,
  getStatusIcon,
  formatCurrency,
  formatDate,
} from '../utils';

// ============================================================================
// ORDERS AND TRANSACTIONS TABS
// ============================================================================

interface OrdersAndTransactionsProps {
  orders: Order[];
  transactions: Transaction[];
  stats: CustomerStats;
}

export const OrdersAndTransactions = memo(function OrdersAndTransactions({
  orders,
  transactions,
  stats,
}: OrdersAndTransactionsProps) {
  return (
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
              <Text size="sm">Orders ({stats.totalOrders})</Text>
              <Group gap="xs">
                <Text size="xs" c="green">
                  {stats.completionRate}% completed
                </Text>
                <Text size="xs" c="dimmed">
                  •
                </Text>
                <Text size="xs" c="red">
                  {stats.cancellationRate}% cancelled
                </Text>
              </Group>
            </Stack>
          </Tabs.Tab>
          <Tabs.Tab value="transactions">
            <Stack gap={2} align="center">
              <Text size="sm">Transactions ({transactions.length})</Text>
              <Text size="xs" c="dimmed">
                {formatCurrency(stats.totalSpent)} total
              </Text>
            </Stack>
          </Tabs.Tab>
        </Tabs.List>

        {/* Orders Tab */}
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
                          <Text size="xs" c="dimmed" truncate="end" maw={200}>
                            {order.notes}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{formatDate(order.orderDate)}</Text>
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
                          c={order.status === 'cancelled' ? 'red' : 'dark'}
                        >
                          {formatCurrency(order.totalAmount)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {order.items.length} item
                          {order.items.length !== 1 ? 's' : ''}
                        </Text>
                        {order.items.length > 0 && (
                          <Text size="xs" c="dimmed" truncate="end" maw={150}>
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

        {/* Transactions Tab */}
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
                        <Text size="sm">{transaction.orderDate || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{transaction.productCode || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{transaction.quantity || 0}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {formatCurrency(transaction.unitPrice || 0)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text fw={500}>
                          {formatCurrency(transaction.lineTotal || 0)}
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
  );
});
