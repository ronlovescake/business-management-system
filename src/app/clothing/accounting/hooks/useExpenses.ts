import { useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import {
  computeExpenseTotals,
  computeMonthlyBreakdownByCategory,
} from '@/lib/accounting/expenses-utils';
import {
  getExpenseSourceColor,
  getExpenseSourceLabel,
} from '@/lib/accounting/expense-sources';
import {
  buildCsvContent,
  downloadCsvFile,
  escapeCsvValue,
} from '@/lib/accounting/csv';
import {
  parseCsvAmount,
  parseCsvDateToISO,
  parseCsvText,
} from '@/lib/accounting/csv-import';
import { filterAndSortExpenses } from '@/lib/accounting/expense-filters';
import {
  buildExpenseImportMissingColumnsMessage,
  getMissingRequiredColumns,
} from '@/lib/accounting/expense-import';
import { useExpenseData } from '@/hooks/useSheetData';
import { showNotification } from '@mantine/notifications';
import { getCurrentDateISO } from '@/utils/date';
import { showError, showDeleteConfirm } from '@/lib/alerts';
import { expenseCategoryOptions } from '@/modules/clothing/ledger/utils';

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
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  employeeName?: string;
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean;
}

type ExpenseDTO = {
  id?: string | number;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes?: string | null;
  receipt?: string | null;
  status: string;
  employeeName?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean | null;
};

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
  } = useExpenseData();

  // The Accounting Expenses page is intended for operational expenses only.
  // Product costs/COGS are handled in the ledger and should not be shown here.
  const isOperationalExpense = useCallback((dto: ExpenseDTO): boolean => {
    const sourceType = (dto.sourceType ?? 'MANUAL').trim().toUpperCase();
    if (sourceType === 'PRODUCT') {
      return false;
    }

    if (sourceType === 'SHIPMENT') {
      return false;
    }

    const category = (dto.category ?? '').trim().toLowerCase();
    if (dto.systemGenerated === true && category === 'products') {
      return false;
    }

    if (
      dto.systemGenerated === true &&
      category === 'shipping / delivery fee'
    ) {
      return false;
    }

    return true;
  }, []);

  // Convert from database format to UI format
  const expenses = useMemo(() => {
    const source = Array.isArray(expensesFromDB) ? expensesFromDB : [];

    return source
      .map((raw) => raw as ExpenseDTO)
      .filter(isOperationalExpense)
      .map((dto) => {
        return {
          id: dto.id !== undefined ? String(dto.id) : '',
          date: dto.date,
          amount: dto.amount,
          description: dto.description,
          category: dto.category,
          notes: dto.notes ?? '',
          receipt: dto.receipt ?? null,
          status: dto.status as 'pending' | 'approved' | 'rejected' | 'paid',
          employeeName: dto.employeeName ?? undefined,
          sourceType: dto.sourceType ? String(dto.sourceType) : 'MANUAL',
          sourceId:
            dto.sourceId !== undefined && dto.sourceId !== null
              ? String(dto.sourceId)
              : null,
          sourceLineKey:
            dto.sourceLineKey !== undefined && dto.sourceLineKey !== null
              ? String(dto.sourceLineKey)
              : null,
          systemGenerated: dto.systemGenerated === true,
        } satisfies Expense;
      });
  }, [expensesFromDB, isOperationalExpense]);

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
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

  const categories = useMemo<string[]>(() => [...expenseCategoryOptions], []);

  const getSourceLabel = getExpenseSourceLabel;
  const getSourceColor = getExpenseSourceColor;

  const sourceOptions = useMemo(() => {
    const labels = new Set<string>();
    expenses.forEach((exp) => {
      const label = getSourceLabel(exp.sourceType);
      if (label) {
        labels.add(label);
      }
    });
    return Array.from(labels).sort((a, b) => a.localeCompare(b));
  }, [expenses]);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const filteredExpenses = useMemo(() => {
    return filterAndSortExpenses(expenses, {
      searchQuery,
      filterCategory,
      filterStatus,
      filterSource,
      getSearchTokens: (expense) => [
        expense.description,
        expense.category,
        expense.employeeName,
        getSourceLabel(expense.sourceType),
      ],
      getCategory: (expense) => expense.category,
      getStatus: (expense) => expense.status,
      getSourceLabel: (expense) => getSourceLabel(expense.sourceType),
      getDate: (expense) => expense.date,
    });
  }, [expenses, searchQuery, filterCategory, filterStatus, filterSource]);

  const {
    total: totalExpenses,
    pendingCount: pendingExpenses,
    approvedTotal: approvedExpenses,
    thisMonthTotal: thisMonthExpenses,
  } = useMemo(() => computeExpenseTotals(expenses), [expenses]);

  const monthlyBreakdown = useMemo((): MonthlyBreakdown[] => {
    return computeMonthlyBreakdownByCategory(
      expenses,
      categories,
      totalExpenses
    ) as MonthlyBreakdown[];
  }, [expenses, categories, totalExpenses]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string): string => {
    return formatLongDateUS(dateString);
  };

  const formatCurrency = (amount: number): string => {
    return formatCurrencyPHP(amount);
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
      Products: 'blue.6',
      'Shipping / Delivery Fee': 'teal.6',
      Payroll: 'cyan.7',
      Packaging: 'orange.6',
      'Warehouse Rental': 'grape.7',
      'Electricity Bill [Warehouse]': 'yellow.7',
      'Water Bill [Warehouse]': 'blue.4',
      'Business Expense - Others': 'gray.6',
      'Business Expense - Food': 'green.6',
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
        const parsed = parseCsvText(text);

        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          await showError('CSV file is empty or invalid', 'Import Error');
          setIsImporting(false);
          return;
        }
        const { headers, rows: parsedRows } = parsed;
        const missingColumns = getMissingRequiredColumns(headers);

        if (missingColumns.length > 0) {
          await showError(
            buildExpenseImportMissingColumnsMessage(missingColumns, [
              'notes',
              'receipt',
              'status',
              'employeeName',
            ]),
            'Import Error'
          );
          setIsImporting(false);
          return;
        }

        const importedExpenses: Expense[] = [];
        let successCount = 0;
        let errorCount = 0;
        const errors: string[] = [];

        for (let i = 0; i < parsedRows.length; i++) {
          try {
            const row = parsedRows[i];

            if (!row.date && !row.amount && !row.description) {
              continue;
            }

            if (!row.date || !row.amount || !row.description || !row.category) {
              errorCount++;
              errors.push(`Row ${i + 1}: Missing required field(s)`);
              continue;
            }

            const amount = parseCsvAmount(row.amount);
            if (amount === null) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid amount "${row.amount}"`);
              continue;
            }

            if (!categories.includes(row.category)) {
              errorCount++;
              errors.push(`Row ${i + 1}: Invalid category "${row.category}"`);
              continue;
            }

            const dateStr = parseCsvDateToISO(row.date);
            if (!dateStr) {
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

    const rows = filteredExpenses.map((expense) => [
      escapeCsvValue(expense.date),
      escapeCsvValue(expense.amount.toFixed(2)),
      escapeCsvValue(expense.description),
      escapeCsvValue(expense.category),
      escapeCsvValue(expense.notes),
      escapeCsvValue(expense.receipt || ''),
      escapeCsvValue(expense.status),
      escapeCsvValue(expense.employeeName || ''),
    ]);

    const csvContent = buildCsvContent(headers, rows);
    const date = getCurrentDateISO();
    const filename = `expenses_${date}.csv`;

    downloadCsvFile(filename, csvContent);
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
    filterSource,
    setFilterSource,
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
    sourceOptions,
    totalExpenses,
    pendingExpenses,
    approvedExpenses,
    thisMonthExpenses,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatCurrency,
    getCategoryColor,
    getSourceLabel,
    getSourceColor,

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
