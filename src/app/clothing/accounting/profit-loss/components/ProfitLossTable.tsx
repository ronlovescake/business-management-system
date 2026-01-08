import { memo } from 'react';
import { Stack, Card, Box, Table, Text, Group, Badge } from '@mantine/core';
import type { ProfitLossRow } from '../hooks/useProfitLoss';

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
                  CATEGORY
                </Table.Th>
                <Table.Th
                  style={{
                    width: 160,
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
                      No data found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredRows.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" fw={500} c="#495057">
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
            Showing {filteredRows.length} of {rows.length} categories
          </Text>
          <Group gap="lg">
            <Text size="sm" fw={600}>
              Revenue: {formatCurrency(totals.revenue)}
            </Text>
            <Text size="sm" fw={600}>
              Expenses: {formatCurrency(totals.expense)}
            </Text>
            <Text size="sm" fw={600}>
              Net Profit: {formatCurrency(net)}
            </Text>
          </Group>
        </Group>
      </Card>
    </Stack>
  );
});
