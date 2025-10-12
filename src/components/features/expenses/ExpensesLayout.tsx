import React from 'react';
import {
  Stack,
  Group,
  Button,
  TextInput,
  Select,
  FileButton,
  Modal,
  NumberInput,
  Textarea,
  Text,
  Card,
  Title,
  Tabs,
  Table,
  ActionIcon,
  Tooltip,
  Badge,
  Progress,
  Box,
} from '@mantine/core';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconDownload,
  IconUpload,
  IconReceipt,
  IconCheck,
  IconX,
  IconList,
  IconChartPie,
} from '@tabler/icons-react';

/**
 * Expense Interface
 */
export interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
  status: 'pending' | 'approved' | 'rejected';
  employeeName?: string;
}

/**
 * Monthly Breakdown Interface
 */
export interface MonthlyBreakdown {
  category: string;
  percentage: number;
  total: number;
  January: number;
  February: number;
  March: number;
  April: number;
  May: number;
  June: number;
  July: number;
  August: number;
  September: number;
  October: number;
  November: number;
  December: number;
}

/**
 * ExpensesLayout Component
 *
 * This component provides an abstraction layer between the expenses page
 * and the UI implementation. It handles:
 * - Layout structure (stats cards, tabs, filters, action buttons)
 * - UI presentation and styling
 * - Table rendering (both expense list and analytics)
 *
 * Benefits:
 * - Separates business logic from presentation
 * - Makes UI implementation swappable
 * - Keeps critical business logic protected in the page component
 * - Consistent styling across the application
 */

export interface ExpensesLayoutProps {
  // Data
  expenses: Expense[];
  filteredExpenses: Expense[];
  monthlyBreakdown: MonthlyBreakdown[];
  categories: string[];

  // Search and Filters
  searchQuery: string;
  onSearch: (query: string) => void;
  filterCategory: string | null;
  onCategoryFilter: (category: string | null) => void;
  filterStatus: string | null;
  onStatusFilter: (status: string | null) => void;

  // Tabs
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;

  // CSV Import/Export
  onCSVImport: (file: File | null) => void;
  onCSVExport: () => void;
  isImporting: boolean;

  // Expense Actions
  onAddExpense: () => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;

  // Receipt Viewing
  onViewReceipt: (receiptName: string) => void;

  // Form Modal
  isModalOpen: boolean;
  onModalClose: () => void;
  editingExpense: Expense | null;

  // Form State
  formDate: string;
  setFormDate: (date: string) => void;
  formAmount: number | '';
  setFormAmount: (amount: number | '') => void;
  formDescription: string;
  setFormDescription: (description: string) => void;
  formCategory: string;
  setFormCategory: (category: string) => void;
  formNotes: string;
  setFormNotes: (notes: string) => void;
  formReceipt: File | null;
  setFormReceipt: (file: File | null) => void;

  // Form Actions
  onSaveExpense: () => void;

