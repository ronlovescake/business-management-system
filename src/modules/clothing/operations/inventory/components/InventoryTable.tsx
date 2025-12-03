import { memo } from 'react';
import { Table, Text } from '@mantine/core';
import { StandardDataTable } from '@/components/tables/StandardDataTable';
import type { InventoryItem } from '../types';
import {
  currencyFormatter,
  numberFormatter,
  percentFormatter,
} from '../lib/formatters';

interface InventoryTableProps {
  headers: readonly string[];
  data: InventoryItem[];
  emptyState: string;
}

export const InventoryTable = memo(
  ({ headers, data, emptyState }: InventoryTableProps) => {
    return (
      <StandardDataTable
        headers={headers}
        emptyState={emptyState}
        colSpan={headers.length}
      >
        {data.map((item) => (
          <Table.Tr key={item.id}>
            <Table.Td style={{ textAlign: 'left' }}>
              <Text size="sm" c="#495057">
                {item.productCode}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.quantity)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.onhand)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.totalOrder)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.availableStock)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.totalSales)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.cogs)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.netProfit)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {percentFormatter.format(item.percentage)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.endingInventoryValue)}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text size="sm" c="#495057">
                {item.shipmentCode}
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center' }}>
              <Text
                size="sm"
                c={item.shipmentStatus === 'Delivered' ? 'green' : '#495057'}
                fw={item.shipmentStatus === 'Delivered' ? 600 : 500}
              >
                {item.shipmentStatus}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </StandardDataTable>
    );
  }
);

InventoryTable.displayName = 'InventoryTable';
