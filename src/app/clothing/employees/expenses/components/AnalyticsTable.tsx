import React from 'react';
import { Card, Box, Table, Text, Badge, Group, Progress } from '@mantine/core';
import { MonthlyBreakdown } from '../hooks/useExpenses';

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
export function AnalyticsTable({
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
    <Card withBorder padding={0} style={{ overflow: 'hidden', height: '71vh' }}>
      <Box style={{ height: '100%', overflowX: 'auto', overflowY: 'auto' }}>
        <Table highlightOnHover withTableBorder style={{ minWidth: '1400px' }}>
          <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
            <Table.Tr>
              <Table.Th
                style={{
                  padding: '16px 12px',
                  color: '#495057',
                  backgroundColor: '#f1f3f5',
                  textAlign: 'center',
                }}
              >
                CATEGORIES
              </Table.Th>
              <Table.Th
                style={{
                  textAlign: 'center',
                  padding: '16px 12px',
                  color: '#495057',
                  width: '750px',
                  backgroundColor: '#f1f3f5',
                }}
              >
                PERCENTAGE
              </Table.Th>
              <Table.Th
                style={{
                  textAlign: 'center',
                  padding: '16px 12px',
                  color: '#495057',
                  width: '150px',
                  backgroundColor: '#f1f3f5',
                }}
              >
                TOTAL EXPENSES
              </Table.Th>
              {months.map((month) => (
                <Table.Th
                  key={month}
                  style={{
                    textAlign: 'center',
                    padding: '16px 12px',
                    color: '#495057',
                    width: '150px',
                    backgroundColor: '#f1f3f5',
                  }}
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
                    <Text size="sm" fw={500} c="#495057">
                      {row.percentage.toFixed(1)}%
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text fw={700} c="#495057">
                    {formatCurrency(row.total)}
                  </Text>
                </Table.Td>
                {months.map((month) => (
                  <Table.Td key={month} style={{ textAlign: 'right' }}>
                    <Text size="sm" c="#495057">
                      {row[month] > 0 ? formatCurrency(row[month]) : '₱0.00'}
                    </Text>
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}

            {/* Total Row */}
            <Table.Tr style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}>
              <Table.Td>
                <Text fw={700} size="lg" c="#495057">
                  TOTAL
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center', width: '180px' }}>
                <Text fw={700} c="#495057">
                  100%
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right', width: '120px' }}>
                <Text fw={700} size="lg" c="#495057">
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
                    <Text fw={700} c="#495057">
                      {monthTotal > 0 ? formatCurrency(monthTotal) : '₱0.00'}
                    </Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Box>
    </Card>
  );
}
