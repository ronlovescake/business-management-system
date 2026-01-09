'use client';

import React from 'react';
import {
  ActionIcon,
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
  PersonalIncomeDraft,
  PersonalIncomeType,
} from './IncomeFormDialog';

export interface PersonalIncomeRow extends PersonalIncomeDraft {
  id: string;
}

function labelForType(type: PersonalIncomeType): string {
  switch (type) {
    case 'BUSINESS_DRAW':
      return 'Business Draw';
    case 'SALARY':
      return 'Salary';
    case 'FREELANCE':
      return 'Freelance';
    case 'GIFT':
      return 'Gift';
    case 'REFUND':
      return 'Refund';
    case 'OTHER':
      return 'Other';
    default:
      return type;
  }
}

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

interface IncomeTableProps {
  income: PersonalIncomeRow[];
  search: string;
  onSearchChange: (next: string) => void;
  onAdd: () => void;
  onEdit: (id: string) => void;
}

export const IncomeTable = React.memo(function IncomeTable({
  income,
  search,
  onSearchChange,
  onAdd,
  onEdit,
}: IncomeTableProps) {
  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-end">
          <Stack gap={2}>
            <Text fw={700}>Income</Text>
            <Text size="sm" c="dimmed">
              Track money coming into your household.
            </Text>
          </Stack>
          <Button leftSection={<IconPlus size={16} />} onClick={onAdd}>
            Add Income
          </Button>
        </Group>

        <TextInput
          leftSection={<IconSearch size={16} />}
          placeholder="Search income…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <Table highlightOnHover withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Type</Table.Th>
              <Table.Th>Account</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Notes</Table.Th>
              <Table.Th style={{ width: 60 }} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {income.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text size="sm" c="dimmed">
                    No income records yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              income.map((row) => (
                <Table.Tr key={row.id}>
                  <Table.Td>{row.date || '-'}</Table.Td>
                  <Table.Td>{labelForType(row.type)}</Table.Td>
                  <Table.Td>{row.account || '-'}</Table.Td>
                  <Table.Td>{currency.format(row.amount || 0)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={2}>
                      {row.notes || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group justify="flex-end" gap={0}>
                      <ActionIcon
                        variant="subtle"
                        aria-label="Edit income"
                        onClick={() => onEdit(row.id)}
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
