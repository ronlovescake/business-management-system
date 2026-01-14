import { memo } from 'react';
import { Stack, Table, Text, Badge } from '@mantine/core';
import type { BalanceSheetRow } from '../hooks/useBalanceSheet';
import { AccountingTableCard } from '../../components/AccountingTableCard';
import { AccountingTableSummaryCard } from '../../components/AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from '../../components/accountingTableStyles';

interface BalanceSheetTableProps {
  rows: BalanceSheetRow[];
  filteredRows: BalanceSheetRow[];
  formatCurrency: (amount: number) => string;
}

export const BalanceSheetTable = memo(function BalanceSheetTable({
  rows,
  filteredRows,
  formatCurrency,
}: BalanceSheetTableProps) {
  const totals = filteredRows.reduce(
    (acc, row) => {
      if (row.type === 'Asset') {
        acc.assets += row.amount;
      } else if (row.type === 'Liability') {
        acc.liabilities += row.amount;
      } else {
        acc.equity += row.amount;
      }
      return acc;
    },
    { assets: 0, liabilities: 0, equity: 0 }
  );

  const balance = totals.assets - totals.liabilities - totals.equity;

  return (
    <Stack gap="md">
      <AccountingTableCard>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: 320 })}>
                ACCOUNT
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 180 })}>
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
                    No accounts found
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
                      {row.account}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Badge
                      color={
                        row.type === 'Asset'
                          ? 'blue'
                          : row.type === 'Liability'
                            ? 'red'
                            : 'green'
                      }
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
        leftText={`Showing ${filteredRows.length} of ${rows.length} accounts`}
        items={[
          { label: 'Assets:', value: formatCurrency(totals.assets) },
          { label: 'Liabilities:', value: formatCurrency(totals.liabilities) },
          { label: 'Equity:', value: formatCurrency(totals.equity) },
          { label: 'Balance:', value: formatCurrency(balance) },
        ]}
      />
    </Stack>
  );
});
