import { memo } from 'react';
import { Table, Text } from '@mantine/core';
import { StandardDataTable } from '@/components/tables/StandardDataTable';
import type { InventoryItem } from '../types';
import { normalizeProductCode } from '@/lib/inventory/movements';
import {
  currencyFormatter,
  numberFormatter,
  percentFormatter,
} from '../lib/formatters';

interface InventoryTableProps {
  headers: readonly string[];
  data: InventoryItem[];
  emptyState: string;
  transferOutByProduct: Map<string, string>;
  transferInByProduct: Map<string, string>;
}

export const InventoryTable = memo(
  ({
    headers,
    data,
    emptyState,
    transferOutByProduct,
    transferInByProduct,
  }: InventoryTableProps) => {
    const leftAlignedCellStyle = {
      textAlign: 'left' as const,
      padding: '12px',
      height: '67px',
      boxSizing: 'border-box' as const,
      verticalAlign: 'middle' as const,
    };

    const centeredCellStyle = {
      textAlign: 'center' as const,
      padding: '12px',
      height: '67px',
      boxSizing: 'border-box' as const,
      verticalAlign: 'middle' as const,
    };

    const transferCellStyle = {
      textAlign: 'center' as const,
      padding: '12px',
      height: '67px',
      boxSizing: 'border-box' as const,
      verticalAlign: 'middle' as const,
    };

    const renderTransferValue = (value: string | undefined) => {
      if (!value || value === '—') {
        return (
          <Text size="sm" c="dimmed">
            —
          </Text>
        );
      }

      const transferMatch = value.match(/^(.+?)\s*\/\s*(.+)$/);

      if (!transferMatch) {
        return (
          <Text size="sm" c="#495057">
            {value}
          </Text>
        );
      }

      const [, quantity, details] = transferMatch;
      const formattedDetails = details.toUpperCase();

      return (
        <>
          <Text size="sm" fw={600} c="#212529">
            {quantity}
          </Text>
          <Text size="xs" c="dimmed">
            {formattedDetails}
          </Text>
        </>
      );
    };

    return (
      <StandardDataTable
        headers={headers}
        emptyState={emptyState}
        colSpan={headers.length}
        headerVariant="attendance"
      >
        {data.map((item) => (
          <Table.Tr key={item.id} style={{ height: '67px' }}>
            <Table.Td style={leftAlignedCellStyle}>
              <Text
                size="sm"
                c={item.sellableOnHand > 0 ? 'green' : '#495057'}
                fw={item.sellableOnHand > 0 ? 600 : 500}
              >
                {item.productCode}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.quantity)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.damagedOnHand)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.supplierShortQty)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.additionalsQty)}
              </Text>
            </Table.Td>
            <Table.Td style={transferCellStyle}>
              {renderTransferValue(
                transferOutByProduct.get(normalizeProductCode(item.productCode))
              )}
            </Table.Td>
            <Table.Td style={transferCellStyle}>
              {renderTransferValue(
                transferInByProduct.get(normalizeProductCode(item.productCode))
              )}
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.actualQuantityReceived)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.reservedOnHand)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.soldQty)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {numberFormatter.format(item.sellableOnHand)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.totalSales)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.cogs)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.netProfit)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {percentFormatter.format(item.percentage)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {currencyFormatter.format(item.endingInventoryValue)}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text
                size="sm"
                c={item.shipmentStatus === 'Delivered' ? 'green' : '#495057'}
                fw={item.shipmentStatus === 'Delivered' ? 600 : 500}
              >
                {item.shipmentStatus}
              </Text>
            </Table.Td>
            <Table.Td style={centeredCellStyle}>
              <Text size="sm" c="#495057">
                {item.shipmentCode}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </StandardDataTable>
    );
  }
);

InventoryTable.displayName = 'InventoryTable';
