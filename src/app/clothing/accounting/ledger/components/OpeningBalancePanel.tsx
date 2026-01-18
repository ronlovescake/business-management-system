import {
  Alert,
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
import { IconAlertTriangle, IconBulb, IconPlus } from '@tabler/icons-react';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { logger } from '@/lib/logger';

interface OpeningBalanceEntry {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description?: string;
}

interface OpeningBalancePanelProps {
  onAddOpeningEntry: () => void;
  cutoverDate?: string;
  entries?: OpeningBalanceEntry[];
  isLoading?: boolean;
  formatCurrency?: (amount: number) => string;
  formatDate?: (date: string) => string;
  onEditEntry: (entry: OpeningBalanceEntry) => void;
  onDeleteEntry: (entry: OpeningBalanceEntry) => Promise<void>;
  isSaving?: boolean;
}

export function OpeningBalancePanel({
  onAddOpeningEntry,
  cutoverDate,
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
  onEditEntry,
  onDeleteEntry,
  isSaving = false,
}: OpeningBalancePanelProps) {
  const inferredCutoverDate = entries
    .map((entry) => entry.date?.slice(0, 10))
    .filter(Boolean)
    .sort()[0];
  const effectiveCutoverDate = inferredCutoverDate ?? cutoverDate;
  const cutoverDateLabel = effectiveCutoverDate ?? 'the cutover date';

  const commonHeaderStyle = {
    padding: '16px 12px',
    color: '#495057',
    backgroundColor: '#f1f3f5',
    width: '14.28%', // seven columns, equal width
  } as const;

  const cutoverWarnings = (() => {
    if (!effectiveCutoverDate) {
      return [];
    }

    const cutoverEntries = entries.filter(
      (entry) => entry.date?.slice(0, 10) === effectiveCutoverDate
    );

    const byAccount = new Map<
      string,
      { debitTotal: number; creditTotal: number; count: number }
    >();

    for (const entry of cutoverEntries) {
      const key = entry.account;
      const current = byAccount.get(key) ?? {
        debitTotal: 0,
        creditTotal: 0,
        count: 0,
      };

      byAccount.set(key, {
        debitTotal: current.debitTotal + (entry.debit || 0),
        creditTotal: current.creditTotal + (entry.credit || 0),
        count: current.count + 1,
      });
    }

    return Array.from(byAccount.entries())
      .map(([account, totals]) => ({ account, ...totals }))
      .filter((row) => row.debitTotal > 0 && row.creditTotal > 0)
      .sort((a, b) => a.account.localeCompare(b.account));
  })();

  const handleDelete = async (entry: OpeningBalanceEntry) => {
    const confirmed = await confirmTripleDelete({
      title: 'Delete opening entry?',
      warning: 'This will remove the opening balance line permanently.',
      secondaryWarning: 'Deleting will change your opening balances.',
      finalPrompt: 'Type DELETE to confirm.',
      confirmWord: 'DELETE',
    });

    if (!confirmed) {
      return;
    }

    try {
      await onDeleteEntry(entry);
    } catch (error) {
      // Notification is handled upstream; swallow to avoid unhandled rejections
      logger.error('Failed to delete opening entry', { error });
    }
  };

  return (
    <Stack gap="md">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Text fw={700} size="lg" c="gray.8">
              Opening Balance
            </Text>
            <Text c="dimmed" size="sm">
              Capture your starting balances as of {cutoverDateLabel} so the
              ledger and balance sheet begin from a clean cutover.
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
            dated {cutoverDateLabel}.
          </List.Item>
          <List.Item>
            Each row is one account line. To set an opening loan balance, add
            two rows: credit the Loan Payable account and debit Opening Equity
            (same amount).
          </List.Item>
          <List.Item>
            These entries are manual only; they will not flow through P&L.
          </List.Item>
          <List.Item>
            Once saved, they will appear in ledger and balance sheet alongside
            system-generated entries.
          </List.Item>
        </List>

        {cutoverWarnings.length > 0 && (
          <Alert
            color="yellow"
            icon={<IconAlertTriangle size={16} />}
            title="Potential opening balance cancellation"
            mt="sm"
          >
            <Text size="sm">
              On {cutoverDateLabel}, these accounts have both debit and credit
              opening lines. This often cancels the starting balance (like a
              loan opening posted twice). Usually you want one side on the
              account, and the offset goes to Opening Equity.
            </Text>

            <Table withTableBorder mt="sm" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Account</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Debit</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Credit</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Net</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cutoverWarnings.map((row) => (
                  <Table.Tr key={row.account}>
                    <Table.Td>
                      <Text size="sm" fw={600} c="#495057">
                        {row.account}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{formatCurrency(row.debitTotal)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">{formatCurrency(row.creditTotal)}</Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text size="sm">
                        {formatCurrency(row.debitTotal - row.creditTotal)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Alert>
        )}
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
                <Table.Th style={{ ...commonHeaderStyle, textAlign: 'center' }}>
                  ACTIONS
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Loading opening balance entries...
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : entries.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
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
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => onEditEntry(entry)}
                          disabled={isSaving}
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() => handleDelete(entry)}
                          loading={isSaving}
                        >
                          Delete
                        </Button>
                      </Group>
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
