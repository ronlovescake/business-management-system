import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { useHouseholdExpenseData } from '@/hooks/useSheetData';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { showError } from '@/lib/alerts';
import { householdExpenseCategoryOptions } from '@/modules/household/expenses/utils';
import type { HouseholdExpenseCategory } from '@/modules/household/expenses/api';
import type { HouseholdExpenseDTO } from '@/services/ExpenseService';

export interface Expense {
  id: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  notes: string;
  receipt: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  employeeName?: string; // displayed as "Logged by" in UI
  accountId?: string | null;
  sourceType?: string;
  sourceId?: string | null;
  sourceLineKey?: string | null;
  systemGenerated?: boolean;
}

type HouseholdAccountOption = {
  value: string;
  label: string;
};

const DEFAULT_HOUSEHOLD_ACCOUNT_NAME = 'Ronald Allan Balnig';

function resolveDefaultAccountId(
  options: HouseholdAccountOption[]
): string | null {
  if (!Array.isArray(options) || options.length === 0) {
    return null;
  }

  const normalizedTarget = DEFAULT_HOUSEHOLD_ACCOUNT_NAME.trim().toLowerCase();
  const exact = options.find(
    (o) => o.label.trim().toLowerCase() === normalizedTarget
  );

  return (exact ?? options[0])?.value ?? null;
}

