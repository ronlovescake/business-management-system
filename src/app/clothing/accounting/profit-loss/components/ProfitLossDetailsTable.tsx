import { memo, useMemo } from 'react';
import { Badge, Stack, Table, Text } from '@mantine/core';
import type { ProfitLossDetailRow } from '../hooks/useProfitLoss';
import { AccountingTableCard } from '../../components/AccountingTableCard';
import { AccountingTableSummaryCard } from '../../components/AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
  accountingThStyle,
} from '../../components/accountingTableStyles';
import { parseDate } from '@/lib/accounting/date-utils';

interface ProfitLossDetailsTableProps {
  rows: ProfitLossDetailRow[];
  filteredRows: ProfitLossDetailRow[];
  formatCurrency: (amount: number) => string;
}

function formatShortDate(value: string): string {
  const d = parseDate(value) ?? new Date(value);
  if (Number.isNaN(d.getTime())) {
    return value;
  }

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    timeZone: 'Asia/Manila',
  });
}

export const ProfitLossDetailsTable = memo(function ProfitLossDetailsTable({
  rows,
  filteredRows,
  formatCurrency,
}: ProfitLossDetailsTableProps) {
  const totals = useMemo(() => {
    return filteredRows.reduce(
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
  }, [filteredRows]);

  const net = totals.revenue - totals.expense;

  return (
    <Stack gap="md">
      <AccountingTableCard>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: 140 })}>
                DATE
              </Table.Th>
              <Table.Th
                style={accountingThStyle({ width: 140, textAlign: 'center' })}
              >
                TYPE
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 220 })}>
                CATEGORY
              </Table.Th>
              <Table.Th style={accountingThStyle({ minWidth: 420 })}>
                DESCRIPTION
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
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No data found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredRows.map((row) => {
                const meta = [
                  row.customer ? `Customer: ${row.customer}` : null,
                  row.productCode ? `Product: ${row.productCode}` : null,
                  row.method ? `Method: ${row.method}` : null,
                  row.ref ? `Ref: ${row.ref}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ');

                return (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                        {formatShortDate(row.date)}
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
                    <Table.Td>
                      <Text
                        fw={500}
                        size="sm"
                        c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                      >
                        {row.category}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={500}
                        c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                      >
                        {row.description}
                      </Text>
                      {meta ? (
                        <Text size="xs" c="dimmed" mt={4}>
                          {meta}
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                        {formatCurrency(row.amount)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </AccountingTableCard>

      <AccountingTableSummaryCard
        leftText={`Showing ${filteredRows.length} of ${rows.length} rows`}
        items={[
          { label: 'Revenue:', value: formatCurrency(totals.revenue) },
          { label: 'Expenses:', value: formatCurrency(totals.expense) },
          { label: 'Net Profit:', value: formatCurrency(net) },
        ]}
      />
    </Stack>
  );
});
