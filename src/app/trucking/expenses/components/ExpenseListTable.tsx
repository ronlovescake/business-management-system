import { memo, type CSSProperties } from 'react';
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
import { getActionLabel } from '@/lib/accessibility';
import type { Expense } from '../hooks/useExpenses';

interface ExpenseListTableProps {
  expenses: Expense[];
  filteredExpenses: Expense[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
  getSourceLabel: (expense: Expense) => string;
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
export const ExpenseListTable = memo(function ExpenseListTable({
  expenses,
  filteredExpenses,
  formatDate,
  formatCurrency,
  getCategoryColor,
  getSourceLabel,
  onViewReceipt,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: ExpenseListTableProps) {
  const headerCellStyles: CSSProperties = {
    padding: '16px 12px',
    color: '#495057',
    backgroundColor: '#f1f3f5',
    textAlign: 'center',
    borderBottom: '1px solid #dee2e6',
  };

  return (
    <Stack gap="md">
      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '73vh' }}
      >
        <Box
          style={{
            height: '100%',
            overflowY: 'auto',
            position: 'relative',
            backgroundColor: '#fff',
          }}
        >
          <Table
            highlightOnHover
            withTableBorder
            style={{ borderCollapse: 'separate', borderSpacing: 0 }}
          >
            <Table.Thead
              style={{
                backgroundColor: '#f1f3f5',
                position: 'sticky',
                top: 0,
                zIndex: 6,
                boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
              }}
            >
              <Table.Tr>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 300,
                  }}
                >
                  DATE
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 300,
                  }}
                >
                  AMOUNT
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                  }}
                >
                  DESCRIPTION
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 300,
                  }}
                >
                  CATEGORY
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                  }}
                >
                  NOTES
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 220,
                  }}
                >
                  VEHICLE / ASSET
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 280,
                  }}
                >
                  SOURCE
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 300,
                  }}
                >
                  RECEIPT
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 300,
                  }}
                >
                  LOGGED BY
                </Table.Th>
                <Table.Th
                  style={{
                    ...headerCellStyles,
                    width: 150,
                  }}
                >
                  ACTION
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredExpenses.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      No expenses found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <Table.Tr key={expense.id}>
                    <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
                      {formatDate(expense.date)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <Text fw={600} c="#495057">
                        {formatCurrency(expense.amount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500} c="#495057">
                        {expense.description}
                      </Text>
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
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {expense.vehicleId || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Badge
                        color={expense.systemGenerated ? 'blue' : 'gray'}
                        variant="light"
                      >
                        {getSourceLabel(expense)}
                      </Badge>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      {expense.receipt ? (
                        <Group
                          gap="xs"
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            if (expense.receipt) {
                              onViewReceipt(expense.receipt);
                            }
                          }}
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
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {expense.employeeName || '—'}
                      </Text>
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
                                {...getActionLabel(
                                  'Approve',
                                  'expense',
                                  `${expense.employeeName || 'Unknown'} - ${expense.category}`
                                )}
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
                                {...getActionLabel(
                                  'Reject',
                                  'expense',
                                  `${expense.employeeName || 'Unknown'} - ${expense.category}`
                                )}
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
                            {...getActionLabel(
                              'Edit',
                              'expense',
                              `${expense.employeeName || 'Unknown'} - ${expense.category}`
                            )}
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
                            {...getActionLabel(
                              'Delete',
                              'expense',
                              `${expense.employeeName || 'Unknown'} - ${expense.category}`
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
});
