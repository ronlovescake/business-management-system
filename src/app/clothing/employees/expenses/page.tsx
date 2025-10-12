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
  IconZoomIn,
  IconZoomOut,
  IconZoomReset,
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

  // CSV Import state
  const [isImporting, setIsImporting] = useState(false);

  // Receipt viewer state
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptZoom, setReceiptZoom] = useState(100);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  // Store receipt files as data URLs (for viewing uploaded receipts)
  const [receiptFiles, setReceiptFiles] = useState<Record<string, string>>({});

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
    const filtered = expenses.filter((expense) => {
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

    // Sort by date in descending order (newest first)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
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

    const breakdown = categories.map((category) => {
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

    // Sort by total expenses in descending order
    return breakdown.sort((a, b) => b.total - a.total);
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

    // If there's a receipt file, convert it to data URL for storage
    if (formReceipt) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const receiptDataUrl = reader.result as string;
        const receiptFileName = formReceipt.name;

        // Store the receipt data URL
        setReceiptFiles((prev) => ({
          ...prev,
          [receiptFileName]: receiptDataUrl,
        }));

        // Save expense after receipt is processed
        saveExpenseData(receiptFileName);
      };
      reader.readAsDataURL(formReceipt);
    } else {
      // No receipt file, save immediately
      saveExpenseData(editingExpense?.receipt ? editingExpense.receipt : null);
    }
  };

  const saveExpenseData = (receiptFileName: string | null) => {
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
                receipt: receiptFileName,
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
        receipt: receiptFileName,
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

  const handleViewReceipt = (receiptName: string) => {
    const receiptData = receiptFiles[receiptName];
    if (receiptData) {
      setViewingReceipt(receiptData);
      setReceiptFileName(receiptName);
      setReceiptZoom(100);
      setReceiptModalOpen(true);
    } else {
      alert('Receipt file not found. This may be a pre-existing receipt.');
    }
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          alert('CSV file is empty or invalid');
          setIsImporting(false);
          return;
        }

        // Helper function to parse CSV line properly (handles quoted values)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        // Parse header
        const headers = parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().replace(/\s+/g, '')
        );

        // Validate required columns
        const requiredColumns = ['date', 'amount', 'description', 'category'];
        const missingColumns = requiredColumns.filter(
          (col) => !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          alert(
            `Missing required columns: ${missingColumns.join(', ')}\n\n` +
              'Required columns: date, amount, description, category\n' +
              'Optional columns: notes, receipt, status, employeeName'
          );
          setIsImporting(false);
          return;
        }

        // Parse data rows
        const importedExpenses: Expense[] = [];
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          try {
            const values = parseCSVLine(lines[i]);
            const row: Record<string, string> = {};

            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });

            // Skip empty rows
            if (!row.date && !row.amount && !row.description) {
              continue;
            }

            // Validate required fields
            if (!row.date || !row.amount || !row.description || !row.category) {
              errorCount++;
              errors.push(`Row ${i + 1}: Missing required field(s)`);
              continue;
            }

            // Clean and parse amount (remove currency symbols, commas)
            const cleanAmount = row.amount.replace(/[₱$,\s]/g, '');
            const amount = parseFloat(cleanAmount);
            if (isNaN(amount)) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`);
              continue;
            }

            // Validate category
            if (!categories.includes(row.category)) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid category "${row.category}"`);
              continue;
            }

            // Parse date (convert various formats to YYYY-MM-DD)
            let dateStr = row.date;
            try {
              const parsedDate = new Date(dateStr);
              if (isNaN(parsedDate.getTime())) {
                errorCount++;
                errors.push(`Row ${i + 1}: Invalid date "${row.date}"`);
                continue;
              }
              // Format to YYYY-MM-DD
              const year = parsedDate.getFullYear();
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            } catch (dateError) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid date format "${row.date}"`);
              continue;
            }

            // Validate status
            const status = row.status?.toLowerCase() as
              | 'pending'
              | 'approved'
              | 'rejected';
            const validStatus = ['pending', 'approved', 'rejected'].includes(
              status
            )
              ? status
              : 'pending';

            const newExpense: Expense = {
              id: `import_${Date.now()}_${i}`,
              date: dateStr,
              amount,
              description: row.description,
              category: row.category,
              notes: row.notes || '',
              receipt: row.receipt || null,
              status: validStatus,
              employeeName: row.employeename || 'Imported',
            };

            importedExpenses.push(newExpense);
            successCount++;
          } catch (error) {
            errorCount++;
            errors.push(`Row ${i + 1}: ${error}`);
            console.error(`Error parsing row ${i + 1}:`, error);
          }
        }

        // Add imported expenses to state
        if (importedExpenses.length > 0) {
          setExpenses((prev) => [...prev, ...importedExpenses]);
        }

        // Show results
        let message =
          `Import completed!\n\n` +
          `✅ Successfully imported: ${successCount} expenses\n` +
          (errorCount > 0 ? `⚠️ Failed to import: ${errorCount} rows\n` : '') +
          `\nTotal expenses: ${expenses.length + successCount}`;

        if (errors.length > 0 && errors.length <= 10) {
          message += `\n\nErrors:\n${errors.join('\n')}`;
        }

        alert(message);
      } catch (error) {
        console.error('CSV import error:', error);
        alert('Failed to import CSV file. Please check the file format.');
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      alert('Failed to read CSV file');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  /**
   * Export filtered expenses to CSV
   */
  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expenses to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Date',
      'Amount',
      'Description',
      'Category',
      'Notes',
      'Receipt',
      'Status',
      'Employee Name',
    ];

    // Helper function to escape CSV values
    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      // Escape double quotes and wrap in quotes if contains comma, quote, or newline
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    // Convert expenses to CSV rows
    const rows = filteredExpenses.map((expense) => [
      escapeCSV(expense.date),
      escapeCSV(expense.amount.toFixed(2)),
      escapeCSV(expense.description),
      escapeCSV(expense.category),
      escapeCSV(expense.notes),
      escapeCSV(expense.receipt || ''),
      escapeCSV(expense.status),
      escapeCSV(expense.employeeName || ''),
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    // Generate filename with current date
    const date = new Date().toISOString().split('T')[0];
    const filename = `expenses_${date}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <PageLayout fluid withPadding>
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

        {/* Expense Records Header, Tabs, and Controls Container */}
        <Card withBorder padding="md">
          <Stack gap="md">
            {/* Expense Records Header */}
            <Title order={3}>Expense Records</Title>

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
                {/* Search, Filters and Action Buttons */}
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
                  <FileButton onChange={handleImportCSV} accept=".csv,text/csv">
                    {(props) => (
                      <Button
                        {...props}
                        leftSection={<IconUpload size={16} />}
                        variant="light"
                        color="blue"
                        loading={isImporting}
                      >
                        Import CSV
                      </Button>
                    )}
                  </FileButton>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    color="teal"
                    onClick={handleExportCSV}
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
            {/* Expenses Table */}
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
                                onClick={() =>
                                  handleViewReceipt(expense.receipt!)
                                }
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
              </Box>
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
        ) : (
          /* Analytics Table */
          <Card
            withBorder
            padding={0}
            style={{ overflow: 'hidden', height: '71vh' }}
          >
            <Box
              style={{ height: '100%', overflowX: 'auto', overflowY: 'auto' }}
            >
              <Table
                highlightOnHover
                withTableBorder
                style={{ minWidth: '1400px' }}
              >
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
                      CATEGORIES
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '750px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      PERCENTAGE
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      TOTAL EXPENSES
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      JANUARY
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      FEBRUARY
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      MARCH
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      APRIL
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      MAY
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      JUNE
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      JULY
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      AUGUST
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      SEPTEMBER
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      OCTOBER
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
                      NOVEMBER
                    </Table.Th>
                    <Table.Th
                      style={{
                        textAlign: 'center',
                        padding: '16px 12px',
                        color: '#495057',
                        width: '150px',
                        backgroundColor: '#f1f3f5',
                      }}
                    >
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
                            style={{ flex: 1, minWidth: 80, maxWidth: 500 }}
                          />
                          <Text size="sm" fw={500} c="#495057">
                            {row.percentage.toFixed(1)}%
                          </Text>
                        </Group>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text fw={700} c="#495057">
                          {formatCurrency(row.total)}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.January > 0
                            ? formatCurrency(row.January)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.February > 0
                            ? formatCurrency(row.February)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.March > 0 ? formatCurrency(row.March) : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.April > 0 ? formatCurrency(row.April) : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.May > 0 ? formatCurrency(row.May) : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.June > 0 ? formatCurrency(row.June) : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.July > 0 ? formatCurrency(row.July) : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.August > 0
                            ? formatCurrency(row.August)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.September > 0
                            ? formatCurrency(row.September)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.October > 0
                            ? formatCurrency(row.October)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
                          {row.November > 0
                            ? formatCurrency(row.November)
                            : '₱0.00'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text size="sm" c="#495057">
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
                      <Text fw={700} size="lg" c="#495057">
                        TOTAL
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center', width: '180px' }}>
                      <Text fw={700} c="#495057">
                        100%
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right', width: '120px' }}>
                      <Text fw={700} size="lg" c="#495057">
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
                        <Table.Td
                          key={month}
                          style={{ textAlign: 'right', width: '110px' }}
                        >
                          <Text fw={700} c="#495057">
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
        )}
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

      {/* Receipt Viewer Modal */}
      <Modal
        opened={receiptModalOpen}
        onClose={() => {
          setReceiptModalOpen(false);
          setReceiptZoom(100);
        }}
        title={
          <Group justify="space-between" style={{ width: '100%' }}>
            <Text fw={600}>View Receipt</Text>
            <Group gap="xs">
              <Tooltip label="Zoom Out">
                <ActionIcon
                  variant="light"
                  onClick={() =>
                    setReceiptZoom((prev) => Math.max(25, prev - 25))
                  }
                  disabled={receiptZoom <= 25}
                >
                  <IconZoomOut size={18} />
                </ActionIcon>
              </Tooltip>
              <Text
                size="sm"
                fw={500}
                style={{ minWidth: 50, textAlign: 'center' }}
              >
                {receiptZoom}%
              </Text>
              <Tooltip label="Zoom In">
                <ActionIcon
                  variant="light"
                  onClick={() =>
                    setReceiptZoom((prev) => Math.min(300, prev + 25))
                  }
                  disabled={receiptZoom >= 300}
                >
                  <IconZoomIn size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Reset Zoom">
                <ActionIcon variant="light" onClick={() => setReceiptZoom(100)}>
                  <IconZoomReset size={18} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Download Receipt">
                <ActionIcon
                  variant="filled"
                  color="blue"
                  onClick={() => {
                    if (viewingReceipt) {
                      const link = document.createElement('a');
                      link.href = viewingReceipt;
                      link.download = receiptFileName || 'receipt';
                      link.click();
                    }
                  }}
                >
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        }
        size="90%"
        centered
        styles={{
          body: {
            maxHeight: '85vh',
            overflow: 'auto',
          },
        }}
      >
        {viewingReceipt && (
          <Box
            style={{
              textAlign: 'center',
              padding: '20px',
              overflow: 'auto',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewingReceipt}
              alt="Receipt"
              style={{
                width: `${receiptZoom}%`,
                maxWidth: 'none',
                height: 'auto',
                objectFit: 'contain',
                transition: 'width 0.2s ease',
              }}
            />
          </Box>
        )}
      </Modal>
    </PageLayout>
  );
}
