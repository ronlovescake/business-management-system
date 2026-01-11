'use client';

import { Badge, Card, Stack, Table, Text } from '@mantine/core';
import type {
  BudgetAnalyticsRow,
  BudgetStatus,
} from '../../hooks/usePersonalBudgetsView';

interface BudgetAnalyticsTableProps {
  analytics: BudgetAnalyticsRow[];
  formatCurrency: (amount: number) => string;
  statusColors: Record<BudgetStatus, string>;
}

export function BudgetAnalyticsTable({
  analytics,
  formatCurrency,
  statusColors,
}: BudgetAnalyticsTableProps) {
  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="md">
        <Text fw={600}>Category rollups</Text>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
            <Table.Tr>
              <Table.Th style={{ padding: '12px' }}>CATEGORY</Table.Th>
              <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                PLANNED
              </Table.Th>
              <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                ACTUAL
              </Table.Th>
              <Table.Th style={{ padding: '12px', textAlign: 'right' }}>
                VARIANCE
              </Table.Th>
              <Table.Th style={{ padding: '12px' }}>STATUS</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {analytics.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={5}
                  style={{ textAlign: 'center', padding: '18px' }}
                >
                  <Text c="dimmed">No analytics available.</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              analytics.map((row) => (
                <Table.Tr key={row.category}>
                  <Table.Td>{row.category}</Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatCurrency(row.planned)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    {formatCurrency(row.actual)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text
                      c={
                        row.variance > 0
                          ? 'red'
                          : row.variance < 0
                            ? 'teal'
                            : 'gray'
                      }
                    >
                      {formatCurrency(row.variance)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColors[row.status]} variant="light">
                      {row.status === 'on-track'
                        ? 'On track'
                        : row.status === 'over'
                          ? 'Over'
                          : 'Under'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
}
