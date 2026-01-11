'use client';

import { Badge, Card, Stack, Table, Text } from '@mantine/core';
import type {
  BudgetDisplayRow,
  BudgetStatus,
} from '../../hooks/usePersonalBudgetsView';

interface BudgetListTableProps {
  budgets: BudgetDisplayRow[];
  formatCurrency: (amount: number) => string;
  statusColors: Record<BudgetStatus, string>;
}

export function BudgetListTable({
  budgets,
  formatCurrency,
  statusColors,
}: BudgetListTableProps) {
  return (
    <Card withBorder padding={0} radius="md">
      <Table highlightOnHover withTableBorder>
        <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
          <Table.Tr>
            <Table.Th style={{ padding: '12px' }}>CATEGORY</Table.Th>
            <Table.Th style={{ padding: '12px' }}>PERIOD</Table.Th>
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
            <Table.Th style={{ padding: '12px' }}>ACCOUNT</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {budgets.length === 0 ? (
            <Table.Tr>
              <Table.Td
                colSpan={7}
                style={{ textAlign: 'center', padding: '18px' }}
              >
                <Text c="dimmed">
                  No budgets found for the selected filters.
                </Text>
              </Table.Td>
            </Table.Tr>
          ) : (
            budgets.map((budget) => (
              <Table.Tr key={budget.id}>
                <Table.Td>
                  <Stack gap={2}>
                    <Text fw={600}>{budget.category}</Text>
                    {budget.notes ? (
                      <Text size="xs" c="dimmed">
                        {budget.notes}
                      </Text>
                    ) : null}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Badge color="gray" variant="light">
                    {budget.period === 'monthly' ? budget.monthLabel : 'Annual'}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  {formatCurrency(budget.planned)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  {formatCurrency(budget.actual)}
                </Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text
                    c={
                      budget.variance > 0
                        ? 'red'
                        : budget.variance < 0
                          ? 'teal'
                          : 'gray'
                    }
                  >
                    {formatCurrency(budget.variance)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[budget.status]} variant="light">
                    {budget.status === 'on-track'
                      ? 'On track'
                      : budget.status === 'over'
                        ? 'Over'
                        : 'Under'}
                  </Badge>
                </Table.Td>
                <Table.Td>{budget.account ?? '—'}</Table.Td>
              </Table.Tr>
            ))
          )}
        </Table.Tbody>
      </Table>
    </Card>
  );
}
