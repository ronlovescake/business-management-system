import { memo, useMemo, useState } from 'react';
import { Stack, Table, Text, Badge, Button, Modal } from '@mantine/core';
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
  const [detailsRow, setDetailsRow] = useState<BalanceSheetRow | null>(null);

  const detailItems = detailsRow?.details ?? [];

  const toDisplayAmount = (row: BalanceSheetRow, amount: number) =>
    row.type === 'Asset' ? amount : -amount;

  const hasAnyDetails = useMemo(
    () => filteredRows.some((row) => (row.details?.length ?? 0) > 0),
    [filteredRows]
  );

  const totalsSigned = filteredRows.reduce(
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

  // With signed balances (debit positive, credit negative): Assets + Liabilities + Equity = 0.
  const balance =
    totalsSigned.assets + totalsSigned.liabilities + totalsSigned.equity;

  // Display balances (common accounting view):
  // - Assets: debit-balance positive
  // - Liabilities/Equity: credit-balance positive
  const totalsDisplay = {
    assets: totalsSigned.assets,
    liabilities: -totalsSigned.liabilities,
    equity: -totalsSigned.equity,
  };

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
              {hasAnyDetails && (
                <Table.Th style={accountingThStyle({ width: 160 })}>
                  DETAILS
                </Table.Th>
              )}
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
                <Table.Td
                  colSpan={hasAnyDetails ? 4 : 3}
                  style={{ textAlign: 'center' }}
                >
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
                  {hasAnyDetails && (
                    <Table.Td>
                      {(row.details?.length ?? 0) > 0 ? (
                        <Button
                          size="xs"
                          variant="subtle"
                          onClick={() => setDetailsRow(row)}
                        >
                          View
                        </Button>
                      ) : (
                        <Text size="sm" c="dimmed">
                          —
                        </Text>
                      )}
                    </Table.Td>
                  )}
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {formatCurrency(toDisplayAmount(row, row.amount))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </AccountingTableCard>

      <Modal
        opened={Boolean(detailsRow)}
        onClose={() => setDetailsRow(null)}
        title={detailsRow ? `${detailsRow.account} details` : 'Details'}
        size="md"
      >
        {detailItems.length === 0 ? (
          <Text c="dimmed">No details available.</Text>
        ) : (
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>TAG</Table.Th>
                <Table.Th style={{ textAlign: 'right' }}>AMOUNT (₱)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detailItems.map((item) => (
                <Table.Tr key={item.label}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {item.label}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600}>
                      {formatCurrency(
                        detailsRow
                          ? toDisplayAmount(detailsRow, item.amount)
                          : item.amount
                      )}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Modal>

      <AccountingTableSummaryCard
        leftText={`Showing ${filteredRows.length} of ${rows.length} accounts`}
        items={[
          { label: 'Assets:', value: formatCurrency(totalsDisplay.assets) },
          {
            label: 'Liabilities:',
            value: formatCurrency(totalsDisplay.liabilities),
          },
          { label: 'Equity:', value: formatCurrency(totalsDisplay.equity) },
          { label: 'Balance:', value: formatCurrency(balance) },
        ]}
      />
    </Stack>
  );
});
