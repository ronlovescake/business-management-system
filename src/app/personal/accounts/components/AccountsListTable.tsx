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
import type { PersonalAccountType } from './AccountFormDialog';

export interface PersonalAccountRow {
  id: string;
  name: string;
  type: PersonalAccountType;
  institution: string;
  accountNumberLast4: string;
  isActive: boolean;
  balance: number;
}

interface AccountsListTableProps {
  accounts: PersonalAccountRow[];
  filteredAccounts: PersonalAccountRow[];
  formatCurrency: (amount: number) => string;
  onEdit: (account: PersonalAccountRow) => void;
  onDelete: (id: string) => void;
}

function typeLabel(type: PersonalAccountType): string {
  switch (type) {
    case 'CASH':
      return 'Cash';
    case 'BANK':
      return 'Bank';
    case 'EWALLET':
      return 'E-wallet';
    case 'CREDIT_CARD':
      return 'Credit Card';
    case 'LOAN':
      return 'Loan';
    default:
      return type;
  }
}

export const AccountsListTable = memo(function AccountsListTable({
  accounts,
  filteredAccounts,
  formatCurrency,
  onEdit,
  onDelete,
}: AccountsListTableProps) {
  const filteredTotal = filteredAccounts.reduce(
    (sum, acc) => sum + (acc.balance || 0),
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
                    width: 320,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  NAME
                </Table.Th>
                <Table.Th
                  style={{
                    width: 220,
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
                    width: 260,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  INSTITUTION
                </Table.Th>
                <Table.Th
                  style={{
                    width: 200,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  LAST 4
                </Table.Th>
                <Table.Th
                  style={{
                    width: 220,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  STATUS
                </Table.Th>
                <Table.Th
                  style={{
                    width: 240,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  BALANCE
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
              {filteredAccounts.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No accounts found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredAccounts.map((account) => (
                  <Table.Tr key={account.id}>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      <Text fw={600} c="#495057">
                        {account.name}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {typeLabel(account.type)}
                    </Table.Td>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {account.institution || '-'}
                    </Table.Td>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {account.accountNumberLast4 || '-'}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} justify="center">
                        {account.isActive ? (
                          <Badge color="green" variant="light">
                            ACTIVE
                          </Badge>
                        ) : (
                          <Badge color="gray" variant="light">
                            INACTIVE
                          </Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {formatCurrency(account.balance || 0)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => onEdit(account)}
                            {...getActionLabel('Edit', 'account', account.name)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => onDelete(account.id)}
                            {...getActionLabel(
                              'Delete',
                              'account',
                              account.name
                            )}
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
            Showing {filteredAccounts.length} of {accounts.length} accounts
          </Text>
          <Text size="sm" fw={600}>
            Filtered Total: {formatCurrency(filteredTotal)}
          </Text>
        </Group>
      </Card>
    </Stack>
  );
});
