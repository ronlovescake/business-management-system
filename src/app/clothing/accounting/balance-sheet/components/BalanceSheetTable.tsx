import { memo } from 'react';
import { Stack, Card, Box, Table, Text, Group, Badge } from '@mantine/core';
import type { BalanceSheetRow } from '../hooks/useBalanceSheet';

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
      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '73vh' }}
      >
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <Table highlightOnHover withTableBorder>
            <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
              <Table.Tr>
                <Table.Th
                  style={{
                    width: 320,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  ACCOUNT
                </Table.Th>
                <Table.Th
                  style={{
                    width: 180,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  TYPE
                </Table.Th>
                <Table.Th
                  style={{
                    width: 220,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'right',
                  }}
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
                      <Text size="sm" fw={500} c="#495057">
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
                      <Text fw={600} c="#495057">
                        {formatCurrency(row.amount)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>

      <Card withBorder padding="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {filteredRows.length} of {rows.length} accounts
          </Text>
          <Group gap="lg">
            <Text size="sm" fw={600}>
              Assets: {formatCurrency(totals.assets)}
            </Text>
            <Text size="sm" fw={600}>
              Liabilities: {formatCurrency(totals.liabilities)}
            </Text>
            <Text size="sm" fw={600}>
              Equity: {formatCurrency(totals.equity)}
            </Text>
            <Text size="sm" fw={600}>
              Balance: {formatCurrency(balance)}
            </Text>
          </Group>
        </Group>
      </Card>
    </Stack>
  );
});
