import { memo } from 'react';
import { Stack, Card, Box, Table, Text, Group } from '@mantine/core';
import type { JournalEntry } from '../../hooks/useJournal';

interface JournalListTableProps {
  entries: JournalEntry[];
  filteredEntries: JournalEntry[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
}

export const JournalListTable = memo(function JournalListTable({
  entries,
  filteredEntries,
  formatDate,
  formatCurrency,
}: JournalListTableProps) {
  const totals = filteredEntries.reduce(
    (acc, entry) => {
      acc.debit += entry.debit;
      acc.credit += entry.credit;
      return acc;
    },
    { debit: 0, credit: 0 }
  );

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
                    width: 220,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  DATE
                </Table.Th>
                <Table.Th
                  style={{
                    width: 120,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  REF
                </Table.Th>
                <Table.Th
                  style={{
                    width: 240,
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
                    textAlign: 'right',
                  }}
                >
                  DEBIT (₱)
                </Table.Th>
                <Table.Th
                  style={{
                    width: 180,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'right',
                  }}
                >
                  CREDIT (₱)
                </Table.Th>
                <Table.Th
                  style={{
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  DESCRIPTION
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEntries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No journal entries found
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
