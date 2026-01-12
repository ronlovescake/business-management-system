import { memo } from 'react';
import { Stack, Card, Box, Table, Text, Group } from '@mantine/core';
import type { LedgerEntry } from '../hooks/useLedger';

interface LedgerListTableProps {
  entries: LedgerEntry[];
  filteredEntries: LedgerEntry[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
}

export const LedgerListTable = memo(function LedgerListTable({
  entries,
  filteredEntries,
  formatDate,
  formatCurrency,
}: LedgerListTableProps) {
  const totals = filteredEntries.reduce(
    (acc, entry) => {
      acc.debit += entry.debit;
      acc.credit += entry.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  const commonHeaderStyle = {
    padding: '16px 12px',
    color: '#495057',
    backgroundColor: '#f1f3f5',
    width: '14.28%', // keep every column visually consistent
  } as const;

  return (
    <Stack gap="md">
      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '73vh' }}
      >
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <Table
            highlightOnHover
            withTableBorder
            style={{ tableLayout: 'fixed' }}
          >
            <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
              <Table.Tr>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  DATE
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  REF
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  ACCOUNT
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'right' }}>
                  DEBIT (₱)
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'right' }}>
                  CREDIT (₱)
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'right' }}>
                  BALANCE (₱)
                </Table.Th>
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  DESCRIPTION
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEntries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No ledger entries found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredEntries.map((entry) => (
                  <Table.Tr key={entry.id}>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {formatDate(entry.date)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center', color: '#495057' }}>
                      {entry.ref}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500} c="#495057">
                        {entry.account}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {entry.debit ? formatCurrency(entry.debit) : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {entry.credit ? formatCurrency(entry.credit) : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {entry.balance !== undefined
                          ? formatCurrency(entry.balance)
                          : '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2} c="#495057">
                        {entry.description}
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
            Showing {filteredEntries.length} of {entries.length} lines
          </Text>
          <Group gap="lg">
            <Text size="sm" fw={600}>
              Debit Total: {formatCurrency(totals.debit)}
            </Text>
            <Text size="sm" fw={600}>
              Credit Total: {formatCurrency(totals.credit)}
            </Text>
          </Group>
        </Group>
      </Card>
    </Stack>
  );
});
