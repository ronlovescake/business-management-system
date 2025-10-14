import { useState, useMemo } from 'react';
import { logger } from '@/lib/logger';

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
 * Custom Hook: useExpenses
 *
 * Manages all business logic for the Expenses page:
 * - State management (expenses, filters, modals, forms)
 * - Computed values (filtered expenses, stats, monthly breakdown)
 * - Event handlers (CRUD operations, CSV import/export, approvals)
 * - Utility functions (formatters, validators)
 *
 * This hook isolates business logic from UI, making it:
 * - Testable independently
 * - Reusable across different UI implementations
 * - Easier to maintain and debug
 */
export function useExpenses() {
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

  // Store receipt files as data URLs
  const [receiptFiles, setReceiptFiles] = useState<Record<string, string>>({});

  // ============================================================================
  // CONSTANTS
  // ============================================================================

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

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

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

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [expenses, searchQuery, filterCategory, filterStatus]);

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

    return breakdown.sort((a, b) => b.total - a.total);
  }, [expenses, categories, totalExpenses]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

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

    if (formReceipt) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const receiptDataUrl = reader.result as string;
        const receiptFileName = formReceipt.name;

        setReceiptFiles((prev) => ({
          ...prev,
          [receiptFileName]: receiptDataUrl,
        }));

        saveExpenseData(receiptFileName);
      };
      reader.readAsDataURL(formReceipt);
    } else {
      saveExpenseData(editingExpense?.receipt ? editingExpense.receipt : null);
    }
  };

  const saveExpenseData = (receiptFileName: string | null) => {
    if (editingExpense) {
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
      prev.map((exp) =>
        exp.id === id ? { ...exp, status: 'approved' as const } : exp
      )
    );
  };

  const handleReject = (id: string) => {
    setExpenses((prev) =>
      prev.map((exp) =>
        exp.id === id ? { ...exp, status: 'rejected' as const } : exp
      )
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
    if (!file) {
      return;
    }

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

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.toLowerCase().replace(/\s+/g, '')
        );

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

            if (!row.date && !row.amount && !row.description) {
              continue;
            }

            if (!row.date || !row.amount || !row.description || !row.category) {
              errorCount++;
              errors.push(`Row ${i + 1}: Missing required field(s)`);
              continue;
            }

            const cleanAmount = row.amount.replace(/[₱$,\s]/g, '');
            const amount = parseFloat(cleanAmount);
            if (isNaN(amount)) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`);
              continue;
            }

            if (!categories.includes(row.category)) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid category "${row.category}"`);
              continue;
            }

            let dateStr = row.date;
            try {
              const parsedDate = new Date(dateStr);
              if (isNaN(parsedDate.getTime())) {
                errorCount++;
                errors.push(`Row ${i + 1}: Invalid date "${row.date}"`);
                continue;
              }
              const year = parsedDate.getFullYear();
              const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
              const day = String(parsedDate.getDate()).padStart(2, '0');
              dateStr = `${year}-${month}-${day}`;
            } catch (dateError) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid date format "${row.date}"`);
              continue;
            }

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
            logger.error(`Error parsing row ${i + 1}:`, error);
          }
        }

        if (importedExpenses.length > 0) {
          setExpenses((prev) => [...prev, ...importedExpenses]);
        }

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
        logger.error('CSV import error:', error);
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

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert('No expenses to export');
      return;
    }

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

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

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

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

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
  // RETURN API
  // ============================================================================

  return {
    // State
    expenses,
    filteredExpenses,
    searchQuery,
    setSearchQuery,
    filterCategory,
    setFilterCategory,
    filterStatus,
    setFilterStatus,
    isModalOpen,
    setIsModalOpen,
    editingExpense,
    activeTab,
    setActiveTab,
    isImporting,

    // Form state
    formDate,
    setFormDate,
    formAmount,
    setFormAmount,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formTripId,
    setFormTripId,
    formNotes,
    setFormNotes,
    formReceipt,
    setFormReceipt,

    // Receipt viewer state
    viewingReceipt,
    receiptModalOpen,
    setReceiptModalOpen,
    receiptZoom,
    setReceiptZoom,
    receiptFileName,

    // Computed values
    categories,
    totalExpenses,
    pendingExpenses,
    approvedExpenses,
    thisMonthExpenses,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatCurrency,
    getCategoryColor,

    // Event handlers
    handleAddExpense,
    handleEditExpense,
    handleDeleteExpense,
    handleSaveExpense,
    handleApprove,
    handleReject,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
  };
}
