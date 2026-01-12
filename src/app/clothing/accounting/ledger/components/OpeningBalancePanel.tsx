import {
  Card,
  Stack,
  Text,
  Button,
  Group,
  List,
  ThemeIcon,
  Table,
  Box,
} from '@mantine/core';
import { IconBulb, IconPlus } from '@tabler/icons-react';

interface OpeningBalanceEntry {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit?: number;
  credit?: number;
  description?: string;
}

interface OpeningBalancePanelProps {
  onAddOpeningEntry: () => void;
  entries?: OpeningBalanceEntry[];
  isLoading?: boolean;
  formatCurrency?: (amount: number) => string;
  formatDate?: (date: string) => string;
}

export function OpeningBalancePanel({
  onAddOpeningEntry,
  entries = [],
  isLoading = false,
  formatCurrency = (v) =>
    v.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }),
  formatDate = (d) =>
    new Date(d).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
}: OpeningBalancePanelProps) {
  const commonHeaderStyle = {
    padding: '16px 12px',
    color: '#495057',
    backgroundColor: '#f1f3f5',
    width: '16.66%', // six columns, equal width
  } as const;

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={700} size="lg" c="gray.8">
              Opening Balance
            </Text>
            <Text c="dimmed" size="sm">
              Capture your starting balances as of 2026-01-01 so the ledger and
              balance sheet begin from a clean cutover.
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={16} />}
            color="green"
            onClick={onAddOpeningEntry}
          >
            Add Opening Entry
          </Button>
        </Group>

        <List
          spacing="xs"
          size="sm"
          icon={
            <ThemeIcon color="blue" size={18} radius="xl">
              <IconBulb size={12} />
            </ThemeIcon>
          }
          c="gray.7"
          mt="sm"
        >
          <List.Item>
            Use one-time debits/credits (e.g., Cash, Inventory, Opening Equity)
            dated 2026-01-01.
          </List.Item>
          <List.Item>
            These entries are manual only; they will not flow through P&L.
          </List.Item>
          <List.Item>
            Once saved, they will appear in ledger and balance sheet alongside
            system-generated entries.
          </List.Item>
        </List>
      </Card>

      <Card
        withBorder
        padding={0}
        radius="md"
        style={{ overflow: 'hidden', height: '68vh' }}
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
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  DESCRIPTION
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Loading opening balance entries...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : entries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No opening balance entries yet. Click &quot;Add Opening
                      Entry&quot; to create the starting lines for 2026.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                entries.map((entry) => (
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
                        {entry.description || '—'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>
    </Stack>
  );
}