async function confirmTripleDeleteExpense(): Promise<boolean> {
  const step1 = await Swal.fire({
    title: 'Delete expense?',
    text: 'This will permanently delete this expense entry.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step1.isConfirmed) {
    return false;
  }

  const step2 = await Swal.fire({
    title: 'Are you absolutely sure?',
    text: 'If this expense is approved/paid, deleting it will affect your linked account balance.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step2.isConfirmed) {
    return false;
  }

  const step3 = await Swal.fire({
    title: 'Final confirmation',
    text: 'Type DELETE to confirm.',
    icon: 'warning',
    input: 'text',
    inputPlaceholder: 'DELETE',
    inputAttributes: { autocapitalize: 'off' },
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
    inputValidator: (value) => {
      if ((value || '').trim().toUpperCase() !== 'DELETE') {
        return 'Please type DELETE to confirm.';
      }
      return undefined;
    },
  });

  return step3.isConfirmed;
}

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

export function useHouseholdExpenses() {
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

  const {
    data: expensesFromDB,
    isLoading: isLoadingExpenses,
    create: createExpense,
    update: updateExpense,
    delete: deleteExpense,
    bulkUpdate: _bulkUpdateExpenses,
    bulkCreate: _bulkCreateExpenses,
  } = useHouseholdExpenseData();

  const expenses = useMemo(() => {
    const source = Array.isArray(expensesFromDB) ? expensesFromDB : [];

    return source.map((dto: HouseholdExpenseDTO) => {
      return {
        id: dto.id !== undefined ? String(dto.id) : '',
        date: dto.date,
        amount: dto.amount,
        description: dto.description,
        category: dto.category,
        notes: dto.notes ?? '',
        receipt: dto.receipt ?? null,
        status: dto.status as 'pending' | 'approved' | 'rejected' | 'paid',
        employeeName: dto.loggedBy ?? undefined,
        accountId: dto.accountId ?? null,
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
  }, [expensesFromDB]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('list');

  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formReceipt, setFormReceipt] = useState<File | null>(null);
  const [formAccountId, setFormAccountId] = useState<string | null>(null);

  const [isImporting, setIsImporting] = useState(false);

  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [receiptZoom, setReceiptZoom] = useState(100);
  const [receiptFileName, setReceiptFileName] = useState<string>('');

  const [receiptFiles, _setReceiptFiles] = useState<Record<string, string>>({});

  const categories = useMemo<string[]>(
    () => [...householdExpenseCategoryOptions],
    []
  );

  const [accountOptions, setAccountOptions] = useState<
    HouseholdAccountOption[]
  >([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await fetch('/api/household/accounts', {
          cache: 'no-store',
        });
        const payload = (await res.json()) as unknown;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (payload as any)?.data ?? payload;
        if (!mounted || !Array.isArray(data)) {
          return;
        }

        const options = (
          data as Array<{
            id: string;
            name: string;
            isActive?: boolean;
          }>
        )
          .filter(
            (a) => a && typeof a.id === 'string' && typeof a.name === 'string'
          )
          .filter((a) => a.isActive !== false)
          .map((a) => ({ value: a.id, label: a.name }));

        setAccountOptions(options);
      } catch {
        if (mounted) {
          setAccountOptions([]);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const defaultAccountId = useMemo(
    () => resolveDefaultAccountId(accountOptions),
    [accountOptions]
  );

  useEffect(() => {
    // If adding a new expense and the user hasn't chosen an account yet,
    // default to the preferred household account.
    if (!isModalOpen || editingExpense || formAccountId) {
      return;
    }

    if (defaultAccountId) {
      setFormAccountId(defaultAccountId);
    }
  }, [defaultAccountId, editingExpense, formAccountId, isModalOpen]);

  const getSourceLabel = (sourceType?: string): string => {
    const normalized = (sourceType || 'MANUAL').toUpperCase();
    switch (normalized) {
      case 'PRODUCT':
        return 'Product';
      case 'PAYROLL':
        return 'Payroll';
      case 'MANUAL':
        return 'Manual';
      default:
        return normalized.charAt(0) + normalized.slice(1).toLowerCase();
    }
  };

  const getSourceColor = (sourceType?: string): string => {
    const label = getSourceLabel(sourceType);
    const map: Record<string, string> = {
      Product: 'blue',
      Payroll: 'cyan',
      Manual: 'gray',
    };
    return map[label] || 'gray';
  };

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

  const filteredExpenses = useMemo(() => {
    const filtered = expenses.filter((expense) => {
      const matchesSearch =
        searchQuery === '' ||
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        expense.employeeName
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        getSourceLabel(expense.sourceType)
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      const matchesCategory =
        !filterCategory || expense.category === filterCategory;

      const matchesStatus = !filterStatus || expense.status === filterStatus;

      const matchesSource =
        !filterSource || getSourceLabel(expense.sourceType) === filterSource;

      return matchesSearch && matchesCategory && matchesStatus && matchesSource;
    });

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateB - dateA;
    });
  }, [expenses, searchQuery, filterCategory, filterStatus, filterSource]);

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
    const householdMap: Partial<Record<HouseholdExpenseCategory, string>> = {
      Groceries: 'green.6',
      'Utilities - Electricity': 'orange.6',
      'Utilities - Internet': 'orange.6',
      'Utilities - Water': 'orange.6',
      Housing: 'grape.7',
      Transportation: 'indigo.6',
      Insurance: 'teal.7',
      Healthcare: 'red.6',
      'Debt Payments': 'pink.6',
      Education: 'blue.6',
      'Savings & Investments': 'cyan.6',
      'Personal Care': 'violet.5',
      Entertainment: 'yellow.7',
      'Gifts & Donations': 'lime.6',
      Pets: 'orange.7',
      'Household Supplies': 'grape.5',
      Travel: 'teal.6',
      Miscellaneous: 'gray.6',
    };
    return householdMap[category as HouseholdExpenseCategory] || 'gray';
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setFormDate('');
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormNotes('');
    setFormReceipt(null);
    setFormAccountId(defaultAccountId);
    setIsModalOpen(true);
  };

  const handleEditExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormDate(expense.date);
    setFormAmount(expense.amount);
    setFormDescription(expense.description);
    setFormCategory(expense.category);
    setFormNotes(expense.notes || '');
    setFormReceipt(null);
    setFormAccountId(expense.accountId ?? null);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormDate('');
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormNotes('');
    setFormReceipt(null);
    setFormAccountId(null);
  };

  const handleDeleteExpense = async (id: string) => {
    const confirmed = await confirmTripleDeleteExpense();
    if (!confirmed) {
      return;
    }

    try {
      void Swal.fire({
        title: 'Deleting...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      deleteExpense(id);

      await Swal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Expense deleted successfully.',
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      logger.error('Failed to delete expense', { error, id });
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text:
          error instanceof Error ? error.message : 'Unable to delete expense.',
      });
      showError('Failed to delete expense');
    }
  };

  const handleApprove = (id: string) => {
    updateExpense({ id, data: { status: 'approved' } });
  };

  const handleReject = (id: string) => {
    updateExpense({ id, data: { status: 'rejected' } });
  };

  const handleViewReceipt = (receiptName: string) => {
    setViewingReceipt(receiptFiles[receiptName] || receiptName);
    setReceiptFileName(receiptName.split('/').pop() || 'receipt');
    setReceiptModalOpen(true);
  };

  const handleSaveExpense = async () => {
    if (!formDate || !formAmount || !formDescription || !formCategory) {
      showError('Please fill out all required fields');
      return;
    }

    const payload: Partial<HouseholdExpenseDTO> = {
      date: formDate,
      amount: Number(formAmount),
      description: formDescription,
      category: formCategory,
      notes: formNotes || null,
      receipt: formReceipt ? formReceipt.name : null,
      status: editingExpense?.status || 'pending',
      loggedBy: editingExpense?.employeeName || currentUserName,
      accountId: formAccountId,
    };

    try {
      if (editingExpense) {
        updateExpense({ id: Number(editingExpense.id), data: payload });
        showNotification({
          title: 'Expense Updated',
          message: 'The expense has been updated successfully.',
          color: 'green',
        });
      } else {
        createExpense(payload);
        showNotification({
          title: 'Expense Added',
          message: 'The expense has been added successfully.',
          color: 'green',
        });
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      logger.error('Failed to save expense', { error, payload });
      showError('Failed to save expense');
    }
  };

  const handleImportCSV = async () => {
    try {
      setIsImporting(true);
      // CSV import not yet implemented for household; placeholder
      showNotification({
        title: 'Coming soon',
        message: 'CSV import for household expenses is not yet available.',
        color: 'yellow',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportCSV = () => {
    // Simple export placeholder
    showNotification({
      title: 'Export not available',
      message: 'CSV export for household expenses will be added soon.',
      color: 'yellow',
    });
  };

  return {
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
    formDate,
    setFormDate,
    formAmount,
    setFormAmount,
    formDescription,
    setFormDescription,
    formCategory,
    setFormCategory,
    formAccountId,
    setFormAccountId,
    formNotes,
    setFormNotes,
    formReceipt,
    setFormReceipt,
    viewingReceipt,
    receiptModalOpen,
    setReceiptModalOpen,
    receiptZoom,
    setReceiptZoom,
    receiptFileName,
    categories,
    accountOptions,
    sourceOptions,
    totalExpenses,
    pendingExpenses,
    approvedExpenses,
    thisMonthExpenses,
    monthlyBreakdown,
    formatDate,
    formatCurrency,
    getCategoryColor,
    getSourceLabel,
    getSourceColor,
    handleAddExpense,
    handleEditExpense,
    handleDeleteExpense,
    handleSaveExpense,
    handleApprove,
    handleReject,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
    isLoadingExpenses,
  };
}
