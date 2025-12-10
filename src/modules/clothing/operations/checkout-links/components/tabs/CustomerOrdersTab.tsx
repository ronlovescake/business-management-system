import { Stack, Group, Text, Table } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { CustomerOrderData } from '../../types';

interface CustomerOrdersTabProps {
  orders: CustomerOrderData[];
  filteredOrders: CustomerOrderData[];
  onSearch: (query: string) => void;
}

export function CustomerOrdersTab({
  orders,
  filteredOrders,
  onSearch,
}: CustomerOrdersTabProps) {
  const sortedOrders = [...filteredOrders].sort((a, b) =>
    a.customerName.localeCompare(b.customerName, undefined, {
      sensitivity: 'base',
      ignorePunctuation: true,
    })
  );

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search customer orders..."
        onSearch={onSearch}
        hideImport
        hideExport
        hideAddNew
        expandSearch
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredOrders.length} of {orders.length} customer orders
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'CUSTOMER NAME',
            'PRODUCT CODE',
            'QUANTITY',
            'WEIGHT PER PIECE',
            'ACTUAL WEIGHT',
          ]}
          colSpan={5}
          emptyState="No customer order data available yet. Data updates automatically when new invoices are recorded."
        >
          {sortedOrders.map((order) => (
            <Table.Tr key={order.id}>
              <Table.Td>
                <Text size="sm" c="#495057">
                  {order.customerName}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="#495057">
                  {order.productCode}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {order.quantity}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {order.weightPerPiece}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {order.actualWeight}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
