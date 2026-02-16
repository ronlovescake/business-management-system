import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { logger } from '@/lib/logger';
import { useHouseholdExpenseData } from '@/hooks/useSheetData';
import { showNotification } from '@mantine/notifications';
import { showError, showLoading, closeAlert, showSuccess } from '@/lib/alerts';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { getCurrentDateISO } from '@/utils/date';
import {
  computeExpenseTotals,
  computeMonthlyBreakdownByCategory,
} from '@/lib/accounting/expenses-utils';
import {
  formatCurrencyPHP,
  formatLongDateUS,
} from '@/lib/accounting/formatters';
import {
  getExpenseSourceColor,
  getExpenseSourceLabel,
} from '@/lib/accounting/expense-sources';
import {
  buildCsvContent,
  downloadCsvFile,
  downloadCsvTemplateFile,
  escapeCsvValue,
} from '@/lib/accounting/csv';
import { filterAndSortExpenses } from '@/lib/accounting/expense-filters';
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

type ExpenseDateFilterOption =
  | 'All Time'
  | 'This Month'
  | 'Last Month'
  | 'Last 30 Days'
  | 'This Year'
  | 'Last Year';

const EXPENSE_DATE_FILTER_OPTIONS: ExpenseDateFilterOption[] = [
  'All Time',
  'This Month',
  'Last Month',
  'Last 30 Days',
  'This Year',
  'Last Year',
];

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

function buildDateRange(
  filter: ExpenseDateFilterOption | null
): { start?: Date; end?: Date } | null {
  if (!filter || filter === 'All Time') {
    return null;
  }

  const now = new Date();
  const end = new Date(now);

  switch (filter) {
    case 'This Month': {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    }
    case 'Last Month': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      lastDayPrevMonth.setHours(23, 59, 59, 999);
      return { start, end: lastDayPrevMonth };
    }
    case 'Last 30 Days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 30);
      return { start, end };
    }
    case 'This Year': {
      return { start: new Date(now.getFullYear(), 0, 1), end };
    }
    case 'Last Year': {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(now.getFullYear(), 0, 0);
      endOfLastYear.setHours(23, 59, 59, 999);
      return { start, end: endOfLastYear };
    }
    default:
      return null;
  }
}

async function confirmTripleDeleteExpense(): Promise<boolean> {
  return confirmTripleDelete({
    title: 'Delete expense?',
    warning: 'This will permanently delete this expense entry.',
    secondaryWarning:
      'If this expense is approved/paid, deleting it will affect your linked account balance.',
    finalPrompt: 'Type DELETE to confirm.',
  });
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
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilterOption | null>(
    'This Month'
  );
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

  const accountLabelById = useMemo(() => {
    return new Map(accountOptions.map((opt) => [opt.value, opt.label]));
  }, [accountOptions]);

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
  }, [expenses, getSourceLabel]);

  const filteredExpenses = useMemo(() => {
    const dateRange = buildDateRange(dateFilter);
    return filterAndSortExpenses(expenses, {
      searchQuery,
      filterDateRange: dateRange,
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
  }, [
    expenses,
    searchQuery,
    dateFilter,
    filterCategory,
    filterStatus,
    filterSource,
    getSourceLabel,
  ]);

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

  const formatDate = (dateString: string): string => {
    return formatLongDateUS(dateString);
  };

  const formatCurrency = (amount: number): string => {
    return formatCurrencyPHP(amount);
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
    setFormDate(getCurrentDateISO());
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
    setFormDate(getCurrentDateISO());
    setFormAmount('');
    setFormDescription('');
    setFormCategory('');
    setFormNotes('');
    setFormReceipt(null);
    setFormAccountId(defaultAccountId);
  };

  const handleDeleteExpense = async (id: string) => {
    const confirmed = await confirmTripleDeleteExpense();
    if (!confirmed) {
      return;
    }

    try {
      await showLoading('Deleting...');

      deleteExpense(id);

      await closeAlert();
      await showSuccess('Expense deleted successfully.', 'Deleted');
    } catch (error) {
      logger.error('Failed to delete expense', { error, id });
      await closeAlert();
      await showError(
        error instanceof Error ? error.message : 'Unable to delete expense.',
        'Delete failed'
      );
    }
  };

  const handleApprove = (id: string) => {
    updateExpense({ id, data: { status: 'approved' } });
  };

  const handleReject = (id: string) => {
    updateExpense({ id, data: { status: 'rejected' } });
  };

  const handleMarkPaid = (id: string) => {
    updateExpense({ id, data: { status: 'paid' } });
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
      status: 'paid',
      loggedBy: currentUserName,
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

  const handleSaveAndAddExpense = async () => {
    if (editingExpense) {
      await handleSaveExpense();
      return;
    }

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
      status: 'paid',
      loggedBy: currentUserName,
      accountId: formAccountId,
    };

    try {
      // ======================================================================
      // ⚠️ SAVE + RESET (KEEP MODAL OPEN)
      // ======================================================================
      // Create the expense, then clear the form for rapid entry without
      // dismissing the modal.
      // ======================================================================
      createExpense(payload);
      showNotification({
        title: 'Expense Added',
        message: 'The expense has been added successfully.',
        color: 'green',
      });

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
    const data =
      (filteredExpenses.length > 0 ? filteredExpenses : expenses) ?? [];

    if (!data.length) {
      showNotification({
        title: 'Nothing to export',
        message: 'No household expenses found to export.',
        color: 'yellow',
      });
      return;
    }

    const headers = [
      'Date',
      'Amount',
      'Description',
      'Category',
      'Account',
      'Status',
      'Source',
      'Notes',
    ];

    const rows = data.map((e) => {
      const accountLabel = e.accountId
        ? accountLabelById.get(e.accountId) || ''
        : '';
      const sourceLabel = getSourceLabel(e.sourceType);

      return [
        escapeCsvValue(e.date),
        escapeCsvValue(Number(e.amount).toFixed(2)),
        escapeCsvValue(e.description),
        escapeCsvValue(e.category),
        escapeCsvValue(accountLabel),
        escapeCsvValue(e.status),
        escapeCsvValue(sourceLabel),
        escapeCsvValue(e.notes),
      ];
    });

    const csvContent = buildCsvContent(headers, rows);
    const filename = `household-expenses-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsvFile(filename, csvContent);

    showNotification({
      title: 'Export started',
      message: 'Household expenses CSV is downloading.',
      color: 'green',
    });
  };

  const handleDownloadTemplate = () => {
    const filename = `household-expenses-template-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCsvTemplateFile(filename, [
      'date',
      'amount',
      'description',
      'category',
      'account',
      'status',
      'source',
      'notes',
    ]);
  };

  return {
    expenses,
    filteredExpenses,
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    dateFilterOptions: EXPENSE_DATE_FILTER_OPTIONS,
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
    handleSaveAndAddExpense,
    handleApprove,
    handleReject,
    handleMarkPaid,
    handleViewReceipt,
    handleImportCSV,
    handleExportCSV,
    handleDownloadTemplate,
    isLoadingExpenses,
  };
}
