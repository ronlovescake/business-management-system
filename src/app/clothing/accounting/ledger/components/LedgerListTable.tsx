import { memo } from 'react';
import { Stack, Table, Text, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { getActionLabel } from '@/lib/accessibility';
import type { LedgerEntry } from '../hooks/useLedger';
import { AccountingTableCard } from '../../components/AccountingTableCard';
import { AccountingTableSummaryCard } from '../../components/AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_CENTER_STYLE,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from '../../components/accountingTableStyles';

interface LedgerListTableProps {
  entries: LedgerEntry[];
  filteredEntries: LedgerEntry[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  onEditManualEntry?: (entry: LedgerEntry) => void;
  onDeleteManualEntry?: (entry: LedgerEntry) => void;
  onEditTransitBuildEntry?: (entry: LedgerEntry) => void;
  onDeleteTransitBuildEntry?: (entry: LedgerEntry) => void;
}

export const LedgerListTable = memo(function LedgerListTable({
  entries,
  filteredEntries,
  formatDate,
  formatCurrency,
  onEditManualEntry,
  onDeleteManualEntry,
  onEditTransitBuildEntry,
  onDeleteTransitBuildEntry,
}: LedgerListTableProps) {
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
      <AccountingTableCard>
        <Table
          highlightOnHover
          withTableBorder
          style={{ tableLayout: 'fixed' }}
        >
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: '14%' })}>
                DATE
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: '14%' })}>
                REF
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: '12%' })}>
                ACCOUNT
              </Table.Th>
              <Table.Th
                style={accountingThStyle({ width: '10%', textAlign: 'right' })}
              >
                DEBIT (₱)
              </Table.Th>
              <Table.Th
                style={accountingThStyle({ width: '10%', textAlign: 'right' })}
              >
                CREDIT (₱)
              </Table.Th>
              <Table.Th
                style={accountingThStyle({ width: '12%', textAlign: 'right' })}
              >
                BALANCE (₱)
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: '28%' })}>
                DESCRIPTION
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: '10%' })}>
                ACTIONS
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredEntries.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No ledger entries found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredEntries.map((entry) => (
                // Only manual lines are editable/deletable.
                <Table.Tr key={entry.id}>
                  <Table.Td style={ACCOUNTING_TABLE_TD_CENTER_STYLE}>
                    {formatDate(entry.date)}
                  </Table.Td>
                  <Table.Td style={ACCOUNTING_TABLE_TD_CENTER_STYLE}>
                    {entry.ref}
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
                      {entry.account}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {entry.debit ? formatCurrency(entry.debit) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {entry.credit ? formatCurrency(entry.credit) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {entry.balance !== undefined
                        ? formatCurrency(entry.balance)
                        : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      lineClamp={2}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
                      {entry.description}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center">
                      {entry.sourceType === 'MANUAL' &&
                        entry.systemGenerated === false &&
                        entry.sourceId && (
                          <>
                            <Tooltip label="Edit">
                              <ActionIcon
                                color="blue"
                                variant="light"
                                size="sm"
                                onClick={() => onEditManualEntry?.(entry)}
                                {...getActionLabel(
                                  'Edit',
                                  'manual journal entry',
                                  entry.ref
                                )}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => onDeleteManualEntry?.(entry)}
                                {...getActionLabel(
                                  'Delete',
                                  'manual journal entry',
                                  entry.ref
                                )}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}

                      {entry.sourceType === 'TRANSIT_BUILD' &&
                        (entry.transitBuildEntryIds?.length ?? 0) > 0 && (
                          <>
                            {(entry.transitBuildEntryIds?.length ?? 0) ===
                              1 && (
                              <Tooltip label="Edit">
                                <ActionIcon
                                  color="blue"
                                  variant="light"
                                  size="sm"
                                  onClick={() =>
                                    onEditTransitBuildEntry?.(entry)
                                  }
                                  {...getActionLabel(
                                    'Edit',
                                    'transit build-up entry',
                                    entry.ref
                                  )}
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                              </Tooltip>
                            )}
                            <Tooltip label="Delete">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() =>
                                  onDeleteTransitBuildEntry?.(entry)
                                }
                                {...getActionLabel(
                                  'Delete',
                                  'transit build-up entry',
                                  entry.ref
                                )}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </AccountingTableCard>

      <AccountingTableSummaryCard
        leftText={`Showing ${filteredEntries.length} of ${entries.length} lines`}
        items={[
          { label: 'Debit Total:', value: formatCurrency(totals.debit) },
          { label: 'Credit Total:', value: formatCurrency(totals.credit) },
        ]}
      />
    </Stack>
  );
});
