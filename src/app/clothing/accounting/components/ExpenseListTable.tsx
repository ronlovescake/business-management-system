import { memo } from 'react';
import {
  Stack,
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
import { AccountingTableCard } from './AccountingTableCard';
import { AccountingTableSummaryCard } from './AccountingTableSummaryCard';
import {
  ACCOUNTING_TABLE_HEAD_STICKY_STYLE,
  accountingThStyle,
  ACCOUNTING_TABLE_TD_CENTER_STYLE,
  ACCOUNTING_TABLE_TD_TEXT_STYLE,
} from './accountingTableStyles';

type AccountId = string | null | undefined;

type ExpenseRow = Expense & {
  accountId?: AccountId;
};

interface ExpenseListTableProps {
  expenses: ExpenseRow[];
  filteredExpenses: ExpenseRow[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
  getSourceLabel: (sourceType?: string) => string;
  getSourceColor: (sourceType?: string) => string;
  showAccountColumn?: boolean;
  getAccountLabel?: (accountId: AccountId) => string;
  onViewReceipt: (receiptName: string) => void;
  pendingActionMode?: 'approve-reject' | 'mark-paid' | 'none';
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onMarkPaid?: (id: string) => void;
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
  getSourceColor,
  showAccountColumn = false,
  getAccountLabel,
  onViewReceipt,
  pendingActionMode = 'approve-reject',
  onApprove,
  onReject,
  onMarkPaid,
  onEdit,
  onDelete,
}: ExpenseListTableProps) {
  const colSpan = showAccountColumn ? 10 : 9;
  const filteredTotal = filteredExpenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  return (
    <Stack gap="md">
      <AccountingTableCard>
        <Table highlightOnHover withTableBorder>
          <Table.Thead style={ACCOUNTING_TABLE_HEAD_STICKY_STYLE}>
            <Table.Tr>
              <Table.Th style={accountingThStyle({ width: 300 })}>
                DATE
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 300 })}>
                AMOUNT
              </Table.Th>
              <Table.Th style={accountingThStyle()}>DESCRIPTION</Table.Th>
              <Table.Th style={accountingThStyle({ width: 300 })}>
                CATEGORY
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 200 })}>
                SOURCE
              </Table.Th>
              {showAccountColumn && (
                <Table.Th style={accountingThStyle({ width: 300 })}>
                  ACCOUNT
                </Table.Th>
              )}
              <Table.Th style={accountingThStyle()}>NOTES</Table.Th>
              <Table.Th style={accountingThStyle({ width: 300 })}>
                RECEIPT
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 300 })}>
                LOGGED BY
              </Table.Th>
              <Table.Th style={accountingThStyle({ width: 150 })}>
                ACTION
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredExpenses.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={colSpan} style={{ textAlign: 'center' }}>
                  <Text c="dimmed" py="xl">
                    No expenses found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              filteredExpenses.map((expense) => (
                <Table.Tr key={expense.id}>
                  <Table.Td style={ACCOUNTING_TABLE_TD_CENTER_STYLE}>
                    {formatDate(expense.date)}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={600} c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {formatCurrency(expense.amount)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      size="sm"
                      fw={500}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
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
                    <Group gap={6} justify="center">
                      <Badge
                        color={getSourceColor(expense.sourceType)}
                        variant="light"
                      >
                        {getSourceLabel(expense.sourceType)}
                      </Badge>
                      {expense.systemGenerated && (
                        <Badge color="gray" variant="outline">
                          Auto
                        </Badge>
                      )}
                    </Group>
                  </Table.Td>
                  {showAccountColumn && (
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                        {getAccountLabel
                          ? getAccountLabel(expense.accountId)
                          : '—'}
                      </Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text
                      size="sm"
                      lineClamp={2}
                      c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                    >
                      {expense.notes || '-'}
                    </Text>
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
                        <IconReceipt
                          size={16}
                          color={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
                        />
                        <Text
                          size="xs"
                          c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}
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
                    <Text size="sm" c={ACCOUNTING_TABLE_TD_TEXT_STYLE.color}>
                      {expense.employeeName || '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" justify="center">
                      {expense.status === 'pending' &&
                        pendingActionMode === 'approve-reject' && (
                          <>
                            <Tooltip label="Approve">
                              <ActionIcon
                                color="green"
                                variant="light"
                                size="sm"
                                onClick={() => onApprove?.(expense.id)}
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
                                onClick={() => onReject?.(expense.id)}
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

                      {expense.status === 'pending' &&
                        pendingActionMode === 'mark-paid' &&
                        (expense.sourceType || '').toUpperCase() ===
                          'RECURRING' && (
                          <Tooltip label="Mark as Paid">
                            <ActionIcon
                              color="green"
                              variant="light"
                              size="sm"
                              onClick={() => onMarkPaid?.(expense.id)}
                              {...getActionLabel(
                                'Mark as Paid',
                                'expense',
                                `${expense.employeeName || 'Unknown'} - ${expense.category}`
                              )}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
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
      </AccountingTableCard>

      <AccountingTableSummaryCard
        leftText={`Showing ${filteredExpenses.length} of ${expenses.length} expenses`}
        items={[
          { label: 'Filtered Total:', value: formatCurrency(filteredTotal) },
        ]}
      />
    </Stack>
  );
});
