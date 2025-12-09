import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { useTruckingExpenseData } from '@/hooks/useSheetData';
import { getCurrentDateISO } from '@/utils/date';
import { showError, showDeleteConfirm } from '@/lib/alerts';
import type { FleetRegistryRecord } from '@/modules/trucking/operations/fleet-registry/types/fleetRegistry.types';

type VehicleOption = { value: string; label: string };

const buildVehicleOptions = (
  records: FleetRegistryRecord[]
): VehicleOption[] => {
  const deduped = new Map<string, string>();

  records.forEach((record) => {
    const truckId = record.truckId?.trim();
    if (!truckId) {
      return;
    }

    const descriptor = [record.maker, record.model]
      .filter(Boolean)
      .join(' ')
      .trim();

    const label = descriptor ? `${truckId} — ${descriptor}` : truckId;
    deduped.set(truckId, label);
  });

  return Array.from(deduped.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

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
  const { data: session } = useSession();
  const currentUserName = useMemo(() => {
    const name = session?.user?.name?.trim();
    if (name) {
      return name;
    }

    const email = session?.user?.email?.trim();
    if (email) {
      return email;
    }

    return 'Current User';
  }, [session?.user?.name, session?.user?.email]);
  // ============================================================================
  // DATABASE CONNECTION
  // ============================================================================

  const {
    data: expensesFromDB,
    isLoading: isLoadingExpenses,
    create: createExpense,
    update: updateExpense,
    delete: deleteExpense,
    bulkUpdate: _bulkUpdateExpenses,
    bulkCreate: bulkCreateExpenses,
  } = useTruckingExpenseData();

  // Convert from database format to UI format
  const expenses = useMemo(() => {
    const source = Array.isArray(expensesFromDB) ? expensesFromDB : [];

    return source.map((exp) => ({
      id: String(exp.id),
      date: exp.date,
      amount: exp.amount,
      description: exp.description,
      category: exp.category,
      notes: exp.notes ?? '',
      receipt: exp.receipt,
      status: exp.status as 'pending' | 'approved' | 'rejected',
      employeeName: exp.employeeName ?? undefined,
    }));
  }, [expensesFromDB]);

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

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
  const [vehicleOptions, setVehicleOptions] = useState<VehicleOption[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);

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

  useEffect(() => {
    let isMounted = true;

    const fetchVehicleOptions = async () => {
      setIsLoadingVehicles(true);
      try {
        const response = await fetch('/api/trucking/fleet-vehicles', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to load fleet vehicles');
        }

        const payload = (await response.json()) as {
          data?: FleetRegistryRecord[];
        };

        if (isMounted) {
          setVehicleOptions(buildVehicleOptions(payload.data ?? []));
        }
      } catch (error) {
        logger.error(
          'Unable to load fleet vehicles for trucking expenses',
          error
        );
      } finally {
        if (isMounted) {
          setIsLoadingVehicles(false);
        }
      }
    };

    void fetchVehicleOptions();

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleDeleteExpense = async (id: string) => {
    const confirmed = await showDeleteConfirm('this expense');
    if (confirmed) {
      deleteExpense(Number(id));
      showNotification({
        title: 'Success',
        message: 'Expense deleted successfully',
        color: 'green',
      });
    }
  };

  const handleSaveExpense = async () => {
    if (!formDate || !formAmount || !formDescription || !formCategory) {
      await showError('Please fill in all required fields', 'Validation Error');
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
      updateExpense({
        id: Number(editingExpense.id),
        data: {
          date: formDate,
          amount: Number(formAmount),
          description: formDescription,
          category: formCategory,
          notes: formNotes,
          receipt: receiptFileName,
          status: editingExpense.status,
          employeeName: editingExpense.employeeName || null,
        },
      });
      showNotification({
        title: 'Success',
        message: 'Expense updated successfully',
        color: 'green',
      });
    } else {
      createExpense({
        date: formDate,
        amount: Number(formAmount),
        description: formDescription,
        category: formCategory,
        notes: formNotes,
        receipt: receiptFileName,
        status: 'pending',
        employeeName: currentUserName,
      });
      showNotification({
        title: 'Success',
        message: 'Expense created successfully',
        color: 'green',
      });
    }

    setIsModalOpen(false);
  };

  const handleApprove = (id: string) => {
    updateExpense({
      id: Number(id),
      data: { status: 'approved' },
    });
    showNotification({
      title: 'Success',
      message: 'Expense approved',
      color: 'green',
    });
  };

  const handleReject = (id: string) => {
    updateExpense({
      id: Number(id),
      data: { status: 'rejected' },
    });
    showNotification({
      title: 'Success',
      message: 'Expense rejected',
      color: 'red',
    });
  };

  const handleViewReceipt = async (receiptName: string) => {
    const receiptData = receiptFiles[receiptName];
    if (receiptData) {
      setViewingReceipt(receiptData);
      setReceiptFileName(receiptName);
      setReceiptZoom(100);
      setReceiptModalOpen(true);
    } else {
      await showError(
        'Receipt file not found. This may be a pre-existing receipt.',
        'Receipt Not Found'
      );
    }
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          await showError('CSV file is empty or invalid', 'Import Error');
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
          await showError(
            `Missing required columns: ${missingColumns.join(', ')}\n\n` +
              'Required columns: date, amount, description, category\n' +
              'Optional columns: notes, receipt, status, employeeName',
            'Import Error'
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
          // Import new expenses by creating them in bulk
          bulkCreateExpenses(
            importedExpenses.map((exp) => ({
              date: exp.date,
              amount: exp.amount,
              description: exp.description,
              category: exp.category,
              notes: exp.notes || null,
              receipt: exp.receipt,
              status: exp.status,
              employeeName: exp.employeeName || null,
            }))
          );

          showNotification({
            title: 'Success',
            message: `${importedExpenses.length} expenses imported successfully`,
            color: 'green',
          });
        }

        let message =
          `Import completed!\n\n` +
          `✅ Successfully imported: ${successCount} expenses\n` +
          (errorCount > 0 ? `⚠️ Failed to import: ${errorCount} rows\n` : '') +
          `\nTotal expenses: ${expenses.length + successCount}`;

        if (errors.length > 0 && errors.length <= 10) {
          message += `\n\nErrors:\n${errors.join('\n')}`;
        }

        await showError(message, 'Import Complete');
      } catch (error) {
        logger.error('CSV import error:', error);
        await showError(
          'Failed to import CSV file. Please check the file format.',
          'Import Error'
        );
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = async () => {
      await showError('Failed to read CSV file', 'File Read Error');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleExportCSV = async () => {
    if (filteredExpenses.length === 0) {
      await showError('No expenses to export', 'Export Error');
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

    const date = getCurrentDateISO();
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
    isLoading: isLoadingExpenses,

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
    vehicleOptions,
    isLoadingVehicles,
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
