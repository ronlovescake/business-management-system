import { useState, useMemo, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { useTruckingExpenseData } from '@/hooks/useSheetData';
import { getCurrentDateISO } from '@/utils/date';
import { showError, showDeleteConfirm, showSuccess } from '@/lib/alerts';
import {
  computeExpenseTotals,
  computeMonthlyBreakdownByCategory,
} from '@/lib/accounting/expenses-utils';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import { getExpenseSourceLabel } from '@/lib/accounting/expense-sources';
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
  vehicleId?: string;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean;
  employeeId?: string | null;
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
      vehicleId: exp.vehicleId ?? undefined,
      sourceType: exp.sourceType ?? null,
      sourceId: exp.sourceId ?? null,
      sourceLineKey: exp.sourceLineKey ?? null,
      systemGenerated: exp.systemGenerated ?? false,
      employeeId: exp.employeeId ?? null,
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
  const [formVehicleId, setFormVehicleId] = useState('');
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
    return filterAndSortExpenses(expenses, {
      searchQuery,
      filterCategory,
      filterStatus,
      getSearchTokens: (expense) => [
        expense.description,
        expense.category,
        expense.employeeName,
        expense.sourceType,
        expense.sourceLineKey,
      ],
      getCategory: (expense) => expense.category,
      getStatus: (expense) => expense.status,
      getDate: (expense) => expense.date,
    });
  }, [expenses, searchQuery, filterCategory, filterStatus]);

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
    };
    return colorMap[category] || 'gray';
  };

  const getSourceLabel = (expense: Expense): string => {
    return getExpenseSourceLabel(expense.sourceType, {
      sourceLineKey: expense.sourceLineKey,
      includeLineKey: true,
    });
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddExpense = () => {
    setEditingExpense(null);
    setFormDate(getCurrentDateISO());
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormVehicleId('');
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
    setFormVehicleId(expense.vehicleId || '');
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
          vehicleId: formVehicleId || null,
          status: editingExpense.status,
          employeeName: editingExpense.employeeName || null,
          sourceType: editingExpense.sourceType ?? null,
          sourceId: editingExpense.sourceId ?? null,
          sourceLineKey: editingExpense.sourceLineKey ?? null,
          systemGenerated: editingExpense.systemGenerated ?? false,
          employeeId: editingExpense.employeeId ?? null,
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
        vehicleId: formVehicleId || null,
        status: 'pending',
        employeeName: currentUserName,
        sourceType: 'MANUAL',
        sourceId: null,
        sourceLineKey: null,
        systemGenerated: false,
        employeeId: null,
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
              'vehicleId',
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

            const vehicleId = row.vehicleid?.trim() || '';
            const employeeName = row.employeename?.trim();

            const newExpense: Expense = {
              id: `import_${Date.now()}_${i}`,
              date: dateStr,
              amount,
              description: row.description,
              category: row.category,
              notes: row.notes?.trim() || '',
              receipt: row.receipt || null,
              status: validStatus,
              employeeName: employeeName || 'Imported',
              vehicleId: vehicleId || undefined,
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
          const toOptionalString = (value?: string | null) => {
            const trimmed = value?.trim();
            return trimmed && trimmed.length > 0 ? trimmed : undefined;
          };

          // Import new expenses by creating them in bulk
          bulkCreateExpenses(
            importedExpenses.map((exp) => ({
              date: exp.date,
              amount: exp.amount,
              description: exp.description,
              category: exp.category,
              notes: toOptionalString(exp.notes),
              receipt: exp.receipt,
              status: exp.status,
              employeeName: toOptionalString(exp.employeeName),
              vehicleId: toOptionalString(exp.vehicleId) ?? null,
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

        await showSuccess(message, 'Import Complete');
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
      'Vehicle ID',
      'Source',
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
      escapeCsvValue(expense.vehicleId || ''),
      escapeCsvValue(getSourceLabel(expense)),
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
    formVehicleId,
    setFormVehicleId,
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
    getSourceLabel,

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
