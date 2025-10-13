import React from 'react';
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
import {
  IconReceipt,
  IconCheck,
  IconX,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { Expense } from '../hooks/useExpenses';

interface ExpenseListTableProps {
  expenses: Expense[];
  filteredExpenses: Expense[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
  onViewReceipt: (receiptName: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: string) => void;
}

/**
 * ExpenseListTable Component
 *
 * Renders the main expense list table with:
 * - Date, Amount, Description, Category, Notes, Receipt, Actions
 * - Approve/Reject buttons for pending expenses
 * - Edit and Delete actions
 */
export function ExpenseListTable({
  expenses,
  filteredExpenses,
  formatDate,
  formatCurrency,
  getCategoryColor,
  onViewReceipt,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: ExpenseListTableProps) {
  return (
    <Stack gap="md">
      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '71vh' }}
      >
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <Table highlightOnHover withTableBorder>
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
                  DATE
                </Table.Th>
                <Table.Th
                  style={{
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
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  DESCRIPTION
                </Table.Th>
                <Table.Th
                  style={{
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  CATEGORY
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
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  RECEIPT
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
              {filteredExpenses.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No expenses found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <Table.Tr key={expense.id}>
                    <Table.Td style={{ color: '#495057' }}>
                      {formatDate(expense.date)}
                    </Table.Td>
                    <Table.Td>
                      <Text fw={600} c="#495057">
                        {formatCurrency(expense.amount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500} c="#495057">
                          {expense.description}
                        </Text>
                        {expense.employeeName && (
                          <Text size="xs" c="dimmed">
                            {expense.employeeName}
                          </Text>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getCategoryColor(expense.category)}
                        variant="light"
                      >
                        {expense.category}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2} c="#495057">
                        {expense.notes || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {expense.receipt ? (
                        <Group
                          gap="xs"
                          style={{ cursor: 'pointer' }}
                          onClick={() => onViewReceipt(expense.receipt!)}
                        >
                          <IconReceipt size={16} color="#495057" />
                          <Text
                            size="xs"
                            c="#495057"
                            style={{ textDecoration: 'underline' }}
                          >
                            {expense.receipt}
                          </Text>
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          No receipt
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        {expense.status === 'pending' && (
                          <>
                            <Tooltip label="Approve">
                              <ActionIcon
                                color="green"
                                variant="light"
                                size="sm"
                                onClick={() => onApprove(expense.id)}
                              >
                                <IconCheck size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Reject">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => onReject(expense.id)}
                              >
                                <IconX size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </>
                        )}
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => onEdit(expense)}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => onDelete(expense.id)}
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

      {/* Summary */}
      <Card withBorder padding="md">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Showing {filteredExpenses.length} of {expenses.length} expenses
          </Text>
          <Text size="sm" fw={600}>
            Filtered Total:{' '}
            {formatCurrency(
              filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
            )}
          </Text>
        </Group>
      </Card>
    </Stack>
  );
}
