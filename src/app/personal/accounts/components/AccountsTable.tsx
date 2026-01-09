'use client';

import React from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconEdit, IconPlus, IconSearch } from '@tabler/icons-react';
import type {
  PersonalAccountDraft,
  PersonalAccountType,
} from './AccountFormDialog';

export interface PersonalAccountRow extends PersonalAccountDraft {
  id: string;
  isActive: boolean;
}

function labelForType(type: PersonalAccountType): string {
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

interface AccountsTableProps {
  accounts: PersonalAccountRow[];
  search: string;
  onSearchChange: (next: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const AccountsTable = React.memo(function AccountsTable({
  accounts,
  search,
  onSearchChange,
  onAdd,
  onEdit,
}: AccountsTableProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            <Text fw={700}>Accounts</Text>
            <Text size="sm" c="dimmed">
              Create your personal accounts (cash, bank, e-wallet, credit,
              loans).
            </Text>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={onAdd}>
            Add Account
          </Button>
        </Group>

        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Search accounts…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <Table highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Institution</Table.Th>
              <Table.Th>Last 4</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 60 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    No accounts yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              accounts.map((acc) => (
                <Table.Tr key={acc.id}>
                  <Table.Td>
                    <Text fw={600}>{acc.name}</Text>
                  </Table.Td>
                  <Table.Td>{labelForType(acc.type)}</Table.Td>
                  <Table.Td>{acc.institution || '-'}</Table.Td>
                  <Table.Td>{acc.accountNumberLast4 || '-'}</Table.Td>
                  <Table.Td>
                    {acc.isActive ? (
                      <Badge color="green" variant="light">
                        Active
                      </Badge>
                    ) : (
                      <Badge color="gray" variant="light">
                        Inactive
                      </Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap={0}>
                      <ActionIcon
                        variant="subtle"
                        aria-label="Edit account"
                        onClick={() => onEdit(acc.id)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Stack>
    </Paper>
  );
});
