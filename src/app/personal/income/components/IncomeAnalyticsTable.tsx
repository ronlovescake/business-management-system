import { memo, useMemo } from 'react';
import { Card, Box, Table, Text, Badge, Group, Progress } from '@mantine/core';
import type { PersonalIncomeRow } from './IncomeListTable';

interface IncomeAnalyticsTableProps {
  income: PersonalIncomeRow[];
  formatCurrency: (amount: number) => string;
}

function colorForType(type: string): string {
  switch (type) {
    case 'BUSINESS_DRAW':
      return 'blue';
    case 'SALARY':
      return 'green';
    case 'FREELANCE':
      return 'teal';
    case 'GIFT':
      return 'grape';
    case 'CASHBACK':
      return 'lime';
    case 'REFUND':
      return 'orange';
    case 'OTHER':
      return 'gray';
    default:
      return 'gray';
  }
}

export const IncomeAnalyticsTable = memo(function IncomeAnalyticsTable({
  income,
  formatCurrency,
}: IncomeAnalyticsTableProps) {
  const rows = useMemo(() => {
    const map = new Map<
      string,
      { type: string; count: number; total: number; percentage: number }
    >();

    const totalIncome = income.reduce((sum, r) => sum + (r.amount || 0), 0);

    for (const r of income) {
      const key = r.type;
      const existing = map.get(key) ?? {
        type: key,
        count: 0,
        total: 0,
        percentage: 0,
      };
      existing.count += 1;
      existing.total += r.amount || 0;
      map.set(key, existing);
    }

    const list = Array.from(map.values()).map((row) => ({
      ...row,
      percentage: totalIncome > 0 ? (row.total / totalIncome) * 100 : 0,
    }));

    list.sort((a, b) => b.total - a.total);
    return { list, totalIncome };
  }, [income]);

  return (
    <Card withBorder padding={0} style={{ overflow: 'hidden', height: '71vh' }}>
      <Box style={{ height: '100%', overflowX: 'auto', overflowY: 'auto' }}>
        <Table highlightOnHover withTableBorder style={{ minWidth: '900px' }}>
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
                INCOME TYPE
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
                COUNT
              </Table.Th>
              <Table.Th
                style={{
                  textAlign: 'center',
                  padding: '16px 12px',
                  color: '#495057',
                  width: '400px',
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
                  width: '200px',
                  backgroundColor: '#f1f3f5',
                }}
              >
                TOTAL INCOME
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.list.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No data
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              rows.list.map((row) => (
                <Table.Tr key={row.type}>
                  <Table.Td>
                    <Badge
                      color={colorForType(row.type)}
                      variant="light"
                      size="lg"
                    >
                      {row.type}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Text fw={600} c="#495057">
                      {row.count}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Group justify="center" gap="xs">
                      <Progress
                        value={row.percentage}
                        size="sm"
                        radius="xl"
                        color={colorForType(row.type)}
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
                </Table.Tr>
              ))
            )}

            <Table.Tr style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}>
              <Table.Td>
                <Text fw={700} size="lg" c="#495057">
                  TOTAL
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text fw={700} c="#495057">
                  {income.length}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text fw={700} c="#495057">
                  100%
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text fw={700} size="lg" c="#495057">
                  {formatCurrency(rows.totalIncome)}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Box>
    </Card>
  );
});
