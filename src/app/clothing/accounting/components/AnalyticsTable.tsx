import { memo } from 'react';
import { Table, Text, Badge, Group, Progress } from '@mantine/core';
import type { MonthlyBreakdown } from '../hooks/useExpenses';
import { AccountingTableCard } from './AccountingTableCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from './accountingTableStyles';

interface AnalyticsTableProps {
  monthlyBreakdown: MonthlyBreakdown[];
  totalExpenses: number;
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
}

/**
 * AnalyticsTable Component
 *
 * Displays expense analytics by category with monthly breakdown
 */
export const AnalyticsTable = memo(function AnalyticsTable({
  monthlyBreakdown,
  totalExpenses,
  formatCurrency,
  getCategoryColor,
}: AnalyticsTableProps) {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ] as const;

  return (
    <AccountingTableCard height="71vh" overflowX="auto" overflowY="auto">
      <Table highlightOnHover withTableBorder style={{ minWidth: '1400px' }}>
        <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
          <Table.Tr>
            <Table.Th style={accountingThStyle()}>CATEGORIES</Table.Th>
            <Table.Th style={accountingThStyle({ width: '750px' })}>
              PERCENTAGE
            </Table.Th>
            <Table.Th style={accountingThStyle({ width: '150px' })}>
              TOTAL EXPENSES
            </Table.Th>
            {months.map((month) => (
              <Table.Th
                key={month}
                style={accountingThStyle({ width: '150px' })}
              >
                {month.substring(0, 3).toUpperCase()}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {monthlyBreakdown.map((row) => (
            <Table.Tr key={row.category}>
              <Table.Td>
                <Badge
                  color={getCategoryColor(row.category)}
                  variant="light"
                  size="lg"
                >
                  {row.category}
                </Badge>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Group justify="center" gap="xs">
                  <Progress
                    value={row.percentage}
                    size="sm"
                    radius="xl"
                    color={getCategoryColor(row.category)}
                    style={{ flex: 1, minWidth: 80, maxWidth: 500 }}
                  />
                  <Text
                    size="sm"
                    fw={500}
                    c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                  >
                    {row.percentage.toFixed(1)}%
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text fw={700} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                  {formatCurrency(row.total)}
                </Text>
              </Table.Td>
              {months.map((month) => (
                <Table.Td key={month} style={{ textAlign: 'right' }}>
                  <Text size="sm" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                    {row[month] > 0 ? formatCurrency(row[month]) : '₱0.00'}
                  </Text>
                </Table.Td>
              ))}
            </Table.Tr>
          ))}

          {/* Total Row */}
          <Table.Tr style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}>
            <Table.Td>
              <Text fw={700} size="lg" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                TOTAL
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'center', width: '180px' }}>
              <Text fw={700} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                100%
              </Text>
            </Table.Td>
            <Table.Td style={{ textAlign: 'right', width: '120px' }}>
              <Text fw={700} size="lg" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                {formatCurrency(totalExpenses)}
              </Text>
            </Table.Td>
            {months.map((month) => {
              const monthTotal = monthlyBreakdown.reduce(
                (sum, row) => sum + (row[month] || 0),
                0
              );
              return (
                <Table.Td
                  key={month}
                  style={{ textAlign: 'right', width: '110px' }}
                >
                  <Text fw={700} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                    {monthTotal > 0 ? formatCurrency(monthTotal) : '₱0.00'}
                  </Text>
                </Table.Td>
              );
            })}
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </AccountingTableCard>
  );
});
