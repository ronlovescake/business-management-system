import { memo } from 'react';
import { Stack, Table, Text, Badge } from '@mantine/core';
import type { ProfitLossRow } from '../hooks/useProfitLoss';
import { AccountingTableCard } from '../../components/AccountingTableCard';
import { AccountingTableSummaryCard } from '../../components/AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from '../../components/accountingTableStyles';

interface ProfitLossTableProps {
  rows: ProfitLossRow[];
  filteredRows: ProfitLossRow[];
  formatCurrency: (amount: number) => string;
}

export const ProfitLossTable = memo(function ProfitLossTable({
  rows,
  filteredRows,
  formatCurrency,
}: ProfitLossTableProps) {
  const totals = filteredRows.reduce(
    (acc, row) => {
      if (row.type === 'Revenue') {
        acc.revenue += row.amount;
      } else {
        acc.expense += row.amount;
      }
      return acc;
    },
    { revenue: 0, expense: 0 }
  );

  const net = totals.revenue - totals.expense;

  return (
    <Stack gap="md">
      <AccountingTableCard>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: 320 })}>
                CATEGORY
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 160 })}>
                TYPE
              </Table.Th>
              <Table.Th
                style={accountingThStyle({ width: 220, textAlign: 'right' })}
              >
                AMOUNT (₱)
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredRows.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No data found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredRows.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
                      {row.category}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge
                      color={row.type === 'Revenue' ? 'green' : 'red'}
                      variant="light"
                    >
                      {row.type}
                    </Badge>
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
        leftText={`Showing ${filteredRows.length} of ${rows.length} categories`}
        items={[
          { label: 'Revenue:', value: formatCurrency(totals.revenue) },
          { label: 'Expenses:', value: formatCurrency(totals.expense) },
          { label: 'Net Profit:', value: formatCurrency(net) },
        ]}
      />
    </Stack>
  );
});
