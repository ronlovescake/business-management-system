'use client';

import React, { useState, useMemo } from 'react';
import {
  Stack,
  Table,
  ActionIcon,
  Group,
  Button,
  TextInput,
  Select,
  Textarea,
  Modal,
  NumberInput,
  Badge,
  Card,
  Text,
  Grid as MantineGrid,
  Paper,
  Title,
  FileButton,
  Tooltip,
  Tabs,
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
import { PageLayout } from '../../../../components/layout/PageLayout';
import { StatCard } from '../../../../components/ui';

/**
 * Expense Interface
 */
interface Expense {
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
 * Expenses Page Component
 *
 * Features:
 * - Mantine Table with 7 columns
 * - Add/Edit/Delete functionality
 * - Search and filter
 * - Receipt upload
 * - Stats cards
 * - Category management
 */
export default function Expenses() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [expenses, setExpenses] = useState<Expense[]>([
    {
      id: '1',
      date: '2024-10-01',
      amount: 250.0,
      description: 'Office Supplies',
      category: 'Supplies',
      notes: 'Pens, paper, folders',
      receipt: 'receipt_001.pdf',
      status: 'approved',
      employeeName: 'John Doe',
    },
    {
      id: '2',
      date: '2024-10-05',
      amount: 450.0,
      description: 'Client Lunch',
      category: 'Meals',
      notes: 'Meeting with ABC Corp',
      receipt: null,
      status: 'pending',
      employeeName: 'Jane Smith',
    },
    {
      id: '3',
      date: '2024-10-08',
      amount: 1200.0,
      description: 'Software License',
      category: 'Software',
      notes: 'Annual subscription',
      receipt: 'receipt_003.pdf',
      status: 'approved',
      employeeName: 'Bob Johnson',
    },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formTripId, setFormTripId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceipt, setFormReceipt] = useState<File | null>(null);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  // Helper function for category colors
  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      'Driver Pay': 'blue',
      Fuel: 'orange',
      'Helper Pay': 'cyan',
      'Load/Unload Fees': 'grape',
      'Maintenance & Repairs': 'red',
      Meal: 'green',
      'Parking Fees': 'yellow',
      'Toll Fees': 'teal',
      Transportation: 'indigo',
      'Truck Washing / Cleaning': 'pink',
      'Permits & Registration': 'violet',
      'Vehicle Purchase': 'lime',
    };
    return colorMap[category] || 'gray';
  };

  // Categories
  const categories = useMemo(
    () => [
      'Driver Pay',
      'Fuel',
      'Helper Pay',
      'Load/Unload Fees',
      'Maintenance & Repairs',
      'Meal',
      'Parking Fees',
      'Toll Fees',
      'Transportation',
      'Truck Washing / Cleaning',
      'Permits & Registration',
      'Vehicle Purchase',
    ],
    []
  );

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        searchQuery === '' ||
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        !filterCategory || expense.category === filterCategory;

      const matchesStatus = !filterStatus || expense.status === filterStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [expenses, searchQuery, filterCategory, filterStatus]);

  // Stats
  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + exp.amount, 0),
    [expenses]
  );

  const pendingExpenses = useMemo(
    () => expenses.filter((exp) => exp.status === 'pending').length,
    [expenses]
  );

  const approvedExpenses = useMemo(
    () =>
      expenses
        .filter((exp) => exp.status === 'approved')
        .reduce((sum, exp) => sum + exp.amount, 0),
    [expenses]
  );

  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return expenses
      .filter((exp) => {
        const expDate = new Date(exp.date);
        return (
          expDate.getMonth() === currentMonth &&
          expDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses]);

  // Category analytics
  const categoryAnalytics = useMemo(() => {
    const analytics = categories.map((category) => {
      const categoryExpenses = expenses.filter(
        (exp) => exp.category === category
      );
      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
      return {
        category,
        total,
        percentage,
        count: categoryExpenses.length,
      };
    });
    return analytics.sort((a, b) => b.total - a.total);
  }, [expenses, categories, totalExpenses]);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddExpense = () => {
    setEditingExpense(null);
    setFormDate('');
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormTripId('');
    setFormNotes('');
    setFormReceipt(null);
    setIsModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormDate(expense.date);
    setFormAmount(expense.amount);
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormNotes(expense.notes);
    setFormReceipt(null);
    setIsModalOpen(true);
  };

  const handleDeleteExpense = (id: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      setExpenses((prev) => prev.filter((exp) => exp.id !== id));
    }
  };

  const handleSaveExpense = () => {
    if (!formDate || !formAmount || !formDescription || !formCategory) {
      alert('Please fill in all required fields');
      return;
    }

    if (editingExpense) {
      // Update existing expense
      setExpenses((prev) =>
        prev.map((exp) =>
          exp.id === editingExpense.id
            ? {
                ...exp,
                date: formDate,
                amount: Number(formAmount),
                description: formDescription,
                category: formCategory,
                notes: formNotes,
                receipt: formReceipt ? formReceipt.name : exp.receipt,
              }
            : exp
        )
      );
    } else {
      // Add new expense
      const newExpense: Expense = {
        id: Date.now().toString(),
        date: formDate,
        amount: Number(formAmount),
        description: formDescription,
        category: formCategory,
        notes: formNotes,
        receipt: formReceipt ? formReceipt.name : null,
        status: 'pending',
        employeeName: 'Current User',
      };
      setExpenses((prev) => [...prev, newExpense]);
    }

    setIsModalOpen(false);
  };

  const handleApprove = (id: string) => {
    setExpenses((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, status: 'approved' } : exp))
    );
  };

  const handleReject = (id: string) => {
    setExpenses((prev) =>
      prev.map((exp) => (exp.id === id ? { ...exp, status: 'rejected' } : exp))
    );
  };

  // ============================================================================
  // STATS CARDS
  // ============================================================================

  const statsCards: StatCard[] = [
    {
      title: 'Total Expenses',
      value: `$${totalExpenses.toFixed(2)}`,
      icon: <IconReceipt size={32} stroke={1.5} />,
      color: 'blue',
    },
    {
      title: 'Pending Approval',
      value: pendingExpenses.toString(),
      icon: <IconX size={32} stroke={1.5} />,
      color: 'red',
    },
    {
      title: 'Approved Total',
      value: `$${approvedExpenses.toFixed(2)}`,
      icon: <IconCheck size={32} stroke={1.5} />,
      color: 'green',
    },
    {
      title: 'This Month',
      value: `$${thisMonthExpenses.toFixed(2)}`,
      icon: <IconDownload size={32} stroke={1.5} />,
      color: 'teal',
    },
  ];

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageLayout title="Employee Expenses" fluid withPadding>
      <Stack gap="lg">
        {/* Stats Cards */}
        <MantineGrid>
          {statsCards.map((stat, index) => (
            <MantineGrid.Col key={index} span={{ base: 12, sm: 6, md: 3 }}>
              <Paper withBorder p="md" radius="md">
                <Group justify="space-between">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {stat.title}
                    </Text>
                    <Text size="xl" fw={700} mt={4}>
                      {stat.value}
                    </Text>
                  </div>
                  {stat.icon}
                </Group>
              </Paper>
            </MantineGrid.Col>
          ))}
        </MantineGrid>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onChange={setActiveTab}>
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

          {/* Expense List Tab */}
          <Tabs.Panel value="list" pt="md">
            <Stack gap="md">
              {/* Filters and Actions */}
              <Card withBorder padding="md">
                <Stack gap="md">
                  <Group justify="space-between">
                    <Title order={3}>Expense Records</Title>
                    <Group>
                      <Button
                        leftSection={<IconUpload size={16} />}
                        variant="light"
                        color="blue"
                      >
                        Import CSV
                      </Button>
                      <Button
                        leftSection={<IconDownload size={16} />}
                        variant="light"
                        color="teal"
                      >
                        Export
                      </Button>
                      <Button
                        leftSection={<IconPlus size={16} />}
                        onClick={handleAddExpense}
                      >
                        Add Expense
                      </Button>
                    </Group>
                  </Group>

                  {/* Search and Filters */}
                  <Group>
                    <TextInput
                      placeholder="Search expenses..."
                      leftSection={<IconSearch size={16} />}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <Select
                      placeholder="Filter by category"
                      data={['All', ...categories]}
                      value={filterCategory}
                      onChange={(value) =>
                        setFilterCategory(value === 'All' ? null : value)
                      }
                      clearable
                      style={{ width: 200 }}
                    />
                    <Select
                      placeholder="Filter by status"
                      data={['All', 'pending', 'approved', 'rejected']}
                      value={filterStatus}
                      onChange={(value) =>
                        setFilterStatus(value === 'All' ? null : value)
                      }
                      clearable
                      style={{ width: 200 }}
                    />
                  </Group>
                </Stack>
              </Card>

              {/* Expenses Table */}
              <Card withBorder padding={0} style={{ overflow: 'hidden' }}>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>DATE</Table.Th>
                      <Table.Th>AMOUNT</Table.Th>
                      <Table.Th>DESCRIPTION</Table.Th>
                      <Table.Th>CATEGORY</Table.Th>
                      <Table.Th>NOTES</Table.Th>
                      <Table.Th>RECEIPT</Table.Th>
                      <Table.Th style={{ width: 150, textAlign: 'center' }}>
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
                          <Table.Td>
                            {new Date(expense.date).toLocaleDateString()}
                          </Table.Td>
                          <Table.Td>
                            <Text fw={600}>${expense.amount.toFixed(2)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500}>
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
                            <Text size="sm" lineClamp={2}>
                              {expense.notes || '-'}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            {expense.receipt ? (
                              <Group gap="xs">
                                <IconReceipt size={16} />
                                <Text size="xs">{expense.receipt}</Text>
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
                                      onClick={() => handleApprove(expense.id)}
                                    >
                                      <IconCheck size={16} />
                                    </ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Reject">
                                    <ActionIcon
                                      color="red"
                                      variant="light"
                                      size="sm"
                                      onClick={() => handleReject(expense.id)}
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
                                  onClick={() => handleEditExpense(expense)}
                                >
                                  <IconEdit size={16} />
                                </ActionIcon>
                              </Tooltip>
                              <Tooltip label="Delete">
                                <ActionIcon
                                  color="red"
                                  variant="light"
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteExpense(expense.id)
                                  }
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
              </Card>

              {/* Summary */}
              <Card withBorder padding="md">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredExpenses.length} of {expenses.length}{' '}
                    expenses
                  </Text>
                  <Text size="sm" fw={600}>
                    Filtered Total: $
                    {filteredExpenses
                      .reduce((sum, exp) => sum + exp.amount, 0)
                      .toFixed(2)}
                  </Text>
                </Group>
              </Card>
            </Stack>
          </Tabs.Panel>

          {/* Analytics Tab */}
          <Tabs.Panel value="analytics" pt="md">
            <Card withBorder padding="md">
              <Title order={3} mb="lg">
                Expenses by Category - Monthly Breakdown
              </Title>
              <Stack gap="lg">
                {categoryAnalytics.map((category) => (
                  <Box key={category.category}>
                    <Group justify="space-between" mb="xs">
                      <Group>
                        <Badge
                          color={getCategoryColor(category.category)}
                          variant="light"
                          size="lg"
                        >
                          {category.category}
                        </Badge>
                        <Text size="sm" c="dimmed">
                          {category.count}{' '}
                          {category.count === 1 ? 'expense' : 'expenses'}
                        </Text>
                      </Group>
                      <Group gap="xl">
                        <Text size="sm" fw={500}>
                          {category.percentage.toFixed(1)}%
                        </Text>
                        <Text size="lg" fw={700}>
                          ${category.total.toFixed(2)}
                        </Text>
                      </Group>
                    </Group>
                    <Progress
                      value={category.percentage}
                      size="lg"
                      radius="xl"
                      color={getCategoryColor(category.category)}
                    />
                  </Box>
                ))}

                {/* Total Summary */}
                <Paper withBorder p="md" mt="md" bg="gray.0">
                  <Group justify="space-between">
                    <Text size="lg" fw={700}>
                      TOTAL
                    </Text>
                    <Text size="xl" fw={700}>
                      ${totalExpenses.toFixed(2)}
                    </Text>
                  </Group>
                </Paper>
              </Stack>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Add/Edit Modal */}
      <Modal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        size="lg"
      >
        <Stack gap="md">
          <Group grow align="flex-start">
            <TextInput
              label="Date"
              placeholder="MM/DD/YYYY"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              styles={{
                label: { fontWeight: 600 },
              }}
            />
            <Select
              label="Category"
              placeholder="Select category"
              data={categories}
              value={formCategory}
              onChange={(value) => setFormCategory(value || '')}
              required
              searchable
              styles={{
                label: { fontWeight: 600 },
              }}
            />
          </Group>

          <Group grow align="flex-start">
            <NumberInput
              label="Amount"
              placeholder="0"
              prefix="₱ "
              decimalScale={2}
              value={formAmount}
              onChange={(value) =>
                setFormAmount(typeof value === 'number' ? value : '')
              }
              required
              min={0}
              styles={{
                label: { fontWeight: 600 },
              }}
            />
            <TextInput
              label="Trip ID (Optional)"
              placeholder="Enter trip ID"
              value={formTripId}
              onChange={(e) => setFormTripId(e.target.value)}
              styles={{
                label: { fontWeight: 600 },
              }}
            />
          </Group>

          <Textarea
            label="Description"
            placeholder="Enter description"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            required
            minRows={3}
            styles={{
              label: { fontWeight: 600 },
            }}
          />

          <Textarea
            label="Notes (Optional)"
            placeholder="Enter notes"
            value={formNotes}
            onChange={(e) => setFormNotes(e.target.value)}
            minRows={3}
            styles={{
              label: { fontWeight: 600 },
            }}
          />

          <Box>
            <Text size="sm" fw={600} mb="xs">
              Receipt Upload
            </Text>
            <Paper
              withBorder
              p="xl"
              style={{
                borderStyle: 'dashed',
                borderWidth: 2,
                borderColor: '#dee2e6',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#f8f9fa',
              }}
            >
              <FileButton
                onChange={setFormReceipt}
                accept="image/png,image/jpeg,image/jpg"
              >
                {(props) => (
                  <Box {...props}>
                    <IconUpload
                      size={40}
                      stroke={1.5}
                      color="#868e96"
                      style={{ margin: '0 auto' }}
                    />
                    <Text size="sm" c="dimmed" mt="xs">
                      Click to upload receipt
                    </Text>
                    <Text size="xs" c="dimmed">
                      PNG, JPG files only (Max 5MB)
                    </Text>
                    {formReceipt && (
                      <Badge color="blue" variant="light" mt="sm">
                        {formReceipt.name}
                      </Badge>
                    )}
                  </Box>
                )}
              </FileButton>
            </Paper>
          </Box>

          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveExpense}>
              {editingExpense ? 'Update' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageLayout>
  );
}
