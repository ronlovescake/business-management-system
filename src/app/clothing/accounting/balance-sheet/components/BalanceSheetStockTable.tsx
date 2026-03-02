import { memo } from 'react';
import { Stack, Table, Text } from '@mantine/core';
import { AccountingTableCard } from '../../components/AccountingTableCard';
import { AccountingTableSummaryCard } from '../../components/AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from '../../components/accountingTableStyles';
import type {
  StockBreakdownRow,
  StockBreakdownSummary,
} from '../hooks/useBalanceSheet';

interface BalanceSheetStockTableProps {
  rows: StockBreakdownRow[];
  totalRows: number;
  summary: StockBreakdownSummary;
  formatCurrency: (amount: number) => string;
}

export const BalanceSheetStockTable = memo(function BalanceSheetStockTable({
  rows,
  totalRows,
  summary,
  formatCurrency,
}: BalanceSheetStockTableProps) {
  return (
    <Stack gap="md">
      <AccountingTableCard>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: 520 })}>TAG</Table.Th>
              <Table.Th
                style={accountingThStyle({ width: 220, textAlign: 'right' })}
              >
                AMOUNT (₱)
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={2} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No stock details found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
                      {row.tag}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {formatCurrency(row.amount)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </AccountingTableCard>

      <AccountingTableSummaryCard
        leftText={`Showing ${rows.length} of ${totalRows} stock detail rows`}
        items={[
          {
            label: 'Stock on Hand Total:',
            value: formatCurrency(summary.stockOnHandBalance),
          },
          {
            label: 'Detail Sum:',
            value: formatCurrency(summary.detailSum),
          },
          {
            label: 'Unclassified:',
            value: formatCurrency(summary.unclassifiedDelta),
          },
        ]}
      />
    </Stack>
  );
});
