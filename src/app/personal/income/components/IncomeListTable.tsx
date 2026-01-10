import { memo } from 'react';
import {
  Stack,
  Card,
  Box,
  Table,
  Text,
  Group,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { getActionLabel } from '@/lib/accessibility';
import type { PersonalIncomeType } from './IncomeFormDialog';

export interface PersonalIncomeRow {
  id: string;
  date: string;
  type: PersonalIncomeType;
  amount: number;
  account: string;
  accountId?: string | null;
  notes: string;
}

interface IncomeListTableProps {
  income: PersonalIncomeRow[];
  filteredIncome: PersonalIncomeRow[];
  formatCurrency: (amount: number) => string;
  onEdit: (row: PersonalIncomeRow) => void;
  onDelete: (id: string) => void;
}

function typeLabel(type: PersonalIncomeType): string {
  switch (type) {
    case 'BUSINESS_DRAW':
      return 'BUSINESS DRAW';
    case 'SALARY':
      return 'SALARY';
    case 'FREELANCE':
      return 'FREELANCE';
    case 'GIFT':
      return 'GIFT';
    case 'REFUND':
      return 'REFUND';
    case 'OTHER':
      return 'OTHER';
    default:
      return type;
  }
}

export const IncomeListTable = memo(function IncomeListTable({
  income,
  filteredIncome,
  formatCurrency,
  onEdit,
  onDelete,
}: IncomeListTableProps) {
  const filteredTotal = filteredIncome.reduce(
    (sum, row) => sum + (row.amount || 0),
    0
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
                    width: 300,
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
                    width: 300,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  AMOUNT
                </Table.Th>
                <Table.Th
                  style={{
                    width: 300,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  TYPE
                </Table.Th>
                <Table.Th
                  style={{
                    width: 300,
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
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  NOTES
                </Table.Th>
                <Table.Th
                  style={{
                    width: 150,
                    textAlign: 'center',
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                  }}
                >
                  ACTION
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredIncome.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No income found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredIncome.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {row.date || '-'}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {formatCurrency(row.amount || 0)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge color="blue" variant="light">
                        {typeLabel(row.type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {row.account || '-'}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2} c="#495057">
                        {row.notes || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => onEdit(row)}
                            {...getActionLabel('Edit', 'income', row.date)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => onDelete(row.id)}
                            {...getActionLabel('Delete', 'income', row.date)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
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
            Showing {filteredIncome.length} of {income.length} income entries
          </Text>
          <Text size="sm" fw={600}>
            Filtered Total: {formatCurrency(filteredTotal)}
          </Text>
        </Group>
      </Card>
    </Stack>
  );
});
