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
 * Monthly Breakdown Interface
 */
interface MonthlyBreakdown {
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

  // Format date to "Friday, September 12, 2025"
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format currency to Philippine Peso
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
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

  // Monthly breakdown by category
  const monthlyBreakdown = useMemo((): MonthlyBreakdown[] => {
    const months: (keyof Omit<
      MonthlyBreakdown,
      'category' | 'percentage' | 'total'
    >)[] = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    return categories.map((category) => {
      const categoryExpenses = expenses.filter(
        (exp) => exp.category === category
      );

      const result: MonthlyBreakdown = {
        category,
        percentage: 0,
        total: 0,
        January: 0,
        February: 0,
        March: 0,
        April: 0,
        May: 0,
        June: 0,
        July: 0,
        August: 0,
        September: 0,
        October: 0,
        November: 0,
        December: 0,
      };

      categoryExpenses.forEach((exp) => {
        const expDate = new Date(exp.date);
        const monthName = months[expDate.getMonth()];
        result[monthName] += exp.amount;
      });

      const total = categoryExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const percentage = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;

      result.total = total;
      result.percentage = percentage;

      return result;
    });
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
      value: formatCurrency(totalExpenses),
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
      value: formatCurrency(approvedExpenses),
      icon: <IconCheck size={32} stroke={1.5} />,
      color: 'green',
    },
    {
      title: 'This Month',
      value: formatCurrency(thisMonthExpenses),
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
                          <Table.Td>{formatDate(expense.date)}</Table.Td>
                          <Table.Td>
                            <Text fw={600}>
                              {formatCurrency(expense.amount)}
                            </Text>
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
                    Filtered Total:{' '}
                    {formatCurrency(
                      filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0)
                    )}
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

              <Box style={{ overflowX: 'auto' }}>
                <Table
                  striped
                  highlightOnHover
                  withTableBorder
                  withColumnBorders
                  style={{ minWidth: '1400px' }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>CATEGORIES</Table.Th>
                      <Table.Th style={{ textAlign: 'center' }}>
                        PERCENTAGE
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        TOTAL EXPENSES
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        JANUARY
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        FEBRUARY
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>MARCH</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>APRIL</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>MAY</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>JUNE</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>JULY</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>AUGUST</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        SEPTEMBER
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        OCTOBER
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        NOVEMBER
                      </Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>
                        DECEMBER
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {monthlyBreakdown.map((row) => (
                      <Table.Tr key={row.category}>
                        <Table.Td>
                          <Badge
                            color={getCategoryColor(row.category)}
                            variant="light"
                            size="lg"
                          >
                            {row.category}
                          </Badge>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'center' }}>
                          <Group justify="center" gap="xs">
                            <Progress
                              value={row.percentage}
                              size="sm"
                              radius="xl"
                              color={getCategoryColor(row.category)}
                              style={{ width: 60 }}
                            />
                            <Text size="sm" fw={500}>
                              {row.percentage.toFixed(1)}%
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text fw={700} c="blue">
                            {formatCurrency(row.total)}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.January > 0
                              ? formatCurrency(row.January)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.February > 0
                              ? formatCurrency(row.February)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.March > 0
                              ? formatCurrency(row.March)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.April > 0
                              ? formatCurrency(row.April)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.May > 0 ? formatCurrency(row.May) : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.June > 0 ? formatCurrency(row.June) : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.July > 0 ? formatCurrency(row.July) : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.August > 0
                              ? formatCurrency(row.August)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.September > 0
                              ? formatCurrency(row.September)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.October > 0
                              ? formatCurrency(row.October)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.November > 0
                              ? formatCurrency(row.November)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Text size="sm">
                            {row.December > 0
                              ? formatCurrency(row.December)
                              : '₱0.00'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}

                    {/* Total Row */}
                    <Table.Tr
                      style={{ backgroundColor: '#f8f9fa', fontWeight: 700 }}
                    >
                      <Table.Td>
                        <Text fw={700} size="lg">
                          TOTAL
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text fw={700}>100%</Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700} size="lg" c="blue">
                          {formatCurrency(totalExpenses)}
                        </Text>
                      </Table.Td>
                      {(
                        [
                          'January',
                          'February',
                          'March',
                          'April',
                          'May',
                          'June',
                          'July',
                          'August',
                          'September',
                          'October',
                          'November',
                          'December',
                        ] as const
                      ).map((month) => {
                        const monthTotal = monthlyBreakdown.reduce(
                          (sum, row) =>
                            sum +
                            ((row[month as keyof MonthlyBreakdown] as number) ||
                              0),
                          0
                        );
                        return (
                          <Table.Td key={month} style={{ textAlign: 'right' }}>
                            <Text fw={700}>
                              {monthTotal > 0
                                ? formatCurrency(monthTotal)
                                : '₱0.00'}
                            </Text>
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  </Table.Tbody>
                </Table>
              </Box>
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
        padding="xl"
        radius="md"
        centered
        styles={{
          title: {
            fontSize: '1.25rem',
            fontWeight: 600,
          },
          body: {
            paddingTop: '1rem',
          },
        }}
      >
        <Stack gap="lg">
          <Stack gap="md">
            <Group grow align="flex-start">
              <TextInput
                label="Date"
                placeholder="MM/DD/YYYY"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                radius="md"
                size="md"
                styles={{
                  label: {
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  },
                  input: {
                    borderColor: '#d0d7de',
                    '&:focus': {
                      borderColor: '#2188ff',
                    },
                  },
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
                radius="md"
                size="md"
                styles={{
                  label: {
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  },
                  input: {
                    borderColor: '#d0d7de',
                    '&:focus': {
                      borderColor: '#2188ff',
                    },
                  },
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
                radius="md"
                size="md"
                styles={{
                  label: {
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  },
                  input: {
                    borderColor: '#d0d7de',
                    '&:focus': {
                      borderColor: '#2188ff',
                    },
                  },
                }}
              />
              <TextInput
                label="Trip ID (Optional)"
                placeholder="e.g., TRP-001"
                value={formTripId}
                onChange={(e) => setFormTripId(e.target.value)}
                radius="md"
                size="md"
                styles={{
                  label: {
                    fontWeight: 500,
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  },
                  input: {
                    borderColor: '#d0d7de',
                    '&:focus': {
                      borderColor: '#2188ff',
                    },
                  },
                }}
              />
            </Group>

            <Textarea
              label="Description"
              placeholder="Describe the expense..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              required
              minRows={3}
              radius="md"
              size="md"
              styles={{
                label: {
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem',
                },
                input: {
                  borderColor: '#d0d7de',
                  '&:focus': {
                    borderColor: '#2188ff',
                  },
                },
              }}
            />

            <Textarea
              label="Notes (Optional)"
              placeholder="Additional notes about this expense..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              minRows={2}
              radius="md"
              size="md"
              styles={{
                label: {
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  marginBottom: '0.5rem',
                },
                input: {
                  borderColor: '#d0d7de',
                  '&:focus': {
                    borderColor: '#2188ff',
                  },
                },
              }}
            />

            <Box>
              <Text size="sm" fw={500} mb="sm" c="dark.9">
                Receipt Upload
              </Text>
              <FileButton
                onChange={setFormReceipt}
                accept="image/png,image/jpeg,image/jpg"
              >
                {(props) => (
                  <Paper
                    {...props}
                    withBorder
                    p="xl"
                    radius="md"
                    style={{
                      borderStyle: 'dashed',
                      borderWidth: 2,
                      borderColor: '#d0d7de',
                      textAlign: 'center',
                      cursor: 'pointer',
                      backgroundColor: '#f6f8fa',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#2188ff';
                      e.currentTarget.style.backgroundColor = '#f0f6ff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#d0d7de';
                      e.currentTarget.style.backgroundColor = '#f6f8fa';
                    }}
                  >
                    <Stack align="center" gap="xs">
                      <IconUpload
                        size={48}
                        stroke={1.5}
                        color="#6c757d"
                        style={{ marginBottom: '0.5rem' }}
                      />
                      <Text size="sm" fw={500} c="dark.7">
                        Click to upload receipt
                      </Text>
                      <Text size="xs" c="dimmed">
                        PNG, JPG files only (Max 5MB)
                      </Text>
                      {formReceipt && (
                        <Badge
                          color="blue"
                          variant="light"
                          size="lg"
                          mt="sm"
                          leftSection={<IconReceipt size={14} />}
                        >
                          {formReceipt.name}
                        </Badge>
                      )}
                    </Stack>
                  </Paper>
                )}
              </FileButton>
            </Box>
          </Stack>

          <Group justify="flex-end" gap="sm" mt="md">
            <Button
              variant="subtle"
              onClick={() => setIsModalOpen(false)}
              size="md"
              radius="md"
              c="dark.5"
              styles={{
                root: {
                  '&:hover': {
                    backgroundColor: '#f6f8fa',
                  },
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveExpense}
              size="md"
              radius="md"
              styles={{
                root: {
                  backgroundColor: '#2188ff',
                  '&:hover': {
                    backgroundColor: '#0969da',
                  },
                },
              }}
            >
              {editingExpense ? 'Update' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </PageLayout>
  );
}