  // Utility Functions
  formatCurrency: (amount: number) => string;
  getCategoryColor: (category: string) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

export function ExpensesLayout({
  expenses,
  filteredExpenses,
  monthlyBreakdown,
  categories,
  searchQuery,
  onSearch,
  filterCategory,
  onCategoryFilter,
  filterStatus,
  onStatusFilter,
  activeTab,
  onTabChange,
  onCSVImport,
  onCSVExport,
  isImporting,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
  onApprove,
  onReject,
  onViewReceipt,
  isModalOpen,
  onModalClose,
  editingExpense,
  formDate,
  setFormDate,
  formAmount,
  setFormAmount,
  formDescription,
  setFormDescription,
  formCategory,
  setFormCategory,
  formNotes,
  setFormNotes,
  formReceipt,
  setFormReceipt,
  onSaveExpense,
  formatCurrency,
  getCategoryColor,
  getStatusBadge,
}: ExpensesLayoutProps) {
  return (
    <Stack gap="md">
      {/* Expense Records Header, Tabs, and Controls Container */}
      <Card withBorder padding="md">
        <Stack gap="md">
          <Title order={3}>Expense Records</Title>

          <Tabs value={activeTab} onChange={onTabChange}>
            <Tabs.List>
              <Tabs.Tab value="list" leftSection={<IconList size={16} />}>
                Expense List
              </Tabs.Tab>
              <Tabs.Tab
                value="analytics"
                leftSection={<IconChartPie size={16} />}
              >
                Analytics by Category
              </Tabs.Tab>
            </Tabs.List>

            {/* List Tab Controls */}
            <Tabs.Panel value="list" pt="md">
              <Group>
                <TextInput
                  placeholder="Search expenses..."
                  leftSection={<IconSearch size={16} />}
                  value={searchQuery}
                  onChange={(e) => onSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <Select
                  placeholder="Filter by category"
                  data={categories}
                  value={filterCategory}
                  onChange={onCategoryFilter}
                  clearable
                  style={{ width: 200 }}
                />
                <Select
                  placeholder="Filter by status"
                  data={['pending', 'approved', 'rejected']}
                  value={filterStatus}
                  onChange={onStatusFilter}
                  clearable
                  style={{ width: 200 }}
                />
                <FileButton onChange={onCSVImport} accept=".csv">
                  {(props) => (
                    <Button
                      {...props}
                      leftSection={<IconUpload size={16} />}
                      variant="light"
                      loading={isImporting}
                      disabled={isImporting}
                    >
                      Import CSV
                    </Button>
                  )}
                </FileButton>
                <Button
                  leftSection={<IconDownload size={16} />}
                  variant="light"
                  color="teal"
                  onClick={onCSVExport}
                >
                  Export
                </Button>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={onAddExpense}
                >
                  Add Expense
                </Button>
              </Group>
            </Tabs.Panel>

            {/* Analytics Tab - Empty panel, actual content shown below */}
            <Tabs.Panel value="analytics" pt="md">
              <div>
                {/* Analytics table will be rendered outside the card */}
              </div>
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Card>

      {/* Tables Outside Container */}
      {activeTab === 'list' ? (
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
                        padding: '16px 12px',
                        color: '#495057',
                        backgroundColor: '#f1f3f5',
                        textAlign: 'center',
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
                        <Text c="dimmed">No expenses found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <Table.Tr key={expense.id}>
                        <Table.Td style={{ color: '#495057' }}>
                          {expense.date}
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Text fw={600} c="#495057">
                              {formatCurrency(expense.amount)}
                            </Text>
                            {getStatusBadge(expense.status)}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={4}>
                            <Text size="sm" fw={500} c="#495057">
                              {expense.description}
                            </Text>
                            {expense.employeeName && (
                              <Text size="xs" c="dimmed">
                                {expense.employeeName}
                              </Text>
                            )}
                          </Stack>
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
                                onClick={() => onEditExpense(expense)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon
                                color="red"
                                variant="light"
                                size="sm"
                                onClick={() => onDeleteExpense(expense.id)}
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

          {/* Summary Card */}
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
      ) : (
        <Card
          withBorder
          padding={0}
          style={{ overflow: 'hidden', height: '71vh' }}
        >
          <Box style={{ height: '100%', overflowX: 'auto', overflowY: 'auto' }}>
            <Table highlightOnHover withTableBorder>
              <Table.Thead
                style={{
                  backgroundColor: '#f1f3f5',
                  position: 'sticky',
                  top: 0,
                  zIndex: 1,
                }}
              >
                <Table.Tr>
                  <Table.Th
                    style={{
                      padding: '16px 12px',
                      color: '#495057',
                      backgroundColor: '#f1f3f5',
                      textAlign: 'center',
                      minWidth: 180,
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
                      minWidth: 750,
                    }}
                  >
                    PERCENTAGE
                  </Table.Th>
                  <Table.Th
                    style={{
                      padding: '16px 12px',
                      color: '#495057',
                      backgroundColor: '#f1f3f5',
                      textAlign: 'center',
                      minWidth: 150,
                    }}
                  >
                    TOTAL EXPENSES
                  </Table.Th>
                  {[
                    'JAN',
                    'FEB',
                    'MAR',
                    'APR',
                    'MAY',
                    'JUN',
                    'JUL',
                    'AUG',
                    'SEP',
                    'OCT',
                    'NOV',
                    'DEC',
                  ].map((month) => (
                    <Table.Th
                      key={month}
                      style={{
                        padding: '16px 12px',
                        color: '#495057',
                        backgroundColor: '#f1f3f5',
                        textAlign: 'center',
                        minWidth: 150,
                      }}
                    >
                      {month}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {monthlyBreakdown.map((row) => (
                  <Table.Tr key={row.category}>
                    <Table.Td>
                      <Text size="sm" fw={500} c="#495057">
                        {row.category}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text fw={700} c="#495057">
                          {row.percentage.toFixed(1)}%
                        </Text>
                        <Progress
                          value={row.percentage}
                          size="sm"
                          radius="xl"
                          color={getCategoryColor(row.category)}
                          style={{ flex: 1, minWidth: 80, maxWidth: 120 }}
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.total)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.January)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.February)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.March)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.April)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.May)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.June)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.July)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.August)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.September)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.October)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.November)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {formatCurrency(row.December)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Box>
        </Card>
      )}

      {/* Add/Edit Expense Modal */}
      <Modal
        opened={isModalOpen}
        onClose={onModalClose}
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="Date"
            type="date"
            required
            value={formDate}
            onChange={(e) => setFormDate(e.target.value)}
          />
          <NumberInput
            label="Amount"
            required
            placeholder="0.00"
            decimalScale={2}
            fixedDecimalScale
            value={formAmount}
            onChange={(value) => setFormAmount(value as number | '')}
          />
          <TextInput
            label="Description"
            required
            placeholder="Brief description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
          />
          <Select
            label="Category"
            required
            placeholder="Select category"
            data={categories}
            value={formCategory}
            onChange={(value) => setFormCategory(value || '')}
          />
          <Textarea
            label="Notes"
            placeholder="Additional details"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            minRows={3}
          />
          <FileButton onChange={setFormReceipt} accept="image/*,.pdf">
            {(props) => (
              <Button {...props} variant="light" fullWidth>
                {formReceipt ? formReceipt.name : 'Upload Receipt'}
              </Button>
            )}
          </FileButton>

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onModalClose}>
              Cancel
            </Button>
            <Button onClick={onSaveExpense}>
              {editingExpense ? 'Update' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
